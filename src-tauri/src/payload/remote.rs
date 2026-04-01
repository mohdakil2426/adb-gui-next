//! Remote payload loading and extraction for HTTP URLs.
//!
//! Supports two modes:
//! - **Prefetch** (`true`): Downloads entire payload to a temp file first, then extracts.
//!   Best for slow/high-latency connections — extraction is fast after download.
//! - **Direct** (`false`): Reads HTTP ranges on-demand during extraction.
//!   Best for fast connections — starts extraction immediately without waiting for full download.

use super::chromeos_update_engine::DeltaArchiveManifest;
use super::http::HttpPayloadReader;
use super::parser::parse_header;
use anyhow::{Result, anyhow};
use memmap2::Mmap;
use prost::Message;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufWriter, Cursor, Read, Seek, SeekFrom, Write};
use std::sync::Arc;
use std::thread;
use tempfile::NamedTempFile;

#[cfg(feature = "remote_zip")]
use tauri::Emitter;

const DECOMP_BUF_SIZE: usize = 256 * 1024;

/// Progress callback for downloads.
pub type DownloadProgress = Box<dyn Fn(u64, u64) + Send + Sync>;

/// Holds manifest and HTTP reader for remote extraction (no temp file download).
/// The HTTP reader is shared across extraction threads via Arc<HttpPayloadReader>.
#[derive(Clone)]
pub struct RemotePayload {
    /// Parsed OTA manifest containing partition operations and metadata.
    pub manifest: DeltaArchiveManifest,
    /// Shared HTTP reader for range requests across extraction threads.
    pub http: Arc<HttpPayloadReader>,
    /// Byte offset where actual payload data begins in the OTA file.
    pub data_offset: usize,
}

// =============================================================================
// Public API
// =============================================================================

/// Load remote payload manifest and partition info (for partition listing).
///
/// Downloads just enough to parse the manifest header (~1 MB or less).
#[cfg(feature = "remote_zip")]
pub async fn list_remote_payload_partitions(
    url: String,
) -> Result<Vec<super::extractor::PartitionDetail>> {
    let reader = HttpPayloadReader::new(url).await?;

    // Read just the header range — first 1MB is enough for manifest
    let header_data = reader.read_range(0, 1024 * 1024).await?;

    // Parse header to get manifest bytes
    let (manifest_bytes, _data_offset) = parse_header(&header_data)?;

    // Decode manifest
    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    Ok(manifest
        .partitions
        .iter()
        .map(|p| super::extractor::PartitionDetail {
            name: p.partition_name.clone(),
            size: p.new_partition_info.as_ref().and_then(|info| info.size).unwrap_or_default(),
        })
        .collect())
}

/// Prefetch mode: Download entire payload to temp file, then extract via mmap.
///
/// Best for slow/high-latency connections — extraction is fast after download.
#[cfg(feature = "remote_zip")]
pub async fn extract_remote_prefetch(
    url: String,
    output_dir: Option<&std::path::Path>,
    selected_partitions: &[String],
    app_handle: Option<tauri::AppHandle>,
) -> Result<super::extractor::ExtractPayloadResult> {
    let reader = HttpPayloadReader::new(url.clone()).await?;
    let content_length = reader.content_length();

    log::info!("Prefetch: downloading {} bytes from {}", content_length, url);

    // Stream to temp file in 1 MB chunks. NamedTempFile::keep() persists it
    // on disk after we're done so the mmap can use it without the file
    // being deleted when the NamedTempFile drops.
    let mut temp = NamedTempFile::new()?;
    let chunk_size = 1024 * 1024; // 1 MB
    let mut downloaded = 0u64;

    while downloaded < content_length {
        let chunk_end = (downloaded + chunk_size).min(content_length);
        let chunk_len = chunk_end - downloaded;
        let data = reader.read_range(downloaded, chunk_len).await?;
        temp.as_file_mut().write_all(&data)?;
        downloaded = chunk_end;

        // Emit download progress
        if let Some(ref handle) = app_handle {
            let _ = handle.emit(
                "payload:progress",
                serde_json::json!({
                    "partitionName": "__download__",
                    "current": downloaded,
                    "total": content_length,
                    "completed": false,
                }),
            );
        }
    }
    temp.flush()?;
    // Persist the temp file on disk — NamedTempFile::drop() would delete it.
    // keep() returns (File, PathBuf). We immediately drop the File and
    // re-open for mmap (cleaner ownership).
    let (_, temp_path) = temp.keep().map_err(|_| anyhow!("Failed to persist temp file"))?;

    // Guard: clean up temp file on any early error.
    struct TempGuard(std::path::PathBuf);
    impl Drop for TempGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    let _guard = TempGuard(temp_path.clone());

    // Now use the existing mmap-based extraction on the downloaded file.
    let file = File::open(&temp_path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    let mmap = Arc::new(mmap);

    let (manifest_bytes, data_offset) = parse_header(&mmap)?;
    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    let output_dir = output_dir
        .filter(|p| !p.as_os_str().is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    std::fs::create_dir_all(&output_dir)?;

    let selected_names: Option<std::collections::HashSet<_>> = if selected_partitions.is_empty() {
        None
    } else {
        Some(selected_partitions.iter().map(String::as_str).collect())
    };

    let partitions_to_extract: Vec<_> = manifest
        .partitions
        .iter()
        .filter(|p| {
            selected_names.as_ref().is_none_or(|names| names.contains(p.partition_name.as_str()))
        })
        .collect();

    let block_size = manifest.block_size.unwrap_or(4096);

    let results: Vec<_> = thread::scope(|s| {
        let handles: Vec<_> = partitions_to_extract
            .iter()
            .map(|partition| {
                let output_dir = &output_dir;
                let mmap = Arc::clone(&mmap);
                let partition_name = partition.partition_name.clone();
                let app = app_handle.clone();

                s.spawn(move || -> Result<String> {
                    let file_name = format!("{}.img", partition_name);
                    let image_path = output_dir.join(&file_name);
                    let image_file = std::fs::File::create(&image_path)?;
                    let mut image_writer = BufWriter::with_capacity(1024 * 1024, image_file);

                    if let Some(info) = partition.new_partition_info.as_ref().and_then(|i| i.size) {
                        image_writer.get_ref().set_len(info).unwrap_or(());
                    }

                    extract_partition_from_mmap(
                        &mmap,
                        data_offset,
                        block_size,
                        partition,
                        &mut image_writer,
                        |name, current, total, completed| {
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
            .map(|h| h.join().map_err(|e| anyhow!("Thread panicked: {:?}", e)))
            .collect::<Vec<_>>()
    });

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(Ok(f)) => extracted_files.push(f),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(e),
        }
    }

    // Temp file guard goes out of scope here — cleanup via Drop.
    Ok(super::extractor::ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
    })
}

/// Direct mode: Fetch manifest, then read HTTP ranges on-demand during extraction.
///
/// Best for fast connections — extraction starts immediately without waiting for full download.
#[cfg(feature = "remote_zip")]
pub async fn extract_remote_direct(
    url: String,
    output_dir: Option<&std::path::Path>,
    selected_partitions: &[String],
    app_handle: Option<tauri::AppHandle>,
) -> Result<super::extractor::ExtractPayloadResult> {
    // Step 1: Get reader and manifest via HTTP
    let reader = HttpPayloadReader::new(url.clone()).await?;
    let content_length = reader.content_length();

    log::info!("Direct mode: fetching manifest from {}", url);

    // Step 2: Read header to get manifest
    let header_data = reader.read_range(0, 1024 * 1024).await?;
    let (manifest_bytes, data_offset) = parse_header(&header_data)?;
    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    log::info!(
        "Direct mode: {} partitions, {} total bytes",
        manifest.partitions.len(),
        content_length
    );

    let output_dir = output_dir
        .filter(|p| !p.as_os_str().is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    std::fs::create_dir_all(&output_dir)?;

    let selected_names: Option<std::collections::HashSet<_>> = if selected_partitions.is_empty() {
        None
    } else {
        Some(selected_partitions.iter().map(String::as_str).collect())
    };

    let partitions_to_extract: Vec<_> = manifest
        .partitions
        .iter()
        .filter(|p| {
            selected_names.as_ref().is_none_or(|names| names.contains(p.partition_name.as_str()))
        })
        .collect();

    let http = Arc::new(reader);
    let block_size = manifest.block_size.unwrap_or(4096);

    let results: Vec<_> = thread::scope(|s| {
        let handles: Vec<_> = partitions_to_extract
            .iter()
            .map(|partition| {
                let output_dir = &output_dir;
                let http = http.clone();
                let partition_name = partition.partition_name.clone();
                let app = app_handle.clone();

                s.spawn(move || -> Result<String> {
                    let file_name = format!("{}.img", partition_name);
                    let image_path = output_dir.join(&file_name);
                    let image_file = std::fs::File::create(&image_path)?;
                    let mut image_writer = BufWriter::with_capacity(1024 * 1024, image_file);

                    if let Some(info) = partition.new_partition_info.as_ref().and_then(|i| i.size) {
                        image_writer.get_ref().set_len(info).unwrap_or(());
                    }

                    extract_partition_from_remote(
                        &http,
                        data_offset,
                        block_size,
                        partition,
                        &mut image_writer,
                        |name, current, total, completed| {
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
            .map(|h| h.join().map_err(|e| anyhow!("Thread panicked: {:?}", e)))
            .collect::<Vec<_>>()
    });

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(Ok(f)) => extracted_files.push(f),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(e),
        }
    }

    Ok(super::extractor::ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
    })
}

// =============================================================================
// Internal extraction functions
// =============================================================================

/// Extract from mmap (prefetch mode — full file already downloaded).
fn extract_partition_from_mmap(
    mmap: &Mmap,
    data_offset: usize,
    block_size: u32,
    partition: &super::chromeos_update_engine::PartitionUpdate,
    image_writer: &mut BufWriter<std::fs::File>,
    mut progress: impl FnMut(&str, usize, usize, bool),
) -> Result<()> {
    use super::chromeos_update_engine::install_operation::Type;

    let total_operations = partition.operations.len();
    if total_operations == 0 {
        progress(&partition.partition_name, 0, 0, true);
        return Ok(());
    }

    let mut current_pos = 0u64;

    for (index, operation) in partition.operations.iter().enumerate() {
        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        let data_offset_op = operation.data_offset.unwrap_or_default() as usize;
        let data_length = operation.data_length.unwrap_or_default() as usize;
        let data_end = data_offset.saturating_add(data_offset_op) + data_length;
        if data_end > mmap.len() {
            anyhow::bail!("payload operation data exceeds file size");
        }
        let raw_data = &mmap[data_offset + data_offset_op..data_end];

        // SHA-256 verification
        if let Some(expected_hash) = operation.data_sha256_hash.as_ref()
            && !expected_hash.is_empty()
        {
            let actual_hash = Sha256::digest(raw_data);
            if actual_hash.as_slice() != expected_hash.as_slice() {
                anyhow::bail!("payload operation checksum mismatch");
            }
        }

        let operation_type = Type::try_from(operation.r#type)
            .map_err(|_| anyhow!("unsupported operation type {}", operation.r#type))?;

        let mut buf = [0u8; DECOMP_BUF_SIZE];
        let mut decoded_offset = 0usize;
        let is_zero = operation_type == Type::Zero;

        let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
            Type::Replace | Type::Zero => None,
            Type::ReplaceXz => Some(Box::new(xz2::read::XzDecoder::new(Cursor::new(raw_data)))),
            Type::ReplaceBz => Some(Box::new(bzip2::read::BzDecoder::new(Cursor::new(raw_data)))),
            Type::Zstd => Some(Box::new(
                zstd::stream::read::Decoder::new(Cursor::new(raw_data))
                    .map_err(|e| anyhow!("zstd decoder: {e}"))?,
            )),
            _ => anyhow::bail!("unsupported payload operation type: {:?}", operation_type),
        };

        for extent in destination_extents {
            let start_block = extent.start_block.unwrap_or_default();
            let num_blocks = extent.num_blocks.unwrap_or_default();
            let start_offset = start_block
                .checked_mul(block_size as u64)
                .ok_or_else(|| anyhow!("destination seek overflow"))?;
            let extent_size = usize::try_from(num_blocks)
                .map_err(|_| anyhow!("destination extent block count overflow"))?
                .checked_mul(block_size as usize)
                .ok_or_else(|| anyhow!("destination extent size overflow"))?;

            if current_pos != start_offset {
                image_writer.seek(SeekFrom::Start(start_offset))?;
                current_pos = start_offset;
            }

            if is_zero {
                image_writer.seek(SeekFrom::Current(extent_size as i64))?;
            } else if let Some(ref mut dec) = compressed_reader {
                stream_copy(dec, image_writer, &mut buf, extent_size)?;
            } else {
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

/// Extract from HTTP ranges on-demand (direct mode).
fn extract_partition_from_remote(
    http: &HttpPayloadReader,
    data_offset: usize,
    block_size: u32,
    partition: &super::chromeos_update_engine::PartitionUpdate,
    image_writer: &mut BufWriter<std::fs::File>,
    mut progress: impl FnMut(&str, usize, usize, bool),
) -> Result<()> {
    use super::chromeos_update_engine::install_operation::Type;

    let total_operations = partition.operations.len();
    if total_operations == 0 {
        progress(&partition.partition_name, 0, 0, true);
        return Ok(());
    }

    let mut current_pos = 0u64;

    for (index, operation) in partition.operations.iter().enumerate() {
        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        let data_offset_op = operation.data_offset.unwrap_or_default();
        let data_length = operation.data_length.unwrap_or_default();
        let raw_data =
            http.read_range_sync((data_offset as u64).saturating_add(data_offset_op), data_length)?;

        // SHA-256 verification
        if let Some(expected_hash) = operation.data_sha256_hash.as_ref()
            && !expected_hash.is_empty()
        {
            let actual_hash = Sha256::digest(&raw_data);
            if actual_hash.as_slice() != expected_hash.as_slice() {
                anyhow::bail!("payload operation checksum mismatch");
            }
        }

        let operation_type = Type::try_from(operation.r#type)
            .map_err(|_| anyhow!("unsupported operation type {}", operation.r#type))?;

        let mut buf = [0u8; DECOMP_BUF_SIZE];
        let mut decoded_offset = 0usize;
        let is_zero = operation_type == Type::Zero;

        let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
            Type::Replace | Type::Zero => None,
            Type::ReplaceXz => Some(Box::new(xz2::read::XzDecoder::new(Cursor::new(&raw_data)))),
            Type::ReplaceBz => Some(Box::new(bzip2::read::BzDecoder::new(Cursor::new(&raw_data)))),
            Type::Zstd => Some(Box::new(
                zstd::stream::read::Decoder::new(Cursor::new(&raw_data))
                    .map_err(|e| anyhow!("zstd decoder: {e}"))?,
            )),
            _ => anyhow::bail!("unsupported payload operation type: {:?}", operation_type),
        };

        for extent in destination_extents {
            let start_block = extent.start_block.unwrap_or_default();
            let num_blocks = extent.num_blocks.unwrap_or_default();
            let start_offset = start_block
                .checked_mul(block_size as u64)
                .ok_or_else(|| anyhow!("destination seek overflow"))?;
            let extent_size = usize::try_from(num_blocks)
                .map_err(|_| anyhow!("destination extent block count overflow"))?
                .checked_mul(block_size as usize)
                .ok_or_else(|| anyhow!("destination extent size overflow"))?;

            if current_pos != start_offset {
                image_writer.seek(SeekFrom::Start(start_offset))?;
                current_pos = start_offset;
            }

            if is_zero {
                image_writer.seek(SeekFrom::Current(extent_size as i64))?;
            } else if let Some(ref mut dec) = compressed_reader {
                stream_copy(dec, image_writer, &mut buf, extent_size)?;
            } else {
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
