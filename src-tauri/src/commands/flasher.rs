use crate::CmdResult;
use crate::flasher::{BatchFlashItem, FlasherVitalsResult, PartitionTargetInfo};
use std::path::Path;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_flasher_vitals(
    app: AppHandle,
    serial: Option<String>,
) -> CmdResult<FlasherVitalsResult> {
    tokio::task::spawn_blocking(move || crate::flasher::get_flasher_vitals_sync(&app, serial))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn inspect_partition_image(file_path: String) -> CmdResult<PartitionTargetInfo> {
    let clean = file_path.trim().to_string();
    if clean.is_empty() {
        return Err("Image file path cannot be empty.".into());
    }
    tokio::task::spawn_blocking(move || crate::flasher::inspect_partition_image(Path::new(&clean)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn flash_partition_batch(
    app: AppHandle,
    serial: Option<String>,
    items: Vec<BatchFlashItem>,
) -> CmdResult<()> {
    crate::flasher::flash_partition_batch(app, serial, items).await
}

#[tauri::command]
pub async fn sideload_package_stream(
    app: AppHandle,
    serial: Option<String>,
    zip_path: String,
) -> CmdResult<()> {
    crate::flasher::sideload_package_stream(app, serial, zip_path).await
}

#[tauri::command]
pub async fn erase_partition(
    app: AppHandle,
    serial: Option<String>,
    partition: String,
    confirm_phrase: String,
) -> CmdResult<()> {
    crate::flasher::erase_partition(app, serial, partition, confirm_phrase).await
}
