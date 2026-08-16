use crate::CmdResult;
use crate::helpers::{run_binary_command, run_binary_command_allow_output_on_failure};
use crate::utilities::{HostToolVersions, parse_tool_version_line};
use log::info;
use tauri::AppHandle;

#[tauri::command]
pub async fn restart_adb_server(app: AppHandle) -> CmdResult<String> {
    info!("Restarting ADB server");
    tokio::task::spawn_blocking(move || {
        let _ = run_binary_command_allow_output_on_failure(&app, "adb", &["kill-server"]);
        run_binary_command(&app, "adb", &["start-server"])?;
        Ok("ADB server restarted".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn kill_adb_server(app: AppHandle) -> CmdResult<String> {
    info!("Killing ADB server");
    tokio::task::spawn_blocking(move || run_binary_command(&app, "adb", &["kill-server"]))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_host_tool_versions(app: AppHandle) -> CmdResult<HostToolVersions> {
    tokio::task::spawn_blocking(move || {
        let adb = run_binary_command(&app, "adb", &["version"]).map_or_else(
            |err| format!("adb unavailable: {err}"),
            |output| parse_tool_version_line(&output, "adb version unavailable"),
        );
        let fastboot = run_binary_command(&app, "fastboot", &["--version"]).map_or_else(
            |err| format!("fastboot unavailable: {err}"),
            |output| parse_tool_version_line(&output, "fastboot version unavailable"),
        );
        Ok(HostToolVersions { adb, fastboot })
    })
    .await
    .map_err(|e| e.to_string())?
}
