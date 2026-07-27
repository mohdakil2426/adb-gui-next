use crate::CmdResult;
use crate::debloat::{DebloatPackage, DebloatPackageRow, PackageState};

use log::debug;
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;

// ── Device SDK detection ───────────────────────────────────────────────────────

/// Returns the Android SDK version (API level) of the connected device.
/// Returns 0 on failure. Prefer [`try_get_android_sdk`] for destructive actions.
pub fn get_android_sdk(app: &AppHandle, serial: Option<&str>) -> u32 {
    try_get_android_sdk(app, serial).unwrap_or(0)
}

/// Returns the Android SDK version (API level), or an error if detection fails.
///
/// Fails when ADB fails, the property is empty/unparseable, or the value is 0.
/// Use this for any path that may uninstall, disable, or otherwise mutate packages.
pub fn try_get_android_sdk(app: &AppHandle, serial: Option<&str>) -> Result<u32, String> {
    let raw = crate::helpers::run_adb(app, serial, &["shell", "getprop", "ro.build.version.sdk"])?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Could not determine Android SDK; refusing destructive action".to_string());
    }
    let sdk = trimmed
        .parse::<u32>()
        .map_err(|_| "Could not determine Android SDK; refusing destructive action".to_string())?;
    if sdk == 0 {
        return Err("Could not determine Android SDK; refusing destructive action".to_string());
    }
    Ok(sdk)
}

/// Error surfaced when the device serial cannot be resolved.
pub const ERR_UNKNOWN_DEVICE: &str = "Could not determine which device to use. \
     Select a device in the device switcher (`adb get-serialno` fails whenever more \
     than one device is attached).";

/// Returns the device serial/ID for per-device settings, cache, and backup keying.
///
/// Prefer an explicit FE `serial`. Falls back to `adb get-serialno`, which fails on
/// the ordinary "multiple devices attached" case — that used to degrade to the
/// literal id `"unknown"`, so two different devices shared one cache key (device A's
/// package list served for device B) and one backup directory. Refuse instead.
pub fn get_device_id(app: &AppHandle, serial: Option<&str>) -> CmdResult<String> {
    let resolved = match serial.map(str::trim).filter(|s| !s.is_empty()) {
        Some(explicit) => explicit.to_string(),
        None => crate::helpers::run_adb(app, None, &["get-serialno"])
            .map_err(|e| format!("{ERR_UNKNOWN_DEVICE} ({e})"))?
            .trim()
            .to_string(),
    };

    // `get-serialno` prints literals like "unknown" or "adb: no devices/emulators
    // found" on some platform-tools builds instead of failing.
    if resolved.is_empty()
        || resolved.eq_ignore_ascii_case("unknown")
        || crate::helpers::sanitize_filename(&resolved).is_empty()
    {
        return Err(ERR_UNKNOWN_DEVICE.to_string());
    }

    Ok(resolved)
}

// ── Package state detection ────────────────────────────────────────────────────

/// Parses `pm list packages` output: strips "package:" prefix.
fn parse_package_list(output: &str) -> HashSet<String> {
    output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect()
}

#[derive(Default)]
struct DevicePackageStates {
    enabled: HashSet<String>,
    disabled: HashSet<String>,
    /// all system packages including uninstalled ones (-s -u flag)
    all_system: HashSet<String>,
}

fn detect_package_states(app: &AppHandle, serial: Option<&str>) -> CmdResult<DevicePackageStates> {
    // All system packages (including uninstalled for this user)
    let all_out =
        crate::helpers::run_adb(app, serial, &["shell", "pm", "list", "packages", "-s", "-u"])?;
    let all_system = parse_package_list(&all_out);

    // Enabled system packages
    let enabled_out =
        crate::helpers::run_adb(app, serial, &["shell", "pm", "list", "packages", "-s", "-e"])?;
    let enabled = parse_package_list(&enabled_out);

    // Disabled system packages
    let disabled_out =
        crate::helpers::run_adb(app, serial, &["shell", "pm", "list", "packages", "-s", "-d"])?;
    let disabled = parse_package_list(&disabled_out);

    debug!(
        "Device packages — all_system: {}, enabled: {}, disabled: {}",
        all_system.len(),
        enabled.len(),
        disabled.len()
    );

    Ok(DevicePackageStates { enabled, disabled, all_system })
}

fn determine_state(name: &str, states: &DevicePackageStates) -> PackageState {
    if states.disabled.contains(name) {
        PackageState::Disabled
    } else if states.enabled.contains(name) {
        PackageState::Enabled
    } else if states.all_system.contains(name) {
        // In all_system but not in enabled/disabled → uninstalled for this user
        PackageState::Uninstalled
    } else {
        // Not a system package at all — treat as enabled (shouldn't normally happen)
        PackageState::Enabled
    }
}

/// Read the real on-device state of `packages` in a single batch (3 adb spawns,
/// independent of how many packages are asked about).
///
/// Used after a batch action so results report what the device actually ended up
/// with instead of the state the action was *supposed* to produce.
/// Packages the device does not report at all are omitted from the map, so callers
/// can tell "state unknown" apart from "state is Enabled".
pub fn query_package_states(
    app: &AppHandle,
    serial: Option<&str>,
    packages: &[String],
) -> CmdResult<HashMap<String, PackageState>> {
    let states = detect_package_states(app, serial)?;
    Ok(packages
        .iter()
        .filter(|name| {
            states.all_system.contains(*name)
                || states.enabled.contains(*name)
                || states.disabled.contains(*name)
        })
        .map(|name| (name.clone(), determine_state(name, &states)))
        .collect())
}

// ── Main sync function ─────────────────────────────────────────────────────────

/// Sync system packages from the device and merge with UAD metadata.
pub fn sync_device_packages(
    app: &AppHandle,
    uad_map: &HashMap<String, DebloatPackage>,
    serial: Option<&str>,
) -> CmdResult<Vec<DebloatPackageRow>> {
    let states = detect_package_states(app, serial)?;

    let mut rows: Vec<DebloatPackageRow> = states
        .all_system
        .iter()
        .map(|name| {
            let state = determine_state(name, &states);
            if let Some(meta) = uad_map.get(name.as_str()) {
                DebloatPackageRow {
                    name: name.clone(),
                    state,
                    description: meta.description.clone(),
                    list: meta.list,
                    removal: meta.removal,
                    dependencies: meta.dependencies.clone(),
                    needed_by: meta.needed_by.clone(),
                }
            } else {
                DebloatPackageRow {
                    name: name.clone(),
                    state,
                    description: String::new(),
                    list: crate::debloat::DebloatList::Unlisted,
                    removal: crate::debloat::RemovalTier::Unlisted,
                    dependencies: vec![],
                    needed_by: vec![],
                }
            }
        })
        .collect();

    // Sort: recommended first, then by name
    rows.sort_by(|a, b| {
        let tier_order = |t: &crate::debloat::RemovalTier| match t {
            crate::debloat::RemovalTier::Recommended => 0,
            crate::debloat::RemovalTier::Advanced => 1,
            crate::debloat::RemovalTier::Expert => 2,
            crate::debloat::RemovalTier::Unsafe => 3,
            crate::debloat::RemovalTier::Unlisted => 4,
        };
        tier_order(&a.removal).cmp(&tier_order(&b.removal)).then(a.name.cmp(&b.name))
    });

    debug!("Synced {} system packages from device", rows.len());
    Ok(rows)
}

/// Build a HashMap<package_id, DebloatPackage> from a list for fast lookup.
pub fn build_uad_map(packages: Vec<DebloatPackage>) -> HashMap<String, DebloatPackage> {
    packages.into_iter().map(|p| (p.id.clone(), p)).collect()
}
