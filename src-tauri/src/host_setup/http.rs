//! HTTPS download with hop-by-hop URL validation (no automatic redirects).

use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::Path;
use std::time::Duration;

use futures_util::StreamExt;
use reqwest::Client;
use reqwest::redirect::Policy;
use sha1::Digest;
use tauri::{AppHandle, Emitter};

use crate::CmdResult;
use crate::payload::remote::{resolve_redirect_url, validate_outbound_url};

use super::catalog::{ChecksumAlgo, SdkPackage};
use super::{HostSetupProgress, PROGRESS_EVENT};

const MAX_REDIRECTS: usize = 5;
const USER_AGENT: &str = concat!("ADB-GUI-Next/", env!("CARGO_PKG_VERSION"));

pub fn http_client() -> CmdResult<Client> {
    Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(600))
        .connect_timeout(Duration::from_secs(20))
        .redirect(Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

pub async fn fetch_text(client: &Client, url: &str) -> CmdResult<String> {
    let response = get_validated(client, url).await?;
    if !response.status().is_success() {
        return Err(format!("catalog download failed: HTTP {}", response.status()));
    }
    response.text().await.map_err(|e| e.to_string())
}

pub async fn download_package(
    client: &Client,
    app: &AppHandle,
    package: &SdkPackage,
    dest: &Path,
    stage: &str,
) -> CmdResult<()> {
    if dest.exists() {
        let _ = std::fs::remove_file(dest);
    }
    let response = get_validated(client, &package.url).await?;
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
        emit_progress(app, stage, received, total);
    }
    drop(file);
    verify_checksum(dest, package)?;
    Ok(())
}

fn emit_progress(app: &AppHandle, stage: &str, received: u64, total: Option<u64>) {
    let _ =
        app.emit(PROGRESS_EVENT, HostSetupProgress { received, stage: stage.to_string(), total });
}

async fn get_validated(client: &Client, url: &str) -> CmdResult<reqwest::Response> {
    let mut current = url::Url::parse(url).map_err(|e| format!("invalid URL '{url}': {e}"))?;
    for _ in 0..=MAX_REDIRECTS {
        validate_outbound_url(&current, true)
            .map_err(|e| format!("host-setup URL rejected: {e}"))?;
        let response =
            client.get(current.clone()).send().await.map_err(|e| format!("request failed: {e}"))?;
        if !response.status().is_redirection() {
            return Ok(response);
        }
        let location = response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| "redirect has no Location header".to_string())?;
        current = resolve_redirect_url(&current, location)
            .map_err(|e| format!("invalid redirect: {e}"))?;
    }
    Err(format!("too many redirects (max {MAX_REDIRECTS})"))
}

fn verify_checksum(path: &Path, package: &SdkPackage) -> CmdResult<()> {
    let actual = match package.checksum_algo {
        ChecksumAlgo::Sha256 => hex::encode(
            crate::payload::verify::compute_file_sha256(path)
                .map_err(|e| format!("failed to hash {}: {e}", path.display()))?,
        ),
        ChecksumAlgo::Sha1 => sha1_file(path)?,
    };
    if actual.eq_ignore_ascii_case(package.checksum_hex.trim()) {
        Ok(())
    } else {
        let _ = std::fs::remove_file(path);
        Err(format!(
            "checksum mismatch for {} (expected {}, got {actual})",
            package.url, package.checksum_hex
        ))
    }
}

fn sha1_file(path: &Path) -> CmdResult<String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut hasher = sha1::Sha1::new();
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
