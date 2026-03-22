use crate::CmdResult;
use crate::helpers::*;
use log::{debug, info};
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub serial: String,
    pub status: String,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub model: String,
    pub android_version: String,
    pub build_number: String,
    pub battery_level: String,
    pub serial: String,
    pub ip_address: String,
    pub root_status: String,
    pub codename: String,
    pub ram_total: String,
    pub storage_info: String,
    pub brand: String,
    pub device_name: String,
}

#[tauri::command]
pub fn get_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    info!("Getting ADB devices");
    let output = run_binary_command(&app, "adb", &["devices"])?;
    let mut devices = Vec::new();

    for line in output.lines().skip(1) {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() == 2 {
            devices.push(Device { serial: parts[0].to_string(), status: parts[1].to_string() });
        }
    }

    debug!("Found {} ADB device(s)", devices.len());
    Ok(devices)
}

#[tauri::command]
pub fn get_fastboot_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    info!("Getting fastboot devices");
    let output = run_binary_command(&app, "fastboot", &["devices"])?;
    let mut devices = Vec::new();

    for line in output.lines() {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() >= 2 && matches!(parts[1], "fastboot" | "bootloader") {
            devices.push(Device { serial: parts[0].to_string(), status: parts[1].to_string() });
        }
    }

    debug!("Found {} fastboot device(s)", devices.len());
    Ok(devices)
}

#[tauri::command]
pub fn get_device_info(app: AppHandle) -> CmdResult<DeviceInfo> {
    info!("Getting device info");
    Ok(DeviceInfo {
        model: get_prop(&app, "ro.product.model"),
        android_version: get_prop(&app, "ro.build.version.release"),
        build_number: get_prop(&app, "ro.build.id"),
        battery_level: get_battery_level(&app),
        serial: get_serial(&app),
        ip_address: get_ip_address(&app),
        root_status: get_root_status(&app),
        codename: get_prop(&app, "ro.product.device"),
        ram_total: get_ram_total(&app),
        storage_info: get_storage_info(&app),
        brand: get_prop(&app, "ro.product.brand"),
        device_name: get_prop(&app, "ro.product.name"),
    })
}

#[derive(Clone, Copy)]
pub enum ConnectionMode {
    Adb,
    Fastboot,
    Unknown,
}

pub fn current_connection_mode(app: &AppHandle) -> CmdResult<ConnectionMode> {
    if !get_devices(app.clone())?.is_empty() {
        return Ok(ConnectionMode::Adb);
    }
    if !get_fastboot_devices(app.clone())?.is_empty() {
        return Ok(ConnectionMode::Fastboot);
    }
    Ok(ConnectionMode::Unknown)
}

#[tauri::command]
pub fn get_device_mode(app: AppHandle) -> CmdResult<String> {
    Ok(match current_connection_mode(&app)? {
        ConnectionMode::Adb => "adb",
        ConnectionMode::Fastboot => "fastboot",
        ConnectionMode::Unknown => "unknown",
    }
    .into())
}
