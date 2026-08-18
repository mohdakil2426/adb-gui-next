use crate::CmdResult;
use base64::Engine;
use log::debug;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Cursor, Read},
    path::Path,
};
use tauri::AppHandle;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ApkInspectionResult {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub format: String, // "apk" | "apks" | "xapk" | "apkm"
    pub package_name: String,
    pub label: String,
    pub version_name: String,
    pub version_code: String,
    pub min_sdk: u32,
    pub target_sdk: u32,
    pub abis: Vec<String>,
    pub split_names: Vec<String>,
    pub permissions_count: usize,
    pub is_test_only: bool,
    pub icon_base64: Option<String>,
}

#[derive(Debug, Default)]
struct ManifestParsedData {
    package_name: String,
    label: String,
    version_name: String,
    version_code: String,
    min_sdk: u32,
    target_sdk: u32,
    permissions: Vec<String>,
    is_test_only: bool,
}

// ---------------------------------------------------------------------------
// AXML Parser for binary AndroidManifest.xml
// ---------------------------------------------------------------------------

const AXML_CHUNK_TYPE_STRING_POOL: u32 = 0x00010001;
const AXML_CHUNK_TYPE_START_TAG: u32 = 0x00000102;
const UTF8_FLAG: u32 = 0x00000100;

struct AxmlParser<'a> {
    data: &'a [u8],
    strings: Vec<String>,
}

impl<'a> AxmlParser<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, strings: Vec::new() }
    }

    fn read_u16(slice: &[u8], offset: usize) -> Option<u16> {
        if offset + 2 <= slice.len() {
            Some(u16::from_le_bytes([slice[offset], slice[offset + 1]]))
        } else {
            None
        }
    }

    fn read_u32(slice: &[u8], offset: usize) -> Option<u32> {
        if offset + 4 <= slice.len() {
            Some(u32::from_le_bytes([
                slice[offset],
                slice[offset + 1],
                slice[offset + 2],
                slice[offset + 3],
            ]))
        } else {
            None
        }
    }

    fn parse_string_pool(&mut self, chunk_offset: usize) -> Option<usize> {
        let chunk_size = Self::read_u32(self.data, chunk_offset + 4)? as usize;
        let string_count = Self::read_u32(self.data, chunk_offset + 8)? as usize;
        let flags = Self::read_u32(self.data, chunk_offset + 16)?;
        let strings_start = Self::read_u32(self.data, chunk_offset + 20)? as usize;
        let is_utf8 = (flags & UTF8_FLAG) != 0;

        let offsets_start = chunk_offset + 28;
        let data_pool_start = chunk_offset + strings_start;

        let mut strings = Vec::with_capacity(string_count);

        for i in 0..string_count {
            let offset_pos = offsets_start + i * 4;
            if offset_pos + 4 > self.data.len() {
                break;
            }
            let str_offset = Self::read_u32(self.data, offset_pos)? as usize;
            let str_start = data_pool_start + str_offset;

            if str_start >= self.data.len() {
                strings.push(String::new());
                continue;
            }

            if is_utf8 {
                // In UTF-8 string pool:
                // [skip UTF-16 length bytes (1 or 2)][skip UTF-8 length bytes (1 or 2)][UTF-8 chars][null]
                let mut pos = str_start;
                if pos < self.data.len() && (self.data[pos] & 0x80) != 0 {
                    pos += 2;
                } else {
                    pos += 1;
                }
                let len = if pos < self.data.len() {
                    if (self.data[pos] & 0x80) != 0 {
                        let len1 = (self.data[pos] & 0x7F) as usize;
                        let len2 =
                            if pos + 1 < self.data.len() { self.data[pos + 1] as usize } else { 0 };
                        pos += 2;
                        (len1 << 8) | len2
                    } else {
                        let len = self.data[pos] as usize;
                        pos += 1;
                        len
                    }
                } else {
                    0
                };

                if pos + len <= self.data.len() {
                    let s = String::from_utf8_lossy(&self.data[pos..pos + len]).to_string();
                    strings.push(s);
                } else {
                    strings.push(String::new());
                }
            } else {
                // UTF-16 string pool
                let mut pos = str_start;
                let len = if let Some(u1) = Self::read_u16(self.data, pos) {
                    pos += 2;
                    if (u1 & 0x8000) != 0 {
                        if let Some(u2) = Self::read_u16(self.data, pos) {
                            pos += 2;
                            (((u1 & 0x7FFF) as usize) << 16) | (u2 as usize)
                        } else {
                            (u1 & 0x7FFF) as usize
                        }
                    } else {
                        u1 as usize
                    }
                } else {
                    0
                };

                let byte_len = len * 2;
                if pos + byte_len <= self.data.len() {
                    let u16_slice: Vec<u16> = (0..len)
                        .filter_map(|idx| Self::read_u16(self.data, pos + idx * 2))
                        .collect();
                    strings.push(String::from_utf16_lossy(&u16_slice));
                } else {
                    strings.push(String::new());
                }
            }
        }

        self.strings = strings;
        Some(chunk_offset + chunk_size)
    }

    fn get_string(&self, index: u32) -> &str {
        let idx = index as usize;
        if idx < self.strings.len() { &self.strings[idx] } else { "" }
    }

    fn parse_manifest(&mut self) -> ManifestParsedData {
        let mut result = ManifestParsedData::default();
        if self.data.len() < 8 {
            return result;
        }

        let magic = Self::read_u32(self.data, 0).unwrap_or(0);
        if magic != 0x00080003 {
            debug!("AXML magic header mismatch: 0x{:08X}", magic);
            return result;
        }

        let mut offset = 8;
        while offset + 8 <= self.data.len() {
            let chunk_type = Self::read_u32(self.data, offset).unwrap_or(0);
            let chunk_size = Self::read_u32(self.data, offset + 4).unwrap_or(0) as usize;

            if chunk_size < 8 || offset + chunk_size > self.data.len() {
                break;
            }

            if chunk_type == AXML_CHUNK_TYPE_STRING_POOL {
                self.parse_string_pool(offset);
            } else if chunk_type == AXML_CHUNK_TYPE_START_TAG {
                self.parse_start_tag(offset, &mut result);
            }

            offset += chunk_size;
        }

        result
    }

    fn parse_start_tag(&self, offset: usize, manifest: &mut ManifestParsedData) {
        if offset + 36 > self.data.len() {
            return;
        }

        let name_idx = Self::read_u32(self.data, offset + 20).unwrap_or(u32::MAX);
        let tag_name = self.get_string(name_idx);

        let attr_start = Self::read_u16(self.data, offset + 24).unwrap_or(0) as usize;
        let attr_size = Self::read_u16(self.data, offset + 26).unwrap_or(20) as usize;
        let attr_count = Self::read_u16(self.data, offset + 28).unwrap_or(0) as usize;

        let attrs_base = offset + attr_start;

        for i in 0..attr_count {
            let attr_offset = attrs_base + i * attr_size;
            if attr_offset + 20 > self.data.len() {
                break;
            }

            let attr_name_idx = Self::read_u32(self.data, attr_offset + 4).unwrap_or(u32::MAX);
            let raw_val_idx = Self::read_u32(self.data, attr_offset + 8).unwrap_or(u32::MAX);
            let typed_value_data = Self::read_u32(self.data, attr_offset + 16).unwrap_or(0);

            let attr_name = self.get_string(attr_name_idx);
            let raw_val = if raw_val_idx != u32::MAX { self.get_string(raw_val_idx) } else { "" };

            match tag_name {
                "manifest" => {
                    if attr_name == "package" && !raw_val.is_empty() {
                        manifest.package_name = raw_val.to_string();
                    } else if attr_name == "versionName" {
                        manifest.version_name = if !raw_val.is_empty() {
                            raw_val.to_string()
                        } else {
                            typed_value_data.to_string()
                        };
                    } else if attr_name == "versionCode" {
                        manifest.version_code = if typed_value_data > 0 {
                            typed_value_data.to_string()
                        } else if !raw_val.is_empty() {
                            raw_val.to_string()
                        } else {
                            "0".to_string()
                        };
                    }
                }
                "application" => {
                    if attr_name == "label" && !raw_val.is_empty() {
                        manifest.label = raw_val.to_string();
                    } else if attr_name == "testOnly" {
                        manifest.is_test_only =
                            typed_value_data != 0 || raw_val.eq_ignore_ascii_case("true");
                    }
                }
                "uses-sdk" => {
                    if attr_name == "minSdkVersion" {
                        manifest.min_sdk = if typed_value_data > 0 {
                            typed_value_data
                        } else {
                            raw_val.parse().unwrap_or(0)
                        };
                    } else if attr_name == "targetSdkVersion" {
                        manifest.target_sdk = if typed_value_data > 0 {
                            typed_value_data
                        } else {
                            raw_val.parse().unwrap_or(0)
                        };
                    }
                }
                "uses-permission" | "uses-permission-sdk-23"
                    if attr_name == "name" && !raw_val.is_empty() =>
                {
                    manifest.permissions.push(raw_val.to_string());
                }
                _ => {}
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Inspection Entrypoints
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn inspect_package_file(path: String) -> CmdResult<ApkInspectionResult> {
    tokio::task::spawn_blocking(move || inspect_package_file_sync(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn batch_inspect_package_files(
    _app: AppHandle,
    paths: Vec<String>,
) -> CmdResult<Vec<ApkInspectionResult>> {
    tokio::task::spawn_blocking(move || {
        use rayon::prelude::*;
        let results: Vec<ApkInspectionResult> = paths
            .par_iter()
            .map(|p| {
                inspect_package_file_sync(p).unwrap_or_else(|_err| {
                    let path_obj = Path::new(p);
                    let file_name =
                        path_obj.file_name().and_then(|v| v.to_str()).unwrap_or(p).to_string();
                    let file_size = fs::metadata(p).map_or(0, |m| m.len());
                    ApkInspectionResult {
                        file_path: p.clone(),
                        file_name: file_name.clone(),
                        file_size,
                        format: path_obj
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("apk")
                            .to_lowercase(),
                        label: file_name,
                        ..Default::default()
                    }
                })
            })
            .collect();
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn inspect_package_file_sync(file_path: &str) -> CmdResult<ApkInspectionResult> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {file_path}"));
    }

    let file_metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size = file_metadata.len();
    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map_or_else(|| "apk".to_string(), |e| e.to_ascii_lowercase());

    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read archive: {e}"))?;

    let mut result = ApkInspectionResult {
        file_path: file_path.to_string(),
        file_name: file_name.clone(),
        file_size,
        format: ext.clone(),
        package_name: String::new(),
        label: String::new(),
        version_name: String::new(),
        version_code: String::new(),
        min_sdk: 0,
        target_sdk: 0,
        abis: Vec::new(),
        split_names: Vec::new(),
        permissions_count: 0,
        is_test_only: false,
        icon_base64: None,
    };

    let mut abi_set = std::collections::BTreeSet::new();
    let mut split_list = Vec::new();
    let mut base_apk_bytes: Option<Vec<u8>> = None;
    let mut manifest_bytes: Option<Vec<u8>> = None;

    for i in 0..archive.len() {
        let Ok(mut entry) = archive.by_index(i) else {
            continue;
        };
        let name = entry.name().to_string();

        if ext == "apks" || ext == "xapk" || ext == "apkm" {
            if name.to_ascii_lowercase().ends_with(".apk") {
                split_list.push(name.clone());
                if base_apk_bytes.is_none()
                    && (name.eq_ignore_ascii_case("base.apk")
                        || !name.to_ascii_lowercase().contains("split"))
                {
                    let mut buf = Vec::new();
                    if entry.read_to_end(&mut buf).is_ok() {
                        base_apk_bytes = Some(buf);
                    }
                }
            } else if name.eq_ignore_ascii_case("manifest.json") {
                // XAPK manifest parsing
                let mut json_buf = String::new();
                if entry.read_to_string(&mut json_buf).is_ok()
                    && let Ok(v) = serde_json::from_str::<serde_json::Value>(&json_buf)
                {
                    if let Some(pkg) = v["package_name"].as_str() {
                        result.package_name = pkg.to_string();
                    }
                    if let Some(lbl) = v["name"].as_str() {
                        result.label = lbl.to_string();
                    }
                    if let Some(vn) = v["version_name"].as_str() {
                        result.version_name = vn.to_string();
                    }
                    if let Some(vc) = v["version_code"]
                        .as_str()
                        .or_else(|| v["version_code"].as_i64().map(|_| ""))
                    {
                        result.version_code = if vc.is_empty() {
                            v["version_code"].to_string()
                        } else {
                            vc.to_string()
                        };
                    }
                    if let Some(min) = v["min_sdk_version"].as_u64() {
                        result.min_sdk = min as u32;
                    }
                    if let Some(tgt) = v["target_sdk_version"].as_u64() {
                        result.target_sdk = tgt as u32;
                    }
                }
            }
        }

        // Detect ABIs from lib/<abi>/...
        if name.starts_with("lib/") {
            let parts: Vec<&str> = name.split('/').collect();
            if parts.len() >= 2 && !parts[1].is_empty() {
                abi_set.insert(parts[1].to_string());
            }
        }

        // Direct AndroidManifest.xml in standalone APK
        if manifest_bytes.is_none() && name == "AndroidManifest.xml" {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                manifest_bytes = Some(buf);
            }
        }
    }

    result.split_names = split_list;

    // Parse AndroidManifest.xml from standalone APK or extracted base.apk
    if let Some(m_bytes) = &manifest_bytes {
        let mut parser = AxmlParser::new(m_bytes);
        let manifest = parser.parse_manifest();
        if result.package_name.is_empty() {
            result.package_name = manifest.package_name;
        }
        if result.label.is_empty() {
            result.label = manifest.label;
        }
        if result.version_name.is_empty() {
            result.version_name = manifest.version_name;
        }
        if result.version_code.is_empty() {
            result.version_code = manifest.version_code;
        }
        if result.min_sdk == 0 {
            result.min_sdk = manifest.min_sdk;
        }
        if result.target_sdk == 0 {
            result.target_sdk = manifest.target_sdk;
        }
        result.permissions_count = manifest.permissions.len();
        result.is_test_only = manifest.is_test_only;
    } else if let Some(b_bytes) = &base_apk_bytes {
        let cursor = Cursor::new(b_bytes);
        if let Ok(mut inner_zip) = ZipArchive::new(cursor) {
            for j in 0..inner_zip.len() {
                if let Ok(mut inner_entry) = inner_zip.by_index(j) {
                    let iname = inner_entry.name().to_string();
                    if iname.starts_with("lib/") {
                        let parts: Vec<&str> = iname.split('/').collect();
                        if parts.len() >= 2 && !parts[1].is_empty() {
                            abi_set.insert(parts[1].to_string());
                        }
                    }
                    if iname == "AndroidManifest.xml" {
                        let mut m_buf = Vec::new();
                        if inner_entry.read_to_end(&mut m_buf).is_ok() {
                            let mut parser = AxmlParser::new(&m_buf);
                            let manifest = parser.parse_manifest();
                            if result.package_name.is_empty() {
                                result.package_name = manifest.package_name;
                            }
                            if result.label.is_empty() {
                                result.label = manifest.label;
                            }
                            if result.version_name.is_empty() {
                                result.version_name = manifest.version_name;
                            }
                            if result.version_code.is_empty() {
                                result.version_code = manifest.version_code;
                            }
                            if result.min_sdk == 0 {
                                result.min_sdk = manifest.min_sdk;
                            }
                            if result.target_sdk == 0 {
                                result.target_sdk = manifest.target_sdk;
                            }
                            result.permissions_count = manifest.permissions.len();
                            result.is_test_only = manifest.is_test_only;
                        }
                    }
                }
            }
        }
    }

    result.abis = if abi_set.is_empty() {
        vec!["universal".to_string()]
    } else {
        abi_set.into_iter().collect()
    };

    if result.label.is_empty() {
        if !result.package_name.is_empty() {
            result.label = result.package_name.clone();
        } else {
            result.label = file_name.clone();
        }
    }

    // Try extracting launcher icon
    if ext == "apk" {
        if let Ok(bytes) = fs::read(path)
            && let Some((_mime, icon_data)) = crate::app_icons::pick_icon_from_apk_bytes(&bytes)
        {
            result.icon_base64 = Some(base64::engine::general_purpose::STANDARD.encode(icon_data));
        }
    } else if let Some(b_bytes) = &base_apk_bytes
        && let Some((_mime, icon_data)) = crate::app_icons::pick_icon_from_apk_bytes(b_bytes)
    {
        result.icon_base64 = Some(base64::engine::general_purpose::STANDARD.encode(icon_data));
    }

    Ok(result)
}
