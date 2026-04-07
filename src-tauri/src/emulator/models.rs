use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AvdRootState {
    Stock,
    Rooted,
    Modified,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AvdSummary {
    pub name: String,
    pub ini_path: String,
    pub avd_path: String,
    pub target: Option<String>,
    pub api_level: Option<u32>,
    pub abi: Option<String>,
    pub device_name: Option<String>,
    pub ramdisk_path: Option<String>,
    pub has_backups: bool,
    pub root_state: AvdRootState,
    pub is_running: bool,
    pub serial: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorLaunchOptions {
    pub wipe_data: bool,
    pub writable_system: bool,
    pub headless: bool,
    pub cold_boot: bool,
    pub no_snapshot_load: bool,
    pub no_snapshot_save: bool,
    pub no_boot_anim: bool,
    pub net_speed: Option<String>,
    pub net_delay: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub original_path: String,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestorePlan {
    pub entries: Vec<BackupEntry>,
    pub created_at: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootPreparationRequest {
    pub avd_name: String,
    pub serial: String,
    pub root_package_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootPreparationResult {
    pub normalized_package_path: String,
    pub fake_boot_remote_path: String,
    pub instructions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootFinalizeRequest {
    pub avd_name: String,
    pub serial: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootFinalizeResult {
    pub restored_files: Vec<String>,
    pub next_boot_recommendation: String,
}
