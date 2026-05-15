use crate::CmdResult;
use crate::commands::device::run_adb_for_serial;
use crate::helpers::{validate_path_components, validate_safe_device_path};
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum FileAccessMode {
    #[default]
    Normal,
    Root,
}

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

fn quote_shell_arg(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

fn validate_write_path_for_mode(path: &str, access_mode: FileAccessMode) -> CmdResult<()> {
    validate_path_components(path)?;
    if access_mode == FileAccessMode::Normal {
        validate_safe_device_path(path)?;
    }
    Ok(())
}

fn root_transfer_dir() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("/data/local/tmp/adb-gui-next-root-transfer/{}-{nanos}", std::process::id())
}

fn run_shell_for_mode(
    app: &AppHandle,
    serial: Option<&str>,
    access_mode: FileAccessMode,
    cmd: &str,
) -> CmdResult<String> {
    if access_mode == FileAccessMode::Root {
        run_adb_for_serial(app, serial, &["shell", "su", "-c", cmd])
    } else {
        run_adb_for_serial(app, serial, &["shell", cmd])
    }
}

#[tauri::command]
pub async fn verify_file_root_access(app: AppHandle, serial: Option<String>) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || {
        let output = run_adb_for_serial(&app, serial.as_deref(), &["shell", "su", "-c", "id -u"])?;
        let uid = output.trim();
        if uid == "0" {
            Ok("Root access verified".to_string())
        } else {
            Err(format!("Root verification failed: expected uid 0, got '{uid}'"))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Lists files at `path` on the connected ADB device.
///
/// Runs on a blocking thread — `adb shell ls` blocks until the device responds.
#[tauri::command]
pub async fn list_files(
    app: AppHandle,
    path: String,
    serial: Option<String>,
    access_mode: Option<FileAccessMode>,
) -> CmdResult<Vec<FileEntry>> {
    let path = path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    validate_path_components(&path)?;
    info!("Listing files at {}", path);
    tokio::task::spawn_blocking(move || {
        let quoted = quote_shell_arg(&path);
        let output = if access_mode == FileAccessMode::Root {
            let cmd = format!("ls -lA {quoted}");
            run_adb_for_serial(&app, serial.as_deref(), &["shell", "su", "-c", &cmd])?
        } else {
            run_adb_for_serial(&app, serial.as_deref(), &["shell", "ls", "-lA", &quoted])?
        };

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
    access_mode: Option<FileAccessMode>,
) -> CmdResult<String> {
    let remote = remote_path.trim().to_string();
    let local = local_path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    validate_path_components(&remote)?;
    info!("Pulling {} to {}", remote, local);
    tokio::task::spawn_blocking(move || {
        if access_mode == FileAccessMode::Root {
            return pull_root_path(&app, serial.as_deref(), &remote, &local);
        }
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
    access_mode: Option<FileAccessMode>,
) -> CmdResult<String> {
    let local = local_path.trim().to_string();
    let remote = remote_path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    validate_write_path_for_mode(&remote, access_mode)?;
    info!("Pushing {} to {}", local, remote);
    tokio::task::spawn_blocking(move || {
        if access_mode == FileAccessMode::Root {
            return push_root_path(&app, serial.as_deref(), &local, &remote);
        }
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
    access_mode: Option<FileAccessMode>,
) -> CmdResult<String> {
    if paths.is_empty() {
        return Err("No paths provided".into());
    }
    let access_mode = access_mode.unwrap_or_default();
    for p in &paths {
        validate_write_path_for_mode(p, access_mode)?;
    }
    let count = paths.len();
    info!("Deleting {} item(s)", count);
    tokio::task::spawn_blocking(move || {
        // Build a single shell command: rm -rf 'path1' 'path2' ...
        let quoted: Vec<String> = paths.iter().map(|p| quote_shell_arg(p.trim())).collect();
        let cmd = format!("rm -rf {}", quoted.join(" "));
        run_shell_for_mode(&app, serial.as_deref(), access_mode, &cmd)?;
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
    access_mode: Option<FileAccessMode>,
) -> CmdResult<String> {
    let old = old_path.trim().to_string();
    let new = new_path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    validate_write_path_for_mode(&old, access_mode)?;
    validate_write_path_for_mode(&new, access_mode)?;
    info!("Renaming '{}' to '{}'", old, new);
    tokio::task::spawn_blocking(move || {
        let old_q = quote_shell_arg(&old);
        let new_q = quote_shell_arg(&new);
        let cmd = format!("mv {old_q} {new_q}");
        run_shell_for_mode(&app, serial.as_deref(), access_mode, &cmd)?;
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
    access_mode: Option<FileAccessMode>,
) -> CmdResult<String> {
    let p = path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    validate_write_path_for_mode(&p, access_mode)?;
    info!("Creating file: {}", p);
    tokio::task::spawn_blocking(move || {
        let quoted = quote_shell_arg(&p);
        let cmd = format!("touch {quoted}");
        run_shell_for_mode(&app, serial.as_deref(), access_mode, &cmd)?;
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
    access_mode: Option<FileAccessMode>,
) -> CmdResult<String> {
    let p = path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    validate_write_path_for_mode(&p, access_mode)?;
    info!("Creating directory: {}", p);
    tokio::task::spawn_blocking(move || {
        let quoted = quote_shell_arg(&p);
        let cmd = format!("mkdir -p {quoted}");
        run_shell_for_mode(&app, serial.as_deref(), access_mode, &cmd)?;
        Ok(format!("Created directory: {p}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn remote_basename(remote: &str) -> &str {
    let trimmed = remote.trim_end_matches('/');
    let name = trimmed.rsplit('/').next().unwrap_or("");
    if name.is_empty() { "root-transfer" } else { name }
}

fn local_basename(local: &str) -> String {
    let normalized = local.replace('\\', "/");
    let name = normalized.rsplit('/').next().unwrap_or("");
    if name.is_empty() { "root-import".to_string() } else { name.to_string() }
}

fn pull_root_path(
    app: &AppHandle,
    serial: Option<&str>,
    remote: &str,
    local: &str,
) -> CmdResult<String> {
    let staging_dir = root_transfer_dir();
    let staged_path = format!("{staging_dir}/{}", remote_basename(remote));
    let setup = format!("mkdir -p {}", quote_shell_arg(&staging_dir));
    let copy = format!("cp -a {} {}", quote_shell_arg(remote), quote_shell_arg(&staging_dir));
    let cleanup = format!("rm -rf {}", quote_shell_arg(&staging_dir));

    run_adb_for_serial(app, serial, &["shell", "su", "-c", &setup])?;
    let copy_result = run_adb_for_serial(app, serial, &["shell", "su", "-c", &copy]);
    if copy_result.is_err() {
        let _ = run_adb_for_serial(app, serial, &["shell", "su", "-c", &cleanup]);
        return copy_result;
    }

    let pull_result = run_adb_for_serial(app, serial, &["pull", "-a", &staged_path, local]);
    let cleanup_result = run_adb_for_serial(app, serial, &["shell", "su", "-c", &cleanup]);

    match (pull_result, cleanup_result) {
        (Ok(output), Ok(_)) => Ok(output),
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(format!("Root export completed but cleanup failed: {error}")),
    }
}

fn push_root_path(
    app: &AppHandle,
    serial: Option<&str>,
    local: &str,
    remote: &str,
) -> CmdResult<String> {
    let staging_dir = root_transfer_dir();
    let staged_path = format!("{staging_dir}/{}", local_basename(local));
    let setup = format!("mkdir -p {}", quote_shell_arg(&staging_dir));
    let copy = format!("cp -a {} {}", quote_shell_arg(&staged_path), quote_shell_arg(remote));
    let cleanup = format!("rm -rf {}", quote_shell_arg(&staging_dir));

    run_adb_for_serial(app, serial, &["shell", "su", "-c", &setup])?;
    let push_result = run_adb_for_serial(app, serial, &["push", local, &staging_dir]);
    if push_result.is_err() {
        let _ = run_adb_for_serial(app, serial, &["shell", "su", "-c", &cleanup]);
        return push_result;
    }

    let copy_result = run_adb_for_serial(app, serial, &["shell", "su", "-c", &copy]);
    let cleanup_result = run_adb_for_serial(app, serial, &["shell", "su", "-c", &cleanup]);

    match (copy_result, cleanup_result) {
        (Ok(_), Ok(_)) => Ok(format!("Pushed {local} to {remote} with root staging")),
        (Err(error), _) => Err(error),
        (Ok(_), Err(error)) => Err(format!("Root import completed but cleanup failed: {error}")),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn root_mode_allows_system_write_paths() {
        assert!(validate_write_path_for_mode("/system/app/example", FileAccessMode::Root).is_ok());
    }

    #[test]
    fn normal_mode_rejects_system_write_paths() {
        assert!(
            validate_write_path_for_mode("/system/app/example", FileAccessMode::Normal).is_err()
        );
    }

    #[test]
    fn root_mode_still_rejects_traversal() {
        assert!(validate_write_path_for_mode("/system/../data", FileAccessMode::Root).is_err());
    }

    #[test]
    fn root_transfer_dir_stays_under_adb_gui_temp_prefix() {
        assert!(root_transfer_dir().starts_with("/data/local/tmp/adb-gui-next-root-transfer/"));
    }
}
