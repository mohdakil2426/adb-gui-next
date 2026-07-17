//! Shared payload IPC / domain DTOs (serde shapes consumed by commands + frontend).

use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Default, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PartitionDetail {
    pub name: String,
    pub size: u64,
    /// Estimated network bytes for remote extract (sum of op data_length / compressed size).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub download_size: Option<u64>,
}

/// Wall-clock extraction summary (matches FE `backend.ExtractionStats`).
#[derive(Debug, Default, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionStats {
    pub duration_ms: u64,
    pub partitions_extracted: usize,
    /// Output MiB / second (UI labels this MB/s).
    pub throughput_mbps: f64,
    pub total_bytes: u64,
}

impl ExtractionStats {
    /// Build stats from wall time, partition count, and output size.
    pub fn computed(duration: Duration, partitions_extracted: usize, total_bytes: u64) -> Self {
        let duration_ms = u64::try_from(duration.as_millis()).unwrap_or(u64::MAX);
        let secs = duration.as_secs_f64();
        let throughput_mbps = if secs > 0.0 && total_bytes > 0 {
            (total_bytes as f64 / (1024.0 * 1024.0)) / secs
        } else {
            0.0
        };
        Self { duration_ms, partitions_extracted, throughput_mbps, total_bytes }
    }
}

#[derive(Debug, Default, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtractPayloadResult {
    pub success: bool,
    pub output_dir: String,
    pub extracted_files: Vec<String>,
    pub error: Option<String>,
    /// Present on successful extracts when timing/size are known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<ExtractionStats>,
}

/// Full metadata about a remote OTA payload — HTTP, ZIP, and OTA manifest layers.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePayloadMetadata {
    // HTTP layer
    pub content_length: u64,
    pub content_type: Option<String>,
    pub last_modified: Option<String>,
    pub server: Option<String>,
    pub etag: Option<String>,
    // ZIP layer
    pub is_zip: bool,
    pub zip_payload_offset: Option<u64>,
    pub zip_compressed_size: Option<u64>,
    pub zip_uncompressed_size: Option<u64>,
    pub zip_compression_method: Option<String>,
    // OTA Manifest layer (from protobuf)
    pub block_size: u32,
    pub payload_version: u32,
    pub minor_version: Option<u32>,
    pub security_patch_level: Option<String>,
    pub max_timestamp: Option<i64>,
    pub partial_update: Option<bool>,
    pub dynamic_groups: Vec<DynamicGroupInfo>,
    pub partition_count: usize,
    pub total_size: u64,
    pub remote_kind: Option<String>,
    // OTA Package metadata (from META-INF/com/android/metadata)
    pub ota_type: Option<String>,
    pub pre_device: Option<String>,
    pub post_build: Option<String>,
    pub post_build_incremental: Option<String>,
    pub post_sdk_level: Option<String>,
    pub post_security_patch_level: Option<String>,
    pub post_timestamp: Option<String>,
    pub ota_version: Option<String>,
    pub wipe: Option<bool>,
    // payload_properties.txt
    pub file_hash: Option<String>,
    pub file_size: Option<u64>,
    pub metadata_hash: Option<String>,
    pub metadata_size: Option<u64>,
}

/// Dynamic partition group info from the OTA manifest.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicGroupInfo {
    pub name: String,
    pub size: Option<u64>,
    pub partitions: Vec<String>,
}

/// Diagnostics result for a payload file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PayloadDiagnostics {
    pub format: String,
    pub partition_count: usize,
    pub total_operations: usize,
    pub compression_types: Vec<String>,
    pub has_sha256_hashes: bool,
    pub is_sparse: bool,
    pub warnings: Vec<String>,
    pub manifest_info: String,
}
