mod payload;

use crate::payload::{ExtractPayloadResult, PartitionDetail, PayloadCache};
use serde::Serialize;
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

const DEFAULT_LOG_PREFIX: &str = "adb_gui_next_log";
const DEFAULT_ADB_PORT: &str = "5555";
const VALUE_NOT_AVAILABLE: &str = "N/A";
const VALUE_NOT_AVAILABLE_WIFI: &str = "N/A (Not on WiFi?)";

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
struct Device {
    serial: String,
    status: String,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct DeviceInfo {
    model: String,
    android_version: String,
    build_number: String,
    battery_level: String,
    serial: String,
    ip_address: String,
    root_status: String,
    codename: String,
    ram_total: String,
    storage_info: String,
    brand: String,
    device_name: String,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    r#type: String,
    size: String,
    permissions: String,
    date: String,
    time: String,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct InstalledPackage {
    name: String,
}

type CmdResult<T> = Result<T, String>;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello {}, It's show time!", name)
}

#[tauri::command]
fn cleanup_payload_cache(payload_cache: State<PayloadCache>) -> CmdResult<()> {
    payload_cache.cleanup().map_err(|error| error.to_string())
}

#[tauri::command]
fn connect_wireless_adb(app: AppHandle, ip: String, port: String) -> CmdResult<String> {
    let address = format!("{}:{}", ip.trim(), default_if_empty(&port, DEFAULT_ADB_PORT));
    let output = run_binary_command(&app, "adb", &["connect", &address])?;
    if output.contains("connected to") || output.contains("already connected to") {
        Ok(output)
    } else if output.is_empty() {
        Err(format!("Failed to connect to {address}."))
    } else {
        Err(output)
    }
}

#[tauri::command]
fn disconnect_wireless_adb(app: AppHandle, ip: String, port: String) -> CmdResult<String> {
    let address = format!("{}:{}", ip.trim(), default_if_empty(&port, DEFAULT_ADB_PORT));
    let output = run_binary_command(&app, "adb", &["disconnect", &address])?;
    Ok(if output.is_empty() { format!("Disconnected from {address}") } else { output })
}

#[tauri::command]
fn enable_wireless_adb(app: AppHandle, port: String) -> CmdResult<String> {
    let port = default_if_empty(&port, DEFAULT_ADB_PORT);
    run_binary_command(&app, "adb", &["tcpip", port])
}

#[tauri::command]
fn extract_payload(
    app: AppHandle,
    payload_cache: State<PayloadCache>,
    payload_path: String,
    output_dir: String,
    selected_partitions: Vec<String>,
) -> CmdResult<ExtractPayloadResult> {
    let output_dir = (!output_dir.trim().is_empty()).then(|| PathBuf::from(output_dir.trim()));
    match payload::extract_payload(
        Path::new(payload_path.trim()),
        output_dir.as_deref(),
        &selected_partitions,
        &payload_cache,
        |partition_name, current, total, completed| {
            let _ = app.emit(
                "payload:progress",
                serde_json::json!({
                    "partitionName": partition_name,
                    "current": current,
                    "total": total,
                    "completed": completed,
                }),
            );
        },
    ) {
        Ok(result) => Ok(result),
        Err(error) => Ok(ExtractPayloadResult {
            success: false,
            output_dir: String::new(),
            extracted_files: Vec::new(),
            error: Some(error.to_string()),
        }),
    }
}

#[tauri::command]
fn flash_partition(app: AppHandle, partition: String, image_path: String) -> CmdResult<()> {
    if partition.trim().is_empty() || image_path.trim().is_empty() {
        return Err("Partition and image path are required.".into());
    }
    let _ = run_binary_command(&app, "fastboot", &["flash", partition.trim(), image_path.trim()])?;
    Ok(())
}

#[tauri::command]
fn get_bootloader_variables(app: AppHandle) -> CmdResult<String> {
    run_binary_command_allow_output_on_failure(&app, "fastboot", &["getvar", "all"])
}

#[tauri::command]
fn get_device_info(app: AppHandle) -> CmdResult<DeviceInfo> {
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

#[tauri::command]
fn get_device_mode(app: AppHandle) -> CmdResult<String> {
    if !get_devices(app.clone())?.is_empty() {
        return Ok("adb".into());
    }
    if !get_fastboot_devices(app)?.is_empty() {
        return Ok("fastboot".into());
    }
    Ok("unknown".into())
}

#[tauri::command]
fn get_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    let output = run_binary_command(&app, "adb", &["devices"])?;
    let mut devices = Vec::new();

    for line in output.lines().skip(1) {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() == 2 {
            devices.push(Device { serial: parts[0].to_string(), status: parts[1].to_string() });
        }
    }

    Ok(devices)
}

#[tauri::command]
fn get_fastboot_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    let output = run_binary_command(&app, "fastboot", &["devices"])?;
    let mut devices = Vec::new();

    for line in output.lines() {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() >= 2 && matches!(parts[1], "fastboot" | "bootloader") {
            devices.push(Device { serial: parts[0].to_string(), status: parts[1].to_string() });
        }
    }

    Ok(devices)
}

#[tauri::command]
fn get_installed_packages(app: AppHandle) -> CmdResult<Vec<InstalledPackage>> {
    let output = run_binary_command(&app, "adb", &["shell", "pm", "list", "packages"])?;
    let packages = output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|name| InstalledPackage { name: name.to_string() })
        .collect();
    Ok(packages)
}

#[tauri::command]
fn install_package(app: AppHandle, path: String) -> CmdResult<String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Package path is required.".into());
    }

    if path.to_ascii_lowercase().ends_with(".apks") {
        return install_apks(&app, path);
    }

    run_binary_command(&app, "adb", &["install", "-r", path])
}

#[tauri::command]
fn launch_device_manager() -> CmdResult<()> {
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
fn launch_terminal() -> CmdResult<()> {
    let directory = binary_working_directory(None)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

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
fn list_files(app: AppHandle, path: String) -> CmdResult<Vec<FileEntry>> {
    let output = run_binary_command(&app, "adb", &["shell", "ls", "-lA", path.trim()])?;
    Ok(parse_file_entries(&output))
}

#[tauri::command]
fn list_payload_partitions(
    payload_cache: State<PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<String>> {
    payload::list_payload_partitions(Path::new(payload_path.trim()), &payload_cache)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_payload_partitions_with_details(
    payload_cache: State<PayloadCache>,
    payload_path: String,
) -> CmdResult<Vec<PartitionDetail>> {
    payload::list_payload_partitions_with_details(Path::new(payload_path.trim()), &payload_cache)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_folder(app: AppHandle, folder_path: String) -> CmdResult<()> {
    if folder_path.trim().is_empty() {
        return Err("Folder path is empty.".into());
    }

    app.opener().open_path(folder_path, None::<&str>).map_err(|error| error.to_string())
}

#[tauri::command]
fn pull_file(app: AppHandle, remote_path: String, local_path: String) -> CmdResult<String> {
    run_binary_command(&app, "adb", &["pull", "-a", remote_path.trim(), local_path.trim()])
}

#[tauri::command]
fn push_file(app: AppHandle, local_path: String, remote_path: String) -> CmdResult<String> {
    run_binary_command(&app, "adb", &["push", local_path.trim(), remote_path.trim()])
}

#[tauri::command]
fn reboot(app: AppHandle, mode: String) -> CmdResult<()> {
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
fn run_adb_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    let args = split_args(&command);
    run_binary_command(&app, "adb", &args)
}

#[tauri::command]
fn run_fastboot_host_command(app: AppHandle, command: String) -> CmdResult<String> {
    let args = split_args(&command);
    run_binary_command(&app, "fastboot", &args)
}

#[tauri::command]
fn run_shell_command(app: AppHandle, command: String) -> CmdResult<String> {
    let command = command.trim();
    if command.is_empty() {
        return Err("Shell command is empty.".into());
    }
    run_binary_command(&app, "adb", &["shell", command])
}

#[tauri::command]
fn save_log(content: String, prefix: String) -> CmdResult<String> {
    let logs_dir = PathBuf::from("logs");
    fs::create_dir_all(&logs_dir).map_err(|error| error.to_string())?;

    let prefix = default_if_empty(&prefix, DEFAULT_LOG_PREFIX);
    let timestamp =
        SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_secs();
    let file_path = logs_dir.join(format!("{prefix}_{timestamp}.txt"));

    fs::write(&file_path, content).map_err(|error| error.to_string())?;
    Ok(normalize_path(&file_path))
}

#[tauri::command]
fn select_apk_file() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_directory_for_pull() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_directory_to_push() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_file_to_push() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_image_file() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_multiple_apk_files() -> CmdResult<Vec<String>> {
    Ok(Vec::new())
}

#[tauri::command]
fn select_output_directory() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_payload_file() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_save_directory(_default_name: String) -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn select_zip_file() -> CmdResult<String> {
    Ok(String::new())
}

#[tauri::command]
fn set_active_slot(app: AppHandle, slot: String) -> CmdResult<()> {
    let _ = run_binary_command(&app, "fastboot", &[&format!("--set-active={}", slot.trim())])?;
    Ok(())
}

#[tauri::command]
fn sideload_package(app: AppHandle, path: String) -> CmdResult<String> {
    run_binary_command(&app, "adb", &["sideload", path.trim()])
}

#[tauri::command]
fn uninstall_package(app: AppHandle, package_name: String) -> CmdResult<String> {
    run_binary_command(&app, "adb", &["shell", "pm", "uninstall", package_name.trim()])
}

#[tauri::command]
fn wipe_data(app: AppHandle) -> CmdResult<()> {
    let _ = run_binary_command(&app, "fastboot", &["-w"])?;
    Ok(())
}

fn default_if_empty<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback
    } else {
        trimmed
    }
}

fn split_args(command: &str) -> Vec<&str> {
    command.split_whitespace().collect()
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

#[derive(Clone, Copy)]
enum ConnectionMode {
    Adb,
    Fastboot,
    Unknown,
}

fn current_connection_mode(app: &AppHandle) -> CmdResult<ConnectionMode> {
    if !get_devices(app.clone())?.is_empty() {
        return Ok(ConnectionMode::Adb);
    }
    if !get_fastboot_devices(app.clone())?.is_empty() {
        return Ok(ConnectionMode::Fastboot);
    }
    Ok(ConnectionMode::Unknown)
}

fn resolve_binary_path(app: &AppHandle, name: &str) -> CmdResult<PathBuf> {
    let file_name = binary_name(name);
    let os_dir = if cfg!(target_os = "windows") { "windows" } else { "linux" };

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join(os_dir).join(&file_name),
            resource_dir.join("resources").join(os_dir).join(&file_name),
        ];

        for candidate in candidates {
            if candidate.exists() {
                ensure_executable_if_needed(&candidate)?;
                return Ok(candidate);
            }
        }
    }

    if let Ok(repo_root) = std::env::current_dir() {
        let candidate = repo_root.join("src-tauri").join("resources").join(os_dir).join(&file_name);
        if candidate.exists() {
            ensure_executable_if_needed(&candidate)?;
            return Ok(candidate);
        }

        let legacy_candidate = repo_root
            .join("docs")
            .join("adb-gui-kit")
            .join("refernces")
            .join("backend")
            .join("bin")
            .join(os_dir)
            .join(&file_name);
        if legacy_candidate.exists() {
            ensure_executable_if_needed(&legacy_candidate)?;
            return Ok(legacy_candidate);
        }
    }

    which::which(&file_name)
        .map_err(|_| format!("Unable to locate bundled or system binary for {name}."))
}

fn binary_working_directory(app: Option<&AppHandle>) -> Option<PathBuf> {
    let os_dir = if cfg!(target_os = "windows") { "windows" } else { "linux" };

    if let Some(app) = app {
        if let Ok(resource_dir) = app.path().resource_dir() {
            for candidate in
                [resource_dir.join(os_dir), resource_dir.join("resources").join(os_dir)]
            {
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    std::env::current_dir().ok().and_then(|repo_root| {
        let candidate = repo_root.join("src-tauri").join("resources").join(os_dir);
        candidate.exists().then_some(candidate)
    })
}

fn ensure_executable_if_needed(_path: &Path) -> CmdResult<()> {
    #[cfg(target_family = "unix")]
    {
        use std::os::unix::fs::PermissionsExt;

        let metadata = fs::metadata(_path).map_err(|error| error.to_string())?;
        let mut permissions = metadata.permissions();
        if permissions.mode() & 0o111 == 0 {
            permissions.set_mode(permissions.mode() | 0o755);
            fs::set_permissions(_path, permissions).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn run_binary_command(app: &AppHandle, binary: &str, args: &[&str]) -> CmdResult<String> {
    let command_output = run_command_capture(app, binary, args)?;
    if command_output.success {
        Ok(command_output.combined)
    } else if !command_output.stderr.is_empty() {
        Err(command_output.stderr)
    } else if !command_output.combined.is_empty() {
        Err(command_output.combined)
    } else {
        Err(format!("{binary} command failed."))
    }
}

fn run_binary_command_allow_output_on_failure(
    app: &AppHandle,
    binary: &str,
    args: &[&str],
) -> CmdResult<String> {
    let command_output = run_command_capture(app, binary, args)?;
    if command_output.success || !command_output.combined.is_empty() {
        Ok(command_output.combined)
    } else {
        Err(format!("{binary} command failed."))
    }
}

struct CommandOutput {
    success: bool,
    stderr: String,
    combined: String,
}

fn run_command_capture(app: &AppHandle, binary: &str, args: &[&str]) -> CmdResult<CommandOutput> {
    let binary_path = resolve_binary_path(app, binary)?;
    let output = Command::new(binary_path)
        .args(args)
        .current_dir(
            binary_working_directory(Some(app))
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
        )
        .output()
        .map_err(|error| error.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = match (stdout.is_empty(), stderr.is_empty()) {
        (false, false) => format!("{stdout}\n{stderr}"),
        (false, true) => stdout.clone(),
        (true, false) => stderr.clone(),
        (true, true) => String::new(),
    };

    Ok(CommandOutput { success: output.status.success(), stderr, combined })
}

fn get_prop(app: &AppHandle, prop: &str) -> String {
    run_binary_command(app, "adb", &["shell", "getprop", prop])
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| VALUE_NOT_AVAILABLE.into())
}

fn get_serial(app: &AppHandle) -> String {
    run_binary_command(app, "adb", &["get-serialno"])
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| get_prop(app, "ro.serialno"))
}

fn get_root_status(app: &AppHandle) -> String {
    let output = run_binary_command(app, "adb", &["shell", "su", "-c", "id -u"]);
    if matches!(output.as_deref(), Ok("0")) {
        "Yes".into()
    } else {
        "No".into()
    }
}

fn get_ip_address(app: &AppHandle) -> String {
    if let Ok(output) = run_binary_command(app, "adb", &["shell", "ip", "addr", "show", "wlan0"]) {
        if let Some(ip) = output
            .split_whitespace()
            .collect::<Vec<_>>()
            .windows(2)
            .find_map(|chunk| (chunk[0] == "inet").then_some(chunk[1]))
        {
            return ip.split('/').next().unwrap_or(ip).to_string();
        }
    }

    let fallback = get_prop(app, "dhcp.wlan0.ipaddress");
    if fallback == VALUE_NOT_AVAILABLE {
        VALUE_NOT_AVAILABLE_WIFI.into()
    } else {
        fallback
    }
}

fn get_battery_level(app: &AppHandle) -> String {
    if let Ok(output) = run_binary_command(app, "adb", &["shell", "dumpsys battery | grep level"]) {
        if let Some(level) = output.split(':').nth(1) {
            return format!("{}%", level.trim());
        }
    }
    VALUE_NOT_AVAILABLE.into()
}

fn get_ram_total(app: &AppHandle) -> String {
    if let Ok(output) =
        run_binary_command(app, "adb", &["shell", "cat /proc/meminfo | grep MemTotal"])
    {
        if let Some(value) = output.split_whitespace().nth(1) {
            if let Ok(kb) = value.parse::<f64>() {
                return format!("{:.1} GB", kb / 1024.0 / 1024.0);
            }
        }
    }
    VALUE_NOT_AVAILABLE.into()
}

fn get_storage_info(app: &AppHandle) -> String {
    if let Ok(output) = run_binary_command(app, "adb", &["shell", "df /data"]) {
        if let Some(line) = output.lines().nth(1) {
            let parts: Vec<_> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                if let (Ok(total), Ok(used)) = (parts[1].parse::<f64>(), parts[2].parse::<f64>()) {
                    return format!(
                        "{:.1} GB / {:.1} GB",
                        used / 1024.0 / 1024.0,
                        total / 1024.0 / 1024.0
                    );
                }
            }
        }
    }
    VALUE_NOT_AVAILABLE.into()
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

fn install_apks(app: &AppHandle, apks_path: &str) -> CmdResult<String> {
    let file = fs::File::open(apks_path).map_err(|error| error.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| error.to_string())?;

    let temp_dir = std::env::temp_dir().join(format!(
        "adb-gui-next-apks-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis()
    ));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let mut extracted = Vec::new();

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        if !entry.name().to_ascii_lowercase().ends_with(".apk") {
            continue;
        }

        let file_name = Path::new(entry.name())
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Invalid APK entry name.".to_string())?;
        let target = temp_dir.join(file_name);
        let mut output = fs::File::create(&target).map_err(|error| error.to_string())?;
        io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
        extracted.push(target);
    }

    if extracted.is_empty() {
        return Err("No APK files found in the APKS archive.".into());
    }

    let mut args = vec!["install-multiple".to_string(), "-r".to_string()];
    args.extend(extracted.iter().map(|path| path.to_string_lossy().to_string()));
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    let result = run_binary_command(app, "adb", &arg_refs);
    let _ = fs::remove_dir_all(&temp_dir);
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PayloadCache::default())
        .invoke_handler(tauri::generate_handler![
            cleanup_payload_cache,
            connect_wireless_adb,
            disconnect_wireless_adb,
            enable_wireless_adb,
            extract_payload,
            flash_partition,
            get_bootloader_variables,
            get_device_info,
            get_device_mode,
            get_devices,
            get_fastboot_devices,
            get_installed_packages,
            greet,
            install_package,
            launch_device_manager,
            launch_terminal,
            list_files,
            list_payload_partitions,
            list_payload_partitions_with_details,
            open_folder,
            pull_file,
            push_file,
            reboot,
            run_adb_host_command,
            run_fastboot_host_command,
            run_shell_command,
            save_log,
            select_apk_file,
            select_directory_for_pull,
            select_directory_to_push,
            select_file_to_push,
            select_image_file,
            select_multiple_apk_files,
            select_output_directory,
            select_payload_file,
            select_save_directory,
            select_zip_file,
            set_active_slot,
            sideload_package,
            uninstall_package,
            wipe_data
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }) {
                let payload_cache = app_handle.state::<PayloadCache>();
                let _ = payload_cache.cleanup();
            }
        });
}
