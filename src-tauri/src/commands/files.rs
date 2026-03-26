use crate::CmdResult;
use crate::helpers::run_binary_command;
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
}

#[tauri::command]
pub fn list_files(app: AppHandle, path: String) -> CmdResult<Vec<FileEntry>> {
    let path = path.trim();
    info!("Listing files at {}", path);

    // Wrap in single quotes so spaces in paths are handled correctly by the device shell.
    // Escape any literal single-quotes inside the path via the '' -> '\'' idiom.
    let quoted = format!("'{}'", path.replace('\'', r"'\''"));
    let output = run_binary_command(&app, "adb", &["shell", "ls", "-lA", &quoted])?;

    // adb shell exits with 0 even when the shell command fails (e.g. permission denied).
    // We have to inspect the output ourselves.
    if output.to_lowercase().contains("permission denied") {
        return Err(format!("Permission denied: cannot access '{path}'"));
    }

    let entries = parse_file_entries(&output);
    debug!("Found {} entries at {}", entries.len(), path);
    Ok(entries)
}

#[tauri::command]
pub fn pull_file(app: AppHandle, remote_path: String, local_path: String) -> CmdResult<String> {
    info!("Pulling {} to {}", remote_path.trim(), local_path.trim());
    run_binary_command(&app, "adb", &["pull", "-a", remote_path.trim(), local_path.trim()])
}

#[tauri::command]
pub fn push_file(app: AppHandle, local_path: String, remote_path: String) -> CmdResult<String> {
    info!("Pushing {} to {}", local_path.trim(), remote_path.trim());
    run_binary_command(&app, "adb", &["push", local_path.trim(), remote_path.trim()])
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

            Some(FileEntry {
                name: parts[7..].join(" ").split(" -> ").next().unwrap_or("").to_string(),
                r#type: file_type.into(),
                size: parts.get(4).copied().unwrap_or("").to_string(),
                permissions,
                date: parts.get(5).copied().unwrap_or("").to_string(),
                time: parts.get(6).copied().unwrap_or("").to_string(),
            })
        })
        .collect()
}
