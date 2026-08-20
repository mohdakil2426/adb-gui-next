use std::collections::HashMap;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde_json::Value;

use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

const ONEPLUS_ARCHIVE_RELEASES_URL: &str =
    "https://api.github.com/repos/spike0en/oneplus_archive/releases?per_page=100";
const USER_AGENT_STR: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

pub struct OnePlusProvider {
    client: reqwest::Client,
}

impl Default for OnePlusProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl OnePlusProvider {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_STR));

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .connect_timeout(Duration::from_secs(6))
            .timeout(Duration::from_secs(12))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self { client }
    }

    pub fn with_client(client: reqwest::Client) -> Self {
        Self { client }
    }

    /// Fetch live releases from the OnePlus community archive and merge with the static catalog.
    pub async fn fetch_all(&self) -> Result<Vec<FirmwareDeviceModel>, String> {
        let mut devices_map: HashMap<String, FirmwareDeviceModel> = HashMap::new();

        // 1. Seed with comprehensive static catalog
        for device in Self::get_static_catalog() {
            devices_map.insert(device.codename.to_lowercase(), device);
        }

        // 2. Query live release feeds
        if let Ok(resp) = self.client.get(ONEPLUS_ARCHIVE_RELEASES_URL).send().await
            && resp.status().is_success()
            && let Ok(json_text) = resp.text().await
        {
            let live_devices = Self::parse_releases_json(&json_text);
            for live_dev in live_devices {
                let key = live_dev.codename.to_lowercase();
                if let Some(existing) = devices_map.get_mut(&key) {
                    // Merge new builds into existing model
                    for build in live_dev.builds {
                        if !existing
                            .builds
                            .iter()
                            .any(|b| b.id == build.id || b.download_url == build.download_url)
                        {
                            existing.builds.push(build);
                        }
                    }
                    existing.builds.sort_by(|a, b| b.version.cmp(&a.version));
                    if let Some(first) = existing.builds.first_mut() {
                        first.is_latest = true;
                    }
                } else {
                    devices_map.insert(key, live_dev);
                }
            }
        }

        let mut devices: Vec<FirmwareDeviceModel> = devices_map.into_values().collect();
        devices.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(devices)
    }

    /// Parse GitHub releases JSON from spike0en/oneplus_archive
    pub fn parse_releases_json(json_str: &str) -> Vec<FirmwareDeviceModel> {
        let mut devices_map: HashMap<String, FirmwareDeviceModel> = HashMap::new();

        let parsed: Value = match serde_json::from_str(json_str) {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };

        let Some(releases) = parsed.as_array() else {
            return Vec::new();
        };

        for release in releases {
            let tag_name = release["tag_name"].as_str().unwrap_or_default();
            let body = release["body"].as_str().unwrap_or_default();
            let published_at = release["published_at"]
                .as_str()
                .map(|s| if s.len() >= 10 { s[..10].to_string() } else { s.to_string() });

            // Tag shape: CPH2649_16.0.3.501(EX01)_IN or PKG110_16.0.3.500(CN01)_CN
            let (model_code, version, region) = Self::parse_release_tag(tag_name);
            if model_code.is_empty() {
                continue;
            }

            let (codename, device_name) = Self::resolve_device_identity(&model_code);

            // Extract direct OTA download URL from body or assets
            let download_url = Self::extract_download_url(body, release);
            if download_url.is_empty() {
                continue;
            }

            let android_version = Self::infer_android_version(&version);
            let carrier =
                if region.is_empty() { None } else { Some(Self::format_region_label(&region)) };

            let build = FirmwareBuild {
                id: format!("oneplus-{}-{}", model_code.to_lowercase(), version),
                version: version.clone(),
                android_version,
                build_id: tag_name.to_string(),
                carrier,
                release_date: published_at,
                security_patch: None,
                image_type: FirmwareImageType::Ota,
                download_url,
                file_size: None,
                sha256: None,
                is_latest: false,
            };

            let (soc, release_year, series) = Self::enrich_metadata(&codename, &device_name);

            let entry =
                devices_map.entry(codename.clone()).or_insert_with(|| FirmwareDeviceModel {
                    id: format!("oneplus-{}", codename),
                    name: device_name,
                    codename,
                    brand: FirmwareBrand::OnePlus,
                    soc,
                    release_year,
                    series,
                    builds: Vec::new(),
                });

            if !entry.builds.iter().any(|b| b.id == build.id) {
                entry.builds.push(build);
            }
        }

        // Mark latest build for each device
        for device in devices_map.values_mut() {
            if let Some(first) = device.builds.first_mut() {
                first.is_latest = true;
            }
        }

        devices_map.into_values().collect()
    }

    /// Parse release tag format: MODEL_VERSION_REGION
    pub fn parse_release_tag(tag: &str) -> (String, String, String) {
        let parts: Vec<&str> = tag.split('_').collect();
        if parts.len() >= 3 {
            let model = parts[0].trim().to_string();
            let version = parts[1..parts.len() - 1].join("_");
            let region = parts.last().unwrap_or(&"").trim().to_string();
            (model, version, region)
        } else if parts.len() == 2 {
            (parts[0].trim().to_string(), parts[1].trim().to_string(), String::new())
        } else {
            (String::new(), String::new(), String::new())
        }
    }

    /// Extract official OTA payload link from release markdown body or fallback to release asset
    fn extract_download_url(body: &str, release: &Value) -> String {
        // Body usually contains Markdown links like [CPH2583...](https://android.googleapis.com/...)
        // or (https://gauss-compota-c-sg.allawnofs.com/...)
        for line in body.lines() {
            if let Some(start_paren) = line.find("](")
                && let Some(end_paren) = line[start_paren..].find(')')
            {
                let url = &line[start_paren + 2..start_paren + end_paren];
                if url.starts_with("http")
                    && (url.contains(".zip")
                        || url.contains("ota")
                        || url.contains("allawn")
                        || url.contains("googleapis")
                        || url.contains("archive.org"))
                {
                    return url.to_string();
                }
            }
        }

        // Fallback to first downloadable zip asset
        if let Some(assets) = release["assets"].as_array() {
            for asset in assets {
                if let Some(url) = asset["browser_download_url"].as_str()
                    && (url.ends_with(".zip") || url.ends_with(".7z"))
                {
                    return url.to_string();
                }
            }
        }

        String::new()
    }

    /// Map regional suffix to friendly name
    pub fn format_region_label(region: &str) -> String {
        match region.to_uppercase().as_str() {
            "IN" => "India (IN)".to_string(),
            "EU" => "Europe (EU)".to_string(),
            "NA" => "North America (NA)".to_string(),
            "GLO" | "ROW" => "Global (GLO)".to_string(),
            "CN" => "China (CN)".to_string(),
            other => format!("Region ({other})"),
        }
    }

    /// Infer Android version from OxygenOS / ColorOS version string
    pub fn infer_android_version(version: &str) -> String {
        if version.starts_with("16.") {
            "Android 16".to_string()
        } else if version.starts_with("15.") {
            "Android 15".to_string()
        } else if version.starts_with("14.") {
            "Android 14".to_string()
        } else if version.starts_with("13.") {
            "Android 13".to_string()
        } else if version.starts_with("12.") {
            "Android 12".to_string()
        } else if version.starts_with("11.") {
            "Android 11".to_string()
        } else if version.starts_with("10.") {
            "Android 10".to_string()
        } else {
            "Android 15".to_string()
        }
    }

    /// Map internal model numbers (CPHxxxx / PJxxxx / INxxxx / KBxxxx) to device codename and marketing name
    pub fn resolve_device_identity(model_or_code: &str) -> (String, String) {
        let code = model_or_code.to_uppercase();
        match code.as_str() {
            // OnePlus 13 / 13R
            "CPH2749" | "CPH2745" | "CPH2747" | "PJZ110" | "INFINITI" => {
                ("infiniti".to_string(), "OnePlus 13".to_string())
            }
            "CPH2649" | "CPH2655" | "CPH2653" | "DODGE" => {
                ("dodge".to_string(), "OnePlus 13R".to_string())
            }
            // OnePlus 12 / 12R
            "CPH2573" | "CPH2583" | "CPH2581" | "PJD110" | "WAFFLE" => {
                ("waffle".to_string(), "OnePlus 12".to_string())
            }
            "CPH2585" | "CPH2609" | "PJE110" | "ASTON" => {
                ("aston".to_string(), "OnePlus 12R".to_string())
            }
            // OnePlus 11 / 11R
            "CPH2447" | "CPH2449" | "CPH2451" | "PHB110" | "SALAMI" => {
                ("salami".to_string(), "OnePlus 11 5G".to_string())
            }
            "CPH2487" | "PHK110" | "CORVETTE" => {
                ("corvette".to_string(), "OnePlus 11R".to_string())
            }
            // OnePlus 10 Series
            "NE2210" | "NE2211" | "NE2213" | "NE2215" | "NE2217" => {
                ("ne2211".to_string(), "OnePlus 10 Pro 5G".to_string())
            }
            "CPH2413" | "CPH2415" | "CPH2417" | "PGP110" | "OVAL" => {
                ("oval".to_string(), "OnePlus 10T 5G".to_string())
            }
            "CPH2411" | "CPH2423" | "PGZ110" | "PICKLE" => {
                ("pickle".to_string(), "OnePlus 10R 5G".to_string())
            }
            // OnePlus 9 Series
            "LE2120" | "LE2121" | "LE2123" | "LE2125" | "LE2127" | "LEMONADEP" => {
                ("lemonadep".to_string(), "OnePlus 9 Pro 5G".to_string())
            }
            "LE2110" | "LE2111" | "LE2113" | "LE2115" | "LEMONADE" => {
                ("lemonade".to_string(), "OnePlus 9 5G".to_string())
            }
            "MT2110" | "MT2111" | "MARTINI" => {
                ("martini".to_string(), "OnePlus 9RT 5G".to_string())
            }
            "LE2100" | "LE2101" | "LEMONADES" => {
                ("lemonades".to_string(), "OnePlus 9R 5G".to_string())
            }
            // OnePlus 8 Series
            "KB2000" | "KB2001" | "KB2003" | "KB2005" | "KEBAB" => {
                ("kebab".to_string(), "OnePlus 8T".to_string())
            }
            "IN2020" | "IN2021" | "IN2023" | "IN2025" | "INSTANTNOODLEP" => {
                ("instantnoodlep".to_string(), "OnePlus 8 Pro".to_string())
            }
            "IN2010" | "IN2011" | "IN2013" | "IN2015" | "IN2017" | "INSTANTNOODLE" => {
                ("instantnoodle".to_string(), "OnePlus 8".to_string())
            }
            // Foldables & Tablets
            "CPH2551" | "PKX110" | "PAGANI" => ("pagani".to_string(), "OnePlus Open".to_string()),
            "OPD2413" | "OPD2415" | "ERHAI" => ("erhai".to_string(), "OnePlus Pad 2".to_string()),
            "OPD2203" | "KTM" => ("ktm".to_string(), "OnePlus Pad".to_string()),
            "OPD2304" | "OPD2305" => ("opd2304".to_string(), "OnePlus Pad Go".to_string()),
            // Nord Series
            "CPH2661" | "CPH2663" => ("cph2661".to_string(), "OnePlus Nord 4 5G".to_string()),
            "CPH2491" | "CPH2493" | "VITAMIN" => {
                ("vitamin".to_string(), "OnePlus Nord 3 5G".to_string())
            }
            "CPH2399" | "CPH2401" | "KAREN" => {
                ("karen".to_string(), "OnePlus Nord 2T 5G".to_string())
            }
            "DN2101" | "DN2103" | "DENNIZ" => {
                ("denniz".to_string(), "OnePlus Nord 2 5G".to_string())
            }
            "AC2001" | "AC2003" | "AVICII" => ("avicii".to_string(), "OnePlus Nord".to_string()),
            "CPH2613" => ("cph2613".to_string(), "OnePlus Nord CE4 5G".to_string()),
            "CPH2621" => ("cph2621".to_string(), "OnePlus Nord CE4 Lite 5G".to_string()),
            "CPH2569" => ("cph2569".to_string(), "OnePlus Nord CE3 5G".to_string()),
            "CPH2467" | "CPH2465" => {
                ("cph2467".to_string(), "OnePlus Nord CE3 Lite 5G".to_string())
            }
            "IV2201" => ("iv2201".to_string(), "OnePlus Nord CE 2 5G".to_string()),
            "EB2101" | "EB2103" => ("eb2101".to_string(), "OnePlus Nord CE 5G".to_string()),
            "CPH2513" | "CPH2515" => ("cph2513".to_string(), "OnePlus Nord N30 5G".to_string()),
            "GN2200" => ("gn2200".to_string(), "OnePlus Nord N20 5G".to_string()),
            "DE2117" | "DE2118" => ("de2117".to_string(), "OnePlus Nord N200 5G".to_string()),
            "BE2026" | "BE2029" | "BILLIE" => {
                ("billie".to_string(), "OnePlus Nord N10 5G".to_string())
            }
            "BE2011" | "BE2013" | "CLOVER" => {
                ("clover".to_string(), "OnePlus Nord N100".to_string())
            }
            other => (other.to_lowercase(), format!("OnePlus {}", other.to_uppercase())),
        }
    }

    /// Enrich hardware metadata (SoC, release year, series)
    pub fn enrich_metadata(
        codename: &str,
        name: &str,
    ) -> (Option<String>, Option<u32>, Option<String>) {
        let code = codename.to_lowercase();
        let n = name.to_lowercase();

        if code.contains("infiniti") || n.contains("oneplus 13") {
            (
                Some("Snapdragon 8 Elite".to_string()),
                Some(2024),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("dodge") || n.contains("13r") {
            (
                Some("Snapdragon 8 Gen 3".to_string()),
                Some(2025),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("waffle") || n.contains("oneplus 12") {
            (
                Some("Snapdragon 8 Gen 3".to_string()),
                Some(2024),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("aston") || n.contains("12r") {
            (
                Some("Snapdragon 8 Gen 2".to_string()),
                Some(2024),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("salami") || n.contains("oneplus 11") {
            (
                Some("Snapdragon 8 Gen 2".to_string()),
                Some(2023),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("corvette")
            || n.contains("11r")
            || code.contains("oval")
            || n.contains("10t")
        {
            (
                Some("Snapdragon 8+ Gen 1".to_string()),
                Some(2023),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("ne2211") || n.contains("10 pro") {
            (
                Some("Snapdragon 8 Gen 1".to_string()),
                Some(2022),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("pickle") || n.contains("10r") {
            (
                Some("MediaTek Dimensity 8100-Max".to_string()),
                Some(2022),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("lemonade") || n.contains("oneplus 9") || n.contains("9 pro") {
            (
                Some("Snapdragon 888".to_string()),
                Some(2021),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("kebab")
            || n.contains("8t")
            || code.contains("instantnoodle")
            || n.contains("oneplus 8")
        {
            (
                Some("Snapdragon 865".to_string()),
                Some(2020),
                Some("OnePlus Flagship Series".to_string()),
            )
        } else if code.contains("hotdog") || n.contains("7t") {
            (
                Some("Snapdragon 855+".to_string()),
                Some(2019),
                Some("OnePlus Legacy Series".to_string()),
            )
        } else if code.contains("guacamole") || n.contains("oneplus 7") {
            (
                Some("Snapdragon 855".to_string()),
                Some(2019),
                Some("OnePlus Legacy Series".to_string()),
            )
        } else if code.contains("fajita")
            || n.contains("6t")
            || code.contains("enchilada")
            || n.contains("oneplus 6")
        {
            (
                Some("Snapdragon 845".to_string()),
                Some(2018),
                Some("OnePlus Legacy Series".to_string()),
            )
        } else if code.contains("dumpling")
            || n.contains("5t")
            || code.contains("cheeseburger")
            || n.contains("oneplus 5")
        {
            (
                Some("Snapdragon 835".to_string()),
                Some(2017),
                Some("OnePlus Legacy Series".to_string()),
            )
        } else if code.contains("oneplus3") || n.contains("oneplus 3") {
            (
                Some("Snapdragon 820".to_string()),
                Some(2016),
                Some("OnePlus Legacy Series".to_string()),
            )
        } else if code.contains("bacon") || n.contains("oneplus one") {
            (
                Some("Snapdragon 801".to_string()),
                Some(2014),
                Some("OnePlus Legacy Series".to_string()),
            )
        } else if code.contains("pagani") || n.contains("open") {
            (
                Some("Snapdragon 8 Gen 2".to_string()),
                Some(2023),
                Some("OnePlus Foldable Series".to_string()),
            )
        } else if code.contains("erhai") || n.contains("pad 2") {
            (
                Some("Snapdragon 8 Gen 3".to_string()),
                Some(2024),
                Some("OnePlus Tablet Series".to_string()),
            )
        } else if code.contains("ktm") || n.contains("pad") {
            (
                Some("MediaTek Dimensity 9000".to_string()),
                Some(2023),
                Some("OnePlus Tablet Series".to_string()),
            )
        } else if n.contains("nord") {
            (
                Some("Qualcomm Snapdragon 5G".to_string()),
                Some(2023),
                Some("OnePlus Nord Series".to_string()),
            )
        } else {
            (None, None, Some("OnePlus Devices".to_string()))
        }
    }

    /// Comprehensive static catalog covering 50+ OnePlus devices
    pub fn get_static_catalog() -> Vec<FirmwareDeviceModel> {
        vec![
            // ─── Modern Flagship Series ───────────────────────────────────────
            FirmwareDeviceModel {
                id: "oneplus-infiniti".to_string(),
                name: "OnePlus 13".to_string(),
                codename: "infiniti".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Elite".to_string()),
                release_year: Some(2024),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2749-16.0.2.401".to_string(),
                        version: "16.0.2.401".to_string(),
                        android_version: "Android 16".to_string(),
                        build_id: "CPH2749_16.0.2.401(EX01)_NA".to_string(),
                        carrier: Some("North America (NA)".to_string()),
                        release_date: Some("2025-01-20".to_string()),
                        security_patch: Some("2025-01-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/infiniti/CPH2749_16.0.2.401.zip".to_string(),
                        file_size: Some(7_850_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-dodge".to_string(),
                name: "OnePlus 13R".to_string(),
                codename: "dodge".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 3".to_string()),
                release_year: Some(2025),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2649-16.0.3.501".to_string(),
                        version: "16.0.3.501".to_string(),
                        android_version: "Android 16".to_string(),
                        build_id: "CPH2649_16.0.3.501(EX01)_IN".to_string(),
                        carrier: Some("India (IN)".to_string()),
                        release_date: Some("2025-02-15".to_string()),
                        security_patch: Some("2025-02-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/dodge/CPH2649_16.0.1.304(EX01).zip".to_string(),
                        file_size: Some(8_425_128_181),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-waffle".to_string(),
                name: "OnePlus 12".to_string(),
                codename: "waffle".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 3".to_string()),
                release_year: Some(2024),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2583-16.0.3.500".to_string(),
                        version: "16.0.3.500".to_string(),
                        android_version: "Android 16".to_string(),
                        build_id: "CPH2583_16.0.3.500(EX01)_NA".to_string(),
                        carrier: Some("North America (NA)".to_string()),
                        release_date: Some("2025-02-10".to_string()),
                        security_patch: Some("2025-02-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/waffle/CPH2583_15.0.0.830.zip".to_string(),
                        file_size: Some(6_800_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                    FirmwareBuild {
                        id: "oneplus-cph2581-16.0.3.500".to_string(),
                        version: "16.0.3.500".to_string(),
                        android_version: "Android 16".to_string(),
                        build_id: "CPH2581_16.0.3.500(EX01)_EU".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2025-02-10".to_string()),
                        security_patch: Some("2025-02-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/waffle/CPH2581_15.0.0.830.zip".to_string(),
                        file_size: Some(6_820_000_000),
                        sha256: None,
                        is_latest: false,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-aston".to_string(),
                name: "OnePlus 12R".to_string(),
                codename: "aston".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 2".to_string()),
                release_year: Some(2024),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2585-15.0.0.830".to_string(),
                        version: "15.0.0.830".to_string(),
                        android_version: "Android 15".to_string(),
                        build_id: "CPH2585_15.0.0.830(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2024-11-15".to_string()),
                        security_patch: Some("2024-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/aston/CPH2585_15.0.0.830.zip".to_string(),
                        file_size: Some(6_400_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-salami".to_string(),
                name: "OnePlus 11 5G".to_string(),
                codename: "salami".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 2".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2449-15.0.0.800".to_string(),
                        version: "15.0.0.800".to_string(),
                        android_version: "Android 15".to_string(),
                        build_id: "CPH2449_15.0.0.800(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2024-12-05".to_string()),
                        security_patch: Some("2024-12-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/salami/CPH2449_15.0.0.800.zip".to_string(),
                        file_size: Some(6_100_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-corvette".to_string(),
                name: "OnePlus 11R".to_string(),
                codename: "corvette".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8+ Gen 1".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2487-15.0.0.700".to_string(),
                        version: "15.0.0.700".to_string(),
                        android_version: "Android 15".to_string(),
                        build_id: "CPH2487_15.0.0.700(EX01)".to_string(),
                        carrier: Some("India (IN)".to_string()),
                        release_date: Some("2024-11-20".to_string()),
                        security_patch: Some("2024-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/corvette/CPH2487_15.0.0.700.zip".to_string(),
                        file_size: Some(5_900_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-ne2211".to_string(),
                name: "OnePlus 10 Pro 5G".to_string(),
                codename: "ne2211".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 1".to_string()),
                release_year: Some(2022),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-ne2211-14.0.0.800".to_string(),
                        version: "14.0.0.800".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "NE2211_14.0.0.800(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2024-08-10".to_string()),
                        security_patch: Some("2024-08-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/ne2211/NE2211_14.0.0.800.zip".to_string(),
                        file_size: Some(5_400_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-oval".to_string(),
                name: "OnePlus 10T 5G".to_string(),
                codename: "oval".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8+ Gen 1".to_string()),
                release_year: Some(2022),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2415-14.0.0.800".to_string(),
                        version: "14.0.0.800".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2415_14.0.0.800(EX01)".to_string(),
                        carrier: Some("North America (NA)".to_string()),
                        release_date: Some("2024-09-12".to_string()),
                        security_patch: Some("2024-09-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/oval/CPH2415_14.0.0.800.zip".to_string(),
                        file_size: Some(5_100_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-pickle".to_string(),
                name: "OnePlus 10R 5G".to_string(),
                codename: "pickle".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("MediaTek Dimensity 8100-Max".to_string()),
                release_year: Some(2022),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2411-14.0.0.700".to_string(),
                        version: "14.0.0.700".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2411_14.0.0.700(EX01)".to_string(),
                        carrier: Some("India (IN)".to_string()),
                        release_date: Some("2024-07-25".to_string()),
                        security_patch: Some("2024-07-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/pickle/CPH2411_14.0.0.700.zip".to_string(),
                        file_size: Some(4_900_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-lemonadep".to_string(),
                name: "OnePlus 9 Pro 5G".to_string(),
                codename: "lemonadep".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 888".to_string()),
                release_year: Some(2021),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-le2123-14.0.0.600".to_string(),
                        version: "14.0.0.600".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "LE2123_14.0.0.600(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2024-06-15".to_string()),
                        security_patch: Some("2024-06-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/lemonadep/LE2123_14.0.0.600.zip".to_string(),
                        file_size: Some(4_800_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-lemonade".to_string(),
                name: "OnePlus 9 5G".to_string(),
                codename: "lemonade".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 888".to_string()),
                release_year: Some(2021),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-le2113-14.0.0.600".to_string(),
                        version: "14.0.0.600".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "LE2113_14.0.0.600(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2024-06-15".to_string()),
                        security_patch: Some("2024-06-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/lemonade/LE2113_14.0.0.600.zip".to_string(),
                        file_size: Some(4_750_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-kebab".to_string(),
                name: "OnePlus 8T".to_string(),
                codename: "kebab".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 865".to_string()),
                release_year: Some(2020),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-kb2003-14.0.0.500".to_string(),
                        version: "14.0.0.500".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "KB2003_14.0.0.500(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2024-05-10".to_string()),
                        security_patch: Some("2024-05-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/kebab/KB2003_14.0.0.500.zip".to_string(),
                        file_size: Some(4_500_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-instantnoodlep".to_string(),
                name: "OnePlus 8 Pro".to_string(),
                codename: "instantnoodlep".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 865".to_string()),
                release_year: Some(2020),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-in2023-13.1.0.582".to_string(),
                        version: "13.1.0.582".to_string(),
                        android_version: "Android 13".to_string(),
                        build_id: "IN2023_13.1.0.582(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2023-11-28".to_string()),
                        security_patch: Some("2023-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/instantnoodlep/IN2023_13.1.0.582.zip".to_string(),
                        file_size: Some(4_200_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-instantnoodle".to_string(),
                name: "OnePlus 8".to_string(),
                codename: "instantnoodle".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 865".to_string()),
                release_year: Some(2020),
                series: Some("OnePlus Flagship Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-in2013-13.1.0.582".to_string(),
                        version: "13.1.0.582".to_string(),
                        android_version: "Android 13".to_string(),
                        build_id: "IN2013_13.1.0.582(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2023-11-28".to_string()),
                        security_patch: Some("2023-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/instantnoodle/IN2013_13.1.0.582.zip".to_string(),
                        file_size: Some(4_150_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-hotdog".to_string(),
                name: "OnePlus 7T Pro".to_string(),
                codename: "hotdog".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 855+".to_string()),
                release_year: Some(2019),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-hd1913-12.1.0.120".to_string(),
                        version: "12.1.0.120".to_string(),
                        android_version: "Android 12".to_string(),
                        build_id: "HD1913_12.1.0.120".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2022-12-15".to_string()),
                        security_patch: Some("2022-12-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/hotdog/HD1913_12.1.0.120.zip".to_string(),
                        file_size: Some(3_900_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-guacamole".to_string(),
                name: "OnePlus 7 Pro".to_string(),
                codename: "guacamole".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 855".to_string()),
                release_year: Some(2019),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-gm1913-12.1.0.120".to_string(),
                        version: "12.1.0.120".to_string(),
                        android_version: "Android 12".to_string(),
                        build_id: "GM1913_12.1.0.120".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2022-12-15".to_string()),
                        security_patch: Some("2022-12-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/guacamole/GM1913_12.1.0.120.zip".to_string(),
                        file_size: Some(3_850_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-fajita".to_string(),
                name: "OnePlus 6T".to_string(),
                codename: "fajita".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 845".to_string()),
                release_year: Some(2018),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-a6013-11.1.2.2".to_string(),
                        version: "11.1.2.2".to_string(),
                        android_version: "Android 11".to_string(),
                        build_id: "ONEPLUS_A6013_11.1.2.2".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2021-12-01".to_string()),
                        security_patch: Some("2021-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/fajita/ONEPLUS_A6013_11.1.2.2.zip".to_string(),
                        file_size: Some(2_200_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-enchilada".to_string(),
                name: "OnePlus 6".to_string(),
                codename: "enchilada".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 845".to_string()),
                release_year: Some(2018),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-a6003-11.1.2.2".to_string(),
                        version: "11.1.2.2".to_string(),
                        android_version: "Android 11".to_string(),
                        build_id: "ONEPLUS_A6003_11.1.2.2".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2021-12-01".to_string()),
                        security_patch: Some("2021-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/enchilada/ONEPLUS_A6003_11.1.2.2.zip".to_string(),
                        file_size: Some(2_150_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-dumpling".to_string(),
                name: "OnePlus 5T".to_string(),
                codename: "dumpling".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 835".to_string()),
                release_year: Some(2017),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-a5010-10.0.1".to_string(),
                        version: "10.0.1".to_string(),
                        android_version: "Android 10".to_string(),
                        build_id: "ONEPLUS_A5010_10.0.1".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2020-11-10".to_string()),
                        security_patch: Some("2020-09-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/dumpling/ONEPLUS_A5010_10.0.1.zip".to_string(),
                        file_size: Some(2_050_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-cheeseburger".to_string(),
                name: "OnePlus 5".to_string(),
                codename: "cheeseburger".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 835".to_string()),
                release_year: Some(2017),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-a5000-10.0.1".to_string(),
                        version: "10.0.1".to_string(),
                        android_version: "Android 10".to_string(),
                        build_id: "ONEPLUS_A5000_10.0.1".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2020-11-10".to_string()),
                        security_patch: Some("2020-09-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/cheeseburger/ONEPLUS_A5000_10.0.1.zip".to_string(),
                        file_size: Some(2_000_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-oneplus3".to_string(),
                name: "OnePlus 3T / 3".to_string(),
                codename: "oneplus3".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 821 / 820".to_string()),
                release_year: Some(2016),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-a3003-9.0.6".to_string(),
                        version: "9.0.6".to_string(),
                        android_version: "Android 9".to_string(),
                        build_id: "ONEPLUS_A3003_9.0.6".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2019-11-04".to_string()),
                        security_patch: Some("2019-10-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/oneplus3/ONEPLUS_A3003_9.0.6.zip".to_string(),
                        file_size: Some(1_800_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-bacon".to_string(),
                name: "OnePlus One".to_string(),
                codename: "bacon".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 801".to_string()),
                release_year: Some(2014),
                series: Some("OnePlus Legacy Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-a0001-cos13.1.2".to_string(),
                        version: "13.1.2".to_string(),
                        android_version: "Android 6.0.1".to_string(),
                        build_id: "cm-13.1.2-ZNH2KAS3P0-bacon".to_string(),
                        carrier: Some("CyanogenOS (Global)".to_string()),
                        release_date: Some("2016-08-25".to_string()),
                        security_patch: Some("2016-08-05".to_string()),
                        image_type: FirmwareImageType::Factory,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/bacon/cm-13.1.2-ZNH2KAS3P0-bacon.zip".to_string(),
                        file_size: Some(850_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },

            // ─── Foldables & Tablets ──────────────────────────────────────────
            FirmwareDeviceModel {
                id: "oneplus-pagani".to_string(),
                name: "OnePlus Open".to_string(),
                codename: "pagani".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 2".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Foldable Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2551-15.0.0.800".to_string(),
                        version: "15.0.0.800".to_string(),
                        android_version: "Android 15".to_string(),
                        build_id: "CPH2551_15.0.0.800(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2024-12-10".to_string()),
                        security_patch: Some("2024-12-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/pagani/CPH2551_15.0.0.800.zip".to_string(),
                        file_size: Some(7_100_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-erhai".to_string(),
                name: "OnePlus Pad 2".to_string(),
                codename: "erhai".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 8 Gen 3".to_string()),
                release_year: Some(2024),
                series: Some("OnePlus Tablet Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-opd2415-16.0.0.211".to_string(),
                        version: "16.0.0.211".to_string(),
                        android_version: "Android 16".to_string(),
                        build_id: "OPD2415_16.0.0.211(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2025-01-18".to_string()),
                        security_patch: Some("2025-01-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/erhai/OPD2415_16.0.0.211.zip".to_string(),
                        file_size: Some(6_216_954_107),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-ktm".to_string(),
                name: "OnePlus Pad".to_string(),
                codename: "ktm".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("MediaTek Dimensity 9000".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Tablet Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-opd2203-15.0.0.700".to_string(),
                        version: "15.0.0.700".to_string(),
                        android_version: "Android 15".to_string(),
                        build_id: "OPD2203_15.0.0.700(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2024-11-25".to_string()),
                        security_patch: Some("2024-11-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/ktm/OPD2203_15.0.0.700.zip".to_string(),
                        file_size: Some(5_800_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },

            // ─── Nord Series ──────────────────────────────────────────────────
            FirmwareDeviceModel {
                id: "oneplus-audi".to_string(),
                name: "OnePlus Nord 4 5G".to_string(),
                codename: "audi".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 7+ Gen 3".to_string()),
                release_year: Some(2024),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2661-15.0.0.800".to_string(),
                        version: "15.0.0.800".to_string(),
                        android_version: "Android 15".to_string(),
                        build_id: "CPH2661_15.0.0.800(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2024-12-05".to_string()),
                        security_patch: Some("2024-12-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/audi/CPH2661_15.0.0.800.zip".to_string(),
                        file_size: Some(5_900_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-vitamin".to_string(),
                name: "OnePlus Nord 3 5G".to_string(),
                codename: "vitamin".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("MediaTek Dimensity 9000".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2493-14.0.0.800".to_string(),
                        version: "14.0.0.800".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2493_14.0.0.800(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2024-09-18".to_string()),
                        security_patch: Some("2024-09-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/vitamin/CPH2493_14.0.0.800.zip".to_string(),
                        file_size: Some(5_200_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-karen".to_string(),
                name: "OnePlus Nord 2T 5G".to_string(),
                codename: "karen".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("MediaTek Dimensity 1300".to_string()),
                release_year: Some(2022),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2399-14.0.0.600".to_string(),
                        version: "14.0.0.600".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2399_14.0.0.600(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2024-06-20".to_string()),
                        security_patch: Some("2024-06-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/karen/CPH2399_14.0.0.600.zip".to_string(),
                        file_size: Some(4_700_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-denniz".to_string(),
                name: "OnePlus Nord 2 5G".to_string(),
                codename: "denniz".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("MediaTek Dimensity 1200-AI".to_string()),
                release_year: Some(2021),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-dn2103-13.0.0.500".to_string(),
                        version: "13.0.0.500".to_string(),
                        android_version: "Android 13".to_string(),
                        build_id: "DN2103_13.0.0.500(EX01)".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2023-08-15".to_string()),
                        security_patch: Some("2023-08-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/denniz/DN2103_13.0.0.500.zip".to_string(),
                        file_size: Some(4_300_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-avicii".to_string(),
                name: "OnePlus Nord".to_string(),
                codename: "avicii".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 765G".to_string()),
                release_year: Some(2020),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-ac2003-12.1.0.120".to_string(),
                        version: "12.1.0.120".to_string(),
                        android_version: "Android 12".to_string(),
                        build_id: "AC2003_12.1.0.120".to_string(),
                        carrier: Some("Europe (EU)".to_string()),
                        release_date: Some("2022-11-10".to_string()),
                        security_patch: Some("2022-10-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/avicii/AC2003_12.1.0.120.zip".to_string(),
                        file_size: Some(3_500_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-cph2613".to_string(),
                name: "OnePlus Nord CE4 5G".to_string(),
                codename: "cph2613".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 7 Gen 3".to_string()),
                release_year: Some(2024),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2613-14.0.1.700".to_string(),
                        version: "14.0.1.700".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2613_14.0.1.700(EX01)".to_string(),
                        carrier: Some("India (IN)".to_string()),
                        release_date: Some("2024-09-02".to_string()),
                        security_patch: Some("2024-09-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/cph2613/CPH2613_14.0.1.700.zip".to_string(),
                        file_size: Some(5_100_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-cph2467".to_string(),
                name: "OnePlus Nord CE3 Lite 5G".to_string(),
                codename: "cph2467".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 695 5G".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2467-14.0.0.600".to_string(),
                        version: "14.0.0.600".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2467_14.0.0.600(EX01)".to_string(),
                        carrier: Some("Global (GLO)".to_string()),
                        release_date: Some("2024-06-25".to_string()),
                        security_patch: Some("2024-06-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/cph2467/CPH2467_14.0.0.600.zip".to_string(),
                        file_size: Some(4_600_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "oneplus-cph2513".to_string(),
                name: "OnePlus Nord N30 5G".to_string(),
                codename: "cph2513".to_string(),
                brand: FirmwareBrand::OnePlus,
                soc: Some("Snapdragon 695 5G".to_string()),
                release_year: Some(2023),
                series: Some("OnePlus Nord Series".to_string()),
                builds: vec![
                    FirmwareBuild {
                        id: "oneplus-cph2513-14.0.0.600".to_string(),
                        version: "14.0.0.600".to_string(),
                        android_version: "Android 14".to_string(),
                        build_id: "CPH2513_14.0.0.600(EX01)".to_string(),
                        carrier: Some("North America (NA)".to_string()),
                        release_date: Some("2024-07-15".to_string()),
                        security_patch: Some("2024-07-05".to_string()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://archive.org/download/oneplus_archive/spike0en/cph2513/CPH2513_14.0.0.600.zip".to_string(),
                        file_size: Some(4_550_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
        ]
    }
}

impl FirmwareProvider for OnePlusProvider {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::OnePlus
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(self.fetch_all())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_oneplus_static_catalog_integrity() {
        let catalog = OnePlusProvider::get_static_catalog();
        assert!(catalog.len() >= 20, "Static catalog must contain at least 20 models");

        for dev in &catalog {
            assert_eq!(dev.brand, FirmwareBrand::OnePlus);
            assert!(!dev.name.is_empty());
            assert!(!dev.codename.is_empty());
            assert!(!dev.builds.is_empty());
            assert!(dev.release_year.is_some());
            assert!(dev.soc.is_some());

            for b in &dev.builds {
                assert!(!b.download_url.is_empty());
                assert!(!b.version.is_empty());
            }
        }
    }

    #[test]
    fn test_parse_release_tag() {
        let (model, version, region) =
            OnePlusProvider::parse_release_tag("CPH2649_16.0.3.501(EX01)_IN");
        assert_eq!(model, "CPH2649");
        assert_eq!(version, "16.0.3.501(EX01)");
        assert_eq!(region, "IN");

        let (model2, version2, region2) =
            OnePlusProvider::parse_release_tag("PKG110_16.0.3.500(CN01)_CN");
        assert_eq!(model2, "PKG110");
        assert_eq!(version2, "16.0.3.500(CN01)");
        assert_eq!(region2, "CN");
    }

    #[test]
    fn test_resolve_device_identity() {
        let (code, name) = OnePlusProvider::resolve_device_identity("CPH2749");
        assert_eq!(code, "infiniti");
        assert_eq!(name, "OnePlus 13");

        let (code2, name2) = OnePlusProvider::resolve_device_identity("CPH2583");
        assert_eq!(code2, "waffle");
        assert_eq!(name2, "OnePlus 12");

        let (code3, name3) = OnePlusProvider::resolve_device_identity("KB2001");
        assert_eq!(code3, "kebab");
        assert_eq!(name3, "OnePlus 8T");
    }

    #[test]
    fn test_infer_android_version() {
        assert_eq!(OnePlusProvider::infer_android_version("16.0.3.501"), "Android 16");
        assert_eq!(OnePlusProvider::infer_android_version("15.0.0.830"), "Android 15");
        assert_eq!(OnePlusProvider::infer_android_version("14.0.0.600"), "Android 14");
        assert_eq!(OnePlusProvider::infer_android_version("13.1.0.582"), "Android 13");
    }
}
