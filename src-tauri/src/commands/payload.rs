use crate::CmdResult;
use crate::payload::ops;
use crate::payload::{
    self, ExtractPayloadResult, PartitionDetail, PayloadCache, RemotePayloadMetadata,
};
use log::{error, info};
use std::path::PathBuf;
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
    pub content_type: Option<String>,
    pub last_modified: Option<String>,
    pub server: Option<String>,
    pub etag: Option<String>,
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
    #[allow(unused_variables)] prefetch: Option<bool>,
) -> CmdResult<ExtractPayloadResult> {
    let payload_path = payload_path.trim();
    let output_dir = if output_dir.trim().is_empty() {
        None
    } else {
        let dir = PathBuf::from(output_dir.trim());
        // Ensure the output directory exists, then canonicalize to prevent
        // path traversal (e.g., writing outside the intended directory).
        std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create output dir: {e}"))?;
        Some(dir.canonicalize().map_err(|e| format!("Cannot resolve output dir: {e}"))?)
    };

    #[cfg(feature = "remote_zip")]
    {
        // Remote URL — route to dedicated remote extraction
        if payload_path.starts_with("http://") || payload_path.starts_with("https://") {
            let is_prefetch = prefetch.unwrap_or(false);
            info!(
                "Extracting from remote URL (prefetch={}): {} (partitions: {})",
                is_prefetch,
                payload_path,
                selected_partitions.join(", ")
            );

            let result = if is_prefetch {
                payload::extract_remote_prefetch(
                    payload_path.to_string(),
                    output_dir.as_deref(),
                    &selected_partitions,
                    Some(app),
                )
                .await
            } else {
                payload::extract_remote_direct(
                    payload_path.to_string(),
                    output_dir.as_deref(),
                    &selected_partitions,
                    Some(app),
                )
                .await
            };

            return match result {
                Ok(result) => {
                    info!("Remote extraction completed: {} files", result.extracted_files.len());
                    Ok(result)
                }
                Err(e) => {
                    error!("Remote extraction failed: {}", e);
                    Ok(ExtractPayloadResult {
                        success: false,
                        output_dir: String::new(),
                        extracted_files: Vec::new(),
                        error: Some(e.to_string()),
                    })
                }
            };
        }
    }

    // Local file path
    info!(
        "Extracting payload from {} (partitions: {})",
        payload_path,
        selected_partitions.join(", ")
    );

    // For local paths, validate and canonicalize before passing to extractor
    let local_path = std::path::Path::new(payload_path);
    if !local_path.exists() {
        return Ok(ExtractPayloadResult {
            success: false,
            output_dir: String::new(),
            extracted_files: Vec::new(),
            error: Some(format!("File not found: {payload_path}")),
        });
    }

    // Route OPS/OFP files to the dedicated pipeline
    if ops::extractor::should_use_ops_pipeline(local_path) {
        info!("Detected OPS/OFP file, using OPS extraction pipeline");
        let result = tokio::task::block_in_place(|| {
            ops::extract_ops_partitions(
                local_path,
                output_dir.as_deref(),
                &selected_partitions,
                Some(app),
                |_, _, _, _| {},
            )
        });

        return match result {
            Ok(result) => {
                info!("OPS extraction completed: {} files", result.extracted_files.len());
                Ok(result)
            }
            Err(e) => {
                error!("OPS extraction failed: {}", e);
                Ok(ExtractPayloadResult {
                    success: false,
                    output_dir: String::new(),
                    extracted_files: Vec::new(),
                    error: Some(e.to_string()),
                })
            }
        };
    }

    let result = tokio::task::block_in_place(|| {
        payload::extract_payload(
            local_path,
            output_dir.as_deref(),
            &selected_partitions,
            &payload_cache,
            Some(app),
            |_, _, _, _| {},
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
        Err(e) => {
            error!("Payload extraction failed: {}", e);
            Ok(ExtractPayloadResult {
                success: false,
                output_dir: String::new(),
                extracted_files: Vec::new(),
                error: Some(e.to_string()),
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
    let file_path = std::path::Path::new(&path);

    // Route OPS/OFP files to the dedicated pipeline
    if ops::extractor::should_use_ops_pipeline(file_path) {
        info!("Detected OPS/OFP file, using OPS partition listing");
        return tokio::task::block_in_place(|| {
            ops::list_ops_partitions(file_path).map_err(|error| error.to_string())
        });
    }

    tokio::task::block_in_place(|| {
        payload::list_payload_partitions_with_details(file_path, &payload_cache)
            .map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub async fn get_ops_metadata(path: String) -> CmdResult<ops::OpsMetadata> {
    info!("Getting OPS/OFP metadata from {}", path.trim());
    let file_path = std::path::Path::new(path.trim());
    tokio::task::block_in_place(|| {
        ops::extractor::get_ops_metadata(file_path).map_err(|error| error.to_string())
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
        content_type: reader.content_type().map(String::from),
        last_modified: reader.last_modified().map(String::from),
        server: reader.server().map(String::from),
        etag: reader.etag().map(String::from),
    })
}

/// Get full metadata (HTTP headers + ZIP structure + OTA manifest) for a remote payload.
#[cfg(feature = "remote_zip")]
#[tauri::command]
pub async fn get_remote_payload_metadata(url: String) -> CmdResult<RemotePayloadMetadata> {
    info!("Fetching remote payload metadata for: {}", url.trim());
    let metadata =
        payload::get_remote_payload_metadata(url.trim().to_string()).await.map_err(|e| {
            error!("Failed to fetch metadata: {}", e);
            e.to_string()
        })?;
    Ok(metadata)
}

/// List partitions from a remote payload URL.
#[cfg(feature = "remote_zip")]
#[tauri::command]
pub async fn list_remote_payload_partitions(url: String) -> CmdResult<Vec<PartitionDetail>> {
    info!("Listing remote payload partitions from {}", url.trim());
    payload::list_remote_payload_partitions(url.trim().to_string()).await.map_err(|e| e.to_string())
}
