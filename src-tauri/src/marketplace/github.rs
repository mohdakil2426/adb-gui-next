use log::warn;
use reqwest::Client;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

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
                ..Default::default()
            })
        })
        .collect()
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
    parse_repo_items(items)
}

pub async fn get_detail(
    client: &Client,
    full_name: &str,
    token: &Option<String>,
) -> CmdResult<MarketplaceAppDetail> {
    let repo_url = format!("https://api.github.com/repos/{full_name}");
    let repo: serde_json::Value = auth_headers(client.get(&repo_url), token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let release_url = format!("https://api.github.com/repos/{full_name}/releases/latest");
    let release: serde_json::Value = auth_headers(client.get(&release_url), token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let empty = vec![];
    let assets = release["assets"].as_array().unwrap_or(&empty);
    let apk_assets: Vec<&serde_json::Value> =
        assets.iter().filter(|asset| asset["name"].as_str().is_some_and(is_apk_asset)).collect();

    let first_apk = apk_assets.first();
    let download_url = first_apk
        .and_then(|asset| asset["browser_download_url"].as_str())
        .map(|value| value.to_string());
    let size = first_apk.and_then(|asset| asset["size"].as_u64());
    let changelog =
        release["body"].as_str().filter(|value| !value.is_empty()).map(|value| value.to_string());

    let versions: Vec<VersionInfo> = apk_assets
        .iter()
        .map(|asset| VersionInfo {
            version_name: format!(
                "{} ({})",
                release["tag_name"].as_str().unwrap_or("unknown"),
                asset["name"].as_str().unwrap_or("asset")
            ),
            version_code: 0,
            size: asset["size"].as_u64(),
            download_url: asset["browser_download_url"].as_str().map(|value| value.to_string()),
            published_at: release["published_at"].as_str().map(|value| value.to_string()),
        })
        .collect();

    Ok(MarketplaceAppDetail {
        name: repo["name"].as_str().unwrap_or(full_name).to_string(),
        package_name: full_name.to_string(),
        version: release["tag_name"].as_str().unwrap_or("unknown").to_string(),
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

    let releases: Vec<serde_json::Value> = auth_headers(client.get(&url), token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

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
    let query = "topic:android fork:false archived:false stars:>50 pushed:>2025-01-01";
    let url = format!(
        "https://api.github.com/search/repositories?q={}&sort={sort}&per_page=12",
        urlencoding::encode(query)
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
    parse_repo_items(items)
}
