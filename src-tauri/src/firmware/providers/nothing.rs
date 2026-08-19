use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use scraper::{ElementRef, Html, Selector};

use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

const NOTHING_ARCHIVE_URL: &str = "https://nothingarchive.tech/docs/firmware";
const USER_AGENT_STR: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

pub struct NothingProvider {
    client: reqwest::Client,
}

impl Default for NothingProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl NothingProvider {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        if let Ok(val) = HeaderValue::from_str(USER_AGENT_STR) {
            headers.insert(USER_AGENT, val);
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap_or_default();

        Self { client }
    }

    pub fn with_client(client: reqwest::Client) -> Self {
        Self { client }
    }

    /// Fetch and parse the live catalog from nothingarchive.tech
    pub async fn fetch_all(&self) -> Result<Vec<FirmwareDeviceModel>, String> {
        let response = match self.client.get(NOTHING_ARCHIVE_URL).send().await {
            Ok(resp) => resp,
            Err(e) => {
                log::warn!("Failed to fetch nothingarchive.tech ({e}), using fallback catalog");
                return Ok(Self::get_static_catalog());
            }
        };

        if !response.status().is_success() {
            log::warn!(
                "nothingarchive.tech returned status {}, using fallback catalog",
                response.status()
            );
            return Ok(Self::get_static_catalog());
        }

        let html_content = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                log::warn!("Failed to read nothingarchive.tech HTML ({e}), using fallback catalog");
                return Ok(Self::get_static_catalog());
            }
        };

        let models = Self::parse_html(&html_content);
        if models.is_empty() {
            log::warn!("Scraped 0 Nothing devices, using fallback catalog");
            return Ok(Self::get_static_catalog());
        }

        Ok(models)
    }

    /// Parse HTML from nothingarchive.tech into structured device models
    pub fn parse_html(html: &str) -> Vec<FirmwareDeviceModel> {
        let document = Html::parse_document(html);

        let Ok(details_sel) = Selector::parse("details") else {
            return Vec::new();
        };
        let Ok(summary_sel) = Selector::parse("summary") else {
            return Vec::new();
        };
        let Ok(title_span_sel) = Selector::parse("span.summary-title") else {
            return Vec::new();
        };
        let Ok(subtitle_span_sel) = Selector::parse("span.summary-subtitle") else {
            return Vec::new();
        };
        let Ok(table_sel) = Selector::parse("table") else {
            return Vec::new();
        };
        let Ok(tr_sel) = Selector::parse("tbody tr, tr") else {
            return Vec::new();
        };
        let Ok(td_sel) = Selector::parse("td, th") else {
            return Vec::new();
        };
        let Ok(a_sel) = Selector::parse("a[href]") else {
            return Vec::new();
        };

        let mut devices = Vec::new();

        for details in document.select(&details_sel) {
            let Some(summary) = details.select(&summary_sel).next() else {
                continue;
            };
            let title_text = summary.select(&title_span_sel).next().map_or_else(
                || summary.text().collect::<String>(),
                |s| s.text().collect::<String>(),
            );

            let subtitle_text = summary
                .select(&subtitle_span_sel)
                .next()
                .map(|s| s.text().collect::<String>())
                .unwrap_or_default();

            let trimmed_title = title_text.trim();
            if trimmed_title.contains("Categorization")
                || trimmed_title.contains("Nothing Devices")
                || trimmed_title.contains("CMF by Nothing Devices")
            {
                continue;
            }

            let Some(table) = details.select(&table_sel).next() else {
                continue;
            };

            let meta = get_nothing_device_meta(&subtitle_text, trimmed_title);
            let mut builds = Vec::new();

            for tr in table.select(&tr_sel) {
                let cells: Vec<ElementRef> = tr.select(&td_sel).collect();
                if cells.len() < 2 {
                    continue;
                }

                let version_raw = extract_cell_first_text(&cells[0]);
                let build_id_raw = extract_cell_first_text(&cells[1]);

                if version_raw.is_empty() || build_id_raw.is_empty() {
                    continue;
                }

                // Clean version & build ID
                let version =
                    version_raw.split('(').next().unwrap_or(&version_raw).trim().to_string();
                let build_id =
                    build_id_raw.split('(').next().unwrap_or(&build_id_raw).trim().to_string();

                if build_id.eq_ignore_ascii_case("build number") {
                    continue;
                }

                // Extract Full OTA link from cell 3
                let mut full_ota_url = None;
                if cells.len() >= 4 {
                    for a in cells[3].select(&a_sel) {
                        if let Some(href) = a.value().attr("href") {
                            let h = href.trim();
                            if !h.is_empty()
                                && (h.starts_with("http://") || h.starts_with("https://"))
                            {
                                full_ota_url = Some(h.to_string());
                                break;
                            }
                        }
                    }
                }

                // Extract Incremental OTA link from cell 2
                let mut inc_ota_url = None;
                if cells.len() >= 3 {
                    for a in cells[2].select(&a_sel) {
                        if let Some(href) = a.value().attr("href") {
                            let h = href.trim();
                            if !h.is_empty()
                                && (h.starts_with("http://") || h.starts_with("https://"))
                            {
                                inc_ota_url = Some(h.to_string());
                                break;
                            }
                        }
                    }
                }

                // Extract GitHub OTA Image release from cell 4
                let mut ota_image_url = None;
                if cells.len() >= 5 {
                    for a in cells[4].select(&a_sel) {
                        if let Some(href) = a.value().attr("href") {
                            let h = href.trim();
                            if !h.is_empty()
                                && (h.starts_with("http://") || h.starts_with("https://"))
                            {
                                ota_image_url = Some(h.to_string());
                                break;
                            }
                        }
                    }
                }

                let is_full = full_ota_url.is_some();
                let download_url =
                    full_ota_url.or(inc_ota_url).or(ota_image_url).unwrap_or_default();

                if download_url.is_empty() {
                    continue;
                }

                let (android_version, release_date) = parse_build_metadata(&build_id);

                let id = format!(
                    "nothing-{}-{}-{}",
                    meta.codename,
                    version.replace(' ', "-").to_ascii_lowercase(),
                    build_id.to_ascii_lowercase()
                );

                builds.push(FirmwareBuild {
                    id,
                    version: format!("Nothing OS {version}"),
                    android_version,
                    build_id: build_id.clone(),
                    carrier: if is_full {
                        Some("Full OTA".to_string())
                    } else {
                        Some("Incremental OTA".to_string())
                    },
                    release_date,
                    security_patch: None,
                    image_type: FirmwareImageType::Ota,
                    download_url,
                    file_size: None,
                    sha256: None,
                    is_latest: false,
                });
            }

            if !builds.is_empty() {
                // Mark the latest build
                builds[0].is_latest = true;

                let id = format!("nothing-{}", meta.codename);
                devices.push(FirmwareDeviceModel {
                    id,
                    name: meta.name.to_string(),
                    codename: meta.codename.to_string(),
                    brand: FirmwareBrand::Nothing,
                    soc: Some(meta.soc.to_string()),
                    release_year: Some(meta.release_year),
                    series: Some(meta.series.to_string()),
                    builds,
                });
            }
        }

        devices
    }

    /// Fallback static catalog when offline
    pub fn get_static_catalog() -> Vec<FirmwareDeviceModel> {
        vec![
            FirmwareDeviceModel {
                id: "nothing-metroid".into(),
                name: "Nothing Phone (3)".into(),
                codename: "metroid".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 8s Gen 3 / 8s Gen 4 (SM8735)".into()),
                release_year: Some(2025),
                series: Some("Phone (3)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-metroid-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Metroid-B4.1-260814-1733".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-08-14".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/2a52b639be641edff7fb07fac5d645503acd14bc.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-pong".into(),
                name: "Nothing Phone (2)".into(),
                codename: "pong".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 8+ Gen 1 (SM8475)".into()),
                release_year: Some(2023),
                series: Some("Phone (2)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-pong-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Pong-B4.1-260618-1026".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-06-18".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/821762bba7df49d1648ab91eef5c98574f20e740.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-spacewar".into(),
                name: "Nothing Phone (1)".into(),
                codename: "spacewar".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 778G+ (SM7325-AE)".into()),
                release_year: Some(2022),
                series: Some("Phone (1)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-spacewar-3.2".into(),
                        version: "Nothing OS 3.2".into(),
                        android_version: "Android 15".into(),
                        build_id: "Spacewar-V3.2-260618-1045".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-06-18".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/ee806849b191862527abd847e12a5e2b301517c0.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-froggerpro".into(),
                name: "Nothing Phone (4a) Pro".into(),
                codename: "froggerpro".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 7+ Gen 3 / 8s Gen 3 (SM7750)".into()),
                release_year: Some(2026),
                series: Some("Phone (4a) Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-froggerpro-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "FroggerPro-B4.1-260723-1820".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-07-23".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/68fa1460f38f5d3739cd0d178061be4a8e62e038.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-frogger".into(),
                name: "Nothing Phone (4a)".into(),
                codename: "frogger".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 7s Gen 3 (SM7635)".into()),
                release_year: Some(2026),
                series: Some("Phone (4a) Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-frogger-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Frogger-B4.1-260808-1352".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-08-08".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/8410269f8c6d17b4c2b9f3900b97940e74e4c2be.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-asteroids".into(),
                name: "Nothing Phone (3a) & (3a) Pro".into(),
                codename: "asteroids".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 7s Gen 3 (SM7635)".into()),
                release_year: Some(2025),
                series: Some("Phone (3a) Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-asteroids-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Asteroids-B4.1-260810-1153".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-08-10".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/cd06a8e76f79f0fa02b826f8fb8aa4a4bd796429.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-pacmanpro".into(),
                name: "Nothing Phone (2a) Plus".into(),
                codename: "pacmanpro".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7350 Pro (MT6886)".into()),
                release_year: Some(2024),
                series: Some("Phone (2a) Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-pacmanpro-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "PacmanPro-B4.1-260609-1926".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-06-09".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/b9094a25e3eb73313f1d9f85f4e066e7a65d9ce3.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-pacman".into(),
                name: "Nothing Phone (2a)".into(),
                codename: "pacman".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7200 Pro (MT6886)".into()),
                release_year: Some(2024),
                series: Some("Phone (2a) Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-pacman-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Pacman-B4.1-260609-1925".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-06-09".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/f51817177faff37c4a6aa0be04f7ffe690f79150.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-supercontra".into(),
                name: "Nothing Phone (4b)".into(),
                codename: "supercontra".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon SM-series".into()),
                release_year: Some(2026),
                series: Some("Phone (4b)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-supercontra-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "SuperContra-B4.1-260811-1606".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-08-11".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/60cc94aeae79e3afa31013237603a3ba603ed380.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-galaxian".into(),
                name: "Nothing Phone (3a) Lite".into(),
                codename: "galaxian".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7300 (MT6878)".into()),
                release_year: Some(2025),
                series: Some("Phone (3a) Series".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-galaxian-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Galaxian-B4.1-260702-1815".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-07-02".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/3095bfeb0a93fa915e21e8bcb1b50b0e4624400b.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-galaga".into(),
                name: "CMF Phone (2) Pro".into(),
                codename: "galaga".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7300 Pro (MT6878)".into()),
                release_year: Some(2025),
                series: Some("CMF by Nothing".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-galaga-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Galaga-B4.1-260615-1653".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-06-15".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/be9f18a33428eb63d616f7bc01d2a7bef494ea5d.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-tetris".into(),
                name: "CMF Phone (1)".into(),
                codename: "tetris".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7300 (MT6878)".into()),
                release_year: Some(2024),
                series: Some("CMF by Nothing".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "nothing-tetris-4.1".into(),
                        version: "Nothing OS 4.1".into(),
                        android_version: "Android 16".into(),
                        build_id: "Tetris-B4.1-260615-1652".into(),
                        carrier: Some("Full OTA".into()),
                        release_date: Some("2026-06-15".into()),
                        security_patch: None,
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/fe1ba8361a2e55a36825763af51942b5d91c9ba2.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
        ]
    }
}

impl FirmwareProvider for NothingProvider {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::Nothing
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(async move { self.fetch_all().await })
    }
}

struct NothingDeviceMeta {
    name: &'static str,
    codename: &'static str,
    series: &'static str,
    soc: &'static str,
    release_year: u32,
}

fn get_nothing_device_meta(codename: &str, summary_title: &str) -> NothingDeviceMeta {
    let lower_codename = codename.to_ascii_lowercase();
    let lower_title = summary_title.to_ascii_lowercase();

    if lower_codename.contains("spacewar")
        || (lower_title.contains("phone (1)") && !lower_title.contains("cmf"))
    {
        NothingDeviceMeta {
            name: "Nothing Phone (1)",
            codename: "spacewar",
            series: "Phone (1)",
            soc: "Qualcomm Snapdragon 778G+ (SM7325-AE)",
            release_year: 2022,
        }
    } else if lower_codename.contains("pong")
        || (lower_title.contains("phone (2)")
            && !lower_title.contains("pro")
            && !lower_title.contains("(2a)"))
    {
        NothingDeviceMeta {
            name: "Nothing Phone (2)",
            codename: "pong",
            series: "Phone (2)",
            soc: "Qualcomm Snapdragon 8+ Gen 1 (SM8475)",
            release_year: 2023,
        }
    } else if lower_codename.contains("pacmanpro") || lower_title.contains("phone (2a) plus") {
        NothingDeviceMeta {
            name: "Nothing Phone (2a) Plus",
            codename: "pacmanpro",
            series: "Phone (2a) Series",
            soc: "MediaTek Dimensity 7350 Pro (MT6886)",
            release_year: 2024,
        }
    } else if lower_codename.contains("pacman") || lower_title.contains("phone (2a)") {
        NothingDeviceMeta {
            name: "Nothing Phone (2a)",
            codename: "pacman",
            series: "Phone (2a) Series",
            soc: "MediaTek Dimensity 7200 Pro (MT6886)",
            release_year: 2024,
        }
    } else if lower_codename.contains("metroid")
        || (lower_title.contains("phone (3)") && !lower_title.contains("(3a)"))
    {
        NothingDeviceMeta {
            name: "Nothing Phone (3)",
            codename: "metroid",
            series: "Phone (3)",
            soc: "Qualcomm Snapdragon 8s Gen 3 / 8s Gen 4 (SM8735)",
            release_year: 2025,
        }
    } else if lower_codename.contains("asteroids")
        || (lower_title.contains("phone (3a)") && !lower_title.contains("lite"))
    {
        NothingDeviceMeta {
            name: "Nothing Phone (3a) & (3a) Pro",
            codename: "asteroids",
            series: "Phone (3a) Series",
            soc: "Qualcomm Snapdragon 7s Gen 3 (SM7635)",
            release_year: 2025,
        }
    } else if lower_codename.contains("galaxian") || lower_title.contains("phone (3a) lite") {
        NothingDeviceMeta {
            name: "Nothing Phone (3a) Lite",
            codename: "galaxian",
            series: "Phone (3a) Series",
            soc: "MediaTek Dimensity 7300 (MT6878)",
            release_year: 2025,
        }
    } else if lower_codename.contains("froggerpro") || lower_title.contains("phone (4a) pro") {
        NothingDeviceMeta {
            name: "Nothing Phone (4a) Pro",
            codename: "froggerpro",
            series: "Phone (4a) Series",
            soc: "Qualcomm Snapdragon 7+ Gen 3 / 8s Gen 3 (SM7750)",
            release_year: 2026,
        }
    } else if lower_codename.contains("frogger") || lower_title.contains("phone (4a)") {
        NothingDeviceMeta {
            name: "Nothing Phone (4a)",
            codename: "frogger",
            series: "Phone (4a) Series",
            soc: "Qualcomm Snapdragon 7s Gen 3 (SM7635)",
            release_year: 2026,
        }
    } else if lower_codename.contains("supercontra") || lower_title.contains("phone (4b)") {
        NothingDeviceMeta {
            name: "Nothing Phone (4b)",
            codename: "supercontra",
            series: "Phone (4b)",
            soc: "Qualcomm Snapdragon SM-series",
            release_year: 2026,
        }
    } else if lower_codename.contains("tetris")
        || (lower_title.contains("cmf") && lower_title.contains("phone (1)"))
    {
        NothingDeviceMeta {
            name: "CMF Phone (1)",
            codename: "tetris",
            series: "CMF by Nothing",
            soc: "MediaTek Dimensity 7300 (MT6878)",
            release_year: 2024,
        }
    } else if lower_codename.contains("galaga")
        || (lower_title.contains("cmf") && lower_title.contains("phone (2)"))
    {
        NothingDeviceMeta {
            name: "CMF Phone (2) Pro",
            codename: "galaga",
            series: "CMF by Nothing",
            soc: "MediaTek Dimensity 7300 Pro (MT6878)",
            release_year: 2025,
        }
    } else {
        NothingDeviceMeta {
            name: "Nothing Device",
            codename: "nothing",
            series: "Nothing Phone",
            soc: "ARM64 SoC",
            release_year: 2024,
        }
    }
}

/// Extract clean text from a cell while ignoring sr-only context strings
fn extract_cell_first_text(cell: &ElementRef) -> String {
    for child in cell.children() {
        if let Some(text_node) = child.value().as_text() {
            let t = text_node.trim();
            if !t.is_empty() {
                return t.to_string();
            }
        }
    }
    cell.text().collect::<String>().trim().to_string()
}

/// Parse Android version and release date from a build ID string
fn parse_build_metadata(build_id: &str) -> (String, Option<String>) {
    // E.g. Metroid-B4.1-260814-1733, Pong-V3.2-250917-1451, Pacman-U2.6-241021-2253
    let mut android_version = "Android 15".to_string();
    let mut release_date = None;

    let parts: Vec<&str> = build_id.split('-').collect();
    if parts.len() >= 3 {
        let version_tag = parts[1]; // e.g. B4.1, V3.5, U2.6, T2.0, S1.1
        if let Some(first_char) = version_tag.chars().next() {
            android_version = match first_char {
                'B' | 'b' => "Android 16".to_string(),
                'V' | 'v' => "Android 15".to_string(),
                'U' | 'u' => "Android 14".to_string(),
                'T' | 't' => "Android 13".to_string(),
                'S' | 's' => "Android 12".to_string(),
                _ => "Android".to_string(),
            };
        }

        let date_tag = parts[2]; // e.g. 260814 -> 2026-08-14
        if date_tag.len() == 6 && date_tag.chars().all(|c| c.is_ascii_digit()) {
            let yy = &date_tag[0..2];
            let mm = &date_tag[2..4];
            let dd = &date_tag[4..6];
            release_date = Some(format!("20{yy}-{mm}-{dd}"));
        }
    }

    (android_version, release_date)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_nothing_build_metadata() {
        let (android_v, date) = parse_build_metadata("Metroid-B4.1-260814-1733");
        assert_eq!(android_v, "Android 16");
        assert_eq!(date, Some("2026-08-14".to_string()));

        let (android_v, date) = parse_build_metadata("Pong-T2.0-231024-2214");
        assert_eq!(android_v, "Android 13");
        assert_eq!(date, Some("2023-10-24".to_string()));

        let (android_v, date) = parse_build_metadata("Pacman-U2.6-241021-2253");
        assert_eq!(android_v, "Android 14");
        assert_eq!(date, Some("2024-10-21".to_string()));
    }

    #[test]
    fn test_parse_nothing_html_sample() {
        let html_sample = r#"
        <details>
            <summary>
                <span class="summary-title">Phone (3)</span>
                <span class="summary-subtitle">Metroid</span>
            </summary>
            <table>
                <tbody>
                    <tr>
                        <td>4.1</td>
                        <td>Metroid-B4.1-260814-1733</td>
                        <td><a href="https://android.googleapis.com/packages/ota-api/package/2a52b639be641edff7fb07fac5d645503acd14bc.zip">Metroid_B4.1-260814-1733</a></td>
                        <td>N/A</td>
                        <td><a href="https://github.com/spike0en/nothing_archive/releases/tag/Metroid_B4.1-260814-1733">GitHub</a></td>
                    </tr>
                    <tr>
                        <td>4.1</td>
                        <td>Metroid-B4.1-260603-1221</td>
                        <td><a href="https://android.googleapis.com/packages/ota-api/package/c910ab569b4ffce6fabfa2dc7880fd73d96c09be.zip">Metroid_B4.1-260603-1221</a></td>
                        <td><a href="https://android.googleapis.com/packages/ota-api/package/61c7a3d14cc1531ea7c8681b7388531d8c0a7a5f.zip">Google</a></td>
                        <td><a href="https://github.com/spike0en/nothing_archive/releases/tag/Metroid_B4.1-260603-1221">GitHub</a></td>
                    </tr>
                </tbody>
            </table>
        </details>
        "#;

        let models = NothingProvider::parse_html(html_sample);
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].name, "Nothing Phone (3)");
        assert_eq!(models[0].codename, "metroid");
        assert_eq!(models[0].builds.len(), 2);
        assert!(models[0].builds[0].is_latest);
        assert_eq!(models[0].builds[0].version, "Nothing OS 4.1");
        assert_eq!(models[0].builds[0].android_version, "Android 16");
        assert_eq!(models[0].builds[0].release_date, Some("2026-08-14".to_string()));
        assert_eq!(models[0].builds[1].carrier, Some("Full OTA".to_string()));
    }
}
