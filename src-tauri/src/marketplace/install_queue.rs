use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use log::info;
use reqwest::Client;
use reqwest::redirect::Policy;
use tauri::{AppHandle, Emitter};
use tempfile::NamedTempFile;
use tokio::io::AsyncWriteExt;

use super::types::DownloadProgressPayload;
use crate::CmdResult;

const PROGRESS_THROTTLE_MS: u128 = 125; // 8 Hz event rate

fn marketplace_download_root() -> CmdResult<PathBuf> {
    let base = std::env::temp_dir().join("adb-gui-next-marketplace");
    std::fs::create_dir_all(&base)
        .map_err(|e| format!("Failed to create download directory: {e}"))?;
    Ok(base)
}

pub fn is_owned_marketplace_download(path: &Path) -> bool {
    let Ok(root) = marketplace_download_root() else {
        return false;
    };
    let Ok(canonical_root) = root.canonicalize() else {
        return false;
    };
    let Ok(canonical_path) = path.canonicalize() else {
        return false;
    };
    canonical_path.starts_with(&canonical_root)
}

/// Download an APK with chunked streaming and real-time progress events.
pub async fn download_apk_streaming(
    app: &AppHandle,
    client: &Client,
    url: url::Url,
    package_name: &str,
    download_id: &str,
) -> CmdResult<String> {
    info!("Starting streaming download for {package_name} from {url}");

    let response = client
        .get(url.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to send download request: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Download server returned HTTP {status}"));
    }

    let total_bytes = response.content_length();

    // Create a temp file in the dedicated marketplace download directory
    let temp_file = NamedTempFile::new_in(marketplace_download_root()?)
        .map_err(|e| format!("Failed to create temp file: {e}"))?;
    let (_, file_path) =
        temp_file.keep().map_err(|e| format!("Failed to persist temp file: {e}"))?;

    let mut async_file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to open file for writing: {e}"))?;

    let mut stream = response.bytes_stream();
    let mut bytes_downloaded: u64 = 0;
    let start_time = Instant::now();
    let mut last_emit_time = Instant::now();
    let mut last_bytes_at_emit: u64 = 0;

    // Initial 0% progress event
    let _ = app.emit(
        "marketplace:download-progress",
        DownloadProgressPayload {
            download_id: download_id.to_string(),
            package_name: package_name.to_string(),
            bytes_downloaded: 0,
            total_bytes,
            speed_bps: 0,
            percentage: 0.0,
            eta_seconds: None,
        },
    );

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error during download: {e}"))?;
        async_file
            .write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk to disk: {e}"))?;

        bytes_downloaded += chunk.len() as u64;

        let now = Instant::now();
        let elapsed_since_last_emit = now.duration_since(last_emit_time).as_millis();

        if elapsed_since_last_emit >= PROGRESS_THROTTLE_MS {
            let interval_secs = (elapsed_since_last_emit as f64) / 1000.0;
            let delta_bytes = bytes_downloaded.saturating_sub(last_bytes_at_emit);
            let speed_bps =
                if interval_secs > 0.0 { (delta_bytes as f64 / interval_secs) as u64 } else { 0 };
            let percentage = total_bytes.map_or(0.0, |total| {
                if total > 0 { (bytes_downloaded as f64 / total as f64) * 100.0 } else { 0.0 }
            });
            let eta_seconds = total_bytes.and_then(|total| {
                if total > bytes_downloaded && speed_bps > 0 {
                    Some((total - bytes_downloaded) / speed_bps)
                } else {
                    None
                }
            });

            let _ = app.emit(
                "marketplace:download-progress",
                DownloadProgressPayload {
                    download_id: download_id.to_string(),
                    package_name: package_name.to_string(),
                    bytes_downloaded,
                    total_bytes,
                    speed_bps,
                    percentage,
                    eta_seconds,
                },
            );

            last_emit_time = now;
            last_bytes_at_emit = bytes_downloaded;
        }
    }

    async_file.flush().await.map_err(|e| format!("Failed to flush APK to disk: {e}"))?;

    if bytes_downloaded == 0 {
        let _ = tokio::fs::remove_file(&file_path).await;
        return Err("Downloaded file is empty (0 bytes)".into());
    }

    // Final 100% completion event
    let total_secs = start_time.elapsed().as_secs_f64();
    let avg_speed_bps =
        if total_secs > 0.0 { (bytes_downloaded as f64 / total_secs) as u64 } else { 0 };

    let _ = app.emit(
        "marketplace:download-progress",
        DownloadProgressPayload {
            download_id: download_id.to_string(),
            package_name: package_name.to_string(),
            bytes_downloaded,
            total_bytes: Some(bytes_downloaded),
            speed_bps: avg_speed_bps,
            percentage: 100.0,
            eta_seconds: Some(0),
        },
    );

    let path_str = file_path.to_string_lossy().to_string();
    info!("Streaming download complete for {package_name}: {bytes_downloaded} bytes at {path_str}");
    Ok(path_str)
}

/// Create a dedicated download client with 300s timeout and connection reuse.
pub fn create_download_client() -> CmdResult<Client> {
    Client::builder()
        .user_agent(concat!("ADB-GUI-Next/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(15))
        .pool_max_idle_per_host(8)
        .tcp_nodelay(true)
        .redirect(Policy::limited(5))
        .build()
        .map_err(|e| format!("Failed to create download client: {e}"))
}
