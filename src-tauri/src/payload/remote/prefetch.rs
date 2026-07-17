//! Span-based remote prefetch helpers.
//!
//! Instead of always downloading the full remote `Content-Length` (often a multi-GB OTA ZIP),
//! compute the min–max byte span of selected partitions' install ops (plus header region).

use crate::payload::chromeos_update_engine::{DeltaArchiveManifest, PartitionUpdate};

/// Absolute (within payload.bin) byte span covering header/manifest and selected ops.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PayloadByteSpan {
    /// Inclusive start offset within payload.bin (always 0 when header is required).
    pub start: u64,
    /// Exclusive end offset within payload.bin.
    pub end: u64,
}

impl PayloadByteSpan {
    pub fn len(self) -> u64 {
        self.end.saturating_sub(self.start)
    }
}

/// Compute the payload.bin byte span needed to extract `selected` partitions.
///
/// - Always includes `[0, data_offset)` so CrAU header + manifest remain available.
/// - Extends through the max end of any op blob for selected partitions that have data.
/// - Empty `selected` means all partitions.
/// - Returns at least `data_offset` end even when no ops have data.
pub fn compute_payload_span(
    manifest: &DeltaArchiveManifest,
    data_offset: u64,
    selected: &[String],
) -> PayloadByteSpan {
    let selected_set: Option<std::collections::HashSet<&str>> = if selected.is_empty() {
        None
    } else {
        Some(selected.iter().map(String::as_str).collect())
    };

    let mut end = data_offset;

    for partition in &manifest.partitions {
        if let Some(ref names) = selected_set
            && !names.contains(partition.partition_name.as_str())
        {
            continue;
        }
        if let Some(part_end) = partition_ops_end(partition, data_offset) {
            end = end.max(part_end);
        }
    }

    PayloadByteSpan { start: 0, end }
}

/// Max exclusive end of all data-bearing ops for one partition (payload.bin coords).
pub fn partition_ops_end(partition: &PartitionUpdate, data_offset: u64) -> Option<u64> {
    let mut max_end = 0u64;
    let mut any = false;
    for op in &partition.operations {
        let Some(offset) = op.data_offset else {
            continue;
        };
        let Some(length) = op.data_length else {
            continue;
        };
        if length == 0 {
            continue;
        }
        any = true;
        let abs = data_offset.saturating_add(offset);
        max_end = max_end.max(abs.saturating_add(length));
    }
    if any { Some(max_end) } else { None }
}

/// Map a payload.bin-relative span to absolute offsets in the remote HTTP object.
///
/// - Direct payload URL: absolute == payload-relative.
/// - STORED ZIP entry: absolute = zip_entry_offset + relative.
/// - Deflated ZIP entry: must download the full compressed member (returns full entry range).
pub fn absolute_download_range(
    span: PayloadByteSpan,
    zip_entry_offset: Option<u64>,
    zip_compressed_size: Option<u64>,
    zip_compression_method: Option<u16>,
    remote_content_length: u64,
) -> (u64, u64) {
    // Deflated ZIP payload.bin: cannot range into inflate stream — whole member.
    if zip_compression_method.is_some_and(|m| m != 0) {
        let start = zip_entry_offset.unwrap_or(0);
        let len = zip_compressed_size.unwrap_or(remote_content_length.saturating_sub(start));
        return (start, len.min(remote_content_length.saturating_sub(start)));
    }

    let base = zip_entry_offset.unwrap_or(0);
    let start = base.saturating_add(span.start);
    let end = base.saturating_add(span.end);
    let end = end.min(if let Some(cs) = zip_compressed_size {
        base.saturating_add(cs)
    } else {
        remote_content_length
    });
    let end = end.min(remote_content_length);
    let start = start.min(end);
    (start, end.saturating_sub(start))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::payload::chromeos_update_engine::{InstallOperation, PartitionUpdate};

    fn partition(name: &str, ops: &[(u64, u64)]) -> PartitionUpdate {
        PartitionUpdate {
            partition_name: name.into(),
            operations: ops
                .iter()
                .map(|(off, len)| InstallOperation {
                    data_offset: Some(*off),
                    data_length: Some(*len),
                    ..Default::default()
                })
                .collect(),
            ..Default::default()
        }
    }

    #[test]
    fn span_includes_header_and_selected_ops() {
        let manifest = DeltaArchiveManifest {
            partitions: vec![
                partition("boot", &[(0, 100), (100, 50)]),
                partition("system", &[(10_000, 5000)]),
            ],
            ..Default::default()
        };
        let data_offset = 1000u64;
        // boot only: ops end at 1000+150 = 1150
        let span = compute_payload_span(&manifest, data_offset, &["boot".into()]);
        assert_eq!(span.start, 0);
        assert_eq!(span.end, 1150);

        // all partitions
        let all = compute_payload_span(&manifest, data_offset, &[]);
        assert_eq!(all.end, 16_000);
    }

    #[test]
    fn absolute_range_stored_zip() {
        let span = PayloadByteSpan { start: 0, end: 5000 };
        let (abs, len) = absolute_download_range(span, Some(100_000), Some(50_000), Some(0), 200_000);
        assert_eq!(abs, 100_000);
        assert_eq!(len, 5000);
    }

    #[test]
    fn absolute_range_deflated_takes_full_member() {
        let span = PayloadByteSpan { start: 0, end: 100 };
        let (abs, len) =
            absolute_download_range(span, Some(1000), Some(8000), Some(8), 100_000);
        assert_eq!(abs, 1000);
        assert_eq!(len, 8000);
    }

    #[test]
    fn absolute_range_direct() {
        let span = PayloadByteSpan { start: 0, end: 4096 };
        let (abs, len) = absolute_download_range(span, None, None, None, 10_000);
        assert_eq!(abs, 0);
        assert_eq!(len, 4096);
    }
}
