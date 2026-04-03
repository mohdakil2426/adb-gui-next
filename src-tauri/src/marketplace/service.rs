use reqwest::Client;

use super::aptoide;
use super::fdroid;
use super::github;
use super::izzy;
use super::ranking::{dedupe_results, sort_results};
use super::types::{MarketplaceApp, MarketplaceAppDetail, SearchFilters, VersionInfo};
use crate::CmdResult;

fn token_scope(github_token: &Option<String>) -> &'static str {
    if github_token.as_ref().is_some_and(|token| !token.is_empty()) { "auth" } else { "anon" }
}

pub fn search_cache_key(query: &str, filters: &SearchFilters) -> String {
    let provider_key = if filters.providers.is_empty() {
        "all".to_string()
    } else {
        let mut providers = filters.providers.clone();
        providers.sort();
        providers.join(",")
    };

    format!(
        "search:{query}|{provider_key}|{}|{}|{}",
        filters.sort_by,
        token_scope(&filters.github_token),
        filters.results_per_provider
    )
}

pub fn detail_cache_key(package_name: &str, source: &str, github_token: &Option<String>) -> String {
    format!("detail:{package_name}|{source}|{}", github_token.as_deref().unwrap_or("anon"))
}

pub fn trending_cache_key(sort: &str, github_token: &Option<String>, limit: u32) -> String {
    format!("trending:{sort}|{}|{limit}", github_token.as_deref().unwrap_or("anon"))
}

pub async fn fetch_search_apps(
    client: &Client,
    query: &str,
    filters: &SearchFilters,
) -> Vec<MarketplaceApp> {
    let is_provider_enabled = |provider: &str| {
        filters.providers.is_empty() || filters.providers.iter().any(|entry| entry == provider)
    };
    let limit = filters.results_per_provider.max(5);
    let github_token = filters.github_token.clone();

    let (fdroid_results, github_results, aptoide_results) = tokio::join!(
        async {
            if is_provider_enabled("F-Droid") {
                let mut results = fdroid::search(client, query).await;
                results.truncate(limit as usize);
                results
            } else {
                vec![]
            }
        },
        async {
            if is_provider_enabled("GitHub") {
                github::search(client, query, &github_token, &filters.sort_by, limit).await
            } else {
                vec![]
            }
        },
        async {
            if is_provider_enabled("Aptoide") {
                aptoide::search(client, query, limit).await
            } else {
                vec![]
            }
        },
    );

    let izzy_results = if is_provider_enabled("IzzyOnDroid") && !fdroid_results.is_empty() {
        izzy::search_via_fdroid(client, &fdroid_results).await
    } else {
        vec![]
    };

    let mut results: Vec<MarketplaceApp> = Vec::new();
    results.extend(fdroid_results);
    results.extend(izzy_results);
    results.extend(github_results);
    results.extend(aptoide_results);

    let mut deduped = dedupe_results(results);
    sort_results(&mut deduped, query, &filters.sort_by);
    deduped
}

pub async fn fetch_app_detail(
    client: &Client,
    package_name: &str,
    source: &str,
    github_token: &Option<String>,
) -> CmdResult<MarketplaceAppDetail> {
    match source {
        "F-Droid" => fdroid::get_detail(client, package_name).await,
        "IzzyOnDroid" => izzy::get_detail(client, package_name).await,
        "GitHub" => github::get_detail(client, package_name, github_token).await,
        "Aptoide" => aptoide::get_detail(client, package_name).await,
        _ => Err(format!("Unknown source: {source}")),
    }
}

pub async fn fetch_trending(
    client: &Client,
    sort: &str,
    github_token: &Option<String>,
    limit: u32,
) -> Vec<MarketplaceApp> {
    let mut results = github::get_trending(client, github_token, sort).await;
    results.truncate(limit as usize);
    results
}

pub async fn list_versions(
    client: &Client,
    package_name: &str,
    source: &str,
    github_token: &Option<String>,
) -> CmdResult<Vec<VersionInfo>> {
    match source {
        "GitHub" => github::list_releases(client, package_name, github_token).await,
        "F-Droid" => Ok(fdroid::get_detail(client, package_name).await?.versions),
        "IzzyOnDroid" => Ok(izzy::get_detail(client, package_name).await?.versions),
        "Aptoide" => Ok(vec![]),
        _ => Err(format!("Unknown source for versions: {source}")),
    }
}
