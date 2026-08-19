//! Streaming Samsung `.tar.md5` and `.tar` unpacker with in-flight MD5 calculation
//! and on-the-fly LZ4 frame decompression.

use anyhow::{Context, Result};
use md5::{Digest as Md5Digest, Md5};
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use tar::Archive;

/// A streaming reader wrapper that computes MD5 digest on the fly as bytes are read.
pub struct HashingReader<R> {
    inner: R,
    hasher: Md5,
    bytes_read: u64,
}

impl<R: Read> HashingReader<R> {
    /// Create a new `HashingReader` wrapping an underlying reader.
    pub fn new(inner: R) -> Self {
        Self { inner, hasher: Md5::new(), bytes_read: 0 }
    }

    /// Number of bytes read through this wrapper so far.
    pub fn bytes_read(&self) -> u64 {
        self.bytes_read
    }

    /// Finalize the MD5 hash and return the 16-byte digest.
    pub fn finalize(self) -> [u8; 16] {
        self.hasher.finalize().into()
    }

    /// Finalize the MD5 hash and return the lowercase hex string.
    pub fn md5_hex(self) -> String {
        let digest = self.hasher.finalize();
        digest.iter().map(|b| format!("{b:02x}")).collect()
    }

    /// Consume the wrapper and return the inner reader.
    pub fn into_inner(self) -> R {
        self.inner
    }
}

impl<R: Read> Read for HashingReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let n = self.inner.read(buf)?;
        if n > 0 {
            self.hasher.update(&buf[..n]);
            self.bytes_read += n as u64;
        }
        Ok(n)
    }
}

/// Samsung `.tar.md5` streaming extractor.
pub struct SamsungTarMd5Extractor;

impl SamsungTarMd5Extractor {
    /// Unpacks a Samsung TAR archive stream into `output_dir`.
    ///
    /// Entries ending with `.lz4` are decompressed on the fly via `lz4_flex::frame::FrameDecoder`
    /// without buffering uncompressed images into memory. Raw entries are copied directly.
    ///
    /// Returns a list of extracted partitions as `(partition_filename, bytes_written)`.
    pub fn unpack_stream<R: Read>(stream: R, output_dir: &Path) -> Result<Vec<(String, u64)>> {
        std::fs::create_dir_all(output_dir).with_context(|| {
            format!("Failed to create output directory {}", output_dir.display())
        })?;

        let mut hashing_stream = HashingReader::new(stream);
        let mut archive = Archive::new(&mut hashing_stream);

        let mut extracted_partitions = Vec::new();

        let entries = archive.entries().context("Failed to read tar archive entries")?;

        for entry_result in entries {
            let mut entry = entry_result.context("Failed to read tar entry")?;
            let path = entry.path().context("Failed to get tar entry path")?.to_path_buf();
            let file_name =
                path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_string();

            if file_name.is_empty() {
                continue;
            }

            if let Some(target_name) = file_name.strip_suffix(".lz4") {
                let out_path = output_dir.join(target_name);
                let mut out_file = BufWriter::new(File::create(&out_path).with_context(|| {
                    format!("Failed to create output file {}", out_path.display())
                })?);

                let mut decoder = lz4_flex::frame::FrameDecoder::new(&mut entry);
                let copied = std::io::copy(&mut decoder, &mut out_file)
                    .with_context(|| format!("Failed to decompress LZ4 entry {file_name}"))?;
                out_file.flush().with_context(|| {
                    format!("Failed to flush output file {}", out_path.display())
                })?;

                extracted_partitions.push((target_name.to_string(), copied));
            } else {
                let out_path = output_dir.join(&file_name);
                let mut out_file = BufWriter::new(File::create(&out_path).with_context(|| {
                    format!("Failed to create output file {}", out_path.display())
                })?);
                let copied = std::io::copy(&mut entry, &mut out_file)
                    .with_context(|| format!("Failed to extract entry {file_name}"))?;
                out_file.flush().with_context(|| {
                    format!("Failed to flush output file {}", out_path.display())
                })?;

                extracted_partitions.push((file_name, copied));
            }
        }

        Ok(extracted_partitions)
    }
}

/// Helper function to unpack a Samsung TAR / TAR.MD5 file at `tar_path` into `output_dir`.
pub fn unpack_samsung_tar(tar_path: &Path, output_dir: &Path) -> Result<Vec<(String, u64)>> {
    let file = File::open(tar_path)
        .with_context(|| format!("Failed to open Samsung TAR archive {}", tar_path.display()))?;
    let buf_reader = BufReader::with_capacity(1024 * 1024, file);
    SamsungTarMd5Extractor::unpack_stream(buf_reader, output_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lz4_flex::frame::FrameEncoder;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_hashing_reader() {
        let input_data = b"The quick brown fox jumps over the lazy dog";
        let mut hashing_reader = HashingReader::new(&input_data[..]);
        let mut buffer = Vec::new();
        hashing_reader.read_to_end(&mut buffer).unwrap();

        assert_eq!(buffer, input_data);
        assert_eq!(hashing_reader.bytes_read(), input_data.len() as u64);

        // MD5 of "The quick brown fox jumps over the lazy dog" is 9e107d9d372bb6826bd81d3542a419d6
        let hex = hashing_reader.md5_hex();
        assert_eq!(hex, "9e107d9d372bb6826bd81d3542a419d6");
    }

    #[test]
    fn test_unpack_stream_with_lz4_and_raw() {
        let temp = tempdir().unwrap();
        let output_dir = temp.path().join("extracted");

        // Prepare raw payload and lz4 payload
        let raw_boot_data = b"BOOT_IMAGE_RAW_PAYLOAD_1234567890";
        let raw_recovery_data = b"RECOVERY_IMAGE_LZ4_DECOMPRESSED_PAYLOAD_DATA_987654321";

        let mut encoder = FrameEncoder::new(Vec::new());
        encoder.write_all(raw_recovery_data).unwrap();
        let lz4_recovery_data = encoder.finish().unwrap();

        // Build TAR archive in memory
        let mut tar_builder = tar::Builder::new(Vec::new());

        // Add boot.img
        let mut boot_header = tar::Header::new_gnu();
        boot_header.set_size(raw_boot_data.len() as u64);
        boot_header.set_mode(0o644);
        boot_header.set_cksum();
        tar_builder.append_data(&mut boot_header, "boot.img", &raw_boot_data[..]).unwrap();

        // Add recovery.img.lz4
        let mut rec_header = tar::Header::new_gnu();
        rec_header.set_size(lz4_recovery_data.len() as u64);
        rec_header.set_mode(0o644);
        rec_header.set_cksum();
        tar_builder
            .append_data(&mut rec_header, "recovery.img.lz4", &lz4_recovery_data[..])
            .unwrap();

        let tar_bytes = tar_builder.into_inner().unwrap();

        // Extract
        let extracted = SamsungTarMd5Extractor::unpack_stream(&tar_bytes[..], &output_dir).unwrap();

        assert_eq!(extracted.len(), 2);
        assert_eq!(extracted[0].0, "boot.img");
        assert_eq!(extracted[0].1, raw_boot_data.len() as u64);
        assert_eq!(extracted[1].0, "recovery.img");
        assert_eq!(extracted[1].1, raw_recovery_data.len() as u64);

        // Verify file contents on disk
        let extracted_boot = std::fs::read(output_dir.join("boot.img")).unwrap();
        assert_eq!(extracted_boot, raw_boot_data);

        let extracted_rec = std::fs::read(output_dir.join("recovery.img")).unwrap();
        assert_eq!(extracted_rec, raw_recovery_data);
    }

    #[test]
    fn test_unpack_samsung_tar_file() {
        let temp = tempdir().unwrap();
        let tar_file_path = temp.path().join("AP_test.tar.md5");
        let output_dir = temp.path().join("out");

        let raw_data = b"SAMPLE_SYSTEM_IMAGE_RAW";
        let mut tar_builder = tar::Builder::new(Vec::new());

        let mut header = tar::Header::new_gnu();
        header.set_size(raw_data.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        tar_builder.append_data(&mut header, "system.img", &raw_data[..]).unwrap();

        let tar_bytes = tar_builder.into_inner().unwrap();
        std::fs::write(&tar_file_path, &tar_bytes).unwrap();

        let extracted = unpack_samsung_tar(&tar_file_path, &output_dir).unwrap();
        assert_eq!(extracted.len(), 1);
        assert_eq!(extracted[0].0, "system.img");
        assert_eq!(extracted[0].1, raw_data.len() as u64);

        let extracted_system = std::fs::read(output_dir.join("system.img")).unwrap();
        assert_eq!(extracted_system, raw_data);
    }
}
