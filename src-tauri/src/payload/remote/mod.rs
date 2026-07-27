//! Remote payload loading and extraction for HTTP URLs.
//!
//! Supports two input types:
//! - **Direct payload.bin**: URL points directly to a payload.bin file
//! - **ZIP archive**: URL points to a ZIP containing payload.bin (e.g., factory images)
//!
//! Supports two extraction modes:
//! - **Prefetch** (`true`): Downloads entire payload to a temp file first, then extracts.
//!   Best for slow/high-latency connections — extraction is fast after download.
//! - **Direct** (`false`): Reads HTTP ranges on-demand during extraction.
//!   Best for fast connections — starts extraction immediately without waiting for full download.
#![allow(unsafe_code)] // memmap2 for prefetched payload files

pub mod factory;
pub mod http;
pub mod http_zip;
pub mod load_progress;
pub mod prefetch;
pub mod progress;
pub mod session;

pub use factory::{
    extract_remote_factory_images, get_remote_factory_image_metadata,
    list_remote_factory_image_partitions,
};
pub use http::HttpPayloadReader;
// Crate-visible for marketplace SSRF helpers.
#[allow(unused_imports)]
pub use http::{ERR_NO_RANGE, no_range_error, resolve_redirect_url, validate_outbound_url};
pub use http_zip::{ZipPayloadInfo, find_payload_in_zip, is_zip_url, read_text_file_from_zip};
pub use prefetch::{PayloadByteSpan, absolute_download_range, compute_payload_span};
pub use session::open_http_reader;

use crate::payload::cancel::CancellationToken;
use crate::payload::chromeos_update_engine::DeltaArchiveManifest;
use crate::payload::crau::parse_header;
use crate::payload::io::NonTemporalWriter;
use crate::payload::transaction::TransactionGuard;
use crate::payload::verify::{op_blob_matches, verify_sha256};
use anyhow::{Result, anyhow};
use http_zip::read_from_zip_or_direct;
use memmap2::Mmap;
use progress::ProgressThrottle;
use prost::Message;
use rayon::prelude::*;
use std::fs::File;
use std::io::{Cursor, Read, Seek, SeekFrom, Write};
use std::sync::Arc;
use tempfile::NamedTempFile;

#[cfg(feature = "remote_zip")]
use tauri::Emitter;

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
    /// For ZIP files: offset of payload.bin within the ZIP. For direct: 0.
    pub zip_offset: u64,
    /// For ZIP files: info about the payload.bin entry. None for direct payloads.
    pub zip_info: Option<ZipPayloadInfo>,
}

// =============================================================================
// Public API
// =============================================================================

/// Load remote payload manifest and partition info (for partition listing).
///
/// Downloads just enough to parse the manifest header (~1 MB or less).
/// Handles both direct payload.bin URLs and ZIP archives.
/// Emits `payload:load-progress` phases when `app` is provided.
#[cfg(feature = "remote_zip")]
pub async fn list_remote_payload_partitions(
    url: String,
    app: Option<tauri::AppHandle>,
) -> Result<Vec<crate::payload::types::PartitionDetail>> {
    const TOTAL_STEPS: u32 = 4;
    let app_ref = app.as_ref();

    load_progress::emit_load_progress(
        app_ref,
        "verifyConnection",
        "Verifying connection…",
        None,
        1,
        TOTAL_STEPS,
    );

    let reader = match session::open_http_reader(&url).await {
        Ok(reader) => reader,
        Err(err) => {
            load_progress::emit_load_progress(
                app_ref,
                "error",
                "Connection failed",
                Some(&err.to_string()),
                1,
                TOTAL_STEPS,
            );
            return Err(err);
        }
    };

    let (manifest_bytes, _data_offset) = if is_zip_url(&url) {
        // ZIP file: find payload.bin entry, then read its header
        log::info!("ZIP URL detected, finding payload.bin in {}", url);
        load_progress::emit_load_progress(
            app_ref,
            "locateIndex",
            "Locating ZIP index…",
            None,
            2,
            TOTAL_STEPS,
        );

        let zip_info = match find_payload_in_zip(&reader).await {
            Ok(zip_info) => zip_info,
            Err(payload_error) => {
                log::info!(
                    "payload.bin not found in remote ZIP, trying factory image parser: {}",
                    payload_error
                );
                load_progress::emit_load_progress(
                    app_ref,
                    "detectFormat",
                    "Detecting format…",
                    Some("factory image candidate"),
                    3,
                    TOTAL_STEPS,
                );
                // Factory path emits its own progress/error/done; only wrap the message here.
                return match list_remote_factory_image_partitions(url, app).await {
                    Ok(details) => Ok(details),
                    Err(factory_error) => Err(anyhow!(
                        "{payload_error}; factory image detection failed: {factory_error}"
                    )),
                };
            }
        };
        log::info!(
            "Found payload.bin at offset {}, size {} (uncompressed: {})",
            zip_info.offset,
            zip_info.compressed_size,
            zip_info.uncompressed_size
        );

        load_progress::emit_load_progress(
            app_ref,
            "detectFormat",
            "OTA payload detected",
            Some("payload.bin"),
            3,
            TOTAL_STEPS,
        );

        // Read the first 1MB of payload.bin from within the ZIP
        let header_data =
            match read_from_zip_or_direct(&reader, &Some(zip_info), 0, 1024 * 1024).await {
                Ok(data) => data,
                Err(err) => {
                    load_progress::emit_load_progress(
                        app_ref,
                        "error",
                        "Failed to read payload header",
                        Some(&err.to_string()),
                        3,
                        TOTAL_STEPS,
                    );
                    return Err(err);
                }
            };
        match parse_header(&header_data) {
            Ok(parsed) => parsed,
            Err(err) => {
                load_progress::emit_load_progress(
                    app_ref,
                    "error",
                    "Failed to parse payload header",
                    Some(&err.to_string()),
                    3,
                    TOTAL_STEPS,
                );
                return Err(err);
            }
        }
    } else {
        load_progress::emit_load_progress(
            app_ref,
            "locateIndex",
            "Direct payload (no ZIP index)",
            None,
            2,
            TOTAL_STEPS,
        );
        load_progress::emit_load_progress(
            app_ref,
            "detectFormat",
            "Direct payload.bin",
            None,
            3,
            TOTAL_STEPS,
        );

        // Direct payload.bin: read first 1MB
        let header_data = match reader.read_range(0, 1024 * 1024).await {
            Ok(data) => data,
            Err(err) => {
                load_progress::emit_load_progress(
                    app_ref,
                    "error",
                    "Failed to read payload header",
                    Some(&err.to_string()),
                    3,
                    TOTAL_STEPS,
                );
                return Err(err);
            }
        };
        match parse_header(&header_data) {
            Ok(parsed) => parsed,
            Err(err) => {
                load_progress::emit_load_progress(
                    app_ref,
                    "error",
                    "Failed to parse payload header",
                    Some(&err.to_string()),
                    3,
                    TOTAL_STEPS,
                );
                return Err(err);
            }
        }
    };

    load_progress::emit_load_progress(
        app_ref,
        "readPartitions",
        "Reading partition list…",
        None,
        4,
        TOTAL_STEPS,
    );

    // Decode manifest
    let manifest = match DeltaArchiveManifest::decode(&manifest_bytes[..]) {
        Ok(m) => m,
        Err(err) => {
            load_progress::emit_load_progress(
                app_ref,
                "error",
                "Failed to decode manifest",
                Some(&err.to_string()),
                4,
                TOTAL_STEPS,
            );
            return Err(err.into());
        }
    };

    let details: Vec<crate::payload::types::PartitionDetail> = manifest
        .partitions
        .iter()
        .map(|p| {
            let download_size: u64 =
                p.operations.iter().map(|op| op.data_length.unwrap_or(0)).sum();
            crate::payload::types::PartitionDetail {
                name: p.partition_name.clone(),
                size: p.new_partition_info.as_ref().and_then(|info| info.size).unwrap_or_default(),
                download_size: Some(download_size),
            }
        })
        .collect();

    load_progress::emit_load_progress(
        app_ref,
        "done",
        "Partitions loaded",
        Some(&format!("{} partitions", details.len())),
        4,
        TOTAL_STEPS,
    );

    Ok(details)
}

/// Gather full metadata (HTTP + ZIP + OTA manifest + OTA package info) from a remote URL.
///
/// Downloads only enough data to parse the manifest header (~1 MB) and reads
/// `META-INF/com/android/metadata` + `payload_properties.txt` from the ZIP for
/// device/build info.
#[cfg(feature = "remote_zip")]
pub async fn get_remote_payload_metadata(
    url: String,
) -> Result<crate::payload::types::RemotePayloadMetadata> {
    use crate::payload::types::{DynamicGroupInfo, RemotePayloadMetadata};

    let reader = session::open_http_reader(&url).await?;

    // HTTP layer — captured from the HEAD response
    let content_length = reader.content_length();
    let content_type = reader.content_type().map(String::from);
    let last_modified = reader.last_modified().map(String::from);
    let server = reader.server().map(String::from);
    let etag = reader.etag().map(String::from);

    let is_zip = is_zip_url(&url);

    // ZIP layer + manifest parse
    let (manifest_bytes, zip_info) = if is_zip {
        let zi = match find_payload_in_zip(&reader).await {
            Ok(zip_info) => zip_info,
            Err(payload_error) => {
                log::info!(
                    "payload.bin not found in remote ZIP metadata, trying factory image metadata: {}",
                    payload_error
                );
                return get_remote_factory_image_metadata(url).await.map_err(|factory_error| {
                    anyhow!("{}; factory image metadata failed: {}", payload_error, factory_error)
                });
            }
        };
        let header_data =
            read_from_zip_or_direct(&reader, &Some(zi.clone()), 0, 1024 * 1024).await?;
        let (manifest, _) = parse_header(&header_data)?;
        (manifest, Some(zi))
    } else {
        let header_data = reader.read_range(0, 1024 * 1024).await?;
        let (manifest, _) = parse_header(&header_data)?;
        (manifest, None)
    };

    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    // ZIP metadata
    let zip_payload_offset = zip_info.as_ref().map(|z| z.offset);
    let zip_compressed_size = zip_info.as_ref().map(|z| z.compressed_size);
    let zip_uncompressed_size = zip_info.as_ref().map(|z| z.uncompressed_size);
    let zip_compression_method = zip_info.as_ref().map(|z| match z.compression_method {
        0 => "Stored".to_string(),
        8 => "Deflate".to_string(),
        other => format!("Unknown ({other})"),
    });

    // OTA manifest metadata
    let block_size = manifest.block_size.unwrap_or(4096);
    let minor_version = manifest.minor_version;
    let security_patch_level = manifest.security_patch_level.clone();
    let max_timestamp = manifest.max_timestamp;
    let partial_update = manifest.partial_update;
    let partition_count = manifest.partitions.len();
    let total_size: u64 = manifest
        .partitions
        .iter()
        .map(|p| p.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or_default())
        .sum();

    let dynamic_groups = manifest
        .dynamic_partition_metadata
        .as_ref()
        .map(|meta| {
            meta.groups
                .iter()
                .map(|g| DynamicGroupInfo {
                    name: g.name.clone(),
                    size: g.size,
                    partitions: g.partition_names.clone(),
                })
                .collect()
        })
        .unwrap_or_default();

    // =========================================================================
    // OTA Package metadata — read from ZIP entries (best-effort, never fails)
    // =========================================================================
    let (
        ota_type,
        pre_device,
        post_build,
        post_build_incremental,
        post_sdk_level,
        post_security_patch_level,
        post_timestamp,
        ota_version,
        wipe,
    ) = if is_zip {
        // Read META-INF/com/android/metadata
        let android_metadata =
            read_text_file_from_zip(&reader, "META-INF/com/android/metadata").await.ok().flatten();

        if let Some(ref text) = android_metadata {
            let props = parse_kv_text(text);
            (
                props.get("ota-type").cloned(),
                props.get("pre-device").cloned(),
                props.get("post-build").cloned(),
                props.get("post-build-incremental").cloned(),
                props.get("post-sdk-level").cloned(),
                props.get("post-security-patch-level").cloned(),
                props.get("post-timestamp").cloned(),
                props.get("ota_version").or_else(|| props.get("ota-id")).cloned(),
                props.get("wipe").map(|v| v == "1" || v.eq_ignore_ascii_case("true")),
            )
        } else {
            (None, None, None, None, None, None, None, None, None)
        }
    } else {
        (None, None, None, None, None, None, None, None, None)
    };

    let (file_hash, file_size_prop, metadata_hash, metadata_size_prop) = if is_zip {
        let props_text =
            read_text_file_from_zip(&reader, "payload_properties.txt").await.ok().flatten();

        if let Some(ref text) = props_text {
            let props = parse_kv_text(text);
            (
                props.get("FILE_HASH").cloned(),
                props.get("FILE_SIZE").and_then(|v| v.parse::<u64>().ok()),
                props.get("METADATA_HASH").cloned(),
                props.get("METADATA_SIZE").and_then(|v| v.parse::<u64>().ok()),
            )
        } else {
            (None, None, None, None)
        }
    } else {
        (None, None, None, None)
    };

    Ok(RemotePayloadMetadata {
        content_length,
        content_type,
        last_modified,
        server,
        etag,
        is_zip,
        zip_payload_offset,
        zip_compressed_size,
        zip_uncompressed_size,
        zip_compression_method,
        block_size,
        payload_version: 2, // CrAU header is always version 2
        minor_version,
        security_patch_level,
        max_timestamp,
        partial_update,
        dynamic_groups,
        partition_count,
        total_size,
        remote_kind: Some("payload".to_string()),
        // OTA Package metadata
        ota_type,
        pre_device,
        post_build,
        post_build_incremental,
        post_sdk_level,
        post_security_patch_level,
        post_timestamp,
        ota_version,
        wipe,
        file_hash,
        file_size: file_size_prop,
        metadata_hash,
        metadata_size: metadata_size_prop,
    })
}

/// Allocate a byte buffer sized from an **untrusted** ZIP/manifest length.
///
/// `Vec::with_capacity` aborts the process on a bogus multi-exabyte size, and on
/// 32-bit targets `size as usize` silently truncates. `try_reserve` turns both into
/// an ordinary error, matching the factory path.
fn reserved_buffer(size_hint: u64) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    if let Ok(capacity) = usize::try_from(size_hint)
        && capacity > 0
    {
        buffer
            .try_reserve(capacity)
            .map_err(|error| anyhow!("failed to allocate {capacity} bytes: {error}"))?;
    }
    Ok(buffer)
}

/// Parse a `key=value` text file into a HashMap. Skips blank lines and trims whitespace.
fn parse_kv_text(text: &str) -> std::collections::HashMap<String, String> {
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let (key, value) = line.split_once('=')?;
            Some((key.trim().to_string(), value.trim().to_string()))
        })
        .collect()
}

/// Prefetch mode: Download the byte span needed for selected partitions, then extract via mmap.
///
/// Downloads only the payload.bin region covering header + selected op blobs — not the full
/// remote ZIP `Content-Length` when the archive is huge. Factory images stay on the selective
/// factory path (no whole-ZIP re-download).
///
/// Best for slow/high-latency connections — extraction is fast after download.
#[cfg(feature = "remote_zip")]
pub async fn extract_remote_prefetch(
    url: String,
    output_dir: Option<&std::path::Path>,
    selected_partitions: &[String],
    app_handle: Option<tauri::AppHandle>,
    cancel_token: Option<&CancellationToken>,
) -> Result<crate::payload::types::ExtractPayloadResult> {
    let extract_started = std::time::Instant::now();
    let reader = session::open_http_reader(&url).await?;
    let content_length = reader.content_length();
    let is_zip = is_zip_url(&url);
    let zip_info = if is_zip {
        match find_payload_in_zip(&reader).await {
            Ok(zip_info) => Some(zip_info),
            Err(payload_error) => {
                log::info!(
                    "payload.bin not found before prefetch, using factory image extraction: {}",
                    payload_error
                );
                // Factory path already streams only selected images — do not full-download ZIP.
                return extract_remote_factory_images(
                    url,
                    output_dir,
                    selected_partitions,
                    app_handle,
                    cancel_token,
                )
                .await;
            }
        }
    } else {
        None
    };

    // Probe header/manifest so we can compute the selected-op span (Task 3.2 / S2).
    if cancel_token.is_some_and(CancellationToken::is_cancelled) {
        anyhow::bail!("extraction cancelled");
    }
    let header_data = read_from_zip_or_direct(&reader, &zip_info, 0, 1024 * 1024).await?;
    let (manifest_bytes, data_offset) = parse_header(&header_data)?;
    let probe_manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    let span =
        prefetch::compute_payload_span(&probe_manifest, data_offset as u64, selected_partitions);

    let (abs_start, download_len) = prefetch::absolute_download_range(
        span,
        zip_info.as_ref().map(|z| z.offset),
        zip_info.as_ref().map(|z| z.compressed_size),
        zip_info.as_ref().map(|z| z.compression_method),
        content_length,
    );

    // Deflated ZIP member: download compressed blob, inflate to a pure payload.bin temp.
    let deflated_zip = zip_info.as_ref().is_some_and(|z| z.compression_method != 0);

    log::info!(
        "Prefetch: downloading span abs_start={} len={} of remote {} (is_zip={}, span_end={}, content_length={})",
        abs_start,
        download_len,
        url,
        is_zip,
        span.end,
        content_length
    );

    // Stream to temp file in 1 MB chunks. NamedTempFile::keep() persists it
    // on disk after we're done so the mmap can use it without the file
    // being deleted when the NamedTempFile drops.
    let mut temp = NamedTempFile::new()?;
    let chunk_size = 1024 * 1024; // 1 MB
    let mut downloaded = 0u64;
    let throttle = Arc::new(ProgressThrottle::new());

    while downloaded < download_len {
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            anyhow::bail!("extraction cancelled");
        }
        let chunk_end = (downloaded + chunk_size).min(download_len);
        let chunk_len = chunk_end - downloaded;
        let data =
            reader.read_range_cancellable(abs_start + downloaded, chunk_len, cancel_token).await?;
        temp.as_file_mut().write_all(&data)?;
        downloaded = chunk_end;

        // Emit download progress (throttled; the final chunk always emits).
        if let Some(ref handle) = app_handle
            && throttle.should_emit(downloaded >= download_len)
        {
            let _ = handle.emit(
                "payload:progress",
                serde_json::json!({
                    "partitionName": "__download__",
                    "current": downloaded,
                    "total": download_len,
                    "completed": false,
                }),
            );
        }
    }
    temp.flush()?;

    // For deflated ZIP payload.bin, rewrite temp as decompressed payload prefix/full member.
    if deflated_zip {
        let zi = zip_info.as_ref().ok_or_else(|| anyhow!("ZIP payload info missing"))?;
        // Inflating a multi-GB member is CPU-bound blocking work; keep it off the
        // Tokio worker driving this future.
        tokio::task::block_in_place(|| -> Result<()> {
            temp.as_file_mut().seek(SeekFrom::Start(0))?;
            let mut compressed = reserved_buffer(zi.compressed_size)?;
            temp.as_file_mut().read_to_end(&mut compressed)?;
            let mut decoder = flate2::read::DeflateDecoder::new(&compressed[..]);
            let mut decompressed = reserved_buffer(zi.uncompressed_size)?;
            decoder.read_to_end(&mut decompressed)?;
            temp.as_file_mut().seek(SeekFrom::Start(0))?;
            temp.as_file_mut().set_len(0)?;
            temp.as_file_mut().write_all(&decompressed)?;
            temp.flush()?;
            Ok(())
        })?;
    }

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

    // Temp holds a payload.bin prefix (or full deflated member) starting at offset 0 —
    // not the whole remote ZIP. parse_header + op offsets are payload-relative.
    let file = File::open(&temp_path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    let mmap = Arc::new(mmap);

    let (manifest_bytes, data_offset) = parse_header(&mmap)?;
    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    let output_dir = output_dir.filter(|p| !p.as_os_str().is_empty()).map_or_else(
        || {
            let stamp = crate::payload::format_datetime();
            std::path::PathBuf::from(format!("extracted_{stamp}"))
        },
        std::path::PathBuf::from,
    );

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

    let output_dir = Arc::new(output_dir);
    // Partial images must not survive a failure — mirrors the local CrAU path.
    let guard = Arc::new(TransactionGuard::new((*output_dir).clone()));

    // rayon + blocking file IO: keep it off the Tokio worker that drives this future.
    let results: Vec<Result<String>> = tokio::task::block_in_place(|| {
        partitions_to_extract
            .par_iter()
            .map(|partition| {
                let output_dir = Arc::clone(&output_dir);
                let guard = Arc::clone(&guard);
                let mmap = Arc::clone(&mmap);
                let throttle = Arc::clone(&throttle);
                let partition_name = partition.partition_name.clone();
                let app = app_handle.clone();

                let file_name = crate::helpers::safe_image_file_name(&partition_name);
                let image_path = output_dir.join(&file_name);
                guard.add_file(image_path.clone());

                let partition_size =
                    partition.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or(0);

                let mut writer = NonTemporalWriter::new(&image_path, partition_size)
                    .map_err(|e| anyhow::anyhow!("NonTemporalWriter: {e}"))?;

                extract_partition_from_mmap(
                    &mmap,
                    data_offset,
                    block_size,
                    partition,
                    &mut writer,
                    |name, current, total, completed| {
                        if let Some(ref handle) = app
                            && throttle.should_emit(completed)
                        {
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
                    cancel_token,
                )?;

                writer.flush()?;
                verify_partition_output_hash(partition, &image_path, &partition_name)?;
                Ok(file_name)
            })
            .collect()
    });

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(file_name) => extracted_files.push(file_name),
            Err(e) => {
                guard.abort();
                return Err(e);
            }
        }
    }
    guard.commit();

    let total_bytes: u64 = partitions_to_extract
        .iter()
        .map(|p| p.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or(0))
        .sum();
    let stats = crate::payload::types::ExtractionStats::computed(
        extract_started.elapsed(),
        extracted_files.len(),
        total_bytes,
    );

    // Temp file guard goes out of scope here — cleanup via Drop.
    Ok(crate::payload::types::ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
        stats: Some(stats),
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
    cancel_token: Option<&CancellationToken>,
) -> Result<crate::payload::types::ExtractPayloadResult> {
    let extract_started = std::time::Instant::now();
    // Step 1: Get reader and manifest via HTTP (session-cached HEAD/ZIP)
    let reader = session::open_http_reader(&url).await?;
    let content_length = reader.content_length();
    let is_zip = is_zip_url(&url);

    log::info!("Direct mode: fetching manifest from {} (is_zip={})", url, is_zip);

    // Step 2: Read header to get manifest
    let (manifest_bytes, data_offset, zip_info) = if is_zip {
        let zip_info = match find_payload_in_zip(&reader).await {
            Ok(zip_info) => zip_info,
            Err(payload_error) => {
                log::info!(
                    "payload.bin not found in direct mode, using factory image extraction: {}",
                    payload_error
                );
                return extract_remote_factory_images(
                    url,
                    output_dir,
                    selected_partitions,
                    app_handle,
                    cancel_token,
                )
                .await;
            }
        };
        log::info!(
            "Found payload.bin at offset {}, size {} (uncompressed: {})",
            zip_info.offset,
            zip_info.compressed_size,
            zip_info.uncompressed_size
        );
        let header_data =
            read_from_zip_or_direct(&reader, &Some(zip_info.clone()), 0, 1024 * 1024).await?;
        let (manifest, offset) = parse_header(&header_data)?;
        (manifest, offset, Some(zip_info))
    } else {
        let header_data = reader.read_range(0, 1024 * 1024).await?;
        let (manifest, offset) = parse_header(&header_data)?;
        (manifest, offset, None)
    };
    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    log::info!(
        "Direct mode: {} partitions, {} total bytes",
        manifest.partitions.len(),
        content_length
    );

    let output_dir = output_dir.filter(|p| !p.as_os_str().is_empty()).map_or_else(
        || {
            let stamp = crate::payload::format_datetime();
            std::path::PathBuf::from(format!("extracted_{stamp}"))
        },
        std::path::PathBuf::from,
    );

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
    let zip_info_arc = zip_info.map(Arc::new);
    let block_size = manifest.block_size.unwrap_or(4096);

    let output_dir = Arc::new(output_dir);
    // Partial images must not survive a failure — mirrors the local CrAU path.
    let guard = Arc::new(TransactionGuard::new((*output_dir).clone()));
    let throttle = Arc::new(ProgressThrottle::new());

    // rayon + blocking range reads: keep them off the Tokio worker driving this future.
    let results: Vec<Result<String>> = tokio::task::block_in_place(|| {
        partitions_to_extract
            .par_iter()
            .map(|partition| {
                let output_dir = Arc::clone(&output_dir);
                let guard = Arc::clone(&guard);
                let throttle = Arc::clone(&throttle);
                let http = http.clone();
                let zip_info = zip_info_arc.clone();
                let partition_name = partition.partition_name.clone();
                let app = app_handle.clone();

                let file_name = crate::helpers::safe_image_file_name(&partition_name);
                let image_path = output_dir.join(&file_name);
                guard.add_file(image_path.clone());

                let partition_size =
                    partition.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or(0);

                let mut writer = NonTemporalWriter::new(&image_path, partition_size)
                    .map_err(|e| anyhow::anyhow!("NonTemporalWriter: {e}"))?;

                let read_context =
                    RemoteReadContext { http: &http, zip_info: zip_info.as_deref(), data_offset };

                extract_partition_from_remote(
                    read_context,
                    block_size,
                    partition,
                    &mut writer,
                    |name, current, total, completed| {
                        if let Some(ref handle) = app
                            && throttle.should_emit(completed)
                        {
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
                    cancel_token,
                )?;

                writer.flush()?;
                verify_partition_output_hash(partition, &image_path, &partition_name)?;
                Ok(file_name)
            })
            .collect()
    });

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(file_name) => extracted_files.push(file_name),
            Err(e) => {
                guard.abort();
                return Err(e);
            }
        }
    }
    guard.commit();

    let total_bytes: u64 = partitions_to_extract
        .iter()
        .map(|p| p.new_partition_info.as_ref().and_then(|i| i.size).unwrap_or(0))
        .sum();
    let stats = crate::payload::types::ExtractionStats::computed(
        extract_started.elapsed(),
        extracted_files.len(),
        total_bytes,
    );

    Ok(crate::payload::types::ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
        stats: Some(stats),
    })
}

// =============================================================================
// Internal extraction functions
// =============================================================================

/// L4: when `new_partition_info.hash` is present, verify the written image SHA-256.
fn verify_partition_output_hash(
    partition: &super::chromeos_update_engine::PartitionUpdate,
    image_path: &std::path::Path,
    partition_name: &str,
) -> Result<()> {
    let Some(info) = partition.new_partition_info.as_ref() else {
        return Ok(());
    };
    let Some(expected) = info.hash.as_ref().filter(|h| !h.is_empty()) else {
        return Ok(());
    };
    let ok = verify_sha256(image_path, expected)
        .map_err(|e| anyhow!("failed to hash output for {partition_name}: {e}"))?;
    if !ok {
        anyhow::bail!("partition {partition_name} output file SHA-256 mismatch");
    }
    Ok(())
}

/// Extract from mmap (prefetch mode — full file already downloaded).
fn extract_partition_from_mmap(
    mmap: &Mmap,
    data_offset: usize,
    block_size: u32,
    partition: &super::chromeos_update_engine::PartitionUpdate,
    writer: &mut (impl Write + Seek),
    mut progress: impl FnMut(&str, usize, usize, bool),
    cancel_token: Option<&CancellationToken>,
) -> Result<()> {
    use super::chromeos_update_engine::install_operation::Type;

    let total_operations = partition.operations.len();
    if total_operations == 0 {
        progress(&partition.partition_name, 0, 0, true);
        return Ok(());
    }

    let mut current_pos = 0u64;

    for (index, operation) in partition.operations.iter().enumerate() {
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            anyhow::bail!("extraction cancelled");
        }

        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        // `data_offset` / `data_length` come from an untrusted manifest and release
        // builds have `overflow-checks` off, so a plain `+` here wraps silently: the
        // bounds check would pass and the slice index would then panic (with
        // `panic = "abort"`, killing the process) or read the wrong region. Every
        // step is checked and the slice is taken with `get`.
        let data_start = operation
            .data_offset
            .unwrap_or_default()
            .try_into()
            .ok()
            .and_then(|relative: usize| data_offset.checked_add(relative))
            .ok_or_else(|| anyhow!("payload operation data offset overflows"))?;
        let data_length: usize = operation
            .data_length
            .unwrap_or_default()
            .try_into()
            .map_err(|_| anyhow!("payload operation data length overflows"))?;
        let data_end = data_start
            .checked_add(data_length)
            .ok_or_else(|| anyhow!("payload operation data end overflows"))?;
        let raw_data = mmap
            .get(data_start..data_end)
            .ok_or_else(|| anyhow!("payload operation data exceeds file size"))?;

        // L3: hash full payload-stored blob (compressed for REPLACE_*) before decompress.
        if let Some(expected) = operation.data_sha256_hash.as_ref().filter(|h| !h.is_empty())
            && !op_blob_matches(raw_data, expected)
        {
            anyhow::bail!("payload operation {index} compressed data hash mismatch");
        }

        let operation_type = Type::try_from(operation.r#type)
            .map_err(|_| anyhow!("unsupported operation type {}", operation.r#type))?;

        let mut decoded_offset = 0usize;
        let is_zero = operation_type == Type::Zero;

        let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
            Type::Replace | Type::Zero => None,
            Type::ReplaceXz => {
                log::debug!(
                    "mmap XZ data at offset {} len {} first_bytes={:?}",
                    data_start,
                    data_length,
                    raw_data.first().copied(),
                );
                Some(Box::new(liblzma::read::XzDecoder::new_multi_decoder(Cursor::new(raw_data))))
            }
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
                writer.seek(SeekFrom::Start(start_offset))?;
                current_pos = start_offset;
            }

            if is_zero {
                let skip = i64::try_from(extent_size)
                    .map_err(|_| anyhow!("destination extent size overflow"))?;
                writer.seek(SeekFrom::Current(skip))?;
            } else if let Some(ref mut dec) = compressed_reader {
                // Fail-hard: stream_copy returns UnexpectedEof on short decompress.
                super::io::with_io_buf(|buf| {
                    super::io::stream_copy(dec, writer, buf, extent_size, None)
                })?;
            } else {
                // REPLACE: the stored blob must cover the extent exactly. Clamping to
                // `raw_data.len()` (the previous behaviour) wrote fewer bytes than the
                // extent declares and reported success — a silently short, corrupt
                // image. Fail hard, matching the compressed path.
                let slice_end = decoded_offset
                    .checked_add(extent_size)
                    .ok_or_else(|| anyhow!("payload operation data end overflows"))?;
                let slice = raw_data.get(decoded_offset..slice_end).ok_or_else(|| {
                    anyhow!(
                        "payload operation {index} REPLACE data is short: extent needs {} bytes, blob has {}",
                        slice_end,
                        raw_data.len()
                    )
                })?;
                writer.write_all(slice)?;
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
///
/// If zip_info is provided, reads are offset by the ZIP entry position.
struct RemoteReadContext<'a> {
    http: &'a HttpPayloadReader,
    zip_info: Option<&'a ZipPayloadInfo>,
    data_offset: usize,
}

fn extract_partition_from_remote(
    read_context: RemoteReadContext<'_>,
    block_size: u32,
    partition: &super::chromeos_update_engine::PartitionUpdate,
    writer: &mut (impl Write + Seek),
    mut progress: impl FnMut(&str, usize, usize, bool),
    cancel_token: Option<&CancellationToken>,
) -> Result<()> {
    use super::chromeos_update_engine::install_operation::Type;

    let total_operations = partition.operations.len();
    if total_operations == 0 {
        progress(&partition.partition_name, 0, 0, true);
        return Ok(());
    }

    let mut current_pos = 0u64;

    for (index, operation) in partition.operations.iter().enumerate() {
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            anyhow::bail!("extraction cancelled");
        }

        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        // Untrusted manifest values: every offset addition is checked so a hostile
        // payload cannot wrap into a valid-looking range (release builds have
        // `overflow-checks` off).
        let data_offset_op = operation.data_offset.unwrap_or_default();
        let data_length = operation.data_length.unwrap_or_default();

        let payload_relative_offset = (read_context.data_offset as u64)
            .checked_add(data_offset_op)
            .ok_or_else(|| anyhow!("payload operation data offset overflows"))?;
        let read_offset = match read_context.zip_info {
            Some(zi) => zi
                .offset
                .checked_add(payload_relative_offset)
                .ok_or_else(|| anyhow!("payload operation data offset overflows"))?,
            None => payload_relative_offset,
        };
        if read_offset.checked_add(data_length).is_none() {
            anyhow::bail!("payload operation data end overflows");
        }

        let raw_data = read_context.http.read_range_sync_cancellable(
            read_offset,
            data_length,
            cancel_token,
        )?;

        // L3: hash full payload-stored blob (compressed for REPLACE_*) before decompress.
        if let Some(expected) = operation.data_sha256_hash.as_ref().filter(|h| !h.is_empty())
            && !op_blob_matches(&raw_data, expected)
        {
            anyhow::bail!("payload operation {index} compressed data hash mismatch");
        }

        let operation_type = Type::try_from(operation.r#type)
            .map_err(|_| anyhow!("unsupported operation type {}", operation.r#type))?;

        let mut decoded_offset = 0usize;
        let is_zero = operation_type == Type::Zero;

        let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
            Type::Replace | Type::Zero => None,
            Type::ReplaceXz => {
                Some(Box::new(liblzma::read::XzDecoder::new_multi_decoder(Cursor::new(&raw_data))))
            }
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
                writer.seek(SeekFrom::Start(start_offset))?;
                current_pos = start_offset;
            }

            if is_zero {
                let skip = i64::try_from(extent_size)
                    .map_err(|_| anyhow!("destination extent size overflow"))?;
                writer.seek(SeekFrom::Current(skip))?;
            } else if let Some(ref mut dec) = compressed_reader {
                // Fail-hard: stream_copy returns UnexpectedEof on short decompress.
                super::io::with_io_buf(|buf| {
                    super::io::stream_copy(dec, writer, buf, extent_size, None)
                })?;
            } else {
                // REPLACE: the stored blob must cover the extent exactly. Clamping to
                // `raw_data.len()` (the previous behaviour) wrote fewer bytes than the
                // extent declares and reported success — a silently short, corrupt
                // image. Fail hard, matching the compressed path.
                let slice_end = decoded_offset
                    .checked_add(extent_size)
                    .ok_or_else(|| anyhow!("payload operation data end overflows"))?;
                let slice = raw_data.get(decoded_offset..slice_end).ok_or_else(|| {
                    anyhow!(
                        "payload operation {index} REPLACE data is short: extent needs {} bytes, blob has {}",
                        slice_end,
                        raw_data.len()
                    )
                })?;
                writer.write_all(slice)?;
                decoded_offset = slice_end;
            }

            current_pos += extent_size as u64;
        }

        let completed = index + 1 == total_operations;
        progress(&partition.partition_name, index + 1, total_operations, completed);
    }

    Ok(())
}
