use crate::CmdResult;
use crate::helpers::run_binary_command;
use serde::Serialize;
use std::{
    fs, io,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::AppHandle;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub name: String,
}

#[tauri::command]
pub fn get_installed_packages(app: AppHandle) -> CmdResult<Vec<InstalledPackage>> {
    let output = run_binary_command(&app, "adb", &["shell", "pm", "list", "packages"])?;
    let packages = output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|name| InstalledPackage { name: name.to_string() })
        .collect();
    Ok(packages)
}

#[tauri::command]
pub fn install_package(app: AppHandle, path: String) -> CmdResult<String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Package path is required.".into());
    }

    if Path::new(path).extension().is_some_and(|extension| extension.eq_ignore_ascii_case("apks")) {
        return install_apks(&app, path);
    }

    run_binary_command(&app, "adb", &["install", "-r", path])
}

#[tauri::command]
pub fn uninstall_package(app: AppHandle, package_name: String) -> CmdResult<String> {
    run_binary_command(&app, "adb", &["shell", "pm", "uninstall", package_name.trim()])
}

#[tauri::command]
pub fn sideload_package(app: AppHandle, path: String) -> CmdResult<String> {
    run_binary_command(&app, "adb", &["sideload", path.trim()])
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
