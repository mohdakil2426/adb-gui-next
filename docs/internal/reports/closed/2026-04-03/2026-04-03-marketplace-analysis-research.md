# Marketplace Deep-Dive Analysis & Bug Report

> **Date**: 2026-04-03  
> **Scope**: All 4 providers (F-Droid, IzzyOnDroid, GitHub, Aptoide), UI/UX, settings dialog  
> **Status**: Research Complete — Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Bugs Found](#critical-bugs-found)
3. [Provider-by-Provider Analysis](#provider-by-provider-analysis)
4. [GitHub-Store Architecture Lessons](#github-store-architecture-lessons)
5. [UI/UX Improvements](#uiux-improvements)
6. [Settings Dialog Design](#settings-dialog-design)
7. [Proposed Fixes — Priority Order](#proposed-fixes--priority-order)
8. [API Reference](#api-reference)

---

## Executive Summary

The marketplace has **4 critical bugs** causing providers to fail silently, resulting in only Aptoide returning results. The root causes are:

| # | Bug | Provider | Severity |
|---|-----|----------|----------|
| 1 | **F-Droid response key mismatch** — code expects `hits`, API returns `apps` | F-Droid | 🔴 Critical |
| 2 | **IzzyOnDroid search endpoint doesn't exist** — `?search=` param returns HTTP 400 | IzzyOnDroid | 🔴 Critical |
| 3 | **GitHub query uses `+` literal instead of spaces** — GitHub treats `+` as URL-encoded space in `q=`, but `urlencoding::encode()` double-encodes it, producing 0 results | GitHub | 🔴 Critical |
| 4 | **GitHub trending query also broken** — same `+` encoding issue means empty home page | GitHub | 🟡 High |
| 5 | **All errors silently swallowed** — no per-provider error feedback to frontend | All | 🟡 High |
| 6 | **F-Droid detail API has no name/description** — `/api/v1/packages/` returns only version info | F-Droid | 🟠 Medium |
| 7 | **No GitHub PAT support** — rate-limited after ~10 unauthenticated calls/minute | GitHub | 🟠 Medium |

---

## Critical Bugs Found

### BUG-1: F-Droid Response Key Mismatch 🔴

**File**: `src-tauri/src/marketplace/fdroid.rs:10-13`

**Problem**: The Rust struct expects a `hits` field:
```rust
#[derive(Deserialize, Debug)]
struct FdroidSearchResponse {
    #[serde(default)]
    hits: Vec<FdroidHit>,  // ❌ WRONG KEY
}
```

**Actual API Response** (verified live at `https://search.f-droid.org/api/search_apps?q=newpipe&lang=en`):
```json
{
  "apps": [   // ✅ KEY IS "apps", NOT "hits"
    {
      "name": "NewPipe",
      "summary": "Lightweight YouTube frontend",
      "icon": "https://ftp.fau.de/fdroid/repo/org.schabi.newpipe/en-US/icon_OHy4y1W-....png",
      "url": "https://f-droid.org/en/packages/org.schabi.newpipe"
    }
  ]
}
```

**Root Cause**: The F-Droid search API was likely using Meilisearch (which uses `hits`) at some point, but now uses a simpler `apps` wrapper. The field names in the response objects also differ:
- No `packageName` → must be extracted from `url` field
- No `suggestedVersionName` or `suggestedVersionCode` → not in search results
- `icon` is a full URL, not a relative path

**Fix**: Update the deserialization struct and mapping logic to match the actual API response.

---

### BUG-2: IzzyOnDroid Search Endpoint Doesn't Exist 🔴

**File**: `src-tauri/src/marketplace/izzy.rs:9-11`

**Problem**: The code calls a search endpoint that **does not exist**:
```rust
let url = format!(
    "https://apt.izzysoft.de/fdroid/api/v1/packages?search={}",  // ❌ Returns HTTP 400
    urlencoding::encode(query)
);
```

**Verified**: Live test of `https://apt.izzysoft.de/fdroid/api/v1/packages?search=newpipe` returns **HTTP 400** (Bad Request).

**Reality**: IzzyOnDroid has NO search API. The available endpoints are:
- `GET /fdroid/api/v1/packages/<packageName>` — lookup by exact package name
- `GET /fdroid/api/v1/names/<packageName>` — get display name
- `GET /fdroid/api/v1/shield/<packageName>` — shields.io badge data

**Solution Options**:
1. **Cross-reference approach**: Use F-Droid search results to find apps, then check if they exist in IzzyOnDroid by querying `/api/v1/packages/<packageName>`
2. **Local index approach**: Download and cache the IzzyOnDroid `index-v1.jar` and search locally (like F-Droid clients do)
3. **Web scraping approach**: Parse `https://apt.izzysoft.de/fdroid/index/apk/` (fragile, not recommended)

**Recommended**: Option 1 (cross-reference) for MVP, Option 2 for robust solution.

---

### BUG-3: GitHub Query Encoding Bug 🔴

**File**: `src-tauri/src/marketplace/github.rs:43-48`

**Problem**: Double-encoding and `+` concatenation produces malformed queries:
```rust
let q = format!(
    "{}+topic:android+fork:false+NOT+topic:library+archived:false",
    urlencoding::encode(query)  // ❌ Double-encodes the query
);
let url = format!(
    "https://api.github.com/search/repositories?q={q}&sort={sort}&per_page={per_page}"
);
```

When `query = "newpipe"`, the resulting URL is:
```
q=newpipe+topic:android+fork:false+NOT+topic:library+archived:false
```

**Verified**: This exact URL returns `{"total_count":0,"items":[]}` — **ZERO results**.

But using `%20` (space) instead of `+` as separator:
```
q=newpipe%20topic:android%20fork:false
```
Returns `{"total_count":14,"items":[...]}` — **14 results** including the real NewPipe!

**Root Cause**: The GitHub Search API treats the `q` parameter value differently than standard URL query parameters. The `+` signs between qualifiers must be URL-encoded spaces (`%20`), not literal `+` characters. Using `urlencoding::encode()` on the user query AND concatenating with `+` creates a broken query.

**Additionally**: The `NOT+topic:library` qualifier is overly restrictive and filters out many valid apps.

**Fix**: Use `%20` (space) as separator between qualifiers, and the `urlencoding::encode()` function should only encode the user's query, not the qualifiers.

---

### BUG-4: GitHub Trending Query Broken 🟡

**File**: `src-tauri/src/marketplace/github.rs:228-229`

**Problem**: Same `+` encoding issue:
```rust
let q = "topic:android+topic:app+fork:false+archived:false+stars:>100";
```

While this specific query happens to work **sometimes** (without a user-provided search term, the `+` separation in this static string can work because reqwest may handle it differently), it's inconsistent and the `topic:app` qualifier is too restrictive — only 207 results vs. tens of thousands when using just `topic:android`.

**Impact**: The home page shows no trending apps or shows irrelevant library repos instead of real apps.

---

### BUG-5: Silent Error Swallowing 🟡

**File**: `src-tauri/src/commands/marketplace.rs:32-61`

**Problem**: `tokio::join!` runs all providers concurrently, but failures are silently returned as empty vectors. The frontend has NO way to know if a provider failed vs. simply found no results.

```rust
// GitHub fails with rate limit → returns vec![] silently
// IzzyOnDroid fails with HTTP 400 → returns vec![] silently  
// F-Droid deserializes wrong key → returns vec![] silently
// Only Aptoide works → user sees only Aptoide results
```

**Fix**: Return per-provider status alongside results so the UI can show "GitHub: rate limited" or "F-Droid: API error".

---

### BUG-6: F-Droid Detail API Missing Metadata 🟠

**File**: `src-tauri/src/marketplace/fdroid.rs:96-152`

**Problem**: The `/api/v1/packages/<pkg>` endpoint returns ONLY version data:
```json
{
  "packageName": "org.schabi.newpipe",
  "suggestedVersionCode": 1009,
  "packages": [
    {"versionName": "0.28.4", "versionCode": 1009},
    {"versionName": "0.28.3", "versionCode": 1008}
  ]
}
```

No `name`, `description`, `summary`, `license`, `authorName`, `icon`, `screenshots`, etc. The detail view will show "org.schabi.newpipe" as the name and "" as the description.

**Fix**: Cache the search result data and merge it with the version details from the API. Or use the `index-v2.json` for full metadata.

---

## Provider-by-Provider Analysis

### F-Droid

| Aspect | Status | Details |
|--------|--------|---------|
| Search endpoint | ✅ Works | `https://search.f-droid.org/api/search_apps?q=X&lang=en` |
| Response format | ❌ **Mismatched** | Code expects `hits[]`, API returns `apps[]` |
| Search response fields | ❌ **Different** | API returns `name`, `summary`, `icon`, `url` — no `packageName`, no `suggestedVersionCode` |
| Detail endpoint | ⚠️ Minimal | `/api/v1/packages/<pkg>` returns only version list |
| Icon URLs | ⚠️ Changed | Now full URLs from `ftp.fau.de`, not relative paths |
| Download URL | ⚠️ Needs extraction | Package name must be parsed from `url` field |
| Rate limits | ✅ None apparent | Public API, no auth needed |

### IzzyOnDroid

| Aspect | Status | Details |
|--------|--------|---------|
| Search endpoint | ❌ **Does NOT exist** | `?search=` param returns HTTP 400 |
| Package lookup | ✅ Works | `/api/v1/packages/<pkg>` works for exact names |
| Response format | ⚠️ Different from F-Droid | `versionCode` is string, not int |
| Full metadata | ❌ Not available | API only returns version info, no name/description |
| Alternative | 📝 Proposed | Cross-reference with F-Droid search results |

### GitHub

| Aspect | Status | Details |
|--------|--------|---------|
| Search endpoint | ✅ Works | `/search/repositories?q=...` |
| Query encoding | ❌ **Broken** | `+` literal vs `%20` space bug |
| Rate limits | ⚠️ Strict | 10 req/min unauthenticated, 30 req/min with PAT |
| PAT support | ❌ Missing | No way for user to configure token |
| Trending query | ⚠️ Too restrictive | `topic:app` filters out most Android apps |
| APK detection | ✅ Works | `is_apk_asset()` filter is correct |
| Releases API | ✅ Works | `/repos/{owner}/{repo}/releases` |

### Aptoide

| Aspect | Status | Details |
|--------|--------|---------|
| Search endpoint | ✅ Works | `ws75.aptoide.com/api/7/apps/search` |
| Response format | ✅ Correct | Code correctly parses the response |
| Detail endpoint | ✅ Works | `/api/7/app/getMeta` |
| Malware filter | ⚠️ Too strict | Only `TRUSTED` rank → many valid apps filtered |
| OBB filter | ✅ Correct | Skips split APKs properly |
| Missing summary | 🟠 Bug | Search response has no `summary` field → blank descriptions |

---

## GitHub-Store Architecture Lessons

From analyzing **OpenHub-Store/GitHub-Store** (10.1k ⭐) via Context7:

### Key Patterns We Should Adopt

1. **Platform-aware topic scoring**: They map `SearchPlatform.Android` → `topic:android`, not a hardcoded multi-topic string
2. **Language filter**: They use GitHub's `language:` qualifier for refined searches
3. **Sort options**: `BestMatch`, `Stars`, `Forks`, `Updated` (we only use `stars`)
4. **Debounce**: They use 800ms debounce (we use 400ms — consider increasing)
5. **Minimum query length**: They require `query.length >= 3` before searching (we search on any input)
6. **Pagination**: They support paginated results; we only fetch first page
7. **Rate limiting**: They use a `RateLimitInterceptor` + `RateLimitRepository` to track API limits
8. **Authentication**: They use **GitHub OAuth Device Flow** to increase rate limits
9. **Retry logic**: 3 retries with exponential backoff for 5xx errors
10. **API version header**: They send `X-GitHub-Api-Version: 2022-11-28` (we don't)

### Their Home Screen Categories

| Category | Query Pattern |
|----------|--------------|
| **Trending** | `topic:android` sorted by stars, time-filtered |
| **Hot Release** | `topic:android` sorted by updated, recent pushes |
| **Most Popular** | `topic:android` sorted by stars, all time |

### Their Asset Detection

They check for installable extensions: `.apk`, `.exe`, `.msi`, `.dmg`, `.pkg`, `.deb`, `.rpm`, `.AppImage`. They ignore auto-generated source archives.

---

## UI/UX Improvements

### 1. Settings Dialog (User-Requested Feature)

Add a **Settings icon** (gear ⚙️) to the top-right of the search card, opening a dialog with:

- **Provider toggles** — enable/disable each provider (currently in FilterBar, should also be in settings)
- **GitHub PAT input** — secure text field for Personal Access Token
- **Search preferences** — default sort, result limit per provider
- **Cache controls** — clear search cache, clear trending cache
- **Rate limit status** — show remaining API calls for GitHub

### 2. Per-Provider Status Indicators

When searching, show small status badges next to each provider filter chip:
- ✅ Green = returned results
- ⚠️ Yellow = rate limited / error
- 🔄 Spinning = still loading
- ❌ Red = failed

### 3. Empty State Improvements

- Add F-Droid and Aptoide trending alongside GitHub trending
- Show popular app categories (Games, Tools, Social, etc.)
- Add recent search history chips below the search bar

### 4. Search Experience

- Increase debounce to 600-800ms (currently 400ms, causes too many API calls)
- Add minimum 2-character query length
- Show search suggestions from history
- Add "No results" per-provider breakdown

### 5. App Card Improvements

- Show provider-specific metadata (stars for GitHub, downloads for Aptoide)
- Truncate long names properly
- Add category tags
- Show "last updated" date

### 6. Detail Dialog Improvements

- For GitHub apps: show README preview
- For F-Droid apps: show anti-features warnings
- Version picker should be more prominent
- "Open in browser" button for all providers

---

## Settings Dialog Design

```
┌─────────────────────────────────────────────────┐
│  ⚙️ Marketplace Settings                    [X] │
├─────────────────────────────────────────────────┤
│                                                 │
│  PROVIDERS                                      │
│  ┌─────────────────────────────────────────┐    │
│  │ ☑ F-Droid          ✅ Connected         │    │
│  │ ☑ IzzyOnDroid      ⚠️ No search API     │    │
│  │ ☑ GitHub           🔑 No token set      │    │
│  │ ☑ Aptoide          ✅ Connected         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  GITHUB ACCESS                                  │
│  Personal Access Token (increases rate limit)   │
│  ┌─────────────────────────────────────────┐    │
│  │ ghp_••••••••••••••••••••••••            │    │
│  └─────────────────────────────────────────┘    │
│  Rate limit: 27/30 remaining (resets in 2m)     │
│                                                 │
│  SEARCH PREFERENCES                             │
│  Default sort: [Relevance ▾]                    │
│  Results per provider: [15 ▾]                   │
│  Min query length: [2]                          │
│                                                 │
│  CACHE                                          │
│  Trending cache: 12 apps (2h old)               │
│  [Clear Cache]                                  │
│                                                 │
│                          [Save]  [Cancel]       │
└─────────────────────────────────────────────────┘
```

---

## Proposed Fixes — Priority Order

### Phase 1: Critical Bug Fixes (All providers returning results)

#### Fix 1.1 — F-Droid Response Parsing

**File**: `src-tauri/src/marketplace/fdroid.rs`

```rust
// BEFORE (broken):
#[derive(Deserialize, Debug)]
struct FdroidSearchResponse {
    #[serde(default)]
    hits: Vec<FdroidHit>,
}

// AFTER (fixed):
#[derive(Deserialize, Debug)]
struct FdroidSearchResponse {
    #[serde(default)]
    apps: Vec<FdroidSearchApp>,
}

#[derive(Deserialize, Debug)]
struct FdroidSearchApp {
    #[serde(default)]
    name: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    url: String,  // e.g. "https://f-droid.org/en/packages/org.schabi.newpipe"
}
```

**Mapping changes**: Extract `packageName` from `url` by parsing the path, construct download URL from default F-Droid repo patterns.

#### Fix 1.2 — IzzyOnDroid: Replace broken search with F-Droid cross-reference

**File**: `src-tauri/src/marketplace/izzy.rs`

Since IzzyOnDroid has no search endpoint, implement cross-referencing:
1. Take the search results from F-Droid
2. For each result, check if the package exists on IzzyOnDroid: `GET /api/v1/packages/<pkg>`
3. If it exists, add an IzzyOnDroid result with the Izzy download URL

Alternative (simpler): Remove the search capability and only use IzzyOnDroid for detail enrichment — if a user clicks a F-Droid app, also check if it's available on IzzyOnDroid.

#### Fix 1.3 — GitHub Query Encoding

**File**: `src-tauri/src/marketplace/github.rs`

```rust
// BEFORE (broken):
let q = format!(
    "{}+topic:android+fork:false+NOT+topic:library+archived:false",
    urlencoding::encode(query)
);

// AFTER (fixed):
let q = format!(
    "{} topic:android fork:false archived:false",
    query  // Don't double-encode — reqwest handles URL encoding
);
// Use reqwest's query parameter builder instead of manual URL construction
let url = "https://api.github.com/search/repositories";
let response = auth_headers(
    client.get(url)
        .query(&[("q", &q), ("sort", &sort.to_string()), ("per_page", &per_page.to_string())]),
    token,
).send().await;
```

**Also remove**: `NOT+topic:library` — too restrictive, filters out valid apps like NewPipe.

#### Fix 1.4 — GitHub Trending Query

```rust
// BEFORE:
let q = "topic:android+topic:app+fork:false+archived:false+stars:>100";

// AFTER:
let q = "topic:android fork:false archived:false stars:>50 pushed:>2025-01-01";
// Remove `topic:app` — too restrictive
// Lower star threshold from 100 to 50
// Add `pushed:>` for recency
```

### Phase 2: Error Visibility

#### Fix 2.1 — Per-Provider Search Results

**Files**: `types.rs`, `commands/marketplace.rs`, `models.ts`

Add a new response type:
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceSearchResult {
    pub apps: Vec<MarketplaceApp>,
    pub provider_status: HashMap<String, ProviderStatus>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub success: bool,
    pub count: usize,
    pub error: Option<String>,
}
```

### Phase 3: GitHub PAT + Settings Dialog

#### Fix 3.1 — GitHub PAT Support

- Add `github_pat` field to the marketplace command arguments
- Store PAT securely in localStorage (frontend) or Tauri's app data (backend)
- Pass to `auth_headers()` function
- Show rate limit status from `x-ratelimit-remaining` response header

#### Fix 3.2 — Settings Dialog Component

Create `src/components/marketplace/MarketplaceSettings.tsx`:
- Dialog with tabs: Providers, GitHub, Preferences, Cache
- GitHub PAT input with show/hide toggle
- Save to localStorage with `marketplace_` prefix
- Settings icon in top-right of search card header

### Phase 4: IzzyOnDroid Robust Solution

#### Fix 4.1 — Local Index Caching

Download IzzyOnDroid's `index-v1.jar`, extract and parse it, cache locally, enable full-text search over the cached data. Refresh every 24 hours.

---

## API Reference

### F-Droid Search

```
GET https://search.f-droid.org/api/search_apps?q={query}&lang=en
```

Response:
```json
{
  "apps": [
    {
      "name": "NewPipe",
      "summary": "Lightweight YouTube frontend",
      "icon": "https://ftp.fau.de/fdroid/repo/.../icon_xxx.png",
      "url": "https://f-droid.org/en/packages/org.schabi.newpipe"
    }
  ]
}
```

### F-Droid Package Detail

```
GET https://f-droid.org/api/v1/packages/{packageName}
```

Response (minimal — no name/description):
```json
{
  "packageName": "org.schabi.newpipe",
  "suggestedVersionCode": 1009,
  "packages": [
    {"versionName": "0.28.4", "versionCode": 1009}
  ]
}
```

### IzzyOnDroid Package Detail

```
GET https://apt.izzysoft.de/fdroid/api/v1/packages/{packageName}
```

Response (minimal — versionCode is STRING not int):
```json
{
  "packageName": "org.schabi.newpipe",
  "suggestedVersionCode": "1009",
  "packages": [
    {"versionCode": "1009", "versionName": "0.28.4"}
  ]
}
```

### GitHub Search

```
GET https://api.github.com/search/repositories
    ?q={query} topic:android fork:false archived:false
    &sort=stars
    &per_page=10
```

Headers:
```
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Authorization: Bearer {PAT}  (optional, increases rate limit)
User-Agent: AdbGuiNext/1.0
```

### GitHub Releases (for APK assets)

```
GET https://api.github.com/repos/{owner}/{repo}/releases/latest
```

### Aptoide Search

```
GET https://ws75.aptoide.com/api/7/apps/search
    ?query={query}
    &limit=15
    &language=en
```

### Aptoide Detail

```
GET https://ws75.aptoide.com/api/7/app/getMeta
    ?package_name={packageName}
```

---

## Appendix: Test Results

| Test | Provider | URL | Result |
|------|----------|-----|--------|
| F-Droid search "newpipe" | F-Droid | `search.f-droid.org/api/search_apps?q=newpipe&lang=en` | ✅ 8 apps (key: `apps`, NOT `hits`) |
| IzzyOnDroid search | IzzyOnDroid | `apt.izzysoft.de/fdroid/api/v1/packages?search=newpipe` | ❌ HTTP 400 |
| IzzyOnDroid package lookup | IzzyOnDroid | `apt.izzysoft.de/fdroid/api/v1/packages/org.schabi.newpipe` | ✅ Works (versionCode as string) |
| GitHub search (broken `+`) | GitHub | `q=newpipe+topic:android+fork:false...` | ❌ 0 results |
| GitHub search (fixed `%20`) | GitHub | `q=newpipe%20topic:android%20fork:false` | ✅ 14 results |
| GitHub trending (current) | GitHub | `q=topic:android+topic:app+fork:false+stars:>100` | ⚠️ 207 results (too restrictive) |
| Aptoide search | Aptoide | `ws75.aptoide.com/api/7/apps/search?query=whatsapp` | ✅ 1000 results |
| F-Droid detail | F-Droid | `f-droid.org/api/v1/packages/org.schabi.newpipe` | ⚠️ Only version info, no metadata |

---

_This report was generated from live API testing, source code analysis, and Context7 documentation of the GitHub-Store project._
