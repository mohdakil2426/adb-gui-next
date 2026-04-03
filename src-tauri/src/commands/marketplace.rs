use log::{debug, info};
use tauri::AppHandle;

use crate::CmdResult;
use crate::helpers::run_binary_command;
use crate::marketplace::{self, MarketplaceApp, MarketplaceAppDetail, SearchFilters, VersionInfo};

// ─── Provider check helpers ──────────────────────────────────────────────────

fn is_provider_enabled(filters: &SearchFilters, provider: &str) -> bool {
    filters.providers.is_empty() || filters.providers.iter().any(|p| p == provider)
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Search across all enabled providers simultaneously.
///
/// IzzyOnDroid uses cross-referencing: F-Droid results are checked against
/// the IzzyOnDroid packages API since Izzy has no native search endpoint.
#[tauri::command]
pub async fn marketplace_search(
    query: String,
    filters: Option<SearchFilters>,
) -> CmdResult<Vec<MarketplaceApp>> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(vec![]);
    }

    info!("Marketplace search: {query}");
    let client = marketplace::http_client()?;
    let filters = filters.unwrap_or_default();
    let github_token = filters.github_token.clone();

    // Launch F-Droid, GitHub, and Aptoide concurrently
    let (fdroid, github, aptoide) = tokio::join!(
        async {
            if is_provider_enabled(&filters, "F-Droid") {
                marketplace::fdroid::search(&client, &query).await
            } else {
                vec![]
            }
        },
        async {
            if is_provider_enabled(&filters, "GitHub") {
                marketplace::github::search(&client, &query, &github_token, "stars", 10).await
            } else {
                vec![]
            }
        },
        async {
            if is_provider_enabled(&filters, "Aptoide") {
                marketplace::aptoide::search(&client, &query, 15).await
            } else {
                vec![]
            }
        },
    );

    // IzzyOnDroid cross-reference: check F-Droid results against Izzy's packages API
    let izzy = if is_provider_enabled(&filters, "IzzyOnDroid") && !fdroid.is_empty() {
        marketplace::izzy::search_via_fdroid(&client, &fdroid).await
    } else {
        vec![]
    };

    let fdroid_count = fdroid.len();
    let izzy_count = izzy.len();
    let github_count = github.len();
    let aptoide_count = aptoide.len();

    let capacity = fdroid_count + izzy_count + github_count + aptoide_count;
    let mut results: Vec<MarketplaceApp> = Vec::with_capacity(capacity);
    results.extend(fdroid);
    results.extend(izzy);
    results.extend(github);
    results.extend(aptoide);

    debug!(
        "Marketplace search '{}' → F-Droid:{}, Izzy:{}, GitHub:{}, Aptoide:{}",
        query, fdroid_count, izzy_count, github_count, aptoide_count,
    );
    Ok(results)
}

/// Get detailed info about a specific app from a specific provider.
#[tauri::command]
pub async fn marketplace_get_app_detail(
    package_name: String,
    source: String,
    github_token: Option<String>,
) -> CmdResult<MarketplaceAppDetail> {
    info!("Marketplace detail: {package_name} from {source}");
    let client = marketplace::http_client()?;

    match source.as_str() {
        "F-Droid" => marketplace::fdroid::get_detail(&client, &package_name).await,
        "IzzyOnDroid" => marketplace::izzy::get_detail(&client, &package_name).await,
        "GitHub" => marketplace::github::get_detail(&client, &package_name, &github_token).await,
        "Aptoide" => marketplace::aptoide::get_detail(&client, &package_name).await,
        _ => Err(format!("Unknown source: {source}")),
    }
}

/// Fetch trending/popular Android apps from GitHub.
#[tauri::command]
pub async fn marketplace_get_trending(
    sort: Option<String>,
    github_token: Option<String>,
) -> CmdResult<Vec<MarketplaceApp>> {
    let client = marketplace::http_client()?;
    let sort = sort.as_deref().unwrap_or("stars");
    Ok(marketplace::github::get_trending(&client, &github_token, sort).await)
}

/// List version history for a specific app.
#[tauri::command]
pub async fn marketplace_list_versions(
    package_name: String,
    source: String,
    github_token: Option<String>,
) -> CmdResult<Vec<VersionInfo>> {
    let client = marketplace::http_client()?;

    match source.as_str() {
        "GitHub" => marketplace::github::list_releases(&client, &package_name, &github_token).await,
        // F-Droid and IzzyOnDroid return versions in their detail response
        "F-Droid" => {
            let detail = marketplace::fdroid::get_detail(&client, &package_name).await?;
            Ok(detail.versions)
        }
        "IzzyOnDroid" => {
            let detail = marketplace::izzy::get_detail(&client, &package_name).await?;
            Ok(detail.versions)
        }
        "Aptoide" => {
            // Aptoide getMeta doesn't expose version history easily
            Ok(vec![])
        }
        _ => Err(format!("Unknown source for versions: {source}")),
    }
}

/// Download an APK from a URL to a temporary file on disk.
/// Returns the local temp file path.
#[tauri::command]
pub async fn marketplace_download_apk(url: String) -> CmdResult<String> {
    info!("Downloading APK: {url}");
    let client = marketplace::http_client()?;

    let response = client.get(&url).send().await.map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| format!("Failed to read download: {e}"))?;

    if bytes.is_empty() {
        return Err("Downloaded file is empty — server may have returned an error".to_string());
    }

    // Write to temp file — keep() prevents auto-cleanup so the file persists until install
    let temp_dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let dir_path = temp_dir.keep();
    let file_path = dir_path.join("marketplace_download.apk");
    tokio::fs::write(&file_path, &bytes)
        .await
        .map_err(|e: std::io::Error| format!("Failed to write APK: {e}"))?;

    let path_str = file_path.to_string_lossy().to_string();
    info!("APK downloaded to: {path_str}");
    Ok(path_str)
}

/// Install a downloaded APK via ADB. Reuses existing install logic.
#[tauri::command]
pub async fn marketplace_install_apk(app: AppHandle, apk_path: String) -> CmdResult<String> {
    info!("Installing marketplace APK: {apk_path}");
    tokio::task::spawn_blocking(move || {
        run_binary_command(&app, "adb", &["install", "-r", &apk_path])
    })
    .await
    .map_err(|e| e.to_string())?
}
