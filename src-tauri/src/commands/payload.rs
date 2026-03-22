use crate::CmdResult;
use crate::payload::{self, ExtractPayloadResult, PartitionDetail, PayloadCache};
use log::{error, info};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

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
    match payload::extract_payload(
        Path::new(payload_path.trim()),
        output_dir.as_deref(),
        &selected_partitions,
        &payload_cache,
        |partition_name, current, total, completed| {
            let _ = app.emit(
                "payload:progress",
                serde_json::json!({
                    "partitionName": partition_name,
                    "current": current,
                    "total": total,
                    "completed": completed,
                }),
            );
        },
    ) {
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
pub fn list_payload_partitions(
    payload_cache: State<PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<String>> {
    info!("Listing payload partitions from {}", payload_path.trim());
    payload::list_payload_partitions(Path::new(payload_path.trim()), &payload_cache)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_payload_partitions_with_details(
    payload_cache: State<PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<PartitionDetail>> {
    info!("Listing payload partitions with details from {}", payload_path.trim());
    payload::list_payload_partitions_with_details(Path::new(payload_path.trim()), &payload_cache)
        .map_err(|error| error.to_string())
}
