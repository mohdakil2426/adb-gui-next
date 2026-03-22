use crate::CmdResult;
use crate::commands::device::ConnectionMode;
use crate::commands::device::current_connection_mode;
use crate::helpers::{run_binary_command, split_args};
use log::{error, info, warn};
use tauri::AppHandle;

#[tauri::command]
pub fn flash_partition(app: AppHandle, partition: String, image_path: String) -> CmdResult<()> {
    if partition.trim().is_empty() || image_path.trim().is_empty() {
        return Err("Partition and image path are required.".into());
    }
    info!("Flashing partition {} with {}", partition.trim(), image_path.trim());
    let _ = run_binary_command(&app, "fastboot", &["flash", partition.trim(), image_path.trim()])?;
    info!("Partition {} flashed successfully", partition.trim());
    Ok(())
}

#[tauri::command]
pub fn get_bootloader_variables(app: AppHandle) -> CmdResult<String> {
    info!("Getting fastboot variables");
    crate::helpers::run_binary_command_allow_output_on_failure(&app, "fastboot", &["getvar", "all"])
}

#[tauri::command]
pub fn reboot(app: AppHandle, mode: String) -> CmdResult<()> {
    let mode = mode.trim();
    info!("Rebooting device to mode: {}", if mode.is_empty() { "system" } else { mode });
    match current_connection_mode(&app)? {
        ConnectionMode::Adb => {
            let mut args = vec!["reboot"];
            if !mode.is_empty() {
                args.push(mode);
            }
            let _ = run_binary_command(&app, "adb", &args)?;
        }
        ConnectionMode::Fastboot => {
            if mode == "bootloader" {
                let _ = run_binary_command(&app, "fastboot", &["reboot-bootloader"])?;
            } else if mode.is_empty() {
                let _ = run_binary_command(&app, "fastboot", &["reboot"])?;
            } else {
                let _ = run_binary_command(&app, "fastboot", &["reboot", mode])?;
            }
        }
        ConnectionMode::Unknown => {
            error!("No connected ADB or fastboot device found for reboot");
            return Err("No connected ADB or fastboot device found.".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn run_fastboot_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    info!("Running fastboot command: {}", command);
    let args = split_args(&command);
    run_binary_command(&app, "fastboot", &args)
}

#[tauri::command]
pub fn set_active_slot(app: AppHandle, slot: String) -> CmdResult<()> {
    info!("Setting active slot to {}", slot.trim());
    let _ = run_binary_command(&app, "fastboot", &[&format!("--set-active={}", slot.trim())])?;
    Ok(())
}

#[tauri::command]
pub fn wipe_data(app: AppHandle) -> CmdResult<()> {
    warn!("Wiping user data (factory reset)");
    let _ = run_binary_command(&app, "fastboot", &["-w"])?;
    info!("User data wiped successfully");
    Ok(())
}
