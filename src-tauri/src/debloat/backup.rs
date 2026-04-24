use crate::CmdResult;
use crate::debloat::PackageState;
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const BACKUP_DIR_NAME: &str = "debloat_backups";

/// A single package's state snapshot.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageSnapshot {
    pub name: String,
    pub state: PackageState,
}

/// A full device backup snapshot.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBackup {
    pub device_id: String,
    pub created_at: String,
    pub android_sdk: u32,
    pub packages: Vec<PackageSnapshot>,
}

/// Summary of a backup shown in the UI dropdown.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub file_name: String,
    pub created_at: String,
    pub device_id: String,
    pub package_count: usize,
}

fn backup_dir(app: &AppHandle, device_id: &str) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(BACKUP_DIR_NAME)
        .join(device_id)
}

/// Create a backup of the current package states for a device.
pub fn create_backup(
    app: &AppHandle,
    device_id: &str,
    android_sdk: u32,
    packages: Vec<PackageSnapshot>,
) -> CmdResult<BackupSummary> {
    let dir = backup_dir(app, device_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let created_at = crate::debloat::lists::now_timestamp();
    let file_name = format!("backup_{created_at}.json");
    let path = dir.join(&file_name);

    let backup = DeviceBackup {
        device_id: device_id.to_string(),
        created_at: created_at.clone(),
        android_sdk,
        packages: packages.clone(),
    };

    let json = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    info!("Backup created: {:?} ({} packages)", path, packages.len());

    Ok(BackupSummary {
        file_name,
        created_at,
        device_id: device_id.to_string(),
        package_count: packages.len(),
    })
}

/// List all backups for a device, newest first.
pub fn list_backups(app: &AppHandle, device_id: &str) -> Vec<BackupSummary> {
    let dir = backup_dir(app, device_id);
    if !dir.exists() {
        return vec![];
    }

    let mut summaries: Vec<BackupSummary> = fs::read_dir(&dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.ends_with(".json") {
                return None;
            }
            let json = fs::read_to_string(entry.path()).ok()?;
            let backup: DeviceBackup = serde_json::from_str(&json).ok()?;
            Some(BackupSummary {
                file_name,
                created_at: backup.created_at.clone(),
                device_id: backup.device_id.clone(),
                package_count: backup.packages.len(),
            })
        })
        .collect();

    // Sort newest first
    summaries.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    summaries
}

/// Load a specific backup file.
pub fn load_backup(app: &AppHandle, device_id: &str, file_name: &str) -> CmdResult<DeviceBackup> {
    let path = backup_dir(app, device_id).join(file_name);
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

/// Per-device settings persisted on disk.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PerDeviceSettings {
    pub disable_mode: bool,
    pub multi_user_mode: bool,
    pub expert_mode: bool,
}

fn settings_path(app: &AppHandle, device_id: &str) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("debloat_settings")
        .join(format!("{device_id}.json"))
}

pub fn load_device_settings(app: &AppHandle, device_id: &str) -> PerDeviceSettings {
    let path = settings_path(app, device_id);
    fs::read_to_string(&path).ok().and_then(|j| serde_json::from_str(&j).ok()).unwrap_or_default()
}

pub fn save_device_settings(
    app: &AppHandle,
    device_id: &str,
    settings: &PerDeviceSettings,
) -> CmdResult<()> {
    let path = settings_path(app, device_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    debug!("Saved device settings for {}", device_id);
    Ok(())
}
