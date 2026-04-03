use log::warn;
use reqwest::Client;
use serde::Deserialize;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

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

fn extract_package_from_url(url: &str) -> Option<String> {
    url.trim_end_matches('/').rsplit('/').next().map(|value| value.to_string())
}

pub async fn search(client: &Client, query: &str) -> Vec<MarketplaceApp> {
    let url = format!(
        "https://search.f-droid.org/api/search_apps?q={}&lang=en",
        urlencoding::encode(query)
    );

    let response = match client.get(&url).send().await {
        Ok(resp) => resp,
        Err(error) => {
            warn!("F-Droid search failed: {error}");
            return vec![];
        }
    };

    let parsed = match response.json::<FdroidSearchResponse>().await {
        Ok(value) => value,
        Err(error) => {
            warn!("F-Droid parse failed: {error}");
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

            let icon_url = if app.icon.is_empty() {
                None
            } else if app.icon.starts_with("http") {
                Some(app.icon)
            } else {
                Some(format!("https://f-droid.org/repo/{package_name}/en-US/icon.png"))
            };
            let repo_url = if app.url.is_empty() { None } else { Some(app.url) };

            Some(MarketplaceApp {
                name: app.name,
                package_name,
                summary: app.summary,
                icon_url,
                source: "F-Droid".into(),
                available_sources: vec!["F-Droid".into()],
                repo_url,
                installable: false,
                ..Default::default()
            })
        })
        .collect()
}

pub async fn get_detail(client: &Client, package: &str) -> CmdResult<MarketplaceAppDetail> {
    let url = format!("https://f-droid.org/api/v1/packages/{package}");
    let response: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    let version_code = response["suggestedVersionCode"].as_i64().unwrap_or(0);
    let download_url = if version_code > 0 {
        Some(format!("https://f-droid.org/repo/{package}_{version_code}.apk"))
    } else {
        None
    };

    let search_url = format!(
        "https://search.f-droid.org/api/search_apps?q={}&lang=en",
        urlencoding::encode(package)
    );
    let search_meta = match client.get(&search_url).send().await {
        Ok(resp) => resp.json::<FdroidSearchResponse>().await.ok().and_then(|search_results| {
            search_results.apps.into_iter().find(|app| {
                extract_package_from_url(&app.url)
                    .map(|candidate| candidate == package)
                    .unwrap_or(false)
            })
        }),
        Err(_) => None,
    };

    let name =
        search_meta.as_ref().map(|meta| meta.name.clone()).unwrap_or_else(|| package.to_string());
    let description = search_meta.as_ref().map(|meta| meta.summary.clone()).unwrap_or_default();
    let icon_url = search_meta.as_ref().and_then(|meta| {
        if meta.icon.is_empty() {
            None
        } else if meta.icon.starts_with("http") {
            Some(meta.icon.clone())
        } else {
            Some(format!("https://f-droid.org/repo/{package}/en-US/icon.png"))
        }
    });

    let versions = response["packages"]
        .as_array()
        .map(|packages| {
            packages
                .iter()
                .filter_map(|package_entry| {
                    let version_code = package_entry["versionCode"].as_i64()?;
                    Some(VersionInfo {
                        version_name: package_entry["versionName"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        version_code,
                        size: package_entry["size"].as_u64(),
                        download_url: Some(format!(
                            "https://f-droid.org/repo/{package}_{version_code}.apk"
                        )),
                        published_at: package_entry["added"]
                            .as_str()
                            .map(|value| value.to_string()),
                    })
                })
                .take(10)
                .collect()
        })
        .unwrap_or_default();

    let version_name = response["packages"]
        .as_array()
        .and_then(|packages| {
            packages.first().and_then(|package_entry| {
                package_entry["versionName"].as_str().map(|value| value.to_string())
            })
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
        repo_url: Some(format!("https://f-droid.org/en/packages/{package}")),
        sources_available: vec!["F-Droid".into()],
        versions,
        ..Default::default()
    })
}
