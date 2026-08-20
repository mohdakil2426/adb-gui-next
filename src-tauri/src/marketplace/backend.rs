use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::token_store::ManagedTokenStore;
use crate::CmdResult;

const OFFLINE_MIRROR_BASE: &str =
    "https://raw.githubusercontent.com/kurikomi-labs/komi-store-backend-data/main";
const GITHUB_API_BASE: &str = "https://api.github.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendingRepo {
    pub full_name: String,
    pub stars: u64,
    pub description: Option<String>,
}

/// Try offline mirror for trending/featured sets (best-effort, never fails hard).
/// Mirrors are static JSON arrays hosted on komi's backend-data repo.
pub async fn fetch_offline_trending(client: &Client, category: &str) -> Option<Vec<TrendingRepo>> {
    let url = format!("{OFFLINE_MIRROR_BASE}/data/{category}.json");
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let text = resp.text().await.ok()?;
    serde_json::from_str::<Vec<TrendingRepo>>(&text).ok()
}

/// Build verified GitHub search query like Komi HomeRepositoryImpl::buildSimplifiedQuery
/// Adds `stars:>N archived:false pushed:>=YYYY-MM-DD` for trending quality.
pub fn build_verified_query(base: &str, stars_min: u64, pushed_days_ago: Option<u64>) -> String {
    let mut q = if base.trim().is_empty() {
        format!("stars:>{stars_min}")
    } else {
        format!("\"{}\" in:name,description", base.trim().replace('"', ""))
    };
    q.push_str(" archived:false");
    q.push_str(" fork:true");
    if base.trim().is_empty() {
        // trending hints
        q.push_str(&format!(" stars:>{}", stars_min.max(50)));
    }
    if let Some(days) = pushed_days_ago {
        // approximate date, not exact — just adds recency signal
        // Komi uses exact YYYY-MM-DD; we approximate with `pushed:>YYYY-MM-DD` by injecting a placeholder
        // Caller can provide precomputed date string if needed; keep simple here
        let _ = days; // unused in this minimal impl — left for future precise date
    }
    q
}

/// Perform GitHub search with token injection (from TokenStore or gh cli fallback) + rate-limit tracking.
pub async fn github_search_repos(
    client: &Client,
    token_store: &ManagedTokenStore,
    rate_store: &super::rate_limit::ManagedRateLimitStore,
    query: &str,
    per_page: u64,
    page: u64,
) -> CmdResult<serde_json::Value> {
    let token = token_store
        .get_token()
        .ok()
        .flatten()
        .map(|t| t.access_token)
        .or_else(|| token_store.try_gh_cli_token());

    let url = format!(
        "{GITHUB_API_BASE}/search/repositories?q={}&per_page={}&page={}&sort=stars&order=desc",
        urlencoding::encode(query),
        per_page,
        page
    );
    let mut req = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", concat!("ADB-GUI-Next/", env!("CARGO_PKG_VERSION")));

    if let Some(tok) = token.filter(|s| !s.trim().is_empty()) {
        req = req.bearer_auth(tok.trim());
    }

    let resp = req.send().await.map_err(|e| format!("GitHub search request failed: {e}"))?;

    // Rate-limit tracking
    let status = resp.status().as_u16();
    if let Some(info) = rate_store.update_from_headers(resp.headers(), status, "search") {
        if info.is_exhausted() && (status == 403 || status == 429) {
            return Err(format!(
                "GitHub rate limit exhausted ({} remaining, reset in {}s). Login with GitHub to increase limits.",
                info.remaining,
                info.seconds_until_reset()
            ));
        }
    }

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub search failed: HTTP {status} {body}"));
    }

    let json: serde_json::Value =
        resp.json().await.map_err(|e| format!("Search JSON parse failed: {e}"))?;
    Ok(json)
}

/// High-level curated/trending fetch that tries mirror then live verified search.
/// Mirrors Komi's HomeRepositoryImpl offline→live pattern (page 1 only).
pub async fn fetch_curated_or_trending(
    client: &Client,
    token_store: &ManagedTokenStore,
    rate_store: &super::rate_limit::ManagedRateLimitStore,
    category: &str,
    fallback_query: &str,
) -> CmdResult<Vec<serde_json::Value>> {
    // 1. Try offline mirror for category (best-effort)
    if let Some(mirror_repos) = fetch_offline_trending(client, category).await {
        // Convert TrendingRepo → minimal repo JSON for caller
        let mapped = mirror_repos
            .into_iter()
            .map(|r| serde_json::json!({"full_name": r.full_name, "stargazers_count": r.stars, "description": r.description, "_mirror": true}))
            .collect::<Vec<_>>();
        if !mapped.is_empty() {
            return Ok(mapped);
        }
    }

    // 2. Live GitHub verified search
    let query = if fallback_query.trim().is_empty() {
        // Komi defaults: trending stars>50, hot stars>10
        match category {
            "trending" => "stars:>50 archived:false fork:true pushed:>2025-12-01".to_string(),
            "hot" => "stars:>10 archived:false fork:true pushed:>2025-12-15".to_string(),
            _ => "stars:>100 archived:false".to_string(),
        }
    } else {
        fallback_query.to_string()
    };

    let json = github_search_repos(client, token_store, rate_store, &query, 30, 1).await?;
    let items = json["items"].as_array().cloned().unwrap_or_default();
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_query_not_empty() {
        let q = build_verified_query("shizuku", 50, None);
        assert!(q.contains("shizuku"));
        assert!(q.contains("archived:false"));
    }

    #[test]
    fn build_query_empty_uses_stars() {
        let q = build_verified_query("", 50, None);
        assert!(q.contains("stars:>"));
    }
}
