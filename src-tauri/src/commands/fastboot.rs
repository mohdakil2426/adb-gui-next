use crate::CmdResult;
use crate::commands::device::ConnectionMode;
use crate::commands::device::current_connection_mode;
use crate::helpers::{run_binary_command, split_args};
use tauri::AppHandle;

#[tauri::command]
pub fn flash_partition(app: AppHandle, partition: String, image_path: String) -> CmdResult<()> {
    if partition.trim().is_empty() || image_path.trim().is_empty() {
        return Err("Partition and image path are required.".into());
    }
    let _ = run_binary_command(&app, "fastboot", &["flash", partition.trim(), image_path.trim()])?;
    Ok(())
}

#[tauri::command]
pub fn get_bootloader_variables(app: AppHandle) -> CmdResult<String> {
    crate::helpers::run_binary_command_allow_output_on_failure(&app, "fastboot", &["getvar", "all"])
}

#[tauri::command]
pub fn reboot(app: AppHandle, mode: String) -> CmdResult<()> {
    let mode = mode.trim();
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
        ConnectionMode::Unknown => return Err("No connected ADB or fastboot device found.".into()),
    }
    Ok(())
}

#[tauri::command]
pub fn run_fastboot_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    let args = split_args(&command);
    run_binary_command(&app, "fastboot", &args)
}

#[tauri::command]
pub fn set_active_slot(app: AppHandle, slot: String) -> CmdResult<()> {
    let _ = run_binary_command(&app, "fastboot", &[&format!("--set-active={}", slot.trim())])?;
    Ok(())
}

#[tauri::command]
pub fn wipe_data(app: AppHandle) -> CmdResult<()> {
    let _ = run_binary_command(&app, "fastboot", &["-w"])?;
    Ok(())
}
