use log::warn;
use reqwest::Client;

use super::types::{MarketplaceApp, MarketplaceAppDetail};
use crate::CmdResult;

/// Search Aptoide via the public ws75 consumer API.
///
/// API: `GET https://ws75.aptoide.com/api/7/apps/search?query={q}&limit={n}&language=en`
/// Filters: only TRUSTED malware rank, skips apps with OBB (split APKs / modules).
pub async fn search(client: &Client, query: &str, limit: u32) -> Vec<MarketplaceApp> {
    let url = format!(
        "https://ws75.aptoide.com/api/7/apps/search?query={}&limit={}&language=en",
        urlencoding::encode(query),
        limit
    );

    let response = match client.get(&url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            warn!("Aptoide search failed: {e}");
            return vec![];
        }
    };

    let body: serde_json::Value = match response.json().await {
        Ok(v) => v,
        Err(e) => {
            warn!("Aptoide parse failed: {e}");
            return vec![];
        }
    };

    // Check API status
    if body["info"]["status"].as_str() != Some("OK") {
        warn!("Aptoide API returned non-OK status");
        return vec![];
    }

    let empty = vec![];
    let list = body["datalist"]["list"].as_array().unwrap_or(&empty);

    list.iter()
        .filter_map(|app| {
            let package = app["package"].as_str()?.to_string();
            let name = app["name"].as_str().unwrap_or(&package).to_string();

            // APK-only filter: skip apps with OBB (split APK / modules)
            if !app["obb"].is_null() {
                return None;
            }

            // Malware filter: only TRUSTED apps by default
            let malware_rank = app["file"]["malware"]["rank"].as_str().unwrap_or("UNKNOWN");
            if malware_rank != "TRUSTED" {
                return None;
            }

            let icon_url = app["icon"].as_str().map(|s| s.to_string());
            let version = app["file"]["vername"].as_str().unwrap_or("").to_string();
            let download_url = app["file"]["path"].as_str().map(|s| s.to_string());
            let size = app["size"].as_u64().or_else(|| app["file"]["filesize"].as_u64());
            let downloads = app["stats"]["downloads"].as_u64();
            let rating = app["stats"]["prating"]["avg"].as_f64();

            Some(MarketplaceApp {
                name,
                package_name: package,
                version,
                summary: String::new(), // summary requires getMeta call
                icon_url,
                source: "Aptoide".into(),
                download_url,
                size,
                rating,
                downloads_count: downloads,
                malware_status: Some(malware_rank.to_string()),
                ..Default::default()
            })
        })
        .collect()
}

/// Get detailed metadata for a single Aptoide app via getMeta.
///
/// API: `GET https://ws75.aptoide.com/api/7/app/getMeta?package_name={pkg}`
pub async fn get_detail(client: &Client, package: &str) -> CmdResult<MarketplaceAppDetail> {
    let url = format!(
        "https://ws75.aptoide.com/api/7/app/getMeta?package_name={}",
        urlencoding::encode(package)
    );

    let body: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Aptoide detail request failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Aptoide detail parse failed: {e}"))?;

    if body["info"]["status"].as_str() != Some("OK") {
        return Err(format!(
            "Aptoide API error for {package}: {}",
            body["info"]["status"].as_str().unwrap_or("unknown status")
        ));
    }

    let data = &body["nodes"]["meta"]["data"];
    let file = &data["file"];

    let download_url =
        file["path"].as_str().or_else(|| file["path"]["url"].as_str()).map(|s| s.to_string());

    // Extract screenshots
    let screenshots: Vec<String> = data["media"]["screenshots"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|s| s["url"].as_str().map(|u| u.to_string())).collect())
        .unwrap_or_default();

    let description = data["media"]["description"].as_str().unwrap_or("").to_string();

    Ok(MarketplaceAppDetail {
        name: data["name"].as_str().unwrap_or(package).to_string(),
        package_name: package.to_string(),
        version: file["vername"].as_str().unwrap_or("").to_string(),
        description,
        icon_url: data["icon"].as_str().map(|s| s.to_string()),
        source: "Aptoide".into(),
        download_url,
        size: file["filesize"].as_u64().or_else(|| data["size"].as_u64()),
        author: data["developer"]["name"].as_str().map(|s| s.to_string()),
        sources_available: vec!["Aptoide".into()],
        screenshots,
        rating: data["stats"]["prating"]["avg"].as_f64(),
        downloads_count: data["stats"]["downloads"].as_u64(),
        ..Default::default()
    })
}
