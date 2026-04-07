use crate::{
    CmdResult,
    emulator::{
        avd, backup,
        models::{
            AvdSummary, EmulatorLaunchOptions, RestorePlan, RootFinalizeRequest,
            RootFinalizeResult, RootPreparationRequest, RootPreparationResult,
        },
        root, runtime,
    },
};
use std::path::PathBuf;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_avds(app: AppHandle) -> CmdResult<Vec<AvdSummary>> {
    tokio::task::spawn_blocking(move || avd::list_avds(&app))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn launch_avd(
    app: AppHandle,
    avd_name: String,
    options: EmulatorLaunchOptions,
) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || runtime::launch_avd(&app, &avd_name, &options))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn stop_avd(app: AppHandle, serial: String) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || runtime::stop_avd(&app, &serial))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_avd_restore_plan(app: AppHandle, avd_name: String) -> CmdResult<RestorePlan> {
    tokio::task::spawn_blocking(move || {
        let avd = avd::list_avds(&app)?
            .into_iter()
            .find(|item| item.name == avd_name)
            .ok_or_else(|| format!("AVD not found: {avd_name}"))?;
        let ramdisk_path =
            avd.ramdisk_path.ok_or_else(|| format!("No ramdisk was resolved for {avd_name}"))?;
        Ok(backup::build_restore_plan(&avd_name, &[PathBuf::from(ramdisk_path)]))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn restore_avd_backups(app: AppHandle, avd_name: String) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || {
        let avd = avd::list_avds(&app)?
            .into_iter()
            .find(|item| item.name == avd_name)
            .ok_or_else(|| format!("AVD not found: {avd_name}"))?;
        let ramdisk_path =
            avd.ramdisk_path.ok_or_else(|| format!("No ramdisk was resolved for {avd_name}"))?;
        backup::restore_backups(&[PathBuf::from(ramdisk_path)])?;
        Ok(format!("Restored backups for {avd_name}"))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn prepare_avd_root(
    app: AppHandle,
    request: RootPreparationRequest,
) -> CmdResult<RootPreparationResult> {
    tokio::task::spawn_blocking(move || root::prepare_root(&app, &request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn finalize_avd_root(
    app: AppHandle,
    request: RootFinalizeRequest,
) -> CmdResult<RootFinalizeResult> {
    tokio::task::spawn_blocking(move || root::finalize_root(&app, &request))
        .await
        .map_err(|error| error.to_string())?
}
