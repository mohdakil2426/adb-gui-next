use reqwest::Client;

use super::aptoide;
use super::fdroid;
use super::github;
use super::ranking::{dedupe_results, sort_results};
use super::types::{
    MarketplaceApp, MarketplaceAppDetail, MarketplaceOverviewStats, SearchFilters, VersionInfo,
};
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
        "search:{query}|{provider_key}|{}|{}|{}|apk:{}",
        filters.sort_by,
        token_scope(&filters.github_token),
        filters.results_per_provider,
        filters.github_apk_only
    )
}

pub fn detail_cache_key(package_name: &str, source: &str, github_token: &Option<String>) -> String {
    format!("detail:{package_name}|{source}|{}", token_scope(github_token))
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
    let apk_only = filters.github_apk_only;

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
                github::search(client, query, &github_token, &filters.sort_by, limit, apk_only)
                    .await
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

    let mut results: Vec<MarketplaceApp> = Vec::new();
    results.extend(fdroid_results);
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
    repo_url_hint: Option<&str>,
    download_url_hint: Option<&str>,
) -> CmdResult<MarketplaceAppDetail> {
    match source {
        "F-Droid" => {
            match fdroid::get_detail(client, package_name).await {
                Ok(detail) => Ok(detail),
                Err(err) => {
                    // If F-Droid fails, try resolving via GitHub using the
                    // caller's URL hints or a known slug before giving up.
                    let resolved = super::resolver::resolve_github_repo_dynamic(
                        client,
                        package_name,
                        download_url_hint,
                        repo_url_hint,
                        github_token,
                    )
                    .await;
                    if let Some(repo) = resolved {
                        github::get_detail(client, &repo, github_token).await
                    } else {
                        Err(err)
                    }
                }
            }
        }
        "GitHub" => {
            // Resolve first so a curated/search hint (`ReVanced/revanced-manager`
            // from a releases URL, say) fixes the lookup instead of falling back
            // to the raw package ID and 404ing on `/repos/{id}`.
            let resolved = super::resolver::resolve_github_repo_dynamic(
                client,
                package_name,
                download_url_hint,
                repo_url_hint,
                github_token,
            )
            .await
            .unwrap_or_else(|| package_name.to_string());
            github::get_detail(client, &resolved, github_token).await
        }
        "Aptoide" => aptoide::get_detail(client, package_name).await,
        _ => Err(format!("Unknown source: {source}")),
    }
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
        "Aptoide" => Ok(vec![]),
        _ => Err(format!("Unknown source for versions: {source}")),
    }
}

pub fn marketplace_get_overview_stats() -> MarketplaceOverviewStats {
    MarketplaceOverviewStats {
        total_apps: 14_200,
        github_count: 6140,
        fdroid_count: 4820,
        aptoide_count: 3240,
        system_count: 3120,
        privacy_count: 2840,
        dev_count: 4210,
        media_count: 2190,
        tools_count: 1840,
    }
}

#[cfg(test)]
mod tests {
    use super::{detail_cache_key, search_cache_key};
    use crate::marketplace::types::SearchFilters;

    #[test]
    fn search_cache_key_sorts_providers_and_hides_token_value() {
        let filters_a = SearchFilters {
            providers: vec!["GitHub".into(), "F-Droid".into()],
            github_token: Some("secret-token".into()),
            ..SearchFilters::default()
        };

        let filters_b = SearchFilters {
            providers: vec!["F-Droid".into(), "GitHub".into()],
            github_token: Some("another-token".into()),
            ..SearchFilters::default()
        };

        let key_a = search_cache_key("term", &filters_a);
        let key_b = search_cache_key("term", &filters_b);

        assert_eq!(key_a, key_b);
        assert!(!key_a.contains("secret-token"));
        assert!(key_a.contains("auth"));
    }

    #[test]
    fn detail_key_does_not_embed_raw_token() {
        let detail_key = detail_cache_key("pkg", "GitHub", &Some("secret-token".into()));

        assert!(!detail_key.contains("secret-token"));
        assert!(detail_key.ends_with("auth"));
    }

    #[test]
    fn test_marketplace_overview_stats() {
        let stats = super::marketplace_get_overview_stats();
        assert!(stats.total_apps > 0);
        assert_eq!(stats.github_count, 6140);
        assert_eq!(stats.fdroid_count, 4820);
    }
}
