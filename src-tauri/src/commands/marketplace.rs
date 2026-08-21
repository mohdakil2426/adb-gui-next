use crate::CmdResult;
use crate::commands::device::run_adb_for_serial;
use crate::marketplace::cache::ManagedMarketplaceCache;
use crate::marketplace::rate_limit::ManagedRateLimitStore;
use crate::marketplace::service;
use crate::marketplace::token_store::ManagedTokenStore;
use crate::marketplace::{
    AppUpdateCandidate, CuratedTool, GithubDeviceFlowChallenge, GithubDeviceFlowPollResult,
    ManagedHttpClient, MarketplaceApp, MarketplaceAppDetail, MarketplaceHostTokenEntry,
    MarketplaceOverviewStats, MarketplaceRateLimitStatus, MarketplaceTokenStatus, SearchFilters,
    VersionInfo, marketplace_check_updates as check_updates,
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
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<Vec<MarketplaceApp>> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(vec![]);
    }

    info!("Marketplace search: {query}");
    let client = &http.0;
    let mut filters = filters.unwrap_or_default();
    // Komi parity: fallback to OS keychain / gh CLI token if FE didn't pass one
    if filters.github_token.is_none() {
        if let Ok(Some(stored)) = token_store.get_token() {
            filters.github_token = Some(stored.access_token);
        } else if let Some(gh_tok) = token_store.try_gh_cli_token() {
            filters.github_token = Some(gh_tok);
        }
    }
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
#[allow(clippy::too_many_arguments)] // flat IPC surface; hints are optional
pub async fn marketplace_get_app_detail(
    package_name: String,
    source: String,
    github_token: Option<String>,
    repo_url: Option<String>,
    download_url: Option<String>,
    http: State<'_, ManagedHttpClient>,
    cache: State<'_, ManagedMarketplaceCache>,
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<MarketplaceAppDetail> {
    let mut github_token = github_token;
    if github_token.is_none() {
        if let Ok(Some(stored)) = token_store.get_token() {
            github_token = Some(stored.access_token);
        } else if let Some(gh_tok) = token_store.try_gh_cli_token() {
            github_token = Some(gh_tok);
        }
    }
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

    let detail = service::fetch_app_detail(
        client,
        &package_name,
        &source,
        &github_token,
        repo_url.as_deref(),
        download_url.as_deref(),
    )
    .await?;

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
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<Vec<VersionInfo>> {
    let mut github_token = github_token;
    if github_token.is_none() {
        if let Ok(Some(stored)) = token_store.get_token() {
            github_token = Some(stored.access_token);
        } else if let Some(gh_tok) = token_store.try_gh_cli_token() {
            github_token = Some(gh_tok);
        }
    }
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
    // `adb install` is not trustworthy on exit codes alone: several
    // platform-tools releases exit 0 while stdout says `Failure [reason]`,
    // which surfaced to the user as "downloaded but not installed". Success
    // requires the literal `Success` line; any `Failure` text is an error
    // carrying the device's own reason.
    let output = tokio::task::spawn_blocking(move || {
        run_adb_for_serial(&app, serial.as_deref(), &["install", "-r", &install_path])
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = tokio::fs::remove_file(apk_path_ref).await;

    if output.contains("Failure") {
        return Err(format!("Device rejected the install: {output}"));
    }
    if !output.contains("Success") {
        return Err(format!("adb install did not report success (no device output): {output}"));
    }
    Ok(output)
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

// ─── Komi-style token + rate-limit + host-token + curated feed ───────────

#[tauri::command]
pub fn marketplace_get_token_status(
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<MarketplaceTokenStatus> {
    if let Some(tok) = token_store.get_token()? {
        Ok(MarketplaceTokenStatus {
            has_token: true,
            login: tok.login.clone(),
            avatar_url: None,
            profile_url: None,
            token_type: Some(tok.token_type.clone()),
            scope: tok.scope.clone(),
            source: "keyring".into(),
        })
    } else if token_store.try_gh_cli_token().is_some() {
        Ok(MarketplaceTokenStatus {
            has_token: true,
            login: None,
            avatar_url: None,
            profile_url: None,
            token_type: Some("Bearer".into()),
            scope: None,
            source: "gh-cli".into(),
        })
    } else {
        Ok(MarketplaceTokenStatus {
            has_token: false,
            login: None,
            avatar_url: None,
            profile_url: None,
            token_type: None,
            scope: None,
            source: "none".into(),
        })
    }
}

#[tauri::command]
pub async fn marketplace_save_pat(
    token: String,
    http: State<'_, ManagedHttpClient>,
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<MarketplaceTokenStatus> {
    let raw = token.trim().to_string();
    if raw.is_empty() {
        return Err("GitHub token is empty".into());
    }
    if raw.len() < 20 || raw.contains(char::is_whitespace) {
        return Err("Token looks invalid — must be at least 20 chars with no spaces".into());
    }
    // Live probe: GET /user
    let client = &http.0;
    let user = crate::marketplace::auth::fetch_user_summary(client, &raw)
        .await
        .map_err(|e| format!("Token validation failed: {e}"))?;

    let stored = crate::marketplace::token_store::StoredGithubToken {
        access_token: raw.clone(),
        token_type: "Bearer".into(),
        scope: None,
        saved_at_epoch_millis: None,
        login: Some(user.login.clone()),
    };
    token_store.save_token(stored)?;

    Ok(MarketplaceTokenStatus {
        has_token: true,
        login: Some(user.login),
        avatar_url: user.avatar_url,
        profile_url: user.profile_url,
        token_type: Some("Bearer".into()),
        scope: None,
        source: "keyring".into(),
    })
}

#[tauri::command]
pub fn marketplace_logout(token_store: State<'_, ManagedTokenStore>) -> CmdResult<String> {
    token_store.clear_token()?;
    Ok("Logged out — token cleared from OS keychain".into())
}

#[tauri::command]
pub async fn marketplace_github_web_auth_flow(
    client_id: Option<String>,
    http: State<'_, ManagedHttpClient>,
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<MarketplaceTokenStatus> {
    let client = http.0.clone();
    let stored =
        crate::marketplace::web_auth::run_web_auth_flow(client, &token_store, client_id).await?;

    Ok(MarketplaceTokenStatus {
        has_token: true,
        login: stored.login,
        avatar_url: None,
        profile_url: None,
        token_type: Some(stored.token_type),
        scope: stored.scope,
        source: "keyring".into(),
    })
}

#[tauri::command]
pub fn marketplace_get_rate_limit(
    rate_store: State<'_, ManagedRateLimitStore>,
) -> CmdResult<Option<MarketplaceRateLimitStatus>> {
    if let Some(info) = rate_store.get_last() {
        Ok(Some(MarketplaceRateLimitStatus {
            limit: info.limit,
            remaining: info.remaining,
            reset_epoch_secs: info.reset_epoch_secs,
            resource: info.resource.clone(),
            seconds_until_reset: info.seconds_until_reset(),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn marketplace_get_host_tokens(
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<Vec<MarketplaceHostTokenEntry>> {
    let tokens = token_store.get_host_tokens()?;
    Ok(tokens
        .into_iter()
        .map(|t| MarketplaceHostTokenEntry {
            host: t.host,
            display_name: t.display_name,
            created_at_epoch_millis: t.created_at_epoch_millis,
            has_token: true,
        })
        .collect())
}

#[tauri::command]
pub fn marketplace_save_host_token(
    host: String,
    token: String,
    display_name: Option<String>,
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<Vec<MarketplaceHostTokenEntry>> {
    if host.trim().is_empty() || token.trim().is_empty() {
        return Err("Host and token are required".into());
    }
    let all = token_store.save_host_token(host, token, display_name)?;
    Ok(all
        .into_iter()
        .map(|t| MarketplaceHostTokenEntry {
            host: t.host,
            display_name: t.display_name,
            created_at_epoch_millis: t.created_at_epoch_millis,
            has_token: true,
        })
        .collect())
}

#[tauri::command]
pub fn marketplace_remove_host_token(
    host: String,
    token_store: State<'_, ManagedTokenStore>,
) -> CmdResult<Vec<MarketplaceHostTokenEntry>> {
    let remaining = token_store.remove_host_token(&host)?;
    Ok(remaining
        .into_iter()
        .map(|t| MarketplaceHostTokenEntry {
            host: t.host,
            display_name: t.display_name,
            created_at_epoch_millis: t.created_at_epoch_millis,
            has_token: true,
        })
        .collect())
}

#[tauri::command]
pub async fn marketplace_get_curated_feed(
    category: String,
    http: State<'_, ManagedHttpClient>,
    token_store: State<'_, ManagedTokenStore>,
    rate_store: State<'_, ManagedRateLimitStore>,
) -> CmdResult<Vec<serde_json::Value>> {
    let client = &http.0;
    let cat = if category.trim().is_empty() { "trending" } else { category.trim() };
    crate::marketplace::backend::fetch_curated_or_trending(
        client,
        &token_store,
        &rate_store,
        cat,
        "",
    )
    .await
}
