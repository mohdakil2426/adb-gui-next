# ADB GUI Kit — App Store Integration Plan
> Tauri 2.0 | TypeScript Frontend + Rust Backend

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Supported Providers](#supported-providers)
4. [Project Structure](#project-structure)
5. [Cargo Dependencies](#cargo-dependencies)
6. [Provider Implementations](#provider-implementations)
   - [F-Droid](#1-f-droid)
   - [IzzyOnDroid](#2-izzyondroid)
   - [MicroG & Custom F-Droid Repos](#3-microg--custom-f-droid-repos)
   - [GitHub Releases](#4-github-releases)
   - [Aptoide](#5-aptoide)
   - [Uptodown](#6-uptodown)
7. [Rust Command Registry](#rust-command-registry)
8. [TypeScript Store Layer](#typescript-store-layer)
9. [Frontend UI Plan](#frontend-ui-plan)
10. [ADB Install Integration](#adb-install-integration)
11. [Provider Comparison](#provider-comparison)
12. [Implementation Roadmap](#implementation-roadmap)
13. [Provider Reference Links](#provider-reference-links)

---

## Overview

ADB GUI Kit will include a built-in **App Store Browser** that allows users to:
- Search and browse apps from multiple sources
- View app metadata (version, description, permissions)
- Download APKs directly
- Install APKs to connected devices via ADB in one click

This plan covers all providers researched, their APIs, Rust backend commands, and TypeScript frontend integration.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              TypeScript Frontend                │
│   (Store UI — Search, Browse, Install Button)   │
└────────────────────┬────────────────────────────┘
                     │ invoke()
┌────────────────────▼────────────────────────────┐
│              Tauri IPC Bridge                   │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│              Rust Backend Commands               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ F-Droid  │ │  Aptoide │ │  GitHub Releases │  │
│  │ reqwest  │ │  reqwest │ │     reqwest      │  │
│  └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌──────────┐ ┌──────────┐                       │
│  │IzzyOnDrd │ │Uptodown  │                       │
│  │ reqwest  │ │(scraping)│                       │
│  └──────────┘ └──────────┘                       │
└────────────────────┬────────────────────────────┘
                     │ adb install
┌────────────────────▼────────────────────────────┐
│           Connected Android Device              │
└─────────────────────────────────────────────────┘
```

---

## Supported Providers

| # | Provider         | Type              | Auth     | ToS Safe | Rust Native  |
|---|------------------|-------------------|----------|----------|--------------|
| 1 | F-Droid          | Official REST API | None     | ✅ Yes   | ✅ reqwest  |
| 2 | IzzyOnDroid      | Official REST API | None     | ✅ Yes   | ✅ reqwest  |
| 3 | MicroG / Custom  | F-Droid Repo      | None     | ✅ Yes   | ✅ reqwest  |
| 4 | GitHub Releases  | Official REST API | Optional | ✅ Yes   | ✅ reqwest  |
| 5 | Aptoide          | Public REST API   | None     | ✅ Yes   | ✅ reqwest  |
| 6 | Uptodown         | HTML Scraping     | None     | ⚠️ Grey  | ✅ scraper  |

---

## Project Structure

```
src-tauri/
├── src/
│   ├── main.rs
│   ├── lib.rs
│   └── store/
│       ├── mod.rs
│       ├── fdroid.rs          # F-Droid + IzzyOnDroid + all F-Droid repos
│       ├── github.rs          # GitHub Releases API
│       ├── aptoide.rs         # Aptoide public API (ws75)
│       ├── uptodown.rs        # Uptodown HTML scraper
│       └── models.rs          # Shared structs: AppInfo, SearchResult, etc.
└── Cargo.toml

src/
├── lib/
│   └── store/
│       ├── index.ts           # Main store API (invoke wrappers)
│       ├── providers.ts       # Provider config & repo list
│       ├── types.ts           # TypeScript types
│       └── cache.ts           # Local result caching
└── routes/
    └── store/
        ├── +page.svelte       # Store main page
        ├── search.svelte      # Search results
        └── app-detail.svelte  # App detail + install
```

---

## Cargo Dependencies

```toml
# src-tauri/Cargo.toml

[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
futures-util = "0.3"
anyhow = "1.0"
# HTML parsing for Uptodown scraper
scraper = "0.21"
```

---

## Provider Implementations

---

### 1. F-Droid

**Official REST API — No auth, fully stable.**

**`src-tauri/src/store/fdroid.rs`**

```rust
use reqwest::Client;
use serde_json::Value;

// Get single app metadata by package name
#[tauri::command]
pub async fn fdroid_get_app(package: String) -> Result<Value, String> {
    let url = format!("https://f-droid.org/api/v1/packages/{}", package);
    Client::new()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())
}

// Search apps — use Meilisearch-powered endpoint (better than v1 packages)
#[tauri::command]
pub async fn fdroid_search(query: String) -> Result<Value, String> {
    let url = format!(
        "https://search.f-droid.org/api/search_apps?q={}&lang=en",
        query
    );
    Client::new()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())
}

// Fetch entire repo index (all apps + metadata)
#[tauri::command]
pub async fn fdroid_get_index() -> Result<Value, String> {
    let url = "https://f-droid.org/repo/index-v2.json";
    Client::new()
        .get(url)
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())
}

// Download APK to local temp path
#[tauri::command]
pub async fn fdroid_download_apk(
    package: String,
    version_code: String,
    dest_path: String,
) -> Result<String, String> {
    let url = format!(
        "https://f-droid.org/repo/{}_{}.apk",
        package, version_code
    );
    let bytes = Client::new()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(dest_path)
}
```

**TypeScript:**
```typescript
import { invoke } from "@tauri-apps/api/core";

export const fdroid = {
  search: (query: string) => invoke<any>("fdroid_search", { query }),
  getApp: (pkg: string) => invoke<any>("fdroid_get_app", { package: pkg }),
  getIndex: () => invoke<any>("fdroid_get_index"),
  downloadApk: (pkg: string, versionCode: string, destPath: string) =>
    invoke<string>("fdroid_download_apk", { package: pkg, versionCode, destPath }),
};
```

---

### 2. IzzyOnDroid

**Same F-Droid API format — just different base URL.**

```rust
// src-tauri/src/store/fdroid.rs (add to same file)

#[tauri::command]
pub async fn izzy_get_app(package: String) -> Result<Value, String> {
    let url = format!(
        "https://apt.izzysoft.de/fdroid/api/v1/packages/{}",
        package
    );
    Client::new()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn izzy_get_index() -> Result<Value, String> {
    Client::new()
        .get("https://apt.izzysoft.de/fdroid/repo/index-v2.json")
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())
}
```

---

### 3. MicroG & Custom F-Droid Repos

**Neo Store inspired — generic repo fetcher for any F-Droid-compatible repo.**

```rust
// src-tauri/src/store/fdroid.rs

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct FdroidRepo {
    pub name: String,
    pub address: String, // base URL without trailing slash
}

// Returns all hardcoded default repos (Neo Store's list)
#[tauri::command]
pub fn get_default_repos() -> Vec<FdroidRepo> {
    vec![
        FdroidRepo { name: "F-Droid".into(),        address: "https://f-droid.org/repo".into() },
        FdroidRepo { name: "IzzyOnDroid".into(),     address: "https://apt.izzysoft.de/fdroid/repo".into() },
        FdroidRepo { name: "MicroG".into(),          address: "https://microg.org/fdroid/repo".into() },
        FdroidRepo { name: "Bromite".into(),         address: "https://fdroid.bromite.org/fdroid/repo".into() },
        FdroidRepo { name: "Guardian Project".into(), address: "https://guardianproject.info/fdroid/repo".into() },
        FdroidRepo { name: "CalyxOS".into(),         address: "https://fdroid.calyxinstitute.org/repo".into() },
    ]
}

// Generic: fetch index-v2.json from any repo URL
#[tauri::command]
pub async fn fetch_repo_index(address: String) -> Result<Value, String> {
    let url = format!("{}/index-v2.json", address);
    Client::new()
        .get(&url)
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())
}
```

**TypeScript:**
```typescript
export const repos = {
  getDefaults: () => invoke<FdroidRepo[]>("get_default_repos"),
  fetchIndex: (address: string) => invoke<any>("fetch_repo_index", { address }),
};
```

---

### 4. GitHub Releases (GitHub-Store Model)

> **Inspiration:** [GitHub-Store](https://github.com/OpenHub-Store/GitHub-Store) by OpenHub-Store
> ⭐ 10,000+ stars | 160,000+ users | v1.7.0 (March 2026) | Apache-2.0
> Listed on F-Droid, featured by HowToMen & HelloGitHub
>
> GitHub-Store is a **Kotlin + Compose Multiplatform** app (Android + Desktop)
> that proves the GitHub-as-app-store concept at scale. Their key insight:
> **use the GitHub Search API** to discover apps automatically — no curated
> lists needed. Only repos that have real installable assets (`.apk`, `.exe`,
> `.msi`, etc.) are surfaced, filtering out source-only noise.
>
> We adopt their proven approach for our Rust backend.

**GitHub-Store key design decisions we adopt:**

| Decision | How GitHub-Store does it | Our implementation |
|---|---|---|
| **Discovery** | GitHub Search API (`/search/repositories`) with topic + asset filters | ✅ Same — `github_search_android_apps` |
| **APK filtering** | Only show releases with `.apk` assets attached | ✅ Same — filter assets by extension |
| **Trending** | `sort=stars` + `sort=updated` feeds | ✅ Same — `sort` param |
| **Rate limits** | Unauthenticated: 10 req/min; authenticated: 30 req/min | ✅ Optional PAT support |
| **Asset picker** | Find the right binary per platform from release assets | ✅ Filter `name.endsWith(".apk")` |
| **Signing verify** | APK signing fingerprint + GitHub Artifact Attestation | 🔶 Phase 4 |
| **Link apps** | Connect installed apps → GitHub repos for update tracking | 🔶 Phase 4 |
| **Update tracking** | Background update checks; Shizuku silent install (Android) | 🔶 Out of scope (desktop ADB) |

**`src-tauri/src/store/github.rs`**

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const GITHUB_API: &str = "https://api.github.com";

// ── Shared client builder ────────────────────────────────────────────────────
// Pass optional Personal Access Token (PAT) to raise rate limit from
// 10 req/min (unauthenticated) → 30 req/min (authenticated).
// GitHub-Store uses the same approach.
fn github_client(token: Option<&str>) -> Result<Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("ADB-GUI-Kit/1.0"),
    );
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/vnd.github+json"),
    );
    if let Some(tok) = token {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!("Bearer {}", tok))
                .map_err(|e| e.to_string())?,
        );
    }
    Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())
}

// ── Search repos (GitHub-Store model) ───────────────────────────────────────
//
// Uses GitHub Search API to discover Android apps — same strategy as GitHub-Store.
// Qualifiers used (from GitHub-Store source + Search API docs):
//   - topic:android          → only repos tagged as Android apps
//   - has:releases            → must have at least one published release
//   - NOT topic:library       → exclude bare libraries
//
// sort options: "stars" | "forks" | "updated" (maps to GitHub-Store's feeds)
// Returns raw GitHub search response — caller extracts `.items[]`
//
// API: GET /search/repositories?q=<query>+topic:android+has:releases&sort=<sort>&per_page=<n>
#[tauri::command]
pub async fn github_search_android_apps(
    query: String,
    sort: Option<String>,  // "stars" | "updated" | "forks" | default: "stars"
    page: Option<u32>,
    per_page: Option<u32>,
    token: Option<String>,
) -> Result<Value, String> {
    let sort = sort.unwrap_or_else(|| "stars".to_string());
    let page = page.unwrap_or(1);
    let per_page = per_page.unwrap_or(20).min(100);

    // Build search query — same qualifiers GitHub-Store uses
    let full_query = if query.trim().is_empty() {
        // Empty query = browse trending Android apps
        "topic:android+has:releases+NOT+topic:library".to_string()
    } else {
        format!(
            "{}+topic:android+has:releases+NOT+topic:library",
            urlencoding::encode(&query)
        )
    };

    let url = format!(
        "{}/search/repositories?q={}&sort={}&order=desc&page={}&per_page={}",
        GITHUB_API, full_query, sort, page, per_page
    );

    github_client(token.as_deref())?
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

// ── Get latest release + filter APK assets ──────────────────────────────────
//
// For a specific repo, gets the latest release and returns ONLY the APK assets.
// GitHub-Store uses the same filtering: show only installable assets per platform.
//
// Returns:
//   {
//     "tag":       "v1.2.3",
//     "name":      "App Name v1.2.3",
//     "body":      "Release notes...",
//     "published": "2026-03-28T13:16:12Z",
//     "apk_assets": [
//       { "name": "app-release.apk", "size": 12345678, "download_url": "https://..." },
//       ...
//     ]
//   }
#[tauri::command]
pub async fn github_get_apk_release(
    repo: String,       // "owner/repo-name"
    token: Option<String>,
) -> Result<Value, String> {
    let url = format!("{}/repos/{}/releases/latest", GITHUB_API, repo);
    let release: Value = github_client(token.as_deref())?
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // Filter assets to only APKs (GitHub-Store filters per platform)
    let empty = vec![];
    let assets = release["assets"].as_array().unwrap_or(&empty);
    let apk_assets: Vec<Value> = assets
        .iter()
        .filter(|a| {
            a["name"]
                .as_str()
                .map(|n| n.to_lowercase().ends_with(".apk"))
                .unwrap_or(false)
        })
        .map(|a| {
            serde_json::json!({
                "name":         a["name"],
                "size":         a["size"],
                "download_url": a["browser_download_url"],
                "download_count": a["download_count"],
            })
        })
        .collect();

    Ok(serde_json::json!({
        "tag":       release["tag_name"],
        "name":      release["name"],
        "body":      release["body"],
        "published": release["published_at"],
        "apk_assets": apk_assets,
        "html_url":  release["html_url"],
    }))
}

// ── List all releases (for version history UI) ───────────────────────────────
#[tauri::command]
pub async fn github_list_releases(
    repo: String,
    token: Option<String>,
) -> Result<Value, String> {
    let url = format!("{}/repos/{}/releases", GITHUB_API, repo);
    github_client(token.as_deref())?
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

// ── Get repo metadata (for app detail card) ──────────────────────────────────
#[tauri::command]
pub async fn github_get_repo(
    repo: String,
    token: Option<String>,
) -> Result<Value, String> {
    let url = format!("{}/repos/{}", GITHUB_API, repo);
    github_client(token.as_deref())?
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

// ── Download APK asset to disk ───────────────────────────────────────────────
// download_url: the `browser_download_url` from the release asset
#[tauri::command]
pub async fn github_download_apk(
    download_url: String,
    dest_path: String,
    token: Option<String>,
) -> Result<String, String> {
    let bytes = github_client(token.as_deref())?
        .get(&download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    std::fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(dest_path)
}
```

> **Note on `urlencoding`:** Add `urlencoding = "2"` to `Cargo.toml` or use
> `percent_encoding` from `reqwest`'s included deps. Alternatively, use
> `reqwest`'s `Url::parse_with_params` to handle encoding automatically.

**GitHub Search API — response shape (`.items[]`):**
```json
{
  "total_count": 1234,
  "items": [
    {
      "full_name": "signalapp/Signal-Android",
      "name": "Signal-Android",
      "description": "A private messenger",
      "html_url": "https://github.com/signalapp/Signal-Android",
      "stargazers_count": 26000,
      "topics": ["android", "privacy"],
      "language": "Kotlin",
      "pushed_at": "2026-03-28T10:00:00Z",
      "license": { "spdx_id": "AGPL-3.0" },
      "owner": {
        "login": "signalapp",
        "avatar_url": "https://avatars.githubusercontent.com/u/..."
      }
    }
  ]
}
```

**TypeScript:**
```typescript
interface GitHubApkAsset {
  name: string;
  size: number;
  downloadUrl: string;
  downloadCount: number;
}

interface GitHubRelease {
  tag: string;
  name: string;
  body: string;
  published: string;
  apkAssets: GitHubApkAsset[];
  htmlUrl: string;
}

interface GitHubRepo {
  fullName: string;
  name: string;
  description: string;
  htmlUrl: string;
  stargazersCount: number;
  topics: string[];
  language: string;
  pushedAt: string;
  owner: { login: string; avatarUrl: string };
}

export const github = {
  // ---------- Discovery (GitHub-Store model) ----------------------------------

  // Browse trending Android FOSS apps — same as GitHub-Store's home feed
  trending: (page = 1) =>
    invoke<any>("github_search_android_apps", {
      query: "",        // empty = pure trending
      sort: "stars",
      page,
      perPage: 20,
    }),

  // "Hot" feed — recently updated active projects
  recentlyUpdated: (page = 1) =>
    invoke<any>("github_search_android_apps", {
      query: "",
      sort: "updated",
      page,
      perPage: 20,
    }),

  // Search by keyword (user types in search box)
  search: (query: string, page = 1) =>
    invoke<any>("github_search_android_apps", {
      query,
      sort: "stars",
      page,
      perPage: 20,
    }),

  // ---------- Release & download ----------------------------------------------

  // Get latest release, filtered to APK assets only
  getApkRelease: (repo: string) =>
    invoke<GitHubRelease>("github_get_apk_release", { repo }),

  // Full release history (for version history UI)
  listReleases: (repo: string) =>
    invoke<any>("github_list_releases", { repo }),

  // Get repo metadata (stars, description, topics, license, etc.)
  getRepo: (repo: string) =>
    invoke<GitHubRepo>("github_get_repo", { repo }),

  // Download an APK asset to disk
  downloadApk: (downloadUrl: string, destPath: string) =>
    invoke<string>("github_download_apk", { downloadUrl, destPath }),
};

// ── Full workflow example ────────────────────────────────────────────────────
// 1. User searches "signal"
const searchResults = await github.search("signal");
const repos = searchResults.items; // array of GitHub repos

// 2. User picks a repo, we fetch its latest APK release
const release = await github.getApkRelease("signalapp/Signal-Android");
// release.apkAssets = [{ name: "Signal-release.apk", downloadUrl: "https://..." }]

// 3. Download the first APK
const dest = "C:/Users/user/Downloads/signal.apk";
const localPath = await github.downloadApk(release.apkAssets[0].downloadUrl, dest);

// 4. Install via ADB
await invoke("adb_install_apk", { serial: selectedDevice, apkPath: localPath });
```

> **Rate Limit Guidance (from GitHub-Store experience):**
> - **Unauthenticated:** 10 requests/minute for Search API, 60 req/min for other endpoints
> - **With PAT (Personal Access Token):** 30 req/min for Search, 5000 req/hour other
> - **Recommendation:** Let users optionally set a GitHub PAT in settings (as GitHub-Store does)
>   to significantly improve reliability when browsing many apps.
> - **Cache strategy:** Cache search results for 5 minutes, release metadata for 30 minutes.
>   GitHub-Store uses two-phase loading with caching for its topic results.
>
> **App listing criteria** (GitHub-Store's model — automatic, no submission needed):
> - Public repository on GitHub
> - At least one published, non-draft release
> - Has `.apk` assets attached to the release
> - Relevant topics (android, kotlin-android, etc.) for discoverability

---

### 5. Aptoide

**Public REST API — No auth required. ~1 million apps. ToS-compliant.**

> **Docs:** https://docs.connect.aptoide.com/docs/overview
> **API Base:** `https://ws75.aptoide.com/api/7/`
>
> Aptoide's public consumer API (`ws75`) exposes app search, metadata, and
> direct APK download URLs. The **Aptoide Connect** developer portal
> (docs.connect.aptoide.com) covers developer/publisher tooling (app
> submission, in-app billing, statistics), which is out of scope here — we
> use the public browsing API only.

**`src-tauri/src/store/aptoide.rs`**

```rust
use reqwest::Client;
use serde_json::Value;

const APTOIDE_API: &str = "https://ws75.aptoide.com/api/7";

// Search apps by keyword
// GET /apps/search?query=<query>&limit=<limit>&language=<lang>
#[tauri::command]
pub async fn aptoide_search(query: String, limit: Option<u32>) -> Result<Value, String> {
    let limit = limit.unwrap_or(25);
    let url = format!(
        "{}/apps/search?query={}&limit={}&language=en",
        APTOIDE_API, query, limit
    );
    Client::new()
        .get(&url)
        .header("User-Agent", "ADB-GUI-Kit/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

// Get full app metadata by package name
// GET /app/getMeta?package_name=<package>
#[tauri::command]
pub async fn aptoide_get_app(package_name: String) -> Result<Value, String> {
    let url = format!(
        "{}/app/getMeta?package_name={}",
        APTOIDE_API, package_name
    );
    Client::new()
        .get(&url)
        .header("User-Agent", "ADB-GUI-Kit/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

// Download APK — resolves download URL from getMeta, then streams to disk
// The `file.path.url` field in getMeta response contains the direct APK link.
#[tauri::command]
pub async fn aptoide_download_apk(
    package_name: String,
    dest_path: String,
) -> Result<String, String> {
    // Step 1: resolve download URL from metadata
    let meta_url = format!("{}/app/getMeta?package_name={}", APTOIDE_API, package_name);
    let meta: Value = Client::new()
        .get(&meta_url)
        .header("User-Agent", "ADB-GUI-Kit/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let apk_url = meta
        .pointer("/nodes/meta/data/file/path/url")
        .and_then(|v| v.as_str())
        .ok_or("APK URL not found in Aptoide metadata")?
        .to_string();

    // Step 2: download the APK
    let bytes = Client::new()
        .get(&apk_url)
        .header("User-Agent", "ADB-GUI-Kit/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    std::fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(dest_path)
}
```

**Response shape (from `apps/search`):**
```json
{
  "datalist": {
    "list": [
      {
        "id": 12345,
        "name": "App Name",
        "package": "com.example.app",
        "icon": "https://...",
        "rating": { "avg": 4.2 },
        "file": {
          "vername": "1.2.3",
          "vercode": 123,
          "path": { "url": "https://pool.aptoide.com/..." }
        }
      }
    ]
  }
}
```

**Response shape (from `app/getMeta`):**
```json
{
  "nodes": {
    "meta": {
      "data": {
        "id": 12345,
        "name": "App Name",
        "package": "com.example.app",
        "icon": "https://...",
        "developer": { "name": "Dev Name" },
        "file": {
          "vername": "1.2.3",
          "vercode": 123,
          "path": { "url": "https://pool.aptoide.com/..." }
        },
        "media": {
          "description": "Full app description..."
        }
      }
    }
  }
}
```

**TypeScript:**
```typescript
export const aptoide = {
  search: (query: string, limit?: number) =>
    invoke<any>("aptoide_search", { query, limit }),
  getApp: (packageName: string) =>
    invoke<any>("aptoide_get_app", { packageName }),
  downloadApk: (packageName: string, destPath: string) =>
    invoke<string>("aptoide_download_apk", { packageName, destPath }),
};
```

> **Notes:**
> - No API key required for the public `ws75` endpoint.
> - Aptoide performs malware scanning on all listed APKs.
> - Rate limiting: Be respectful; cache search results locally.
> - Attribution: Display "Powered by Aptoide" where required.

---

### 6. Uptodown

> **⚠️ Important: No Public API — HTML Scraping Required**
>
> Uptodown does **not** provide a public REST API for searching or downloading APKs.
> Their "Developer Console" is publisher-only (for submitting your own app).
> The only way to access their catalog programmatically is via HTML scraping,
> which is how Obtainium, the leading FOSS app manager, also implements it.
>
> **Implementation source:** Reverse-engineered from [Obtainium's open-source
> Uptodown implementation](https://github.com/ImranR98/Obtainium/blob/main/lib/app_sources/uptodown.dart)
>
> **TOS Status:** ⚠️ Grey area — Uptodown prohibits automated access in a way
> that harms their servers, but academic/personal use scraping of public pages is
> commonly argued as fair use. Cache responses aggressively to minimize requests.
>
> **App count:** ~3 million apps (largest non-Google library of any provider here)
> **Download:** ✅ Direct APK download IS available via their CDN after scraping

**How the download flow works (3 steps):**
1. Fetch `https://<appslug>.en.uptodown.com/android/download` — parse HTML for `data-file-id` attribute on `#detail-app-name`
2. Build intermediate URL: `https://<appslug>.en.uptodown.com/android/download/<file-id>-x` — fetch this page
3. Parse the response HTML for `#detail-download-button[data-url]` — final CDN URL is `https://dw.uptodown.com/dwn/<data-url>`

**`src-tauri/src/store/uptodown.rs`**

```rust
use reqwest::Client;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UptodownApp {
    pub name: String,
    pub version: String,
    pub package_name: String,
    pub author: String,
    pub apk_url: String,
    pub slug: String,
}

const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 ADB-GUI-Kit/1.0";

// Get latest APK details for a specific Uptodown app slug.
// slug = the subdomain part, e.g. "firefox" from "firefox.en.uptodown.com"
//
// Flow:
//   Step 1 → GET https://{slug}.en.uptodown.com/android/download
//            Parse: version (div.version), app name (#detail-app-name),
//                   package name (last td in #technical-information),
//                   author (#author-link), file-id (data-file-id attr)
//   Step 2 → GET https://{slug}.en.uptodown.com/android/download/{file-id}-x
//            Parse: data-url on #detail-download-button
//   Step 3 → Build: https://dw.uptodown.com/dwn/{data-url}
#[tauri::command]
pub async fn uptodown_get_app(slug: String) -> Result<UptodownApp, String> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;

    // ── Step 1: fetch /android/download page ────────────────────────────────
    let download_page_url = format!("https://{}.en.uptodown.com/android/download", slug);
    let html1 = client
        .get(&download_page_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let doc1 = Html::parse_document(&html1);

    let sel_version = Selector::parse("div.version").map_err(|e| e.to_string())?;
    let sel_name = Selector::parse("#detail-app-name").map_err(|e| e.to_string())?;
    let sel_author = Selector::parse("#author-link").map_err(|e| e.to_string())?;
    let sel_tech_td = Selector::parse("#technical-information td").map_err(|e| e.to_string())?;

    let version = doc1
        .select(&sel_version)
        .next()
        .map(|el| el.inner_html().trim().to_string())
        .ok_or("Uptodown: could not find version")?;

    let name_el = doc1
        .select(&sel_name)
        .next()
        .ok_or("Uptodown: could not find app name element")?;

    let name = name_el.inner_html().trim().to_string();

    let file_id = name_el
        .value()
        .attr("data-file-id")
        .ok_or("Uptodown: could not find data-file-id")?
        .to_string();

    let author = doc1
        .select(&sel_author)
        .next()
        .map(|el| el.inner_html().trim().to_string())
        .unwrap_or_default();

    // Package name is the last non-empty <td> in #technical-information
    let tech_cells: Vec<String> = doc1
        .select(&sel_tech_td)
        .map(|el| el.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let package_name = tech_cells
        .last()
        .cloned()
        .ok_or("Uptodown: could not find package name")?;

    // ── Step 2: fetch intermediate download page ─────────────────────────────
    // URL pattern: /android/download/{file-id}-x
    let intermediate_url = format!(
        "https://{}.en.uptodown.com/android/download/{}-x",
        slug, file_id
    );
    let html2 = client
        .get(&intermediate_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let doc2 = Html::parse_document(&html2);
    let sel_dl_btn =
        Selector::parse("#detail-download-button").map_err(|e| e.to_string())?;

    let data_url = doc2
        .select(&sel_dl_btn)
        .next()
        .and_then(|el| el.value().attr("data-url"))
        .ok_or("Uptodown: could not find data-url on download button")?
        .to_string();

    // ── Step 3: build final CDN URL ──────────────────────────────────────────
    let apk_url = format!("https://dw.uptodown.com/dwn/{}", data_url);

    Ok(UptodownApp {
        name,
        version,
        package_name,
        author,
        apk_url,
        slug,
    })
}

// Search Uptodown for apps by keyword.
// Uses the /search/<query> HTML page and parses result cards.
// Returns a list of (name, slug) pairs for the caller to fetch details on.
#[tauri::command]
pub async fn uptodown_search(query: String) -> Result<Vec<serde_json::Value>, String> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://en.uptodown.com/android/search?q={}", query);
    let html = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let doc = Html::parse_document(&html);

    // Each result is a <div class="item"> containing an <a> with href to the app's subdomain
    let sel_items = Selector::parse("div#list-of-apps div.item a").map_err(|e| e.to_string())?;
    let sel_appname =
        Selector::parse("div.name").map_err(|e| e.to_string())?;
    let sel_version =
        Selector::parse("div.version").map_err(|e| e.to_string())?;
    let sel_icon =
        Selector::parse("img").map_err(|e| e.to_string())?;

    let results: Vec<serde_json::Value> = doc
        .select(&sel_items)
        .filter_map(|el| {
            let href = el.value().attr("href")?;
            // Extract slug from subdomain: https://firefox.en.uptodown.com/...
            let slug = href
                .trim_start_matches("https://")
                .split('.')
                .next()?
                .to_string();
            let name = el
                .select(&sel_appname)
                .next()
                .map(|n| n.inner_html().trim().to_string())
                .unwrap_or_default();
            let version = el
                .select(&sel_version)
                .next()
                .map(|v| v.inner_html().trim().to_string())
                .unwrap_or_default();
            let icon = el
                .select(&sel_icon)
                .next()
                .and_then(|i| i.value().attr("src"))
                .unwrap_or_default()
                .to_string();

            Some(serde_json::json!({
                "name": name,
                "slug": slug,
                "version": version,
                "icon": icon,
                "pageUrl": href,
            }))
        })
        .collect();

    Ok(results)
}

// Download APK from Uptodown directly to disk.
// apk_url: resolved CDN URL from uptodown_get_app()
#[tauri::command]
pub async fn uptodown_download_apk(apk_url: String, dest_path: String) -> Result<String, String> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = client
        .get(&apk_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    std::fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(dest_path)
}
```

**TypeScript:**
```typescript
// Types
interface UptodownApp {
  name: string;
  version: string;
  packageName: string;
  author: string;
  apkUrl: string;
  slug: string;
}

interface UptodownSearchResult {
  name: string;
  slug: string;
  version: string;
  icon: string;
  pageUrl: string;
}

export const uptodown = {
  // Search — returns list of result cards (name, slug, version, icon)
  search: (query: string) =>
    invoke<UptodownSearchResult[]>("uptodown_search", { query }),

  // Get full app details + resolved APK download URL by app slug
  // slug = subdomain portion of uptodown URL, e.g. "firefox"
  getApp: (slug: string) =>
    invoke<UptodownApp>("uptodown_get_app", { slug }),

  // Download the APK from the resolved CDN URL
  downloadApk: (apkUrl: string, destPath: string) =>
    invoke<string>("uptodown_download_apk", { apkUrl, destPath }),
};

// Full workflow example: search → get details → download → install
async function searchAndInstall(query: string, deviceSerial: string) {
  // 1. Search for results
  const results = await uptodown.search(query);
  if (!results.length) throw new Error("No results found");

  // 2. Pick the first result, resolve full details + APK URL
  const app = await uptodown.getApp(results[0].slug);

  // 3. Download the APK
  const destPath = `C:/Users/user/Downloads/${app.packageName}.apk`;
  const localPath = await uptodown.downloadApk(app.apkUrl, destPath);

  // 4. Install via ADB
  await invoke("adb_install_apk", { serial: deviceSerial, apkPath: localPath });
}
```

> **Known limitations and mitigations:**
> - **Fragility:** If Uptodown changes their HTML structure, scraping breaks.
>   This is expected — Obtainium faces the same issue and patches it in updates.
>   Keep `uptodown.rs` isolated so it's easy to fix independently.
> - **No search API:** The search page is also HTML-scraped. Results are limited
>   to what the HTML page renders. Consider implementing a fallback to Aptoide
>   for wider search coverage.
> - **XAPK:** Some Uptodown apps are XAPK (split APKs). The `extension` field
>   from scraping may indicate `xapk`. ADB sideloading of XAPK requires extra
>   handling — for Phase 1, warn the user and skip XAPK installs.
> - **Rate limiting:** Set a minimum 2-second delay between consecutive requests.
>   Cache search results (TTL: 15 min) and app details (TTL: 1 hour).
> - **Attribution:** Display "Powered by Uptodown" in the UI per their media kit.
> - **Cargo dep:** Add `scraper = "0.21"` to `src-tauri/Cargo.toml`.

---

## Rust Command Registry

Register all commands in `lib.rs`:

```rust
// src-tauri/src/lib.rs

mod store;
use store::{fdroid, github, aptoide, uptodown};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // F-Droid
            fdroid::fdroid_search,
            fdroid::fdroid_get_app,
            fdroid::fdroid_get_index,
            fdroid::fdroid_download_apk,
            // IzzyOnDroid
            fdroid::izzy_get_app,
            fdroid::izzy_get_index,
            // Generic Repos
            fdroid::get_default_repos,
            fdroid::fetch_repo_index,
            // GitHub (GitHub-Store model)
            github::github_search_android_apps,
            github::github_get_apk_release,
            github::github_list_releases,
            github::github_get_repo,
            github::github_download_apk,
            // Aptoide
            aptoide::aptoide_search,
            aptoide::aptoide_get_app,
            aptoide::aptoide_download_apk,
            // Uptodown
            uptodown::uptodown_search,
            uptodown::uptodown_get_app,
            uptodown::uptodown_download_apk,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## TypeScript Store Layer

**`src/lib/store/types.ts`**
```typescript
export interface AppInfo {
  packageName: string;
  name: string;
  version: string;
  versionCode: number;
  description: string;
  iconUrl?: string;
  downloadUrl?: string;
  source: "fdroid" | "izzy" | "github" | "aptoide" | "uptodown";
}

export interface FdroidRepo {
  name: string;
  address: string;
}

export interface SearchResult {
  apps: AppInfo[];
  total: number;
  source: string;
}
```

**`src/lib/store/index.ts`**
```typescript
import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, FdroidRepo } from "./types";

export async function searchAllProviders(query: string): Promise<AppInfo[]> {
  const results = await Promise.allSettled([
    // FOSS repos
    invoke("fdroid_search", { query }),
    invoke("izzy_get_app", { package: query }),
    // GitHub — Search API, filtered to Android apps with APK assets (GitHub-Store model)
    invoke("github_search_android_apps", { query, sort: "stars", perPage: 10 }),
    // Third-party stores
    invoke("aptoide_search", { query, limit: 10 }),
    invoke("uptodown_search", { query }),
  ]);

  return results
    .filter(r => r.status === "fulfilled")
    .map(r => (r as PromiseFulfilledResult<any>).value)
    .filter(Boolean);
}

export async function downloadAndInstall(
  packageName: string,
  deviceSerial: string,
  source: "fdroid" | "aptoide" | "uptodown" | "github",
  extra?: { apkUrl?: string; versionCode?: string; downloadUrl?: string },
): Promise<void> {
  const destPath = `C:/Users/user/Downloads/${packageName}.apk`;
  let localPath: string;

  if (source === "github" && extra?.downloadUrl) {
    // GitHub: downloadUrl is the browser_download_url of the APK asset
    localPath = await invoke<string>("github_download_apk", {
      downloadUrl: extra.downloadUrl,
      destPath,
    });
  } else if (source === "uptodown" && extra?.apkUrl) {
    localPath = await invoke<string>("uptodown_download_apk", {
      apkUrl: extra.apkUrl,
      destPath,
    });
  } else if (source === "aptoide") {
    localPath = await invoke<string>("aptoide_download_apk", { packageName, destPath });
  } else {
    localPath = await invoke<string>("fdroid_download_apk", {
      package: packageName,
      versionCode: extra?.versionCode ?? "latest",
      destPath,
    });
  }

  await invoke("adb_install_apk", { serial: deviceSerial, apkPath: localPath });
}
```

---

## Frontend UI Plan

```
Store Page Layout
├── Top Bar
│   ├── Search Input
│   └── Provider Filter Chips [All | F-Droid | IzzyOnDroid | GitHub | Aptoide | Uptodown]
├── Repo Selector Sidebar
│   ├── Default Repos (from get_default_repos)
│   └── + Add Custom Repo button
├── App Grid / List
│   ├── App Card
│   │   ├── Icon
│   │   ├── App Name + Version
│   │   ├── Source Badge (F-Droid / IzzyOnDroid / Aptoide / Uptodown etc.)
│   │   └── [Download & Install] button
│   └── ...
└── App Detail Sheet (on click)
    ├── Full description
    ├── Permissions list
    ├── Version history
    └── [Install to Device] → device selector dropdown → adb install
```

---

## ADB Install Integration

After download, connect APK install directly with your existing ADB layer:

```rust
// src-tauri/src/adb.rs (your existing file — add this command)

#[tauri::command]
pub fn adb_install_apk(serial: String, apk_path: String) -> Result<String, String> {
    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "install", "-r", &apk_path])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

**TypeScript one-liner:**
```typescript
await invoke("adb_install_apk", { serial: selectedDevice, apkPath: localPath });
```

---

## Provider Comparison

| Feature              | F-Droid | IzzyOnDroid | MicroG/Custom | GitHub | Aptoide   | Uptodown     |
|----------------------|---------|-------------|---------------|--------|-----------|--------------|
| Official API         | ✅      | ✅          | ✅            | ✅     | ✅ Public | ❌ Scraping  |
| Auth Required        | ❌      | ❌          | ❌            | ❌     | ❌        | ❌           |
| ToS Safe             | ✅      | ✅          | ✅            | ✅     | ✅        | ⚠️ Grey     |
| App Count            | ~4000   | ~3000       | Niche         | FOSS   | ~1M       | ~3M          |
| Rust Native          | ✅      | ✅          | ✅            | ✅     | ✅        | ✅ scraper   |
| Direct APK Download  | ✅      | ✅          | ✅            | ✅     | ✅        | ✅ via CDN   |
| Malware Scanned      | ✅      | ✅          | ✅            | ❌     | ✅        | ✅           |
| Fragility Risk       | Low     | Low         | Low           | Low    | Medium    | ⚠️ High     |
| Recommended          | ✅ Yes  | ✅ Yes      | ✅ Yes        | ✅ Yes | ✅ Yes    | ✅ Phase 3   |

---

## Implementation Roadmap

### Phase 1 — Core FOSS Store (Week 1)
- [ ] Create `src-tauri/src/store/` module structure
- [ ] Implement `fdroid.rs` — fdroid_search, get_app, get_index, download_apk
- [ ] Implement `fdroid.rs` — izzy commands + generic `fetch_repo_index`
- [ ] Add `get_default_repos` with Neo Store repo list
- [ ] Register all F-Droid commands in `lib.rs`
- [ ] Basic Store UI page with search + app cards

### Phase 2 — GitHub (GitHub-Store Model) + Aptoide (Week 2)
- [ ] Add `urlencoding = "2"` to `Cargo.toml`
- [ ] Implement `github.rs` — `github_search_android_apps` (Search API with topic filters)
- [ ] Implement `github.rs` — `github_get_apk_release` (latest release, APK-filtered assets)
- [ ] Implement `github.rs` — `github_get_repo`, `github_list_releases`, `github_download_apk`
- [ ] GitHub home feed: Trending (sort=stars) + Recently Updated (sort=updated) tabs
- [ ] Optional PAT settings field (raises rate limit from 10→30 req/min on Search API)
- [ ] Implement `aptoide.rs` — search, get_app, download_apk
- [ ] APK download progress bar (using Tauri events + reqwest stream)
- [ ] App detail sheet UI with README, stars, license, release notes
- [ ] Connect ADB install button to `adb_install_apk`
- [ ] Provider filter chips in UI [All | F-Droid | IzzyOnDroid | GitHub | Aptoide | Uptodown]

### Phase 3 — Uptodown (Week 3)
- [ ] Add `scraper = "0.21"` to `Cargo.toml`
- [ ] Implement `uptodown.rs` — uptodown_search, get_app, download_apk
- [ ] Add Uptodown to provider filter chips
- [ ] Implement 15-minute search cache (avoid unnecessary re-scrapes)
- [ ] Handle XAPK detection — warn user if app is XAPK format
- [ ] Add "Powered by Uptodown" attribution in UI

### Phase 4 — Polish & Advanced
- [ ] Custom repo add/remove UI
- [ ] Search result deduplication across providers (same package, multiple sources)
- [ ] Batch install support
- [ ] Update checker — compare installed version vs latest in repo
- [ ] Installed app detection (`adb shell pm list packages`)
- [ ] Aptoide: display malware scan status from API metadata

---

## Provider Reference Links

| Provider | Docs / API |
|---|---|
| F-Droid | https://f-droid.org/api/v1/ |
| F-Droid Search | https://search.f-droid.org/ (Meilisearch-powered, preferred for search) |
| IzzyOnDroid | https://apt.izzysoft.de/fdroid/ |
| GitHub Search API | https://docs.github.com/en/rest/search/search#search-repositories |
| GitHub Releases API | https://docs.github.com/en/rest/releases/releases |
| GitHub-Store (inspiration) | https://github.com/OpenHub-Store/GitHub-Store — ⭐ 10k, 160k users, Apache-2.0 |
| GitHub-Store Website | https://www.github-store.org/ |
| Aptoide Connect Docs | https://docs.connect.aptoide.com/docs/overview (developer portal) |
| Aptoide Public API | https://ws75.aptoide.com/api/7/ (public consumer search/meta API) |
| Aptoide API Ref | https://docs.connect.aptoide.com/reference/android-app-version-submission-api |
| Uptodown | https://uptodown.com (no public API — HTML scraping only) |
| Uptodown CDN | https://dw.uptodown.com/dwn/{data-url} (final APK download URL) |
| Obtainium Uptodown src | https://github.com/ImranR98/Obtainium/blob/main/lib/app_sources/uptodown.dart |

---

*Built for ADB GUI Kit — Tauri 2.0 + TypeScript + Rust*
