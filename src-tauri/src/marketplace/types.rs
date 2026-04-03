use serde::{Deserialize, Serialize};

// ─── App card (search results) ───────────────────────────────────────────────

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceApp {
    pub name: String,
    pub package_name: String,
    pub version: String,
    pub summary: String,
    pub icon_url: Option<String>,
    pub source: String,
    pub download_url: Option<String>,
    pub repo_url: Option<String>,
    pub size: Option<u64>,
    pub rating: Option<f64>,
    pub downloads_count: Option<u64>,
    pub malware_status: Option<String>,
    pub categories: Vec<String>,
}

// ─── Detailed metadata (detail dialog) ───────────────────────────────────────

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceAppDetail {
    pub name: String,
    pub package_name: String,
    pub version: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub source: String,
    pub download_url: Option<String>,
    pub size: Option<u64>,
    pub license: Option<String>,
    pub author: Option<String>,
    pub sources_available: Vec<String>,
    pub screenshots: Vec<String>,
    pub changelog: Option<String>,
    pub versions: Vec<VersionInfo>,
    pub repo_stars: Option<u64>,
    pub repo_forks: Option<u64>,
    pub rating: Option<f64>,
    pub downloads_count: Option<u64>,
}

// ─── Version entry ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub version_name: String,
    pub version_code: i64,
    pub size: Option<u64>,
    pub download_url: Option<String>,
    pub published_at: Option<String>,
}

// ─── Search filters ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    #[serde(default)]
    pub providers: Vec<String>,
    #[serde(default = "default_sort")]
    pub sort_by: String,
    #[serde(default)]
    pub github_token: Option<String>,
}

fn default_sort() -> String {
    "relevance".to_string()
}
