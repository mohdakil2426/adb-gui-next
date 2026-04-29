use crate::CmdResult;
use crate::commands::device::ConnectionMode;
use crate::commands::device::{
    current_connection_mode_for, run_adb_for_serial, run_fastboot_for_serial,
};
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
    serial: Option<String>,
) -> CmdResult<()> {
    let partition = partition.trim().to_string();
    let image_path = image_path.trim().to_string();
    if partition.is_empty() || image_path.is_empty() {
        return Err("Partition and image path are required.".into());
    }
    info!("Flashing partition {} with {}", partition, image_path);
    tokio::task::spawn_blocking(move || {
        let _ =
            run_fastboot_for_serial(&app, serial.as_deref(), &["flash", &partition, &image_path])?;
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
pub async fn reboot(app: AppHandle, mode: String, serial: Option<String>) -> CmdResult<()> {
    let mode_str = mode.trim().to_string();
    info!("Rebooting device to mode: {}", if mode_str.is_empty() { "system" } else { &mode_str });
    tokio::task::spawn_blocking(move || {
        match current_connection_mode_for(&app, serial.as_deref())? {
            ConnectionMode::Adb => {
                let mut args = vec!["reboot"];
                if !mode_str.is_empty() {
                    args.push(&mode_str);
                }
                let _ = run_adb_for_serial(&app, serial.as_deref(), &args)?;
            }
            ConnectionMode::Fastboot => {
                if mode_str == "bootloader" {
                    let _ =
                        run_fastboot_for_serial(&app, serial.as_deref(), &["reboot-bootloader"])?;
                } else if mode_str.is_empty() {
                    let _ = run_fastboot_for_serial(&app, serial.as_deref(), &["reboot"])?;
                } else {
                    let _ =
                        run_fastboot_for_serial(&app, serial.as_deref(), &["reboot", &mode_str])?;
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
pub async fn run_fastboot_host_command(
    app: AppHandle,
    command: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let command = command.trim().to_string();
    if command.is_empty() {
        return Err("Fastboot host command is empty.".into());
    }
    info!("Running fastboot command: {}", command);
    tokio::task::spawn_blocking(move || {
        let mut args: Vec<String> = split_args(&command).into_iter().map(str::to_string).collect();
        let serial = serial.as_deref().map(str::trim).filter(|value| !value.is_empty());
        if let Some(serial) = serial
            && !args.iter().any(|arg| arg == "-s" || arg == "--serial")
        {
            args.splice(0..0, vec!["-s".to_string(), serial.to_string()]);
        }
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        run_binary_command(&app, "fastboot", &arg_refs)
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
pub async fn wipe_data(app: AppHandle, serial: Option<String>) -> CmdResult<()> {
    warn!("Wiping user data (factory reset)");
    tokio::task::spawn_blocking(move || {
        let _ = run_fastboot_for_serial(&app, serial.as_deref(), &["-w"])?;
        info!("User data wiped successfully");
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
