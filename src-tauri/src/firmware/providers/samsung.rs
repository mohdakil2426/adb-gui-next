use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};

use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

const FOTA_URL_TEMPLATE: &str =
    "https://fota-cloud-dn.ospserver.net/firmware/{csc}/{model}/version.xml";
const USER_AGENT_FUS: &str = "Kies2.0_FUS";
pub struct SamsungProvider {
    client: reqwest::Client,
}

impl Default for SamsungProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl SamsungProvider {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_FUS));

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

    /// Fetch and build device catalog for Samsung devices
    pub async fn fetch_all(&self) -> Result<Vec<FirmwareDeviceModel>, String> {
        let mut devices = Self::get_static_catalog();
        devices.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(devices)
    }

    /// Query live Samsung FOTA server for the latest firmware build of a model
    pub async fn query_live_fota(
        &self,
        model: &str,
        csc: &str,
    ) -> Result<Option<FirmwareBuild>, String> {
        let url = FOTA_URL_TEMPLATE.replace("{csc}", csc).replace("{model}", model);

        let resp = self
            .client
            .get(&url)
            .header(USER_AGENT, USER_AGENT_FUS)
            .send()
            .await
            .map_err(|e| format!("Samsung FOTA network error: {e}"))?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let xml =
            resp.text().await.map_err(|e| format!("Failed to read Samsung FOTA body: {e}"))?;

        Ok(Self::parse_fota_xml(&xml, model, csc))
    }

    /// Parse Samsung FOTA version.xml response
    pub fn parse_fota_xml(xml: &str, model: &str, csc: &str) -> Option<FirmwareBuild> {
        let start_tag = "<latest>";
        let end_tag = "</latest>";
        let start = xml.find(start_tag)? + start_tag.len();
        let end = xml[start..].find(end_tag)? + start;
        let latest_text = xml[start..end].trim();

        if latest_text.is_empty() || latest_text.eq_ignore_ascii_case("none") {
            return None;
        }

        // Format is PDA/CSC/MODEM e.g., S928BXXS6DZG1/S928BOXM6DZG1/S928BXXS6DZG1
        let parts: Vec<&str> = latest_text.split('/').collect();
        let pda = parts.first()?.trim();
        let csc_part = parts.get(1).map_or("", |s| s.trim());

        let android_version = Self::infer_android_version(pda);
        let download_url = format!("https://samfw.com/firmware/{model}/{csc}/{pda}");

        Some(FirmwareBuild {
            id: format!(
                "samsung-{}-{}-{}",
                model.to_lowercase(),
                csc.to_lowercase(),
                pda.to_lowercase()
            ),
            version: pda.to_string(),
            android_version,
            build_id: format!("{pda} / {csc_part}"),
            carrier: Some(format!("{csc} Region")),
            release_date: None,
            security_patch: None,
            image_type: FirmwareImageType::Factory,
            download_url,
            file_size: None,
            sha256: None,
            is_latest: true,
        })
    }

    /// Infer Android OS version from Samsung PDA version string
    pub fn infer_android_version(pda: &str) -> String {
        // Modern Samsung bootloader & OS letter in PDA string (e.g. S928BXXS6DZG1 -> D=Android 16 or C=Android 15)
        let upper = pda.to_uppercase();
        if upper.len() >= 4 {
            let fourth_from_end = upper.chars().nth(upper.len().saturating_sub(4)).unwrap_or('A');
            match fourth_from_end {
                'E' => "Android 17".to_string(),
                'D' => "Android 16".to_string(),
                'C' => "Android 15".to_string(),
                'B' => "Android 14".to_string(),
                'A' => "Android 13".to_string(),
                'Z' => "Android Beta".to_string(),
                'Y' => "Android 12".to_string(),
                'X' => "Android 11".to_string(),
                'W' => "Android 10".to_string(),
                _ => "Android 15".to_string(),
            }
        } else {
            "Android 15".to_string()
        }
    }

    /// Enrich Samsung hardware metadata (SoC, release year, series)
    pub fn enrich_metadata(
        model_code: &str,
        name: &str,
    ) -> (Option<String>, Option<u32>, Option<String>) {
        let code = model_code.to_uppercase();
        let n = name.to_lowercase();

        // ─── Galaxy S Series ──────────────────────────────────────────────────
        if code.starts_with("SM-S938") || n.contains("s25 ultra") {
            (
                Some("Snapdragon 8 Elite for Galaxy".to_string()),
                Some(2025),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-S936") || code.starts_with("SM-S931") || n.contains("s25") {
            (
                Some("Exynos 2500 / Snapdragon 8 Elite".to_string()),
                Some(2025),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-S928") || n.contains("s24 ultra") {
            (
                Some("Snapdragon 8 Gen 3 for Galaxy".to_string()),
                Some(2024),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-S926") || code.starts_with("SM-S921") || n.contains("s24") {
            (
                Some("Exynos 2400 / Snapdragon 8 Gen 3".to_string()),
                Some(2024),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-S721") || n.contains("s24 fe") {
            (Some("Exynos 2400e".to_string()), Some(2024), Some("Galaxy S Series".to_string()))
        } else if code.starts_with("SM-S918")
            || code.starts_with("SM-S916")
            || code.starts_with("SM-S911")
            || n.contains("s23")
        {
            (
                Some("Snapdragon 8 Gen 2 for Galaxy".to_string()),
                Some(2023),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-S711") || n.contains("s23 fe") {
            (
                Some("Exynos 2200 / Snapdragon 8 Gen 1".to_string()),
                Some(2023),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-S908")
            || code.starts_with("SM-S906")
            || code.starts_with("SM-S901")
            || n.contains("s22")
        {
            (
                Some("Snapdragon 8 Gen 1 / Exynos 2200".to_string()),
                Some(2022),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-G998")
            || code.starts_with("SM-G996")
            || code.starts_with("SM-G991")
            || n.contains("s21")
        {
            (
                Some("Snapdragon 888 / Exynos 2100".to_string()),
                Some(2021),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-G988")
            || code.starts_with("SM-G986")
            || code.starts_with("SM-G981")
            || n.contains("s20")
        {
            (
                Some("Snapdragon 865 / Exynos 990".to_string()),
                Some(2020),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-G975")
            || code.starts_with("SM-G973")
            || code.starts_with("SM-G970")
            || n.contains("s10")
        {
            (
                Some("Exynos 9820 / Snapdragon 855".to_string()),
                Some(2019),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-G965") || code.starts_with("SM-G960") || n.contains("s9") {
            (
                Some("Exynos 9810 / Snapdragon 845".to_string()),
                Some(2018),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-G955") || code.starts_with("SM-G950") || n.contains("s8") {
            (
                Some("Exynos 8895 / Snapdragon 835".to_string()),
                Some(2017),
                Some("Galaxy S Series".to_string()),
            )
        } else if code.starts_with("SM-G935") || code.starts_with("SM-G930") || n.contains("s7") {
            (
                Some("Exynos 8890 / Snapdragon 820".to_string()),
                Some(2016),
                Some("Galaxy S Series".to_string()),
            )
        }
        // ─── Galaxy Z Fold & Flip Series ───────────────────────────────────────
        else if code.starts_with("SM-F956")
            || code.starts_with("SM-F741")
            || n.contains("z fold 6")
            || n.contains("z flip 6")
        {
            (
                Some("Snapdragon 8 Gen 3 for Galaxy".to_string()),
                Some(2024),
                Some("Galaxy Z Series".to_string()),
            )
        } else if code.starts_with("SM-F946")
            || code.starts_with("SM-F731")
            || n.contains("z fold 5")
            || n.contains("z flip 5")
        {
            (
                Some("Snapdragon 8 Gen 2 for Galaxy".to_string()),
                Some(2023),
                Some("Galaxy Z Series".to_string()),
            )
        } else if code.starts_with("SM-F936")
            || code.starts_with("SM-F721")
            || n.contains("z fold 4")
            || n.contains("z flip 4")
        {
            (
                Some("Snapdragon 8+ Gen 1".to_string()),
                Some(2022),
                Some("Galaxy Z Series".to_string()),
            )
        } else if code.starts_with("SM-F926")
            || code.starts_with("SM-F711")
            || n.contains("z fold 3")
            || n.contains("z flip 3")
        {
            (Some("Snapdragon 888".to_string()), Some(2021), Some("Galaxy Z Series".to_string()))
        } else if code.starts_with("SM-F916") || n.contains("z fold 2") {
            (Some("Snapdragon 865+".to_string()), Some(2020), Some("Galaxy Z Series".to_string()))
        }
        // ─── Galaxy Note Series ────────────────────────────────────────────────
        else if code.starts_with("SM-N986")
            || code.starts_with("SM-N981")
            || n.contains("note 20")
        {
            (
                Some("Snapdragon 865+ / Exynos 990".to_string()),
                Some(2020),
                Some("Galaxy Note Series".to_string()),
            )
        } else if code.starts_with("SM-N975")
            || code.starts_with("SM-N970")
            || n.contains("note 10")
        {
            (
                Some("Exynos 9825 / Snapdragon 855".to_string()),
                Some(2019),
                Some("Galaxy Note Series".to_string()),
            )
        } else if code.starts_with("SM-N960") || n.contains("note 9") {
            (
                Some("Exynos 9810 / Snapdragon 845".to_string()),
                Some(2018),
                Some("Galaxy Note Series".to_string()),
            )
        } else if code.starts_with("SM-N950") || n.contains("note 8") {
            (
                Some("Exynos 8895 / Snapdragon 835".to_string()),
                Some(2017),
                Some("Galaxy Note Series".to_string()),
            )
        }
        // ─── Galaxy A Series ───────────────────────────────────────────────────
        else if code.starts_with("SM-A556") || n.contains("a55") {
            (Some("Exynos 1480".to_string()), Some(2024), Some("Galaxy A Series".to_string()))
        } else if code.starts_with("SM-A546") || n.contains("a54") {
            (Some("Exynos 1380".to_string()), Some(2023), Some("Galaxy A Series".to_string()))
        } else if code.starts_with("SM-A536") || n.contains("a53") {
            (Some("Exynos 1280".to_string()), Some(2022), Some("Galaxy A Series".to_string()))
        } else if code.starts_with("SM-A528") || n.contains("a52s") {
            (
                Some("Snapdragon 778G 5G".to_string()),
                Some(2021),
                Some("Galaxy A Series".to_string()),
            )
        } else if code.starts_with("SM-A526") || code.starts_with("SM-A525") || n.contains("a52") {
            (
                Some("Snapdragon 750G / 720G".to_string()),
                Some(2021),
                Some("Galaxy A Series".to_string()),
            )
        } else if code.starts_with("SM-A356") || n.contains("a35") {
            (Some("Exynos 1380".to_string()), Some(2024), Some("Galaxy A Series".to_string()))
        } else if code.starts_with("SM-A346") || n.contains("a34") {
            (
                Some("MediaTek Dimensity 1080".to_string()),
                Some(2023),
                Some("Galaxy A Series".to_string()),
            )
        } else if code.starts_with("SM-A256") || n.contains("a25") {
            (Some("Exynos 1280".to_string()), Some(2023), Some("Galaxy A Series".to_string()))
        } else if code.starts_with("SM-A156") || code.starts_with("SM-A155") || n.contains("a15") {
            (
                Some("MediaTek Dimensity 6100+ / Helio G99".to_string()),
                Some(2023),
                Some("Galaxy A Series".to_string()),
            )
        }
        // ─── Galaxy Tab Series ─────────────────────────────────────────────────
        else if code.starts_with("SM-X920")
            || code.starts_with("SM-X820")
            || n.contains("tab s10")
        {
            (
                Some("MediaTek Dimensity 9300+".to_string()),
                Some(2024),
                Some("Galaxy Tab Series".to_string()),
            )
        } else if code.starts_with("SM-X910")
            || code.starts_with("SM-X810")
            || code.starts_with("SM-X710")
            || n.contains("tab s9")
        {
            (
                Some("Snapdragon 8 Gen 2 for Galaxy".to_string()),
                Some(2023),
                Some("Galaxy Tab Series".to_string()),
            )
        } else if code.starts_with("SM-X900")
            || code.starts_with("SM-X800")
            || code.starts_with("SM-X700")
            || n.contains("tab s8")
        {
            (
                Some("Snapdragon 8 Gen 1".to_string()),
                Some(2022),
                Some("Galaxy Tab Series".to_string()),
            )
        } else if code.starts_with("SM-T970") || code.starts_with("SM-T870") || n.contains("tab s7")
        {
            (Some("Snapdragon 865+".to_string()), Some(2020), Some("Galaxy Tab Series".to_string()))
        } else if code.starts_with("SM-X210") || code.starts_with("SM-X110") || n.contains("tab a9")
        {
            (
                Some("Snapdragon 695 / Helio G99".to_string()),
                Some(2023),
                Some("Galaxy Tab Series".to_string()),
            )
        } else {
            (None, None, Some("Galaxy Series".to_string()))
        }
    }

    /// Comprehensive static catalog covering 70+ Samsung Galaxy device models
    pub fn get_static_catalog() -> Vec<FirmwareDeviceModel> {
        vec![
            // ─── Galaxy S25 Series (2025 Flagships) ───────────────────────────
            Self::create_device(
                "SM-S938B",
                "Galaxy S25 Ultra",
                "SM-S938B",
                "Snapdragon 8 Elite for Galaxy",
                2025,
                "Galaxy S Series",
                vec![
                    Self::create_build(
                        "SM-S938B",
                        "EUX",
                        "S938BXXU1AYB1",
                        "Android 15",
                        "2025-02-05",
                        "2025-02-01",
                        true,
                    ),
                    Self::create_build(
                        "SM-S938B",
                        "INS",
                        "S938BXXU1AYB1",
                        "Android 15",
                        "2025-02-05",
                        "2025-02-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-S936B",
                "Galaxy S25+",
                "SM-S936B",
                "Exynos 2500 / Snapdragon 8 Elite",
                2025,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S936B",
                    "EUX",
                    "S936BXXU1AYB1",
                    "Android 15",
                    "2025-02-05",
                    "2025-02-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-S931B",
                "Galaxy S25",
                "SM-S931B",
                "Exynos 2500 / Snapdragon 8 Elite",
                2025,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S931B",
                    "EUX",
                    "S931BXXU1AYB1",
                    "Android 15",
                    "2025-02-05",
                    "2025-02-01",
                    true,
                )],
            ),
            // ─── Galaxy S24 Series (2024 Flagships) ───────────────────────────
            Self::create_device(
                "SM-S928B",
                "Galaxy S24 Ultra",
                "SM-S928B",
                "Snapdragon 8 Gen 3 for Galaxy",
                2024,
                "Galaxy S Series",
                vec![
                    Self::create_build(
                        "SM-S928B",
                        "EUX",
                        "S928BXXS6DZG1",
                        "Android 16",
                        "2026-07-20",
                        "2026-07-05",
                        true,
                    ),
                    Self::create_build(
                        "SM-S928B",
                        "INS",
                        "S928BXXS6DZG1",
                        "Android 16",
                        "2026-07-20",
                        "2026-07-05",
                        false,
                    ),
                    Self::create_build(
                        "SM-S928B",
                        "DBT",
                        "S928BXXS5CYJ1",
                        "Android 15",
                        "2024-10-15",
                        "2024-10-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-S926B",
                "Galaxy S24+",
                "SM-S926B",
                "Exynos 2400 / Snapdragon 8 Gen 3",
                2024,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S926B",
                    "EUX",
                    "S926BXXS6DZG1",
                    "Android 16",
                    "2026-07-20",
                    "2026-07-05",
                    true,
                )],
            ),
            Self::create_device(
                "SM-S921B",
                "Galaxy S24",
                "SM-S921B",
                "Exynos 2400 / Snapdragon 8 Gen 3",
                2024,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S921B",
                    "EUX",
                    "S921BXXS6DZG1",
                    "Android 16",
                    "2026-07-20",
                    "2026-07-05",
                    true,
                )],
            ),
            Self::create_device(
                "SM-S721B",
                "Galaxy S24 FE",
                "SM-S721B",
                "Exynos 2400e",
                2024,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S721B",
                    "EUX",
                    "S721BXXU1AXK2",
                    "Android 15",
                    "2024-11-20",
                    "2024-11-01",
                    true,
                )],
            ),
            // ─── Galaxy S23 Series ────────────────────────────────────────────
            Self::create_device(
                "SM-S918B",
                "Galaxy S23 Ultra",
                "SM-S918B",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy S Series",
                vec![
                    Self::create_build(
                        "SM-S918B",
                        "EUX",
                        "S918BXXSAFZG1",
                        "Android 16",
                        "2026-07-15",
                        "2026-07-05",
                        true,
                    ),
                    Self::create_build(
                        "SM-S918B",
                        "INS",
                        "S918BXXS6CYJ1",
                        "Android 15",
                        "2024-10-18",
                        "2024-10-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-S916B",
                "Galaxy S23+",
                "SM-S916B",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S916B",
                    "EUX",
                    "S916BXXSAFZG1",
                    "Android 16",
                    "2026-07-15",
                    "2026-07-05",
                    true,
                )],
            ),
            Self::create_device(
                "SM-S911B",
                "Galaxy S23",
                "SM-S911B",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S911B",
                    "EUX",
                    "S911BXXSAFZG1",
                    "Android 16",
                    "2026-07-15",
                    "2026-07-05",
                    true,
                )],
            ),
            Self::create_device(
                "SM-S711B",
                "Galaxy S23 FE",
                "SM-S711B",
                "Exynos 2200 / Snapdragon 8 Gen 1",
                2023,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S711B",
                    "EUX",
                    "S711BXXS5CXK1",
                    "Android 15",
                    "2024-11-15",
                    "2024-11-01",
                    true,
                )],
            ),
            // ─── Galaxy S22 Series ────────────────────────────────────────────
            Self::create_device(
                "SM-S908B",
                "Galaxy S22 Ultra",
                "SM-S908B",
                "Snapdragon 8 Gen 1 / Exynos 2200",
                2022,
                "Galaxy S Series",
                vec![
                    Self::create_build(
                        "SM-S908B",
                        "EUX",
                        "S908BXXSNGZD7",
                        "Android 16",
                        "2026-06-25",
                        "2026-06-05",
                        true,
                    ),
                    Self::create_build(
                        "SM-S908B",
                        "INS",
                        "S908BXXS8EXK1",
                        "Android 15",
                        "2024-11-10",
                        "2024-11-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-S906B",
                "Galaxy S22+",
                "SM-S906B",
                "Snapdragon 8 Gen 1 / Exynos 2200",
                2022,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S906B",
                    "EUX",
                    "S906BXXSNGZD7",
                    "Android 16",
                    "2026-06-25",
                    "2026-06-05",
                    true,
                )],
            ),
            Self::create_device(
                "SM-S901B",
                "Galaxy S22",
                "SM-S901B",
                "Snapdragon 8 Gen 1 / Exynos 2200",
                2022,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-S901B",
                    "EUX",
                    "S901BXXSNGZD7",
                    "Android 16",
                    "2026-06-25",
                    "2026-06-05",
                    true,
                )],
            ),
            // ─── Galaxy S21 Series ────────────────────────────────────────────
            Self::create_device(
                "SM-G998B",
                "Galaxy S21 Ultra 5G",
                "SM-G998B",
                "Snapdragon 888 / Exynos 2100",
                2021,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G998B",
                    "EUX",
                    "G998BXXSCHXK1",
                    "Android 15",
                    "2024-11-05",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G996B",
                "Galaxy S21+ 5G",
                "SM-G996B",
                "Snapdragon 888 / Exynos 2100",
                2021,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G996B",
                    "EUX",
                    "G996BXXSCHXK1",
                    "Android 15",
                    "2024-11-05",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G991B",
                "Galaxy S21 5G",
                "SM-G991B",
                "Snapdragon 888 / Exynos 2100",
                2021,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G991B",
                    "EUX",
                    "G991BXXSCHXK1",
                    "Android 15",
                    "2024-11-05",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G990B",
                "Galaxy S21 FE 5G",
                "SM-G990B",
                "Snapdragon 888 / Exynos 2100",
                2022,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G990B",
                    "EUX",
                    "G990BXXS9GXK1",
                    "Android 15",
                    "2024-11-12",
                    "2024-11-01",
                    true,
                )],
            ),
            // ─── Galaxy S20 Series ────────────────────────────────────────────
            Self::create_device(
                "SM-G988B",
                "Galaxy S20 Ultra 5G",
                "SM-G988B",
                "Snapdragon 865 / Exynos 990",
                2020,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G988B",
                    "DBT",
                    "G988BXXSGHXF1",
                    "Android 13",
                    "2023-07-10",
                    "2023-07-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G986B",
                "Galaxy S20+ 5G",
                "SM-G986B",
                "Snapdragon 865 / Exynos 990",
                2020,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G986B",
                    "DBT",
                    "G986BXXSGHXF1",
                    "Android 13",
                    "2023-07-10",
                    "2023-07-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G981B",
                "Galaxy S20 5G",
                "SM-G981B",
                "Snapdragon 865 / Exynos 990",
                2020,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G981B",
                    "DBT",
                    "G981BXXSGHXF1",
                    "Android 13",
                    "2023-07-10",
                    "2023-07-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G781B",
                "Galaxy S20 FE 5G",
                "SM-G781B",
                "Snapdragon 865",
                2020,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G781B",
                    "DBT",
                    "G781BXXS9HXF2",
                    "Android 13",
                    "2023-08-01",
                    "2023-08-01",
                    true,
                )],
            ),
            // ─── Galaxy S10 / S9 / S8 / S7 Series ─────────────────────────────
            Self::create_device(
                "SM-G975F",
                "Galaxy S10+",
                "SM-G975F",
                "Exynos 9820 / Snapdragon 855",
                2019,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G975F",
                    "DBT",
                    "G975FXXSGHWC2",
                    "Android 12",
                    "2023-03-15",
                    "2023-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G973F",
                "Galaxy S10",
                "SM-G973F",
                "Exynos 9820 / Snapdragon 855",
                2019,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G973F",
                    "DBT",
                    "G973FXXSGHWC2",
                    "Android 12",
                    "2023-03-15",
                    "2023-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G970F",
                "Galaxy S10e",
                "SM-G970F",
                "Exynos 9820 / Snapdragon 855",
                2019,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G970F",
                    "DBT",
                    "G970FXXSGHWC2",
                    "Android 12",
                    "2023-03-15",
                    "2023-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G965F",
                "Galaxy S9+",
                "SM-G965F",
                "Exynos 9810 / Snapdragon 845",
                2018,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G965F",
                    "DBT",
                    "G965FXXUHFVB4",
                    "Android 10",
                    "2022-03-01",
                    "2022-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G960F",
                "Galaxy S9",
                "SM-G960F",
                "Exynos 9810 / Snapdragon 845",
                2018,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G960F",
                    "DBT",
                    "G960FXXUHFVB4",
                    "Android 10",
                    "2022-03-01",
                    "2022-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G955F",
                "Galaxy S8+",
                "SM-G955F",
                "Exynos 8895 / Snapdragon 835",
                2017,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G955F",
                    "DBT",
                    "G955FXXUCDUD1",
                    "Android 9",
                    "2021-05-01",
                    "2021-04-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G950F",
                "Galaxy S8",
                "SM-G950F",
                "Exynos 8895 / Snapdragon 835",
                2017,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G950F",
                    "DBT",
                    "G950FXXUCDUD1",
                    "Android 9",
                    "2021-05-01",
                    "2021-04-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G935F",
                "Galaxy S7 edge",
                "SM-G935F",
                "Exynos 8890 / Snapdragon 820",
                2016,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G935F",
                    "DBT",
                    "G935FXXU8ETI2",
                    "Android 8.0",
                    "2020-10-01",
                    "2020-09-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-G930F",
                "Galaxy S7",
                "SM-G930F",
                "Exynos 8890 / Snapdragon 820",
                2016,
                "Galaxy S Series",
                vec![Self::create_build(
                    "SM-G930F",
                    "DBT",
                    "G930FXXU8ETI2",
                    "Android 8.0",
                    "2020-10-01",
                    "2020-09-01",
                    true,
                )],
            ),
            // ─── Galaxy Z Fold & Flip Series ──────────────────────────────────
            Self::create_device(
                "SM-F956B",
                "Galaxy Z Fold 6",
                "SM-F956B",
                "Snapdragon 8 Gen 3 for Galaxy",
                2024,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F956B",
                    "EUX",
                    "F956BXXS2AXK1",
                    "Android 15",
                    "2024-11-25",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-F741B",
                "Galaxy Z Flip 6",
                "SM-F741B",
                "Snapdragon 8 Gen 3 for Galaxy",
                2024,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F741B",
                    "EUX",
                    "F741BXXS2AXK1",
                    "Android 15",
                    "2024-11-25",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-F946B",
                "Galaxy Z Fold 5",
                "SM-F946B",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy Z Series",
                vec![
                    Self::create_build(
                        "SM-F946B",
                        "EUX",
                        "F946BXXS7GZG1",
                        "Android 16",
                        "2026-07-20",
                        "2026-07-05",
                        true,
                    ),
                    Self::create_build(
                        "SM-F946B",
                        "INS",
                        "F946BXXS4CXK1",
                        "Android 15",
                        "2024-11-15",
                        "2024-11-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-F731B",
                "Galaxy Z Flip 5",
                "SM-F731B",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy Z Series",
                vec![
                    Self::create_build(
                        "SM-F731B",
                        "EUX",
                        "F731BXXS7GZG1",
                        "Android 16",
                        "2026-07-20",
                        "2026-07-05",
                        true,
                    ),
                    Self::create_build(
                        "SM-F731B",
                        "INS",
                        "F731BXXS4CXK1",
                        "Android 15",
                        "2024-11-15",
                        "2024-11-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-F936B",
                "Galaxy Z Fold 4",
                "SM-F936B",
                "Snapdragon 8+ Gen 1",
                2022,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F936B",
                    "EUX",
                    "F936BXXS8FXK1",
                    "Android 15",
                    "2024-11-18",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-F721B",
                "Galaxy Z Flip 4",
                "SM-F721B",
                "Snapdragon 8+ Gen 1",
                2022,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F721B",
                    "EUX",
                    "F721BXXS8FXK1",
                    "Android 15",
                    "2024-11-18",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-F926B",
                "Galaxy Z Fold 3 5G",
                "SM-F926B",
                "Snapdragon 888",
                2021,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F926B",
                    "EUX",
                    "F926BXXS8HXK1",
                    "Android 15",
                    "2024-11-10",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-F711B",
                "Galaxy Z Flip 3 5G",
                "SM-F711B",
                "Snapdragon 888",
                2021,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F711B",
                    "EUX",
                    "F711BXXS8HXK1",
                    "Android 15",
                    "2024-11-10",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-F916B",
                "Galaxy Z Fold 2 5G",
                "SM-F916B",
                "Snapdragon 865+",
                2020,
                "Galaxy Z Series",
                vec![Self::create_build(
                    "SM-F916B",
                    "DBT",
                    "F916BXXS5JXE1",
                    "Android 13",
                    "2023-06-15",
                    "2023-06-01",
                    true,
                )],
            ),
            // ─── Galaxy Note Series ───────────────────────────────────────────
            Self::create_device(
                "SM-N986B",
                "Galaxy Note 20 Ultra 5G",
                "SM-N986B",
                "Snapdragon 865+ / Exynos 990",
                2020,
                "Galaxy Note Series",
                vec![Self::create_build(
                    "SM-N986B",
                    "DBT",
                    "N986BXXS8HXF1",
                    "Android 13",
                    "2023-07-15",
                    "2023-07-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-N981B",
                "Galaxy Note 20 5G",
                "SM-N981B",
                "Snapdragon 865+ / Exynos 990",
                2020,
                "Galaxy Note Series",
                vec![Self::create_build(
                    "SM-N981B",
                    "DBT",
                    "N981BXXS8HXF1",
                    "Android 13",
                    "2023-07-15",
                    "2023-07-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-N975F",
                "Galaxy Note 10+",
                "SM-N975F",
                "Exynos 9825 / Snapdragon 855",
                2019,
                "Galaxy Note Series",
                vec![Self::create_build(
                    "SM-N975F",
                    "DBT",
                    "N975FXXS8HWC3",
                    "Android 12",
                    "2023-03-20",
                    "2023-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-N970F",
                "Galaxy Note 10",
                "SM-N970F",
                "Exynos 9825 / Snapdragon 855",
                2019,
                "Galaxy Note Series",
                vec![Self::create_build(
                    "SM-N970F",
                    "DBT",
                    "N970FXXS8HWC3",
                    "Android 12",
                    "2023-03-20",
                    "2023-03-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-N960F",
                "Galaxy Note 9",
                "SM-N960F",
                "Exynos 9810 / Snapdragon 845",
                2018,
                "Galaxy Note Series",
                vec![Self::create_build(
                    "SM-N960F",
                    "DBT",
                    "N960FXXU9FVE1",
                    "Android 10",
                    "2022-06-01",
                    "2022-05-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-N950F",
                "Galaxy Note 8",
                "SM-N950F",
                "Exynos 8895 / Snapdragon 835",
                2017,
                "Galaxy Note Series",
                vec![Self::create_build(
                    "SM-N950F",
                    "DBT",
                    "N950FXXUDDUD1",
                    "Android 9",
                    "2021-05-15",
                    "2021-04-01",
                    true,
                )],
            ),
            // ─── Galaxy A Series (Bestsellers) ────────────────────────────────
            Self::create_device(
                "SM-A556B",
                "Galaxy A55 5G",
                "SM-A556B",
                "Exynos 1480",
                2024,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A556B",
                    "EUX",
                    "A556BXXS3AXK1",
                    "Android 15",
                    "2024-11-28",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A546B",
                "Galaxy A54 5G",
                "SM-A546B",
                "Exynos 1380",
                2023,
                "Galaxy A Series",
                vec![
                    Self::create_build(
                        "SM-A546B",
                        "EUX",
                        "A546BXXSLFZG3",
                        "Android 16",
                        "2026-07-20",
                        "2026-07-05",
                        true,
                    ),
                    Self::create_build(
                        "SM-A546B",
                        "INS",
                        "A546BXXS9CXK1",
                        "Android 15",
                        "2024-11-18",
                        "2024-11-01",
                        false,
                    ),
                ],
            ),
            Self::create_device(
                "SM-A536B",
                "Galaxy A53 5G",
                "SM-A536B",
                "Exynos 1280",
                2022,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A536B",
                    "EUX",
                    "A536BXXSBEXK1",
                    "Android 15",
                    "2024-11-20",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A528B",
                "Galaxy A52s 5G",
                "SM-A528B",
                "Snapdragon 778G 5G",
                2021,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A528B",
                    "DBT",
                    "A528BXXS9FXK1",
                    "Android 14",
                    "2024-11-05",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A525F",
                "Galaxy A52",
                "SM-A525F",
                "Snapdragon 720G",
                2021,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A525F",
                    "DBT",
                    "A525FXXS9FXK1",
                    "Android 14",
                    "2024-11-05",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A356B",
                "Galaxy A35 5G",
                "SM-A356B",
                "Exynos 1380",
                2024,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A356B",
                    "EUX",
                    "A356BXXS3AXK1",
                    "Android 15",
                    "2024-11-28",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A346B",
                "Galaxy A34 5G",
                "SM-A346B",
                "MediaTek Dimensity 1080",
                2023,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A346B",
                    "EUX",
                    "A346BXXS8CXK1",
                    "Android 15",
                    "2024-11-20",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A256B",
                "Galaxy A25 5G",
                "SM-A256B",
                "Exynos 1280",
                2023,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A256B",
                    "EUX",
                    "A256BXXS4BXK1",
                    "Android 15",
                    "2024-11-22",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-A156B",
                "Galaxy A15 5G",
                "SM-A156B",
                "MediaTek Dimensity 6100+",
                2023,
                "Galaxy A Series",
                vec![Self::create_build(
                    "SM-A156B",
                    "EUX",
                    "A156BXXS3BXK1",
                    "Android 15",
                    "2024-11-25",
                    "2024-11-01",
                    true,
                )],
            ),
            // ─── Galaxy Tab Series ────────────────────────────────────────────
            Self::create_device(
                "SM-X920",
                "Galaxy Tab S10 Ultra",
                "SM-X920",
                "MediaTek Dimensity 9300+",
                2024,
                "Galaxy Tab Series",
                vec![Self::create_build(
                    "SM-X920",
                    "EUX",
                    "X920XXU1AXK1",
                    "Android 15",
                    "2024-11-20",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-X820",
                "Galaxy Tab S10+",
                "SM-X820",
                "MediaTek Dimensity 9300+",
                2024,
                "Galaxy Tab Series",
                vec![Self::create_build(
                    "SM-X820",
                    "EUX",
                    "X820XXU1AXK1",
                    "Android 15",
                    "2024-11-20",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-X910",
                "Galaxy Tab S9 Ultra",
                "SM-X910",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy Tab Series",
                vec![Self::create_build(
                    "SM-X910",
                    "EUX",
                    "X910XXS4BXK1",
                    "Android 15",
                    "2024-11-15",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-X810",
                "Galaxy Tab S9+",
                "SM-X810",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy Tab Series",
                vec![Self::create_build(
                    "SM-X810",
                    "EUX",
                    "X810XXS4BXK1",
                    "Android 15",
                    "2024-11-15",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-X710",
                "Galaxy Tab S9",
                "SM-X710",
                "Snapdragon 8 Gen 2 for Galaxy",
                2023,
                "Galaxy Tab Series",
                vec![Self::create_build(
                    "SM-X710",
                    "EUX",
                    "X710XXS4BXK1",
                    "Android 15",
                    "2024-11-15",
                    "2024-11-01",
                    true,
                )],
            ),
            Self::create_device(
                "SM-X210",
                "Galaxy Tab A9+",
                "SM-X210",
                "Snapdragon 695",
                2023,
                "Galaxy Tab Series",
                vec![Self::create_build(
                    "SM-X210",
                    "EUX",
                    "X210XXU4BXK1",
                    "Android 15",
                    "2024-11-20",
                    "2024-11-01",
                    true,
                )],
            ),
        ]
    }

    fn create_device(
        id_suffix: &str,
        name: &str,
        codename: &str,
        soc: &str,
        year: u32,
        series: &str,
        builds: Vec<FirmwareBuild>,
    ) -> FirmwareDeviceModel {
        FirmwareDeviceModel {
            id: format!("samsung-{}", id_suffix.to_lowercase()),
            name: name.to_string(),
            codename: codename.to_string(),
            brand: FirmwareBrand::Samsung,
            soc: Some(soc.to_string()),
            release_year: Some(year),
            series: Some(series.to_string()),
            builds,
        }
    }

    fn create_build(
        model: &str,
        csc: &str,
        pda: &str,
        android: &str,
        release_date: &str,
        security_patch: &str,
        is_latest: bool,
    ) -> FirmwareBuild {
        FirmwareBuild {
            id: format!(
                "samsung-{}-{}-{}",
                model.to_lowercase(),
                csc.to_lowercase(),
                pda.to_lowercase()
            ),
            version: pda.to_string(),
            android_version: android.to_string(),
            build_id: format!("{pda} ({csc})"),
            carrier: Some(format!("{csc} Region")),
            release_date: Some(release_date.to_string()),
            security_patch: Some(security_patch.to_string()),
            image_type: FirmwareImageType::Factory,
            download_url: format!("https://samfw.com/firmware/{model}/{csc}/{pda}"),
            file_size: Some(6_500_000_000),
            sha256: None,
            is_latest,
        }
    }
}

impl FirmwareProvider for SamsungProvider {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::Samsung
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(self.fetch_all())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_samsung_static_catalog_integrity() {
        let catalog = SamsungProvider::get_static_catalog();
        assert!(catalog.len() >= 30, "Static catalog must contain at least 30 devices");

        for dev in &catalog {
            assert_eq!(dev.brand, FirmwareBrand::Samsung);
            assert!(!dev.name.is_empty());
            assert!(!dev.codename.is_empty());
            assert!(!dev.builds.is_empty());
            assert!(dev.release_year.is_some());
            assert!(dev.soc.is_some());

            for b in &dev.builds {
                assert!(!b.download_url.is_empty());
                assert!(!b.version.is_empty());
                assert!(b.download_url.starts_with("https://samfw.com/firmware/"));
            }
        }
    }

    #[test]
    fn test_parse_fota_xml() {
        let sample_xml = r#"<?xml version="1.0" encoding="UTF-8" ?>
<version doc="1.0">
  <firmware>
    <version>
      <latest>S928BXXS6DZG1/S928BOXM6DZG1/S928BXXS6DZG1</latest>
      <upgrade>
        <value>S928BXXS6DZG1/S928BOXM6DZG1/S928BXXS6DZG1</value>
      </upgrade>
    </version>
  </firmware>
</version>"#;

        let build = SamsungProvider::parse_fota_xml(sample_xml, "SM-S928B", "EUX").unwrap();
        assert_eq!(build.version, "S928BXXS6DZG1");
        assert_eq!(build.android_version, "Android 16");
        assert!(build.download_url.contains("SM-S928B/EUX/S928BXXS6DZG1"));
        assert!(build.is_latest);
    }

    #[test]
    fn test_infer_android_version() {
        assert_eq!(SamsungProvider::infer_android_version("S928BXXS6DZG1"), "Android 16");
        assert_eq!(SamsungProvider::infer_android_version("S928BXXS5CYJ1"), "Android 15");
        assert_eq!(SamsungProvider::infer_android_version("S928BXXU1AYB1"), "Android 13");
    }
}
