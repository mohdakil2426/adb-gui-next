use std::time::Duration;

use reqwest::Client;
use tauri::AppHandle;

use crate::CmdResult;
use crate::scrcpy::flags::ScrcpyLaunchOptions;
use crate::scrcpy::{ScrcpyStatus, fetch_latest_tag, install_latest, launch, local_status};

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
pub async fn scrcpy_launch(
    app: AppHandle,
    serial: Option<String>,
    options: ScrcpyLaunchOptions,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || launch(&app, serial.as_deref(), &options))
        .await
        .map_err(|e| e.to_string())?
}
