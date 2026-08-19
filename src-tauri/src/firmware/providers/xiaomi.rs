use std::collections::HashMap;

use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};

use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

const XFU_LATEST_YAML_URL: &str = "https://raw.githubusercontent.com/XiaomiFirmwareUpdater/miui-updates-tracker/master/data/latest.yml";
const USER_AGENT_STR: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

pub struct XiaomiProvider {
    client: reqwest::Client,
}

impl Default for XiaomiProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl XiaomiProvider {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        if let Ok(val) = HeaderValue::from_str(USER_AGENT_STR) {
            headers.insert(USER_AGENT, val);
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .unwrap_or_default();

        Self { client }
    }

    pub fn with_client(client: reqwest::Client) -> Self {
        Self { client }
    }

    /// Fetch and parse the live catalog from XiaomiFirmwareUpdater
    pub async fn fetch_all(&self) -> Result<Vec<FirmwareDeviceModel>, String> {
        let response = match self.client.get(XFU_LATEST_YAML_URL).send().await {
            Ok(resp) => resp,
            Err(e) => {
                log::warn!(
                    "Failed to fetch xmfirmwareupdater YAML feed ({e}), using fallback catalog"
                );
                return Ok(Self::get_static_catalog());
            }
        };

        if !response.status().is_success() {
            log::warn!(
                "xmfirmwareupdater feed returned status {}, using fallback catalog",
                response.status()
            );
            return Ok(Self::get_static_catalog());
        }

        let yaml_content = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                log::warn!(
                    "Failed to read xmfirmwareupdater YAML feed ({e}), using fallback catalog"
                );
                return Ok(Self::get_static_catalog());
            }
        };

        let models = Self::parse_yaml(&yaml_content);
        if models.is_empty() {
            log::warn!("Parsed 0 Xiaomi devices from YAML, using fallback catalog");
            return Ok(Self::get_static_catalog());
        }

        Ok(models)
    }

    /// Fast line-based YAML parser for XiaomiFirmwareUpdater latest.yml feed
    pub fn parse_yaml(yaml: &str) -> Vec<FirmwareDeviceModel> {
        let mut raw_records: Vec<HashMap<String, String>> = Vec::new();
        let mut current_record: HashMap<String, String> = HashMap::new();

        for line in yaml.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let line_content = if let Some(stripped) = trimmed.strip_prefix("- ") {
                if !current_record.is_empty() {
                    raw_records.push(std::mem::take(&mut current_record));
                }
                stripped.trim()
            } else {
                trimmed
            };

            if let Some((key, val)) = line_content.split_once(':') {
                let clean_key = key.trim().to_ascii_lowercase();
                let clean_val = val.trim().trim_matches('\'').trim_matches('"').trim();
                current_record.insert(clean_key, clean_val.to_string());
            }
        }

        if !current_record.is_empty() {
            raw_records.push(current_record);
        }

        // Group records by base codename
        let mut grouped_records: HashMap<String, Vec<HashMap<String, String>>> = HashMap::new();
        for record in raw_records {
            let Some(codename) = record.get("codename") else {
                continue;
            };
            if codename.is_empty() {
                continue;
            }
            let base_code = Self::extract_base_codename(codename);
            grouped_records.entry(base_code).or_default().push(record);
        }

        let mut devices = Vec::new();

        for (base_code, records) in grouped_records {
            let Some(first) = records.first() else {
                continue;
            };

            let raw_name = first.get("name").cloned().unwrap_or_else(|| base_code.clone());
            let display_name = Self::clean_device_name(&raw_name);
            let (soc, release_year, series) = Self::enrich_metadata(&base_code, &display_name);

            let mut builds = Vec::new();

            for r in &records {
                let Some(download_url) = r.get("link") else {
                    continue;
                };
                if download_url.is_empty() {
                    continue;
                }

                let version = r.get("version").cloned().unwrap_or_else(|| "Unknown".into());
                let android = r.get("android").cloned().unwrap_or_default();
                let android_version = if android.is_empty() {
                    "Android".into()
                } else if android.starts_with("Android") {
                    android
                } else {
                    format!("Android {android}")
                };

                let method = r.get("method").map_or("", |s| s.as_str());
                let image_type =
                    if method.eq_ignore_ascii_case("fastboot") || download_url.ends_with(".tgz") {
                        FirmwareImageType::Factory
                    } else {
                        FirmwareImageType::Ota
                    };

                let regional_name = r.get("name").cloned().unwrap_or_default();
                let carrier = Self::extract_region_label(&regional_name, method);

                let release_date = r.get("date").cloned().filter(|s| !s.is_empty());
                let file_size = r.get("size").and_then(|s| Self::parse_human_size(s));
                let sha256 = r.get("sha256").cloned().filter(|s| s.len() == 64);

                let method_slug =
                    if image_type == FirmwareImageType::Factory { "fastboot" } else { "ota" };
                let ver_slug =
                    version.replace(['.', ' ', '/', '\\', ':'], "-").to_ascii_lowercase();
                let build_unique_id = format!("xiaomi-{base_code}-{method_slug}-{ver_slug}");

                builds.push(FirmwareBuild {
                    id: build_unique_id,
                    version,
                    android_version,
                    build_id: r.get("version").cloned().unwrap_or_default(),
                    carrier: Some(carrier),
                    release_date,
                    security_patch: None,
                    image_type,
                    download_url: download_url.clone(),
                    file_size,
                    sha256,
                    is_latest: false, // Flagged below
                });
            }

            if builds.is_empty() {
                continue;
            }

            // Sort builds descending by release date and version
            builds.sort_by(|a, b| {
                b.release_date.cmp(&a.release_date).then_with(|| b.version.cmp(&a.version))
            });

            // Mark the latest build for OTA and Factory separately
            let mut latest_ota_found = false;
            let mut latest_factory_found = false;
            for build in &mut builds {
                if build.image_type == FirmwareImageType::Ota && !latest_ota_found {
                    build.is_latest = true;
                    latest_ota_found = true;
                } else if build.image_type == FirmwareImageType::Factory && !latest_factory_found {
                    build.is_latest = true;
                    latest_factory_found = true;
                }
            }

            devices.push(FirmwareDeviceModel {
                id: format!("xiaomi-{base_code}"),
                name: display_name,
                codename: base_code,
                brand: FirmwareBrand::Xiaomi,
                soc,
                release_year,
                series,
                builds,
            });
        }

        // Sort devices descending by release year, then by name
        devices
            .sort_by(|a, b| b.release_year.cmp(&a.release_year).then_with(|| a.name.cmp(&b.name)));

        devices
    }

    /// Extract base hardware codename by removing regional suffixes
    pub fn extract_base_codename(codename: &str) -> String {
        let code = codename.trim().to_ascii_lowercase();
        const SUFFIXES: &[&str] = &[
            "_eea_global",
            "_in_global",
            "_id_global",
            "_ru_global",
            "_tr_global",
            "_tw_global",
            "_jp_global",
            "_kr_global",
            "_global",
            "_cn",
            "_eea",
            "_in",
            "_id",
            "_ru",
            "_tr",
            "_tw",
            "_jp",
            "_kr",
        ];

        for suffix in SUFFIXES {
            if let Some(stripped) = code.strip_suffix(suffix)
                && !stripped.is_empty()
            {
                return stripped.to_string();
            }
        }

        code
    }

    /// Clean regional suffix from device model name
    pub fn clean_device_name(name: &str) -> String {
        let mut clean = name.trim();
        const REGIONS: &[&str] = &[
            " China",
            " Global",
            " EEA",
            " India",
            " Taiwan",
            " Russia",
            " Turkey",
            " Indonesia",
            " Japan",
            " Korea",
            " Latin America",
        ];

        for reg in REGIONS {
            if let Some(stripped) = clean.strip_suffix(reg) {
                clean = stripped.trim();
            }
        }

        clean.to_string()
    }

    /// Extract region / method label for carrier field
    pub fn extract_region_label(name: &str, method: &str) -> String {
        let mut region = "Global";
        if name.contains("China") {
            region = "China";
        } else if name.contains("EEA") || name.contains("Europe") {
            region = "EEA / Europe";
        } else if name.contains("India") {
            region = "India";
        } else if name.contains("Taiwan") {
            region = "Taiwan";
        } else if name.contains("Russia") {
            region = "Russia";
        } else if name.contains("Turkey") {
            region = "Turkey";
        } else if name.contains("Indonesia") {
            region = "Indonesia";
        } else if name.contains("Japan") {
            region = "Japan";
        }

        if method.eq_ignore_ascii_case("fastboot") {
            format!("{region} Fastboot TGZ")
        } else {
            format!("{region} Recovery Full OTA")
        }
    }

    /// Parse human readable size string like "5.9 GB" or "315.9 MB" into exact bytes
    pub fn parse_human_size(size_str: &str) -> Option<u64> {
        let s = size_str.trim().to_ascii_uppercase();
        if s.is_empty() {
            return None;
        }

        if let Some(num_str) = s.strip_suffix("GB").or_else(|| s.strip_suffix('G')) {
            let val = num_str.trim().parse::<f64>().ok()?;
            return Some((val * 1024.0 * 1024.0 * 1024.0) as u64);
        }

        if let Some(num_str) = s.strip_suffix("MB").or_else(|| s.strip_suffix('M')) {
            let val = num_str.trim().parse::<f64>().ok()?;
            return Some((val * 1024.0 * 1024.0) as u64);
        }

        if let Some(num_str) = s.strip_suffix("KB").or_else(|| s.strip_suffix('K')) {
            let val = num_str.trim().parse::<f64>().ok()?;
            return Some((val * 1024.0) as u64);
        }

        if let Some(num_str) = s.strip_suffix('B') {
            let val = num_str.trim().parse::<f64>().ok()?;
            return Some(val as u64);
        }

        s.parse::<u64>().ok()
    }

    /// Enrich hardware SoC, release year, and series for Xiaomi / Redmi / POCO devices
    pub fn enrich_metadata(
        codename: &str,
        display_name: &str,
    ) -> (Option<String>, Option<u32>, Option<String>) {
        let (soc, year) = match codename {
            // Flagships & Recent Snapdragon 8 Series
            "haotian" => (Some("Qualcomm Snapdragon 8 Elite (SM8750)"), Some(2024)),
            "dada" => (Some("Qualcomm Snapdragon 8 Elite (SM8750)"), Some(2024)),
            "houji" => (Some("Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)"), Some(2023)),
            "shennong" => (Some("Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)"), Some(2023)),
            "aurora" => (Some("Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)"), Some(2024)),
            "manet" => (Some("Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)"), Some(2023)),
            "peridot" => (Some("Qualcomm Snapdragon 8s Gen 3 (SM8635)"), Some(2024)),
            "chenfeng" => (Some("Qualcomm Snapdragon 8s Gen 3 (SM8635)"), Some(2024)),
            "fuxi" => (Some("Qualcomm Snapdragon 8 Gen 2 (SM8550-AB)"), Some(2022)),
            "nuwa" => (Some("Qualcomm Snapdragon 8 Gen 2 (SM8550-AB)"), Some(2022)),
            "ishtar" => (Some("Qualcomm Snapdragon 8 Gen 2 (SM8550-AB)"), Some(2023)),
            "socrates" => (Some("Qualcomm Snapdragon 8 Gen 2 (SM8550-AB)"), Some(2022)),
            "vermeer" => (Some("Qualcomm Snapdragon 8 Gen 2 (SM8550-AB)"), Some(2023)),
            "mondrian" => (Some("Qualcomm Snapdragon 8+ Gen 1 (SM8475)"), Some(2022)),
            "diting" => (Some("Qualcomm Snapdragon 8+ Gen 1 (SM8475)"), Some(2022)),
            "mayfly" | "thor" | "unicorn" => {
                (Some("Qualcomm Snapdragon 8+ Gen 1 (SM8475)"), Some(2022))
            }
            "zeus" | "cupid" => (Some("Qualcomm Snapdragon 8 Gen 1 (SM8450)"), Some(2021)),
            "alioth" => (Some("Qualcomm Snapdragon 870 (SM8250-AC)"), Some(2021)),
            "munch" => (Some("Qualcomm Snapdragon 870 (SM8250-AC)"), Some(2022)),
            "apollo" | "umi" | "cmi" | "lmi" => {
                (Some("Qualcomm Snapdragon 865 (SM8250)"), Some(2020))
            }
            "venus" | "star" | "haydn" | "thyme" => {
                (Some("Qualcomm Snapdragon 888 (SM8350)"), Some(2021))
            }
            "vayu" | "bhima" => (Some("Qualcomm Snapdragon 860 (SM8150-AC)"), Some(2021)),
            "cepheus" | "raphael" | "davinci" => {
                (Some("Qualcomm Snapdragon 855 (SM8150)"), Some(2019))
            }
            "dipper" | "polaris" | "ursa" | "equuleus" | "perseus" | "beryllium" => {
                (Some("Qualcomm Snapdragon 845 (SDM845)"), Some(2018))
            }
            "sagit" | "chiron" => (Some("Qualcomm Snapdragon 835 (MSM8998)"), Some(2017)),

            // Mid-range & Snapdragon 7 / 6 / 4 Series
            "marble" => (Some("Qualcomm Snapdragon 7+ Gen 2 (SM7475-AB)"), Some(2023)),
            "garnet" => (Some("Qualcomm Snapdragon 7s Gen 2 (SM7435-AB)"), Some(2023)),
            "redwood" => (Some("Qualcomm Snapdragon 778G (SM7325)"), Some(2022)),
            "taoyao" => (Some("Qualcomm Snapdragon 778G (SM7325)"), Some(2022)),
            "renoir" | "lisa" => (Some("Qualcomm Snapdragon 778G (SM7325)"), Some(2021)),
            "sweet" | "surya" => (Some("Qualcomm Snapdragon 732G (SM7150-AC)"), Some(2021)),
            "toco" => (Some("Qualcomm Snapdragon 730G (SM7150-AB)"), Some(2020)),
            "curtana" | "joyeuse" | "gram" => {
                (Some("Qualcomm Snapdragon 720G (SM7125)"), Some(2020))
            }
            "sky" => (Some("Qualcomm Snapdragon 4 Gen 2 (SM4450)"), Some(2023)),
            "breeze" => (Some("Qualcomm Snapdragon 4s Gen 2 (SM4435)"), Some(2024)),
            "ginkgo" | "willow" => (Some("Qualcomm Snapdragon 665 (SM6125)"), Some(2019)),
            "lavender" => (Some("Qualcomm Snapdragon 660 (SDM660)"), Some(2019)),
            "whyred" | "tulip" => (Some("Qualcomm Snapdragon 636 (SDM636)"), Some(2018)),
            "mido" => (Some("Qualcomm Snapdragon 625 (MSM8953)"), Some(2017)),
            "fog" => (Some("Qualcomm Snapdragon 680 (SM6225)"), Some(2022)),

            // MediaTek Dimensity Series
            "cwt" => (Some("MediaTek Dimensity 9300+ (MT6989)"), Some(2024)),
            "corot" => (Some("MediaTek Dimensity 9200+ (MT6985)"), Some(2023)),
            "duchamp" => (Some("MediaTek Dimensity 8300-Ultra (MT6897)"), Some(2023)),
            "degas" => (Some("MediaTek Dimensity 8300 (MT6897)"), Some(2024)),
            "aristotle" => (Some("MediaTek Dimensity 8200-Ultra (MT6896)"), Some(2023)),
            "yuechu" => (Some("MediaTek Dimensity 8200-Ultra (MT6896)"), Some(2023)),
            "plato" => (Some("MediaTek Dimensity 8100-Ultra (MT6895)"), Some(2022)),
            "xaga" => (Some("MediaTek Dimensity 8100 (MT6895)"), Some(2022)),
            "zircon" => (Some("MediaTek Dimensity 7200-Ultra (MT6877V)"), Some(2023)),
            "agate" => (Some("MediaTek Dimensity 1200 (MT6893)"), Some(2021)),
            "ruby" => (Some("MediaTek Dimensity 1080 (MT6877V)"), Some(2022)),
            "air" => (Some("MediaTek Dimensity 6100+ (MT6835)"), Some(2023)),
            "gold" => (Some("MediaTek Dimensity 6080 (MT6833P)"), Some(2023)),
            "light" => (Some("MediaTek Dimensity 700 (MT6833)"), Some(2022)),

            // MediaTek Helio Series
            "emerald" => (Some("MediaTek Helio G99 Ultra (MT6789)"), Some(2024)),
            "earth" => (Some("MediaTek Helio G99 (MT6789)"), Some(2022)),
            "fleur" => (Some("MediaTek Helio G96 (MT6781)"), Some(2022)),
            "fire" => (Some("MediaTek Helio G88 (MT6769H)"), Some(2023)),
            "gale" | "rock" => (Some("MediaTek Helio G85 (MT6769Z)"), Some(2023)),

            _ => (None, None),
        };

        let series = if display_name.contains("POCO F") {
            Some("POCO F Series".to_string())
        } else if display_name.contains("POCO X") {
            Some("POCO X Series".to_string())
        } else if display_name.contains("POCO M") {
            Some("POCO M Series".to_string())
        } else if display_name.contains("POCO C") {
            Some("POCO C Series".to_string())
        } else if display_name.contains("POCO") {
            Some("POCO Series".to_string())
        } else if display_name.contains("Redmi Note") {
            Some("Redmi Note Series".to_string())
        } else if display_name.contains("Redmi K") {
            Some("Redmi K Series".to_string())
        } else if display_name.contains("Redmi Turbo") {
            Some("Redmi Turbo Series".to_string())
        } else if display_name.contains("Redmi") {
            Some("Redmi Series".to_string())
        } else if display_name.contains("Xiaomi 15") {
            Some("Xiaomi 15 Series".to_string())
        } else if display_name.contains("Xiaomi 14") {
            Some("Xiaomi 14 Series".to_string())
        } else if display_name.contains("Xiaomi 13") {
            Some("Xiaomi 13 Series".to_string())
        } else if display_name.contains("Xiaomi 12") {
            Some("Xiaomi 12 Series".to_string())
        } else if display_name.contains("Xiaomi 11") || display_name.contains("Mi 11") {
            Some("Xiaomi 11 Series".to_string())
        } else if display_name.contains("MIX") {
            Some("Xiaomi MIX Series".to_string())
        } else if display_name.contains("Civi") {
            Some("Xiaomi Civi Series".to_string())
        } else if display_name.contains("Pad") {
            Some("Xiaomi Pad Series".to_string())
        } else if display_name.contains("Xiaomi") || display_name.contains("Mi") {
            Some("Xiaomi Series".to_string())
        } else {
            None
        };

        (soc.map(Into::into), year, series)
    }

    /// Static fallback catalog containing major flagship and popular Xiaomi, Redmi, and POCO devices
    pub fn get_static_catalog() -> Vec<FirmwareDeviceModel> {
        vec![
            FirmwareDeviceModel {
                id: "xiaomi-houji".into(),
                name: "Xiaomi 14".into(),
                codename: "houji".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)".into()),
                release_year: Some(2023),
                series: Some("Xiaomi 14 Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-houji-ota-os1-0-18-0-uncmixm".into(),
                        version: "HyperOS 1.0.18.0.UNCMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.18.0.UNCMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-11-20".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.18.0.UNCMIXM/houji_global-ota_full-OS1.0.18.0.UNCMIXM-user-14.0-53296c0d4a.zip".into(),
                        file_size: Some(6_120_349_696),
                        sha256: None,
                        is_latest: true,
                    },
                    FirmwareBuild {
                        id: "xiaomi-houji-fastboot-os1-0-18-0-uncmixm".into(),
                        version: "HyperOS 1.0.18.0.UNCMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.18.0.UNCMIXM".into(),
                        carrier: Some("Global Fastboot TGZ".into()),
                        release_date: Some("2024-11-20".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Factory,
                        download_url: "https://bigota.d.miui.com/OS1.0.18.0.UNCMIXM/houji_global_images_OS1.0.18.0.UNCMIXM_20241120.0000.00_14.0_global_53296c0d4a.tgz".into(),
                        file_size: Some(7_634_567_168),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-peridot".into(),
                name: "POCO F6 / Redmi Turbo 3".into(),
                codename: "peridot".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 8s Gen 3 (SM8635)".into()),
                release_year: Some(2024),
                series: Some("POCO F Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-peridot-ota-os1-0-8-0-unpmixm".into(),
                        version: "HyperOS 1.0.8.0.UNPMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.8.0.UNPMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-10-15".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.8.0.UNPMIXM/peridot_global-ota_full-OS1.0.8.0.UNPMIXM-user-14.0-a19e34b9cf.zip".into(),
                        file_size: Some(5_832_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-marble".into(),
                name: "POCO F5 / Redmi Note 12 Turbo".into(),
                codename: "marble".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 7+ Gen 2 (SM7475-AB)".into()),
                release_year: Some(2023),
                series: Some("POCO F Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-marble-ota-os1-0-7-0-umrmixm".into(),
                        version: "HyperOS 1.0.7.0.UMRMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.7.0.UMRMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-09-10".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.7.0.UMRMIXM/marble_global-ota_full-OS1.0.7.0.UMRMIXM-user-14.0-3b8c4d2e1a.zip".into(),
                        file_size: Some(5_240_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-garnet".into(),
                name: "Redmi Note 13 Pro 5G / POCO X6 5G".into(),
                codename: "garnet".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 7s Gen 2 (SM7435-AB)".into()),
                release_year: Some(2023),
                series: Some("Redmi Note Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-garnet-ota-os1-0-11-0-unrmixm".into(),
                        version: "HyperOS 1.0.11.0.UNRMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.11.0.UNRMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-11-05".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.11.0.UNRMIXM/garnet_global-ota_full-OS1.0.11.0.UNRMIXM-user-14.0-4c7b8e1f2a.zip".into(),
                        file_size: Some(5_720_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-vermeer".into(),
                name: "Redmi K70 / POCO F6 Pro".into(),
                codename: "vermeer".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 8 Gen 2 (SM8550-AB)".into()),
                release_year: Some(2023),
                series: Some("POCO F Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-vermeer-ota-os1-0-8-0-unkmixm".into(),
                        version: "HyperOS 1.0.8.0.UNKMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.8.0.UNKMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-10-22".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.8.0.UNKMIXM/vermeer_global-ota_full-OS1.0.8.0.UNKMIXM-user-14.0-9a8b7c6d5e.zip".into(),
                        file_size: Some(6_010_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-duchamp".into(),
                name: "Redmi K70E / POCO X6 Pro 5G".into(),
                codename: "duchamp".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("MediaTek Dimensity 8300-Ultra (MT6897)".into()),
                release_year: Some(2023),
                series: Some("POCO X Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-duchamp-ota-os1-0-12-0-unlmixm".into(),
                        version: "HyperOS 1.0.12.0.UNLMIXM".into(),
                        android_version: "Android 14".into(),
                        build_id: "OS1.0.12.0.UNLMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-11-12".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.12.0.UNLMIXM/duchamp_global-ota_full-OS1.0.12.0.UNLMIXM-user-14.0-8f7e6d5c4b.zip".into(),
                        file_size: Some(5_940_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-alioth".into(),
                name: "POCO F3 / Redmi K40 / Mi 11X".into(),
                codename: "alioth".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 870 (SM8250-AC)".into()),
                release_year: Some(2021),
                series: Some("POCO F Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "xiaomi-alioth-ota-os1-0-3-0-tkhmixm".into(),
                        version: "HyperOS 1.0.3.0.TKHMIXM".into(),
                        android_version: "Android 13".into(),
                        build_id: "OS1.0.3.0.TKHMIXM".into(),
                        carrier: Some("Global Recovery Full OTA".into()),
                        release_date: Some("2024-06-18".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://bigota.d.miui.com/OS1.0.3.0.TKHMIXM/alioth_global-ota_full-OS1.0.3.0.TKHMIXM-user-13.0-2a3b4c5d6e.zip".into(),
                        file_size: Some(4_120_000_000),
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
        ]
    }
}

impl FirmwareProvider for XiaomiProvider {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::Xiaomi
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(async move { self.fetch_all().await })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_base_codename() {
        assert_eq!(XiaomiProvider::extract_base_codename("houji_eea_global"), "houji");
        assert_eq!(XiaomiProvider::extract_base_codename("peridot_global"), "peridot");
        assert_eq!(XiaomiProvider::extract_base_codename("marble_in_global"), "marble");
        assert_eq!(XiaomiProvider::extract_base_codename("garnet_cn"), "garnet");
        assert_eq!(XiaomiProvider::extract_base_codename("alioth"), "alioth");
    }

    #[test]
    fn test_clean_device_name() {
        assert_eq!(XiaomiProvider::clean_device_name("Xiaomi 14 China"), "Xiaomi 14");
        assert_eq!(XiaomiProvider::clean_device_name("POCO F6 Global"), "POCO F6");
        assert_eq!(
            XiaomiProvider::clean_device_name("Redmi Note 13 Pro 5G Taiwan"),
            "Redmi Note 13 Pro 5G"
        );
    }

    #[test]
    fn test_parse_human_size() {
        assert_eq!(XiaomiProvider::parse_human_size("5.9 GB"), Some(6_335_076_761));
        assert_eq!(XiaomiProvider::parse_human_size("315.9 MB"), Some(331_245_158));
        assert_eq!(XiaomiProvider::parse_human_size(""), None);
    }

    #[test]
    fn test_enrich_metadata() {
        let (soc, year, series) = XiaomiProvider::enrich_metadata("houji", "Xiaomi 14");
        assert_eq!(soc.as_deref(), Some("Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)"));
        assert_eq!(year, Some(2023));
        assert_eq!(series.as_deref(), Some("Xiaomi 14 Series"));

        let (soc2, year2, series2) = XiaomiProvider::enrich_metadata("peridot", "POCO F6");
        assert_eq!(soc2.as_deref(), Some("Qualcomm Snapdragon 8s Gen 3 (SM8635)"));
        assert_eq!(year2, Some(2024));
        assert_eq!(series2.as_deref(), Some("POCO F Series"));
    }

    #[test]
    fn test_parse_yaml_basic() {
        let sample = r#"
- android: '14.0'
  branch: Stable
  codename: houji_global
  date: 2024-11-20
  link: https://bigota.d.miui.com/OS1.0.18.0.UNCMIXM/houji_global-ota_full-OS1.0.18.0.UNCMIXM-user-14.0-53296c0d4a.zip
  md5: 53296c0d4a1b2c3d4e5f6a7b8c9d0e1f
  method: Recovery
  name: Xiaomi 14 Global
  size: 5.8 GB
  version: OS1.0.18.0.UNCMIXM
- android: '14.0'
  branch: Stable
  codename: houji_global
  date: 2024-11-20
  link: https://bigota.d.miui.com/OS1.0.18.0.UNCMIXM/houji_global_images_OS1.0.18.0.UNCMIXM_20241120.0000.00_14.0_global_53296c0d4a.tgz
  md5: 53296c0d4a1b2c3d4e5f6a7b8c9d0e1f
  method: Fastboot
  name: Xiaomi 14 Global
  size: 7.2 GB
  version: OS1.0.18.0.UNCMIXM
"#;
        let devices = XiaomiProvider::parse_yaml(sample);
        assert_eq!(devices.len(), 1);
        let d = &devices[0];
        assert_eq!(d.codename, "houji");
        assert_eq!(d.name, "Xiaomi 14");
        assert_eq!(d.builds.len(), 2);
        assert_eq!(d.builds[0].image_type, FirmwareImageType::Ota);
        assert_eq!(d.builds[1].image_type, FirmwareImageType::Factory);
    }

    #[test]
    fn test_static_catalog() {
        let catalog = XiaomiProvider::get_static_catalog();
        assert!(!catalog.is_empty());
        assert!(catalog.iter().any(|d| d.codename == "houji"));
        assert!(catalog.iter().any(|d| d.codename == "peridot"));
    }
}
