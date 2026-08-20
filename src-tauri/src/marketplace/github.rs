use std::sync::Arc;

use log::warn;
use reqwest::Client;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use super::assets::{is_apk_asset, rank_and_select_best_apk};
use super::markdown::enrich_readme_markdown;
use super::resolver::resolve_github_repo_dynamic;
use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

/// Komi Store uses VERIFY_CONCURRENCY=15. We match it for Android APK verification.
const VERIFY_CONCURRENCY: usize = 15;

/// Number of releases to scan per repo during APK verification.
const VERIFY_RELEASE_DEPTH: usize = 5;

fn auth_headers(
    builder: reqwest::RequestBuilder,
    token: &Option<String>,
) -> reqwest::RequestBuilder {
    let mut req = builder.header("User-Agent", "ADB-GUI-Next-Marketplace");
    if let Some(tok) = token {
        let trimmed = tok.trim();
        if !trimmed.is_empty() {
            req = req.header("Authorization", format!("Bearer {trimmed}"));
        }
    }
    req
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

/// Verify search results have APK/APKS assets by scanning recent releases.
/// When `apk_only` is false, all repos are returned with `installable` annotated.
/// When true, only repos with installable Android assets survive (Komi behavior).
async fn verify_apk_availability(
    client: &Client,
    repos: Vec<MarketplaceApp>,
    token: &Option<String>,
    apk_only: bool,
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
            let Ok(_permit) = sem.acquire().await else {
                return app;
            };

            let url = format!(
                "https://api.github.com/repos/{}/releases?per_page={VERIFY_RELEASE_DEPTH}",
                app.package_name
            );

            let Ok(response) = auth_headers(client.get(&url), &token).send().await else {
                return app;
            };

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
                if let Some(best_apk) = rank_and_select_best_apk(assets) {
                    app.installable = true;
                    if app.download_url.is_none() {
                        app.download_url =
                            best_apk["browser_download_url"].as_str().map(|s| s.to_string());
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
            if apk_only && !app.installable {
                continue;
            }
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
    apk_only: bool,
) -> Vec<MarketplaceApp> {
    // Komi-style: when query is blank, list everything via trending Android repos.
    // Fallback to "stars:>100" style when empty (mirrors Komi buildSearchQuery).
    let effective_query = {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            "topic:android stars:>100".to_string()
        } else {
            format!("{trimmed} topic:android fork:false archived:false")
        }
    };
    let q = effective_query;
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

    verify_apk_availability(client, parsed, token, apk_only).await
}

pub async fn get_detail(
    client: &Client,
    package_or_repo: &str,
    token: &Option<String>,
) -> CmdResult<MarketplaceAppDetail> {
    // Resolve package ID or alias to canonical owner/repo slug dynamically
    let full_name = resolve_github_repo_dynamic(client, package_or_repo, None, None, token)
        .await
        .unwrap_or_else(|| package_or_repo.to_string());

    let repo_url = format!("https://api.github.com/repos/{full_name}");
    let repo_response =
        auth_headers(client.get(&repo_url), token).send().await.map_err(|e| e.to_string())?;

    let repo_status = repo_response.status();
    if repo_status == reqwest::StatusCode::FORBIDDEN || repo_status.as_u16() == 429 {
        return Err("GitHub API rate limit reached. Please sign in with GitHub or provide a Personal Access Token in Settings.".into());
    }

    if !repo_status.is_success() {
        return Err(format!("GitHub repository lookup failed: HTTP {repo_status} for {full_name}"));
    }

    let repo: serde_json::Value = repo_response.json().await.map_err(|e| e.to_string())?;
    let default_branch = repo["default_branch"].as_str().unwrap_or("HEAD");

    // Fetch releases: try /releases/latest first
    let latest_url = format!("https://api.github.com/repos/{full_name}/releases/latest");
    let latest_resp = auth_headers(client.get(&latest_url), token).send().await.ok();
    let mut release: Option<serde_json::Value> = None;
    if let Some(resp) = latest_resp.filter(|r| r.status().is_success()) {
        release = resp.json().await.ok();
    }
    // Fallback if /releases/latest returned 404 (e.g. pre-releases only, like Lawnchair 14 beta)
    if release.is_none() {
        release = fetch_first_release(client, &full_name, token).await;
    }

    let empty = vec![];
    let assets = release.as_ref().and_then(|value| value["assets"].as_array()).unwrap_or(&empty);
    let best_apk = rank_and_select_best_apk(assets);

    let download_url = best_apk
        .and_then(|asset| asset["browser_download_url"].as_str())
        .map(|value| value.to_string());
    let size = best_apk.and_then(|asset| asset["size"].as_u64());

    let changelog = release.as_ref().and_then(|value| {
        value["body"].as_str().filter(|body| !body.is_empty()).map(|body| body.to_string())
    });

    let versions = list_releases(client, &full_name, token).await.unwrap_or_else(|_| {
        assets
            .iter()
            .filter(|a| a["name"].as_str().is_some_and(is_apk_asset))
            .map(|asset| VersionInfo {
                version_name: format!(
                    "{} ({})",
                    release
                        .as_ref()
                        .and_then(|value| value["tag_name"].as_str())
                        .unwrap_or("unknown"),
                    asset["name"].as_str().unwrap_or("asset")
                ),
                version_code: 0,
                size: asset["size"].as_u64(),
                download_url: asset["browser_download_url"].as_str().map(str::to_string),
                published_at: release
                    .as_ref()
                    .and_then(|value| value["published_at"].as_str())
                    .map(str::to_string),
            })
            .collect()
    });

    let readme_markdown = fetch_readme(client, &full_name, Some(default_branch), token).await;

    Ok(MarketplaceAppDetail {
        name: repo["name"].as_str().unwrap_or(&full_name).to_string(),
        package_name: package_or_repo.to_string(),
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
        readme_markdown,
        ..Default::default()
    })
}

pub async fn list_releases(
    client: &Client,
    package_or_repo: &str,
    token: &Option<String>,
) -> CmdResult<Vec<VersionInfo>> {
    let full_name = resolve_github_repo_dynamic(client, package_or_repo, None, None, token)
        .await
        .unwrap_or_else(|| package_or_repo.to_string());

    let mut versions = Vec::new();
    for page in 1..=5 {
        let url =
            format!("https://api.github.com/repos/{full_name}/releases?per_page=50&page={page}");
        let response =
            auth_headers(client.get(&url), token).send().await.map_err(|e| e.to_string())?;
        let status = response.status().as_u16();
        if status == 403 || status == 429 {
            return Err("GitHub rate limit reached while listing releases.".into());
        }
        if !response.status().is_success() {
            return Err(format!("GitHub releases lookup failed: HTTP {}", response.status()));
        }
        let releases: Vec<serde_json::Value> = response.json().await.map_err(|e| e.to_string())?;
        if releases.is_empty() {
            break;
        }
        for release in &releases {
            let empty = vec![];
            let assets = release["assets"].as_array().unwrap_or(&empty);
            let tag = release["tag_name"].as_str().unwrap_or("unknown");
            let published = release["published_at"].as_str().map(str::to_string);
            for asset in assets {
                if !asset["name"].as_str().is_some_and(is_apk_asset) {
                    continue;
                }
                let asset_name = asset["name"].as_str().unwrap_or("app.apk");
                versions.push(VersionInfo {
                    version_name: format!("{tag} / {asset_name}"),
                    version_code: 0,
                    size: asset["size"].as_u64(),
                    download_url: asset["browser_download_url"].as_str().map(str::to_string),
                    published_at: published.clone(),
                });
            }
        }
        if releases.len() < 50 {
            break;
        }
    }
    Ok(versions)
}

async fn fetch_first_release(
    client: &Client,
    full_name: &str,
    token: &Option<String>,
) -> Option<serde_json::Value> {
    let releases_url = format!("https://api.github.com/repos/{full_name}/releases?per_page=5");
    let resp = auth_headers(client.get(&releases_url), token).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let mut list = resp.json::<Vec<serde_json::Value>>().await.ok()?;
    if list.is_empty() { None } else { Some(list.remove(0)) }
}

async fn fetch_readme_endpoint(
    client: &Client,
    url: &str,
    is_api: bool,
    token: &Option<String>,
) -> Option<String> {
    let mut req = client.get(url);
    if is_api {
        req = auth_headers(req, token).header("Accept", "application/vnd.github.raw");
    }
    let response = req.send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    let text = response.text().await.ok()?;
    let trimmed = text.trim();
    if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
}

/// Fetches README markdown using a dual-path engine:
/// 1. GitHub API `/repos/{full_name}/readme` with raw accept header.
/// 2. Raw CDN fallback (`raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}`)
///    across standard root, `.github/`, and `docs/` paths.
/// 3. Enriches markdown by rewriting relative images and document links.
pub async fn fetch_readme(
    client: &Client,
    package_or_repo: &str,
    default_branch: Option<&str>,
    token: &Option<String>,
) -> Option<String> {
    let full_name = resolve_github_repo_dynamic(client, package_or_repo, None, None, token)
        .await
        .unwrap_or_else(|| package_or_repo.to_string());

    let parts: Vec<&str> = full_name.split('/').collect();
    if parts.len() != 2 {
        return None;
    }
    let (owner, repo) = (parts[0], parts[1]);

    // 1. Primary path: GitHub API
    let api_url = format!("https://api.github.com/repos/{full_name}/readme");
    if let Some(text) = fetch_readme_endpoint(client, &api_url, true, token).await {
        return Some(enrich_readme_markdown(&text, owner, repo, default_branch));
    }

    // 2. Secondary path: Direct raw CDN fallback
    let branches = [default_branch.unwrap_or("HEAD"), "main", "master"];
    let files = [
        "README.md",
        "README.markdown",
        "README.rst",
        "README",
        ".github/README.md",
        "docs/README.md",
    ];

    for branch in branches {
        for file in files {
            let raw_url =
                format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}");
            if let Some(text) = fetch_readme_endpoint(client, &raw_url, false, token).await {
                return Some(enrich_readme_markdown(&text, owner, repo, Some(branch)));
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_headers_with_and_without_token() {
        let client = Client::new();
        let builder = client.get("https://example.com");
        let with_token = auth_headers(builder, &Some("ghp_test123".into()));
        let req = with_token.build().unwrap();
        assert!(req.headers().contains_key("authorization"));

        let builder2 = client.get("https://example.com");
        let no_token = auth_headers(builder2, &None);
        let req2 = no_token.build().unwrap();
        assert!(!req2.headers().contains_key("authorization"));
    }
}
