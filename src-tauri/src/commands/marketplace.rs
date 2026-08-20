use crate::CmdResult;
use crate::commands::device::run_adb_for_serial;
use crate::marketplace::cache::ManagedMarketplaceCache;
use crate::marketplace::service;
use crate::marketplace::{
    AppUpdateCandidate, CuratedTool, GithubDeviceFlowChallenge, GithubDeviceFlowPollResult,
    ManagedHttpClient, MarketplaceApp, MarketplaceAppDetail, MarketplaceOverviewStats,
    SearchFilters, VersionInfo, marketplace_check_updates as check_updates,
};
use crate::payload::remote::validate_outbound_url;
use log::info;
use tauri::{AppHandle, State};
#[tauri::command]
pub async fn marketplace_search(
    query: String,
    filters: Option<SearchFilters>,
    http: State<'_, ManagedHttpClient>,
    cache: State<'_, ManagedMarketplaceCache>,
) -> CmdResult<Vec<MarketplaceApp>> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(vec![]);
    }

    info!("Marketplace search: {query}");
    let client = &http.0;
    let filters = filters.unwrap_or_default();
    let search_key = service::search_cache_key(&query, &filters);

    {
        let cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
        match cache.get_search_swr(&search_key) {
            crate::marketplace::cache::SwrStatus::Fresh(cached) => return Ok(cached),
            crate::marketplace::cache::SwrStatus::Stale(cached) => return Ok(cached),
            crate::marketplace::cache::SwrStatus::Miss => {}
        }
    }

    let results = service::fetch_search_apps(client, &query, &filters).await;

    let mut cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
    cache.insert_search(search_key, results.clone());
    Ok(results)
}
#[tauri::command]
pub async fn marketplace_get_app_detail(
    package_name: String,
    source: String,
    github_token: Option<String>,
    http: State<'_, ManagedHttpClient>,
    cache: State<'_, ManagedMarketplaceCache>,
) -> CmdResult<MarketplaceAppDetail> {
    info!("Marketplace detail: {package_name} from {source}");
    let client = &http.0;
    let detail_key = service::detail_cache_key(&package_name, &source, &github_token);

    {
        let cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
        match cache.get_detail_swr(&detail_key) {
            crate::marketplace::cache::SwrStatus::Fresh(cached) => return Ok(cached),
            crate::marketplace::cache::SwrStatus::Stale(cached) => return Ok(cached),
            crate::marketplace::cache::SwrStatus::Miss => {}
        }
    }

    let detail = service::fetch_app_detail(client, &package_name, &source, &github_token).await?;

    let mut cache = cache.0.lock().map_err(|_| "Marketplace cache lock poisoned".to_string())?;
    cache.insert_detail(detail_key, detail.clone());
    Ok(detail)
}
#[tauri::command]
pub async fn marketplace_list_versions(
    package_name: String,
    source: String,
    github_token: Option<String>,
    http: State<'_, ManagedHttpClient>,
) -> CmdResult<Vec<VersionInfo>> {
    let client = &http.0;
    service::list_versions(client, &package_name, &source, &github_token).await
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
    http: State<'_, ManagedHttpClient>,
) -> CmdResult<GithubDeviceFlowChallenge> {
    if client_id.trim().is_empty() {
        return Err("GitHub OAuth client ID is required".to_string());
    }

    let client = &http.0;
    crate::marketplace::auth::start_device_flow(
        client,
        client_id.trim(),
        &scopes.unwrap_or_default(),
    )
    .await
}

#[tauri::command]
pub async fn marketplace_github_device_poll(
    client_id: String,
    device_code: String,
    http: State<'_, ManagedHttpClient>,
) -> CmdResult<GithubDeviceFlowPollResult> {
    if client_id.trim().is_empty() {
        return Err("GitHub OAuth client ID is required".to_string());
    }
    if device_code.trim().is_empty() {
        return Err("GitHub device code is required".to_string());
    }

    let client = &http.0;
    crate::marketplace::auth::poll_device_flow(client, client_id.trim(), device_code.trim()).await
}

#[tauri::command]
pub async fn marketplace_download_apk(
    app: AppHandle,
    url: String,
    package_name: Option<String>,
    download_id: Option<String>,
) -> CmdResult<String> {
    let parsed = url::Url::parse(url.trim()).map_err(|e| format!("Invalid download URL: {e}"))?;
    validate_outbound_url(&parsed, true).map_err(|e| e.to_string())?;

    info!("Downloading marketplace APK from {}", parsed.host_str().unwrap_or("unknown-host"));

    let client = crate::marketplace::install_queue::create_download_client()?;
    let pkg = package_name.unwrap_or_else(|| "app".to_string());
    let id = download_id.unwrap_or_else(|| format!("dl-{pkg}"));

    crate::marketplace::install_queue::download_apk_streaming(&app, &client, parsed, &pkg, &id)
        .await
}

#[tauri::command]
pub async fn marketplace_install_apk(
    app: AppHandle,
    apk_path: String,
    serial: Option<String>,
) -> CmdResult<String> {
    info!("Installing marketplace APK: {apk_path}");
    let apk_path_ref = std::path::Path::new(&apk_path);
    if !crate::marketplace::install_queue::is_owned_marketplace_download(apk_path_ref) {
        return Err(
            "APK path is not a marketplace download — only owned temp downloads can be installed"
                .into(),
        );
    }

    let install_path = apk_path.clone();
    let result = tokio::task::spawn_blocking(move || {
        run_adb_for_serial(&app, serial.as_deref(), &["install", "-r", &install_path])
    })
    .await
    .map_err(|e| e.to_string())?;

    let _ = tokio::fs::remove_file(apk_path_ref).await;
    result
}

#[tauri::command]
pub async fn marketplace_check_updates(
    app: AppHandle,
    serial: Option<String>,
) -> CmdResult<Vec<AppUpdateCandidate>> {
    tokio::task::spawn_blocking(move || check_updates(app, serial))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn marketplace_get_overview_stats() -> MarketplaceOverviewStats {
    service::marketplace_get_overview_stats()
}

#[tauri::command]
pub fn marketplace_get_curated_tools() -> Vec<CuratedTool> {
    service::marketplace_get_curated_tools()
}
