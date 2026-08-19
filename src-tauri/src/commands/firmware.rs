use std::str::FromStr;
use tauri::{AppHandle, State};

use crate::CmdResult;
use crate::firmware::{FirmwareBrand, FirmwareDeviceModel, FirmwareHubService};

#[tauri::command]
pub async fn get_firmware_catalog(
    #[allow(unused_variables)] app: AppHandle,
    service: State<'_, FirmwareHubService>,
    brand: Option<String>,
    force_refresh: Option<bool>,
) -> CmdResult<Vec<FirmwareDeviceModel>> {
    let parsed_brand = match &brand {
        Some(b) if !b.trim().is_empty() => Some(
            FirmwareBrand::from_str(b.trim()).map_err(|e| format!("Invalid brand '{b}': {e}"))?,
        ),
        _ => None,
    };

    service
        .get_devices(parsed_brand, force_refresh.unwrap_or(false))
        .await
        .map_err(|e| format!("Failed to retrieve firmware catalog: {e}"))
}

#[tauri::command]
pub async fn refresh_firmware_catalog(
    #[allow(unused_variables)] app: AppHandle,
    service: State<'_, FirmwareHubService>,
    brand: Option<String>,
) -> CmdResult<Vec<FirmwareDeviceModel>> {
    let parsed_brand = match &brand {
        Some(b) if !b.trim().is_empty() => Some(
            FirmwareBrand::from_str(b.trim()).map_err(|e| format!("Invalid brand '{b}': {e}"))?,
        ),
        _ => None,
    };

    service
        .get_devices(parsed_brand, true)
        .await
        .map_err(|e| format!("Failed to refresh firmware catalog: {e}"))
}

#[tauri::command]
pub async fn get_supported_firmware_brands() -> CmdResult<Vec<String>> {
    Ok(vec![
        FirmwareBrand::Google.as_str().to_string(),
        FirmwareBrand::Nothing.as_str().to_string(),
        FirmwareBrand::Xiaomi.as_str().to_string(),
        FirmwareBrand::OnePlus.as_str().to_string(),
        FirmwareBrand::Samsung.as_str().to_string(),
    ])
}

#[tauri::command]
pub async fn clear_firmware_cache(
    service: State<'_, FirmwareHubService>,
    brand: Option<String>,
) -> CmdResult<()> {
    match &brand {
        Some(b) if !b.trim().is_empty() => {
            let parsed_brand = FirmwareBrand::from_str(b.trim())
                .map_err(|e| format!("Invalid brand '{b}': {e}"))?;
            service
                .cache()
                .invalidate(parsed_brand)
                .await
                .map_err(|e| format!("Failed to clear cache for brand '{b}': {e}"))?;
        }
        _ => {
            service
                .clear_cache()
                .await
                .map_err(|e| format!("Failed to clear firmware cache: {e}"))?;
        }
    }
    Ok(())
}
