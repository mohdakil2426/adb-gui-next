use std::collections::HashMap;

use reqwest::header::{COOKIE, HeaderMap, HeaderValue, USER_AGENT};
use scraper::{ElementRef, Html, Selector};

use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

const FACTORY_URL: &str = "https://developers.google.com/android/images";
const OTA_URL: &str = "https://developers.google.com/android/ota";
const TOS_COOKIE: &str = "devsite_wall_acks=nexus-image-tos,nexus-ota-tos";
const USER_AGENT_STR: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

pub struct GooglePixelScraper {
    client: reqwest::Client,
}

impl Default for GooglePixelScraper {
    fn default() -> Self {
        Self::new()
    }
}

impl GooglePixelScraper {
    pub fn new() -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, HeaderValue::from_static(TOS_COOKIE));
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_STR));

        let client =
            reqwest::Client::builder().default_headers(headers).build().unwrap_or_default();

        Self { client }
    }

    pub fn with_client(client: reqwest::Client) -> Self {
        Self { client }
    }

    /// Fetch and parse both Factory and OTA catalogs, merging builds by device codename.
    pub async fn fetch_all(&self) -> Result<Vec<FirmwareDeviceModel>, String> {
        let (factory_res, ota_res) = tokio::join!(
            self.fetch_page(FACTORY_URL, FirmwareImageType::Factory),
            self.fetch_page(OTA_URL, FirmwareImageType::Ota)
        );

        let factory_devices = factory_res?;
        let ota_devices = ota_res?;

        let merged = Self::merge_catalogs(factory_devices, ota_devices);
        Ok(merged)
    }

    async fn fetch_page(
        &self,
        url: &str,
        image_type: FirmwareImageType,
    ) -> Result<Vec<FirmwareDeviceModel>, String> {
        let response = self
            .client
            .get(url)
            .header(COOKIE, TOS_COOKIE)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Google firmware page ({url}): {e}"))?;

        if !response.status().is_success() {
            return Err(format!(
                "Google firmware page returned status {}: {url}",
                response.status()
            ));
        }

        let html_content = response
            .text()
            .await
            .map_err(|e| format!("Failed to read Google firmware HTML ({url}): {e}"))?;

        Ok(Self::parse_html(&html_content, image_type))
    }

    pub fn parse_html(html: &str, image_type: FirmwareImageType) -> Vec<FirmwareDeviceModel> {
        let document = Html::parse_document(html);
        let heading_selector = Selector::parse("h2[id], h3[id]")
            .unwrap_or_else(|_| Selector::parse("h2").expect("valid selector fallback"));
        let table_selector = Selector::parse("table").expect("valid selector");
        let tr_selector = Selector::parse("tr").expect("valid selector");
        let td_selector = Selector::parse("td").expect("valid selector");
        let a_selector = Selector::parse("a[href]").expect("valid selector");

        let mut devices = Vec::new();

        for heading in document.select(&heading_selector) {
            let Some(id_attr) = heading.value().attr("id") else {
                continue;
            };

            let codename = id_attr.trim().to_ascii_lowercase();

            // Filter out non-device headings
            if Self::is_ignored_heading(&codename) {
                continue;
            }

            let heading_text = heading.text().collect::<Vec<_>>().join(" ");
            let clean_name = Self::extract_device_name(&heading_text, &codename);

            // Locate the associated table by inspecting next siblings in the DOM tree
            let mut builds = Vec::new();

            for sibling in heading.next_siblings() {
                if let Some(sibling_elem) = ElementRef::wrap(sibling) {
                    let tag = sibling_elem.value().name();
                    // Stop if we hit the next heading
                    if tag == "h2" || tag == "h3" {
                        break;
                    }

                    // Check if this sibling is a table or contains tables
                    let tables: Vec<ElementRef> = if tag == "table" {
                        vec![sibling_elem]
                    } else {
                        sibling_elem.select(&table_selector).collect()
                    };

                    for table in tables {
                        for tr in table.select(&tr_selector) {
                            let tds: Vec<ElementRef> = tr.select(&td_selector).collect();
                            if tds.len() < 2 {
                                continue;
                            }

                            let version_raw = tds[0].text().collect::<Vec<_>>().join(" ");
                            let version_raw = version_raw.trim().to_string();
                            if version_raw.is_empty() || version_raw.eq_ignore_ascii_case("version")
                            {
                                continue;
                            }

                            // Extract download URL and link text from second/subsequent cell
                            let mut download_url = None;
                            for td in &tds[1..] {
                                for a in td.select(&a_selector) {
                                    if let Some(href) = a.value().attr("href") {
                                        if href.ends_with(".zip")
                                            || href.contains("dl.google.com")
                                            || href.contains("google.com")
                                        {
                                            download_url = Some(href.to_string());
                                            break;
                                        }
                                    }
                                }
                                if download_url.is_some() {
                                    break;
                                }
                            }

                            let Some(url) = download_url else {
                                continue;
                            };

                            // Extract SHA-256 checksum (often in td[2] or third cell)
                            let sha256 = if tds.len() >= 3 {
                                let sha_raw = tds[2]
                                    .text()
                                    .collect::<Vec<_>>()
                                    .join("")
                                    .trim()
                                    .to_ascii_lowercase();
                                if sha_raw.len() == 64
                                    && sha_raw.chars().all(|c| c.is_ascii_hexdigit())
                                {
                                    Some(sha_raw)
                                } else {
                                    None
                                }
                            } else {
                                None
                            };

                            let parsed_version = Self::parse_version_string(&version_raw);
                            let build_id_clean = parsed_version.build_id.clone();
                            let build_entry_id = format!(
                                "{}-{}-{}-{}",
                                codename,
                                image_type.as_str(),
                                build_id_clean,
                                builds.len()
                            );

                            builds.push(FirmwareBuild {
                                id: build_entry_id,
                                version: version_raw,
                                android_version: parsed_version.android_version,
                                build_id: parsed_version.build_id,
                                carrier: parsed_version.carrier,
                                release_date: parsed_version.release_date,
                                security_patch: None,
                                image_type,
                                download_url: url,
                                file_size: None,
                                sha256,
                                is_latest: false, // Marked after sorting
                            });
                        }
                    }
                }
            }

            if !builds.is_empty() {
                let metadata = Self::get_hardware_metadata(&codename);

                let device = FirmwareDeviceModel {
                    id: format!("google-{}", codename),
                    name: metadata.name.unwrap_or(clean_name),
                    codename: codename.clone(),
                    brand: FirmwareBrand::Google,
                    soc: metadata.soc,
                    release_year: metadata.release_year,
                    series: metadata.series,
                    builds,
                };

                devices.push(device);
            }
        }

        devices
    }

    fn is_ignored_heading(id: &str) -> bool {
        matches!(
            id,
            "disclaimers"
                | "terms"
                | "terms-and-conditions"
                | "instructions"
                | "acknowledgments"
                | "top"
                | "notice"
                | "table-of-contents"
                | "toc"
                | "devices"
                | "requirements"
                | "flashing-instructions"
                | "updating-instructions"
        )
    }

    fn extract_device_name(heading_text: &str, codename: &str) -> String {
        let mut text = heading_text.trim();

        // 1. If heading contains `"codename" for <Model>` or `<codename> for <Model>`, take the part after `for `
        if let Some(for_idx) = text.find(" for ") {
            text = text[for_idx + 5..].trim();
        }

        // 2. Strip parentheses e.g. "Pixel 8 Pro (Wi-Fi)" or "(husky)"
        if let Some(idx) = text.find('(') {
            text = text[..idx].trim();
        }

        // 3. Strip any quotes (double, single, smart/curly quotes)
        let cleaned = text.replace(['"', '\'', '“', '”', '‘', '’'], "").trim().to_string();

        if cleaned.is_empty() { format!("Pixel ({codename})") } else { cleaned }
    }

    fn parse_version_string(raw: &str) -> ParsedVersion {
        // e.g. "14.0.0 (AP1A.240505.004, May 2024, Verizon)"
        // or "15.0.0 (AP4A.241205.013, Dec 2024)"
        // or "8.1.0 (OPM1.171019.011, Dec 2017)"
        let raw = raw.trim();

        if let Some(open_paren) = raw.find('(') {
            let android_ver = raw[..open_paren].trim().to_string();
            let close_paren = raw.rfind(')').unwrap_or(raw.len());
            let inside = &raw[open_paren + 1..close_paren];
            let parts: Vec<&str> = inside.split(',').map(str::trim).collect();

            let build_id = parts.first().unwrap_or(&"").to_string();
            let release_date = parts.get(1).map(|s| s.to_string());
            let carrier = if parts.len() >= 3 { Some(parts[2..].join(", ")) } else { None };

            ParsedVersion {
                android_version: if android_ver.is_empty() {
                    build_id.clone()
                } else {
                    android_ver
                },
                build_id,
                release_date,
                carrier,
            }
        } else {
            // Fallback when no parentheses
            let tokens: Vec<&str> = raw.split_whitespace().collect();
            let android_ver = tokens.first().unwrap_or(&raw).to_string();
            let build_id = tokens.get(1).unwrap_or(&tokens.first().unwrap_or(&raw)).to_string();

            ParsedVersion {
                android_version: android_ver,
                build_id,
                release_date: None,
                carrier: None,
            }
        }
    }

    fn merge_catalogs(
        mut factory: Vec<FirmwareDeviceModel>,
        ota: Vec<FirmwareDeviceModel>,
    ) -> Vec<FirmwareDeviceModel> {
        let mut map: HashMap<String, FirmwareDeviceModel> = HashMap::new();

        for dev in factory.drain(..) {
            map.insert(dev.codename.clone(), dev);
        }

        for ota_dev in ota {
            if let Some(existing) = map.get_mut(&ota_dev.codename) {
                existing.builds.extend(ota_dev.builds);
            } else {
                map.insert(ota_dev.codename.clone(), ota_dev);
            }
        }

        let mut result: Vec<FirmwareDeviceModel> = map.into_values().collect();

        // Mark latest builds and sort builds
        for device in &mut result {
            Self::mark_latest_builds(&mut device.builds);
        }

        // Sort devices by release year descending, then name
        result
            .sort_by(|a, b| b.release_year.cmp(&a.release_year).then_with(|| a.name.cmp(&b.name)));

        result
    }

    fn mark_latest_builds(builds: &mut [FirmwareBuild]) {
        let mut seen_factory = false;
        let mut seen_ota = false;

        // Builds appear newest-first on Google's website
        for build in builds.iter_mut() {
            match build.image_type {
                FirmwareImageType::Factory if !seen_factory => {
                    build.is_latest = true;
                    seen_factory = true;
                }
                FirmwareImageType::Ota if !seen_ota => {
                    build.is_latest = true;
                    seen_ota = true;
                }
                _ => {
                    build.is_latest = false;
                }
            }
        }
    }

    fn get_hardware_metadata(codename: &str) -> HardwareMetadata {
        match codename {
            "caiman" => HardwareMetadata {
                name: Some("Pixel 9 Pro".into()),
                series: Some("Pixel 9".into()),
                soc: Some("Google Tensor G4".into()),
                release_year: Some(2024),
            },
            "komodo" => HardwareMetadata {
                name: Some("Pixel 9 Pro XL".into()),
                series: Some("Pixel 9".into()),
                soc: Some("Google Tensor G4".into()),
                release_year: Some(2024),
            },
            "tokay" => HardwareMetadata {
                name: Some("Pixel 9".into()),
                series: Some("Pixel 9".into()),
                soc: Some("Google Tensor G4".into()),
                release_year: Some(2024),
            },
            "comet" => HardwareMetadata {
                name: Some("Pixel 9 Pro Fold".into()),
                series: Some("Pixel 9".into()),
                soc: Some("Google Tensor G4".into()),
                release_year: Some(2024),
            },
            "akita" => HardwareMetadata {
                name: Some("Pixel 8a".into()),
                series: Some("Pixel 8".into()),
                soc: Some("Google Tensor G3".into()),
                release_year: Some(2024),
            },
            "husky" => HardwareMetadata {
                name: Some("Pixel 8 Pro".into()),
                series: Some("Pixel 8".into()),
                soc: Some("Google Tensor G3".into()),
                release_year: Some(2023),
            },
            "shiba" => HardwareMetadata {
                name: Some("Pixel 8".into()),
                series: Some("Pixel 8".into()),
                soc: Some("Google Tensor G3".into()),
                release_year: Some(2023),
            },
            "felix" => HardwareMetadata {
                name: Some("Pixel Fold".into()),
                series: Some("Pixel Fold".into()),
                soc: Some("Google Tensor G2".into()),
                release_year: Some(2023),
            },
            "tangorpro" => HardwareMetadata {
                name: Some("Pixel Tablet".into()),
                series: Some("Pixel Tablet".into()),
                soc: Some("Google Tensor G2".into()),
                release_year: Some(2023),
            },
            "lynx" => HardwareMetadata {
                name: Some("Pixel 7a".into()),
                series: Some("Pixel 7".into()),
                soc: Some("Google Tensor G2".into()),
                release_year: Some(2023),
            },
            "cheetah" => HardwareMetadata {
                name: Some("Pixel 7 Pro".into()),
                series: Some("Pixel 7".into()),
                soc: Some("Google Tensor G2".into()),
                release_year: Some(2022),
            },
            "panther" => HardwareMetadata {
                name: Some("Pixel 7".into()),
                series: Some("Pixel 7".into()),
                soc: Some("Google Tensor G2".into()),
                release_year: Some(2022),
            },
            "bluejay" => HardwareMetadata {
                name: Some("Pixel 6a".into()),
                series: Some("Pixel 6".into()),
                soc: Some("Google Tensor".into()),
                release_year: Some(2022),
            },
            "raven" => HardwareMetadata {
                name: Some("Pixel 6 Pro".into()),
                series: Some("Pixel 6".into()),
                soc: Some("Google Tensor".into()),
                release_year: Some(2021),
            },
            "oriole" => HardwareMetadata {
                name: Some("Pixel 6".into()),
                series: Some("Pixel 6".into()),
                soc: Some("Google Tensor".into()),
                release_year: Some(2021),
            },
            "barbet" => HardwareMetadata {
                name: Some("Pixel 5a (5G)".into()),
                series: Some("Pixel 5".into()),
                soc: Some("Qualcomm Snapdragon 765G".into()),
                release_year: Some(2021),
            },
            "redfin" => HardwareMetadata {
                name: Some("Pixel 5".into()),
                series: Some("Pixel 5".into()),
                soc: Some("Qualcomm Snapdragon 765G".into()),
                release_year: Some(2020),
            },
            "bramble" => HardwareMetadata {
                name: Some("Pixel 4a (5G)".into()),
                series: Some("Pixel 4".into()),
                soc: Some("Qualcomm Snapdragon 765G".into()),
                release_year: Some(2020),
            },
            "sunfish" => HardwareMetadata {
                name: Some("Pixel 4a".into()),
                series: Some("Pixel 4".into()),
                soc: Some("Qualcomm Snapdragon 730G".into()),
                release_year: Some(2020),
            },
            "coral" => HardwareMetadata {
                name: Some("Pixel 4 XL".into()),
                series: Some("Pixel 4".into()),
                soc: Some("Qualcomm Snapdragon 855".into()),
                release_year: Some(2019),
            },
            "flame" => HardwareMetadata {
                name: Some("Pixel 4".into()),
                series: Some("Pixel 4".into()),
                soc: Some("Qualcomm Snapdragon 855".into()),
                release_year: Some(2019),
            },
            "bonito" => HardwareMetadata {
                name: Some("Pixel 3a XL".into()),
                series: Some("Pixel 3".into()),
                soc: Some("Qualcomm Snapdragon 670".into()),
                release_year: Some(2019),
            },
            "sargo" => HardwareMetadata {
                name: Some("Pixel 3a".into()),
                series: Some("Pixel 3".into()),
                soc: Some("Qualcomm Snapdragon 670".into()),
                release_year: Some(2019),
            },
            "crosshatch" => HardwareMetadata {
                name: Some("Pixel 3 XL".into()),
                series: Some("Pixel 3".into()),
                soc: Some("Qualcomm Snapdragon 845".into()),
                release_year: Some(2018),
            },
            "blueline" => HardwareMetadata {
                name: Some("Pixel 3".into()),
                series: Some("Pixel 3".into()),
                soc: Some("Qualcomm Snapdragon 845".into()),
                release_year: Some(2018),
            },
            "taimen" => HardwareMetadata {
                name: Some("Pixel 2 XL".into()),
                series: Some("Pixel 2".into()),
                soc: Some("Qualcomm Snapdragon 835".into()),
                release_year: Some(2017),
            },
            "walleye" => HardwareMetadata {
                name: Some("Pixel 2".into()),
                series: Some("Pixel 2".into()),
                soc: Some("Qualcomm Snapdragon 835".into()),
                release_year: Some(2017),
            },
            "marlin" => HardwareMetadata {
                name: Some("Pixel XL".into()),
                series: Some("Pixel 1".into()),
                soc: Some("Qualcomm Snapdragon 821".into()),
                release_year: Some(2016),
            },
            "sailfish" => HardwareMetadata {
                name: Some("Pixel".into()),
                series: Some("Pixel 1".into()),
                soc: Some("Qualcomm Snapdragon 821".into()),
                release_year: Some(2016),
            },
            "angler" => HardwareMetadata {
                name: Some("Nexus 6P".into()),
                series: Some("Nexus".into()),
                soc: Some("Qualcomm Snapdragon 810".into()),
                release_year: Some(2015),
            },
            "bullhead" => HardwareMetadata {
                name: Some("Nexus 5X".into()),
                series: Some("Nexus".into()),
                soc: Some("Qualcomm Snapdragon 808".into()),
                release_year: Some(2015),
            },
            "shamu" => HardwareMetadata {
                name: Some("Nexus 6".into()),
                series: Some("Nexus".into()),
                soc: Some("Qualcomm Snapdragon 805".into()),
                release_year: Some(2014),
            },
            "volantis" | "volantisg" => HardwareMetadata {
                name: Some("Nexus 9".into()),
                series: Some("Nexus".into()),
                soc: Some("NVIDIA Tegra K1".into()),
                release_year: Some(2014),
            },
            "hammerhead" => HardwareMetadata {
                name: Some("Nexus 5".into()),
                series: Some("Nexus".into()),
                soc: Some("Qualcomm Snapdragon 800".into()),
                release_year: Some(2013),
            },
            "flo" | "deb" => HardwareMetadata {
                name: Some("Nexus 7 (2013)".into()),
                series: Some("Nexus".into()),
                soc: Some("Qualcomm Snapdragon S4 Pro".into()),
                release_year: Some(2013),
            },
            "manta" => HardwareMetadata {
                name: Some("Nexus 10".into()),
                series: Some("Nexus".into()),
                soc: Some("Samsung Exynos 5250".into()),
                release_year: Some(2012),
            },
            "grouper" | "tilapia" => HardwareMetadata {
                name: Some("Nexus 7 (2012)".into()),
                series: Some("Nexus".into()),
                soc: Some("NVIDIA Tegra 3".into()),
                release_year: Some(2012),
            },
            "mako" => HardwareMetadata {
                name: Some("Nexus 4".into()),
                series: Some("Nexus".into()),
                soc: Some("Qualcomm Snapdragon S4 Pro".into()),
                release_year: Some(2012),
            },
            _ => HardwareMetadata::default(),
        }
    }
}

impl FirmwareProvider for GooglePixelScraper {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::Google
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(async move { self.fetch_all().await })
    }
}

#[derive(Default)]
struct HardwareMetadata {
    name: Option<String>,
    series: Option<String>,
    soc: Option<String>,
    release_year: Option<u32>,
}

struct ParsedVersion {
    android_version: String,
    build_id: String,
    release_date: Option<String>,
    carrier: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version_string() {
        let res =
            GooglePixelScraper::parse_version_string("14.0.0 (AP1A.240505.004, May 2024, Verizon)");
        assert_eq!(res.android_version, "14.0.0");
        assert_eq!(res.build_id, "AP1A.240505.004");
        assert_eq!(res.release_date.as_deref(), Some("May 2024"));
        assert_eq!(res.carrier.as_deref(), Some("Verizon"));

        let res2 = GooglePixelScraper::parse_version_string("15.0.0 (AP4A.241205.013, Dec 2024)");
        assert_eq!(res2.android_version, "15.0.0");
        assert_eq!(res2.build_id, "AP4A.241205.013");
        assert_eq!(res2.release_date.as_deref(), Some("Dec 2024"));
        assert_eq!(res2.carrier, None);
    }

    #[test]
    fn test_parse_html_snippet() {
        let html = r#"
        <html>
        <body>
            <h2 id="akita">Pixel 8a ("akita")</h2>
            <table>
                <thead>
                    <tr><th>Version</th><th>Download Link</th><th>SHA-256 Checksum</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>15.0.0 (AP4A.241205.013, Dec 2024)</td>
                        <td><a href="https://dl.google.com/dl/android/aosp/akita-ap4a.241205.013-factory-6b2db128.zip">Link</a></td>
                        <td>6b2db128c11925b6c86e093557e5d0db2e2ba6db50280eb4c28febeae30e461f</td>
                    </tr>
                    <tr>
                        <td>14.0.0 (AP1A.240505.004, May 2024)</td>
                        <td><a href="https://dl.google.com/dl/android/aosp/akita-ap1a.240505.004-factory-5a1b2c3d.zip">Link</a></td>
                        <td>5a1b2c3dc11925b6c86e093557e5d0db2e2ba6db50280eb4c28febeae30e461f</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        "#;

        let devices = GooglePixelScraper::parse_html(html, FirmwareImageType::Factory);
        assert_eq!(devices.len(), 1);
        let dev = &devices[0];
        assert_eq!(dev.codename, "akita");
        assert_eq!(dev.name, "Pixel 8a");
        assert_eq!(dev.series.as_deref(), Some("Pixel 8"));
        assert_eq!(dev.soc.as_deref(), Some("Google Tensor G3"));
        assert_eq!(dev.release_year, Some(2024));
        assert_eq!(dev.builds.len(), 2);
        assert_eq!(dev.builds[0].build_id, "AP4A.241205.013");
        assert_eq!(
            dev.builds[0].sha256.as_deref(),
            Some("6b2db128c11925b6c86e093557e5d0db2e2ba6db50280eb4c28febeae30e461f")
        );
    }
}
