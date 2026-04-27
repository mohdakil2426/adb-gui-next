use serde::{Deserialize, Serialize};

// ─── Automated root pipeline models ──────────────────────────────────────────

/// Where the Magisk package originates from.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum RootSource {
    /// A local file path provided by the user (`.apk` or `.zip`).
    #[serde(rename_all = "camelCase")]
    LocalFile { value: String },
    /// Automatically download the latest official stable Magisk from GitHub.
    LatestStable,
}

/// The latest official stable Magisk release fetched from the GitHub releases API.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MagiskStableRelease {
    /// Human-readable version string (e.g. "Magisk v30.7").
    pub version: String,
    /// Git tag name (e.g. "v30.7").
    pub tag: String,
    /// Exact filename of the APK asset (e.g. "Magisk-v30.7.apk").
    pub asset_name: String,
    /// Direct download URL for the APK.
    pub download_url: String,
    /// File size in bytes.
    pub size: u64,
    /// SHA-256 hex digest provided by GitHub (without the "sha256:" prefix), if present.
    pub sha256: Option<String>,
    /// ISO-8601 publish timestamp from the GitHub release.
    pub published_at: String,
}

/// Live progress event emitted during `root_avd` execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootProgress {
    pub step: u8,
    pub total_steps: u8,
    pub label: String,
    pub detail: Option<String>,
}

/// Request to root a running AVD using the automated pipeline.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootAvdRequest {
    pub avd_name: String,
    pub serial: String,
    pub source: RootSource,
}

/// Result returned after a successful automated root.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootAvdResult {
    pub magisk_version: String,
    pub patched_ramdisk_path: String,
    pub manager_installed: bool,
    pub activation_status: RootActivationStatus,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RootActivationStatus {
    PatchInstalled,
    Verified,
    VerificationFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RootVerificationResult {
    pub status: RootActivationStatus,
    pub boot_completed: bool,
    pub su_uid: Option<String>,
    pub magisk_package: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AvdRootState {
    Stock,
    Rooted,
    Modified,
    Unknown,
}

/// Whether the emulator was cold-booted (fresh) or loaded from a Quick Boot snapshot.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum EmulatorBootMode {
    /// Fresh boot with no snapshot loaded.
    Cold,
    /// Booted from a Quick Boot snapshot.
    Normal,
    /// Could not determine boot mode.
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
    pub boot_mode: EmulatorBootMode,
    pub is_running: bool,
    pub serial: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorLaunchOptions {
    pub wipe_data: bool,
    pub writable_system: bool,
    pub cold_boot: bool,
    pub no_snapshot_load: bool,
    pub no_snapshot_save: bool,
    pub no_boot_anim: bool,
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

// ─── Pre-flight readiness scan ────────────────────────────────────────────────

/// Status of an individual pre-flight readiness check.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CheckStatus {
    Pass,
    Warn,
    Fail,
    Info,
}

/// A single check result in the pre-flight scan.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessCheck {
    /// Machine-readable identifier (e.g. "boot_mode", "api_level").
    pub id: String,
    /// Human-readable label (e.g. "Boot Mode").
    pub label: String,
    /// Pass / Warn / Fail / Info.
    pub status: CheckStatus,
    /// Short result message (e.g. "Cold Boot ✓").
    pub message: String,
    /// Optional additional detail or recommended action text.
    pub detail: Option<String>,
}

/// Recommended corrective action when the scan is not fully green.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum RecommendedAction {
    /// The emulator needs to be started before rooting.
    LaunchEmulator,
    /// The emulator is running from a snapshot — a cold boot is recommended.
    ColdBoot,
    /// The ramdisk is already modified — the user should restore stock first.
    RestoreFirst,
    /// The configuration is fundamentally unsupported.
    #[serde(rename_all = "camelCase")]
    Unsupported { reason: String },
}

/// Aggregated result of the pre-flight readiness scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootReadinessScan {
    /// Ordered list of individual check results.
    pub checks: Vec<ReadinessCheck>,
    /// True iff no Fail-status checks exist (user may proceed despite warnings).
    pub can_proceed: bool,
    /// True iff at least one Warn-status check exists.
    pub has_warnings: bool,
    /// Highest-priority corrective action, if any.
    pub recommended_action: Option<RecommendedAction>,
}
