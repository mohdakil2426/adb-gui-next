use adb_gui_next_lib::payload::samsung::{
    HashingReader, SamsungTarMd5Extractor, unpack_samsung_tar,
};
use lz4_flex::frame::FrameEncoder;
use md5::{Digest, Md5};
use std::io::{Read, Write};
use tempfile::tempdir;
#[test]
fn test_hashing_reader_in_flight_md5() {
    let test_data = b"The quick brown fox jumps over the lazy dog";
    let mut reader = HashingReader::new(&test_data[..]);

    let mut buf = Vec::new();
    let n = reader.read_to_end(&mut buf).expect("Read all bytes");

    assert_eq!(n, test_data.len());
    assert_eq!(reader.bytes_read(), test_data.len() as u64);
    assert_eq!(buf, test_data);

    // Standard MD5 for "The quick brown fox jumps over the lazy dog" is 9e107d9d372bb6826bd81d3542a419d6
    assert_eq!(reader.md5_hex(), "9e107d9d372bb6826bd81d3542a419d6");
}

#[test]
fn test_hashing_reader_partial_reads() {
    let test_data = b"Hello, Android Firmware Dumper!";
    let mut reader = HashingReader::new(&test_data[..]);

    let mut chunk1 = [0u8; 7];
    let mut chunk2 = [0u8; 10];
    let n1 = reader.read(&mut chunk1).expect("Read chunk 1");
    assert_eq!(n1, 7);
    assert_eq!(reader.bytes_read(), 7);

    let n2 = reader.read(&mut chunk2).expect("Read chunk 2");
    assert_eq!(n2, 10);
    assert_eq!(reader.bytes_read(), 17);

    let mut rest = Vec::new();
    let n3 = reader.read_to_end(&mut rest).expect("Read remainder");
    assert_eq!(n1 + n2 + n3, test_data.len());
    assert_eq!(reader.bytes_read(), test_data.len() as u64);
    let expected_md5 = Md5::digest(test_data);
    let expected_hex: String = expected_md5.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(reader.md5_hex(), expected_hex);
}

#[test]
fn test_samsung_tar_lz4_and_raw_extraction() {
    let temp = tempdir().expect("Create temp dir");
    let output_dir = temp.path().join("extracted_partitions");

    // 1. Create a raw boot.img payload
    let boot_data = b"ANDROID_BOOT_IMAGE_HEADER_V4_SAMPLE_DATA_BYTES_PADDING";

    // 2. Create an LZ4 compressed super.img payload
    let super_raw_data = vec![0xABu8; 65536]; // 64KB repetitive data
    let mut lz4_encoder = FrameEncoder::new(Vec::new());
    lz4_encoder.write_all(&super_raw_data).expect("Write to lz4 frame encoder");
    let super_lz4_data = lz4_encoder.finish().expect("Finish lz4 frame encoder");

    // 3. Create another LZ4 compressed recovery.img.lz4
    let recovery_raw_data = b"RECOVERY_IMAGE_RAMDISK_KERNEL_DTBO";
    let mut rec_encoder = FrameEncoder::new(Vec::new());
    rec_encoder.write_all(recovery_raw_data).expect("Write recovery to lz4");
    let recovery_lz4_data = rec_encoder.finish().expect("Finish recovery lz4");

    // 4. Build POSIX TAR archive
    let mut tar_builder = tar::Builder::new(Vec::new());

    // Add boot.img (raw)
    let mut boot_hdr = tar::Header::new_gnu();
    boot_hdr.set_size(boot_data.len() as u64);
    boot_hdr.set_mode(0o644);
    boot_hdr.set_cksum();
    tar_builder.append_data(&mut boot_hdr, "boot.img", &boot_data[..]).expect("Append boot.img");

    // Add super.img.lz4
    let mut super_hdr = tar::Header::new_gnu();
    super_hdr.set_size(super_lz4_data.len() as u64);
    super_hdr.set_mode(0o644);
    super_hdr.set_cksum();
    tar_builder
        .append_data(&mut super_hdr, "super.img.lz4", &super_lz4_data[..])
        .expect("Append super.img.lz4");

    // Add recovery.img.lz4
    let mut rec_hdr = tar::Header::new_gnu();
    rec_hdr.set_size(recovery_lz4_data.len() as u64);
    rec_hdr.set_mode(0o644);
    rec_hdr.set_cksum();
    tar_builder
        .append_data(&mut rec_hdr, "recovery.img.lz4", &recovery_lz4_data[..])
        .expect("Append recovery.img.lz4");

    let tar_bytes = tar_builder.into_inner().expect("Finalize tar archive");

    // 5. Unpack stream
    let extracted = SamsungTarMd5Extractor::unpack_stream(&tar_bytes[..], &output_dir)
        .expect("Unpack samsung tar stream");

    assert_eq!(extracted.len(), 3);
    assert_eq!(extracted[0].0, "boot.img");
    assert_eq!(extracted[0].1, boot_data.len() as u64);

    assert_eq!(extracted[1].0, "super.img");
    assert_eq!(extracted[1].1, super_raw_data.len() as u64);

    assert_eq!(extracted[2].0, "recovery.img");
    assert_eq!(extracted[2].1, recovery_raw_data.len() as u64);

    // 6. Verify decompressed files on disk
    let disk_boot = std::fs::read(output_dir.join("boot.img")).expect("Read boot.img");
    assert_eq!(disk_boot, boot_data);

    let disk_super = std::fs::read(output_dir.join("super.img")).expect("Read super.img");
    assert_eq!(disk_super, super_raw_data);

    let disk_rec = std::fs::read(output_dir.join("recovery.img")).expect("Read recovery.img");
    assert_eq!(disk_rec, recovery_raw_data);
}

#[test]
fn test_unpack_samsung_tar_file_api() {
    let temp = tempdir().expect("Create temp dir");
    let tar_file_path = temp.path().join("AP_S908BXXU1AVCJ.tar.md5");
    let output_dir = temp.path().join("unpacked_odin");

    let raw_pit = b"SAMSUNG_PARTITION_INFORMATION_TABLE_BINARY";
    let mut tar_builder = tar::Builder::new(Vec::new());

    let mut pit_hdr = tar::Header::new_gnu();
    pit_hdr.set_size(raw_pit.len() as u64);
    pit_hdr.set_mode(0o644);
    pit_hdr.set_cksum();
    tar_builder.append_data(&mut pit_hdr, "sample.pit", &raw_pit[..]).expect("Append pit");

    let tar_bytes = tar_builder.into_inner().expect("Finalize tar bytes");
    std::fs::write(&tar_file_path, &tar_bytes).expect("Write tar file");

    let results = unpack_samsung_tar(&tar_file_path, &output_dir).expect("Unpack samsung tar file");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].0, "sample.pit");
    assert_eq!(results[0].1, raw_pit.len() as u64);

    let extracted_pit =
        std::fs::read(output_dir.join("sample.pit")).expect("Read extracted pit file");
    assert_eq!(extracted_pit, raw_pit);
}
