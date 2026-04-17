use crate::debloat::{DebloatListStatus, DebloatPackage, UadRawEntry};
use log::{debug, info, warn};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const UAD_GITHUB_URL: &str =
    "https://raw.githubusercontent.com/Universal-Android-Debloater-2/universal-android-debloater-next-generation/main/resources/uad_lists.json";
const CACHE_FILE_NAME: &str = "uad_lists.json";
const FETCH_TIMEOUT_SECS: u64 = 30;

fn cache_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("debloat")
        .join(CACHE_FILE_NAME)
}

fn bundled_json_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join(CACHE_FILE_NAME))
        .filter(|p| p.exists())
}

/// Returns seconds since the file was last modified, or u64::MAX if unknown.
fn file_age_secs(path: &PathBuf) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| SystemTime::now().duration_since(t).ok())
        .map(|d| d.as_secs())
        .unwrap_or(u64::MAX)
}

fn format_age(secs: u64) -> String {
    if secs < 60 {
        "just now".to_string()
    } else if secs < 3600 {
        format!("{}m ago", secs / 60)
    } else if secs < 86400 {
        format!("{}h ago", secs / 3600)
    } else {
        format!("{}d ago", secs / 86400)
    }
}

fn parse_json(json: &str) -> Result<Vec<DebloatPackage>, String> {
    let raw: HashMap<String, UadRawEntry> =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse UAD JSON: {e}"))?;
    Ok(raw.into_values().map(|e| e.into_debloat_package()).collect())
}

/// Load the UAD package list: try remote → cache → bundled (in that order).
/// Returns (packages, status).
pub fn load_uad_lists(app: &AppHandle) -> Result<(Vec<DebloatPackage>, DebloatListStatus), String> {
    let cache = cache_path(app);

    // 1. Try fetching from GitHub
    match fetch_remote(UAD_GITHUB_URL) {
        Ok(json) => {
            let packages = parse_json(&json)?;
            let count = packages.len();
            // Save to cache (best-effort)
            if let Some(parent) = cache.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&cache, &json);
            info!("UAD lists loaded from remote ({} packages)", count);
            return Ok((
                packages,
                DebloatListStatus {
                    source: "remote".to_string(),
                    last_updated: "just now".to_string(),
                    total_entries: count,
                },
            ));
        }
        Err(e) => warn!("Failed to fetch UAD lists from remote: {}", e),
    }

    // 2. Try local cache
    if cache.exists() {
        match fs::read_to_string(&cache).map_err(|e| e.to_string()).and_then(|j| parse_json(&j)) {
            Ok(packages) => {
                let age = file_age_secs(&cache);
                let count = packages.len();
                info!("UAD lists loaded from cache ({} packages, age {}s)", count, age);
                return Ok((
                    packages,
                    DebloatListStatus {
                        source: "cached".to_string(),
                        last_updated: format_age(age),
                        total_entries: count,
                    },
                ));
            }
            Err(e) => warn!("Cache read/parse failed: {}", e),
        }
    }

    // 3. Bundled fallback
    if let Some(bundled) = bundled_json_path(app) {
        let json = fs::read_to_string(&bundled).map_err(|e| e.to_string())?;
        let packages = parse_json(&json)?;
        let count = packages.len();
        debug!("UAD lists loaded from bundled fallback ({} packages)", count);
        return Ok((
            packages,
            DebloatListStatus {
                source: "bundled".to_string(),
                last_updated: "bundled".to_string(),
                total_entries: count,
            },
        ));
    }

    Err("UAD lists unavailable: remote fetch failed, no cache, no bundled file.".to_string())
}

fn fetch_remote(url: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(FETCH_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    client
        .get(url)
        .send()
        .map_err(|e| e.to_string())?
        .text()
        .map_err(|e| e.to_string())
}

/// Return the current age of the cached list file for display.
pub fn cache_status(app: &AppHandle) -> DebloatListStatus {
    let cache = cache_path(app);
    if cache.exists() {
        let age = file_age_secs(&cache);
        // Try to count entries
        let count = fs::read_to_string(&cache)
            .ok()
            .and_then(|j| parse_json(&j).ok())
            .map(|v| v.len())
            .unwrap_or(0);
        DebloatListStatus {
            source: "cached".to_string(),
            last_updated: format_age(age),
            total_entries: count,
        }
    } else {
        DebloatListStatus {
            source: "bundled".to_string(),
            last_updated: "unknown".to_string(),
            total_entries: 0,
        }
    }
}

/// Timestamp string for backups.
pub fn now_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
