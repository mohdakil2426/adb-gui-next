use log::warn;
use reqwest::Client;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

/// Search IzzyOnDroid via their F-Droid-compatible API v1.
pub async fn search(client: &Client, query: &str) -> Vec<MarketplaceApp> {
    let url = format!(
        "https://apt.izzysoft.de/fdroid/api/v1/packages?search={}",
        urlencoding::encode(query)
    );

    let response = match client.get(&url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            warn!("IzzyOnDroid search failed: {e}");
            return vec![];
        }
    };

    let items: Vec<serde_json::Value> = match response.json().await {
        Ok(v) => v,
        Err(e) => {
            warn!("IzzyOnDroid parse failed: {e}");
            return vec![];
        }
    };

    items
        .into_iter()
        .filter_map(|item| {
            let package_name = item["packageName"].as_str()?.to_string();
            let name = item["name"].as_str().unwrap_or(&package_name).to_string();
            let summary = item["summary"].as_str().unwrap_or("").to_string();
            let version = item["suggestedVersionName"].as_str().unwrap_or("").to_string();
            let version_code = item["suggestedVersionCode"].as_i64().unwrap_or(0);

            let icon_url = item["icon"].as_str().map(|i| {
                if i.starts_with("http") {
                    i.to_string()
                } else {
                    format!("https://apt.izzysoft.de/fdroid/repo/{}/en-US/icon.png", package_name)
                }
            });

            let download_url = if version_code > 0 {
                Some(format!(
                    "https://apt.izzysoft.de/fdroid/repo/{}_{}.apk",
                    package_name, version_code
                ))
            } else {
                None
            };

            Some(MarketplaceApp {
                name,
                package_name,
                version,
                summary,
                icon_url,
                source: "IzzyOnDroid".into(),
                download_url,
                ..Default::default()
            })
        })
        .collect()
}

/// Get detailed metadata for a single IzzyOnDroid package.
pub async fn get_detail(client: &Client, package: &str) -> CmdResult<MarketplaceAppDetail> {
    let url = format!("https://apt.izzysoft.de/fdroid/api/v1/packages/{package}");
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
        Some(format!("https://apt.izzysoft.de/fdroid/repo/{package}_{version_code}.apk"))
    } else {
        None
    };

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
                        download_url: Some(format!(
                            "https://apt.izzysoft.de/fdroid/repo/{package}_{vc}.apk"
                        )),
                        published_at: p["added"].as_str().map(|s| s.to_string()),
                    })
                })
                .take(10)
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
        icon_url: Some(format!("https://apt.izzysoft.de/fdroid/repo/{package}/en-US/icon.png")),
        source: "IzzyOnDroid".into(),
        download_url,
        license: resp["license"].as_str().map(|s| s.to_string()),
        author: resp["authorName"].as_str().map(|s| s.to_string()),
        sources_available: vec!["IzzyOnDroid".into()],
        versions,
        ..Default::default()
    })
}
