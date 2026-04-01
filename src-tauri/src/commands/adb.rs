use crate::CmdResult;
use crate::helpers::{default_if_empty, run_binary_command};
use log::{error, info};
use tauri::AppHandle;

const DEFAULT_ADB_PORT: &str = "5555";

/// Shell metacharacters that can chain commands or inject code.
const SHELL_METACHARACTERS: &[char] =
    &[';', '|', '&', '$', '`', '(', ')', '{', '}', '<', '>', '\n', '\r'];

/// Validate a shell command string for dangerous metacharacters.
/// Returns an error if the command contains characters that could enable command injection.
fn validate_shell_command(command: &str) -> CmdResult<()> {
    if let Some(ch) = command.chars().find(|c| SHELL_METACHARACTERS.contains(c)) {
        return Err(format!(
            "Shell command contains potentially dangerous character '{ch}'. For safety, command chaining (;, |, &&, etc.) is not permitted through this interface."
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn connect_wireless_adb(app: AppHandle, ip: String, port: String) -> CmdResult<String> {
    let address = format!("{}:{}", ip.trim(), default_if_empty(&port, DEFAULT_ADB_PORT));
    info!("Connecting wireless ADB to {}", address);
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn disconnect_wireless_adb(
    app: AppHandle,
    ip: String,
    port: String,
) -> CmdResult<String> {
    let address = format!("{}:{}", ip.trim(), default_if_empty(&port, DEFAULT_ADB_PORT));
    info!("Disconnecting wireless ADB from {}", address);
    tokio::task::spawn_blocking(move || {
        let output = run_binary_command(&app, "adb", &["disconnect", &address])?;
        Ok(if output.is_empty() { format!("Disconnected from {address}") } else { output })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn enable_wireless_adb(app: AppHandle, port: String) -> CmdResult<String> {
    let port_str = default_if_empty(&port, DEFAULT_ADB_PORT).to_string();
    info!("Enabling wireless ADB on port {}", port_str);
    tokio::task::spawn_blocking(move || run_binary_command(&app, "adb", &["tcpip", &port_str]))
        .await
        .map_err(|e| e.to_string())?
}

/// Runs an arbitrary ADB host command entered by the user.
///
/// Runs on a blocking thread — user shell commands can run indefinitely.
#[tauri::command]
pub async fn run_adb_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    let command = command.trim().to_string();
    if command.is_empty() {
        return Err("ADB host command is empty.".into());
    }
    info!("Running ADB host command: {}", command);
    tokio::task::spawn_blocking(move || {
        let args = crate::helpers::split_args(&command);
        run_binary_command(&app, "adb", &args)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Runs an arbitrary ADB shell command entered by the user.
///
/// Runs on a blocking thread — shell commands can run indefinitely.
#[tauri::command]
pub async fn run_shell_command(app: AppHandle, command: String) -> CmdResult<String> {
    let command = command.trim().to_string();
    if command.is_empty() {
        return Err("Shell command is empty.".into());
    }
    validate_shell_command(&command)?;
    info!("Running shell command: {}", command);
    tokio::task::spawn_blocking(move || run_binary_command(&app, "adb", &["shell", &command]))
        .await
        .map_err(|e| e.to_string())?
}
