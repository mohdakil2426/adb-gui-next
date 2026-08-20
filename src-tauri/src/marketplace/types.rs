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
    /// Primary programming language (from GitHub API). Used for heuristic ranking.
    pub language: Option<String>,
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
    pub readme_markdown: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateCandidate {
    pub package_name: String,
    pub app_name: String,
    pub current_version: String,
    pub latest_version: String,
    pub current_version_code: Option<i64>,
    pub latest_version_code: Option<i64>,
    pub source: String,
    pub download_url: Option<String>,
    pub changelog: Option<String>,
    pub has_update: bool,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceOverviewStats {
    pub total_apps: u32,
    pub github_count: u32,
    pub fdroid_count: u32,
    pub aptoide_count: u32,
    pub system_count: u32,
    pub privacy_count: u32,
    pub dev_count: u32,
    pub media_count: u32,
    pub tools_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CuratedTool {
    pub name: String,
    pub package_name: String,
    pub summary: String,
    pub description: String,
    pub source: String,
    pub version: String,
    pub repo_stars: Option<u32>,
    pub rating: Option<f64>,
    pub categories: Vec<String>,
    pub download_url: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    pub download_id: String,
    pub package_name: String,
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub speed_bps: u64,
    pub percentage: f64,
    pub eta_seconds: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallStatusPayload {
    pub task_id: String,
    pub package_name: String,
    pub app_name: String,
    pub serial: String,
    pub state: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceTokenStatus {
    pub has_token: bool,
    pub login: Option<String>,
    pub avatar_url: Option<String>,
    pub profile_url: Option<String>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub source: String, // "keyring" | "gh-cli" | "none"
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceRateLimitStatus {
    pub limit: u64,
    pub remaining: u64,
    pub reset_epoch_secs: u64,
    pub resource: String,
    pub seconds_until_reset: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceHostTokenEntry {
    pub host: String,
    pub display_name: Option<String>,
    pub created_at_epoch_millis: u64,
    pub has_token: bool,
}
