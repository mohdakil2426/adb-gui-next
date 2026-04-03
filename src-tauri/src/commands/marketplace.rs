use log::info;
use tauri::{AppHandle, State};

use crate::CmdResult;
use crate::helpers::run_binary_command;
use crate::marketplace::cache::ManagedMarketplaceCache;
use crate::marketplace::service;
use crate::marketplace::{self, GithubDeviceFlowChallenge, GithubDeviceFlowPollResult};
use crate::marketplace::{MarketplaceApp, MarketplaceAppDetail, SearchFilters, VersionInfo};

#[tauri::command]
pub async fn marketplace_search(
    query: String,
    filters: Option<SearchFilters>,
    cache: State<'_, ManagedMarketplaceCache>,
) -> CmdResult<Vec<MarketplaceApp>> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(vec![]);
    }

    info!("Marketplace search: {query}");
    let client = marketplace::http_client()?;
    let filters = filters.unwrap_or_default();
    let search_key = service::search_cache_key(&query, &filters);

    {
        let mut cache =
            cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
        if let Some(cached) = cache.get_search(&search_key) {
            return Ok(cached);
        }
    }

    let results = service::fetch_search_apps(&client, &query, &filters).await;

    let mut cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
    cache.insert_search(search_key, results.clone());
    Ok(results)
}

#[tauri::command]
pub async fn marketplace_get_app_detail(
    package_name: String,
    source: String,
    github_token: Option<String>,
    cache: State<'_, ManagedMarketplaceCache>,
) -> CmdResult<MarketplaceAppDetail> {
    info!("Marketplace detail: {package_name} from {source}");
    let client = marketplace::http_client()?;
    let detail_key = service::detail_cache_key(&package_name, &source, &github_token);

    {
        let mut cache =
            cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
        if let Some(cached) = cache.get_detail(&detail_key) {
            return Ok(cached);
        }
    }

    let detail = service::fetch_app_detail(&client, &package_name, &source, &github_token).await?;

    let mut cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
    cache.insert_detail(detail_key, detail.clone());
    Ok(detail)
}

#[tauri::command]
pub async fn marketplace_get_trending(
    sort: Option<String>,
    github_token: Option<String>,
    limit: Option<u32>,
    cache: State<'_, ManagedMarketplaceCache>,
) -> CmdResult<Vec<MarketplaceApp>> {
    let client = marketplace::http_client()?;
    let sort = sort.unwrap_or_else(|| "stars".to_string());
    let limit = limit.unwrap_or(12).max(4);
    let trending_key = service::trending_cache_key(&sort, &github_token, limit);

    {
        let mut cache =
            cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
        if let Some(cached) = cache.get_trending(&trending_key) {
            return Ok(cached);
        }
    }

    let results = service::fetch_trending(&client, &sort, &github_token, limit).await;

    let mut cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
    cache.insert_trending(trending_key, results.clone());
    Ok(results)
}

#[tauri::command]
pub async fn marketplace_list_versions(
    package_name: String,
    source: String,
    github_token: Option<String>,
) -> CmdResult<Vec<VersionInfo>> {
    let client = marketplace::http_client()?;
    service::list_versions(&client, &package_name, &source, &github_token).await
}

#[tauri::command]
pub fn marketplace_clear_cache(cache: State<'_, ManagedMarketplaceCache>) -> CmdResult<String> {
    let mut cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
    cache.clear();
    Ok("Marketplace cache cleared".to_string())
}

#[tauri::command]
pub async fn marketplace_github_device_start(
    client_id: String,
    scopes: Option<Vec<String>>,
) -> CmdResult<GithubDeviceFlowChallenge> {
    if client_id.trim().is_empty() {
        return Err("GitHub OAuth client ID is required".to_string());
    }

    let client = marketplace::http_client()?;
    marketplace::auth::start_device_flow(&client, client_id.trim(), &scopes.unwrap_or_default())
        .await
}

#[tauri::command]
pub async fn marketplace_github_device_poll(
    client_id: String,
    device_code: String,
) -> CmdResult<GithubDeviceFlowPollResult> {
    if client_id.trim().is_empty() {
        return Err("GitHub OAuth client ID is required".to_string());
    }
    if device_code.trim().is_empty() {
        return Err("GitHub device code is required".to_string());
    }

    let client = marketplace::http_client()?;
    marketplace::auth::poll_device_flow(&client, client_id.trim(), device_code.trim()).await
}

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

#[tauri::command]
pub async fn marketplace_install_apk(app: AppHandle, apk_path: String) -> CmdResult<String> {
    info!("Installing marketplace APK: {apk_path}");
    tokio::task::spawn_blocking(move || {
        run_binary_command(&app, "adb", &["install", "-r", &apk_path])
    })
    .await
    .map_err(|e| e.to_string())?
}
