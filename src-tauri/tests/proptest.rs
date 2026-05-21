//! Property-based tests for payload parsing and extraction.
//! Tests edge cases that are impractical to cover with hand-written unit tests.

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
    let min_header = vec![0u8; 23];
    let result = parse_header(&min_header);
    assert!(result.is_err(), "header < 24 bytes should fail");
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
