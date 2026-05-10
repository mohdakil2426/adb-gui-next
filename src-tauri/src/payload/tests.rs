//! Tests for payload parsing and extraction.

use super::*;
use crate::payload::chromeos_update_engine::{
    DeltaArchiveManifest, InstallOperation, PartitionInfo, PartitionUpdate, install_operation::Type,
};
use ::zip::write::SimpleFileOptions;
use prost::Message;
use std::{fs, io::Write};
use tempfile::tempdir;

#[test]
fn lists_partitions_and_details_from_payload_bin() {
    let temp = tempdir().expect("tempdir");
    let payload_path = temp.path().join("payload.bin");
    write_test_payload(&payload_path, "system", 4096, &[7; 4096]);

    let cache = PayloadCache::default();

    let partitions = list_payload_partitions(&payload_path, &cache).expect("partitions");
    let details =
        list_payload_partitions_with_details(&payload_path, &cache).expect("partition details");

    assert_eq!(partitions, vec!["system".to_string()]);
    assert_eq!(details, vec![PartitionDetail { name: "system".into(), size: 4096 }]);
}

#[test]
fn extracts_selected_partition_image() {
    let temp = tempdir().expect("tempdir");
    let payload_path = temp.path().join("payload.bin");
    let output_dir = temp.path().join("out");
    let image_bytes = vec![7; 4096];
    write_test_payload(&payload_path, "system", 4096, &image_bytes);

    let cache = PayloadCache::default();
    let mut progress_events = Vec::new();

    let result = extract_payload(
        &payload_path,
        Some(&output_dir),
        &[String::from("system")],
        &cache,
        None,
        VerifyMode::default(),
        |name: &str, current: usize, total: usize, completed: bool| {
            progress_events.push((name.to_string(), current, total, completed));
        },
        None,
        None,
    )
    .expect("extract payload");

    assert!(result.success);
    assert_eq!(result.output_dir, output_dir.to_string_lossy());
    assert_eq!(result.extracted_files, vec![String::from("system.img")]);
    assert!(output_dir.join("system.img").exists());
    assert_eq!(fs::read(output_dir.join("system.img")).expect("image bytes"), image_bytes);
    assert!(
        progress_events.iter().any(|event| event == &("system".into(), 1, 1, true)),
        "expected a completion progress event"
    );
}

#[test]
fn lists_partitions_from_zip_and_cleans_cached_payload() {
    let temp = tempdir().expect("tempdir");
    let payload_path = temp.path().join("payload.bin");
    let zip_path = temp.path().join("ota.zip");
    write_test_payload(&payload_path, "vendor", 4096, &[3; 4096]);
    write_zip_with_payload(&zip_path, &payload_path);

    let cache = PayloadCache::default();

    let partitions = list_payload_partitions(&zip_path, &cache).expect("zip partitions");
    assert_eq!(partitions, vec!["vendor".to_string()]);

    cache.cleanup().expect("cleanup cache");
}

#[test]
fn extracts_multi_extent_and_zero_operations() {
    let temp = tempdir().expect("tempdir");
    let payload_path = temp.path().join("payload.bin");
    let output_dir = temp.path().join("out");

    write_custom_payload(
        &payload_path,
        DeltaArchiveManifest {
            partitions: vec![PartitionUpdate {
                partition_name: "system".to_string(),
                new_partition_info: Some(PartitionInfo {
                    size: Some(16384),
                    hash: Some(Vec::new()),
                }),
                operations: vec![
                    InstallOperation {
                        r#type: Type::Replace as i32,
                        data_offset: Some(0),
                        data_length: Some(8192),
                        dst_extents: vec![
                            chromeos_update_engine::Extent {
                                start_block: Some(0),
                                num_blocks: Some(1),
                            },
                            chromeos_update_engine::Extent {
                                start_block: Some(2),
                                num_blocks: Some(1),
                            },
                        ],
                        data_sha256_hash: Some(Vec::new()),
                        ..Default::default()
                    },
                    InstallOperation {
                        r#type: Type::Zero as i32,
                        data_offset: Some(8192),
                        data_length: Some(0),
                        dst_extents: vec![chromeos_update_engine::Extent {
                            start_block: Some(3),
                            num_blocks: Some(1),
                        }],
                        data_sha256_hash: Some(Vec::new()),
                        ..Default::default()
                    },
                ],
                ..Default::default()
            }],
            ..Default::default()
        },
        &[5; 8192],
    );

    let cache = PayloadCache::default();
    let result = extract_payload(
        &payload_path,
        Some(&output_dir),
        &[String::from("system")],
        &cache,
        None,
        VerifyMode::default(),
        |_, _, _, _| {},
        None,
        None,
    )
    .expect("extract multi extent payload");

    assert!(result.success);
    let image = fs::read(output_dir.join("system.img")).expect("read system image");
    assert_eq!(&image[0..4096], &[5; 4096]);
    assert_eq!(&image[4096..8192], &[0; 4096]);
    assert_eq!(&image[8192..12288], &[5; 4096]);
    assert_eq!(&image[12288..16384], &[0; 4096]);
}

#[test]
fn rejects_payload_when_data_hash_mismatches() {
    let temp = tempdir().expect("tempdir");
    let payload_path = temp.path().join("payload.bin");
    let output_dir = temp.path().join("out");

    write_custom_payload(
        &payload_path,
        DeltaArchiveManifest {
            partitions: vec![PartitionUpdate {
                partition_name: "boot".to_string(),
                new_partition_info: Some(PartitionInfo {
                    size: Some(4096),
                    hash: Some(Vec::new()),
                }),
                operations: vec![InstallOperation {
                    r#type: Type::Replace as i32,
                    data_offset: Some(0),
                    data_length: Some(4096),
                    dst_extents: vec![chromeos_update_engine::Extent {
                        start_block: Some(0),
                        num_blocks: Some(1),
                    }],
                    data_sha256_hash: Some(vec![0u8; 32]),
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        },
        &[9; 4096],
    );

    let cache = PayloadCache::default();
    let error = extract_payload(
        &payload_path,
        Some(&output_dir),
        &[String::from("boot")],
        &cache,
        None,
        VerifyMode::default(),
        |_, _, _, _| {},
        None,
        None,
    )
    .expect_err("expected checksum verification failure");

    assert!(
        error.to_string().contains("checksum mismatch"),
        "expected checksum mismatch error, got: {error}"
    );
}

fn write_test_payload(path: &std::path::Path, partition_name: &str, size: u64, image_bytes: &[u8]) {
    write_custom_payload(
        path,
        DeltaArchiveManifest {
            partitions: vec![PartitionUpdate {
                partition_name: partition_name.to_string(),
                new_partition_info: Some(PartitionInfo {
                    size: Some(size),
                    hash: Some(Vec::new()),
                }),
                operations: vec![InstallOperation {
                    r#type: Type::Replace as i32,
                    data_offset: Some(0),
                    data_length: Some(image_bytes.len() as u64),
                    dst_extents: vec![chromeos_update_engine::Extent {
                        start_block: Some(0),
                        num_blocks: Some(1),
                    }],
                    data_sha256_hash: Some(Vec::new()),
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        },
        image_bytes,
    );
}

fn write_custom_payload(path: &std::path::Path, manifest: DeltaArchiveManifest, data_bytes: &[u8]) {
    let mut manifest_bytes = Vec::new();
    manifest.encode(&mut manifest_bytes).expect("encode manifest");

    let mut file = fs::File::create(path).expect("create payload");
    file.write_all(b"CrAU").expect("write magic");
    file.write_all(&2u64.to_be_bytes()).expect("write version");
    file.write_all(&(manifest_bytes.len() as u64).to_be_bytes()).expect("write manifest len");
    file.write_all(&0u32.to_be_bytes()).expect("write metadata sig len");
    file.write_all(&manifest_bytes).expect("write manifest");
    file.write_all(data_bytes).expect("write data");
}

fn write_zip_with_payload(zip_path: &std::path::Path, payload_path: &std::path::Path) {
    let zip_file = fs::File::create(zip_path).expect("create zip");
    let mut zip = ::zip::ZipWriter::new(zip_file);
    zip.start_file("payload.bin", SimpleFileOptions::default()).expect("start payload entry");
    zip.write_all(&fs::read(payload_path).expect("read payload")).expect("write payload entry");
    zip.finish().expect("finish zip");
}

// =============================================================================
// Tests for HTTP ZIP functionality
// =============================================================================

#[cfg(feature = "remote_zip")]
mod http_zip_tests {
    use super::*;
    use crate::payload::http_zip::{find_eocd, is_zip_url};

    #[test]
    fn test_is_zip_url_detects_zip_extensions() {
        assert!(is_zip_url("https://example.com/ota.zip"));
        assert!(is_zip_url("https://example.com/factory-image-123.zip"));
        assert!(is_zip_url("http://server.com/path/file.ZIP"));
    }

    #[test]
    fn test_is_zip_url_detects_zip_with_query_params() {
        assert!(is_zip_url("https://example.com/download?file=ota.zip"));
        assert!(is_zip_url("https://example.com/api/v1/ota.zip?token=abc"));
    }

    #[test]
    fn test_is_zip_url_detects_zip_with_fragment() {
        assert!(is_zip_url("https://example.com/download#ota.zip"));
    }

    #[test]
    fn test_is_zip_url_rejects_non_zip() {
        assert!(!is_zip_url("https://example.com/payload.bin"));
        assert!(!is_zip_url("https://example.com/image.img"));
        assert!(!is_zip_url("https://example.com/download"));
        assert!(!is_zip_url("https://example.com/file.zipx"));
    }

    #[test]
    fn test_find_eocd_finds_signature() {
        // EOCD signature: 0x06054b50 = [0x50, 0x4b, 0x05, 0x06] in little-endian
        let mut data = vec![0u8; 100];
        data[90] = 0x50;
        data[91] = 0x4b;
        data[92] = 0x05;
        data[93] = 0x06;

        let pos = find_eocd(&data);
        assert_eq!(pos, Some(90));
    }

    #[test]
    fn test_find_eocd_returns_none_when_not_found() {
        let data = vec![0u8; 100];
        let pos = find_eocd(&data);
        assert_eq!(pos, None);
    }

    #[test]
    fn test_find_eocd_finds_last_occurrence() {
        // Multiple EOCD signatures - should find the last one (closest to end)
        let mut data = vec![0u8; 200];
        data[50] = 0x50;
        data[51] = 0x4b;
        data[52] = 0x05;
        data[53] = 0x06;
        data[190] = 0x50;
        data[191] = 0x4b;
        data[192] = 0x05;
        data[193] = 0x06;

        let pos = find_eocd(&data);
        assert_eq!(pos, Some(190));
    }

    #[test]
    fn test_zip_roundtrip_with_payload() {
        // Create a test payload.bin
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let zip_path = temp.path().join("ota.zip");
        write_test_payload(&payload_path, "system", 4096, &[7; 4096]);
        write_zip_with_payload(&zip_path, &payload_path);

        // Verify the ZIP contains payload.bin
        let zip_file = fs::File::open(&zip_path).expect("open zip");
        let mut archive = ::zip::ZipArchive::new(zip_file).expect("read zip");
        assert_eq!(archive.len(), 1);
        let entry = archive.by_index(0).expect("get entry");
        assert_eq!(entry.name(), "payload.bin");
    }
}

// =============================================================================
// Tests for stream_copy under-read detection
// =============================================================================

mod stream_copy_tests {
    use super::super::copy::stream_copy;
    use sha2::{Digest, Sha256};
    use std::io::Cursor;

    #[test]
    fn stream_copy_transfers_all_bytes() {
        let data = vec![42u8; 8192];
        let mut src = Cursor::new(&data);
        let mut dst = Vec::new();
        let mut buf = [0u8; 1024];

        stream_copy(&mut src, &mut dst, &mut buf, 8192, None).expect("stream_copy should succeed");
        assert_eq!(dst.len(), 8192);
        assert!(dst.iter().all(|&b| b == 42));
    }

    #[test]
    fn stream_copy_detects_truncated_stream() {
        // Source has only 100 bytes but we request 1000
        let data = vec![7u8; 100];
        let mut src = Cursor::new(&data);
        let mut dst = Vec::new();
        let mut buf = [0u8; 64];

        let err = stream_copy(&mut src, &mut dst, &mut buf, 1000, None)
            .expect_err("should fail on truncated stream");
        assert_eq!(err.kind(), std::io::ErrorKind::UnexpectedEof);
        assert!(err.to_string().contains("expected 1000"));
    }

    #[test]
    fn stream_copy_accumulates_hash() {
        let data = vec![1u8; 4096];
        let mut src = Cursor::new(&data);
        let mut dst = Vec::new();
        let mut buf = [0u8; 512];
        let mut hasher = Sha256::new();

        stream_copy(&mut src, &mut dst, &mut buf, 4096, Some(&mut hasher))
            .expect("stream_copy with hash");

        let hash = hasher.finalize();
        let expected = Sha256::digest([1u8; 4096]);
        assert_eq!(hash.as_slice(), expected.as_slice());
    }

    #[test]
    fn stream_copy_zero_length_is_noop() {
        let data = vec![5u8; 100];
        let mut src = Cursor::new(&data);
        let mut dst = Vec::new();
        let mut buf = [0u8; 64];

        stream_copy(&mut src, &mut dst, &mut buf, 0, None).expect("zero-length should succeed");
        assert!(dst.is_empty());
    }
}

// =============================================================================
// Tests for TransactionGuard cleanup behavior
// =============================================================================

mod transaction_guard_tests {
    use super::super::transaction::TransactionGuard;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn commit_prevents_cleanup_on_drop() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let file_path = output_dir.join("test.img");
        fs::write(&file_path, b"test data").expect("write file");

        let guard = TransactionGuard::new(output_dir.clone());
        guard.add_file(file_path.clone());
        guard.commit();

        // After commit, drop should NOT clean up
        drop(guard);

        assert!(file_path.exists(), "file should survive after commit+drop");
        assert!(output_dir.exists(), "dir should survive after commit+drop");
    }

    #[test]
    fn abort_cleans_up_files() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let file_path = output_dir.join("test.img");
        fs::write(&file_path, b"test data").expect("write file");

        let guard = TransactionGuard::new(output_dir.clone());
        guard.add_file(file_path.clone());
        guard.abort();

        assert!(!file_path.exists(), "file should be deleted after abort");
        assert!(!output_dir.exists(), "dir should be deleted after abort");
    }

    #[test]
    fn drop_without_commit_cleans_up() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let file_path = output_dir.join("test.img");
        fs::write(&file_path, b"test data").expect("write file");

        {
            let guard = TransactionGuard::new(output_dir.clone());
            guard.add_file(file_path.clone());
            // No commit — guard drops here
        }

        assert!(!file_path.exists(), "file should be deleted on drop without commit");
        assert!(!output_dir.exists(), "dir should be deleted on drop without commit");
    }

    #[test]
    fn abort_with_no_files_is_safe() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let guard = TransactionGuard::new(output_dir.clone());
        guard.abort(); // Should not panic
    }
}

// =============================================================================
// Tests for NonTemporalWriter
// =============================================================================

mod non_temporal_writer_tests {
    use super::super::write::NonTemporalWriter;
    use std::fs;
    use std::io::{Seek, SeekFrom, Write};
    use tempfile::tempdir;

    #[test]
    fn writer_creates_and_writes_file() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("test.img");

        let mut writer = NonTemporalWriter::new(&path, 4096).expect("create writer");
        writer.write_all(&[0xAB; 4096]).expect("write");
        writer.flush().expect("flush");

        let data = fs::read(&path).expect("read");
        assert_eq!(data.len(), 4096);
        assert!(data.iter().all(|&b| b == 0xAB));
    }

    #[test]
    fn writer_seek_and_write_at_offset() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("test.img");

        let mut writer = NonTemporalWriter::new(&path, 4096).expect("create writer");
        writer.seek(SeekFrom::Start(2048)).expect("seek");
        writer.write_all(&[0xCD; 2048]).expect("write");
        writer.flush().expect("flush");

        let data = fs::read(&path).expect("read");
        assert_eq!(&data[0..2048], &[0; 2048]); // Pre-allocated zeros
        assert_eq!(&data[2048..4096], &[0xCD; 2048]); // Written data
    }

    #[test]
    fn writer_pre_allocates_size() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("test.img");

        let mut writer = NonTemporalWriter::new(&path, 8192).expect("create writer");
        writer.flush().expect("flush");

        let metadata = fs::metadata(&path).expect("metadata");
        assert_eq!(metadata.len(), 8192);
    }
}

// =============================================================================
// Tests for SHA-256 verification with correct hash
// =============================================================================

mod sha256_verification_tests {
    use super::*;
    use sha2::{Digest, Sha256};

    #[test]
    fn accepts_payload_with_correct_sha256() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let output_dir = temp.path().join("out");

        let image_bytes = vec![0xAB; 4096];
        let hash = Sha256::digest(&image_bytes);

        write_custom_payload(
            &payload_path,
            DeltaArchiveManifest {
                partitions: vec![PartitionUpdate {
                    partition_name: "system".to_string(),
                    new_partition_info: Some(PartitionInfo {
                        size: Some(4096),
                        hash: Some(Vec::new()),
                    }),
                    operations: vec![InstallOperation {
                        r#type: Type::Replace as i32,
                        data_offset: Some(0),
                        data_length: Some(4096),
                        dst_extents: vec![chromeos_update_engine::Extent {
                            start_block: Some(0),
                            num_blocks: Some(1),
                        }],
                        data_sha256_hash: Some(hash.to_vec()),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            },
            &image_bytes,
        );

        let cache = PayloadCache::default();
        let result = extract_payload(
            &payload_path,
            Some(&output_dir),
            &[String::from("system")],
            &cache,
            None,
            VerifyMode::default(),
            |_, _, _, _| {},
            None,
            None,
        )
        .expect("extraction should succeed with correct hash");

        assert!(result.success);
        assert_eq!(fs::read(output_dir.join("system.img")).expect("read"), image_bytes);
    }

    #[test]
    fn extracts_all_partitions_when_none_selected() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let output_dir = temp.path().join("out");

        write_custom_payload(
            &payload_path,
            DeltaArchiveManifest {
                partitions: vec![
                    PartitionUpdate {
                        partition_name: "system".to_string(),
                        new_partition_info: Some(PartitionInfo {
                            size: Some(4096),
                            hash: Some(Vec::new()),
                        }),
                        operations: vec![InstallOperation {
                            r#type: Type::Replace as i32,
                            data_offset: Some(0),
                            data_length: Some(4096),
                            dst_extents: vec![chromeos_update_engine::Extent {
                                start_block: Some(0),
                                num_blocks: Some(1),
                            }],
                            data_sha256_hash: Some(Vec::new()),
                            ..Default::default()
                        }],
                        ..Default::default()
                    },
                    PartitionUpdate {
                        partition_name: "vendor".to_string(),
                        new_partition_info: Some(PartitionInfo {
                            size: Some(4096),
                            hash: Some(Vec::new()),
                        }),
                        operations: vec![InstallOperation {
                            r#type: Type::Replace as i32,
                            data_offset: Some(4096),
                            data_length: Some(4096),
                            dst_extents: vec![chromeos_update_engine::Extent {
                                start_block: Some(0),
                                num_blocks: Some(1),
                            }],
                            data_sha256_hash: Some(Vec::new()),
                            ..Default::default()
                        }],
                        ..Default::default()
                    },
                ],
                ..Default::default()
            },
            &[1u8; 8192],
        );

        let cache = PayloadCache::default();
        let result = extract_payload(
            &payload_path,
            Some(&output_dir),
            &[], // empty = extract all
            &cache,
            None,
            VerifyMode::default(),
            |_, _, _, _| {},
            None,
            None,
        )
        .expect("extract all partitions");

        assert!(result.success);
        assert_eq!(result.extracted_files.len(), 2);
        assert!(output_dir.join("system.img").exists());
        assert!(output_dir.join("vendor.img").exists());
    }

    #[test]
    fn handles_empty_partition_operations() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let output_dir = temp.path().join("out");

        write_custom_payload(
            &payload_path,
            DeltaArchiveManifest {
                partitions: vec![PartitionUpdate {
                    partition_name: "empty".to_string(),
                    new_partition_info: Some(PartitionInfo {
                        size: Some(0),
                        hash: Some(Vec::new()),
                    }),
                    operations: vec![], // No operations
                    ..Default::default()
                }],
                ..Default::default()
            },
            &[], // No data bytes
        );

        let cache = PayloadCache::default();
        let result = extract_payload(
            &payload_path,
            Some(&output_dir),
            &[String::from("empty")],
            &cache,
            None,
            VerifyMode::default(),
            |_, _, _, _| {},
            None,
            None,
        )
        .expect("extract empty partition should succeed");

        assert!(result.success);
        assert!(output_dir.join("empty.img").exists());
    }
}

// =============================================================================
// Tests for diagnose_payload_file
// =============================================================================

mod diagnostics_tests {
    use super::super::extractor::diagnose_payload_file;
    use super::*;

    #[test]
    fn diagnose_reports_compression_types() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");

        write_custom_payload(
            &payload_path,
            DeltaArchiveManifest {
                partitions: vec![PartitionUpdate {
                    partition_name: "system".to_string(),
                    new_partition_info: Some(PartitionInfo {
                        size: Some(4096),
                        hash: Some(Vec::new()),
                    }),
                    operations: vec![InstallOperation {
                        r#type: Type::Replace as i32,
                        data_offset: Some(0),
                        data_length: Some(4096),
                        dst_extents: vec![chromeos_update_engine::Extent {
                            start_block: Some(0),
                            num_blocks: Some(1),
                        }],
                        data_sha256_hash: Some(Vec::new()),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            },
            &[0xFF; 4096],
        );

        let diag = diagnose_payload_file(&payload_path).expect("diagnose");
        assert_eq!(diag.format, "CrAU");
        assert_eq!(diag.partition_count, 1);
        assert_eq!(diag.total_operations, 1);
        assert!(diag.compression_types.contains(&"raw".to_string()));
    }

    #[test]
    fn diagnose_reports_zero_size_warning() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");

        write_custom_payload(
            &payload_path,
            DeltaArchiveManifest {
                partitions: vec![PartitionUpdate {
                    partition_name: "zero_size".to_string(),
                    new_partition_info: Some(PartitionInfo {
                        size: Some(0),
                        hash: Some(Vec::new()),
                    }),
                    operations: vec![InstallOperation {
                        r#type: Type::Replace as i32,
                        data_offset: Some(0),
                        data_length: Some(0),
                        dst_extents: vec![],
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            },
            &[],
        );

        let diag = diagnose_payload_file(&payload_path).expect("diagnose");
        assert!(!diag.warnings.is_empty());
        assert!(diag.warnings[0].contains("zero size"));
    }
}

// =============================================================================
// Tests for manifest size cap (security)
// =============================================================================

mod manifest_size_cap_tests {
    use super::super::parser::parse_header;

    #[test]
    fn test_manifest_size_cap_rejects_huge_manifest() {
        let mut header = vec![b'C', b'r', b'A', b'U'];
        header.extend_from_slice(&2u64.to_be_bytes());
        header.extend_from_slice(&(10_000_000_000u64).to_be_bytes()); // 10 GB
        header.extend_from_slice(&0u32.to_be_bytes());

        let result = parse_header(&header);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("exceeds maximum"), "error should mention exceeds maximum: {}", err);
    }
}
