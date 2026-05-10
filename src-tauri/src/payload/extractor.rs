//! Payload partition extraction with streaming decompression and SHA-256 verification.
//!
//! # Memory model
//! `LoadedPayload::mmap` is an `Arc<memmap2::Mmap>`. Every extraction thread receives
//! an `Arc::clone` — an 8-byte pointer, not a copy of the payload. The OS page cache
//! serves all reads. Peak RAM from payload data is effectively zero.
//!
//! # Decompression model
//! Each operation is decoded using a streaming loop with a fixed 256 KiB stack buffer.
//! The full decompressed block is never buffered; bytes are written to the output file
//! as they stream out of the decoder.

use super::cancel::CancellationToken;
use super::parser::load_payload;
use super::transaction::TransactionGuard;
use super::verify::VerifyMode;
use super::write::NonTemporalWriter;
use super::zip::PayloadCache;
use crate::payload::chromeos_update_engine;
use anyhow::Result;
use prost::Message;
use rayon::prelude::*;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};
use tauri::Emitter;

const DEFAULT_BLOCK_SIZE: u32 = 4096;
/// Size of the streaming decompression buffer. 256 KiB is a sweet-spot: large enough
/// for throughput, small enough to stay L2-cache-resident on most CPUs.
const DECOMP_BUF_SIZE: usize = 256 * 1024;

#[derive(Debug, Default, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PartitionDetail {
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Default, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtractPayloadResult {
    pub success: bool,
    pub output_dir: String,
    pub extracted_files: Vec<String>,
    pub error: Option<String>,
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

/// Extract selected partitions from a payload file.
///
/// # Arguments
/// * `payload_path` — Path to `payload.bin` or a `.zip` containing it.
/// * `output_dir` — Optional output directory; defaults to `extracted_{timestamp}` next to input.
/// * `selected_partitions` — Partition names to extract (empty = all).
/// * `cache` — Payload cache for ZIP path resolution.
/// * `app_handle` — Optional Tauri app handle for real-time `payload:progress` events.
///   Pass `None` in unit tests (no mock runtime required).
/// * `progress` — Callback `(partition_name, current_op, total_ops, completed)`.
///   Fired once per partition at completion; used by the test suite for assertions and
///   by the Tauri command for completion logging.
#[allow(clippy::too_many_arguments)]
pub fn extract_payload(
    payload_path: &Path,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    cache: &PayloadCache,
    app_handle: Option<tauri::AppHandle>,
    verify_mode: VerifyMode,
    mut progress: impl FnMut(&str, usize, usize, bool),
    cancel_token: Option<&CancellationToken>,
    source_dir: Option<&Path>,
) -> Result<ExtractPayloadResult> {
    let payload = load_payload(payload_path, cache)?;
    let block_size = payload.manifest.block_size.unwrap_or(DEFAULT_BLOCK_SIZE);
    let output_dir = output_dir
        .filter(|path| !path.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| default_output_dir(payload_path));
    fs::create_dir_all(&output_dir)?;
    let guard = Arc::new(TransactionGuard::new(output_dir.clone()));

    let selected_names = if selected_partitions.is_empty() {
        None
    } else {
        Some(
            selected_partitions
                .iter()
                .map(String::as_str)
                .collect::<std::collections::HashSet<_>>(),
        )
    };

    let partitions_to_extract: Vec<_> = payload
        .manifest
        .partitions
        .iter()
        .filter(|partition| {
            selected_names
                .as_ref()
                .is_none_or(|names| names.contains(partition.partition_name.as_str()))
        })
        .collect();

    // Parallel extraction using rayon.
    // Each thread receives:
    //   - Arc::clone(&payload.mmap)  — 8-byte pointer, not a 4 GB copy
    //   - app_handle.clone()         — cheap Arc clone, Send + Sync
    let output_dir = Arc::new(output_dir);
    let results: Vec<Result<String>> = partitions_to_extract
        .par_iter()
        .map(|partition| {
            let output_dir = Arc::clone(&output_dir);
            let guard = Arc::clone(&guard);
            let mmap = Arc::clone(&payload.mmap);
            let manifest = payload.manifest.clone();
            let data_offset = payload.data_offset;
            let partition_name = partition.partition_name.clone();
            let app = app_handle.clone();

            let file_name = format!("{}.img", partition_name);
            let image_path = output_dir.join(&file_name);
            guard.add_file(image_path.clone());

            // Get partition size for NonTemporalWriter pre-allocation.
            let partition_size =
                partition.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or(0);

            // NonTemporalWriter: mmap-based, non-temporal stores, msync flush.
            let mut writer = NonTemporalWriter::new(&image_path, partition_size)
                .map_err(|e| anyhow::anyhow!("NonTemporalWriter: {e}"))?;

            let payload_ref = super::parser::LoadedPayload { mmap, manifest, data_offset };

            extract_partition(
                &payload_ref,
                partition,
                &mut writer,
                block_size,
                verify_mode,
                app.as_ref(),
                cancel_token,
                source_dir,
            )?;

            writer.flush()?;
            Ok(file_name)
        })
        .collect();

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(file_name) => extracted_files.push(file_name),
            Err(error) => {
                guard.abort();
                return Err(error);
            }
        }
    }

    guard.commit();

    // Fire the outer progress callback once per completed partition.
    // Used by the test suite to assert on completion events without a real Tauri runtime.
    for partition in &partitions_to_extract {
        progress(&partition.partition_name, 1, 1, true);
    }

    Ok(ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
    })
}

#[allow(clippy::too_many_arguments)]
fn emit_progress(
    app_handle: Option<&tauri::AppHandle>,
    partition_name: &str,
    current: usize,
    total: usize,
    bytes_written: Option<u64>,
    total_bytes: Option<u64>,
    throughput_mbps: Option<f64>,
    eta_seconds: Option<u64>,
    completed: bool,
) {
    if let Some(handle) = app_handle {
        let _ = handle.emit(
            "payload:progress",
            serde_json::json!({
                "partitionName": partition_name,
                "current": current,
                "total": total,
                "bytesWritten": bytes_written,
                "totalBytes": total_bytes,
                "throughputMbps": throughput_mbps,
                "etaSeconds": eta_seconds,
                "completed": completed,
            }),
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn extract_partition(
    payload: &super::parser::LoadedPayload,
    partition: &chromeos_update_engine::PartitionUpdate,
    writer: &mut (impl Write + Seek),
    block_size: u32,
    verify_mode: VerifyMode,
    app_handle: Option<&tauri::AppHandle>,
    cancel_token: Option<&CancellationToken>,
    _source_dir: Option<&Path>,
) -> Result<()> {
    let total_operations = partition.operations.len();
    if total_operations == 0 {
        emit_progress(
            app_handle,
            &partition.partition_name,
            0,
            0,
            Some(0),
            Some(0),
            Some(0.0),
            Some(0),
            true,
        );
        return Ok(());
    }

    if let Some(token) = cancel_token {
        token.check()?;
    }

    let mut current_pos = 0u64;
    let mut total_bytes_written = 0u64;
    let partition_size = partition.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or(0);
    let mut last_progress_time = Instant::now();
    let mut last_bytes = 0u64;
    let progress_interval = Duration::from_millis(250);

    for (index, operation) in partition.operations.iter().enumerate() {
        if let Some(token) = cancel_token {
            token.check()?;
        }
        let mut hasher: Option<Sha256> =
            operation.data_sha256_hash.as_ref().filter(|h| !h.is_empty()).map(|_| Sha256::new());

        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        let data_offset = payload.data_offset + operation.data_offset.unwrap_or_default() as usize;
        let data_length = operation.data_length.unwrap_or_default() as usize;
        let data_end = data_offset.saturating_add(data_length);
        if data_end > payload.mmap.len() {
            anyhow::bail!("payload operation data exceeds file size");
        }
        let raw_data = &payload.mmap[data_offset..data_end];

        use chromeos_update_engine::install_operation::Type;
        let operation_type = Type::try_from(operation.r#type)
            .map_err(|_| anyhow::anyhow!("unsupported operation type {}", operation.r#type))?;

        let mut buf = [0u8; DECOMP_BUF_SIZE];
        let mut decoded_offset = 0usize;
        let is_zero = operation_type == Type::Zero;

        let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
            Type::Replace | Type::Zero => None,
            Type::ReplaceXz => {
                log::debug!(
                    "partition {} op {}: XZ data at offset {} len {} first_bytes={:?}",
                    partition.partition_name,
                    index,
                    data_offset,
                    data_length,
                    raw_data.first().copied(),
                );
                Some(Box::new(xz2::read::XzDecoder::new_multi_decoder(Cursor::new(raw_data))))
            }
            Type::ReplaceBz => Some(Box::new(bzip2::read::BzDecoder::new(Cursor::new(raw_data)))),
            Type::Zstd => Some(Box::new(
                zstd::stream::read::Decoder::new(Cursor::new(raw_data))
                    .map_err(|e| anyhow::anyhow!("zstd decoder: {e}"))?,
            )),
            #[cfg(feature = "brotli")]
            Type::BrotliBsdiff => {
                Some(Box::new(brotli::Decompressor::new(Cursor::new(raw_data), 4096)))
            }
            _ => anyhow::bail!("unsupported payload operation type: {:?}", operation_type),
        };

        let compressed_hash = hasher.as_mut().map(|h| {
            h.update(raw_data);
            h.clone().finalize()
        });

        let extents = destination_extents;
        let mut ei = 0usize;

        while ei < extents.len() {
            let extent = &extents[ei];
            let start_block = extent.start_block.unwrap_or_default();
            let num_blocks = extent.num_blocks.unwrap_or_default();
            let start_offset = start_block
                .checked_mul(block_size as u64)
                .ok_or_else(|| anyhow::anyhow!("destination seek overflow"))?;
            let extent_size = usize::try_from(num_blocks)
                .map_err(|_| anyhow::anyhow!("destination extent block count overflow"))?
                .checked_mul(block_size as usize)
                .ok_or_else(|| anyhow::anyhow!("destination extent size overflow"))?;

            if is_zero {
                if current_pos != start_offset {
                    writer.seek(SeekFrom::Start(start_offset))?;
                    current_pos = start_offset;
                }
                writer.seek(SeekFrom::Current(extent_size as i64))?;
                current_pos += extent_size as u64;
                total_bytes_written += extent_size as u64;
                ei += 1;
                continue;
            }

            if let Some(ref mut dec) = compressed_reader {
                if current_pos != start_offset {
                    writer.seek(SeekFrom::Start(start_offset))?;
                    current_pos = start_offset;
                }
                super::copy::stream_copy(dec, writer, &mut buf, extent_size, None)?;
                current_pos += extent_size as u64;
                total_bytes_written += extent_size as u64;
                ei += 1;
                continue;
            }

            let coal_start = decoded_offset;
            let mut coal_size = extent_size;
            let mut coal_pos = current_pos + extent_size as u64;
            let mut ej = ei + 1;

            while ej < extents.len() {
                let next_extent = &extents[ej];
                let next_start_block = next_extent.start_block.unwrap_or_default();
                let next_num_blocks = next_extent.num_blocks.unwrap_or_default();
                let next_start_offset = next_start_block
                    .checked_mul(block_size as u64)
                    .ok_or_else(|| anyhow::anyhow!("destination seek overflow"))?;
                let next_extent_size = usize::try_from(next_num_blocks)
                    .map_err(|_| anyhow::anyhow!("destination extent block count overflow"))?
                    .checked_mul(block_size as usize)
                    .ok_or_else(|| anyhow::anyhow!("destination extent size overflow"))?;

                if next_start_offset == coal_pos
                    && decoded_offset
                        .checked_add(coal_size)
                        .and_then(|end| end.checked_add(next_extent_size))
                        .is_some()
                    && decoded_offset + coal_size + next_extent_size <= raw_data.len()
                {
                    coal_size += next_extent_size;
                    coal_pos += next_extent_size as u64;
                    ej += 1;
                } else {
                    break;
                }
            }

            if current_pos != start_offset {
                writer.seek(SeekFrom::Start(start_offset))?;
                current_pos = start_offset;
            }

            let slice_end = coal_start.saturating_add(coal_size).min(raw_data.len());
            let slice = &raw_data[coal_start..slice_end];
            writer.write_all(slice)?;
            decoded_offset = slice_end;
            current_pos += coal_size as u64;
            total_bytes_written += coal_size as u64;

            ei = ej;
        }

        if verify_mode.layer3_enabled
            && let (Some(actual), Some(expected)) =
                (compressed_hash, operation.data_sha256_hash.as_ref())
            && actual.as_slice() != expected.as_slice()
        {
            log::error!(
                target: "payload",
                "partition {} operation {}: SHA-256 mismatch (compressed blob hash)",
                partition.partition_name,
                index
            );
            anyhow::bail!("payload operation {} compressed data hash mismatch", index);
        }

        let completed = index + 1 == total_operations;
        let now = Instant::now();
        let elapsed = now.duration_since(last_progress_time);
        let (throughput_mbps, eta_seconds) = if elapsed >= progress_interval {
            let bytes_delta = total_bytes_written.saturating_sub(last_bytes);
            let tp = if elapsed.as_secs_f64() > 0.0 {
                (bytes_delta as f64) / (1024.0 * 1024.0) / elapsed.as_secs_f64()
            } else {
                0.0
            };
            let remaining = partition_size.saturating_sub(total_bytes_written);
            let eta =
                if tp > 0.0 { ((remaining as f64) / (1024.0 * 1024.0) / tp) as u64 } else { 0 };
            last_progress_time = now;
            last_bytes = total_bytes_written;
            (Some(tp), Some(eta))
        } else {
            (None, None)
        };

        emit_progress(
            app_handle,
            &partition.partition_name,
            index + 1,
            total_operations,
            Some(total_bytes_written),
            Some(partition_size),
            throughput_mbps,
            eta_seconds,
            completed,
        );
    }

    Ok(())
}

fn default_output_dir(payload_path: &Path) -> PathBuf {
    let parent = payload_path.parent().unwrap_or_else(|| Path::new("."));
    let stamp = crate::payload::format_datetime();
    parent.join(format!("extracted_{stamp}"))
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

/// Diagnose a CrAU payload file without full extraction.
pub fn diagnose_payload_file(payload_path: &Path) -> Result<PayloadDiagnostics> {
    use chromeos_update_engine::install_operation::Type;

    let mmap = super::parser::open_mmap(payload_path)?;
    let (manifest_bytes, _) = super::parser::parse_header(&mmap)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    let mut compression_types: Vec<String> = Vec::new();
    let mut total_operations = 0usize;
    let mut has_sha256_hashes = false;
    let is_sparse = false;
    let mut warnings: Vec<String> = Vec::new();

    for partition in &manifest.partitions {
        for operation in &partition.operations {
            total_operations += 1;
            if operation.data_sha256_hash.as_ref().is_some_and(|h| !h.is_empty()) {
                has_sha256_hashes = true;
            }
            let op_type = Type::try_from(operation.r#type).ok();
            let type_str = match op_type {
                Some(Type::Replace) => "raw".to_string(),
                Some(Type::ReplaceXz) => "xz".to_string(),
                Some(Type::ReplaceBz) => "bz2".to_string(),
                Some(Type::Zstd) => "zstd".to_string(),
                Some(Type::Zero) => "zero".to_string(),
                Some(t) => format!("type_{}", t as i32),
                None => format!("unknown_{}", operation.r#type),
            };
            if !compression_types.contains(&type_str) {
                compression_types.push(type_str);
            }
        }
        if let Some(ref info) = partition.new_partition_info
            && let Some(size) = info.size
            && size == 0
        {
            warnings.push(format!(
                "Partition '{}' has zero size — may be invalid",
                partition.partition_name
            ));
        }
    }

    let partition_count = manifest.partitions.len();
    let manifest_info = serde_json::json!({
        "blockSize": manifest.block_size,
        "minorVersion": manifest.minor_version,
        "securityPatchLevel": manifest.security_patch_level,
        "maxTimestamp": manifest.max_timestamp,
        "partialUpdate": manifest.partial_update,
    })
    .to_string();

    Ok(PayloadDiagnostics {
        format: "CrAU".to_string(),
        partition_count,
        total_operations,
        compression_types,
        has_sha256_hashes,
        is_sparse,
        warnings,
        manifest_info,
    })
}
