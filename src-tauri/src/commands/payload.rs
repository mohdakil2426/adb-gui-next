use crate::CmdResult;
use crate::payload::cancel::CancellationToken;
use crate::payload::ops;
use crate::payload::{
    self, ExtractPayloadResult, PartitionDetail, PayloadCache, PayloadDiagnostics,
    RemotePayloadMetadata,
};
use log::{error, info};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, State};

use serde::{Deserialize, Serialize};

/// Information about a remote payload file obtained via HEAD request.
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayloadExtractionPreset {
    pub id: String,
    pub name: String,
    pub badge: String,
    pub description: String,
    pub category: String,
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
    cancel_token_id: Option<String>,
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

    // Resolve cancellation token if provided. A non-None ID must parse and exist.
    let (parsed_token_id, cancel_token) = if let Some(id) = cancel_token_id.as_ref() {
        let parsed =
            id.parse::<usize>().map_err(|_| "Invalid or unknown cancellation token".to_string())?;
        let registry = TOKEN_REGISTRY.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });
        let token = registry
            .get(&parsed)
            .cloned()
            .ok_or_else(|| "Invalid or unknown cancellation token".to_string())?;
        (Some(parsed), Some(token))
    } else {
        (None, None)
    };

    // Always drop registry entry when the command finishes (success, error, or cancel).
    struct TokenGuard(Option<usize>);
    impl Drop for TokenGuard {
        fn drop(&mut self) {
            let Some(id) = self.0.take() else {
                return;
            };
            if let Ok(mut registry) = TOKEN_REGISTRY.lock() {
                registry.remove(&id);
            }
        }
    }
    let _token_guard = TokenGuard(parsed_token_id);

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
                    cancel_token.as_ref(),
                )
                .await
            } else {
                payload::extract_remote_direct(
                    payload_path.to_string(),
                    output_dir.as_deref(),
                    &selected_partitions,
                    Some(app),
                    cancel_token.as_ref(),
                )
                .await
            };

            return match result {
                Ok(result) => {
                    if result.success {
                        info!(
                            "Remote extraction completed: {} files",
                            result.extracted_files.len()
                        );
                    } else {
                        info!(
                            "Remote extraction ended: {} files, error={:?}",
                            result.extracted_files.len(),
                            result.error
                        );
                    }
                    Ok(result)
                }
                Err(e) => {
                    error!("Remote extraction failed: {}", e);
                    let message = e.to_string();
                    let cancelled = message.to_ascii_lowercase().contains("cancelled");
                    Ok(ExtractPayloadResult {
                        success: false,
                        output_dir: String::new(),
                        extracted_files: Vec::new(),
                        error: Some(if cancelled {
                            "extraction cancelled".to_string()
                        } else {
                            message
                        }),
                        stats: None,
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
            stats: None,
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
                cancel_token.as_ref(),
            )
        });

        return match result {
            Ok(result) => {
                info!("OPS extraction completed: {} files", result.extracted_files.len());
                Ok(result)
            }
            Err(e) => {
                error!("OPS extraction failed: {}", e);
                let message = e.to_string();
                let cancelled = message.to_ascii_lowercase().contains("cancelled");
                Ok(ExtractPayloadResult {
                    success: false,
                    output_dir: String::new(),
                    extracted_files: Vec::new(),
                    error: Some(if cancelled {
                        "extraction cancelled".to_string()
                    } else {
                        message
                    }),
                    stats: None,
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
            payload::VerifyMode::default(),
            |_, _, _, _| {},
            cancel_token.as_ref(),
            None,
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
                stats: None,
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
#[tauri::command]
pub async fn check_remote_payload(url: String) -> CmdResult<RemotePayloadInfo> {
    info!("Checking remote payload URL: {}", url.trim());
    let reader = payload::open_http_reader(url.trim()).await.map_err(|e| e.to_string())?;

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
#[tauri::command]
pub async fn list_remote_payload_partitions(
    app: AppHandle,
    url: String,
) -> CmdResult<Vec<PartitionDetail>> {
    info!("Listing remote payload partitions from {}", url.trim());
    payload::list_remote_payload_partitions(url.trim().to_string(), Some(app))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extract_delta_payload(
    payload_cache: State<'_, PayloadCache>,
    payload_path: String,
    source_dir: String,
    output_dir: String,
    selected_partitions: Vec<String>,
    cancel_token_id: Option<String>,
) -> CmdResult<ExtractPayloadResult> {
    info!(
        "Extracting delta payload from {} with source {} (partitions: {})",
        payload_path,
        source_dir,
        selected_partitions.join(", ")
    );

    let source_path = std::path::Path::new(&source_dir);
    if !source_path.exists() {
        return Ok(ExtractPayloadResult {
            success: false,
            output_dir: String::new(),
            extracted_files: Vec::new(),
            error: Some(format!("Source directory not found: {}", source_dir)),
            stats: None,
        });
    }

    let output = if output_dir.trim().is_empty() {
        None
    } else {
        let dir = PathBuf::from(output_dir.trim());
        // Ensure the output directory exists, then canonicalize to prevent
        // path traversal (e.g., writing outside the intended directory).
        std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create output dir: {e}"))?;
        Some(dir.canonicalize().map_err(|e| format!("Cannot resolve output dir: {e}"))?)
    };

    // Resolve cancellation token if provided. A non-None ID must parse and exist.
    let (parsed_token_id, cancel_token) = if let Some(id) = cancel_token_id.as_ref() {
        let parsed =
            id.parse::<usize>().map_err(|_| "Invalid or unknown cancellation token".to_string())?;
        let registry = TOKEN_REGISTRY.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });
        let token = registry
            .get(&parsed)
            .cloned()
            .ok_or_else(|| "Invalid or unknown cancellation token".to_string())?;
        (Some(parsed), Some(token))
    } else {
        (None, None)
    };

    // Always drop registry entry when the command finishes (success, error, or cancel).
    struct TokenGuard(Option<usize>);
    impl Drop for TokenGuard {
        fn drop(&mut self) {
            let Some(id) = self.0.take() else {
                return;
            };
            if let Ok(mut registry) = TOKEN_REGISTRY.lock() {
                registry.remove(&id);
            }
        }
    }
    let _token_guard = TokenGuard(parsed_token_id);

    // Use the managed cache, never a per-call `PayloadCache::default()`: a throwaway
    // cache is dropped with its multi-GB temp extraction still on disk and no one
    // left holding a handle to clean it up.
    let result = tokio::task::block_in_place(|| {
        payload::extract_payload(
            std::path::Path::new(&payload_path),
            output.as_deref(),
            &selected_partitions,
            &payload_cache,
            None,
            payload::VerifyMode::default(),
            |_, _, _, _| {},
            cancel_token.as_ref(),
            Some(source_path),
        )
    });

    match result {
        Ok(r) => {
            info!(
                "Delta payload extraction completed: {} files in {}",
                r.extracted_files.len(),
                r.output_dir
            );
            Ok(r)
        }
        Err(e) => {
            error!("Delta payload extraction failed: {}", e);
            let detail = e.to_string();
            let msg = if detail.to_ascii_lowercase().contains("not implemented")
                || detail.to_ascii_lowercase().contains("stub")
            {
                format!(
                    "Delta OTA extract is limited in this build (incremental/source-copy path incomplete). \
                     Prefer a full OTA payload.bin when possible. Detail: {detail}"
                )
            } else {
                detail
            };
            Ok(ExtractPayloadResult {
                success: false,
                output_dir: String::new(),
                extracted_files: Vec::new(),
                error: Some(msg),
                stats: None,
            })
        }
    }
}

#[tauri::command]
pub async fn diagnose_payload(payload_path: String) -> CmdResult<PayloadDiagnostics> {
    info!("Diagnosing payload file: {}", payload_path.trim());
    let path = std::path::Path::new(payload_path.trim());

    if !path.exists() {
        return Err(format!("File not found: {}", payload_path.trim()));
    }

    if ops::extractor::should_use_ops_pipeline(path) {
        return tokio::task::block_in_place(|| {
            diagnose_ops_payload(path).map_err(|error| error.to_string())
        });
    }

    tokio::task::block_in_place(|| {
        payload::diagnose_payload_file(path).map_err(|error| error.to_string())
    })
}

fn diagnose_ops_payload(path: &std::path::Path) -> anyhow::Result<PayloadDiagnostics> {
    use crate::payload::ops::detect::{FirmwareFormat, detect_format};
    use crate::payload::ops::{OpsPartitionEntry, list_ops_partitions};

    let mmap = crate::payload::open_mmap(path)?;
    let format = detect_format(&mmap)?;

    let format_label = match format {
        FirmwareFormat::Ops => "OPS",
        FirmwareFormat::OfpQualcomm => "OFP (Qualcomm)",
        FirmwareFormat::OfpMediaTek => "OFP (MediaTek)",
        FirmwareFormat::ZipOfp => "OFP (ZIP)",
        FirmwareFormat::PayloadBin => "CrAU",
    };

    let partitions = list_ops_partitions(path)?;
    let partition_count = partitions.len();

    let mut has_sha256_hashes = false;
    let mut is_sparse = false;
    let warnings: Vec<String> = Vec::new();

    let partition_details: Vec<OpsPartitionEntry> = match format {
        FirmwareFormat::Ops => {
            let (parts, _, _) = crate::payload::ops::ops_parser::parse_ops(&mmap)?;
            for p in &parts {
                if !p.sha256.is_empty() {
                    has_sha256_hashes = true;
                }
                if p.sparse {
                    is_sparse = true;
                }
            }
            parts
        }
        FirmwareFormat::OfpQualcomm => {
            let (parts, _, _) = crate::payload::ops::ofp_qc::parse_ofp_qc(&mmap)?;
            for p in &parts {
                if !p.sha256.is_empty() {
                    has_sha256_hashes = true;
                }
                if p.sparse {
                    is_sparse = true;
                }
            }
            parts
        }
        FirmwareFormat::OfpMediaTek => {
            let (parts, _, _) = crate::payload::ops::ofp_mtk::parse_ofp_mtk(&mmap)?;
            for p in &parts {
                if !p.sha256.is_empty() {
                    has_sha256_hashes = true;
                }
                if p.sparse {
                    is_sparse = true;
                }
            }
            parts
        }
        _ => Vec::new(),
    };

    let total_operations = partition_details.len();
    let manifest_info = serde_json::json!({
        "format": format_label,
        "partitionCount": partition_count,
        "hasSha256": has_sha256_hashes,
        "isSparse": is_sparse,
    })
    .to_string();

    Ok(PayloadDiagnostics {
        format: format_label.to_string(),
        partition_count,
        total_operations,
        compression_types: vec![],
        has_sha256_hashes,
        is_sparse,
        warnings,
        manifest_info,
    })
}

// =============================================================================
// Cancellation Token Management
// =============================================================================

static TOKEN_COUNTER: AtomicUsize = AtomicUsize::new(0);
static TOKEN_REGISTRY: LazyLock<Mutex<HashMap<usize, CancellationToken>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub fn create_cancellation_token() -> String {
    let token = CancellationToken::new();
    let id = TOKEN_COUNTER.fetch_add(1, Ordering::Relaxed);
    let mut registry = TOKEN_REGISTRY.lock().unwrap_or_else(|e| {
        log::error!("Lock poisoned, recovering: {}", e);
        e.into_inner()
    });
    registry.insert(id, token);
    format!("{}", id)
}

#[tauri::command]
pub fn cancel_extraction(token_id: String) -> Result<(), String> {
    let id: usize = token_id.parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
    let registry = TOKEN_REGISTRY.lock().unwrap_or_else(|e| {
        log::error!("Lock poisoned, recovering: {}", e);
        e.into_inner()
    });
    if let Some(token) = registry.get(&id) {
        token.cancel();
        Ok(())
    } else {
        Err("Token not found".to_string())
    }
}

#[tauri::command]
pub async fn compute_partition_file_sha256(file_path: String) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || {
        let path = std::path::Path::new(&file_path);
        if !path.exists() {
            return Err(format!("Partition file does not exist: {file_path}"));
        }
        let digest = crate::payload::verify::compute_file_sha256(path)
            .map_err(|e| format!("Failed to compute SHA-256 for {file_path}: {e}"))?;
        Ok(hex::encode(digest))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_extraction_presets() -> Vec<PayloadExtractionPreset> {
    vec![
        PayloadExtractionPreset {
            id: "root-kit".into(),
            name: "Root Kit".into(),
            badge: "Root & Recovery".into(),
            description: "Kernel, ramdisk & Android Verified Boot metadata (boot, init_boot, recovery, vbmeta)".into(),
            category: "boot".into(),
        },
        PayloadExtractionPreset {
            id: "system-vendor".into(),
            name: "System & Vendor".into(),
            badge: "Dynamic OS".into(),
            description: "Core Android OS, vendor drivers & product overlays (system, vendor, product, system_ext)".into(),
            category: "system".into(),
        },
        PayloadExtractionPreset {
            id: "modem-radio".into(),
            name: "Modem & Radio".into(),
            badge: "Baseband".into(),
            description: "Baseband radio, cellular modem, DSP & bootloaders (modem, radio, dsp, bluetooth)".into(),
            category: "modem".into(),
        },
        PayloadExtractionPreset {
            id: "full-flash".into(),
            name: "Full Flash Image".into(),
            badge: "Full Image".into(),
            description: "All partitions inside payload archive for complete device restoration".into(),
            category: "all".into(),
        },
    ]
}
