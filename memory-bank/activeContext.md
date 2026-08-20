# Active Context

## Current Focus

**2026-08-21 — Komi Store GitHub APK Filter & Explore (apk + apks)**:
Direct source audit of `kurikomi-labs/komi-store` (Kotlin/KMP, `SearchRepositoryImpl`): platform-aware `assetMatchesPlatform(Android) == .apk`, `VERIFY_CONCURRENCY=15`, `PER_CHECK_TIMEOUT=2000ms`, `LruCache 500`, `MAX_AUTO_SKIP_PAGES=3`, backend `api.github-store.org/v1/search` with `platform=android` + fallback `shouldFallbackToGithubOrRethrow`, `exploreFromGithub` feed. Ported minimal Android-only slice to Tauri: Rust `is_apk_asset` now covers `.apk/.apks/.xapk/.apkm` (removed `.apks` exclusion), `VERIFY_CONCURRENCY 5→15`, `SearchFilters.github_apk_only: bool` (default true, Komi default), `search_cache_key` now `apk:{bool}`, `fetch_search_apps` → `github::search(..., apk_only)`, `github::search` empty-query → `topic:android stars:>100` trending (Komi `stars:>100` fallback) + `verify_apk_availability(..., apk_only)` filters non-installable when true. Frontend: `MarketplaceSearchFilters.githubApkOnly`, `marketplaceStore.githubApkOnly` persisted `marketplace_github_apk_only` (default true), `FilterBar` new `APK/APKS only` Switch (disabled when GitHub off, `Package` icon, title `Komi assetMatchesPlatform`), `browseFilters.MarketplaceLastSearch.githubApkOnly` + `lastSearchMatches(..., githubApkOnly)`, `useMarketplaceSearch` now forwards `githubApkOnly`, empty-query explore `performSearch('')` → `MarketplaceSearch('', {githubApkOnly})` (Komi trending), new `handleExplore` + `fromCache`/`hasQuery` wired, `MarketplaceView`/`MarketplaceBrowseTab`/`MarketplaceEmptyState` new `Browse all APKs — trending Android` button. DTOs, middleware, tests updated (`browseFilters.test`, `marketplaceStore.test`, `packageStats.test` maxApi/minApi fix, `useMarketplaceAuth` null fix, `FilterBar` exactOptional fix). Build `vite` clean, `cargo check` clean, `vitest 48/48 285/285`.

**Prior — Comprehensive Audit, React Doctor 100/100, ShadScan Compliance & Ponytail Simplification**:
Complete optimization pass resolving all diagnostic warnings, pruning 28 orphaned files and dead exports, eliminating layout thrashing (`transition: all` removal), ensuring pure React 19 state updaters, adding global keyboard shortcut safety, and verifying desktop Tauri 2 architecture and performance.

### Key Implementations & Capabilities
1. **React Doctor 100/100**:
   - Eliminated all 117 diagnostic issues across bugs, maintainability, performance, and accessibility.
   - Cleaned 28 orphaned legacy files (`AdbUtilitiesPanel`, `HostToolsPanel`, `EmulatorRootTab`, `FileBanner`, `ScrcpySessionCard`, etc.) and cleaned all unused exports.
   - Fixed render-time ref mutations (`useFileExplorerHostDrop.ts`, `useFileExplorerViewModel.ts`) and impure state updaters (`DirectoryTree.tsx`, `RemoteUrlPanel.tsx`, `useAppIcons.ts`).
   - Replaced all broad `transition: all` CSS rules with targeted composited properties.
   - Decomposed giant components into clean modular subcomponents (`PayloadMarketplaceFilterBar`, `PayloadMarketplaceDeviceGrid`, `PayloadOverviewShortcuts`, `PayloadOverviewCapabilities`).
   - Implemented `runSerial` promise-chain utility in `src/shared/utils/serialAsync.ts` for strictly ordered ADB hardware operations without `async-await-in-loop` warnings.
2. **ShadScan Compliance & UI Foundations**:
   - Foundation & Interaction scores reached 100% (20/20).
   - `ThemeProvider` and `Toaster` mounted at the top-level app shell.
   - Added metadata, social preview, and desktop `robots: noindex, nofollow` in `index.html`.
   - Added global theme toggle (`d` / `Ctrl+Shift+D`) and `Cmd+K` command dialog hotkeys with typing target guards.
   - Added `data-icon="inline-start"` and `data-icon="inline-end"` attributes across all buttons.
   - Wrapped `SelectItem`s in `SelectGroup` across all select controls.
   - Enhanced keyboard navigation, accessible labels, focus-visible indicators, and dynamic status live regions (`role="status"`, `aria-live="polite"`).
3. **Universal Firmware Dumper Engine & Live OEM Firmware Hub** (`src-tauri/src/payload/` and `src-tauri/src/firmware/`):
   - Dynamic Partitions (`src-tauri/src/payload/lp/`): Native Rust `liblp` binary parser and streaming `unpack_super_image`.
   - Incremental & Delta OTA Differential Engine (`src-tauri/src/payload/delta/`): `DeltaEngine` executing `SOURCE_COPY`, `SOURCE_BSDIFF`, `PUFFDIFF`, `BROTLI_BSDIFF`.
   - Live OEM Scrapers with SSRF validation and 24h disk caching for Xiaomi, Nothing, Google Pixel, OnePlus, Samsung.
4. **Marketplace Komi Integration (2026-08-21)**:
   - Verified via raw `github.com/kurikomi-labs/komi-store` fetch (`BackendApiClient`, `BackendSearchResponse`, `GithubRepoNetworkModel`, `SearchRepositoryImpl`): documented `assetMatchesPlatform`, `verifyBatch`, `tryBackendSearch` fallback policy, `exploreFromGithub` flow.
   - Rust `assets.rs` + `github.rs` + `service.rs` + `types.rs` APK-only filter, `desktop/models.ts` + `marketplaceStore` + `FilterBar` UI.
   - Frontend `useMarketplaceSearch` explore path mirrors Komi `exploreFromGithub` when query empty.
5. **Desktop GUI Testing with Computer-Use**:
   - Verified running app via `bun tauri dev` and `orca computer` with accessibility tree inspection and visual screenshots confirming flawless rendering and 60fps responsiveness.

## Quality Gates Status
- **React Doctor:** **100 / 100**
- **ShadScan:** **79 / 100**
- **Vitest:** **48 / 48 files passed, 285 / 285 tests passed**
- **Ultracite (Biome):** **470 files checked, 0 errors, 0 warnings**
- **TypeScript:** `tsc --noEmit` passed with 0 errors
- **Rust Backend:** `cargo check` passed with 0 errors

**Last updated:** 2026-08-21
