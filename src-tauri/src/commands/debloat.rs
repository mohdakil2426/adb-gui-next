use crate::CmdResult;
use crate::debloat::{
    DebloatActionResult, DebloatListStatus, DebloatPackageRow,
    actions::apply_package_actions,
    backup::{
        BackupSummary, PackageSnapshot, PerDeviceSettings, create_backup, list_backups,
        load_backup, save_device_settings,
    },
    cache::DebloatCache,
    lists::load_uad_lists,
    sync::{
        build_uad_map, get_android_sdk, get_device_id, sync_device_packages, try_get_android_sdk,
    },
};
use log::info;
use tauri::AppHandle;

/// Combined response for all initial debloater data.
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatData {
    pub packages: Vec<DebloatPackageRow>,
    pub list_status: DebloatListStatus,
    pub settings: PerDeviceSettings,
    pub backups: Vec<BackupSummary>,
}

/// Get all debloater data in one call. Uses in-memory cache when available.
#[tauri::command]
pub async fn get_debloat_data(
    app: AppHandle,
    cache: tauri::State<'_, DebloatCache>,
) -> CmdResult<DebloatData> {
    // Resolve device first so cache entries cannot leak across serials.
    let device_id = tokio::task::spawn_blocking({
        let app = app.clone();
        move || get_device_id(&app)
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Some((packages, status)) = cache.get_packages(&device_id) {
        let settings = cache.get_settings(&device_id).unwrap_or_default();
        let backups = cache.get_backups(&device_id).unwrap_or_default();
        info!("debloat: cache hit for device {device_id}");
        return Ok(DebloatData { packages, list_status: status, settings, backups });
    }

    // Cache miss — load everything fresh
    info!("debloat: cache miss for device {device_id}, loading fresh data");
    load_debloat_data(&app, &cache, &device_id).await
}

/// Force refresh all debloater data (invalidates cache).
#[tauri::command]
pub async fn refresh_debloat_data(
    app: AppHandle,
    cache: tauri::State<'_, DebloatCache>,
) -> CmdResult<DebloatData> {
    cache.invalidate();
    info!("debloat: cache invalidated");

    let device_id = tokio::task::spawn_blocking({
        let app = app.clone();
        move || get_device_id(&app)
    })
    .await
    .map_err(|e| e.to_string())?;

    load_debloat_data(&app, &cache, &device_id).await
}

async fn load_debloat_data(
    app: &AppHandle,
    cache: &DebloatCache,
    device_id: &str,
) -> CmdResult<DebloatData> {
    // Load packages (sync_device_packages returns Vec<DebloatPackageRow>, load_uad_lists returns (Vec, DebloatListStatus))
    let packages = tokio::task::spawn_blocking({
        let app = app.clone();
        move || {
            let (uad_packages, _) = load_uad_lists(&app)?;
            let uad_map = build_uad_map(uad_packages);
            sync_device_packages(&app, &uad_map)
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    // Get list status
    let list_status = tokio::task::spawn_blocking({
        let app = app.clone();
        move || {
            let (_, status) = load_uad_lists(&app).unwrap_or((
                vec![],
                DebloatListStatus {
                    source: "error".to_string(),
                    last_updated: "unknown".to_string(),
                    total_entries: 0,
                },
            ));
            status
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    // Load settings
    let settings = tokio::task::spawn_blocking({
        let app = app.clone();
        let device_id = device_id.to_string();
        move || crate::debloat::backup::load_device_settings(&app, &device_id)
    })
    .await
    .map_err(|e| e.to_string())?;

    // Load backups
    let backups = tokio::task::spawn_blocking({
        let app = app.clone();
        let device_id = device_id.to_string();
        move || list_backups(&app, &device_id)
    })
    .await
    .map_err(|e| e.to_string())?;

    cache.set_packages(device_id, packages.clone(), list_status.clone());
    cache.set_settings(device_id, settings.clone());
    cache.set_backups(device_id, backups.clone());

    Ok(DebloatData { packages, list_status, settings, backups })
}

/// Load UAD lists from remote/cache/bundled and return status.
#[tauri::command]
pub async fn load_debloat_lists(app: AppHandle) -> CmdResult<DebloatListStatus> {
    tokio::task::spawn_blocking(move || {
        let (_, status) = load_uad_lists(&app)?;
        Ok(status)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get all system packages merged with UAD metadata for the connected device.
#[tauri::command]
pub async fn get_debloat_packages(app: AppHandle) -> CmdResult<Vec<DebloatPackageRow>> {
    tokio::task::spawn_blocking(move || {
        let (packages, _) = load_uad_lists(&app)?;
        let uad_map = build_uad_map(packages);
        sync_device_packages(&app, &uad_map)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Apply an action (uninstall | disable | restore) to a batch of packages.
#[tauri::command]
pub async fn debloat_packages(
    app: AppHandle,
    cache: tauri::State<'_, DebloatCache>,
    packages: Vec<String>,
    action: String,
    user: u32,
) -> CmdResult<Vec<DebloatActionResult>> {
    info!("debloat_packages: action={} packages={} user={}", action, packages.len(), user);
    let result = tokio::task::spawn_blocking(move || {
        let sdk = try_get_android_sdk(&app)?;
        apply_package_actions(&app, &packages, &action, sdk, user)
    })
    .await
    .map_err(|e| e.to_string())??;

    // Invalidate cache since package states changed
    cache.invalidate();

    Ok(result)
}

/// Create a backup snapshot of current package states.
#[tauri::command]
pub async fn create_debloat_backup(
    app: AppHandle,
    cache: tauri::State<'_, DebloatCache>,
    packages: Vec<PackageSnapshot>,
) -> CmdResult<BackupSummary> {
    let app_clone = app.clone();

    let result = tokio::task::spawn_blocking(move || {
        let device_id = get_device_id(&app_clone);
        let sdk = try_get_android_sdk(&app_clone)?;
        create_backup(&app_clone, &device_id, sdk, packages)
    })
    .await
    .map_err(|e| e.to_string())??;

    // Refresh backups cache for the same device
    let device_id = result.device_id.clone();
    let backups = tokio::task::spawn_blocking({
        let app = app.clone();
        let device_id = device_id.clone();
        move || list_backups(&app, &device_id)
    })
    .await
    .map_err(|e| e.to_string())?;
    cache.set_backups(&device_id, backups);

    Ok(result)
}

/// List all available backups for the connected device.
#[tauri::command]
pub async fn list_debloat_backups(app: AppHandle) -> CmdResult<Vec<BackupSummary>> {
    let device_id = get_device_id(&app);
    tokio::task::spawn_blocking(move || list_backups(&app, &device_id))
        .await
        .map_err(|e| e.to_string())
}

/// Restore a previously created backup by file name.
#[tauri::command]
pub async fn restore_debloat_backup(
    app: AppHandle,
    cache: tauri::State<'_, DebloatCache>,
    file_name: String,
) -> CmdResult<Vec<DebloatActionResult>> {
    let device_id = get_device_id(&app);

    let result = tokio::task::spawn_blocking({
        let file_name = file_name.clone();
        move || {
            let backup = load_backup(&app, &device_id, &file_name)?;
            let sdk = try_get_android_sdk(&app)?;

            let mut results = Vec::new();
            for snapshot in &backup.packages {
                let action_str = match snapshot.state {
                    crate::debloat::PackageState::Enabled => "restore",
                    crate::debloat::PackageState::Disabled => "disable",
                    crate::debloat::PackageState::Uninstalled => "uninstall",
                };
                let mut r = apply_package_actions(
                    &app,
                    std::slice::from_ref(&snapshot.name),
                    action_str,
                    sdk,
                    0,
                )?;
                results.append(&mut r);
            }
            Ok::<Vec<DebloatActionResult>, String>(results)
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    // Invalidate cache since package states changed
    cache.invalidate();

    Ok(result)
}

/// Get per-device settings for the connected device.
#[tauri::command]
pub async fn get_debloat_device_settings(app: AppHandle) -> CmdResult<PerDeviceSettings> {
    let device_id = get_device_id(&app);
    tokio::task::spawn_blocking(move || {
        crate::debloat::backup::load_device_settings(&app, &device_id)
    })
    .await
    .map_err(|e| e.to_string())
}

/// Save per-device settings for the connected device.
#[tauri::command]
pub async fn save_debloat_device_settings(
    app: AppHandle,
    cache: tauri::State<'_, DebloatCache>,
    settings: PerDeviceSettings,
) -> CmdResult<()> {
    let device_id = get_device_id(&app);

    tokio::task::spawn_blocking({
        let settings = settings.clone();
        let device_id = device_id.clone();
        move || save_device_settings(&app, &device_id, &settings)
    })
    .await
    .map_err(|e| e.to_string())??;

    // Update settings in cache
    cache.set_settings(&device_id, settings);

    Ok(())
}

/// Get the Android SDK version of the connected device.
#[tauri::command]
pub async fn get_device_sdk(app: AppHandle) -> CmdResult<u32> {
    let sdk = tokio::task::spawn_blocking(move || get_android_sdk(&app))
        .await
        .map_err(|e| e.to_string())?;
    Ok(sdk)
}
