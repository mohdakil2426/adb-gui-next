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
    /// For symlinks: the resolved target path (e.g. "/proc/self/fd").
    /// Empty string for regular files and directories.
    pub link_target: String,
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

#[tauri::command]
pub fn delete_files(app: AppHandle, paths: Vec<String>) -> CmdResult<String> {
    if paths.is_empty() {
        return Err("No paths provided".into());
    }
    let count = paths.len();
    info!("Deleting {} item(s)", count);

    // Build a single shell command: rm -rf 'path1' 'path2' ...
    // Each path is single-quoted with the '' -> '\'' escape idiom for embedded quotes.
    let quoted: Vec<String> =
        paths.iter().map(|p| format!("'{}'", p.trim().replace('\'', r"'\''"))).collect();
    let cmd = format!("rm -rf {}", quoted.join(" "));
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Deleted {} item(s)", count))
}

#[tauri::command]
pub fn rename_file(app: AppHandle, old_path: String, new_path: String) -> CmdResult<String> {
    info!("Renaming '{}' to '{}'", old_path.trim(), new_path.trim());
    let old_q = format!("'{}'", old_path.trim().replace('\'', r"'\''"));
    let new_q = format!("'{}'", new_path.trim().replace('\'', r"'\''"));
    let cmd = format!("mv {} {}", old_q, new_q);
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Renamed to {}", new_path.trim()))
}

#[tauri::command]
pub fn create_file(app: AppHandle, path: String) -> CmdResult<String> {
    info!("Creating file: {}", path.trim());
    let quoted = format!("'{}'", path.trim().replace('\'', r"'\''"));
    let cmd = format!("touch {quoted}");
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Created file: {}", path.trim()))
}

#[tauri::command]
pub fn create_directory(app: AppHandle, path: String) -> CmdResult<String> {
    info!("Creating directory: {}", path.trim());
    let quoted = format!("'{}'", path.trim().replace('\'', r"'\''"));
    let cmd = format!("mkdir -p {quoted}");
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Created directory: {}", path.trim()))
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
