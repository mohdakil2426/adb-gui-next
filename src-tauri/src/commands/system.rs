#![allow(unsafe_code)]

use crate::CmdResult;
use crate::helpers::{
    binary_working_directory, normalize_path, resolve_binary_path, sanitize_filename,
};
use log::info;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const DEFAULT_LOG_PREFIX: &str = "adb_gui_next_log";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostHardwareCapacity {
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub logical_cores: usize,
    pub physical_cores: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
}

#[cfg(windows)]
#[repr(C)]
#[allow(non_snake_case, non_camel_case_types, clippy::upper_case_acronyms)]
struct MEMORYSTATUSEX {
    dwLength: u32,
    dwMemoryLoad: u32,
    ullTotalPhys: u64,
    ullAvailPhys: u64,
    ullTotalPageFile: u64,
    ullAvailPageFile: u64,
    ullTotalVirtual: u64,
    ullAvailVirtual: u64,
    ullAvailExtendedVirtual: u64,
}

#[cfg(windows)]
unsafe extern "system" {
    fn GlobalMemoryStatusEx(lpBuffer: *mut MEMORYSTATUSEX) -> i32;
}

#[cfg(windows)]
fn get_host_ram() -> (u64, u64) {
    let mut mem = MEMORYSTATUSEX {
        dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
        dwMemoryLoad: 0,
        ullTotalPhys: 0,
        ullAvailPhys: 0,
        ullTotalPageFile: 0,
        ullAvailPageFile: 0,
        ullTotalVirtual: 0,
        ullAvailVirtual: 0,
        ullAvailExtendedVirtual: 0,
    };
    let success = unsafe { GlobalMemoryStatusEx(&mut mem) };
    if success != 0 {
        let total_mb = mem.ullTotalPhys / (1024 * 1024);
        let avail_mb = mem.ullAvailPhys / (1024 * 1024);
        (total_mb, avail_mb)
    } else {
        (16384, 8192)
    }
}

#[cfg(target_os = "linux")]
fn get_host_ram() -> (u64, u64) {
    if let Ok(contents) = std::fs::read_to_string("/proc/meminfo") {
        let mut total_kb = 0;
        let mut avail_kb = 0;
        for line in contents.lines() {
            if let Some(rest) = line.strip_prefix("MemTotal:") {
                total_kb =
                    rest.split_whitespace().next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
            } else if let Some(rest) = line.strip_prefix("MemAvailable:") {
                avail_kb =
                    rest.split_whitespace().next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
            }
        }
        if total_kb > 0 {
            return (total_kb / 1024, avail_kb / 1024);
        }
    }
    (16384, 8192)
}

#[cfg(target_os = "macos")]
fn get_host_ram() -> (u64, u64) {
    let mut size: u64 = 0;
    let mut len = std::mem::size_of::<u64>();
    let mib = [libc::CTL_HW, libc::HW_MEMSIZE];
    let res = unsafe {
        libc::sysctl(
            mib.as_ptr() as *mut _,
            2,
            &mut size as *mut _ as *mut _,
            &mut len,
            std::ptr::null_mut(),
            0,
        )
    };
    if res == 0 && size > 0 {
        let total_mb = size / (1024 * 1024);
        (total_mb, total_mb / 2)
    } else {
        (16384, 8192)
    }
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
fn get_host_ram() -> (u64, u64) {
    (16384, 8192)
}

#[tauri::command]
pub fn launch_device_manager() -> CmdResult<()> {
    info!("Launching device manager");
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/C", "start", "devmgmt.msc"])
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .args(["-a", "System Information"])
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn launch_terminal() -> CmdResult<()> {
    let directory = binary_working_directory(None)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    info!("Launching terminal at {:?}", directory);

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", "cd", "/d"])
            .arg(directory)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(&directory)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let _ =
            Command::new("xdg-open").arg(directory).spawn().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_folder(app: AppHandle, folder_path: String) -> CmdResult<()> {
    if folder_path.trim().is_empty() {
        return Err("Folder path is empty.".into());
    }
    let path = PathBuf::from(&folder_path);
    // Verify the path exists and is a directory
    if !path.exists() {
        return Err(format!("Path does not exist: {}", folder_path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", folder_path));
    }
    // Canonicalize to prevent path traversal
    let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    let path_str = canonical.to_string_lossy().into_owned();
    info!("Opening folder: {}", path_str);
    app.opener().open_path(&path_str, None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn system_host_resources() -> HostHardwareCapacity {
    let (total_ram_mb, available_ram_mb) = get_host_ram();
    let logical_cores = std::thread::available_parallelism().map_or(8, |p| p.get());
    let physical_cores = (logical_cores / 2).max(1);

    HostHardwareCapacity { total_ram_mb, available_ram_mb, logical_cores, physical_cores }
}

#[tauri::command]
pub async fn execute_cli_command(
    app: AppHandle,
    command: String,
    serial: Option<String>,
) -> CmdResult<CliExecutionResult> {
    let cmd_str = command.trim().to_string();
    if cmd_str.is_empty() {
        return Err("Command cannot be empty".into());
    }

    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
    let binary_name = parts[0];
    let mut raw_args: Vec<String> = parts[1..].iter().map(|s| (*s).to_string()).collect();

    if matches!(binary_name, "adb" | "fastboot")
        && let Some(s) = serial.filter(|s| !s.trim().is_empty())
        && !raw_args.iter().any(|a| a == "-s")
    {
        raw_args.insert(0, "-s".to_string());
        raw_args.insert(1, s);
    }

    let binary_path =
        resolve_binary_path(&app, binary_name).unwrap_or_else(|_| PathBuf::from(binary_name));

    let working_dir = binary_working_directory(Some(&app))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&binary_path);
        cmd.args(&raw_args);
        cmd.current_dir(working_dir);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        match cmd.output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let exit_code = output.status.code().unwrap_or(-1);
                let success = output.status.success();

                Ok(CliExecutionResult { stdout, stderr, exit_code, success })
            }
            Err(e) => Err(format!("Failed to execute command '{cmd_str}': {e}")),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn save_log(app: AppHandle, content: String, prefix: String) -> CmdResult<String> {
    let logs_dir = app.path().app_log_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|error| error.to_string())?;

    // Sanitize prefix: allow only safe filename characters
    let prefix = if prefix.trim().is_empty() {
        DEFAULT_LOG_PREFIX.to_string()
    } else {
        sanitize_filename(&prefix)
    };
    let timestamp =
        SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_secs();
    let file_path = logs_dir.join(format!("{prefix}_{timestamp}.txt"));
    info!("Saving log to {:?}", file_path);

    fs::write(&file_path, content).map_err(|error| error.to_string())?;
    Ok(normalize_path(&file_path))
}
