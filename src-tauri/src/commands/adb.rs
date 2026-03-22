use crate::CmdResult;
use crate::helpers::{default_if_empty, run_binary_command};
use log::{error, info};
use tauri::AppHandle;

const DEFAULT_ADB_PORT: &str = "5555";

#[tauri::command]
pub fn connect_wireless_adb(app: AppHandle, ip: String, port: String) -> CmdResult<String> {
    let address = format!("{}:{}", ip.trim(), default_if_empty(&port, DEFAULT_ADB_PORT));
    info!("Connecting wireless ADB to {}", address);
    let output = run_binary_command(&app, "adb", &["connect", &address])?;
    if output.contains("connected to") || output.contains("already connected to") {
        info!("Wireless ADB connected to {}", address);
        Ok(output)
    } else if output.is_empty() {
        error!("Failed to connect to {}: no output", address);
        Err(format!("Failed to connect to {address}."))
    } else {
        error!("Failed to connect to {}: {}", address, output);
        Err(output)
    }
}

#[tauri::command]
pub fn disconnect_wireless_adb(app: AppHandle, ip: String, port: String) -> CmdResult<String> {
    let address = format!("{}:{}", ip.trim(), default_if_empty(&port, DEFAULT_ADB_PORT));
    info!("Disconnecting wireless ADB from {}", address);
    let output = run_binary_command(&app, "adb", &["disconnect", &address])?;
    Ok(if output.is_empty() { format!("Disconnected from {address}") } else { output })
}

#[tauri::command]
pub fn enable_wireless_adb(app: AppHandle, port: String) -> CmdResult<String> {
    let port = default_if_empty(&port, DEFAULT_ADB_PORT);
    info!("Enabling wireless ADB on port {}", port);
    run_binary_command(&app, "adb", &["tcpip", port])
}

#[tauri::command]
pub fn run_adb_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    info!("Running ADB host command: {}", command);
    let args = crate::helpers::split_args(&command);
    run_binary_command(&app, "adb", &args)
}

#[tauri::command]
pub fn run_shell_command(app: AppHandle, command: String) -> CmdResult<String> {
    let command = command.trim();
    if command.is_empty() {
        return Err("Shell command is empty.".into());
    }
    info!("Running shell command: {}", command);
    run_binary_command(&app, "adb", &["shell", command])
}
