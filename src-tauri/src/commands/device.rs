use crate::CmdResult;
use crate::helpers::*;
use log::{debug, info};
use serde::Serialize;
use tauri::AppHandle;

const VALUE_NOT_AVAILABLE: &str = "N/A";

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

pub fn selected_serial(serial: Option<&str>) -> Option<&str> {
    serial.map(str::trim).filter(|value| !value.is_empty())
}

pub fn command_args_with_serial(serial: Option<&str>, args: &[&str]) -> Vec<String> {
    let mut command_args = Vec::new();
    if let Some(serial) = selected_serial(serial) {
        command_args.push("-s".to_string());
        command_args.push(serial.to_string());
    }
    command_args.extend(args.iter().map(|arg| (*arg).to_string()));
    command_args
}

pub fn run_adb_for_serial(
    app: &AppHandle,
    serial: Option<&str>,
    args: &[&str],
) -> CmdResult<String> {
    let command_args = command_args_with_serial(serial, args);
    let arg_refs: Vec<&str> = command_args.iter().map(String::as_str).collect();
    run_binary_command(app, "adb", &arg_refs)
}

pub fn run_fastboot_for_serial(
    app: &AppHandle,
    serial: Option<&str>,
    args: &[&str],
) -> CmdResult<String> {
    let command_args = command_args_with_serial(serial, args);
    let arg_refs: Vec<&str> = command_args.iter().map(String::as_str).collect();
    run_binary_command(app, "fastboot", &arg_refs)
}

/// Lists connected ADB devices.
///
/// Runs on a blocking thread to avoid freezing the WebView during device
/// enumeration, which can stall when ADB is starting its server.
#[tauri::command]
pub async fn get_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    info!("Getting ADB devices");
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Lists connected fastboot devices.
///
/// Runs on a blocking thread — fastboot can stall for several seconds.
#[tauri::command]
pub async fn get_fastboot_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    info!("Getting fastboot devices");
    tokio::task::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Collects device info via 11+ sequential `adb shell getprop` calls.
///
/// Runs on a blocking thread — this can take 1–5 s on a slow device.
fn get_prop_for_serial(app: &AppHandle, serial: Option<&str>, prop: &str) -> String {
    run_adb_for_serial(app, serial, &["shell", "getprop", prop])
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| VALUE_NOT_AVAILABLE.into())
}

fn get_serial_for_serial(app: &AppHandle, serial: Option<&str>) -> String {
    run_adb_for_serial(app, serial, &["get-serialno"])
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| get_prop_for_serial(app, serial, "ro.serialno"))
}

fn get_root_status_for_serial(app: &AppHandle, serial: Option<&str>) -> String {
    let output = run_adb_for_serial(app, serial, &["shell", "su", "-c", "id -u"]);
    if output.is_ok_and(|out| out.trim() == "0") { "Yes".into() } else { "No".into() }
}

fn get_ip_address_for_serial(app: &AppHandle, serial: Option<&str>) -> String {
    if let Ok(output) = run_adb_for_serial(app, serial, &["shell", "ip", "addr", "show", "wlan0"])
        && let Some(ip) = output
            .split_whitespace()
            .collect::<Vec<_>>()
            .windows(2)
            .find_map(|chunk| (chunk[0] == "inet").then_some(chunk[1]))
    {
        return ip.split('/').next().unwrap_or(ip).to_string();
    }
    VALUE_NOT_AVAILABLE.into()
}

fn get_battery_level_for_serial(app: &AppHandle, serial: Option<&str>) -> String {
    if let Ok(output) = run_adb_for_serial(app, serial, &["shell", "dumpsys battery | grep level"])
        && let Some(level) = output.split(':').nth(1)
    {
        return format!("{}%", level.trim());
    }
    VALUE_NOT_AVAILABLE.into()
}

fn get_ram_total_for_serial(app: &AppHandle, serial: Option<&str>) -> String {
    if let Ok(output) = run_adb_for_serial(app, serial, &["shell", "cat", "/proc/meminfo"])
        && let Some(line) = output.lines().find(|l| l.starts_with("MemTotal"))
        && let Some(kb_str) = line.split_whitespace().nth(1)
        && let Ok(kb) = kb_str.parse::<u64>()
    {
        return format!("{:.1} GB", kb as f64 / 1024.0 / 1024.0);
    }
    VALUE_NOT_AVAILABLE.into()
}

fn get_storage_info_for_serial(app: &AppHandle, serial: Option<&str>) -> String {
    if let Ok(output) = run_adb_for_serial(app, serial, &["shell", "df", "-h", "/data"])
        && let Some(line) = output.lines().nth(1)
    {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            return format!("{} used of {}", parts[2], parts[1]);
        }
    }
    VALUE_NOT_AVAILABLE.into()
}

#[tauri::command]
pub async fn get_device_info(app: AppHandle, serial: Option<String>) -> CmdResult<DeviceInfo> {
    info!("Getting device info");
    tokio::task::spawn_blocking(move || {
        let serial = selected_serial(serial.as_deref());
        Ok(DeviceInfo {
            model: get_prop_for_serial(&app, serial, "ro.product.model"),
            android_version: get_prop_for_serial(&app, serial, "ro.build.version.release"),
            build_number: get_prop_for_serial(&app, serial, "ro.build.id"),
            battery_level: get_battery_level_for_serial(&app, serial),
            serial: get_serial_for_serial(&app, serial),
            ip_address: get_ip_address_for_serial(&app, serial),
            root_status: get_root_status_for_serial(&app, serial),
            codename: get_prop_for_serial(&app, serial, "ro.product.device"),
            ram_total: get_ram_total_for_serial(&app, serial),
            storage_info: get_storage_info_for_serial(&app, serial),
            brand: get_prop_for_serial(&app, serial, "ro.product.brand"),
            device_name: get_prop_for_serial(&app, serial, "ro.product.name"),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Clone, Copy)]
pub enum ConnectionMode {
    Adb,
    Fastboot,
    Unknown,
}

/// Sync helper used inside blocking closures — do not call from async context directly.
pub fn current_connection_mode(app: &AppHandle) -> CmdResult<ConnectionMode> {
    let adb_out = run_binary_command(app, "adb", &["devices"])?;
    let has_adb = adb_out.lines().skip(1).any(|l| l.split_whitespace().count() == 2);
    if has_adb {
        return Ok(ConnectionMode::Adb);
    }
    let fb_out = run_binary_command(app, "fastboot", &["devices"])?;
    let has_fb = fb_out.lines().any(|l| {
        let p: Vec<_> = l.split_whitespace().collect();
        p.len() >= 2 && matches!(p[1], "fastboot" | "bootloader")
    });
    if has_fb {
        return Ok(ConnectionMode::Fastboot);
    }
    Ok(ConnectionMode::Unknown)
}

pub fn current_connection_mode_for(
    app: &AppHandle,
    serial: Option<&str>,
) -> CmdResult<ConnectionMode> {
    let Some(serial) = selected_serial(serial) else {
        return current_connection_mode(app);
    };

    let adb_out = run_binary_command(app, "adb", &["devices"])?;
    let has_adb = adb_out.lines().skip(1).any(|line| {
        let parts: Vec<_> = line.split_whitespace().collect();
        parts.len() == 2 && parts[0] == serial
    });
    if has_adb {
        return Ok(ConnectionMode::Adb);
    }

    let fb_out = run_binary_command(app, "fastboot", &["devices"])?;
    let has_fb = fb_out.lines().any(|line| {
        let parts: Vec<_> = line.split_whitespace().collect();
        parts.len() >= 2 && parts[0] == serial && matches!(parts[1], "fastboot" | "bootloader")
    });
    if has_fb {
        return Ok(ConnectionMode::Fastboot);
    }

    Ok(ConnectionMode::Unknown)
}

#[tauri::command]
pub async fn get_device_mode(app: AppHandle) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || {
        Ok(match current_connection_mode(&app)? {
            ConnectionMode::Adb => "adb",
            ConnectionMode::Fastboot => "fastboot",
            ConnectionMode::Unknown => "unknown",
        }
        .into())
    })
    .await
    .map_err(|e| e.to_string())?
}
