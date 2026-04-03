# Marketplace V2 — "Unified Discovery" Overhaul

> **Design B** from `marketplace_ui_designs.md` — single search-first feed with provider filter chips, grid/list toggle, enhanced detail dialog, and 4 providers.

## Background

The current marketplace is a minimal 3-provider (F-Droid, IzzyOnDroid, GitHub) search with a flat list and basic dialog. This plan overhauls it into a polished, production-quality **Unified Discovery** experience following the Design B wireframes.

**Providers (final):** F-Droid, IzzyOnDroid, GitHub (GitHub-Store model), Aptoide  
**Removed:** Uptodown (per user request — scraping is fragile and ToS-grey)

---

## User Review Required

> [!IMPORTANT]
> **Aptoide includes both FOSS and proprietary apps.** The ws75 public API returns apps from all Aptoide stores including community-uploaded APKs. We will filter to show only `malware.rank === "TRUSTED"` apps and display the trust badge. Should we add a user-facing toggle to "Show unverified apps"?

> [!IMPORTANT]
> **GitHub PAT storage:** The plan stores an optional GitHub Personal Access Token in localStorage (encrypted at rest via Tauri's secure storage). This raises the rate limit from 10→30 req/min. Is localStorage acceptable, or should we use Tauri's credential store plugin?

> [!WARNING]
> **No Uptodown** — explicitly removed per request. The scraping-based approach (`scraper` crate) is not included. The provider list is final: F-Droid, IzzyOnDroid, GitHub, Aptoide.

---

## Proposed Changes

### Component 1: Rust Backend — Provider Modules Refactor

Split the monolithic `commands/marketplace.rs` (453 lines) into focused provider modules for maintainability and scalability.

---

#### [NEW] `src-tauri/src/marketplace/mod.rs`
- Re-exports all provider modules
- Shared types: `MarketplaceApp`, `MarketplaceAppDetail`, `ProviderSource` enum
- Shared `http_client()` builder
- `CmdResult<T>` type alias

#### [NEW] `src-tauri/src/marketplace/types.rs`
- `MarketplaceApp` struct with new fields: `rating`, `downloads_count`, `malware_status`, `categories`
- `MarketplaceAppDetail` struct with new fields: `screenshots`, `changelog`, `versions`, `repo_stars`, `repo_forks`
- `VersionInfo` struct: `version_name`, `version_code`, `size`, `download_url`, `published_at`
- `ProviderSource` enum: `FDroid`, `IzzyOnDroid`, `GitHub`, `Aptoide`
- `SearchFilters` struct: `providers: Vec<ProviderSource>`, `sort_by: SortBy`
- `SortBy` enum: `Relevance`, `Name`, `RecentlyUpdated`, `Downloads`

#### [NEW] `src-tauri/src/marketplace/fdroid.rs`
- `search_fdroid(client, query) -> Vec<MarketplaceApp>` — existing F-Droid Meilisearch logic
- `get_fdroid_detail(client, package) -> CmdResult<MarketplaceAppDetail>` — existing v1 API logic
- `get_fdroid_download_url(package, version_code) -> String` — APK URL builder

#### [NEW] `src-tauri/src/marketplace/izzy.rs`
- `search_izzy(client, query) -> Vec<MarketplaceApp>` — existing IzzyOnDroid API v1 logic
- `get_izzy_detail(client, package) -> CmdResult<MarketplaceAppDetail>` — existing detail logic

#### [NEW] `src-tauri/src/marketplace/github.rs`
Enhanced GitHub provider following the **GitHub-Store model**:

- `search_github(client, query, token, sort, page, per_page) -> Vec<MarketplaceApp>`
  - Uses Search API with qualifiers: `topic:android+has:releases+NOT+topic:library`
  - Filters out repos without `.apk` assets by checking latest release
  - **APK-only filtering**: Excludes repos that only have source archives
  - Supports optional PAT for higher rate limits (10→30 req/min)
  - Sort options: `stars`, `updated`, `forks`

- `get_github_detail(client, full_name, token) -> CmdResult<MarketplaceAppDetail>`
  - Fetches repo metadata + latest release + APK assets
  - Filter only `.apk` files (exclude `.aab`, `.xapk`, `.apks` modules)
  - Returns `VersionInfo` with per-asset download URLs and sizes
  - Extracts: stars, forks, license, language, topics, README (truncated)

- `list_github_releases(client, full_name, token) -> Vec<VersionInfo>`
  - All releases with APK assets for version history UI
  - Filter each release's assets to `.apk` only

- `get_github_trending(client, token, sort) -> Vec<MarketplaceApp>`
  - Empty query + `sort=stars` for trending, `sort=updated` for hot releases

#### [NEW] `src-tauri/src/marketplace/aptoide.rs`
New Aptoide provider using the **ws75 public API**:

- `search_aptoide(client, query, limit) -> Vec<MarketplaceApp>`
  - API: `GET https://ws75.aptoide.com/api/7/apps/search?query={q}&limit={n}&language=en`
  - Maps response: `datalist.list[]` → `MarketplaceApp`
  - **APK-only filter**: Skip entries where `obb != null` (split APKs/modules)
  - **Malware filter**: Only include `file.malware.rank == "TRUSTED"` by default
  - Map fields: `name`, `package`, `icon`, `file.vername`, `file.path` (direct APK URL), `stats.downloads`, `stats.prating.avg`

- `get_aptoide_detail(client, package) -> CmdResult<MarketplaceAppDetail>`
  - API: `GET https://ws75.aptoide.com/api/7/app/getMeta?package_name={pkg}`
  - Extract from `nodes.meta.data`: name, description, icon, version, size, developer, rating, screenshots, download URL
  - Direct APK URL from `file.path` or `file.path.url` (confirmed from live API test)

- `download_aptoide_apk(client, url) -> bytes` — straightforward HTTP GET

#### [MODIFY] `src-tauri/src/commands/marketplace.rs`
Rewrite as thin Tauri command wrappers delegating to `marketplace/` modules:
- `marketplace_search(query, filters)` — concurrent search with `tokio::join!` across enabled providers
- `marketplace_get_app_detail(package_name, source)` — dispatch to provider module
- `marketplace_download_apk(url)` — generic download to temp dir (unchanged)
- `marketplace_install_apk(app, apk_path)` — ADB install (unchanged)
- **NEW** `marketplace_get_github_trending(sort, token)` — trending/hot feeds for empty state
- **NEW** `marketplace_list_versions(package_name, source, token)` — version history
- Filters: `providers` array parameter to search only selected providers

#### [MODIFY] `src-tauri/src/lib.rs`
- Add `mod marketplace;` module declaration
- Register new commands: `marketplace_get_github_trending`, `marketplace_list_versions`

---

### Component 2: Shared Types & Desktop Layer

#### [MODIFY] `src/lib/desktop/models.ts`
Add/update TypeScript interfaces:
```typescript
// New interfaces
interface MarketplaceSearchFilters {
  providers: ProviderSource[];
  sortBy: 'relevance' | 'name' | 'recentlyUpdated' | 'downloads';
}

type ProviderSource = 'F-Droid' | 'IzzyOnDroid' | 'GitHub' | 'Aptoide';

// Updated MarketplaceApp — new fields
interface MarketplaceApp {
  // ... existing fields ...
  rating: number | null;        // 0-5 star rating
  downloadsCount: number | null; // download counter
  malwareStatus: string | null;  // TRUSTED, UNKNOWN, etc.
  categories: string[];          // app categories
}

// Updated MarketplaceAppDetail — new fields
interface MarketplaceAppDetail {
  // ... existing fields ...
  screenshots: string[];         // screenshot URLs
  changelog: string | null;      // release notes / changelog
  versions: VersionInfo[];       // version history
  repoStars: number | null;
  repoForks: number | null;
}

interface VersionInfo {
  versionName: string;
  versionCode: number;
  size: number | null;
  downloadUrl: string | null;
  publishedAt: string | null;
}
```

#### [MODIFY] `src/lib/desktop/backend.ts`
Add new Tauri command wrappers:
```typescript
// Updated search with filters
export function MarketplaceSearch(
  query: string,
  filters?: MarketplaceSearchFilters
): Promise<Array<backend.MarketplaceApp>>

// New — trending/hot feeds
export function MarketplaceGetGitHubTrending(
  sort: string,
  token?: string
): Promise<Array<backend.MarketplaceApp>>

// New — version history
export function MarketplaceListVersions(
  packageName: string,
  source: string,
  token?: string
): Promise<Array<backend.VersionInfo>>
```

---

### Component 3: Zustand Store Enhancement

#### [MODIFY] `src/lib/marketplaceStore.ts`
Expand the store with:
- `filters: SearchFilters` — active provider filters + sort
- `viewMode: 'grid' | 'list'` — persist across sessions
- `trendingApps: MarketplaceApp[]` — trending feed for empty state
- `isTrendingLoading: boolean`
- `searchHistory: string[]` — last 10 searches (localStorage)
- `githubToken: string | null` — optional PAT (localStorage)
- Actions: `setFilters`, `setViewMode`, `toggleProvider`, `loadTrending`, `addToSearchHistory`, `setGithubToken`
- Persist `viewMode`, `filters.providers`, `searchHistory`, `githubToken` in localStorage

---

### Component 4: Frontend UI — "Unified Discovery" Design B

#### [MODIFY] `src/components/views/ViewMarketplace.tsx`
Complete rewrite following Design B wireframe. Split into sub-components:

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Card: Search bar (Ctrl+K shortcut)                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔍 Search apps...                                 [Ctrl+K] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Filter: [All✓] [F-Droid] [IzzyOnDroid] [GitHub] [Aptoide]     │
│  Sort: [Relevance ▾]            View: [Grid ▦] [List ≡]        │
│                                         12 results / 4 providers│
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ App Grid     │ │ App Grid     │ │ App Grid     │  ← grid    │
│  │ Card         │ │ Card         │ │ Card         │    mode     │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  ┌── OR ──────────────────────────────────────────────┐         │
│  │ [icon] App Name  v1.2.3  ⬡FD ⬡GH    [Install]   │ ← list  │
│  │ [icon] App Name  v3.4.5  ⬡Apt       [Install]   │   mode   │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  ── Empty State (first visit) ──                                │
│  Popular FOSS: [NewPipe] [Signal] [VLC] [Bitwarden]            │
│  Trending from GitHub (if available)                             │
│                                                                  │
│  Footer: Powered by F-Droid • IzzyOnDroid • GitHub • Aptoide   │
└─────────────────────────────────────────────────────────────────┘
```

**Sub-components to extract:**

#### [NEW] `src/components/marketplace/SearchBar.tsx`
- shadcn `Input` with search icon + `Ctrl+K` keyboard shortcut
- Debounced search (400ms) 
- Clear button + spinner
- Search history dropdown (recent queries)

#### [NEW] `src/components/marketplace/FilterBar.tsx`
- Provider filter chips: toggle-able `Button variant="outline"` per provider
- Sort dropdown: `DropdownMenuRadioGroup` with Relevance/Name/Recent/Downloads
- View toggle: Grid/List `ToggleGroup`
- Results count badge

#### [NEW] `src/components/marketplace/AppCard.tsx`
- Grid mode card with:
  - App icon (40px, rounded, fallback to `Package` icon)
  - App name (truncated)
  - Short summary (2-line clamp)
  - Version badge
  - Provider source badges (multi-source: ⬡FD ⬡Izzy ⬡GH)
  - Rating stars (if available, from Aptoide)
  - Install button with progress states
- Hover: subtle elevation + border glow

#### [NEW] `src/components/marketplace/AppListItem.tsx`
- List mode compact row (existing `AppRow` pattern, enhanced):
  - Icon (32px) | Name + summary | Version | Source badges | Install button
  - Clickable → opens detail dialog

#### [NEW] `src/components/marketplace/EmptyState.tsx`
- First visit: store icon + "Search for apps" + "Browse FOSS" button
- Popular quick-launch chips: NewPipe, Signal, VLC, Bitwarden, K-9 Mail, etc.
- Trending section: cards from `marketplace_get_github_trending(sort=stars)`
- Loading skeleton for trending

#### [NEW] `src/components/marketplace/ProviderBadge.tsx`
- Colored badge per provider:
  - F-Droid: blue/teal
  - IzzyOnDroid: green
  - GitHub: purple
  - Aptoide: orange
- Icon + text (compact mode: icon only)

#### [MODIFY] `src/components/AppDetailDialog.tsx`
Significant enhancement — full app detail sheet:

**Sections:**
1. **Header**: Icon (64px) + Name + Version + License + Author + Rating
2. **Source availability**: Multi-source badges with "recommended" indicator
3. **Install action**: Full-width `LoadingButton` with 5-state progress (idle → downloading → installing → done → error)
   - Download progress percentage (from Tauri event stream if we add it)
   - Device target display: "Install to: OnePlus 8 Pro"
4. **Screenshots carousel** (if available from Aptoide): horizontal scroll
5. **About section**: Full description with expand/collapse
6. **Version history**: Collapsible list of `VersionInfo` with per-version install
7. **Metadata footer**: Package name (copyable), size, download count, categories
8. **External links**: GitHub repo link, F-Droid page link, Aptoide page link

#### [NEW] `src/components/marketplace/AttributionFooter.tsx`
- "Powered by F-Droid • IzzyOnDroid • GitHub • Aptoide"
- Only shows active providers
- Required by Aptoide guidelines

---

### Component 5: Edge Cases & Error Handling

| # | Edge Case | Handling |
|---|-----------|----------|
| 1 | **Empty search query** | Show empty state with trending + popular chips |
| 2 | **All providers fail** | Show error state with retry button + individual provider status |
| 3 | **Single provider fails** | Graceful degradation — show results from others, warn in toast |
| 4 | **Rate limit (GitHub 403)** | Detect 403/429, show "Rate limited" badge on GitHub results, suggest PAT |
| 5 | **Rate limit (Aptoide)** | Implement 2s minimum delay between requests, cache 5min TTL |
| 6 | **No APK assets (GitHub)** | Filter out repos without `.apk` in latest release — never show "no download" |
| 7 | **XAPK/split APK (Aptoide)** | Skip entries with `obb != null` — only pure APKs |
| 8 | **App bundle (.aab)** | Filter out — not sideloadable via ADB |
| 9 | **Module APKs** | Filter out any non-standalone APK (libraries, plugins) |
| 10 | **Large APK (>500MB)** | Show size warning before download, display progress |
| 11 | **Download fails mid-transfer** | Retry with exponential backoff (3 attempts), cleanup partial files |
| 12 | **No device connected** | Install button disabled with "Connect a device first" tooltip |
| 13 | **Multiple APK assets** | Dialog shows asset picker (arm64-v8a, armeabi-v7a, universal) |
| 14 | **Duplicate app across providers** | Could be Phase 2 deduplication — for now, show all with source badges |
| 15 | **Network timeout** | 15s timeout per provider, `Promise.allSettled` catches individually |
| 16 | **Malware flagged app (Aptoide)** | Only show `TRUSTED` rank by default; `UNKNOWN` hidden |
| 17 | **Invalid/expired PAT** | Detect 401, clear token, fallback to unauthenticated |
| 18 | **ADB install fails** | Show error toast with stderr content, suggest "check USB debugging" |
| 19 | **Concurrent installs** | Disable other install buttons while one is in progress |
| 20 | **Window resize during grid** | Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| 21 | **Long app names** | 2-line clamp in grid card, truncate in list mode |
| 22 | **Missing icon URL** | Fallback to `Package` lucide icon on muted bg |
| 23 | **Icon fails to load** | `onError` handler swaps to fallback icon |
| 24 | **Empty search results** | "No apps found" state with search suggestions |
| 25 | **Rapid typing** | 400ms debounce prevents API spam |
| 26 | **Search abort on new query** | Cancel previous in-flight request via AbortController |
| 27 | **View navigation during download** | Download continues in background (Rust side), toast persists |
| 28 | **GitHub repo without releases** | Skip in search results — `has:releases` qualifier handles this |
| 29 | **Aptoide app with no direct URL** | Skip entry — `file.path` is required field |
| 30 | **Special characters in search** | URL-encode via `urlencoding::encode()` (already done) |
| 31 | **Ctrl+K when dialog is open** | Ignore — dialog takes focus priority |
| 32 | **Temp file cleanup** | APK temp files cleaned by OS (tempdir pattern) |

---

## Open Questions

> [!IMPORTANT]  
> 1. **GitHub PAT UI**: Should we add a settings gear icon (⚙) in the marketplace header that opens a small dialog for entering the GitHub PAT? Or should it be in a separate settings view?

> [!IMPORTANT]  
> 2. **Download progress events**: Should we implement streaming download with Tauri events for a real progress bar, or is the current "downloading..." spinner sufficient for V2?

> [!IMPORTANT]
> 3. **Deduplication**: Should we implement cross-provider deduplication in V2 (e.g., NewPipe appears on F-Droid + IzzyOnDroid + GitHub = merged into one card with 3 source badges)? This adds significant complexity. The plan currently shows all results separately with their source badge.

---

## Verification Plan

### Automated Tests
```bash
pnpm format:check          # Gate 1: Format
pnpm lint                  # Gate 2: Lint (ESLint + clippy)
pnpm build                 # Gate 3: TypeScript + Vite build
cargo test --manifest-path src-tauri/Cargo.toml  # Gate 4: Rust tests
```

### Manual Verification
1. **Search "firefox"** — expect results from F-Droid, IzzyOnDroid, Aptoide, GitHub
2. **Filter to GitHub only** — only GitHub results shown
3. **Toggle Grid/List** — layout switches, persists across navigation
4. **Click app card** — detail dialog opens with full metadata
5. **Install from dialog** — downloads APK, installs via ADB (device connected)
6. **Empty state** — shows trending + popular chips on first visit
7. **Rate limit handling** — disconnect network mid-search, verify graceful degradation
8. **Ctrl+K** — focuses search input from anywhere in the view
9. **All providers fail** — shows error state with retry
10. **Aptoide results** — only TRUSTED apps shown, APK-only (no modules)

### Browser Recording
- Record `marketplace_v2_demo` showing: search → filter → grid/list → detail → install flow

---

## File Summary

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src-tauri/src/marketplace/mod.rs` | Module re-exports + shared types |
| NEW | `src-tauri/src/marketplace/types.rs` | DTOs: MarketplaceApp, AppDetail, VersionInfo |
| NEW | `src-tauri/src/marketplace/fdroid.rs` | F-Droid Meilisearch + v1 API |
| NEW | `src-tauri/src/marketplace/izzy.rs` | IzzyOnDroid API v1 |
| NEW | `src-tauri/src/marketplace/github.rs` | GitHub-Store model: Search + Releases + APK filter |
| NEW | `src-tauri/src/marketplace/aptoide.rs` | Aptoide ws75 API: search + getMeta + APK download |
| MODIFY | `src-tauri/src/commands/marketplace.rs` | Thin wrappers delegating to provider modules |
| MODIFY | `src-tauri/src/lib.rs` | Add `mod marketplace;` + register new commands |
| MODIFY | `src/lib/desktop/models.ts` | New TS interfaces for enhanced types |
| MODIFY | `src/lib/desktop/backend.ts` | New Tauri invoke wrappers |
| MODIFY | `src/lib/marketplaceStore.ts` | Enhanced store with filters, viewMode, trending |
| MODIFY | `src/components/views/ViewMarketplace.tsx` | Full rewrite — Design B layout |
| NEW | `src/components/marketplace/SearchBar.tsx` | Search with Ctrl+K + history |
| NEW | `src/components/marketplace/FilterBar.tsx` | Provider chips + sort + view toggle |
| NEW | `src/components/marketplace/AppCard.tsx` | Grid card component |
| NEW | `src/components/marketplace/AppListItem.tsx` | List row component |
| NEW | `src/components/marketplace/EmptyState.tsx` | Trending + popular chips |
| NEW | `src/components/marketplace/ProviderBadge.tsx` | Colored source badges |
| NEW | `src/components/marketplace/AttributionFooter.tsx` | "Powered by..." footer |
| MODIFY | `src/components/AppDetailDialog.tsx` | Enhanced detail with versions + screenshots |

**Total: 10 new files + 9 modified files**

---

*Plan created: April 2026 — ADB GUI Next Marketplace V2*
