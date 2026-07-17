//! Remote Android factory image ZIP extraction.
//!
//! Pixel factory images are ZIP files that usually contain flash scripts, bootloader/radio
//! images, and a stored nested `image-*.zip` with most partition `.img` files. This module
//! parses those ZIP central directories with HTTP ranges and streams only the selected images.

use super::http::HttpPayloadReader;
use super::session;
use crate::payload::cancel::CancellationToken;
use crate::payload::io::NonTemporalWriter;
use crate::payload::types::{ExtractPayloadResult, ExtractionStats, PartitionDetail};
use anyhow::{Result, anyhow};
use flate2::read::DeflateDecoder;
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[cfg(feature = "remote_zip")]
use tauri::{AppHandle, Emitter};

const EOCD_SIG: u32 = 0x06054b50;
const CD_SIG: u32 = 0x02014b50;
const LOCAL_SIG: u32 = 0x04034b50;
const ZIP64_EOCD_SIG: u32 = 0x06064b50;
const ZIP64_EOCD_LOCATOR_SIG: u32 = 0x07064b50;
const ZIP64_EXTRA_ID: u16 = 0x0001;
const ZIP32_MAX: u64 = u32::MAX as u64;
const EOCD_MAX_SIZE: usize = 64 * 1024 + 22;
const RANGE_CHUNK_SIZE: u64 = 8 * 1024 * 1024;
const COPY_BUF_SIZE: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FactoryImageEntry {
    pub name: String,
    pub partition_name: String,
    pub data_offset: u64,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub compression_method: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ZipCentralDirectoryEntry {
    pub name: String,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub compression_method: u16,
    pub local_header_offset: u64,
}

#[derive(Debug, Clone, Copy)]
struct ZipWindow {
    base_offset: u64,
    length: u64,
}

#[cfg(feature = "remote_zip")]
pub async fn list_remote_factory_image_partitions(
    url: String,
    app: Option<AppHandle>,
) -> Result<Vec<PartitionDetail>> {
    use super::load_progress;

    const TOTAL_STEPS: u32 = 4;
    let app_ref = app.as_ref();

    // When called as fallback from list_remote_payload_partitions, verify/locate may
    // already have been emitted. Re-emit locate/detect for factory path clarity.
    load_progress::emit_load_progress(
        app_ref,
        "locateIndex",
        "Locating factory ZIP index…",
        None,
        2,
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
                2,
                TOTAL_STEPS,
            );
            return Err(err);
        }
    };

    load_progress::emit_load_progress(
        app_ref,
        "detectFormat",
        "Factory image detected",
        Some("image-*.zip"),
        3,
        TOTAL_STEPS,
    );

    load_progress::emit_load_progress(
        app_ref,
        "readPartitions",
        "Discovering partition images…",
        None,
        4,
        TOTAL_STEPS,
    );

    let entries = match discover_factory_image_entries(&reader).await {
        Ok(entries) => entries,
        Err(err) => {
            load_progress::emit_load_progress(
                app_ref,
                "error",
                "Failed to discover factory images",
                Some(&err.to_string()),
                4,
                TOTAL_STEPS,
            );
            return Err(err);
        }
    };

    let details: Vec<PartitionDetail> = entries
        .into_iter()
        .map(|entry| PartitionDetail {
            name: entry.partition_name,
            size: entry.uncompressed_size,
            download_size: Some(entry.compressed_size),
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

#[cfg(feature = "remote_zip")]
pub async fn get_remote_factory_image_metadata(
    url: String,
) -> Result<crate::payload::types::RemotePayloadMetadata> {
    let reader = session::open_http_reader(&url).await?;
    let entries = discover_factory_image_entries(&reader).await?;
    let total_size = entries.iter().map(|entry| entry.uncompressed_size).sum();

    Ok(crate::payload::types::RemotePayloadMetadata {
        content_length: reader.content_length(),
        content_type: reader.content_type().map(String::from),
        last_modified: reader.last_modified().map(String::from),
        server: reader.server().map(String::from),
        etag: reader.etag().map(String::from),
        is_zip: true,
        zip_payload_offset: None,
        zip_compressed_size: None,
        zip_uncompressed_size: None,
        zip_compression_method: None,
        block_size: 0,
        payload_version: 0,
        minor_version: None,
        security_patch_level: None,
        max_timestamp: None,
        partial_update: None,
        dynamic_groups: Vec::new(),
        partition_count: entries.len(),
        total_size,
        remote_kind: Some("factoryImage".to_string()),
        ota_type: None,
        pre_device: None,
        post_build: None,
        post_build_incremental: None,
        post_sdk_level: None,
        post_security_patch_level: None,
        post_timestamp: None,
        ota_version: None,
        wipe: None,
        file_hash: None,
        file_size: None,
        metadata_hash: None,
        metadata_size: None,
    })
}

#[cfg(feature = "remote_zip")]
pub async fn extract_remote_factory_images(
    url: String,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    app_handle: Option<AppHandle>,
    cancel_token: Option<&CancellationToken>,
) -> Result<ExtractPayloadResult> {
    let extract_started = std::time::Instant::now();
    let reader = session::open_http_reader(&url).await?;
    let entries = discover_factory_image_entries(&reader).await?;
    let selected = selected_partitions.iter().map(String::as_str).collect::<HashSet<_>>();

    let entries_to_extract = entries
        .into_iter()
        .filter(|entry| selected.is_empty() || selected.contains(entry.partition_name.as_str()))
        .collect::<Vec<_>>();

    if entries_to_extract.is_empty() {
        anyhow::bail!("no selected factory image entries were found");
    }

    let total_bytes: u64 = entries_to_extract.iter().map(|e| e.uncompressed_size).sum();

    let output_dir = output_dir.filter(|path| !path.as_os_str().is_empty()).map_or_else(
        || PathBuf::from(format!("factory_images_{}", crate::payload::format_datetime())),
        PathBuf::from,
    );
    std::fs::create_dir_all(&output_dir)?;

    let mut extracted_files = Vec::with_capacity(entries_to_extract.len());
    for entry in entries_to_extract {
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            return cancelled_factory_result(&output_dir, extracted_files);
        }

        let file_name = safe_image_file_name(&entry.partition_name);
        let output_path = output_dir.join(&file_name);
        match extract_factory_entry(
            &reader,
            &entry,
            &output_path,
            app_handle.as_ref(),
            cancel_token,
        )
        .await
        {
            Ok(()) => extracted_files.push(file_name),
            Err(error) if is_cancelled_error(&error) => {
                let _ = std::fs::remove_file(&output_path);
                return cancelled_factory_result(&output_dir, extracted_files);
            }
            Err(error) => {
                let _ = std::fs::remove_file(&output_path);
                return Err(error);
            }
        }
    }

    let stats =
        ExtractionStats::computed(extract_started.elapsed(), extracted_files.len(), total_bytes);

    Ok(ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
        stats: Some(stats),
    })
}

fn is_cancelled_error(error: &anyhow::Error) -> bool {
    let message = error.to_string().to_ascii_lowercase();
    message.contains("extraction cancelled")
}

fn cancelled_factory_result(
    output_dir: &Path,
    extracted_files: Vec<String>,
) -> Result<ExtractPayloadResult> {
    // Return Ok with success=false so the command can forward partial files.
    // Callers that use `?` on Result still get Ok here.
    Ok(ExtractPayloadResult {
        success: false,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: Some("extraction cancelled".to_string()),
        stats: None,
    })
}

#[cfg(feature = "remote_zip")]
pub async fn discover_factory_image_entries(
    reader: &HttpPayloadReader,
) -> Result<Vec<FactoryImageEntry>> {
    let outer_window = ZipWindow { base_offset: 0, length: reader.content_length() };
    let outer_entries = read_central_directory(reader, outer_window).await?;

    let mut images = Vec::new();
    for entry in &outer_entries {
        if is_image_entry(&entry.name) {
            images.push(to_factory_entry(reader, entry, outer_window).await?);
        }
    }

    let nested_image_zip = outer_entries
        .iter()
        .find(|entry| entry.compression_method == 0 && image_zip_basename(&entry.name).is_some());

    if let Some(nested) = nested_image_zip {
        let nested_data_offset = data_offset_for_entry(reader, outer_window, nested).await?;
        let nested_window =
            ZipWindow { base_offset: nested_data_offset, length: nested.uncompressed_size };
        let nested_entries = read_central_directory(reader, nested_window).await?;
        for entry in nested_entries.iter().filter(|entry| is_image_entry(&entry.name)) {
            images.push(to_factory_entry(reader, entry, nested_window).await?);
        }
    }

    if images.is_empty() {
        anyhow::bail!("no .img entries found in factory image ZIP");
    }

    dedupe_partition_names(&mut images);
    images.sort_by(|left, right| left.partition_name.cmp(&right.partition_name));
    Ok(images)
}

#[cfg(feature = "remote_zip")]
async fn read_central_directory(
    reader: &HttpPayloadReader,
    window: ZipWindow,
) -> Result<Vec<ZipCentralDirectoryEntry>> {
    let tail_size = window.length.min(EOCD_MAX_SIZE as u64);
    let tail_offset = window.base_offset + window.length - tail_size;
    let tail_data = reader.read_range(tail_offset, tail_size).await?;
    let eocd_pos = find_eocd(&tail_data).ok_or_else(|| anyhow!("EOCD record not found in ZIP"))?;
    let eocd_data = &tail_data[eocd_pos..];
    if eocd_data.len() < 22 {
        anyhow::bail!("EOCD record too small");
    }

    let mut cd_size = u32::from_le_bytes(eocd_data[12..16].try_into()?) as u64;
    let mut cd_offset = u32::from_le_bytes(eocd_data[16..20].try_into()?) as u64;
    if cd_size == ZIP32_MAX || cd_offset == ZIP32_MAX {
        let zip64_eocd_offset = zip64_eocd_offset_from_tail(&tail_data, eocd_pos)?;
        let zip64_eocd = reader.read_range(window.base_offset + zip64_eocd_offset, 56).await?;
        let sig = u32::from_le_bytes(zip64_eocd[0..4].try_into()?);
        if sig != ZIP64_EOCD_SIG {
            anyhow::bail!("invalid ZIP64 EOCD record");
        }
        cd_size = u64::from_le_bytes(zip64_eocd[40..48].try_into()?);
        cd_offset = u64::from_le_bytes(zip64_eocd[48..56].try_into()?);
    }
    if cd_size == 0 || cd_offset >= window.length {
        anyhow::bail!("invalid ZIP central directory");
    }

    let cd_data = reader.read_range(window.base_offset + cd_offset, cd_size).await?;
    parse_central_directory_entries(&cd_data)
}

fn zip64_eocd_offset_from_tail(tail_data: &[u8], eocd_pos: usize) -> Result<u64> {
    if eocd_pos < 20 {
        anyhow::bail!("ZIP64 EOCD locator is missing");
    }
    let locator_pos = eocd_pos - 20;
    let sig = u32::from_le_bytes(tail_data[locator_pos..locator_pos + 4].try_into()?);
    if sig != ZIP64_EOCD_LOCATOR_SIG {
        anyhow::bail!("ZIP64 EOCD locator is missing");
    }
    Ok(u64::from_le_bytes(tail_data[locator_pos + 8..locator_pos + 16].try_into()?))
}

pub(crate) fn parse_central_directory_entries(
    cd_data: &[u8],
) -> Result<Vec<ZipCentralDirectoryEntry>> {
    let mut parse_pos = 0;
    let mut entries = Vec::new();

    while parse_pos + 46 <= cd_data.len() {
        let sig = u32::from_le_bytes(cd_data[parse_pos..parse_pos + 4].try_into()?);
        if sig != CD_SIG {
            break;
        }

        let compression_method =
            u16::from_le_bytes(cd_data[parse_pos + 10..parse_pos + 12].try_into()?);
        let mut compressed_size =
            u32::from_le_bytes(cd_data[parse_pos + 20..parse_pos + 24].try_into()?) as u64;
        let mut uncompressed_size =
            u32::from_le_bytes(cd_data[parse_pos + 24..parse_pos + 28].try_into()?) as u64;
        let filename_len =
            u16::from_le_bytes(cd_data[parse_pos + 28..parse_pos + 30].try_into()?) as usize;
        let extra_len =
            u16::from_le_bytes(cd_data[parse_pos + 30..parse_pos + 32].try_into()?) as usize;
        let comment_len =
            u16::from_le_bytes(cd_data[parse_pos + 32..parse_pos + 34].try_into()?) as usize;
        let mut local_header_offset =
            u32::from_le_bytes(cd_data[parse_pos + 42..parse_pos + 46].try_into()?) as u64;

        let entry_start = parse_pos + 46;
        let extra_start = entry_start + filename_len;
        let entry_end = extra_start + extra_len + comment_len;
        if entry_end > cd_data.len() {
            anyhow::bail!("central directory entry exceeds available data");
        }

        let name = String::from_utf8_lossy(&cd_data[entry_start..extra_start]).to_string();
        apply_zip64_extra(
            &cd_data[extra_start..extra_start + extra_len],
            &mut uncompressed_size,
            &mut compressed_size,
            &mut local_header_offset,
        )?;

        entries.push(ZipCentralDirectoryEntry {
            name,
            compressed_size,
            uncompressed_size,
            compression_method,
            local_header_offset,
        });

        parse_pos = entry_end;
    }

    Ok(entries)
}

fn apply_zip64_extra(
    extra: &[u8],
    uncompressed_size: &mut u64,
    compressed_size: &mut u64,
    local_header_offset: &mut u64,
) -> Result<()> {
    let mut pos = 0;
    while pos + 4 <= extra.len() {
        let header_id = u16::from_le_bytes(extra[pos..pos + 2].try_into()?);
        let data_size = u16::from_le_bytes(extra[pos + 2..pos + 4].try_into()?) as usize;
        pos += 4;
        if pos + data_size > extra.len() {
            anyhow::bail!("ZIP extra field exceeds available data");
        }

        if header_id == ZIP64_EXTRA_ID {
            let data = &extra[pos..pos + data_size];
            let mut offset = 0;
            if *uncompressed_size == ZIP32_MAX {
                *uncompressed_size = read_zip64_value(data, &mut offset)?;
            }
            if *compressed_size == ZIP32_MAX {
                *compressed_size = read_zip64_value(data, &mut offset)?;
            }
            if *local_header_offset == ZIP32_MAX {
                *local_header_offset = read_zip64_value(data, &mut offset)?;
            }
            return Ok(());
        }

        pos += data_size;
    }

    if *uncompressed_size == ZIP32_MAX
        || *compressed_size == ZIP32_MAX
        || *local_header_offset == ZIP32_MAX
    {
        anyhow::bail!("ZIP64 extra field is missing required size data");
    }

    Ok(())
}

fn read_zip64_value(data: &[u8], offset: &mut usize) -> Result<u64> {
    if *offset + 8 > data.len() {
        anyhow::bail!("ZIP64 extra field is truncated");
    }
    let value = u64::from_le_bytes(data[*offset..*offset + 8].try_into()?);
    *offset += 8;
    Ok(value)
}

#[cfg(feature = "remote_zip")]
async fn to_factory_entry(
    reader: &HttpPayloadReader,
    entry: &ZipCentralDirectoryEntry,
    window: ZipWindow,
) -> Result<FactoryImageEntry> {
    let data_offset = data_offset_for_entry(reader, window, entry).await?;
    Ok(FactoryImageEntry {
        name: entry.name.clone(),
        partition_name: partition_name_from_image_entry(&entry.name),
        data_offset,
        compressed_size: entry.compressed_size,
        uncompressed_size: entry.uncompressed_size,
        compression_method: entry.compression_method,
    })
}

#[cfg(feature = "remote_zip")]
async fn data_offset_for_entry(
    reader: &HttpPayloadReader,
    window: ZipWindow,
    entry: &ZipCentralDirectoryEntry,
) -> Result<u64> {
    let local_header_offset = window.base_offset + entry.local_header_offset;
    let local_header = reader.read_range(local_header_offset, 30).await?;
    let local_sig = u32::from_le_bytes(local_header[0..4].try_into()?);
    if local_sig != LOCAL_SIG {
        anyhow::bail!("invalid local file header at offset {}", local_header_offset);
    }

    let filename_len = u16::from_le_bytes(local_header[26..28].try_into()?) as u64;
    let extra_len = u16::from_le_bytes(local_header[28..30].try_into()?) as u64;
    Ok(local_header_offset + 30 + filename_len + extra_len)
}

fn is_image_entry(name: &str) -> bool {
    basename(name).is_some_and(|base| base.to_ascii_lowercase().ends_with(".img"))
}

fn image_zip_basename(name: &str) -> Option<&str> {
    let base = basename(name)?;
    let lower = base.to_ascii_lowercase();
    if lower.starts_with("image-") && lower.ends_with(".zip") { Some(base) } else { None }
}

fn basename(path: &str) -> Option<&str> {
    path.rsplit(['/', '\\']).find(|part| !part.is_empty())
}

fn partition_name_from_image_entry(name: &str) -> String {
    let base = basename(name).unwrap_or(name);
    if base.len() >= 4 && base[base.len() - 4..].eq_ignore_ascii_case(".img") {
        base[..base.len() - 4].to_string()
    } else {
        base.to_string()
    }
}

fn dedupe_partition_names(entries: &mut [FactoryImageEntry]) {
    let mut counts = HashMap::<String, usize>::new();
    for entry in entries.iter_mut() {
        let count = counts.entry(entry.partition_name.clone()).or_default();
        if *count > 0 {
            entry.partition_name = format!("{}-{}", entry.partition_name, *count + 1);
        }
        *count += 1;
    }
}

fn safe_image_file_name(partition_name: &str) -> String {
    crate::helpers::safe_image_file_name(partition_name)
}

/// Extract one factory `.img` using async HTTP ranges.
///
/// Uses async `read_range` instead of `reqwest::blocking` so the Tauri/Tokio
/// runtime is not starved (cancel IPC + invoke completion stay responsive).
/// Pattern matches rhythmcache/payload-dumper remote streaming: range chunks
/// with cooperative cancel between requests.
#[cfg(feature = "remote_zip")]
async fn extract_factory_entry(
    reader: &HttpPayloadReader,
    entry: &FactoryImageEntry,
    output_path: &Path,
    app_handle: Option<&AppHandle>,
    cancel_token: Option<&CancellationToken>,
) -> Result<()> {
    if entry.compression_method != 0 && entry.compression_method != 8 {
        anyhow::bail!(
            "unsupported ZIP compression method {} for {}",
            entry.compression_method,
            entry.name
        );
    }

    let mut writer = NonTemporalWriter::new(output_path, entry.uncompressed_size)?;
    let mut written = 0u64;
    emit_progress(app_handle, &entry.partition_name, written, entry.uncompressed_size, false);

    if entry.compression_method == 0 {
        let mut offset = 0u64;
        while offset < entry.compressed_size {
            ensure_not_cancelled(cancel_token)?;
            let chunk_len = (entry.compressed_size - offset).min(RANGE_CHUNK_SIZE);
            let chunk = reader
                .read_range_cancellable(entry.data_offset + offset, chunk_len, cancel_token)
                .await?;
            writer.write_all(&chunk)?;
            offset += chunk_len;
            written += chunk.len() as u64;
            emit_progress(
                app_handle,
                &entry.partition_name,
                written,
                entry.uncompressed_size,
                false,
            );
        }
    } else {
        // Fetch compressed bytes with async ranges, then inflate locally.
        // Avoids blocking reqwest on the async worker (Tokio deadlock risk).
        let mut compressed = Vec::new();
        if entry.compressed_size > 0 {
            compressed
                .try_reserve(usize::try_from(entry.compressed_size).unwrap_or(COPY_BUF_SIZE))
                .map_err(|error| anyhow!("failed to allocate compressed buffer: {error}"))?;
        }
        let mut offset = 0u64;
        while offset < entry.compressed_size {
            ensure_not_cancelled(cancel_token)?;
            let chunk_len = (entry.compressed_size - offset).min(RANGE_CHUNK_SIZE);
            let chunk = reader
                .read_range_cancellable(entry.data_offset + offset, chunk_len, cancel_token)
                .await?;
            compressed.extend_from_slice(&chunk);
            offset += chunk_len;
        }

        let mut decoder = DeflateDecoder::new(compressed.as_slice());
        let mut buf = vec![0u8; COPY_BUF_SIZE];
        while written < entry.uncompressed_size {
            ensure_not_cancelled(cancel_token)?;
            let remaining = (entry.uncompressed_size - written) as usize;
            let read_len = buf.len().min(remaining);
            let n = decoder.read(&mut buf[..read_len])?;
            if n == 0 {
                anyhow::bail!(
                    "compressed stream ended after {} bytes, expected {}",
                    written,
                    entry.uncompressed_size
                );
            }
            writer.write_all(&buf[..n])?;
            written += n as u64;
            emit_progress(
                app_handle,
                &entry.partition_name,
                written,
                entry.uncompressed_size,
                false,
            );
        }
    }

    writer.flush()?;
    emit_progress(
        app_handle,
        &entry.partition_name,
        entry.uncompressed_size,
        entry.uncompressed_size,
        true,
    );
    Ok(())
}

fn ensure_not_cancelled(cancel_token: Option<&CancellationToken>) -> Result<()> {
    if cancel_token.is_some_and(CancellationToken::is_cancelled) {
        anyhow::bail!("extraction cancelled");
    }
    Ok(())
}

#[cfg(feature = "remote_zip")]
fn emit_progress(
    app_handle: Option<&AppHandle>,
    partition_name: &str,
    current: u64,
    total: u64,
    completed: bool,
) {
    if let Some(handle) = app_handle {
        let _ = handle.emit(
            "payload:progress",
            serde_json::json!({
                "partitionName": partition_name,
                "current": current,
                "total": total,
                "completed": completed,
            }),
        );
    }
}

pub(super) fn find_eocd(data: &[u8]) -> Option<usize> {
    if data.len() < 4 {
        return None;
    }

    let start = data.len().saturating_sub(EOCD_MAX_SIZE);
    for i in (start..=data.len() - 4).rev() {
        let sig = u32::from_le_bytes([data[i], data[i + 1], data[i + 2], data[i + 3]]);
        if sig == EOCD_SIG {
            return Some(i);
        }
    }
    None
}
