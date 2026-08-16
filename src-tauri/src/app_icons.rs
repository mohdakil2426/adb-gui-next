//! Disk + memory cache of APK launcher icons extracted on the host.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use base64::Engine;
use log::warn;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::CmdResult;
use crate::commands::run_adb_for_serial;
use crate::helpers::sanitize_filename;

pub const MAX_ICON_BATCH: usize = 24;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppIcon {
    pub data_base64: Option<String>,
    pub mime: Option<String>,
    pub package_name: String,
}

fn cache_root(app: &AppHandle, serial: &str) -> CmdResult<PathBuf> {
    let hash = hex::encode(Sha256::digest(serial.as_bytes()));
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("app-icons")
        .join(&hash[..16.min(hash.len())]);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn cache_key(apk_path: &str) -> String {
    hex::encode(Sha256::digest(apk_path.as_bytes()))
}

fn parse_package_paths(output: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in output.lines() {
        let Some(rest) = line.trim().strip_prefix("package:") else {
            continue;
        };
        let Some((apk, package)) = rest.rsplit_once('=') else {
            continue;
        };
        if !package.is_empty() && apk.ends_with(".apk") {
            map.insert(package.to_string(), apk.to_string());
        }
    }
    map
}

fn density_rank(path: &str) -> i32 {
    if path.contains("xxxhdpi") {
        5
    } else if path.contains("xxhdpi") {
        4
    } else if path.contains("xhdpi") {
        3
    } else if path.contains("hdpi") {
        2
    } else if path.contains("mdpi") || path.contains("anydpi") {
        1
    } else {
        0
    }
}

fn name_rank(file_name: &str) -> i32 {
    if file_name.contains("ic_launcher") {
        3
    } else if file_name.contains("launcher") {
        2
    } else if file_name.contains("icon") {
        1
    } else {
        0
    }
}

fn mime_for(path: &str) -> Option<&'static str> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") {
        Some("image/png")
    } else if lower.ends_with(".webp") {
        Some("image/webp")
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        Some("image/jpeg")
    } else {
        None
    }
}

/// Pick the best raster launcher icon from an APK zip.
pub fn pick_icon_from_apk_bytes(bytes: &[u8]) -> Option<(String, Vec<u8>)> {
    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).ok()?;
    let mut best: Option<(i32, String, Vec<u8>)> = None;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).ok()?;
        let name = entry.name().replace('\\', "/");
        let lower = name.to_ascii_lowercase();
        let Some(mime) = mime_for(&lower) else {
            continue;
        };
        if !(lower.starts_with("res/mipmap") || lower.starts_with("res/drawable")) {
            continue;
        }
        let file_name = lower.rsplit('/').next().unwrap_or("");
        let score = density_rank(&lower) * 10 + name_rank(file_name);
        if score < 10 {
            continue;
        }
        let mut data = Vec::new();
        if entry.read_to_end(&mut data).is_err() || data.is_empty() {
            continue;
        }
        let better = match &best {
            None => true,
            Some((best_score, _, best_data)) => {
                score > *best_score || (score == *best_score && data.len() > best_data.len())
            }
        };
        if better {
            best = Some((score, mime.to_string(), data));
        }
    }
    best.map(|(_, mime, data)| (mime, data))
}

fn write_cache(path: &Path, mime: &str, data: &[u8]) {
    let ext = if mime.ends_with("webp") {
        "webp"
    } else if mime.ends_with("jpeg") {
        "jpg"
    } else {
        "png"
    };
    let _ = File::create(path.with_extension(ext)).and_then(|mut file| file.write_all(data));
    let _ = fs::write(path.with_extension("mime"), mime);
}

fn read_cache(stem: &Path) -> Option<(String, Vec<u8>)> {
    for ext in ["png", "webp", "jpg"] {
        let file = stem.with_extension(ext);
        if file.is_file() {
            let data = fs::read(&file).ok()?;
            let mime = fs::read_to_string(stem.with_extension("mime"))
                .ok()
                .unwrap_or_else(|| mime_for(&format!("x.{ext}")).unwrap_or("image/png").into());
            return Some((mime, data));
        }
    }
    None
}

static MEMORY: Mutex<Option<HashMap<String, AppIcon>>> = Mutex::new(None);

fn memory_get(key: &str) -> Option<AppIcon> {
    MEMORY.lock().ok()?.as_ref()?.get(key).cloned()
}

fn memory_put(key: String, icon: AppIcon) {
    if let Ok(mut guard) = MEMORY.lock() {
        let map = guard.get_or_insert_with(HashMap::new);
        if map.len() > 512 {
            map.clear();
        }
        map.insert(key, icon);
    }
}

pub fn get_icons(
    app: &AppHandle,
    serial: Option<&str>,
    packages: &[String],
) -> CmdResult<Vec<AppIcon>> {
    if packages.len() > MAX_ICON_BATCH {
        return Err(format!("icon batch too large (max {MAX_ICON_BATCH})"));
    }
    let serial_key = serial.unwrap_or("default");
    let cache_dir = cache_root(app, serial_key)?;
    let listed = run_adb_for_serial(app, serial, &["shell", "pm", "list", "packages", "-f"])?;
    let paths = parse_package_paths(&listed);
    let mut out = Vec::with_capacity(packages.len());
    for package in packages {
        let package = package.trim();
        if package.is_empty() {
            continue;
        }
        let Some(apk_path) = paths.get(package) else {
            out.push(AppIcon { data_base64: None, mime: None, package_name: package.to_string() });
            continue;
        };
        let mem_key = format!("{serial_key}:{apk_path}");
        if let Some(cached) = memory_get(&mem_key) {
            out.push(cached);
            continue;
        }
        let stem = cache_dir.join(cache_key(apk_path));
        if let Some((mime, data)) = read_cache(&stem) {
            let icon = AppIcon {
                data_base64: Some(base64::engine::general_purpose::STANDARD.encode(data)),
                mime: Some(mime),
                package_name: package.to_string(),
            };
            memory_put(mem_key, icon.clone());
            out.push(icon);
            continue;
        }
        let local = cache_dir.join(format!("{}.apk", sanitize_filename(package)));
        match run_adb_for_serial(app, serial, &["pull", apk_path, &local.to_string_lossy()]) {
            Ok(_) => {}
            Err(error) => {
                warn!("icon pull failed for {package}: {error}");
                out.push(AppIcon {
                    data_base64: None,
                    mime: None,
                    package_name: package.to_string(),
                });
                continue;
            }
        }
        let bytes = fs::read(&local).unwrap_or_default();
        let _ = fs::remove_file(&local);
        let icon = if let Some((mime, data)) = pick_icon_from_apk_bytes(&bytes) {
            write_cache(&stem, &mime, &data);
            AppIcon {
                data_base64: Some(base64::engine::general_purpose::STANDARD.encode(&data)),
                mime: Some(mime),
                package_name: package.to_string(),
            }
        } else {
            AppIcon { data_base64: None, mime: None, package_name: package.to_string() }
        };
        memory_put(mem_key, icon.clone());
        out.push(icon);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    #[test]
    fn parse_pm_list_packages_f() {
        let out = "package:/data/app/~~x==/com.foo-y==/base.apk=com.foo\npackage:/system/app/Settings/Settings.apk=com.android.settings\n";
        let map = parse_package_paths(out);
        assert_eq!(
            map.get("com.foo").map(String::as_str),
            Some("/data/app/~~x==/com.foo-y==/base.apk")
        );
        assert_eq!(
            map.get("com.android.settings").map(String::as_str),
            Some("/system/app/Settings/Settings.apk")
        );
    }

    #[test]
    fn pick_prefers_xxhdpi_launcher() {
        let mut cursor = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut cursor);
            let opts = SimpleFileOptions::default();
            zip.start_file("res/mipmap-mdpi/ic_launcher.png", opts).unwrap();
            zip.write_all(&[0x89, 0x50, 0x4E, 0x47, 1, 2, 3]).unwrap();
            zip.start_file("res/mipmap-xxhdpi/ic_launcher.png", opts).unwrap();
            zip.write_all(&[0x89, 0x50, 0x4E, 0x47, 9, 9, 9, 9]).unwrap();
            zip.start_file("res/mipmap-xxhdpi/ic_launcher.xml", opts).unwrap();
            zip.write_all(b"<adaptive-icon/>").unwrap();
            zip.finish().unwrap();
        }
        let (mime, data) = pick_icon_from_apk_bytes(&cursor.into_inner()).expect("icon");
        assert_eq!(mime, "image/png");
        assert_eq!(data.last().copied(), Some(9));
    }

    #[test]
    fn batch_cap_constant() {
        assert_eq!(MAX_ICON_BATCH, 24);
    }
}
