use std::time::Duration;

use reqwest::Client;
use tauri::AppHandle;

use crate::CmdResult;
use crate::scrcpy::flags::ScrcpyLaunchOptions;
use crate::scrcpy::{
    ScrcpyActiveSessions, ScrcpyPresetsCatalog, ScrcpyStatus, ToolbarMode, ToolbarSession,
    ToolbarSide, active_sessions, close_toolbar, create_toolbar_window, fetch_latest_tag,
    get_presets_catalog, get_toolbar_session, install_latest, launch, local_status, rotate_device,
    send_keyevent, send_statusbar, set_toolbar_mode, set_toolbar_offset, set_toolbar_side,
    set_toolbar_size, stop, take_screenshot, uninstall_managed,
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

#[tauri::command]
pub async fn scrcpy_open_toolbar(
    app: AppHandle,
    serial: String,
    pid: Option<u32>,
    mode: Option<String>,
    side: Option<String>,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || create_toolbar_window(&app, &serial, pid, mode, side))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_close_toolbar(app: AppHandle, serial: String) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || close_toolbar(&app, &serial))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn scrcpy_get_toolbar_state(serial: String) -> CmdResult<Option<ToolbarSession>> {
    Ok(get_toolbar_session(&serial))
}

#[tauri::command]
pub fn scrcpy_set_toolbar_mode(serial: String, mode: String) -> CmdResult<()> {
    set_toolbar_mode(&serial, ToolbarMode::from_str_lenient(&mode))
}

#[tauri::command]
pub fn scrcpy_set_toolbar_offset(serial: String, offset: i32) -> CmdResult<()> {
    set_toolbar_offset(&serial, offset)
}

#[tauri::command]
pub fn scrcpy_set_toolbar_side(serial: String, side: String) -> CmdResult<()> {
    set_toolbar_side(&serial, ToolbarSide::from_str_lenient(&side))
}

#[tauri::command]
pub async fn scrcpy_set_toolbar_size(
    app: AppHandle,
    serial: String,
    width: f64,
    height: f64,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || set_toolbar_size(&app, &serial, width, height))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_send_keyevent(
    app: AppHandle,
    serial: Option<String>,
    keycode: u32,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || send_keyevent(&app, serial.as_deref(), keycode))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_send_statusbar(
    app: AppHandle,
    serial: Option<String>,
    action: String,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || send_statusbar(&app, serial.as_deref(), &action))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_rotate_device(
    app: AppHandle,
    serial: Option<String>,
    direction: String,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || rotate_device(&app, serial.as_deref(), &direction))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn scrcpy_take_screenshot(app: AppHandle, serial: Option<String>) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || take_screenshot(&app, serial.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}
