use adb_gui_next_lib::payload::io::SparseFileExt;
use std::io::{Read, Seek, SeekFrom, Write};
use tempfile::NamedTempFile;

#[test]
fn test_sparse_file_mark_and_hole_punching() {
    let mut temp = NamedTempFile::new().expect("create temp file");
    let file = temp.as_file_mut();

    // 1. Mark sparse
    let mark_res = file.mark_sparse();
    assert!(mark_res.is_ok(), "mark_sparse should succeed: {:?}", mark_res);

    // 2. Mark sparse again (idempotent)
    assert!(file.mark_sparse().is_ok(), "subsequent mark_sparse is idempotent");

    // 3. Write 512 KiB test pattern (0x5A)
    let total_size: usize = 512 * 1024;
    let initial_data = vec![0x5Au8; total_size];
    file.write_all(&initial_data).expect("write initial data");
    file.flush().expect("flush file");

    // 4. Punch hole in the middle (128 KiB offset, 256 KiB length)
    let hole_offset: u64 = 128 * 1024;
    let hole_length: u64 = 256 * 1024;
    let punch_res = file.punch_hole(hole_offset, hole_length);
    assert!(punch_res.is_ok(), "punch_hole should succeed: {:?}", punch_res);

    // 5. Read back the entire file and verify regions
    file.seek(SeekFrom::Start(0)).expect("seek to start");
    let mut buf = vec![0u8; total_size];
    file.read_exact(&mut buf).expect("read back file");

    let prefix = &buf[..hole_offset as usize];
    let hole = &buf[hole_offset as usize..(hole_offset + hole_length) as usize];
    let suffix = &buf[(hole_offset + hole_length) as usize..];

    assert_eq!(prefix.len(), 128 * 1024);
    assert!(
        prefix.iter().all(|&b| b == 0x5A),
        "prefix bytes before hole must remain untouched (0x5A)"
    );

    assert_eq!(hole.len(), 256 * 1024);
    assert!(hole.iter().all(|&b| b == 0x00), "punched hole bytes must read as 0x00");

    assert_eq!(suffix.len(), 128 * 1024);
    assert!(
        suffix.iter().all(|&b| b == 0x5A),
        "suffix bytes after hole must remain untouched (0x5A)"
    );
}

#[test]
fn test_sparse_file_zero_length_no_op() {
    let mut temp = NamedTempFile::new().expect("create temp file");
    let file = temp.as_file_mut();
    file.mark_sparse().expect("mark sparse");

    // Zero-length hole punch is a valid no-op
    assert!(file.punch_hole(0, 0).is_ok());
    assert!(file.punch_hole(4096, 0).is_ok());
}

#[test]
fn test_sparse_file_punch_at_start() {
    let mut temp = NamedTempFile::new().expect("create temp file");
    let file = temp.as_file_mut();
    file.mark_sparse().expect("mark sparse");

    let size = 128 * 1024;
    file.write_all(&vec![0xFFu8; size]).expect("write data");
    file.flush().expect("flush");

    // Punch first 64 KiB
    file.punch_hole(0, 64 * 1024).expect("punch hole at start");

    file.seek(SeekFrom::Start(0)).expect("seek");
    let mut buf = vec![0u8; size];
    file.read_exact(&mut buf).expect("read exact");

    assert!(buf[..64 * 1024].iter().all(|&b| b == 0x00));
    assert!(buf[64 * 1024..].iter().all(|&b| b == 0xFF));
}
