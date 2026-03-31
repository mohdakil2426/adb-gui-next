//! Remote payload loading for HTTP URLs.
//!
//! Downloads payload.bin from remote URLs to temp file, then uses existing extraction.
//! Supports HTTP range requests for efficient partial downloads.

use super::chromeos_update_engine::DeltaArchiveManifest;
use super::http::HttpPayloadReader;
use super::parser::{LoadedPayload, parse_header};
use anyhow::Result;
use memmap2::Mmap;
use prost::Message;
use std::fs::File;
use std::io::Write;
use std::sync::Arc;
use tempfile::NamedTempFile;

/// Progress callback for downloads.
pub type DownloadProgress = Box<dyn Fn(u64, u64) + Send + Sync>;

/// Download payload from URL to temp file and parse.
///
/// This function downloads the entire payload from a URL, then parses it
/// using the same memory-mapped approach as local files.
///
/// # Arguments
/// * `url` — URL to the payload.bin or OTA ZIP file
/// * `progress` — Optional callback for download progress (downloaded_bytes, total_bytes)
///
/// # Returns
/// A `LoadedPayload` ready for extraction, or an error.
pub async fn load_remote_payload(
    url: String,
    progress: Option<DownloadProgress>,
) -> Result<LoadedPayload> {
    let reader = HttpPayloadReader::new(url).await?;
    let content_length = reader.content_length();

    // Create temp file for payload
    let mut temp = NamedTempFile::new()?;
    let temp_path = temp.path().to_path_buf();

    // Download in chunks with progress
    let chunk_size = 1024 * 1024; // 1 MB chunks
    let mut downloaded = 0u64;

    while downloaded < content_length {
        let chunk_end = (downloaded + chunk_size as u64).min(content_length);
        let chunk_len = chunk_end - downloaded;

        let data = reader.read_range(downloaded, chunk_len).await?;
        temp.as_file_mut().write_all(&data)?;

        downloaded = chunk_end;
        if let Some(ref cb) = progress {
            cb(downloaded, content_length);
        }
    }

    temp.flush()?;

    // Parse using existing logic
    let file = File::open(&temp_path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    let mmap = Arc::new(mmap);

    // Parse header and manifest
    let (manifest_bytes, data_offset) = parse_header(&mmap)?;
    let manifest = DeltaArchiveManifest::decode(&manifest_bytes[..])?;

    // Keep temp file alive via mmap
    std::mem::forget(temp);

    Ok(LoadedPayload { mmap, manifest, data_offset })
}

/// Load a remote payload and return partition details.
///
/// Downloads the payload manifest and returns partition information
/// without extracting the full payload.
pub async fn list_remote_payload_partitions(
    url: String,
) -> Result<Vec<super::extractor::PartitionDetail>> {
    let payload = load_remote_payload(url, None).await?;

    Ok(payload
        .manifest
        .partitions
        .iter()
        .map(|p| super::extractor::PartitionDetail {
            name: p.partition_name.clone(),
            size: p.new_partition_info.as_ref().and_then(|info| info.size).unwrap_or_default(),
        })
        .collect())
}
