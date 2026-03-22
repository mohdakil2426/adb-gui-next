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

use super::parser::load_payload;
use super::zip::PayloadCache;
use crate::payload::chromeos_update_engine;
use anyhow::Result;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{BufWriter, Cursor, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Arc,
    thread,
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
pub fn extract_payload(
    payload_path: &Path,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    cache: &PayloadCache,
    app_handle: Option<tauri::AppHandle>,
    mut progress: impl FnMut(&str, usize, usize, bool),
) -> Result<ExtractPayloadResult> {
    let payload = load_payload(payload_path, cache)?;
    let block_size = payload.manifest.block_size.unwrap_or(DEFAULT_BLOCK_SIZE);
    let output_dir = output_dir
        .filter(|path| !path.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| default_output_dir(payload_path));
    fs::create_dir_all(&output_dir)?;

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

    // Parallel extraction using std::thread::scope.
    // Each thread receives:
    //   - Arc::clone(&payload.mmap)  — 8-byte pointer, not a 4 GB copy
    //   - app_handle.clone()         — cheap Arc clone, Send + Sync
    let results: Vec<_> = thread::scope(|s| {
        let handles: Vec<_> = partitions_to_extract
            .iter()
            .map(|partition| {
                let output_dir = &output_dir;
                // O(1) Arc pointer clone — shares the OS page cache backing.
                let mmap = Arc::clone(&payload.mmap);
                let manifest = &payload.manifest;
                let data_offset = payload.data_offset;
                let partition_name = partition.partition_name.clone();
                // AppHandle is Clone + Send — safe to move into any thread.
                // Option<AppHandle> clones as None in tests, Some(handle) in production.
                let app = app_handle.clone();

                s.spawn(move || -> Result<String> {
                    let file_name = format!("{}.img", partition_name);
                    let image_path = output_dir.join(&file_name);
                    let image_file = fs::File::create(&image_path)?;
                    // BufWriter reduces syscall overhead for many small extent writes.
                    let mut image_writer = BufWriter::with_capacity(1024 * 1024, image_file);

                    let payload_ref = super::parser::LoadedPayload {
                        mmap,
                        manifest: manifest.clone(),
                        data_offset,
                    };

                    // Pre-allocate the output file if partition size is known.
                    // This makes Zero-type (sparse) operations a pure seek, no write needed,
                    // and ensures correct file size even if the last operation is Zero.
                    if let Some(info) = partition.new_partition_info.as_ref().and_then(|i| i.size) {
                        image_writer.get_ref().set_len(info).unwrap_or(()); // Non-fatal: falls back to normal writes
                    }

                    extract_partition(
                        &payload_ref,
                        partition,
                        &mut image_writer,
                        block_size,
                        // Per-operation real-time event — only emits when AppHandle is present.
                        &mut |name, current, total, completed| {
                            if let Some(ref handle) = app {
                                let _ = handle.emit(
                                    "payload:progress",
                                    serde_json::json!({
                                        "partitionName": name,
                                        "current": current,
                                        "total": total,
                                        "completed": completed,
                                    }),
                                );
                            }
                        },
                    )?;

                    image_writer.flush()?;
                    Ok(file_name)
                })
            })
            .collect();

        handles
            .into_iter()
            .map(|h| {
                h.join().map_err(|e| {
                    let msg = format!("Extraction thread panicked: {:?}", e);
                    log::error!("{}", msg);
                    anyhow::anyhow!(msg)
                })
            })
            .collect::<Vec<_>>()
    });

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(inner_result) => match inner_result {
                Ok(file_name) => extracted_files.push(file_name),
                Err(error) => return Err(error),
            },
            Err(error) => return Err(error),
        }
    }

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

fn extract_partition(
    payload: &super::parser::LoadedPayload,
    partition: &chromeos_update_engine::PartitionUpdate,
    image_writer: &mut BufWriter<fs::File>,
    block_size: u32,
    progress: &mut impl FnMut(&str, usize, usize, bool),
) -> Result<()> {
    let total_operations = partition.operations.len();
    if total_operations == 0 {
        progress(&partition.partition_name, 0, 0, true);
        return Ok(());
    }

    let mut current_pos = 0u64; // Tracks write head to skip seeks when already in position.

    for (index, operation) in partition.operations.iter().enumerate() {
        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        // Validate and slice the raw compressed/raw data from the mmap.
        let data_offset = payload.data_offset + operation.data_offset.unwrap_or_default() as usize;
        let data_length = operation.data_length.unwrap_or_default() as usize;
        let data_end = data_offset.saturating_add(data_length);
        if data_end > payload.mmap.len() {
            anyhow::bail!("payload operation data exceeds file size");
        }
        let raw_data = &payload.mmap[data_offset..data_end];

        // SHA-256 checksum verification on the compressed/raw input bytes.
        if let Some(expected_hash) = operation.data_sha256_hash.as_ref()
            && !expected_hash.is_empty()
        {
            let actual_hash = Sha256::digest(raw_data);
            if actual_hash.as_slice() != expected_hash.as_slice() {
                anyhow::bail!("payload operation checksum mismatch");
            }
        }

        use chromeos_update_engine::install_operation::Type;
        let operation_type = Type::try_from(operation.r#type)
            .map_err(|_| anyhow::anyhow!("unsupported operation type {}", operation.r#type))?;

        // For compressed operations, build a single streaming decoder before the extent loop.
        // It is consumed sequentially across extents — correct because a payload operation's
        // extents form one contiguous decoded byte sequence.
        //
        // `None` = raw Replace (use `decoded_offset` into raw_data directly).
        // `Some(dec)` = streaming decoder for compressed types.
        // Zero ops are handled via `is_zero` flag (seek, no write).
        let mut buf = [0u8; DECOMP_BUF_SIZE];
        let mut decoded_offset = 0usize;
        let is_zero = operation_type == Type::Zero;

        let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
            Type::Replace | Type::Zero => None,
            Type::ReplaceXz => Some(Box::new(xz2::read::XzDecoder::new(Cursor::new(raw_data)))),
            Type::ReplaceBz => Some(Box::new(bzip2::read::BzDecoder::new(Cursor::new(raw_data)))),
            Type::Zstd => Some(Box::new(
                zstd::stream::read::Decoder::new(Cursor::new(raw_data))
                    .map_err(|e| anyhow::anyhow!("zstd decoder: {e}"))?,
            )),
            _ => anyhow::bail!("unsupported payload operation type: {:?}", operation_type),
        };

        for extent in destination_extents {
            let start_block = extent.start_block.unwrap_or_default();
            let num_blocks = extent.num_blocks.unwrap_or_default();
            let start_offset = start_block
                .checked_mul(block_size as u64)
                .ok_or_else(|| anyhow::anyhow!("destination seek overflow"))?;
            let extent_size = usize::try_from(num_blocks)
                .map_err(|_| anyhow::anyhow!("destination extent block count overflow"))?
                .checked_mul(block_size as usize)
                .ok_or_else(|| anyhow::anyhow!("destination extent size overflow"))?;

            // Skip seek if the write head is already at the right position.
            if current_pos != start_offset {
                image_writer.seek(SeekFrom::Start(start_offset))?;
                current_pos = start_offset;
            }

            if is_zero {
                // File was pre-allocated with set_len — seek past the zero region.
                image_writer.seek(SeekFrom::Current(extent_size as i64))?;
            } else if let Some(ref mut dec) = compressed_reader {
                // Streaming decompression: consume decoder sequentially across extents.
                stream_copy(dec, image_writer, &mut buf, extent_size)?;
            } else {
                // Raw Replace: slice the next extent_size bytes from raw_data.
                let slice_end = decoded_offset.saturating_add(extent_size).min(raw_data.len());
                image_writer.write_all(&raw_data[decoded_offset..slice_end])?;
                decoded_offset = slice_end;
            }

            current_pos += extent_size as u64;
        }

        let completed = index + 1 == total_operations;
        progress(&partition.partition_name, index + 1, total_operations, completed);
    }

    Ok(())
}

/// Read from `src` into `buf` in a loop, writing each chunk to `dst`, until `limit` bytes
/// have been written or EOF is reached.
fn stream_copy(
    src: &mut impl Read,
    dst: &mut impl Write,
    buf: &mut [u8],
    limit: usize,
) -> Result<()> {
    let mut remaining = limit;
    while remaining > 0 {
        let to_read = buf.len().min(remaining);
        let n = src.read(&mut buf[..to_read])?;
        if n == 0 {
            break;
        }
        dst.write_all(&buf[..n])?;
        remaining -= n;
    }
    Ok(())
}

fn default_output_dir(payload_path: &Path) -> PathBuf {
    let parent = payload_path.parent().unwrap_or_else(|| Path::new("."));
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    parent.join(format!("extracted_{timestamp}"))
}
