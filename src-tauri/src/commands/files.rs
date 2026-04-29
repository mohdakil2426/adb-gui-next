use crate::CmdResult;
use crate::commands::device::run_adb_for_serial;
use log::{debug, info};
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub r#type: String,
    pub size: String,
    pub permissions: String,
    pub date: String,
    pub time: String,
    /// For symlinks: the resolved target path (e.g. "/proc/self/fd").
    /// Empty string for regular files and directories.
    pub link_target: String,
}

/// Lists files at `path` on the connected ADB device.
///
/// Runs on a blocking thread — `adb shell ls` blocks until the device responds.
#[tauri::command]
pub async fn list_files(
    app: AppHandle,
    path: String,
    serial: Option<String>,
) -> CmdResult<Vec<FileEntry>> {
    let path = path.trim().to_string();
    info!("Listing files at {}", path);
    tokio::task::spawn_blocking(move || {
        // Wrap in single quotes so spaces in paths are handled correctly.
        // Escape any literal single-quotes via the '' -> '\'' idiom.
        let quoted = format!("'{}'", path.replace('\'', r"'\''"));
        let output = run_adb_for_serial(&app, serial.as_deref(), &["shell", "ls", "-lA", &quoted])?;

        // adb shell exits with 0 even when the shell command fails.
        if output.to_lowercase().contains("permission denied") {
            return Err(format!("Permission denied: cannot access '{path}'"));
        }

        let entries = parse_file_entries(&output);
        debug!("Found {} entries at {}", entries.len(), path);
        Ok(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pull_file(
    app: AppHandle,
    remote_path: String,
    local_path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let remote = remote_path.trim().to_string();
    let local = local_path.trim().to_string();
    info!("Pulling {} to {}", remote, local);
    tokio::task::spawn_blocking(move || {
        run_adb_for_serial(&app, serial.as_deref(), &["pull", "-a", &remote, &local])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn push_file(
    app: AppHandle,
    local_path: String,
    remote_path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let local = local_path.trim().to_string();
    let remote = remote_path.trim().to_string();
    info!("Pushing {} to {}", local, remote);
    tokio::task::spawn_blocking(move || {
        run_adb_for_serial(&app, serial.as_deref(), &["push", &local, &remote])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_files(
    app: AppHandle,
    paths: Vec<String>,
    serial: Option<String>,
) -> CmdResult<String> {
    if paths.is_empty() {
        return Err("No paths provided".into());
    }
    let count = paths.len();
    info!("Deleting {} item(s)", count);
    tokio::task::spawn_blocking(move || {
        // Build a single shell command: rm -rf 'path1' 'path2' ...
        let quoted: Vec<String> =
            paths.iter().map(|p| format!("'{}'", p.trim().replace('\'', r"'\''"))).collect();
        let cmd = format!("rm -rf {}", quoted.join(" "));
        run_adb_for_serial(&app, serial.as_deref(), &["shell", &cmd])?;
        Ok(format!("Deleted {} item(s)", count))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn rename_file(
    app: AppHandle,
    old_path: String,
    new_path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let old = old_path.trim().to_string();
    let new = new_path.trim().to_string();
    info!("Renaming '{}' to '{}'", old, new);
    tokio::task::spawn_blocking(move || {
        let old_q = format!("'{}'", old.replace('\'', r"'\''"));
        let new_q = format!("'{}'", new.replace('\'', r"'\''"));
        let cmd = format!("mv {old_q} {new_q}");
        run_adb_for_serial(&app, serial.as_deref(), &["shell", &cmd])?;
        Ok(format!("Renamed to {new}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_file(
    app: AppHandle,
    path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let p = path.trim().to_string();
    info!("Creating file: {}", p);
    tokio::task::spawn_blocking(move || {
        let quoted = format!("'{}'", p.replace('\'', r"'\''"));
        let cmd = format!("touch {quoted}");
        run_adb_for_serial(&app, serial.as_deref(), &["shell", &cmd])?;
        Ok(format!("Created file: {p}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_directory(
    app: AppHandle,
    path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let p = path.trim().to_string();
    info!("Creating directory: {}", p);
    tokio::task::spawn_blocking(move || {
        let quoted = format!("'{}'", p.replace('\'', r"'\''"));
        let cmd = format!("mkdir -p {quoted}");
        run_adb_for_serial(&app, serial.as_deref(), &["shell", &cmd])?;
        Ok(format!("Created directory: {p}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn parse_file_entries(output: &str) -> Vec<FileEntry> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with("total") {
                return None;
            }

            let parts: Vec<_> = line.split_whitespace().collect();
            if parts.len() < 8 {
                return None;
            }

            let permissions = parts[0].to_string();
            let file_type = if permissions.starts_with('d') {
                "Directory"
            } else if permissions.starts_with('l') {
                "Symlink"
            } else {
                "File"
            };

            // For symlinks ls outputs: name -> target
            // parts[7..] joins all tokens after the timestamp, then we split on " -> "
            let full_name = parts[7..].join(" ");
            let (name, link_target) = if let Some((n, t)) = full_name.split_once(" -> ") {
                (n.trim().to_string(), t.trim().to_string())
            } else {
                (full_name.trim().to_string(), String::new())
            };

            Some(FileEntry {
                name,
                r#type: file_type.into(),
                size: parts.get(4).copied().unwrap_or("").to_string(),
                permissions,
                date: parts.get(5).copied().unwrap_or("").to_string(),
                time: parts.get(6).copied().unwrap_or("").to_string(),
                link_target,
            })
        })
        .collect()
}
