use crate::debloat::{
    actions::apply_package_actions,
    backup::{
        create_backup, list_backups, load_backup, load_device_settings, save_device_settings,
        BackupSummary, PackageSnapshot, PerDeviceSettings,
    },
    lists::load_uad_lists,
    sync::{build_uad_map, get_android_sdk, get_device_id, sync_device_packages},
    DebloatActionResult, DebloatListStatus, DebloatPackageRow,
};
use crate::CmdResult;
use log::info;
use tauri::AppHandle;

/// Load UAD lists from remote/cache/bundled and return status.
/// This also performs the initial device package sync.
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
/// `user` is the Android user ID (0 = main user).
#[tauri::command]
pub async fn debloat_packages(
    app: AppHandle,
    packages: Vec<String>,
    action: String,
    user: u32,
) -> CmdResult<Vec<DebloatActionResult>> {
    info!("debloat_packages: action={} packages={} user={}", action, packages.len(), user);
    tokio::task::spawn_blocking(move || {
        let sdk = get_android_sdk(&app);
        apply_package_actions(&app, &packages, &action, sdk, user)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Create a backup snapshot of current package states for the connected device.
#[tauri::command]
pub async fn create_debloat_backup(
    app: AppHandle,
    packages: Vec<PackageSnapshot>,
) -> CmdResult<BackupSummary> {
    tokio::task::spawn_blocking(move || {
        let device_id = get_device_id(&app);
        let sdk = get_android_sdk(&app);
        create_backup(&app, &device_id, sdk, packages)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// List all available backups for the connected device.
#[tauri::command]
pub async fn list_debloat_backups(app: AppHandle) -> CmdResult<Vec<BackupSummary>> {
    tokio::task::spawn_blocking(move || {
        let device_id = get_device_id(&app);
        Ok(list_backups(&app, &device_id))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Restore a previously created backup by file name.
/// Returns the list of actions applied.
#[tauri::command]
pub async fn restore_debloat_backup(
    app: AppHandle,
    file_name: String,
) -> CmdResult<Vec<DebloatActionResult>> {
    tokio::task::spawn_blocking(move || {
        let device_id = get_device_id(&app);
        let backup = load_backup(&app, &device_id, &file_name)?;
        let sdk = get_android_sdk(&app);

        // For each package in the backup, apply the stored state
        let mut results = Vec::new();
        for snapshot in &backup.packages {
            let action_str = match snapshot.state {
                crate::debloat::PackageState::Enabled => "restore",
                crate::debloat::PackageState::Disabled => "disable",
                crate::debloat::PackageState::Uninstalled => "uninstall",
            };
            let mut r = apply_package_actions(&app, &[snapshot.name.clone()], action_str, sdk, 0)?;
            results.append(&mut r);
        }
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get per-device settings for the connected device.
#[tauri::command]
pub async fn get_debloat_device_settings(app: AppHandle) -> CmdResult<PerDeviceSettings> {
    tokio::task::spawn_blocking(move || {
        let device_id = get_device_id(&app);
        Ok(load_device_settings(&app, &device_id))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Save per-device settings for the connected device.
#[tauri::command]
pub async fn save_debloat_device_settings(
    app: AppHandle,
    settings: PerDeviceSettings,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || {
        let device_id = get_device_id(&app);
        save_device_settings(&app, &device_id, &settings)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get the Android SDK version of the connected device.
#[tauri::command]
pub async fn get_device_sdk(app: AppHandle) -> CmdResult<u32> {
    tokio::task::spawn_blocking(move || Ok(get_android_sdk(&app)))
        .await
        .map_err(|e| e.to_string())?
}
