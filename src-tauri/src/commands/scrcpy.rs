use std::time::Duration;

use reqwest::Client;
use tauri::AppHandle;

use crate::CmdResult;
use crate::scrcpy::flags::ScrcpyLaunchOptions;
use crate::scrcpy::{
    ScrcpyActiveSessions, ScrcpyPresetsCatalog, ScrcpyStatus, active_sessions, fetch_latest_tag,
    get_presets_catalog, install_latest, launch, local_status, stop, uninstall_managed,
};

fn scrcpy_http_client() -> CmdResult<Client> {
    Client::builder()
        .user_agent(concat!("ADB-GUI-Next/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(600))
        .connect_timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scrcpy_status(app: AppHandle) -> CmdResult<ScrcpyStatus> {
    let client = scrcpy_http_client()?;
    let latest = fetch_latest_tag(&client).await.ok();
    Ok(local_status(&app, latest))
}

#[tauri::command]
pub async fn scrcpy_check_update(app: AppHandle) -> CmdResult<ScrcpyStatus> {
    let client = scrcpy_http_client()?;
    let latest = fetch_latest_tag(&client).await?;
    Ok(local_status(&app, Some(latest)))
}

#[tauri::command]
pub async fn scrcpy_install(app: AppHandle) -> CmdResult<ScrcpyStatus> {
    let client = scrcpy_http_client()?;
    install_latest(app, client).await
}

#[tauri::command]
pub async fn scrcpy_uninstall(app: AppHandle) -> CmdResult<ScrcpyStatus> {
    tokio::task::spawn_blocking(move || uninstall_managed(&app)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn scrcpy_launch(
    app: AppHandle,
    serial: Option<String>,
    options: ScrcpyLaunchOptions,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || launch(&app, serial.as_deref(), &options))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_stop(serial: Option<String>) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || stop(serial.as_deref())).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_active_sessions() -> CmdResult<ScrcpyActiveSessions> {
    tokio::task::spawn_blocking(active_sessions).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn scrcpy_presets() -> ScrcpyPresetsCatalog {
    get_presets_catalog()
}
