use crate::{
    CmdResult,
    emulator::{
        avd, backup, magisk_download,
        models::{
            AvdSummary, EmulatorLaunchOptions, MagiskStableRelease, RestorePlan, RootAvdRequest,
            RootAvdResult, RootFinalizeRequest, RootFinalizeResult, RootPreparationRequest,
            RootPreparationResult, RootReadinessScan,
        },
        root, runtime,
    },
};
use std::path::PathBuf;
use tauri::AppHandle;

// ─── AVD management ───────────────────────────────────────────────────────────

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

// ─── Automated one-click root ─────────────────────────────────────────────────

/// Fetch the latest official stable Magisk release from the GitHub releases API.
/// Returns version, tag, download URL, file size, SHA-256 digest, and publish date.
#[tauri::command]
pub async fn fetch_magisk_stable_release() -> CmdResult<MagiskStableRelease> {
    tokio::task::spawn_blocking(magisk_download::fetch_magisk_stable_release)
        .await
        .map_err(|error| error.to_string())?
}

/// Root an AVD using the automated magiskboot pipeline.
/// Emits `root:progress` events during execution for live UI progress.
#[tauri::command]
pub async fn root_avd(app: AppHandle, request: RootAvdRequest) -> CmdResult<RootAvdResult> {
    tokio::task::spawn_blocking(move || root::root_avd_automated(&app, &request))
        .await
        .map_err(|error| error.to_string())?
}

/// Run the pre-flight readiness scan before starting the root wizard.
/// Returns a structured scan result with per-check statuses and a `can_proceed` flag.
#[tauri::command]
pub async fn scan_avd_root_readiness(
    app: AppHandle,
    avd_name: String,
    serial: Option<String>,
) -> CmdResult<RootReadinessScan> {
    tokio::task::spawn_blocking(move || {
        root::scan_avd_root_readiness(&app, &avd_name, serial.as_deref())
    })
    .await
    .map_err(|error| error.to_string())?
}

// ─── Legacy manual root (FAKEBOOTIMG) — kept as fallback ──────────────────────

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
