use crate::{CmdResult, emulator::models::MagiskStableRelease};
use std::path::{Path, PathBuf};

// ─── GitHub releases API ──────────────────────────────────────────────────────

const MAGISK_RELEASES_LATEST: &str =
    "https://api.github.com/repos/topjohnwu/Magisk/releases/latest";

/// Fetch the latest official stable Magisk release from the GitHub releases API.
///
/// The `/releases/latest` endpoint always returns a non-prerelease, non-draft
/// release — guaranteed stable by GitHub's API contract.
///
/// Uses a blocking `reqwest` client — call from a `spawn_blocking` context.
pub fn fetch_magisk_stable_release() -> CmdResult<MagiskStableRelease> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("adb-gui-next/1.0")
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let response = client
        .get(MAGISK_RELEASES_LATEST)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .map_err(|e| format!("Failed to contact GitHub API: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 403 || status.as_u16() == 429 {
            return Err(
                "GitHub API rate limit exceeded. Try again later or pick a local file.".into()
            );
        }
        return Err(format!("GitHub API returned HTTP {status}"));
    }

    let body: serde_json::Value =
        response.json().map_err(|e| format!("Failed to parse GitHub API response: {e}"))?;

    parse_stable_release(&body)
}

/// Parse the GitHub releases API JSON into a [`MagiskStableRelease`].
///
/// Asset selection rules (in priority order):
/// 1. Name starts with `"Magisk-"` and ends with `".apk"` — the official release APK.
/// 2. Any other `.apk` with the highest `download_count` — future-proof fallback.
///
/// Explicitly excluded: `app-debug.apk` (debug build, not for end users).
fn parse_stable_release(body: &serde_json::Value) -> CmdResult<MagiskStableRelease> {
    let tag = body["tag_name"].as_str().unwrap_or("").to_string();
    if tag.is_empty() {
        return Err("GitHub API response missing 'tag_name'".into());
    }

    let version = body["name"].as_str().unwrap_or(&tag).trim_start_matches("Magisk ").to_string();

    let published_at = body["published_at"].as_str().unwrap_or("").to_string();

    let assets = body["assets"].as_array().ok_or("No 'assets' array in GitHub release")?;

    let apk_asset =
        pick_best_apk(assets).ok_or_else(|| format!("No APK asset found in release {tag}"))?;

    let download_url = apk_asset["browser_download_url"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("APK asset in release {tag} has no download URL"))?
        .to_string();

    let asset_name = apk_asset["name"].as_str().unwrap_or("Magisk.apk").to_string();
    let size = apk_asset["size"].as_u64().unwrap_or(0);

    // Extract SHA-256 digest when GitHub provides it (format: "sha256:<hex>").
    let sha256 =
        apk_asset["digest"].as_str().and_then(|d| d.strip_prefix("sha256:")).map(str::to_string);

    Ok(MagiskStableRelease { version, tag, asset_name, download_url, size, sha256, published_at })
}

/// Select the best APK from a release's asset list.
fn pick_best_apk(assets: &[serde_json::Value]) -> Option<&serde_json::Value> {
    // Priority 1: official "Magisk-*.apk"
    let official = assets.iter().find(|a| {
        let name = a["name"].as_str().unwrap_or("");
        name.starts_with("Magisk-") && name.ends_with(".apk")
    });
    if official.is_some() {
        return official;
    }

    // Fallback: any non-debug APK with the highest download count.
    assets
        .iter()
        .filter(|a| {
            let name = a["name"].as_str().unwrap_or("");
            name.ends_with(".apk") && name != "app-debug.apk"
        })
        .max_by_key(|a| a["download_count"].as_u64().unwrap_or(0))
}

// ─── Download ─────────────────────────────────────────────────────────────────

/// Download the Magisk APK for the given stable release into `target_dir`.
///
/// Skips re-download if a file with the same release tag already exists
/// (cached by `"Magisk-{tag}.apk"`).
///
/// Uses a blocking `reqwest` client — call from a `spawn_blocking` context.
pub fn download_magisk_stable(
    release: &MagiskStableRelease,
    target_dir: &Path,
) -> CmdResult<PathBuf> {
    std::fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

    // Stable cache key: "Magisk-v30.7.apk" (tag is e.g. "v30.7").
    let file_name = format!("Magisk-{}.apk", release.tag);
    let dest = target_dir.join(&file_name);

    if dest.exists() {
        log::info!("Magisk {} already cached at {:?}", release.tag, dest);
        return Ok(dest);
    }

    log::info!(
        "Downloading Magisk {} ({}) from {}",
        release.tag,
        release.asset_name,
        release.download_url
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .user_agent("adb-gui-next/1.0")
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mut response =
        client.get(&release.download_url).send().map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download returned HTTP {} for {}",
            response.status(),
            release.download_url
        ));
    }

    let mut out = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
    std::io::copy(&mut response, &mut out).map_err(|e| e.to_string())?;

    log::info!("Downloaded Magisk {} to {:?}", release.tag, dest);
    Ok(dest)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_release(assets: serde_json::Value) -> serde_json::Value {
        json!({
            "tag_name": "v30.7",
            "name": "Magisk v30.7",
            "published_at": "2026-02-23T08:07:01Z",
            "assets": assets,
        })
    }

    #[test]
    fn parse_picks_official_magisk_apk() {
        let body = make_release(json!([
            {
                "name": "app-debug.apk",
                "browser_download_url": "https://example.com/debug.apk",
                "size": 25_000_000u64,
                "download_count": 61_000u64,
                "digest": null
            },
            {
                "name": "Magisk-v30.7.apk",
                "browser_download_url": "https://github.com/release/Magisk-v30.7.apk",
                "size": 11_600_000u64,
                "download_count": 527_000u64,
                "digest": "sha256:abc123"
            },
            {
                "name": "notes.md",
                "browser_download_url": "https://example.com/notes.md",
                "size": 582u64,
                "download_count": 7_000u64,
                "digest": null
            }
        ]));

        let release = parse_stable_release(&body).unwrap();
        assert_eq!(release.tag, "v30.7");
        assert_eq!(release.version, "Magisk v30.7");
        assert_eq!(release.asset_name, "Magisk-v30.7.apk");
        assert!(release.download_url.contains("Magisk-v30.7.apk"));
        assert_eq!(release.sha256.as_deref(), Some("abc123"));
    }

    #[test]
    fn parse_falls_back_to_highest_download_count_apk() {
        let body = make_release(json!([
            {
                "name": "app-debug.apk",
                "browser_download_url": "https://example.com/debug.apk",
                "size": 25_000_000u64,
                "download_count": 1_000u64,
                "digest": null
            },
            {
                "name": "release.apk",
                "browser_download_url": "https://example.com/release.apk",
                "size": 10_000_000u64,
                "download_count": 500_000u64,
                "digest": null
            }
        ]));

        let release = parse_stable_release(&body).unwrap();
        assert_eq!(release.asset_name, "release.apk");
    }

    #[test]
    fn parse_errors_when_no_suitable_apk() {
        let body = make_release(json!([
            {
                "name": "notes.md",
                "browser_download_url": "https://example.com/notes.md",
                "size": 100u64,
                "download_count": 0u64,
                "digest": null
            }
        ]));
        assert!(parse_stable_release(&body).is_err());
    }

    #[test]
    fn parse_errors_when_tag_missing() {
        let body = json!({
            "tag_name": "",
            "name": "Magisk",
            "published_at": "2026-01-01",
            "assets": []
        });
        assert!(parse_stable_release(&body).is_err());
    }
}
