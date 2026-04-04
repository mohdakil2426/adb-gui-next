use serde::{Deserialize, Serialize};

// ─── Shared source type ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProviderSource {
    #[serde(rename = "F-Droid")]
    FDroid,
    #[serde(rename = "GitHub")]
    GitHub,
    #[serde(rename = "Aptoide")]
    Aptoide,
}

impl ProviderSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FDroid => "F-Droid",
            Self::GitHub => "GitHub",
            Self::Aptoide => "Aptoide",
        }
    }
}

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
    pub available_sources: Vec<String>,
    pub download_url: Option<String>,
    pub repo_url: Option<String>,
    pub size: Option<u64>,
    pub rating: Option<f64>,
    pub downloads_count: Option<u64>,
    pub malware_status: Option<String>,
    pub categories: Vec<String>,
    pub updated_at: Option<String>,
    pub installable: bool,
}

// ─── Detailed metadata (detail dialog) ───────────────────────────────────────

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceAppDetail {
    pub name: String,
    pub package_name: String,
    pub version: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub source: String,
    pub download_url: Option<String>,
    pub repo_url: Option<String>,
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
    pub updated_at: Option<String>,
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

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    #[serde(default)]
    pub providers: Vec<String>,
    #[serde(default = "default_sort")]
    pub sort_by: String,
    #[serde(default)]
    pub github_token: Option<String>,
    #[serde(default = "default_results_per_provider")]
    pub results_per_provider: u32,
}

fn default_sort() -> String {
    "relevance".to_string()
}

fn default_results_per_provider() -> u32 {
    12
}

// ─── GitHub device flow auth DTOs ────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GithubDeviceFlowChallenge {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GithubRateLimitSummary {
    pub limit: u64,
    pub remaining: u64,
    pub reset_at: Option<String>,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GithubUserSummary {
    pub login: String,
    pub avatar_url: Option<String>,
    pub profile_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GithubDeviceFlowPollResult {
    pub status: String,
    pub access_token: Option<String>,
    pub interval: Option<u64>,
    pub message: Option<String>,
    pub user: Option<GithubUserSummary>,
    pub rate_limit: Option<GithubRateLimitSummary>,
}
