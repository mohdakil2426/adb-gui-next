use crate::CmdResult;
use crate::payload::{self, ExtractPayloadResult, PartitionDetail, PayloadCache};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn cleanup_payload_cache(payload_cache: State<PayloadCache>) -> CmdResult<()> {
    payload_cache.cleanup().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn extract_payload(
    app: AppHandle,
    payload_cache: State<PayloadCache>,
    payload_path: String,
    output_dir: String,
    selected_partitions: Vec<String>,
) -> CmdResult<ExtractPayloadResult> {
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
        Ok(result) => Ok(result),
        Err(error) => Ok(ExtractPayloadResult {
            success: false,
            output_dir: String::new(),
            extracted_files: Vec::new(),
            error: Some(error.to_string()),
        }),
    }
}

#[tauri::command]
pub fn list_payload_partitions(
    payload_cache: State<PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<String>> {
    payload::list_payload_partitions(Path::new(payload_path.trim()), &payload_cache)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_payload_partitions_with_details(
    payload_cache: State<PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<PartitionDetail>> {
    payload::list_payload_partitions_with_details(Path::new(payload_path.trim()), &payload_cache)
        .map_err(|error| error.to_string())
}
