use crate::debloat::{DebloatPackage, DebloatPackageRow, PackageState};
use crate::helpers::run_binary_command;
use crate::CmdResult;
use log::debug;
use std::collections::{HashMap, HashSet};
use tauri::AppHandle;

// ── Device SDK detection ───────────────────────────────────────────────────────

/// Returns the Android SDK version (API level) of the connected device.
/// Returns 0 on failure.
pub fn get_android_sdk(app: &AppHandle) -> u32 {
    run_binary_command(app, "adb", &["shell", "getprop", "ro.build.version.sdk"])
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
        .unwrap_or(0)
}

/// Returns the device serial/ID for per-device settings keying.
pub fn get_device_id(app: &AppHandle) -> String {
    run_binary_command(app, "adb", &["get-serialno"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
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

fn detect_package_states(app: &AppHandle) -> CmdResult<DevicePackageStates> {
    // All system packages (including uninstalled for this user)
    let all_out =
        run_binary_command(app, "adb", &["shell", "pm", "list", "packages", "-s", "-u"])?;
    let all_system = parse_package_list(&all_out);

    // Enabled system packages
    let enabled_out =
        run_binary_command(app, "adb", &["shell", "pm", "list", "packages", "-s", "-e"])?;
    let enabled = parse_package_list(&enabled_out);

    // Disabled system packages
    let disabled_out =
        run_binary_command(app, "adb", &["shell", "pm", "list", "packages", "-s", "-d"])?;
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

// ── Main sync function ─────────────────────────────────────────────────────────

/// Sync system packages from the device and merge with UAD metadata.
pub fn sync_device_packages(
    app: &AppHandle,
    uad_map: &HashMap<String, DebloatPackage>,
) -> CmdResult<Vec<DebloatPackageRow>> {
    let states = detect_package_states(app)?;

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
