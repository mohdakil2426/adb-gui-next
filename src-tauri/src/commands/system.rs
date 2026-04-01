use crate::CmdResult;
use crate::helpers::{binary_working_directory, normalize_path};
use log::info;
use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const DEFAULT_LOG_PREFIX: &str = "adb_gui_next_log";

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
pub fn save_log(app: AppHandle, content: String, prefix: String) -> CmdResult<String> {
    let logs_dir = app.path().app_log_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&logs_dir).map_err(|error| error.to_string())?;

    // Sanitize prefix: allow only safe filename characters
    let prefix = if prefix.trim().is_empty() {
        DEFAULT_LOG_PREFIX.to_string()
    } else {
        prefix
            .trim()
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .take(50)
            .collect::<String>()
    };
    let timestamp =
        SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_secs();
    let file_path = logs_dir.join(format!("{prefix}_{timestamp}.txt"));
    info!("Saving log to {:?}", file_path);

    fs::write(&file_path, content).map_err(|error| error.to_string())?;
    Ok(normalize_path(&file_path))
}
