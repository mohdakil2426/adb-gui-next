use log::debug;
use reqwest::Client;

use super::types::{MarketplaceApp, MarketplaceAppDetail, VersionInfo};
use crate::CmdResult;

/// Check if a list of packages are available on IzzyOnDroid.
///
/// IzzyOnDroid has NO search API — the `?search=` parameter returns HTTP 400.
/// Instead we cross-reference: given package names (usually from F-Droid search),
/// check each against the IzzyOnDroid packages endpoint.
pub async fn check_packages(client: &Client, package_names: &[String]) -> Vec<MarketplaceApp> {
    let mut results = Vec::new();

    for package_name in package_names.iter().take(8) {
        // Limit concurrent checks
        let url = format!("https://apt.izzysoft.de/fdroid/api/v1/packages/{package_name}");

        let resp = match client.get(&url).send().await {
            Ok(r) => r,
            Err(_) => continue,
        };

        if !resp.status().is_success() {
            continue;
        }

        let body: serde_json::Value = match resp.json().await {
            Ok(v) => v,
            Err(_) => continue,
        };

        // IzzyOnDroid returns versionCode as STRING, not integer
        let package = body["packageName"].as_str().unwrap_or(package_name).to_string();
        let version_code_str = body["suggestedVersionCode"]
            .as_str()
            .or_else(|| body["suggestedVersionCode"].as_i64().map(|_| "0").or(Some("0")))
            .unwrap_or("0");
        let version_code: i64 = version_code_str.parse().unwrap_or(0);

        let version = body["packages"]
            .as_array()
            .and_then(|pkgs| {
                pkgs.first().and_then(|p| p["versionName"].as_str().map(|s| s.to_string()))
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
            name: package.clone(), // We don't have the display name from this API
            package_name: package,
            version,
            icon_url,
            source: "IzzyOnDroid".into(),
            download_url,
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

/// Search IzzyOnDroid by cross-referencing common Android apps.
///
/// Since IzzyOnDroid has no search endpoint, we search F-Droid first
/// and then check which results are also available on IzzyOnDroid.
/// This is called from the marketplace command after F-Droid search completes.
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

    // IzzyOnDroid returns versionCode as STRING
    let version_code_str = resp["suggestedVersionCode"].as_str().unwrap_or("0");
    let version_code: i64 = version_code_str.parse().unwrap_or(0);

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
                    // versionCode is STRING in IzzyOnDroid
                    let vc_str = p["versionCode"].as_str().unwrap_or("0");
                    let vc: i64 = vc_str.parse().ok()?;
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

    // Try to enrich name from the F-Droid search if we only have the package name
    let name = resp["name"].as_str().unwrap_or(package).to_string();

    Ok(MarketplaceAppDetail {
        name,
        package_name: package.to_string(),
        version: resp["packages"]
            .as_array()
            .and_then(|pkgs| {
                pkgs.first().and_then(|p| p["versionName"].as_str().map(|s| s.to_string()))
            })
            .unwrap_or_default(),
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
