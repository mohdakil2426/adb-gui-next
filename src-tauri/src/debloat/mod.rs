pub mod actions;
pub mod backup;
pub mod lists;
pub mod sync;

use serde::{Deserialize, Serialize};

// ── Core Data Types ───────────────────────────────────────────────────────────

/// UAD list category a package belongs to.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum DebloatList {
    Aosp,
    Carrier,
    Google,
    Misc,
    Oem,
    Pending,
    #[default]
    Unlisted,
}

/// Safety tier for removing this package (from UAD lists).
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum RemovalTier {
    Recommended,
    Advanced,
    Expert,
    Unsafe,
    #[default]
    Unlisted,
}

/// Current state of a package on the device.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum PackageState {
    #[default]
    Enabled,
    Disabled,
    Uninstalled,
}

/// A single entry from the UAD community JSON list.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatPackage {
    pub id: String,
    pub list: DebloatList,
    pub description: String,
    pub dependencies: Vec<String>,
    pub needed_by: Vec<String>,
    pub labels: Vec<String>,
    pub removal: RemovalTier,
}

/// A merged row: device package state + UAD metadata, sent to the frontend.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatPackageRow {
    pub name: String,
    pub state: PackageState,
    pub description: String,
    pub list: DebloatList,
    pub removal: RemovalTier,
    pub dependencies: Vec<String>,
    pub needed_by: Vec<String>,
}

/// Result of a single package action (uninstall/disable/restore).
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatActionResult {
    pub package_name: String,
    pub success: bool,
    pub error: Option<String>,
    pub new_state: PackageState,
}

/// Status of the local UAD list cache.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatListStatus {
    /// "remote" | "cached" | "bundled"
    pub source: String,
    pub last_updated: String,
    pub total_entries: usize,
}

/// Per-device settings persisted to disk.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatDeviceSettings {
    pub device_id: String,
    pub disable_mode: bool,
    pub multi_user_mode: bool,
    pub expert_mode: bool,
}

impl Default for DebloatDeviceSettings {
    fn default() -> Self {
        Self {
            device_id: String::new(),
            disable_mode: false,
            multi_user_mode: false,
            expert_mode: false,
        }
    }
}

// ── UAD JSON Deserialization ───────────────────────────────────────────────────

/// Raw UAD JSON entry (snake_case from source). We parse this then map to our types.
#[derive(Debug, Deserialize, Clone)]
pub struct UadRawEntry {
    pub id: String,
    pub list: String,
    pub description: String,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub needed_by: Vec<String>,
    #[serde(default)]
    pub labels: Vec<String>,
    pub removal: String,
}

impl UadRawEntry {
    pub fn into_debloat_package(self) -> DebloatPackage {
        DebloatPackage {
            id: self.id,
            list: parse_list(&self.list),
            description: self.description,
            dependencies: self.dependencies,
            needed_by: self.needed_by,
            labels: self.labels,
            removal: parse_removal(&self.removal),
        }
    }
}

fn parse_list(s: &str) -> DebloatList {
    match s {
        "Aosp" => DebloatList::Aosp,
        "Carrier" => DebloatList::Carrier,
        "Google" => DebloatList::Google,
        "Misc" => DebloatList::Misc,
        "Oem" => DebloatList::Oem,
        "Pending" => DebloatList::Pending,
        _ => DebloatList::Unlisted,
    }
}

fn parse_removal(s: &str) -> RemovalTier {
    match s {
        "Recommended" => RemovalTier::Recommended,
        "Advanced" => RemovalTier::Advanced,
        "Expert" => RemovalTier::Expert,
        "Unsafe" => RemovalTier::Unsafe,
        _ => RemovalTier::Unlisted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_list_handles_all_variants() {
        assert_eq!(parse_list("Aosp"), DebloatList::Aosp);
        assert_eq!(parse_list("Google"), DebloatList::Google);
        assert_eq!(parse_list("Oem"), DebloatList::Oem);
        assert_eq!(parse_list("Unknown"), DebloatList::Unlisted);
    }

    #[test]
    fn parse_removal_handles_all_variants() {
        assert_eq!(parse_removal("Recommended"), RemovalTier::Recommended);
        assert_eq!(parse_removal("Unsafe"), RemovalTier::Unsafe);
        assert_eq!(parse_removal("Unknown"), RemovalTier::Unlisted);
    }

    #[test]
    fn uad_raw_entry_maps_correctly() {
        let raw = UadRawEntry {
            id: "com.samsung.bixby".to_string(),
            list: "Oem".to_string(),
            description: "Bixby Voice".to_string(),
            dependencies: vec![],
            needed_by: vec![],
            labels: vec![],
            removal: "Recommended".to_string(),
        };
        let pkg = raw.into_debloat_package();
        assert_eq!(pkg.list, DebloatList::Oem);
        assert_eq!(pkg.removal, RemovalTier::Recommended);
    }
}
