use crate::CmdResult;
use crate::helpers::run_binary_command;
use log::{debug, info};
use serde::Serialize;
use std::{fs, io, path::Path};
use tauri::AppHandle;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub name: String,
    pub package_type: String,
}

fn parse_package_names(output: &str) -> Vec<String> {
    output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|name| name.to_string())
        .collect()
}

#[tauri::command]
pub async fn get_installed_packages(app: AppHandle) -> CmdResult<Vec<InstalledPackage>> {
    info!("Getting installed packages");
    tokio::task::spawn_blocking(move || {
        let user_output =
            run_binary_command(&app, "adb", &["shell", "pm", "list", "packages", "-3"])?;
        let user_names: std::collections::HashSet<String> =
            parse_package_names(&user_output).into_iter().collect();

        let all_output = run_binary_command(&app, "adb", &["shell", "pm", "list", "packages"])?;
        let packages: Vec<InstalledPackage> = parse_package_names(&all_output)
            .into_iter()
            .map(|name| {
                let package_type = if user_names.contains(&name) {
                    "user".to_string()
                } else {
                    "system".to_string()
                };
                InstalledPackage { name, package_type }
            })
            .collect();

        debug!("Found {} installed packages", packages.len());
        Ok(packages)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn install_package(app: AppHandle, path: String) -> CmdResult<String> {
    let path = path.trim().to_string();
    if path.is_empty() {
        return Err("Package path is required.".into());
    }

    if Path::new(&path).extension().is_some_and(|e| e.eq_ignore_ascii_case("apks")) {
        // install_apks is blocking (zip extraction + adb) — offload entirely
        return tokio::task::spawn_blocking(move || install_apks(&app, &path))
            .await
            .map_err(|e| e.to_string())?;
    }

    info!("Installing package from {}", path);
    // adb install blocks for 10–60s per APK — run off the Tokio/main thread
    tokio::task::spawn_blocking(move || run_binary_command(&app, "adb", &["install", "-r", &path]))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn uninstall_package(app: AppHandle, package_name: String) -> CmdResult<String> {
    let package_name = package_name.trim().to_string();
    info!("Uninstalling package {}", package_name);
    tokio::task::spawn_blocking(move || {
        run_binary_command(&app, "adb", &["shell", "pm", "uninstall", &package_name])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn sideload_package(app: AppHandle, path: String) -> CmdResult<String> {
    let path = path.trim().to_string();
    info!("Sideloading package from {}", path);
    tokio::task::spawn_blocking(move || run_binary_command(&app, "adb", &["sideload", &path]))
        .await
        .map_err(|e| e.to_string())?
}

fn install_apks(app: &AppHandle, apks_path: &str) -> CmdResult<String> {
    let file = fs::File::open(apks_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Use tempfile::TempDir for crash-safe cleanup
    let temp_dir = tempfile::TempDir::new().map_err(|e| e.to_string())?;
    let temp_path = temp_dir.path().to_path_buf();

    let mut extracted = Vec::new();

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
        if !entry.name().to_ascii_lowercase().ends_with(".apk") {
            continue;
        }

        let file_name = Path::new(entry.name())
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or_else(|| "Invalid APK entry name.".to_string())?;
        let target = temp_path.join(file_name);
        let mut output = fs::File::create(&target).map_err(|e| e.to_string())?;
        io::copy(&mut entry, &mut output).map_err(|e| e.to_string())?;
        extracted.push(target);
    }

    if extracted.is_empty() {
        return Err("No APK files found in the APKS archive.".into());
    }

    let mut args = vec!["install-multiple".to_string(), "-r".to_string()];
    args.extend(extracted.iter().map(|p| p.to_string_lossy().to_string()));
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    let result = run_binary_command(app, "adb", &arg_refs);
    // TempDir auto-cleans on drop (when temp_dir goes out of scope)
    drop(temp_dir);
    result
}
