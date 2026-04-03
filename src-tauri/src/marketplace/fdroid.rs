use log::warn;
use reqwest::Client;
use serde::Deserialize;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

// ─── F-Droid Meilisearch response ────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct FdroidSearchResponse {
    #[serde(default)]
    hits: Vec<FdroidHit>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct FdroidHit {
    #[serde(default)]
    name: String,
    #[serde(default)]
    package_name: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    suggested_version_name: String,
    #[serde(default)]
    suggested_version_code: i64,
    #[serde(default)]
    categories: Vec<String>,
}

/// Search F-Droid via their Meilisearch `/api/search_apps` endpoint.
pub async fn search(client: &Client, query: &str) -> Vec<MarketplaceApp> {
    let url = format!(
        "https://search.f-droid.org/api/search_apps?q={}&lang=en",
        urlencoding::encode(query)
    );

    let response = match client.get(&url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            warn!("F-Droid search failed: {e}");
            return vec![];
        }
    };

    let parsed = match response.json::<FdroidSearchResponse>().await {
        Ok(v) => v,
        Err(e) => {
            warn!("F-Droid parse failed: {e}");
            return vec![];
        }
    };

    parsed
        .hits
        .into_iter()
        .filter(|h| !h.package_name.is_empty())
        .map(|h| {
            let icon_url = if h.icon.is_empty() {
                None
            } else if h.icon.starts_with("http") {
                Some(h.icon.clone())
            } else {
                Some(format!("https://f-droid.org/repo/{}/en-US/icon.png", h.package_name))
            };

            let download_url = if h.suggested_version_code > 0 {
                Some(format!(
                    "https://f-droid.org/repo/{}_{}.apk",
                    h.package_name, h.suggested_version_code
                ))
            } else {
                None
            };

            MarketplaceApp {
                name: h.name,
                package_name: h.package_name,
                version: h.suggested_version_name,
                summary: h.summary,
                icon_url,
                source: "F-Droid".into(),
                download_url,
                categories: h.categories,
                ..Default::default()
            }
        })
        .collect()
}

/// Get detailed metadata for a single F-Droid package.
pub async fn get_detail(client: &Client, package: &str) -> CmdResult<MarketplaceAppDetail> {
    let url = format!("https://f-droid.org/api/v1/packages/{package}");
    let resp: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    let version_code = resp["suggestedVersionCode"].as_i64().unwrap_or(0);
    let download_url = if version_code > 0 {
        Some(format!("https://f-droid.org/repo/{package}_{version_code}.apk"))
    } else {
        None
    };

    // Build version history from packages array
    let versions = resp["packages"]
        .as_array()
        .map(|pkgs| {
            pkgs.iter()
                .filter_map(|p| {
                    let vc = p["versionCode"].as_i64()?;
                    Some(VersionInfo {
                        version_name: p["versionName"].as_str().unwrap_or("").to_string(),
                        version_code: vc,
                        size: p["size"].as_u64(),
                        download_url: Some(format!("https://f-droid.org/repo/{package}_{vc}.apk")),
                        published_at: p["added"].as_str().map(|s| s.to_string()),
                    })
                })
                .take(10) // Limit to 10 most recent versions
                .collect()
        })
        .unwrap_or_default();

    Ok(MarketplaceAppDetail {
        name: resp["name"].as_str().unwrap_or(package).to_string(),
        package_name: package.to_string(),
        version: resp["suggestedVersionName"].as_str().unwrap_or("").to_string(),
        description: resp["description"]
            .as_str()
            .or_else(|| resp["summary"].as_str())
            .unwrap_or("")
            .to_string(),
        icon_url: Some(format!("https://f-droid.org/repo/{package}/en-US/icon.png")),
        source: "F-Droid".into(),
        download_url,
        license: resp["license"].as_str().map(|s| s.to_string()),
        author: resp["authorName"].as_str().map(|s| s.to_string()),
        sources_available: vec!["F-Droid".into()],
        versions,
        ..Default::default()
    })
}
