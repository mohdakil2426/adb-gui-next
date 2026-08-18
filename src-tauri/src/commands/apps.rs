use crate::CmdResult;
use crate::commands::device::run_adb_for_serial;
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs, io,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub name: String,
    pub package_type: String,
    pub label: String,
    pub is_disabled: bool,
    pub target_sdk: u32,
    pub min_sdk: u32,
    pub apk_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BatchInstallResult {
    pub path: String,
    pub package_name: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

fn parse_package_names(output: &str) -> Vec<String> {
    output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|name| name.to_string())
        .collect()
}

fn resolve_resource_path(app: &AppHandle, name: &str) -> CmdResult<PathBuf> {
    let os_dir = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join(os_dir).join(name),
            resource_dir.join("resources").join(os_dir).join(name),
        ];

        for candidate in candidates {
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    if let Ok(repo_root) = std::env::current_dir() {
        let candidate = repo_root.join("src-tauri").join("resources").join(os_dir).join(name);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!("Unable to locate resource file: {name}"))
}

#[tauri::command]
pub async fn get_installed_packages(
    app: AppHandle,
    serial: Option<String>,
) -> CmdResult<Vec<InstalledPackage>> {
    info!("Getting installed packages");
    tokio::task::spawn_blocking(move || {
        let serial = serial.as_deref();

        // 1. Resolve and push the helper jar to the device
        let mut labels_map = std::collections::HashMap::new();
        if let Ok(jar_path) = resolve_resource_path(&app, "label_reader.jar") {
            let jar_path_str = jar_path.to_string_lossy();
            if run_adb_for_serial(
                &app,
                serial,
                &["push", &jar_path_str, "/data/local/tmp/label_reader.jar"],
            )
            .is_ok()
            {
                // 2. Execute the helper jar on the device
                if let Ok(output) = run_adb_for_serial(
                    &app,
                    serial,
                    &[
                        "shell",
                        "CLASSPATH=/data/local/tmp/label_reader.jar",
                        "app_process",
                        "/data/local/tmp",
                        "com.helper.Main",
                    ],
                ) {
                    for line in output.lines() {
                        if let Some(idx) = line.find('=') {
                            let (pkg_name, label) = line.split_at(idx);
                            let label = &label[1..];
                            let pkg_name = pkg_name.trim().to_string();
                            let label = label.trim().to_string();
                            if !pkg_name.is_empty() && !label.is_empty() {
                                labels_map.insert(pkg_name, label);
                            }
                        }
                    }
                } else {
                    log::warn!("Failed to execute label_reader.jar on-device");
                }
            } else {
                log::warn!("Failed to push label_reader.jar to device");
            }
        } else {
            log::warn!("Failed to resolve label_reader.jar local path");
        }

        // 3. Fetch package lists: user packages (-3), disabled packages (-d), and all packages (-u)
        let user_output =
            run_adb_for_serial(&app, serial, &["shell", "pm", "list", "packages", "-3"])
                .unwrap_or_default();
        let user_names: HashSet<String> = parse_package_names(&user_output).into_iter().collect();

        let disabled_output =
            run_adb_for_serial(&app, serial, &["shell", "pm", "list", "packages", "-d"])
                .unwrap_or_default();
        let disabled_names: HashSet<String> =
            parse_package_names(&disabled_output).into_iter().collect();

        let all_output =
            run_adb_for_serial(&app, serial, &["shell", "pm", "list", "packages", "-u"]).or_else(
                |_| run_adb_for_serial(&app, serial, &["shell", "pm", "list", "packages"]),
            )?;

        // 4. Extract targetSdk and minSdk from dumpsys package in a single pass
        let mut sdk_map: HashMap<String, (u32, u32)> = HashMap::new();
        if let Ok(dumpsys_out) = run_adb_for_serial(&app, serial, &["shell", "dumpsys", "package"])
        {
            let mut current_pkg = String::new();
            for line in dumpsys_out.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("Package [") && trimmed.contains(']') {
                    if let Some(start) = trimmed.find('[')
                        && let Some(end) = trimmed[start + 1..].find(']')
                    {
                        current_pkg = trimmed[start + 1..start + 1 + end].to_string();
                    }
                } else if !current_pkg.is_empty() && trimmed.contains("targetSdk=") {
                    let mut target_sdk = 34u32;
                    let mut min_sdk = 26u32;
                    for part in trimmed.split_whitespace() {
                        if let Some(s) = part.strip_prefix("targetSdk=") {
                            if let Ok(v) = s.parse::<u32>() {
                                target_sdk = v;
                            }
                        } else if let Some(s) = part.strip_prefix("minSdk=")
                            && let Ok(v) = s.parse::<u32>()
                        {
                            min_sdk = v;
                        }
                    }
                    sdk_map.insert(current_pkg.clone(), (target_sdk, min_sdk));
                }
            }
        }

        // 5. Extract package size map from dumpsys diskstats if available
        let mut size_map: HashMap<String, u64> = HashMap::new();
        if let Ok(diskstats_out) =
            run_adb_for_serial(&app, serial, &["shell", "dumpsys", "diskstats"])
        {
            let mut pkg_names: Vec<String> = Vec::new();
            let mut app_sizes: Vec<u64> = Vec::new();
            for line in diskstats_out.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("Package Names:") {
                    if let Some(start) = trimmed.find('[')
                        && let Some(end) = trimmed.rfind(']')
                    {
                        pkg_names = trimmed[start + 1..end]
                            .split(',')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                } else if trimmed.starts_with("App Sizes:")
                    && let Some(start) = trimmed.find('[')
                    && let Some(end) = trimmed.rfind(']')
                {
                    app_sizes = trimmed[start + 1..end]
                        .split(',')
                        .filter_map(|s| s.trim().parse::<u64>().ok())
                        .collect();
                }
            }
            for (i, name) in pkg_names.into_iter().enumerate() {
                if let Some(&sz) = app_sizes.get(i) {
                    size_map.insert(name, sz);
                }
            }
        }

        let mut seen_names = HashSet::new();
        let mut packages = Vec::new();

        for name in parse_package_names(&all_output) {
            if seen_names.insert(name.clone()) {
                let is_user = user_names.contains(&name);
                let package_type = if is_user { "user".to_string() } else { "system".to_string() };
                let is_disabled = disabled_names.contains(&name);
                let label = labels_map.get(&name).cloned().unwrap_or_else(|| name.clone());
                let (target_sdk, min_sdk) = sdk_map.get(&name).copied().unwrap_or((34, 26));
                let apk_size_bytes = size_map.get(&name).copied().unwrap_or(if is_user {
                    24_000_000
                } else {
                    12_000_000
                });
                packages.push(InstalledPackage {
                    name,
                    package_type,
                    label,
                    is_disabled,
                    target_sdk,
                    min_sdk,
                    apk_size_bytes,
                });
            }
        }

        for name in disabled_names {
            if seen_names.insert(name.clone()) {
                let is_user = user_names.contains(&name);
                let package_type = if is_user { "user".to_string() } else { "system".to_string() };
                let label = labels_map.get(&name).cloned().unwrap_or_else(|| name.clone());
                let (target_sdk, min_sdk) = sdk_map.get(&name).copied().unwrap_or((34, 26));
                let apk_size_bytes = size_map.get(&name).copied().unwrap_or(if is_user {
                    24_000_000
                } else {
                    12_000_000
                });
                packages.push(InstalledPackage {
                    name,
                    package_type,
                    label,
                    is_disabled: true,
                    target_sdk,
                    min_sdk,
                    apk_size_bytes,
                });
            }
        }

        debug!("Found {} installed packages", packages.len());
        Ok(packages)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn get_app_overview_telemetry(
    app: AppHandle,
    serial: Option<String>,
) -> CmdResult<crate::apps::AppOverviewTelemetry> {
    tokio::task::spawn_blocking(move || {
        crate::apps::get_app_overview_telemetry(&app, serial.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn batch_install_packages(
    app: AppHandle,
    paths: Vec<String>,
    serial: Option<String>,
    flags: Vec<String>,
) -> CmdResult<Vec<BatchInstallResult>> {
    info!("Batch installing {} packages", paths.len());
    tokio::task::spawn_blocking(move || {
        let mut results = Vec::with_capacity(paths.len());
        for path_str in paths {
            let path = path_str.trim().to_string();
            if path.is_empty() {
                continue;
            }

            let pkg_name = crate::commands::apk_inspector::inspect_package_file_sync(&path)
                .ok()
                .map(|info| info.package_name)
                .filter(|n| !n.is_empty());

            let is_archive = Path::new(&path).extension().is_some_and(|e| {
                e.eq_ignore_ascii_case("apks")
                    || e.eq_ignore_ascii_case("xapk")
                    || e.eq_ignore_ascii_case("apkm")
            });

            let install_res = if is_archive {
                install_apks(&app, &path, serial.as_deref(), Some(flags.clone()))
            } else {
                let mut args = vec!["install".to_string()];
                if !flags.is_empty() {
                    args.extend(flags.clone());
                } else {
                    args.push("-r".to_string());
                }
                args.push(path.clone());
                let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
                run_adb_for_serial(&app, serial.as_deref(), &arg_refs)
            };

            match install_res {
                Ok(output) => {
                    if output.contains("Failure [") || output.contains("INSTALL_FAILED_") {
                        results.push(BatchInstallResult {
                            path,
                            package_name: pkg_name,
                            success: false,
                            error: Some(output.trim().to_string()),
                        });
                    } else {
                        results.push(BatchInstallResult {
                            path,
                            package_name: pkg_name,
                            success: true,
                            error: None,
                        });
                    }
                }
                Err(err) => {
                    results.push(BatchInstallResult {
                        path,
                        package_name: pkg_name,
                        success: false,
                        error: Some(err),
                    });
                }
            }
        }
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_app_icons(
    app: AppHandle,
    serial: Option<String>,
    packages: Vec<String>,
) -> CmdResult<Vec<crate::app_icons::AppIcon>> {
    tokio::task::spawn_blocking(move || {
        crate::app_icons::get_icons(&app, serial.as_deref(), &packages)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn install_package(
    app: AppHandle,
    path: String,
    serial: Option<String>,
    flags: Option<Vec<String>>,
) -> CmdResult<String> {
    let path = path.trim().to_string();
    if path.is_empty() {
        return Err("Package path is required.".into());
    }

    let is_archive = Path::new(&path).extension().is_some_and(|e| {
        e.eq_ignore_ascii_case("apks")
            || e.eq_ignore_ascii_case("xapk")
            || e.eq_ignore_ascii_case("apkm")
    });

    if is_archive {
        // install_apks is blocking (zip extraction + adb) — offload entirely
        return tokio::task::spawn_blocking(move || {
            install_apks(&app, &path, serial.as_deref(), flags)
        })
        .await
        .map_err(|e| e.to_string())?;
    }

    info!("Installing package from {}", path);
    // adb install blocks for 10–60s per APK — run off the Tokio/main thread
    tokio::task::spawn_blocking(move || {
        let mut args = vec!["install".to_string()];
        if let Some(user_flags) = flags {
            if !user_flags.is_empty() {
                args.extend(user_flags);
            } else {
                args.push("-r".to_string());
            }
        } else {
            args.push("-r".to_string());
        }
        args.push(path);
        let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
        run_adb_for_serial(&app, serial.as_deref(), &arg_refs)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn uninstall_package(
    app: AppHandle,
    package_name: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let package_name = package_name.trim().to_string();
    info!("Uninstalling package {}", package_name);
    tokio::task::spawn_blocking(move || {
        run_adb_for_serial(&app, serial.as_deref(), &["shell", "pm", "uninstall", &package_name])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn sideload_package(
    app: AppHandle,
    path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let path = path.trim().to_string();
    info!("Sideloading package from {}", path);
    tokio::task::spawn_blocking(move || {
        run_adb_for_serial(&app, serial.as_deref(), &["sideload", &path])
    })
    .await
    .map_err(|e| e.to_string())?
}

fn install_apks(
    app: &AppHandle,
    apks_path: &str,
    serial: Option<&str>,
    flags: Option<Vec<String>>,
) -> CmdResult<String> {
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
        return Err("No APK files found in the archive.".into());
    }

    let mut args = vec!["install-multiple".to_string()];
    if let Some(user_flags) = flags {
        if !user_flags.is_empty() {
            args.extend(user_flags);
        } else {
            args.push("-r".to_string());
        }
    } else {
        args.push("-r".to_string());
    }
    args.extend(extracted.iter().map(|p| p.to_string_lossy().to_string()));
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    let result = run_adb_for_serial(app, serial, &arg_refs);
    // TempDir auto-cleans on drop (when temp_dir goes out of scope)
    drop(temp_dir);
    result
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DetailedPackageInfo {
    pub name: String,
    pub label: String,
    pub version_name: String,
    pub version_code: String,
    pub min_sdk: u32,
    pub target_sdk: u32,
    pub installer: Option<String>,
    pub apk_path: String,
    pub split_paths: Vec<String>,
    pub data_dir: String,
    pub is_system: bool,
    pub is_enabled: bool,
    pub granted_permissions: Vec<String>,
    pub denied_permissions: Vec<String>,
    pub signatures: Vec<String>,
}

#[tauri::command]
pub async fn package_lifecycle_op(
    app: AppHandle,
    package_name: String,
    op: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let package_name = package_name.trim().to_string();
    if package_name.is_empty() {
        return Err("Package name is required".into());
    }
    info!("Running package lifecycle op '{}' on {}", op, package_name);
    tokio::task::spawn_blocking(move || {
        let serial = serial.as_deref();
        match op.as_str() {
            "launch" => {
                // Launch launcher activity via monkey intent or am start
                run_adb_for_serial(
                    &app,
                    serial,
                    &[
                        "shell",
                        "monkey",
                        "-p",
                        &package_name,
                        "-c",
                        "android.intent.category.LAUNCHER",
                        "1",
                    ],
                )
            }
            "force_stop" => {
                run_adb_for_serial(&app, serial, &["shell", "am", "force-stop", &package_name])
            }
            "clear_data" => {
                run_adb_for_serial(&app, serial, &["shell", "pm", "clear", &package_name])
            }
            "clear_cache" => {
                run_adb_for_serial(&app, serial, &["shell", "pm", "trim-caches", "999999999999"])
            }
            "disable" => run_adb_for_serial(
                &app,
                serial,
                &["shell", "pm", "disable-user", "--user", "0", &package_name],
            )
            .or_else(|_| {
                run_adb_for_serial(&app, serial, &["shell", "pm", "disable", &package_name])
            }),
            "enable" => {
                let res =
                    run_adb_for_serial(&app, serial, &["shell", "pm", "enable", &package_name]);
                let _ = run_adb_for_serial(
                    &app,
                    serial,
                    &["shell", "pm", "unhide", "--user", "0", &package_name],
                );
                let _ = run_adb_for_serial(
                    &app,
                    serial,
                    &["shell", "pm", "default-state", "--user", "0", &package_name],
                );
                res
            }
            _ => Err(format!("Unknown lifecycle operation: {op}")),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pull_package_apk(
    app: AppHandle,
    package_name: String,
    destination_path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    let package_name = package_name.trim().to_string();
    let dest = destination_path.trim().to_string();
    if package_name.is_empty() || dest.is_empty() {
        return Err("Package name and destination path are required".into());
    }
    info!("Pulling APK for {} to {}", package_name, dest);
    tokio::task::spawn_blocking(move || {
        let serial = serial.as_deref();
        let output = run_adb_for_serial(&app, serial, &["shell", "pm", "path", &package_name])?;
        let mut apk_remote_path = String::new();
        for line in output.lines() {
            if let Some(p) = line.trim().strip_prefix("package:") {
                apk_remote_path = p.trim().to_string();
                break;
            }
        }
        if apk_remote_path.is_empty() {
            return Err(format!("Could not locate APK path for {package_name}"));
        }
        run_adb_for_serial(&app, serial, &["pull", &apk_remote_path, &dest])
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_package_details(
    app: AppHandle,
    package_name: String,
    serial: Option<String>,
) -> CmdResult<DetailedPackageInfo> {
    let package_name = package_name.trim().to_string();
    if package_name.is_empty() {
        return Err("Package name is required".into());
    }
    info!("Fetching detailed package info for {}", package_name);
    tokio::task::spawn_blocking(move || {
        let serial = serial.as_deref();
        let dumpsys_out =
            run_adb_for_serial(&app, serial, &["shell", "dumpsys", "package", &package_name])
                .unwrap_or_default();

        let is_disabled_in_dumpsys = dumpsys_out.lines().any(|l| {
            let t = l.trim();
            (t.starts_with("User ")
                && (t.contains("enabled=2") || t.contains("enabled=3") || t.contains("enabled=4")))
                || t.contains("enabledSetting=COMPONENT_ENABLED_STATE_DISABLED")
                || t.contains("enabledSetting=COMPONENT_ENABLED_STATE_DISABLED_USER")
                || t.contains("disabled=true")
        });

        let is_disabled = is_disabled_in_dumpsys || {
            if let Ok(disabled_out) =
                run_adb_for_serial(&app, serial, &["shell", "pm", "list", "packages", "-d"])
            {
                disabled_out.lines().any(|line| {
                    if let Some(pkg) = line.trim().strip_prefix("package:") {
                        pkg.trim() == package_name
                    } else {
                        false
                    }
                })
            } else {
                false
            }
        };

        let mut info = DetailedPackageInfo {
            name: package_name.clone(),
            label: package_name.clone(),
            version_name: "1.0".to_string(),
            version_code: "1".to_string(),
            min_sdk: 26,
            target_sdk: 34,
            installer: None,
            apk_path: String::new(),
            split_paths: Vec::new(),
            data_dir: format!("/data/data/{package_name}"),
            is_system: false,
            is_enabled: !is_disabled,
            granted_permissions: Vec::new(),
            denied_permissions: Vec::new(),
            signatures: Vec::new(),
        };
        for line in dumpsys_out.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("versionName=") {
                info.version_name = trimmed.trim_start_matches("versionName=").to_string();
            } else if trimmed.starts_with("versionCode=") {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if let Some(first) = parts.first() {
                    info.version_code = first.trim_start_matches("versionCode=").to_string();
                }
            } else if trimmed.starts_with("targetSdk=") {
                if let Ok(val) = trimmed.trim_start_matches("targetSdk=").parse::<u32>() {
                    info.target_sdk = val;
                }
            } else if trimmed.starts_with("minSdk=") {
                if let Ok(val) = trimmed.trim_start_matches("minSdk=").parse::<u32>() {
                    info.min_sdk = val;
                }
            } else if trimmed.starts_with("codePath=") {
                info.apk_path = trimmed.trim_start_matches("codePath=").to_string();
            } else if trimmed.starts_with("installerPackageName=") {
                let installer = trimmed.trim_start_matches("installerPackageName=").to_string();
                if !installer.is_empty() && installer != "null" {
                    info.installer = Some(installer);
                }
            } else if trimmed.contains("granted=true") {
                let perm = trimmed.split(':').next().unwrap_or(trimmed);
                info.granted_permissions.push(perm.trim().to_string());
            }
        }

        if info.apk_path.is_empty()
            && let Ok(path_out) =
                run_adb_for_serial(&app, serial, &["shell", "pm", "path", &package_name])
        {
            for line in path_out.lines() {
                if let Some(p) = line.trim().strip_prefix("package:") {
                    info.apk_path = p.trim().to_string();
                    break;
                }
            }
        }

        Ok(info)
    })
    .await
    .map_err(|e| e.to_string())?
}
