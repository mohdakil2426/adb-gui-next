use log::debug;
use reqwest::Client;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

pub async fn check_packages(client: &Client, package_names: &[String]) -> Vec<MarketplaceApp> {
    let mut results = Vec::new();

    for package_name in package_names.iter().take(8) {
        let url = format!("https://apt.izzysoft.de/fdroid/api/v1/packages/{package_name}");

        let response = match client.get(&url).send().await {
            Ok(resp) => resp,
            Err(_) => continue,
        };

        if !response.status().is_success() {
            continue;
        }

        let body: serde_json::Value = match response.json().await {
            Ok(value) => value,
            Err(_) => continue,
        };

        let package = body["packageName"].as_str().unwrap_or(package_name).to_string();
        let version_code_str = body["suggestedVersionCode"]
            .as_str()
            .or_else(|| body["suggestedVersionCode"].as_i64().map(|_| "0").or(Some("0")))
            .unwrap_or("0");
        let version_code: i64 = version_code_str.parse().unwrap_or(0);

        let version = body["packages"]
            .as_array()
            .and_then(|packages| {
                packages.first().and_then(|package_entry| {
                    package_entry["versionName"].as_str().map(|value| value.to_string())
                })
            })
            .unwrap_or_default();

        let download_url = if version_code > 0 {
            Some(format!("https://apt.izzysoft.de/fdroid/repo/{package}_{version_code}.apk"))
        } else {
            None
        };
        let icon_url =
            Some(format!("https://apt.izzysoft.de/fdroid/repo/{package}/en-US/icon.png"));

        results.push(MarketplaceApp {
            name: package.clone(),
            package_name: package.clone(),
            version,
            icon_url,
            source: "IzzyOnDroid".into(),
            available_sources: vec!["IzzyOnDroid".into()],
            download_url: download_url.clone(),
            repo_url: Some(format!("https://apt.izzysoft.de/fdroid/index/apk/{package}")),
            installable: download_url.is_some(),
            ..Default::default()
        });
    }

    debug!(
        "IzzyOnDroid cross-reference: checked {} packages, found {} available",
        package_names.len().min(8),
        results.len()
    );

    results
}

pub async fn search_via_fdroid(
    client: &Client,
    fdroid_results: &[MarketplaceApp],
) -> Vec<MarketplaceApp> {
    if fdroid_results.is_empty() {
        return vec![];
    }

    let package_names: Vec<String> =
        fdroid_results.iter().map(|app| app.package_name.clone()).collect();

    check_packages(client, &package_names).await
}

pub async fn get_detail(client: &Client, package: &str) -> CmdResult<MarketplaceAppDetail> {
    let url = format!("https://apt.izzysoft.de/fdroid/api/v1/packages/{package}");
    let response: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    let version_code_str = response["suggestedVersionCode"].as_str().unwrap_or("0");
    let version_code: i64 = version_code_str.parse().unwrap_or(0);
    let download_url = if version_code > 0 {
        Some(format!("https://apt.izzysoft.de/fdroid/repo/{package}_{version_code}.apk"))
    } else {
        None
    };

    let versions = response["packages"]
        .as_array()
        .map(|packages| {
            packages
                .iter()
                .filter_map(|package_entry| {
                    let version_code_str = package_entry["versionCode"].as_str().unwrap_or("0");
                    let version_code: i64 = version_code_str.parse().ok()?;
                    Some(VersionInfo {
                        version_name: package_entry["versionName"]
                            .as_str()
                            .unwrap_or("")
                            .to_string(),
                        version_code,
                        size: package_entry["size"].as_u64(),
                        download_url: Some(format!(
                            "https://apt.izzysoft.de/fdroid/repo/{package}_{version_code}.apk"
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

    Ok(MarketplaceAppDetail {
        name: response["name"].as_str().unwrap_or(package).to_string(),
        package_name: package.to_string(),
        version: response["packages"]
            .as_array()
            .and_then(|packages| {
                packages.first().and_then(|package_entry| {
                    package_entry["versionName"].as_str().map(|value| value.to_string())
                })
            })
            .unwrap_or_default(),
        description: response["description"]
            .as_str()
            .or_else(|| response["summary"].as_str())
            .unwrap_or("")
            .to_string(),
        icon_url: Some(format!("https://apt.izzysoft.de/fdroid/repo/{package}/en-US/icon.png")),
        source: "IzzyOnDroid".into(),
        download_url,
        repo_url: Some(format!("https://apt.izzysoft.de/fdroid/index/apk/{package}")),
        license: response["license"].as_str().map(|value| value.to_string()),
        author: response["authorName"].as_str().map(|value| value.to_string()),
        sources_available: vec!["IzzyOnDroid".into()],
        versions,
        ..Default::default()
    })
}
