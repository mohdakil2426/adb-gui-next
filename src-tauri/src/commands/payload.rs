use crate::CmdResult;
use crate::payload::{self, ExtractPayloadResult, PartitionDetail, PayloadCache};
use log::{error, info};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

#[cfg(feature = "remote_zip")]
use serde::Serialize;

/// Information about a remote payload file obtained via HEAD request.
#[cfg(feature = "remote_zip")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePayloadInfo {
    pub content_length: u64,
    pub supports_ranges: bool,
}

#[tauri::command]
pub async fn cleanup_payload_cache(payload_cache: State<'_, PayloadCache>) -> CmdResult<()> {
    info!("Cleaning up payload cache");
    payload_cache.cleanup().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn extract_payload(
    app: AppHandle,
    payload_cache: State<'_, PayloadCache>,
    payload_path: String,
    output_dir: String,
    selected_partitions: Vec<String>,
) -> CmdResult<ExtractPayloadResult> {
    info!(
        "Extracting payload from {} (partitions: {})",
        payload_path.trim(),
        selected_partitions.join(", ")
    );
    let output_dir = (!output_dir.trim().is_empty()).then(|| PathBuf::from(output_dir.trim()));

    // Use `block_in_place` to run the synchronous extraction on the current async thread
    // without starving the Tokio runtime. This is preferred over `spawn_blocking` here
    // because `State<'_, PayloadCache>` does not have a `'static` bound.
    let result = tokio::task::block_in_place(|| {
        payload::extract_payload(
            Path::new(payload_path.trim()),
            output_dir.as_deref(),
            &selected_partitions,
            &payload_cache,
            Some(app),
            |_, _, _, _| {}, // Per-partition completion emitted via AppHandle inside threads
        )
    });

    match result {
        Ok(result) => {
            info!(
                "Payload extraction completed: {} files in {}",
                result.extracted_files.len(),
                result.output_dir
            );
            Ok(result)
        }
        Err(error) => {
            error!("Payload extraction failed: {}", error);
            Ok(ExtractPayloadResult {
                success: false,
                output_dir: String::new(),
                extracted_files: Vec::new(),
                error: Some(error.to_string()),
            })
        }
    }
}

#[tauri::command]
pub async fn list_payload_partitions(
    payload_cache: State<'_, PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<String>> {
    info!("Listing payload partitions from {}", payload_path.trim());
    let path = payload_path.trim().to_string();
    tokio::task::block_in_place(|| {
        payload::list_payload_partitions(std::path::Path::new(&path), &payload_cache)
            .map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub async fn list_payload_partitions_with_details(
    payload_cache: State<'_, PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<PartitionDetail>> {
    info!("Listing payload partitions with details from {}", payload_path.trim());
    let path = payload_path.trim().to_string();
    tokio::task::block_in_place(|| {
        payload::list_payload_partitions_with_details(std::path::Path::new(&path), &payload_cache)
            .map_err(|error| error.to_string())
    })
}

// =============================================================================
// Remote URL Payload Commands (feature: remote_zip)
// =============================================================================

/// Check if a remote URL supports HTTP range requests and get file size.
#[cfg(feature = "remote_zip")]
#[tauri::command]
pub async fn check_remote_payload(url: String) -> CmdResult<RemotePayloadInfo> {
    info!("Checking remote payload URL: {}", url.trim());
    let reader =
        payload::HttpPayloadReader::new(url.trim().to_string()).await.map_err(|e| e.to_string())?;

    Ok(RemotePayloadInfo {
        content_length: reader.content_length(),
        supports_ranges: reader.supports_ranges(),
    })
}

/// List partitions from a remote payload URL.
#[cfg(feature = "remote_zip")]
#[tauri::command]
pub async fn list_remote_payload_partitions(url: String) -> CmdResult<Vec<PartitionDetail>> {
    info!("Listing remote payload partitions from {}", url.trim());
    payload::list_remote_payload_partitions(url.trim().to_string()).await.map_err(|e| e.to_string())
}
