use crate::{
    CmdResult,
    emulator::{
        backup,
        models::{AvdRootState, AvdSummary, EmulatorBootMode},
        runtime, sdk,
    },
};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use tauri::AppHandle;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ParsedAvdConfig {
    pub api_level: Option<u32>,
    pub abi: Option<String>,
    pub target: Option<String>,
    pub device_name: Option<String>,
    pub image_sysdir: Option<String>,
}

fn parse_ini_map(contents: &str) -> BTreeMap<String, String> {
    contents
        .lines()
        .filter_map(|line| line.split_once('='))
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .collect()
}

fn parse_api_level(path: &str) -> Option<u32> {
    path.split(['/', '\\'])
        .find(|part| part.starts_with("android-"))
        .and_then(|part| part.trim_start_matches("android-").parse::<u32>().ok())
}

pub fn parse_config_ini(contents: &str) -> ParsedAvdConfig {
    let map = parse_ini_map(contents);
    let image_sysdir =
        map.get("image.sysdir.1").cloned().or_else(|| map.get("image.sysdir.2").cloned());

    ParsedAvdConfig {
        api_level: image_sysdir.as_deref().and_then(parse_api_level),
        abi: map.get("abi.type").cloned(),
        target: map.get("tag.display").cloned().or_else(|| map.get("tag.id").cloned()),
        device_name: map.get("hw.device.name").cloned(),
        image_sysdir,
    }
}

fn parse_avd_ini_path(contents: &str) -> Option<PathBuf> {
    let map = parse_ini_map(contents);
    map.get("path").map(PathBuf::from).or_else(|| map.get("path.rel").map(PathBuf::from))
}

pub fn resolve_system_image_dir(
    config: &ParsedAvdConfig,
    sdk_roots: &[PathBuf],
) -> Option<PathBuf> {
    let raw = config.image_sysdir.as_deref()?.trim().trim_matches('"');
    // Normalize Windows backslashes to forward slashes so PathBuf::join works
    // correctly on all platforms. Android Studio writes mixed-slash paths on Windows.
    let normalized = raw.replace('\\', "/");
    let relative = normalized.trim_end_matches('/');
    let as_path = PathBuf::from(relative);

    if as_path.is_absolute() {
        return Some(as_path);
    }

    sdk_roots
        .iter()
        .map(|root| root.join(relative))
        .find(|candidate| candidate.exists())
        .or_else(|| sdk_roots.first().map(|root| root.join(relative)))
        .or(Some(as_path))
}

pub fn resolve_ramdisk_path(
    _avd_path: &Path,
    config: &ParsedAvdConfig,
    sdk_roots: &[PathBuf],
) -> Option<PathBuf> {
    let system_image_dir = resolve_system_image_dir(config, sdk_roots)?;
    let candidates =
        [system_image_dir.join("ramdisk.img"), system_image_dir.join("ramdisk-qemu.img")];

    candidates
        .iter()
        .find(|candidate| candidate.exists())
        .cloned()
        .or_else(|| Some(candidates[0].clone()))
}

fn avd_root_state(
    app: &AppHandle,
    ramdisk_path: Option<&Path>,
    serial: Option<&str>,
) -> AvdRootState {
    let Some(ramdisk_path) = ramdisk_path else {
        return AvdRootState::Unknown;
    };

    let has_backups = backup::backup_exists(ramdisk_path);
    if has_backups && serial.is_some_and(|serial| runtime::is_serial_rooted(app, serial)) {
        AvdRootState::Rooted
    } else if has_backups {
        AvdRootState::Modified
    } else {
        AvdRootState::Stock
    }
}

/// Scans `avd_home` for `*.ini` files and returns the stem of each as an AVD name.
/// This avoids a hard dependency on the `emulator` binary just to enumerate AVDs.
fn scan_avd_names(avd_home: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(avd_home) else {
        return Vec::new();
    };

    let mut names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension()?.to_str()? == "ini" {
                path.file_stem()?.to_str().map(String::from)
            } else {
                None
            }
        })
        .collect();

    names.sort();
    names
}

pub fn list_avds(app: &AppHandle) -> CmdResult<Vec<AvdSummary>> {
    let avd_home = sdk::resolve_avd_home().ok_or_else(|| {
        "Unable to resolve Android AVD home directory. Set ANDROID_AVD_HOME or HOME/USERPROFILE."
            .to_string()
    })?;
    let sdk_roots = sdk::sdk_roots_from_current_env();
    let runtime_avd_names = runtime::runtime_avd_names(app).unwrap_or_default();

    // Scan *.ini files directly — no dependency on `emulator -list-avds`.
    let names = scan_avd_names(&avd_home);
    let mut avds = Vec::new();

    for name in &names {
        let name: &str = name.as_str();
        let ini_path = avd_home.join(format!("{name}.ini"));
        let ini_contents = fs::read_to_string(&ini_path).unwrap_or_default();
        let avd_path = parse_avd_ini_path(&ini_contents)
            .unwrap_or_else(|| avd_home.join(format!("{name}.avd")));

        let config_path = avd_path.join("config.ini");
        let config_contents = fs::read_to_string(&config_path).unwrap_or_default();
        let config = parse_config_ini(&config_contents);
        let ramdisk_path = resolve_ramdisk_path(&avd_path, &config, &sdk_roots);
        let serial = runtime_avd_names.get(name).cloned();

        let mut warnings = Vec::new();
        if !ini_path.exists() {
            warnings.push("AVD ini file is missing.".into());
        }
        if !avd_path.exists() {
            warnings.push("AVD directory is missing.".into());
        }
        if config.image_sysdir.is_none() {
            warnings.push("AVD config does not declare image.sysdir.*.".into());
        }
        if ramdisk_path.as_ref().is_some_and(|path| !path.exists()) {
            warnings.push("Resolved ramdisk path does not exist on disk.".into());
        }

        let root_state = avd_root_state(app, ramdisk_path.as_deref(), serial.as_deref());
        let has_backups = ramdisk_path.as_deref().is_some_and(backup::backup_exists);

        // Determine boot mode for running emulators.
        let boot_mode = if serial.is_some() {
            detect_boot_mode(app, serial.as_deref().unwrap_or_default())
        } else {
            EmulatorBootMode::Unknown
        };

        avds.push(AvdSummary {
            name: name.to_string(),
            ini_path: ini_path.to_string_lossy().to_string(),
            avd_path: avd_path.to_string_lossy().to_string(),
            target: config.target.clone(),
            api_level: config.api_level,
            abi: config.abi.clone(),
            device_name: config.device_name.clone(),
            ramdisk_path: ramdisk_path.map(|path| path.to_string_lossy().to_string()),
            has_backups,
            root_state,
            boot_mode,
            is_running: serial.is_some(),
            serial,
            warnings,
        });
    }

    avds.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(avds)
}
/// Detect whether a running emulator was cold-booted or loaded from a Quick Boot snapshot.
///
/// Uses `ro.kernel.androidboot.snapshot_loaded` which the QEMU hypervisor sets to `true`
/// when a snapshot is loaded. Falls back to `Unknown` if the property isn't available.
fn detect_boot_mode(app: &AppHandle, serial: &str) -> EmulatorBootMode {
    use crate::helpers::run_binary_command_allow_output_on_failure;

    let output = run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", serial, "shell", "getprop", "ro.kernel.androidboot.snapshot_loaded"],
    );

    match output.as_deref().map(str::trim) {
        Ok("true" | "1") => EmulatorBootMode::Normal,
        Ok("false" | "0" | "") => EmulatorBootMode::Cold,
        _ => EmulatorBootMode::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    #[test]
    fn parse_config_ini_extracts_api_target_and_abi() {
        let config = r#"
abi.type=x86_64
image.sysdir.1=system-images/android-34/google_apis_playstore/x86_64/
tag.display=Google Play
hw.device.name=pixel_8
"#;

        let parsed = parse_config_ini(config);

        assert_eq!(parsed.abi.as_deref(), Some("x86_64"));
        assert_eq!(parsed.api_level, Some(34));
        assert_eq!(parsed.target.as_deref(), Some("Google Play"));
        assert_eq!(parsed.device_name.as_deref(), Some("pixel_8"));
        assert_eq!(
            parsed.image_sysdir.as_deref(),
            Some("system-images/android-34/google_apis_playstore/x86_64/")
        );
    }

    #[test]
    fn resolves_relative_system_image_dir_against_sdk_roots() {
        let config = ParsedAvdConfig {
            image_sysdir: Some("system-images/android-34/google_apis/x86_64/".into()),
            ..Default::default()
        };
        let sdk_roots = vec![PathBuf::from("D:/Android/Sdk"), PathBuf::from("C:/Android/Sdk")];

        let resolved = resolve_system_image_dir(&config, &sdk_roots);

        assert_eq!(
            resolved,
            Some(PathBuf::from("D:/Android/Sdk/system-images/android-34/google_apis/x86_64"))
        );
    }

    #[test]
    fn resolve_ramdisk_path_uses_system_image_directory() {
        let config = ParsedAvdConfig {
            image_sysdir: Some("system-images/android-34/google_apis/x86_64/".into()),
            ..Default::default()
        };
        let sdk_roots = vec![PathBuf::from("D:/Android/Sdk")];

        let resolved = resolve_ramdisk_path(
            Path::new("C:/Users/test/.android/avd/Test.avd"),
            &config,
            &sdk_roots,
        );

        assert_eq!(
            resolved,
            Some(PathBuf::from(
                "D:/Android/Sdk/system-images/android-34/google_apis/x86_64/ramdisk.img"
            ))
        );
    }
}
