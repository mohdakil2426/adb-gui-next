use std::sync::Arc;

use log::warn;
use reqwest::Client;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

/// Maximum concurrent verification requests to avoid overwhelming GitHub API.
const VERIFY_CONCURRENCY: usize = 5;

/// Number of releases to scan per repo during APK verification.
const VERIFY_RELEASE_DEPTH: usize = 5;

fn auth_headers(
    builder: reqwest::RequestBuilder,
    token: &Option<String>,
) -> reqwest::RequestBuilder {
    let builder = builder
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28");
    match token {
        Some(t) if !t.is_empty() => builder.header("Authorization", format!("Bearer {t}")),
        _ => builder,
    }
}

fn is_apk_asset(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".apk")
        && !lower.contains("debug")
        && !lower.ends_with(".aab")
        && !lower.ends_with(".xapk")
        && !lower.ends_with(".apks")
}

/// Compute a date string ~6 months ago for the trending filter.
/// Avoids the `chrono` dependency — uses simple epoch arithmetic.
fn trending_cutoff_date() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // ~182 days (6 months)
    let cutoff = now.saturating_sub(182 * 24 * 60 * 60);
    format_epoch_date(cutoff)
}

fn format_epoch_date(epoch_secs: u64) -> String {
    let total_days = epoch_secs / 86400;
    let mut year = 1970u32;
    let mut remaining = total_days as u32;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        year += 1;
    }

    let months =
        [31, if is_leap_year(year) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1u32;
    for &m in &months {
        if remaining < m {
            break;
        }
        remaining -= m;
        month += 1;
    }
    let day = remaining + 1;
    format!("{year}-{month:02}-{day:02}")
}

const fn is_leap_year(y: u32) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

fn parse_repo_items(items: &[serde_json::Value]) -> Vec<MarketplaceApp> {
    items
        .iter()
        .filter_map(|repo| {
            let full_name = repo["full_name"].as_str()?.to_string();
            let name = repo["name"].as_str().unwrap_or("").to_string();
            let summary = repo["description"].as_str().unwrap_or("GitHub repository").to_string();
            let html_url = repo["html_url"].as_str().unwrap_or("").to_string();
            let stars = repo["stargazers_count"].as_u64().unwrap_or(0);
            let updated_at = repo["pushed_at"].as_str().map(|value| value.to_string());
            let language = repo["language"].as_str().map(|v| v.to_string());

            let categories: Vec<String> = repo["topics"]
                .as_array()
                .map(|topics| {
                    topics
                        .iter()
                        .filter_map(|topic| topic.as_str().map(|value| value.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            Some(MarketplaceApp {
                name,
                package_name: full_name,
                version: format!("★ {stars}"),
                summary,
                icon_url: repo["owner"]["avatar_url"].as_str().map(|value| value.to_string()),
                source: "GitHub".into(),
                available_sources: vec!["GitHub".into()],
                download_url: None,
                repo_url: Some(html_url),
                downloads_count: Some(stars),
                categories,
                updated_at,
                installable: false,
                language,
                ..Default::default()
            })
        })
        .collect()
}

/// Verify search results have APK assets by scanning recent releases.
///
/// Uses `JoinSet` + `Semaphore` for bounded concurrency (max 5 simultaneous).
/// Each repo is checked for APK assets in its last N releases. If found, the
/// `installable` flag is set to `true` and the download URL is captured.
///
/// On rate-limit (403/429), verification is gracefully skipped — the app is
/// returned unmodified (installable=false) rather than blocking the search.
async fn verify_apk_availability(
    client: &Client,
    repos: Vec<MarketplaceApp>,
    token: &Option<String>,
) -> Vec<MarketplaceApp> {
    if repos.is_empty() {
        return repos;
    }

    let semaphore = Arc::new(Semaphore::new(VERIFY_CONCURRENCY));
    let mut set = JoinSet::new();

    for app in repos {
        let client = client.clone();
        let token = token.clone();
        let sem = Arc::clone(&semaphore);

        set.spawn(async move {
            let _permit = match sem.acquire().await {
                Ok(p) => p,
                Err(_) => return app, // semaphore closed — return unmodified
            };

            let url = format!(
                "https://api.github.com/repos/{}/releases?per_page={VERIFY_RELEASE_DEPTH}",
                app.package_name
            );

            let response = match auth_headers(client.get(&url), &token).send().await {
                Ok(r) => r,
                Err(_) => return app,
            };

            // On rate-limit, skip verification gracefully
            let status = response.status().as_u16();
            if status == 403 || status == 429 || !response.status().is_success() {
                return app;
            }

            let releases: Vec<serde_json::Value> = match response.json().await {
                Ok(r) => r,
                Err(_) => return app,
            };

            let mut app = app;
            for release in &releases {
                let empty = vec![];
                let assets = release["assets"].as_array().unwrap_or(&empty);
                if let Some(apk) =
                    assets.iter().find(|a| a["name"].as_str().is_some_and(is_apk_asset))
                {
                    app.installable = true;
                    if app.download_url.is_none() {
                        app.download_url =
                            apk["browser_download_url"].as_str().map(|s| s.to_string());
                    }
                    break;
                }
            }
            app
        });
    }

    let mut verified = Vec::new();
    while let Some(result) = set.join_next().await {
        if let Ok(app) = result {
            verified.push(app);
        }
    }
    verified
}

pub async fn search(
    client: &Client,
    query: &str,
    token: &Option<String>,
    sort: &str,
    per_page: u32,
) -> Vec<MarketplaceApp> {
    let q = format!("{query} topic:android fork:false archived:false");
    let url = format!(
        "https://api.github.com/search/repositories?q={}&sort={sort}&per_page={per_page}",
        urlencoding::encode(&q)
    );

    let response = match auth_headers(client.get(&url), token).send().await {
        Ok(resp) => resp,
        Err(error) => {
            warn!("GitHub search failed: {error}");
            return vec![];
        }
    };

    let status = response.status().as_u16();
    if status == 403 || status == 429 {
        warn!("GitHub rate limit hit — consider signing in or adding a Personal Access Token");
        return vec![];
    }
    if !response.status().is_success() {
        warn!("GitHub search returned HTTP {status}");
        return vec![];
    }

    let body: serde_json::Value = match response.json().await {
        Ok(value) => value,
        Err(error) => {
            warn!("GitHub search parse failed: {error}");
            return vec![];
        }
    };

    let empty = vec![];
    let items = body["items"].as_array().unwrap_or(&empty);
    let parsed = parse_repo_items(items);

    // Verify which repos actually have APK releases (eliminates ghost results)
    verify_apk_availability(client, parsed, token).await
}

pub async fn get_detail(
    client: &Client,
    full_name: &str,
    token: &Option<String>,
) -> CmdResult<MarketplaceAppDetail> {
    let repo_url = format!("https://api.github.com/repos/{full_name}");
    let repo_response =
        auth_headers(client.get(&repo_url), token).send().await.map_err(|e| e.to_string())?;

    if !repo_response.status().is_success() {
        return Err(format!("GitHub repository lookup failed: HTTP {}", repo_response.status()));
    }

    let repo: serde_json::Value = repo_response.json().await.map_err(|e| e.to_string())?;

    let release_url = format!("https://api.github.com/repos/{full_name}/releases/latest");
    let release_response =
        auth_headers(client.get(&release_url), token).send().await.map_err(|e| e.to_string())?;

    let release = if release_response.status() == reqwest::StatusCode::NOT_FOUND {
        None
    } else if !release_response.status().is_success() {
        return Err(format!("GitHub release lookup failed: HTTP {}", release_response.status()));
    } else {
        Some(release_response.json::<serde_json::Value>().await.map_err(|e| e.to_string())?)
    };

    let empty = vec![];
    let assets = release.as_ref().and_then(|value| value["assets"].as_array()).unwrap_or(&empty);
    let apk_assets: Vec<&serde_json::Value> =
        assets.iter().filter(|asset| asset["name"].as_str().is_some_and(is_apk_asset)).collect();

    let first_apk = apk_assets.first();
    let download_url = first_apk
        .and_then(|asset| asset["browser_download_url"].as_str())
        .map(|value| value.to_string());
    let size = first_apk.and_then(|asset| asset["size"].as_u64());
    let changelog = release.as_ref().and_then(|value| {
        value["body"].as_str().filter(|body| !body.is_empty()).map(|body| body.to_string())
    });

    let versions: Vec<VersionInfo> = apk_assets
        .iter()
        .map(|asset| VersionInfo {
            version_name: format!(
                "{} ({})",
                release.as_ref().and_then(|value| value["tag_name"].as_str()).unwrap_or("unknown"),
                asset["name"].as_str().unwrap_or("asset")
            ),
            version_code: 0,
            size: asset["size"].as_u64(),
            download_url: asset["browser_download_url"].as_str().map(|value| value.to_string()),
            published_at: release
                .as_ref()
                .and_then(|value| value["published_at"].as_str())
                .map(|value| value.to_string()),
        })
        .collect();

    Ok(MarketplaceAppDetail {
        name: repo["name"].as_str().unwrap_or(full_name).to_string(),
        package_name: full_name.to_string(),
        version: release
            .as_ref()
            .and_then(|value| value["tag_name"].as_str())
            .unwrap_or("Repo only")
            .to_string(),
        description: repo["description"].as_str().unwrap_or("").to_string(),
        icon_url: repo["owner"]["avatar_url"].as_str().map(|value| value.to_string()),
        source: "GitHub".into(),
        download_url,
        repo_url: repo["html_url"].as_str().map(|value| value.to_string()),
        size,
        license: repo["license"]["spdx_id"].as_str().map(|value| value.to_string()),
        author: repo["owner"]["login"].as_str().map(|value| value.to_string()),
        sources_available: vec!["GitHub".into()],
        changelog,
        versions,
        repo_stars: repo["stargazers_count"].as_u64(),
        repo_forks: repo["forks_count"].as_u64(),
        updated_at: repo["pushed_at"].as_str().map(|value| value.to_string()),
        ..Default::default()
    })
}

pub async fn list_releases(
    client: &Client,
    full_name: &str,
    token: &Option<String>,
) -> CmdResult<Vec<VersionInfo>> {
    let url = format!("https://api.github.com/repos/{full_name}/releases?per_page=20");

    let response = auth_headers(client.get(&url), token).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("GitHub releases lookup failed: HTTP {}", response.status()));
    }

    let releases: Vec<serde_json::Value> = response.json().await.map_err(|e| e.to_string())?;

    let versions = releases
        .iter()
        .filter_map(|release| {
            let empty = vec![];
            let assets = release["assets"].as_array().unwrap_or(&empty);
            let apk =
                assets.iter().find(|asset| asset["name"].as_str().is_some_and(is_apk_asset))?;

            Some(VersionInfo {
                version_name: release["tag_name"].as_str().unwrap_or("unknown").to_string(),
                version_code: 0,
                size: apk["size"].as_u64(),
                download_url: apk["browser_download_url"].as_str().map(|value| value.to_string()),
                published_at: release["published_at"].as_str().map(|value| value.to_string()),
            })
        })
        .collect();

    Ok(versions)
}

pub async fn get_trending(
    client: &Client,
    token: &Option<String>,
    sort: &str,
) -> Vec<MarketplaceApp> {
    let cutoff = trending_cutoff_date();
    let query = format!("topic:android fork:false archived:false stars:>50 pushed:>{cutoff}");
    let url = format!(
        "https://api.github.com/search/repositories?q={}&sort={sort}&per_page=12",
        urlencoding::encode(&query)
    );

    let response = match auth_headers(client.get(&url), token).send().await {
        Ok(resp) => resp,
        Err(error) => {
            warn!("GitHub trending failed: {error}");
            return vec![];
        }
    };

    if !response.status().is_success() {
        warn!("GitHub trending returned {}", response.status());
        return vec![];
    }

    let body: serde_json::Value = match response.json().await {
        Ok(value) => value,
        Err(error) => {
            warn!("GitHub trending parse failed: {error}");
            return vec![];
        }
    };

    let empty = vec![];
    let items = body["items"].as_array().unwrap_or(&empty);
    let parsed = parse_repo_items(items);

    // Verify trending repos for APK availability
    verify_apk_availability(client, parsed, token).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trending_cutoff_date_is_valid_format() {
        let date = trending_cutoff_date();
        // Should be YYYY-MM-DD
        assert_eq!(date.len(), 10);
        assert_eq!(date.as_bytes()[4], b'-');
        assert_eq!(date.as_bytes()[7], b'-');
    }

    #[test]
    fn format_epoch_known_date() {
        // 2025-01-01 00:00:00 UTC = 1735689600
        let date = format_epoch_date(1_735_689_600);
        assert_eq!(date, "2025-01-01");
    }

    #[test]
    fn leap_year_check() {
        assert!(is_leap_year(2024));
        assert!(!is_leap_year(2023));
        assert!(is_leap_year(2000));
        assert!(!is_leap_year(1900));
    }

    #[test]
    fn apk_filter_excludes_debug_and_non_apk() {
        assert!(is_apk_asset("app-release.apk"));
        assert!(!is_apk_asset("app-debug.apk"));
        assert!(!is_apk_asset("bundle.aab"));
        assert!(!is_apk_asset("app.xapk"));
        assert!(!is_apk_asset("app.apks"));
    }
}
