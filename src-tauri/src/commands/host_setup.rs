use tauri::AppHandle;

use crate::CmdResult;
use crate::host_setup::{self, HostSetupResult, HostSetupStatus};

#[tauri::command]
pub async fn host_setup_status(app: AppHandle) -> CmdResult<HostSetupStatus> {
    host_setup::status(app).await
}

#[tauri::command]
pub async fn host_setup_install(app: AppHandle) -> CmdResult<HostSetupResult> {
    host_setup::install(app).await
}

#[tauri::command]
pub async fn host_setup_install_driver(app: AppHandle) -> CmdResult<HostSetupResult> {
    host_setup::install_driver(app).await
}

#[tauri::command]
pub fn launch_host_setup_terminal() -> CmdResult<()> {
    host_setup::launch_install_dir_terminal()
}

#[tauri::command]
pub async fn host_setup_repair_path() -> CmdResult<HostSetupResult> {
    tokio::task::spawn_blocking(host_setup::repair_system_path).await.map_err(|e| e.to_string())?
}
