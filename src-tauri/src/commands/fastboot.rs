use crate::CmdResult;
use crate::commands::device::ConnectionMode;
use crate::commands::device::current_connection_mode;
use crate::helpers::{run_binary_command, run_binary_command_allow_output_on_failure, split_args};
use log::{info, warn};
use tauri::AppHandle;

/// Flashes an image to a device partition via fastboot.
///
/// Runs on a blocking thread to avoid freezing the WebView during large
/// partition writes (system/super can take 1–2 minutes).
#[tauri::command]
pub async fn flash_partition(
    app: AppHandle,
    partition: String,
    image_path: String,
) -> CmdResult<()> {
    let partition = partition.trim().to_string();
    let image_path = image_path.trim().to_string();
    if partition.is_empty() || image_path.is_empty() {
        return Err("Partition and image path are required.".into());
    }
    info!("Flashing partition {} with {}", partition, image_path);
    tokio::task::spawn_blocking(move || {
        let _ = run_binary_command(&app, "fastboot", &["flash", &partition, &image_path])?;
        info!("Partition flashed successfully");
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_bootloader_variables(app: AppHandle) -> CmdResult<String> {
    info!("Getting fastboot variables");
    tokio::task::spawn_blocking(move || {
        run_binary_command_allow_output_on_failure(&app, "fastboot", &["getvar", "all"])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn reboot(app: AppHandle, mode: String) -> CmdResult<()> {
    let mode_str = mode.trim().to_string();
    info!("Rebooting device to mode: {}", if mode_str.is_empty() { "system" } else { &mode_str });
    tokio::task::spawn_blocking(move || {
        match current_connection_mode(&app)? {
            ConnectionMode::Adb => {
                let mut args = vec!["reboot"];
                if !mode_str.is_empty() {
                    args.push(&mode_str);
                }
                let _ = run_binary_command(&app, "adb", &args)?;
            }
            ConnectionMode::Fastboot => {
                if mode_str == "bootloader" {
                    let _ = run_binary_command(&app, "fastboot", &["reboot-bootloader"])?;
                } else if mode_str.is_empty() {
                    let _ = run_binary_command(&app, "fastboot", &["reboot"])?;
                } else {
                    let _ = run_binary_command(&app, "fastboot", &["reboot", &mode_str])?;
                }
            }
            ConnectionMode::Unknown => {
                return Err("No connected ADB or fastboot device found.".into());
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn run_fastboot_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    info!("Running fastboot command: {}", command);
    tokio::task::spawn_blocking(move || {
        let args = split_args(&command);
        run_binary_command(&app, "fastboot", &args)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_active_slot(app: AppHandle, slot: String) -> CmdResult<()> {
    let slot_str = slot.trim().to_string();
    info!("Setting active slot to {}", slot_str);
    tokio::task::spawn_blocking(move || {
        let _ = run_binary_command(&app, "fastboot", &[&format!("--set-active={slot_str}")])?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Wipes all user data (factory reset) via `fastboot -w`.
///
/// Runs on a blocking thread — this operation can take 30–60 seconds.
#[tauri::command]
pub async fn wipe_data(app: AppHandle) -> CmdResult<()> {
    warn!("Wiping user data (factory reset)");
    tokio::task::spawn_blocking(move || {
        let _ = run_binary_command(&app, "fastboot", &["-w"])?;
        info!("User data wiped successfully");
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
