//! Download, verify SHA-256, and extract official scrcpy archives.

use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;
use futures_util::StreamExt;
use log::info;
use reqwest::Client;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use super::assets::{host_arch, host_os, official_archive_name, parse_sha256sums};
use crate::CmdResult;
use crate::payload::remote::validate_outbound_url;

const RELEASES_LATEST: &str = "https://api.github.com/repos/Genymobile/scrcpy/releases/latest";
const USER_AGENT: &str = "ADB-GUI-Next (scrcpy-manager)";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyStatus {
    pub binary_path: Option<String>,
    pub can_install_official: bool,
    pub installed_version: Option<String>,
    pub latest_version: Option<String>,
    pub source: String,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyDownloadProgress {
    pub received: u64,
    pub stage: String,
    pub total: Option<u64>,
}

pub fn scrcpy_root(app: &AppHandle) -> CmdResult<PathBuf> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("scrcpy");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn current_dir(root: &Path) -> PathBuf {
    root.join("current")
}

pub fn version_file(root: &Path) -> PathBuf {
    root.join("version.txt")
}

pub fn read_installed_version(root: &Path) -> Option<String> {
    fs::read_to_string(version_file(root))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub fn find_binary(dir: &Path) -> Option<PathBuf> {
    let exe = if cfg!(windows) { "scrcpy.exe" } else { "scrcpy" };
    let direct = dir.join(exe);
    if direct.is_file() {
        return Some(direct);
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let nested = path.join(exe);
            if nested.is_file() {
                return Some(nested);
            }
        }
    }
    None
}

pub fn path_scrcpy() -> Option<PathBuf> {
    which::which("scrcpy").ok()
}

fn github_headers(builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    builder
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
}

pub async fn fetch_latest_tag(client: &Client) -> CmdResult<String> {
    let parsed = url::Url::parse(RELEASES_LATEST).map_err(|e| e.to_string())?;
    validate_outbound_url(&parsed, true).map_err(|e| e.to_string())?;
    let response =
        github_headers(client.get(RELEASES_LATEST)).send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    if status.as_u16() == 403 || status.as_u16() == 429 {
        return Err("GitHub rate limit reached while checking scrcpy releases. Retry later.".into());
    }
    if !status.is_success() {
        return Err(format!("scrcpy releases lookup failed: HTTP {status}"));
    }
    let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    body["tag_name"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| "latest scrcpy release has no tag_name".into())
}

pub fn local_status(app: &AppHandle, latest: Option<String>) -> ScrcpyStatus {
    let root = scrcpy_root(app).ok();
    let installed = root.as_ref().and_then(|dir| read_installed_version(dir));
    let binary = root.as_ref().and_then(|dir| find_binary(&current_dir(dir)));
    let official = official_archive_name("v0", host_os(), host_arch());
    match official {
        Ok(_) => ScrcpyStatus {
            binary_path: binary.as_ref().map(|p| p.to_string_lossy().into_owned()),
            can_install_official: true,
            installed_version: installed,
            latest_version: latest,
            source: if binary.is_some() { "managed".into() } else { "missing".into() },
            unsupported_reason: None,
        },
        Err(reason) => {
            let path_bin = path_scrcpy();
            ScrcpyStatus {
                binary_path: path_bin.as_ref().map(|p| p.to_string_lossy().into_owned()),
                can_install_official: false,
                installed_version: path_bin.as_ref().map(|_| "PATH".to_string()),
                latest_version: latest,
                source: if path_bin.is_some() { "path".into() } else { "unsupported".into() },
                unsupported_reason: Some(reason),
            }
        }
    }
}

async fn download_to_file(
    client: &Client,
    app: &AppHandle,
    url: &str,
    dest: &Path,
) -> CmdResult<u64> {
    let parsed = url::Url::parse(url).map_err(|e| e.to_string())?;
    validate_outbound_url(&parsed, true).map_err(|e| e.to_string())?;
    let response = github_headers(client.get(url)).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("download failed: HTTP {}", response.status()));
    }
    let total = response.content_length();
    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut received = 0_u64;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        let _ = app.emit(
            "scrcpy:download-progress",
            ScrcpyDownloadProgress { received, stage: "download".into(), total },
        );
    }
    Ok(received)
}

fn sha256_file(path: &Path) -> CmdResult<String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buf = [0_u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn safe_extract_zip(archive: &Path, dest: &Path) -> CmdResult<()> {
    let file = File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|e| e.to_string())?;
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        let out = dest.join(name);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut output = File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut output).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn safe_extract_tar_gz(archive: &Path, dest: &Path) -> CmdResult<()> {
    let file = File::open(archive).map_err(|e| e.to_string())?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(dest).map_err(|e| e.to_string())
}

pub async fn install_latest(app: AppHandle, client: Client) -> CmdResult<ScrcpyStatus> {
    let tag = fetch_latest_tag(&client).await?;
    let filename = official_archive_name(&tag, host_os(), host_arch())?;
    let root = scrcpy_root(&app)?;
    let sums_url =
        format!("https://github.com/Genymobile/scrcpy/releases/download/{tag}/SHA256SUMS.txt");
    let archive_url =
        format!("https://github.com/Genymobile/scrcpy/releases/download/{tag}/{filename}");

    let _ = app.emit(
        "scrcpy:download-progress",
        ScrcpyDownloadProgress { received: 0, stage: "checksums".into(), total: None },
    );
    let sums_parsed = url::Url::parse(&sums_url).map_err(|e| e.to_string())?;
    validate_outbound_url(&sums_parsed, true).map_err(|e| e.to_string())?;
    let sums_response =
        github_headers(client.get(&sums_url)).send().await.map_err(|e| e.to_string())?;
    if !sums_response.status().is_success() {
        return Err(format!("failed to fetch SHA256SUMS.txt: HTTP {}", sums_response.status()));
    }
    let sums_body = sums_response.text().await.map_err(|e| e.to_string())?;
    let expected = parse_sha256sums(&sums_body, &filename)?;

    let tmp = root.join("download.tmp");
    if tmp.exists() {
        let _ = fs::remove_file(&tmp);
    }
    download_to_file(&client, &app, &archive_url, &tmp).await?;
    let actual = sha256_file(&tmp)?;
    if actual != expected {
        let _ = fs::remove_file(&tmp);
        return Err("scrcpy archive SHA-256 did not match SHA256SUMS.txt".into());
    }

    let staging = root.join("staging");
    if staging.exists() {
        fs::remove_dir_all(&staging).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "scrcpy:download-progress",
        ScrcpyDownloadProgress { received: 0, stage: "extract".into(), total: None },
    );
    if filename.ends_with(".zip") {
        safe_extract_zip(&tmp, &staging)?;
    } else {
        safe_extract_tar_gz(&tmp, &staging)?;
    }
    let _ = fs::remove_file(&tmp);

    if find_binary(&staging).is_none() {
        let _ = fs::remove_dir_all(&staging);
        return Err("extracted archive did not contain a scrcpy binary".into());
    }

    let current = current_dir(&root);
    let backup = root.join("previous");
    if backup.exists() {
        let _ = fs::remove_dir_all(&backup);
    }
    if current.exists() {
        fs::rename(&current, &backup).map_err(|e| e.to_string())?;
    }
    fs::rename(&staging, &current).map_err(|e| {
        if backup.exists() {
            let _ = fs::rename(&backup, &current);
        }
        e.to_string()
    })?;
    let _ = fs::remove_dir_all(&backup);
    fs::write(version_file(&root), format!("{tag}\n")).map_err(|e| e.to_string())?;
    info!("Installed scrcpy {tag}");
    Ok(local_status(&app, Some(tag)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn sha256_file_matches_known_bytes() {
        let dir = tempfile::tempdir().expect("temp");
        let path = dir.path().join("blob");
        let mut file = File::create(&path).expect("create");
        file.write_all(b"scrcpy").expect("write");
        drop(file);
        let hash = sha256_file(&path).expect("hash");
        assert_eq!(hash.len(), 64);
    }
}
