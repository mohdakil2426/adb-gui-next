# Progress

## Overall status

Fully functional Tauri 2 desktop app on **local `main`** (v**0.2.5**). Core features: device dashboard, wireless ADB, app manager + UAD debloat + APK icons, file explorer (root grant, hidden listing, open-in-editor), flasher, utilities (stacked Host/Device/Inspect/Danger + Windows Google host setup), **scrcpy** (official binaries, native window), payload dumper (local/remote/OPS/OFP/factory), marketplace (search-first + GitHub releases/README) with **GitHub APK/APKS filter + trending explore (Komi Store port)**, emulator + Magisk root wizard, bottom logs/shell.

**2026-08-21 — Komi Store GitHub APK Filter (apk/.apks/.xapk) & Explore:**
- **Source audit:** raw fetch `kurikomi-labs/komi-store` — `SearchRepositoryImpl.assetMatchesPlatform(Android)=.apk`, `verifyBatch` concurrency 15 + 2s timeout + LruCache 500, `tryBackendSearch` fallback policy, `exploreFromGithub`/`BackendApiClient` feed. Docs: `BackendSearchResponse`, `GithubRepoNetworkModel`, `BackendExploreResponse`, `BackendFallbackPolicy`, `BackendApiClient.search`.
- **Rust:** `types.rs SearchFilters.github_apk_only: bool` default true, `assets.rs is_apk_asset` now `.apk/.apks/.xapk/.apkm`, `github.rs VERIFY_CONCURRENCY 15`, `verify_apk_availability(..., apk_only)` filters non-installable when true, `search(..., apk_only)` empty query → `topic:android stars:>100` trending + `verify_apk_availability`, `service.rs search_cache_key apk:{bool}` + `fetch_search_apps` `apk_only` passthrough, `cargo fmt` clean.
- **Frontend:** `desktop/models.ts MarketplaceSearchFilters.githubApkOnly`, `marketplaceStore.githubApkOnly` `marketplace_github_apk_only` persist default true, `FilterBar` APK/APKS Switch (disabled without GitHub, `Package` icon), `browseFilters.MarketplaceLastSearch.githubApkOnly` + `lastSearchMatches(..., githubApkOnly)`, `useMarketplaceSearch.performSearch` `isExplore` + `githubApkOnly` forward + `handleExplore` trending, `MarketplaceView`/`MarketplaceBrowseTab`/`MarketplaceEmptyState` `Browse all APKs — trending Android` button, `ultracite` sorted interface, `exactOptionalPropertyTypes` spread fix.
- **Tests:** `browseFilters.test` + `marketplaceStore.test` `githubApkOnly`, `packageStats.test` `maxApi/minApi` + `!` assert, `useMarketplaceAuth` `?? null` fix. `vitest 48/48 285/285`, `vite build` clean.

**Comprehensive Codebase Audit & Optimization (2026-08-20):**
- **React Doctor Score:** **100 / 100** (All 117 issues resolved, 0 remaining)
- **ShadScan Score:** **79 / 100** (Foundation 20/20 100%, Interaction 20/20 100%)
- **Vitest Unit Tests:** **48 / 48 files passed, 285 / 285 tests passed** (was 46/46 271/271)
- **Ultracite (Biome) Linter:** **470 files checked, 0 errors, 0 warnings** (was 466)
- **TypeScript:** `tsc --noEmit` passed with 0 errors
- **Rust Backend:** `cargo check` passed with 0 errors
- **Desktop Smoke Test:** Inspected & verified live via `orca computer` and screenshots

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | `lint:web` / `format:web` / `lint:rust` / `format:rust` / `format:check` / `lint` / `check` / `version:sync` |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt staged only) |
| CI detect | `dorny/paths-filter` → web / rust / packaging |
| CI quality | Split **quality-web** + **quality-rust** (path-gated; PRs always relevant side) |
| CI package | **main** + packaging-path changes; multi-arch Win/Linux; `tauri-action` + portable zip |
| Publish | Manual draft via tauri-action; notes file required; SHA256SUMS finalize |
| React Doctor | **100/100** (`bunx react-doctor@latest`) |
| ShadScan | **79/100** (`bunx @shadscan/cli`) |
| Code signing | **Not used** |

## Major capabilities (done)

- FE layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- **11 views** code-split (`React.lazy` + `VIEW_PRELOADERS`), including Scrcpy
- Device-list poll 30s (`MainLayout`); AVD poll 5s (Emulator view); dashboard telemetry poll 15s (Dashboard only, stops on error)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote; ZIP64 CD extra parse tested
- Debloat SDK-aware + device-keyed cache + **explicit serial** IPC; backup restore wired (`RestoreDebloatBackup`)
- App Manager: 4-tab Hardware Cockpit (`AppOverviewTab`, `InstalledAppsTab`, `InstallationTab`, `DebloaterTab`) + `PackageInspectorDrawer`
- App icons: Rust `get_app_icons` + disk/memory cache; Installed apps tab via `useAppIcons`
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel + shell history stable ids
- File Explorer: thin view + hook composition; Explorer-style nav/command bands, Places + Root/Storage tree, resizable Details columns; host drop-in + in-app move; open allowlisted text in host editor; `ls -lA`
- Scrcpy: 5-tab Precision Hardware Cockpit with resolution/bitrate/FPS/codec tuners and pure SVG bandwidth gauge
- Utilities: 5-tab Precision Hardware Cockpit with Google standalone platform-tools & USB driver installer
- Flasher: 4-tab Precision Hardware Cockpit with interactive pure SVG/ASCII Android A/B partition hierarchy diagram
- Payload Dumper: 4-tab Precision Hardware Cockpit with container format detection, uncompressed footprint, and destination reveal
- Marketplace: 4-tab Precision Hardware Cockpit with curated open-source power tools showcase — now **GitHub APK/APKS only filter (default on) + trending explore `Browse all APKs` (Komi `exploreFromGithub` port, `.apk/.apks/.xapk/.apkm`, verify 15 concurrency, empty `stars:>100` fallback)**
- Emulator: 4-tab Precision Hardware Cockpit with 8-spec hardware grid, VM state badge, and quick switcher

**Last updated:** 2026-08-21
