use crate::CmdResult;
use crate::commands::device::run_adb_for_serial;
use crate::helpers::{validate_path_components, validate_safe_device_path};
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{
    Arc, Mutex, OnceLock,
    atomic::{AtomicBool, Ordering},
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

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

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeviceTransferMode {
    Copy,
    Cut,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTransferResult {
    pub copied: u32,
    pub moved: u32,
    pub skipped_existing: Vec<String>,
    pub message: String,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum DeviceEditorTarget {
    #[default]
    Default,
    Vscode,
    Notepad,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileEditPushed {
    remote_path: String,
    ok: bool,
    message: String,
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
    let nanos =
        SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |duration| duration.as_nanos());
    format!("/data/local/tmp/adb-gui-next-root-transfer/{}-{nanos}", std::process::id())
}

fn run_shell_for_mode(
    app: &AppHandle,
    serial: Option<&str>,
    access_mode: FileAccessMode,
    cmd: &str,
) -> CmdResult<String> {
    // Critical mutations must verify the remote shell exit code, not only adb host status.
    crate::helpers::adb_shell_checked(app, serial, access_mode == FileAccessMode::Root, cmd)
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

        // adb shell exits with 0 even when the shell command fails — detect common errors.
        let lower = output.to_lowercase();
        if lower.contains("permission denied") {
            return Err(format!("Permission denied: cannot access '{path}'"));
        }
        if lower.contains("no such file")
            || lower.contains("not a directory")
            || lower.contains("not found")
            || lower.contains("no such device")
        {
            return Err(format!("Cannot list '{path}': {output}"));
        }

        let entries = parse_file_entries(&output);
        // Non-empty error-like single line that did not parse as any listing entry.
        if entries.is_empty()
            && !output.trim().is_empty()
            && !output.lines().any(|line| line.split_whitespace().count() >= 8)
        {
            let trimmed = output.trim();
            if trimmed.contains(':') || trimmed.to_lowercase().contains("error") {
                return Err(format!("Cannot list '{path}': {trimmed}"));
            }
        }
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

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn transfer_device_files(
    app: AppHandle,
    mode: DeviceTransferMode,
    sources: Vec<String>,
    dest_dir: String,
    overwrite: bool,
    serial: Option<String>,
    clipboard_serial: String,
    access_mode: Option<FileAccessMode>,
) -> CmdResult<DeviceTransferResult> {
    let access_mode = access_mode.unwrap_or_default();
    let dest_dir = dest_dir.trim().to_string();
    let sources: Vec<String> =
        sources.into_iter().map(|source| source.trim().to_string()).collect();
    paste_guard(mode, &sources, &dest_dir, serial.as_deref(), &clipboard_serial)?;
    validate_write_path_for_mode(&dest_dir, access_mode)?;
    for source in &sources {
        validate_write_path_for_mode(source, access_mode)?;
        validate_write_path_for_mode(&destination_path(&dest_dir, source), access_mode)?;
    }
    info!("Transferring {} item(s) into {dest_dir} ({mode:?})", sources.len());
    tokio::task::spawn_blocking(move || {
        let planned: Vec<(String, String)> = sources
            .iter()
            .map(|source| (source.clone(), destination_path(&dest_dir, source)))
            .collect();
        if !overwrite {
            let mut skipped_existing = Vec::new();
            for (_, dest) in &planned {
                if remote_exists(&app, serial.as_deref(), access_mode, dest)? {
                    skipped_existing.push(dest.clone());
                }
            }
            if !skipped_existing.is_empty() {
                return Ok(DeviceTransferResult {
                    skipped_existing,
                    message: "Destination already exists".into(),
                    ..DeviceTransferResult::default()
                });
            }
        }

        let copy_dir = dest_dir_for_cp(&dest_dir);
        let mut copied = 0_u32;
        let mut moved = 0_u32;
        for (source, dest) in planned {
            let cmd = match mode {
                DeviceTransferMode::Copy => {
                    format!("cp -a {} {}", quote_shell_arg(&source), quote_shell_arg(&copy_dir))
                }
                DeviceTransferMode::Cut => {
                    format!("mv -f {} {}", quote_shell_arg(&source), quote_shell_arg(&dest))
                }
            };
            run_shell_for_mode(&app, serial.as_deref(), access_mode, &cmd)?;
            match mode {
                DeviceTransferMode::Copy => copied += 1,
                DeviceTransferMode::Cut => moved += 1,
            }
        }
        let message = if copied > 0 {
            format!("Copied {copied} item(s)")
        } else {
            format!("Moved {moved} item(s)")
        };
        Ok(DeviceTransferResult { copied, moved, skipped_existing: Vec::new(), message })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn remote_basename(remote: &str) -> &str {
    let trimmed = remote.trim_end_matches('/');
    let name = trimmed.rsplit('/').next().unwrap_or("");
    if name.is_empty() { "root-transfer" } else { name }
}

fn join_remote_dir(dir: &str, name: &str) -> String {
    let trimmed = dir.trim();
    let base = if trimmed == "/" { "" } else { trimmed.trim_end_matches('/') };
    format!("{base}/{name}")
}

fn destination_path(dest_dir: &str, source: &str) -> String {
    join_remote_dir(dest_dir, remote_basename(source))
}

fn normalize_dir(dir: &str) -> String {
    let trimmed = dir.trim();
    if trimmed.is_empty() || trimmed == "/" {
        return "/".into();
    }
    format!("{}/", trimmed.trim_end_matches('/'))
}

fn parent_dir(path: &str) -> String {
    let trimmed = path.trim().trim_end_matches('/');
    match trimmed.rfind('/') {
        None | Some(0) => "/".into(),
        Some(index) => format!("{}/", &trimmed[..index]),
    }
}

fn dest_dir_for_cp(dir: &str) -> String {
    let trimmed = dir.trim();
    if trimmed.is_empty() || trimmed == "/" {
        "/".into()
    } else {
        format!("{}/", trimmed.trim_end_matches('/'))
    }
}

fn paste_guard(
    mode: DeviceTransferMode,
    sources: &[String],
    dest_dir: &str,
    dest_serial: Option<&str>,
    clipboard_serial: &str,
) -> CmdResult<()> {
    if sources.is_empty() {
        return Err("Nothing to paste".into());
    }
    let dest_serial = dest_serial.map(str::trim).filter(|value| !value.is_empty()).unwrap_or("");
    if dest_serial.is_empty() || dest_serial != clipboard_serial.trim() {
        return Err("Clipboard is from another device".into());
    }
    let dest = normalize_dir(dest_dir);
    if sources.iter().all(|source| parent_dir(source) == dest) {
        return Err(match mode {
            DeviceTransferMode::Cut => "Cannot move items into the same folder".into(),
            DeviceTransferMode::Copy => "Items are already in this folder".into(),
        });
    }
    Ok(())
}

fn remote_exists(
    app: &AppHandle,
    serial: Option<&str>,
    access_mode: FileAccessMode,
    path: &str,
) -> CmdResult<bool> {
    let quoted = quote_shell_arg(path);
    let cmd = format!("test -e {quoted}; echo __EXISTS__:$?");
    let output = run_shell_for_mode(app, serial, access_mode, &cmd)?;
    Ok(output.contains("__EXISTS__:0"))
}

fn unique_editor_basename(serial: Option<&str>, remote: &str) -> String {
    let serial = serial.unwrap_or("device");
    let base = remote_basename(remote);
    let ext = Path::new(base).extension().and_then(|value| value.to_str()).unwrap_or("");
    let slug = format!("{serial}_{remote}").replace(['/', '\\', ':', ' '], "_");
    let mut name = crate::helpers::sanitize_filename(&slug);
    if name.is_empty() {
        name = "device-file".into();
    }
    if ext.is_empty() { name } else { format!("{name}.{ext}") }
}

fn file_fingerprint(path: &Path) -> CmdResult<(u128, String)> {
    let meta = std::fs::metadata(path).map_err(|error| error.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_millis());
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    let digest = Sha256::digest(bytes);
    let mut hash = String::with_capacity(digest.len() * 2);
    for byte in digest {
        hash.push_str(&format!("{byte:02x}"));
    }
    Ok((mtime, hash))
}

fn editor_watches() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static WATCHES: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    WATCHES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cancel_editor_watch(remote: &str) {
    if let Ok(mut watches) = editor_watches().lock()
        && let Some(flag) = watches.remove(remote)
    {
        flag.store(true, Ordering::Relaxed);
    }
}

fn start_editor_watch(
    app: AppHandle,
    serial: Option<String>,
    remote: String,
    local: PathBuf,
    access_mode: FileAccessMode,
) {
    cancel_editor_watch(&remote);
    let cancel = Arc::new(AtomicBool::new(false));
    if let Ok(mut watches) = editor_watches().lock() {
        watches.insert(remote.clone(), Arc::clone(&cancel));
    }
    thread::spawn(move || {
        let Ok(mut last) = file_fingerprint(&local) else {
            return;
        };
        loop {
            thread::sleep(Duration::from_millis(500));
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            let Ok(next) = file_fingerprint(&local) else {
                break;
            };
            if next == last {
                continue;
            }
            thread::sleep(Duration::from_millis(400));
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            let Ok(stable) = file_fingerprint(&local) else {
                break;
            };
            if stable == last {
                continue;
            }
            let local_str = local.to_string_lossy().into_owned();
            let result = if access_mode == FileAccessMode::Root {
                push_root_path(&app, serial.as_deref(), &local_str, &remote)
            } else {
                run_adb_for_serial(&app, serial.as_deref(), &["push", &local_str, &remote])
            };
            let event = match result {
                Ok(_) => FileEditPushed {
                    remote_path: remote.clone(),
                    ok: true,
                    message: format!("Saved {remote} to the device"),
                },
                Err(error) => {
                    FileEditPushed { remote_path: remote.clone(), ok: false, message: error }
                }
            };
            if let Err(error) = app.emit("files:edit-pushed", &event) {
                warn!("failed to emit files:edit-pushed: {error}");
            }
            last = stable;
        }
        if let Ok(mut watches) = editor_watches().lock() {
            watches.remove(&remote);
        }
    });
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

const TEXT_EXTENSIONS: &[&str] = &[
    "sh",
    "md",
    "txt",
    "toml",
    "xml",
    "bak",
    "json",
    "conf",
    "prop",
    "log",
    "cfg",
    "ini",
    "yaml",
    "yml",
    "properties",
    "rc",
    "service",
];

fn is_text_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| TEXT_EXTENSIONS.iter().any(|allowed| ext.eq_ignore_ascii_case(allowed)))
}

fn spawn_path(bin: impl AsRef<std::ffi::OsStr>, path: &Path) -> CmdResult<()> {
    std::process::Command::new(bin).arg(path).spawn().map_err(|error| error.to_string())?;
    Ok(())
}

fn spawn_which(name: &str, path: &Path) -> CmdResult<bool> {
    let Ok(bin) = which::which(name) else {
        return Ok(false);
    };
    spawn_path(bin, path)?;
    Ok(true)
}

fn spawn_vscode(path: &Path) -> CmdResult<()> {
    if spawn_which("code", path)? {
        return Ok(());
    }
    Err("VS Code was not found on this computer.".into())
}

fn spawn_notepad(path: &Path) -> CmdResult<()> {
    #[cfg(target_os = "windows")]
    {
        spawn_path("notepad", path)
    }
    #[cfg(target_os = "linux")]
    {
        for editor in ["gedit", "kate"] {
            if spawn_which(editor, path)? {
                return Ok(());
            }
        }
        spawn_path("xdg-open", path)
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-t"])
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        let _ = path;
        Err("opening files in an editor is not supported on this OS".into())
    }
}

fn spawn_editor(path: &Path) -> CmdResult<()> {
    if spawn_which("code", path)? {
        return Ok(());
    }
    spawn_notepad(path)
}

fn spawn_editor_target(path: &Path, target: DeviceEditorTarget) -> CmdResult<()> {
    match target {
        DeviceEditorTarget::Default => spawn_editor(path),
        DeviceEditorTarget::Vscode => spawn_vscode(path),
        DeviceEditorTarget::Notepad => spawn_notepad(path),
    }
}

#[tauri::command]
pub async fn open_device_file_in_editor(
    app: AppHandle,
    remote_path: String,
    serial: Option<String>,
    access_mode: Option<FileAccessMode>,
    target: Option<DeviceEditorTarget>,
) -> CmdResult<String> {
    let remote = remote_path.trim().to_string();
    let access_mode = access_mode.unwrap_or_default();
    let target = target.unwrap_or_default();
    validate_path_components(&remote)?;
    if !is_text_extension(&remote) {
        return Err("This file type cannot be opened as text.".into());
    }
    let file_name = unique_editor_basename(serial.as_deref(), &remote);
    tokio::task::spawn_blocking(move || {
        let dir = std::env::temp_dir().join("adb-gui-next-editors");
        std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
        let local = dir.join(&file_name);
        let local_str = local.to_string_lossy().into_owned();
        if access_mode == FileAccessMode::Root {
            pull_root_path(&app, serial.as_deref(), &remote, &local_str)?;
        } else {
            run_adb_for_serial(&app, serial.as_deref(), &["pull", "-a", &remote, &local_str])?;
        }
        spawn_editor_target(&local, target)?;
        start_editor_watch(app.clone(), serial.clone(), remote.clone(), local, access_mode);
        Ok(format!("Opened {file_name} in a local editor"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn reveal_device_path_in_explorer(
    app: AppHandle,
    remote_path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let remote = remote_path.trim().to_string();
    validate_path_components(&remote)?;
    tokio::task::spawn_blocking(move || {
        crate::mtp::reveal_device_path(&app, serial.as_deref(), &remote)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_remote_dir_root_and_nested() {
        assert_eq!(join_remote_dir("/", "hosts"), "/hosts");
        assert_eq!(join_remote_dir("/sdcard/", "Download"), "/sdcard/Download");
        assert_eq!(destination_path("/sdcard/Music/", "/sdcard/DCIM/a.mp3"), "/sdcard/Music/a.mp3");
        assert_eq!(parent_dir("/sdcard/DCIM/a.mp3"), "/sdcard/DCIM/");
        assert_eq!(normalize_dir("/sdcard/DCIM"), "/sdcard/DCIM/");
    }

    #[test]
    fn paste_guard_blocks_empty_wrong_device_and_same_folder() {
        let sources = vec!["/sdcard/DCIM/a.mp3".into()];
        assert_eq!(
            paste_guard(DeviceTransferMode::Copy, &[], "/sdcard/Music/", Some("a"), "a")
                .unwrap_err(),
            "Nothing to paste"
        );
        assert_eq!(
            paste_guard(DeviceTransferMode::Copy, &sources, "/sdcard/Music/", Some("b"), "a")
                .unwrap_err(),
            "Clipboard is from another device"
        );
        assert_eq!(
            paste_guard(DeviceTransferMode::Copy, &sources, "/sdcard/DCIM/", Some("a"), "a")
                .unwrap_err(),
            "Items are already in this folder"
        );
        assert_eq!(
            paste_guard(DeviceTransferMode::Cut, &sources, "/sdcard/DCIM/", Some("a"), "a")
                .unwrap_err(),
            "Cannot move items into the same folder"
        );
        assert!(
            paste_guard(DeviceTransferMode::Copy, &sources, "/sdcard/Music/", Some("a"), "a")
                .is_ok()
        );
    }

    #[test]
    fn unique_editor_basename_includes_serial_and_remote() {
        let name = unique_editor_basename(Some("pixel"), "/sdcard/Download/note.txt");
        assert!(name.contains("pixel"));
        assert!(name.ends_with(".txt"));
        assert!(!name.contains('/'));
    }

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

    #[test]
    fn parser_keeps_hidden_dotfiles() {
        let listing = "\
total 8
drwxr-xr-x 2 root root 4096 2026-01-01 12:00 .config
-rw-r--r-- 1 root root    12 2026-01-01 12:00 .bashrc
-rw-r--r-- 1 root root     4 2026-01-01 12:00 visible.txt
";
        let names: Vec<_> = parse_file_entries(listing).into_iter().map(|e| e.name).collect();
        assert!(names.contains(&".config".into()));
        assert!(names.contains(&".bashrc".into()));
        assert!(names.contains(&"visible.txt".into()));
    }

    #[test]
    fn text_extension_allowlist() {
        assert!(is_text_extension("init.rc"));
        assert!(is_text_extension("build.prop"));
        assert!(!is_text_extension("boot.img"));
        assert!(!is_text_extension("archive.zip"));
    }
}
