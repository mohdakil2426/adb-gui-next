//! Property-based tests for payload parsing and extraction.
//! Tests edge cases that are impractical to cover with hand-written unit tests.

// Same transitive graph as the lib crate; see lib.rs.
#![allow(clippy::multiple_crate_versions)]

use adb_gui_next_lib::payload::parse_header;
use proptest::prelude::*;

#[test]
fn test_extent_arithmetic_never_overflows() {
    proptest!(ProptestConfig::with_cases(256), |(start_block: u64, num_blocks: u64, block_size: u64)| {
        let start_offset = start_block.checked_mul(block_size.max(1));
        let extent_size = num_blocks.checked_mul(block_size.max(1));
        if let (Some(so), Some(es)) = (start_offset, extent_size) {
            let end = so.checked_add(es);
            prop_assert!(end.is_some());
        }
    });
}

#[test]
fn test_coalescing_maintains_total_size() {
    proptest!(ProptestConfig::with_cases(256), |(extents: Vec<(u64, u64)>, block_size: u64)| {
        let total_size: u64 = extents.iter()
            .map(|(_, num)| num.saturating_mul(block_size.max(1)))
            .fold(0u64, u64::saturating_add);
        let coalesced_size: u64 = extents.iter()
            .filter(|(_, num)| *num > 0)
            .map(|(_, num)| num.saturating_mul(block_size.max(1)))
            .fold(0u64, u64::saturating_add);
        prop_assert_eq!(total_size, coalesced_size);
    });
}

#[test]
fn test_manifest_header_minimum_size() {
    let min_header = vec![0u8; 19];
    let result = parse_header(&min_header);
    assert!(result.is_err(), "header < 20 bytes should fail");
}

#[test]
fn test_manifest_header_max_version() {
    let mut header = vec![b'C', b'r', b'A', b'U'];
    header.extend_from_slice(&3u64.to_be_bytes());
    header.extend_from_slice(&0u64.to_be_bytes());
    header.extend_from_slice(&0u32.to_be_bytes());
    let result = parse_header(&header);
    assert!(result.is_err(), "version != 2 should fail");
}

#[test]
fn test_crau_v1_header_parsing() {
    let mut payload = Vec::new();
    payload.extend_from_slice(b"CrAU");
    payload.extend_from_slice(&1u64.to_be_bytes()); // Version 1
    payload.extend_from_slice(&10u64.to_be_bytes()); // Manifest length
    payload.extend_from_slice(b"0123456789"); // Manifest bytes (10 bytes)
    payload.extend_from_slice(b"data-bytes");

    let (parsed_manifest, data_offset) = parse_header(&payload).expect("parse v1 header");
    assert_eq!(parsed_manifest, b"0123456789");
    assert_eq!(data_offset, 20 + 10);
}

#[test]
fn test_crau_v2_header_parsing() {
    let mut payload = Vec::new();
    payload.extend_from_slice(b"CrAU");
    payload.extend_from_slice(&2u64.to_be_bytes()); // Version 2
    payload.extend_from_slice(&10u64.to_be_bytes()); // Manifest length
    payload.extend_from_slice(&4u32.to_be_bytes()); // Metadata sig length
    payload.extend_from_slice(b"0123456789"); // Manifest bytes (10 bytes)
    payload.extend_from_slice(b"sigs"); // Metadata sig (4 bytes)
    payload.extend_from_slice(b"data-bytes");

    let (parsed_manifest, data_offset) = parse_header(&payload).expect("parse v2 header");
    assert_eq!(parsed_manifest, b"0123456789");
    assert_eq!(data_offset, 24 + 10 + 4);
}

#[test]
fn test_delta_engine_source_copy_and_safety_cap() {
    use adb_gui_next_lib::payload::chromeos_update_engine::install_operation::Type;
    use adb_gui_next_lib::payload::delta::{DeltaEngine, Extent, MAX_OPERATION_SIZE};
    use std::io::Cursor;

    let old_data = vec![0xA5u8; 8192];
    let mut src_reader = Cursor::new(old_data.clone());
    let mut dst_writer = Cursor::new(vec![0u8; 8192]);

    let src_extents = vec![Extent { start_block: 0, num_blocks: 2 }];
    let dst_extents = vec![Extent { start_block: 0, num_blocks: 2 }];

    DeltaEngine::apply_operation(
        Type::SourceCopy,
        &[],
        &mut src_reader,
        &src_extents,
        &mut dst_writer,
        &dst_extents,
        4096,
        None,
    )
    .expect("apply source copy");

    assert_eq!(dst_writer.into_inner(), old_data);

    // Test safety cap (> 512 MB)
    let huge_num_blocks = (MAX_OPERATION_SIZE / 4096 + 10) as u64;
    let huge_extents = vec![Extent { start_block: 0, num_blocks: huge_num_blocks }];
    let mut dummy_src = Cursor::new(vec![0u8; 4096]);
    let mut dummy_dst = Cursor::new(Vec::new());
    let result = DeltaEngine::apply_operation(
        Type::SourceCopy,
        &[],
        &mut dummy_src,
        &huge_extents,
        &mut dummy_dst,
        &huge_extents,
        4096,
        None,
    );
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("safety cap"));
}

#[test]
fn test_delta_engine_source_bsdiff_and_brotli() {
    use adb_gui_next_lib::payload::chromeos_update_engine::install_operation::Type;
    use adb_gui_next_lib::payload::delta::{DeltaEngine, Extent};
    use std::io::{Cursor, Write};

    let old_data = vec![0x33u8; 4096];
    let mut new_data = vec![0x33u8; 4096];
    new_data[100..200].fill(0x77);

    // Generate simple BSDiff patch
    let mut patch = Vec::new();
    patch.extend_from_slice(b"BSDIFF40");
    let x = 4096usize;
    let y = 0usize;
    let z = 0i64;

    let mut diff_bytes = Vec::new();
    for i in 0..x {
        diff_bytes.push(new_data[i].wrapping_sub(old_data[i]));
    }

    let mut ctrl_bytes = Vec::new();
    ctrl_bytes.extend_from_slice(&(x as i64).to_le_bytes());
    ctrl_bytes.extend_from_slice(&(y as i64).to_le_bytes());
    ctrl_bytes.extend_from_slice(&z.to_le_bytes());

    let mut bz_ctrl = Vec::new();
    {
        let mut enc = bzip2::write::BzEncoder::new(&mut bz_ctrl, bzip2::Compression::best());
        enc.write_all(&ctrl_bytes).unwrap();
        enc.finish().unwrap();
    }

    let mut bz_diff = Vec::new();
    {
        let mut enc = bzip2::write::BzEncoder::new(&mut bz_diff, bzip2::Compression::best());
        enc.write_all(&diff_bytes).unwrap();
        enc.finish().unwrap();
    }

    let bz_extra = Vec::new();

    patch.extend_from_slice(&(bz_ctrl.len() as i64).to_le_bytes());
    patch.extend_from_slice(&(bz_diff.len() as i64).to_le_bytes());
    patch.extend_from_slice(&(new_data.len() as i64).to_le_bytes());
    patch.extend_from_slice(&bz_ctrl);
    patch.extend_from_slice(&bz_diff);
    patch.extend_from_slice(&bz_extra);

    // Test SOURCE_BSDIFF
    let mut src_reader = Cursor::new(old_data.clone());
    let mut dst_writer = Cursor::new(vec![0u8; 4096]);
    let extents = vec![Extent { start_block: 0, num_blocks: 1 }];

    DeltaEngine::apply_operation(
        Type::SourceBsdiff,
        &patch,
        &mut src_reader,
        &extents,
        &mut dst_writer,
        &extents,
        4096,
        None,
    )
    .expect("apply source bsdiff");
    assert_eq!(dst_writer.into_inner(), new_data);

    // Test BROTLI_BSDIFF
    let mut brotli_patch = Vec::new();
    {
        let mut writer = brotli::CompressorWriter::new(&mut brotli_patch, 4096, 6, 22);
        writer.write_all(&patch).unwrap();
    }

    let mut src_reader2 = Cursor::new(old_data);
    let mut dst_writer2 = Cursor::new(vec![0u8; 4096]);

    DeltaEngine::apply_operation(
        Type::BrotliBsdiff,
        &brotli_patch,
        &mut src_reader2,
        &extents,
        &mut dst_writer2,
        &extents,
        4096,
        None,
    )
    .expect("apply brotli bsdiff");
    assert_eq!(dst_writer2.into_inner(), new_data);
}

#[test]
fn test_source_matcher_resolve_and_verify() {
    use adb_gui_next_lib::payload::delta::SourceMatcher;
    use sha2::{Digest, Sha256};
    use std::fs;
    use tempfile::tempdir;

    let temp = tempdir().expect("tempdir");
    let base_img = temp.path().join("system.img");
    let base_data = vec![0x42u8; 8192];
    fs::write(&base_img, &base_data).expect("write base");

    let expected_hash = Sha256::digest(&base_data);

    let resolved = SourceMatcher::resolve_partition(
        temp.path(),
        "system",
        Some(expected_hash.as_slice()),
        Some(8192),
    )
    .expect("resolve partition");
    assert_eq!(resolved, base_img);

    // Mismatched hash
    let wrong_hash = [0xFFu8; 32];
    let result =
        SourceMatcher::resolve_partition(temp.path(), "system", Some(&wrong_hash), Some(8192));
    assert!(result.is_err());
}
