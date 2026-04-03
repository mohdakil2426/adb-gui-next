use log::warn;
use reqwest::Client;
use serde::Deserialize;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

// ─── F-Droid search response (actual API format, verified 2026-04) ───────────

#[derive(Deserialize, Debug)]
struct FdroidSearchResponse {
    #[serde(default)]
    apps: Vec<FdroidSearchApp>,
}

#[derive(Deserialize, Debug)]
struct FdroidSearchApp {
    #[serde(default)]
    name: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    url: String,
}

/// Extract the package name from an F-Droid URL like
/// `https://f-droid.org/en/packages/org.schabi.newpipe`.
fn extract_package_from_url(url: &str) -> Option<String> {
    url.trim_end_matches('/').rsplit('/').next().map(|s| s.to_string())
}

/// Search F-Droid via their search endpoint.
///
/// API: `GET https://search.f-droid.org/api/search_apps?q={query}&lang=en`
/// Response key is `apps` (array of {name, summary, icon, url}).
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
        .apps
        .into_iter()
        .filter_map(|app| {
            let package_name = extract_package_from_url(&app.url)?;
            if package_name.is_empty() {
                return None;
            }

            // Icon URL: the API now returns full URLs from ftp.fau.de
            let icon_url = if app.icon.is_empty() {
                None
            } else if app.icon.starts_with("http") {
                Some(app.icon)
            } else {
                Some(format!("https://f-droid.org/repo/{}/en-US/icon.png", package_name))
            };

            // Download URL: construct from package name + latest version code
            // We can't get version code from search results, so leave it None
            // and resolve it in get_detail() instead.
            let repo_url = if app.url.is_empty() { None } else { Some(app.url) };

            Some(MarketplaceApp {
                name: app.name,
                package_name,
                summary: app.summary,
                icon_url,
                source: "F-Droid".into(),
                repo_url,
                ..Default::default()
            })
        })
        .collect()
}

/// Get detailed metadata for a single F-Droid package.
///
/// The v1 API only returns version info, so we also try to fetch the
/// search metadata for enrichment.
pub async fn get_detail(client: &Client, package: &str) -> CmdResult<MarketplaceAppDetail> {
    // Fetch version info from the packages API
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

    // Try to enrich with search data for name/summary
    let search_url = format!(
        "https://search.f-droid.org/api/search_apps?q={}&lang=en",
        urlencoding::encode(package)
    );
    let search_meta = match client.get(&search_url).send().await {
        Ok(r) => r.json::<FdroidSearchResponse>().await.ok().and_then(|sr| {
            sr.apps
                .into_iter()
                .find(|a| extract_package_from_url(&a.url).map(|p| p == package).unwrap_or(false))
        }),
        Err(_) => None,
    };

    let name = search_meta.as_ref().map(|m| m.name.clone()).unwrap_or_else(|| package.to_string());
    let description = search_meta.as_ref().map(|m| m.summary.clone()).unwrap_or_default();
    let icon_url = search_meta.as_ref().and_then(|m| {
        if m.icon.is_empty() {
            None
        } else if m.icon.starts_with("http") {
            Some(m.icon.clone())
        } else {
            Some(format!("https://f-droid.org/repo/{package}/en-US/icon.png"))
        }
    });

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
                .take(10)
                .collect()
        })
        .unwrap_or_default();

    let version_name = resp["packages"]
        .as_array()
        .and_then(|pkgs| {
            pkgs.first().and_then(|p| p["versionName"].as_str().map(|s| s.to_string()))
        })
        .unwrap_or_default();

    Ok(MarketplaceAppDetail {
        name,
        package_name: package.to_string(),
        version: version_name,
        description,
        icon_url,
        source: "F-Droid".into(),
        download_url,
        sources_available: vec!["F-Droid".into()],
        versions,
        ..Default::default()
    })
}
