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
        None, // No AppHandle in tests — events are silently skipped
        |name, current, total, completed| {
            progress_events.push((name.to_string(), current, total, completed));
        },
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
        |_, _, _, _| {},
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
        |_, _, _, _| {},
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
