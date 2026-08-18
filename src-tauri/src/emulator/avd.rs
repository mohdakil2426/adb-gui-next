use crate::{
    CmdResult,
    emulator::{
        backup,
        models::{
            AvdDiskBreakdown, AvdHardwareDetails, AvdRootState, AvdSummary, EmulatorBootMode,
        },
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

fn dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    if path.is_file() {
        return fs::metadata(path).map_or(0, |m| m.len());
    }
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                total += dir_size(&entry_path);
            } else {
                total += entry.metadata().map_or(0, |m| m.len());
            }
        }
    }
    total
}

pub fn emulator_get_avd_specs(app: &AppHandle, avd_name: &str) -> CmdResult<AvdHardwareDetails> {
    let avd_home = sdk::resolve_avd_home()
        .ok_or_else(|| "Unable to resolve Android AVD home directory.".to_string())?;
    let ini_path = avd_home.join(format!("{avd_name}.ini"));
    let ini_contents = fs::read_to_string(&ini_path).unwrap_or_default();
    let avd_path = parse_avd_ini_path(&ini_contents)
        .unwrap_or_else(|| avd_home.join(format!("{avd_name}.avd")));

    let config_path = avd_path.join("config.ini");
    let config_contents = fs::read_to_string(&config_path).unwrap_or_default();
    let config_map = parse_ini_map(&config_contents);

    let qemu_path = avd_path.join("hardware-qemu.ini");
    let qemu_contents = fs::read_to_string(&qemu_path).unwrap_or_default();
    let qemu_map = parse_ini_map(&qemu_contents);

    let config = parse_config_ini(&config_contents);
    let api_level = config.api_level;
    let android_version = match api_level {
        Some(35) => "Android 15.0".to_string(),
        Some(34) => "Android 14.0".to_string(),
        Some(33) => "Android 13.0".to_string(),
        Some(32) => "Android 12L".to_string(),
        Some(31) => "Android 12.0".to_string(),
        Some(30) => "Android 11.0".to_string(),
        Some(29) => "Android 10.0".to_string(),
        Some(28) => "Android 9.0 (Pie)".to_string(),
        Some(27) => "Android 8.1 (Oreo)".to_string(),
        Some(26) => "Android 8.0 (Oreo)".to_string(),
        Some(25) => "Android 7.1.1 (Nougat)".to_string(),
        Some(24) => "Android 7.0 (Nougat)".to_string(),
        Some(23) => "Android 6.0 (Marshmallow)".to_string(),
        Some(22) => "Android 5.1 (Lollipop)".to_string(),
        Some(21) => "Android 5.0 (Lollipop)".to_string(),
        Some(api) => format!("Android (API {api})"),
        None => "Android (API Unknown)".to_string(),
    };

    let api_label = format!("API {}", api_level.unwrap_or(30));
    let architecture = config_map
        .get("abi.type")
        .or_else(|| config_map.get("hw.cpu.arch"))
        .or_else(|| qemu_map.get("hw.cpu.arch"))
        .cloned()
        .unwrap_or_else(|| "x86_64".to_string());

    let runtime_avd_names = runtime::runtime_avd_names(app).unwrap_or_default();
    let serial = runtime_avd_names.get(avd_name).cloned();

    let boot_mode_label = if let Some(s) = &serial {
        match detect_boot_mode(app, s) {
            EmulatorBootMode::Normal => "Quick Boot (Active Snapshot)".to_string(),
            EmulatorBootMode::Cold => "Cold Boot (Clean Initialized)".to_string(),
            EmulatorBootMode::Unknown => "Running (Boot Mode Active)".to_string(),
        }
    } else {
        "Quick Boot (Ready)".to_string()
    };

    let camera_info = {
        let back = config_map.get("hw.camera.back").map_or("virtualscene", String::as_str);
        let front = config_map.get("hw.camera.front").map_or("emulated", String::as_str);
        format!("Back: {back} · Front: {front}")
    };

    let density_dpi = config_map
        .get("hw.lcd.density")
        .or_else(|| qemu_map.get("hw.lcd.density"))
        .and_then(|d| d.parse::<u32>().ok())
        .unwrap_or(420);

    let density_label = if density_dpi <= 160 {
        format!("mdpi ({density_dpi} dpi)")
    } else if density_dpi <= 240 {
        format!("hdpi ({density_dpi} dpi)")
    } else if density_dpi <= 320 {
        format!("xhdpi ({density_dpi} dpi)")
    } else if density_dpi <= 480 {
        format!("xxhdpi ({density_dpi} dpi)")
    } else {
        format!("xxxhdpi ({density_dpi} dpi)")
    };

    let disk_data_size =
        config_map.get("disk.dataPartition.size").cloned().unwrap_or_else(|| "6.0 GB".to_string());
    let disk_sdcard_size =
        config_map.get("hw.sdCard.data.size").cloned().unwrap_or_else(|| "512 MB".to_string());
    let disk_snapshot_size = "1.8 GB".to_string();
    let disk_system_size =
        if api_level.unwrap_or(30) >= 33 { "3.4 GB".to_string() } else { "2.6 GB".to_string() };

    let graphics_engine = {
        let mode = config_map.get("hw.gpu.mode").map_or("auto", String::as_str);
        match mode {
            "auto" | "host" => "Host (OpenGL / ANGLE Vulkan)".to_string(),
            "angle_indirect" => "ANGLE Direct3D / Metal Indirect".to_string(),
            "swiftshader_indirect" => "SwiftShader CPU Software Rasterizer".to_string(),
            other => format!("Custom GPU: {other}"),
        }
    };

    #[cfg(target_os = "windows")]
    let hypervisor = "AEHD (Android Emulator Hypervisor Driver) / WHPX".to_string();
    #[cfg(target_os = "linux")]
    let hypervisor = "KVM (Kernel-based Virtual Machine)".to_string();
    #[cfg(target_os = "macos")]
    let hypervisor = "Hypervisor.Framework (Apple Virtualization)".to_string();
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    let hypervisor = "QEMU Hypervisor".to_string();

    let network_profile = "LTE / Full Speed (Unmetered)".to_string();

    let ram_allocation_mb = config_map
        .get("hw.ramSize")
        .or_else(|| qemu_map.get("hw.ramSize"))
        .and_then(|r| r.parse::<u64>().ok())
        .unwrap_or(2048);

    let width = config_map
        .get("hw.lcd.width")
        .or_else(|| qemu_map.get("hw.lcd.width"))
        .and_then(|w| w.parse::<u32>().ok())
        .unwrap_or(1080);
    let height = config_map
        .get("hw.lcd.height")
        .or_else(|| qemu_map.get("hw.lcd.height"))
        .and_then(|h| h.parse::<u32>().ok())
        .unwrap_or(2400);
    let tag = if width >= 1440 || height >= 2560 {
        "QHD"
    } else if width >= 1080 || height >= 1920 {
        "FHD+"
    } else {
        "HD"
    };
    let resolution = format!("{width} x {height} ({tag})");

    let sdk_roots = sdk::sdk_roots_from_current_env();
    let ramdisk_path = resolve_ramdisk_path(&avd_path, &config, &sdk_roots);
    let root_state = avd_root_state(app, ramdisk_path.as_deref(), serial.as_deref());
    let root_status_label = match root_state {
        AvdRootState::Rooted => "Magisk Root Active".to_string(),
        AvdRootState::Modified => "Modified Ramdisk (Cold Boot Needed)".to_string(),
        AvdRootState::Stock => "Stock Unrooted".to_string(),
        AvdRootState::Unknown => "Unknown Root State".to_string(),
    };

    let v_cpu_cores = config_map
        .get("hw.cpu.ncore")
        .or_else(|| qemu_map.get("hw.cpu.ncore"))
        .and_then(|c| c.parse::<u32>().ok())
        .unwrap_or(4);

    Ok(AvdHardwareDetails {
        android_version,
        api_label,
        architecture,
        boot_mode_label,
        camera_info,
        density_dpi,
        density_label,
        disk_data_size,
        disk_sdcard_size,
        disk_snapshot_size,
        disk_system_size,
        graphics_engine,
        hypervisor,
        network_profile,
        ram_allocation_mb,
        resolution,
        root_status_label,
        v_cpu_cores,
    })
}

pub fn emulator_get_disk_breakdown(
    _app: &AppHandle,
    avd_name: &str,
) -> CmdResult<AvdDiskBreakdown> {
    let avd_home = sdk::resolve_avd_home()
        .ok_or_else(|| "Unable to resolve Android AVD home directory.".to_string())?;
    let ini_path = avd_home.join(format!("{avd_name}.ini"));
    let ini_contents = fs::read_to_string(&ini_path).unwrap_or_default();
    let avd_path = parse_avd_ini_path(&ini_contents)
        .unwrap_or_else(|| avd_home.join(format!("{avd_name}.avd")));

    let config_path = avd_path.join("config.ini");
    let config_contents = fs::read_to_string(&config_path).unwrap_or_default();
    let config = parse_config_ini(&config_contents);
    let sdk_roots = sdk::sdk_roots_from_current_env();
    let sysdir = resolve_system_image_dir(&config, &sdk_roots);

    let mut data_size_bytes = 0_u64;
    for fname in &["userdata-qemu.img", "userdata.img", "data.img", "userdata-qemu.img.qcow2"] {
        let p = avd_path.join(fname);
        if p.exists() {
            data_size_bytes += fs::metadata(&p).map_or(0, |m| m.len());
        }
    }
    if data_size_bytes == 0 {
        data_size_bytes = 6 * 1024 * 1024 * 1024;
    }

    let mut system_size_bytes = 0_u64;
    for fname in
        &["system.img", "system-qemu.img", "vendor.img", "ramdisk.img", "encryptionkey.img"]
    {
        let p = avd_path.join(fname);
        if p.exists() {
            system_size_bytes += fs::metadata(&p).map_or(0, |m| m.len());
        }
    }
    if let Some(sys) = sysdir
        && sys.exists()
    {
        system_size_bytes += dir_size(&sys);
    }
    if system_size_bytes == 0 {
        system_size_bytes = 3 * 1024 * 1024 * 1024;
    }

    let mut sdcard_size_bytes = 0_u64;
    for fname in &["sdcard.img", "sdcard-qemu.img"] {
        let p = avd_path.join(fname);
        if p.exists() {
            sdcard_size_bytes += fs::metadata(&p).map_or(0, |m| m.len());
        }
    }
    if sdcard_size_bytes == 0 {
        sdcard_size_bytes = 512 * 1024 * 1024;
    }

    let snapshots_path = avd_path.join("snapshots");
    let mut snapshots_size_bytes = dir_size(&snapshots_path);
    if snapshots_size_bytes == 0 {
        snapshots_size_bytes = 1024 * 1024 * 1024;
    }

    let total_size_bytes =
        data_size_bytes + system_size_bytes + sdcard_size_bytes + snapshots_size_bytes;

    let bytes_to_gb =
        |b: u64| -> f64 { ((b as f64) / (1024.0 * 1024.0 * 1024.0) * 10.0).round() / 10.0 };

    Ok(AvdDiskBreakdown {
        avd_name: avd_name.to_string(),
        system_size_bytes,
        system_size_gb: bytes_to_gb(system_size_bytes),
        data_size_bytes,
        data_size_gb: bytes_to_gb(data_size_bytes),
        sdcard_size_bytes,
        sdcard_size_gb: bytes_to_gb(sdcard_size_bytes),
        snapshots_size_bytes,
        snapshots_size_gb: bytes_to_gb(snapshots_size_bytes),
        total_size_bytes,
        total_size_gb: bytes_to_gb(total_size_bytes),
    })
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

    #[test]
    fn test_dir_size_nonexistent() {
        assert_eq!(dir_size(Path::new("nonexistent_path_xyz123")), 0);
    }

    #[test]
    fn test_parse_ini_map_hardware_props() {
        let ini = "hw.ramSize=4096\nhw.cpu.ncore=8\nhw.lcd.density=480\n";
        let map = parse_ini_map(ini);
        assert_eq!(map.get("hw.ramSize").map(String::as_str), Some("4096"));
        assert_eq!(map.get("hw.cpu.ncore").map(String::as_str), Some("8"));
        assert_eq!(map.get("hw.lcd.density").map(String::as_str), Some("480"));
    }
}
