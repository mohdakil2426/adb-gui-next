# Active Context

## Current State

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.
All responsive layout fixes, sticky header, and adaptive hardening are complete.
Marketplace Phase 1 architecture refactor is complete: singleton HTTP client (connection pooling), APK verification engine (JoinSet + Semaphore), heuristic scoring engine (8 weighted signals), bounded cache (capacity limits), language extraction from GitHub API, F-Droid installable fix, and dynamic trending date. All core quality gates pass: format, lint (ESLint), tsc build, cargo check (lib + tests). `cargo clippy`/`cargo test` still blocked by pre-existing Windows `AdbWinApi.dll` file lock.
Emulator Manager is implemented and **fully working** on Windows. Critical AVD discovery bug (commit `a52ca2e`) was diagnosed and fixed: `avd.rs` now scans `~/.android/avd/*.ini` files directly instead of calling `emulator -list-avds`, which fails when `emulator.exe` is not on PATH. `sdk.rs` gained `resolve_emulator_binary()` to find the binary via the Android SDK install path. Running emulators now appear in the roster with correct `isRunning: true` and serial.

---

## Recently Completed

### 2026-04-08 — Emulator Manager Feature Trim (Remove Overkill Options)

**Change:** Removed headless mode and network speed/delay options from the Emulator Manager — they were surfaced as "overkill" complexity for a UI tool. Complete removal across all layers.

**What was removed (every reference):**

| Layer | What removed |
|:---|:---|
| `src-tauri/src/emulator/models.rs` | `headless: bool`, `net_speed: Option<String>`, `net_delay: Option<String>` fields from `EmulatorLaunchOptions` |
| `src-tauri/src/emulator/runtime.rs` | `-no-window`/`-no-audio` args from `build_launch_args`, `-netspeed`/`-netdelay` args, renamed + updated test |
| `src/lib/desktop/models.ts` | `headless`, `netSpeed`, `netDelay` from `EmulatorLaunchOptions` TS interface |
| `src/components/emulator-manager/EmulatorLaunchTab.tsx` | `headless` state/checkbox, `netSpeed`/`netDelay` state/inputs, `Input` + unused imports |
| `src/components/views/ViewEmulatorManager.tsx` | `headless` preset case from `createPresetOptions`, Headless toolbar button, `ScanFace` import |

**Verification:** `format:check` ✅ · `lint:web` ✅ · `build` ✅ (Rust cargo test blocked by Windows DLL file-lock — known issue with dev server running)

---

### 2026-04-08 — Emulator Manager Design 3 UI Redesign

**Problem:** The previous 2-column sidebar layout (256px left roster + right detail card) wasted horizontal space and looked inconsistent with the rest of the app's full-width column layout.

**Design chosen (Design 3 — Two-Row Header Bar + Full-Width Content Card):**

| Zone | What |
|:---|:---|
| Row 1 | Icon + `h1` + Advanced badge + description · Refresh button pushed right |
| Row 2 left | `AvdSwitcher` Popover pill + warnings badge · status meta line below (running state · serial · API · ABI · device name) |
| Row 2 right | Context-aware action buttons (Launch/Stop toggle + Cold boot + Folder) — hidden when no AVD |
| Card | `CardContent p-0` only — `TabsList variant="line"` flush at top, `p-6` tab content below |
| Empty state | `EmptyState` component when no AVD or loading |

**New component — `AvdSwitcher.tsx`:** Structural clone of `DeviceSwitcher` (Popover+Tooltip pill → `align="start" w-72 p-0` flyout, header with icon+label+count+refresh icon-button, Separator, selection-dot + name + subtitle + badge rows). Identical UX pattern — zero new patterns introduced.

**Removed:** `AvdRoster.tsx` (replaced by `AvdSwitcher`), side-panel `xl:grid-cols-[256px_minmax(0,1fr)]` layout, `EmulatorActivityCard.tsx`, activity-related state from `emulatorManagerStore.ts`.

**Verification:** `format:check` ✅ · `lint:web` ✅ · `build` ✅

---

**Problem:** The Emulator Manager UI was messy and over-complicated — 4+ stacked Card blocks (HeaderCard, QuickActions, Tabs, ActivityCard), a redundant "Overview" tab that duplicated data already visible in the roster badges and header, a fixed 34rem height roster that wasted space, and separate cards for just 6 buttons.

**Changes:**

| What | Before | After |
|:---|:---|:---|
| Layout | 4 separate stacked Cards | 1 unified Card with inline header+actions |
| AVD list | Fixed 34rem height Card | Adaptive ScrollArea, no Card wrapper |
| Quick actions | Separate Card with title+description | Inline button row inside the unified Card header |
| Tabs | Overview + Launch + Root + Restore | Launch + Root + Restore only (Overview was pure duplication) |
| Roster width | 320px | 256px |
| Activity log | Always-visible Card even when empty | Renders only when there are entries |
| Tab content | Each tab had its own Card wrapper | Content is flat inside a shared `<div className="p-6">` |
| EmulatorHeaderCard | Separate component (115 lines) | Merged into ViewEmulatorManager header section |
| EmulatorQuickActions | Separate component (72 lines) | Merged inline into ViewEmulatorManager header |
| Deleted files | — | `EmulatorHeaderCard.tsx`, `EmulatorQuickActions.tsx` |

**Verification:** `pnpm format:check` ✅ · `pnpm lint:web` ✅ · `pnpm build` ✅


### 2026-04-08 — Emulator Manager Bug Fixes (Critical — AVD Discovery & Launch)

**Problem:** Running Android Studio emulator (`Medium_Phone` on `emulator-5554`) was not appearing in the Emulator Manager roster. Page showed "No AVDs found" despite confirming via `adb devices` that the emulator was connected.

**Root Cause Analysis:** Full analysis in `docs/reports/emulator-manager-analysis.md`. Bug chain:
1. `avd.rs::list_avds()` called `run_binary_command(app, "emulator", &["-list-avds"])` — but `emulator.exe` is NOT bundled in `src-tauri/resources/` and NOT on system PATH (only in `$LOCALAPPDATA\Android\Sdk\emulator\emulator.exe`).
2. `resolve_binary_path()` fails all 3 tiers → returns `Err(...)` → `list_avds()` propagates it → frontend `useQuery` catches it → `avds = []` → empty roster.
3. `resolve_system_image_dir()`: `config.ini` uses backslashes on Windows (`system-images\android-31\...`) — normalisation was needed before `PathBuf::join`.
4. `GetAvdRestorePlan` errors silently swallowed in `ViewEmulatorManager.tsx` — no user-visible feedback.

**Fixes (commit `a52ca2e`):**

| File | Fix |
|:---|:---|
| `emulator/sdk.rs` | Added `resolve_emulator_binary(env)` — searches `$SDK/emulator/emulator.exe` across all candidate SDK roots. Added `resolve_emulator_binary_from_current_env()` convenience wrapper. No PATH dependency. |
| `emulator/avd.rs` | `list_avds()` now calls `scan_avd_names(avd_home)` — reads `~/.android/avd/*.ini` file stems directly. Removed `emulator -list-avds` call entirely. Removed `run_binary_command` import. `resolve_system_image_dir()` normalises Windows backslashes → forward slashes before `PathBuf::join`. |
| `emulator/runtime.rs` | `launch_avd()` uses `sdk::resolve_emulator_binary_from_current_env()` with fallback to PATH. Working directory set to emulator binary's own parent folder (needed: `qemu-system-x86_64.exe` must be a sibling). Added 1-second crash detection after `spawn()`. |
| `ViewEmulatorManager.tsx` | `GetAvdRestorePlan` catch block now appends a `'warning'`-level activity log entry instead of silently setting `restorePlan(null)`. Fixed `react-hooks/exhaustive-deps` lint: added `appendActivity` to `useEffect` deps. |

**Verification:**
- `cargo check` ✅ (3.18s, zero errors)
- `cargo clippy -- -D warnings` ✅ (zero warnings)
- `pnpm lint:web` ✅ (ESLint exit 0)
- `pnpm build` ✅ (tsc + Vite, 2493 modules, 1.71s)
- `pnpm format:check` ✅

### 2026-04-05 — Emulator Manager Implementation (Advanced AVD Control)

**Change:** Implemented the planned Emulator Manager feature end-to-end across Rust backend modules, Tauri commands, typed frontend wrappers, Zustand state, and a new Advanced view. Added frontend store tests and view tests.

**Key Changes:**

| Area | Change |
|:---|:---|
| `src-tauri/src/emulator/` | New domain layer: `sdk.rs`, `avd.rs`, `runtime.rs`, `backup.rs`, `root.rs`, `models.rs` |
| `src-tauri/src/commands/emulator.rs` | Thin async Tauri command surface for AVD discovery, launch/stop, restore plan, restore, prepare root, finalize root |
| `src/lib/desktop/` | Added typed Emulator Manager DTOs and backend wrappers |
| `src/lib/emulatorManagerStore.ts` | New Zustand store for selected AVD, active tab, page-scoped activity log, restore plan, and root session |
| `src/components/views/ViewEmulatorManager.tsx` | New hybrid manager page with roster, summary header, quick actions, tabs, and activity log |
| `src/components/emulator-manager/` | Added `AvdRoster`, `EmulatorHeaderCard`, `EmulatorQuickActions`, `EmulatorLaunchTab`, `EmulatorRootTab`, `EmulatorRestoreTab`, `EmulatorActivityCard` |
| Navigation | Added `Emulator Manager` under Advanced in `AppSidebar` and routed it in `MainLayout` |
| Tests | Added `emulatorManagerStore.test.ts` and `ViewEmulatorManager.test.tsx` |

**Verification:**
- `pnpm test` ✅
- `pnpm build` ✅
- `pnpm lint` ✅
- `pnpm format:check` ✅
- `cargo check --manifest-path src-tauri/Cargo.toml` ✅
- `cargo test --manifest-path src-tauri/Cargo.toml` ⚠️ pre-existing Windows abnormal exit (`0xc0000139`, `STATUS_ENTRYPOINT_NOT_FOUND`)
- `pnpm tauri build --debug` ⚠️ blocked by locked `src-tauri/target/debug/adb-gui-next.exe` (`os error 5`)

### 2026-04-05 — Marketplace Architecture Phase 1 (High-Performance Refactor)

**Change:** Implemented all critical and medium findings from the architecture audit across 10 files (7 Rust, 3 TypeScript). 11 new unit tests added.

**Key Changes:**

| Module | Change | Finding |
|:---|:---|:---:|
| `mod.rs` | `ManagedHttpClient` singleton — Tauri managed state, connection pooling | F-01, CMD-01 |
| `github.rs` | APK verification engine — `JoinSet` + `Semaphore(5)`, scans last 5 releases | G-01, G-02 🔴 |
| `github.rs` | `language` field extraction from GitHub API | T-02 |
| `github.rs` | Dynamic trending cutoff date (6 months ago, no chrono dep) | G-06 |
| `fdroid.rs` | `installable: true` — F-Droid always has APK downloads | FD-01 🔴 |
| `ranking.rs` | Heuristic scoring: topics (+80), language (+40), freshness (+40), installability (+200) | R-01, R-02, R-05 🔴 |
| `cache.rs` | Bounded cache with max capacity eviction (200/500/50), O(1) reads | C-01, C-02 |
| `types.rs` | Added `language: Option<String>` to `MarketplaceApp` | T-02 |
| `commands/marketplace.rs` | All commands use `State<ManagedHttpClient>` instead of per-call client creation | CMD-01 |
| `Cargo.toml` | `reqwest` now a required (non-optional) dependency | F-01 |
| `models.ts` | Added `language: string | null` to frontend DTO | T-02 |
| `AppCard.tsx`, `AppListItem.tsx` | Language badge pill in metadata row | UI |
| `marketplaceStore.test.ts` | Test mock updated for new `language` field | Test |

**Deferred to Phase 2:**
- ETag conditional requests (G-03)
- Rate limit header tracking (G-04)
- Provider-level timeout + JoinSet for multi-provider (S-01, S-02)
- Per-provider error reporting to UI (S-03)

---

### 2026-04-05 — Marketplace Architecture Audit Revision 2 (Deep Analysis)

**Change:** Exhaustive code-level analysis of all 9 marketplace Rust modules (1,418 lines) + command layer. Benchmarked against GitHub-Store (10.5k★ KMP app) and GitHub API best practices. Full report rewritten from 103 lines → 508 lines.

---

### 2026-04-04 — Marketplace UX Overhaul + GitHub Device Flow

**Change:** Implemented a major Marketplace execution pass focused on professional UX, search/filter quality, zero-query discovery, Rust architecture, and optional GitHub OAuth device-flow sign-in.

**Frontend changes:**
- `ViewMarketplace.tsx` now acts as a cleaner shell with stronger search/header hierarchy
- New marketplace hooks under `src/lib/marketplace/`:
  - `useMarketplaceSearch.ts` — debounced search + stale-response protection
  - `useMarketplaceHome.ts` — zero-query section loading (trending + fresh releases)
  - `useMarketplaceAuth.ts` — optional GitHub device-flow session handling
  - `install.ts` — shared APK install helper
- `SearchBar.tsx` redesigned with recent-search popover, tooltip-based actions, better shortcut hint
- `FilterBar.tsx` redesigned with sort control + active filter summary + cleaner view toggle
- `MarketplaceEmptyState.tsx` replaced hero-only empty state with discovery sections:
  - Continue exploring
  - Browse by collection
  - Trending
  - Fresh releases
  - GitHub sign-in CTA/status card
- `ProviderBadge.tsx` moved from emoji/color-coded presentation to consistent Lucide badge treatment
- `AppCard.tsx` / `AppListItem.tsx` upgraded for hierarchy, grouped-source hints, and shared install behavior
- `AppDetailDialog.tsx` restructured into actions/details/media/version sections and now uses `BrowserOpenURL()` instead of `window.open()`
- `MarketplaceSettings.tsx` upgraded from PAT-first UX to OAuth-client-ID + device-flow sign-in, cache clearing, and advanced PAT fallback
- `marketplaceStore.ts` expanded with:
  - sort persistence
  - recent viewed apps
  - GitHub session state (in-memory token only)
  - GitHub OAuth client ID persistence
  - recent release/trending section state

**Backend changes:**
- Added Rust marketplace submodules:
  - `auth.rs` — GitHub OAuth device-flow start/poll helpers + user/rate-limit fetch (surfaces detailed `error_description` on HTTP 4xx)
  - `cache.rs` — in-memory TTL caches for search/detail/trending
  - `ranking.rs` — result dedupe + sort/relevance rules
  - `service.rs` — orchestration layer so `commands/marketplace.rs` stays thin
- `types.rs` expanded with:
  - `available_sources`, `updated_at`, `installable`, `results_per_provider`
  - GitHub device-flow/user/rate-limit DTOs
- `commands/marketplace.rs` now supports:
  - cache-aware search/detail/trending
  - `marketplace_clear_cache`
  - `marketplace_github_device_start`
  - `marketplace_github_device_poll`
- `lib.rs` now manages `ManagedMarketplaceCache`
- Provider modules updated with richer metadata (`repo_url`, `updated_at`, `installable`, explicit source availability)

**Verification:**
- `pnpm check:fast` ✅
- `pnpm test` ✅ (24 tests)
- `pnpm exec tsc --noEmit` ✅
- `pnpm build` ✅
- `cargo check` ✅
- `cargo test` ⚠️ pre-existing Windows abnormal exit (`0xc0000139`, `STATUS_ENTRYPOINT_NOT_FOUND`)
- `pnpm tauri build --debug` ✅ (MSI + NSIS produced successfully in this session)

---

### 2026-04-04 — TypeScript 6 Upgrade + `baseUrl` Deprecation Migration

**Change:** Upgraded frontend toolchain from TypeScript 5.9.3 to **6.0.2** and removed deprecated
`compilerOptions.baseUrl` from `tsconfig.json`.

**Why:**
- TypeScript 6.0 deprecates `baseUrl`; warning states it will stop functioning in TypeScript 7.0
- This repo only used `baseUrl` to support the `@/*` alias, but `paths` no longer requires
  `baseUrl`

**Config migration:**
- `package.json`: `typescript` `~5.9.3` → `^6.0.2`
- `tsconfig.json`: removed `"baseUrl": "."`
- Kept alias mapping: `"@/*": ["./src/*"]`

**Verification:**
- `pnpm exec tsc --noEmit` ✅
- `pnpm format:check` ✅
- `pnpm lint` ✅
- `pnpm test` ✅
- `pnpm build` ✅
- `cargo test` ⚠️ pre-existing Windows abnormal exit (`0xc0000139`, `STATUS_ENTRYPOINT_NOT_FOUND`)
- `pnpm tauri build --debug` ⚠️ blocked by running `adb-gui-next.exe` locking `src-tauri/target/debug/adb-gui-next.exe`

---

### 2026-04-04 — Marketplace Bug Fixes: All 4 Providers Working + Settings Dialog

**Bugs Found & Fixed (4 critical):**

| # | Provider | Root Cause | Fix |
|---|----------|-----------|-----|
| 1 | F-Droid | Response key `hits` → API returns `apps` | Updated deserialization to `apps[]`, new field mappings (`name`, `summary`, `icon` as full URL, `url` for package name extraction) |
| 2 | IzzyOnDroid | Search endpoint `?search=X` returns HTTP 400 — **NO search API exists** | Cross-reference approach: check F-Droid results against IzzyOnDroid packages API |
| 3 | GitHub | `+` literal between qualifiers was double-encoded → 0 results | Use `urlencoding::encode()` with spaces between qualifiers (converts to `%20`) |
| 4 | GitHub | Trending query `topic:app` too restrictive (207 results) | Removed `topic:app`, lowered stars to >50, added recency filter |

**Additional fixes:**
- IzzyOnDroid `versionCode` parsing: API returns STRING not integer
- F-Droid detail enrichment: search API cross-queried for name/description (v1 only returns versions)
- Removed `NOT topic:library` qualifier (too restrictive)
- Added `X-GitHub-Api-Version: 2022-11-28` header (GitHub-Store best practice)
- GitHub PAT passed through all API calls (search, detail, trending, versions)
- Per-provider result count logging for debugging

**New Feature — Settings Dialog (`MarketplaceSettings.tsx`):**
- Provider enable/disable toggles with checkboxes
- GitHub PAT input with show/hide toggle + save confirmation
- Results per provider preference (5/10/15/25)
- Search history clear button
- All settings persisted via localStorage with `marketplace_` prefix

**UX Improvements:**
- Debounce increased from 400ms → 600ms (fewer API calls)
- Minimum 2-character query length (prevents empty searches)
- Settings gear icon (⚙️) added to SearchBar right side
- Search history saved and browsable (10 max)

**Files changed:** 11 (5 Rust + 5 TypeScript + 1 new TypeScript)

---

### 2026-04-03 — Marketplace V2: "Unified Discovery" (4-Provider Modular Architecture)

**Feature:** Complete overhaul of the Marketplace from a 3-provider flat list to a "Unified Discovery" experience (Design B) with 4 providers, modular Rust backend, and rich frontend components.

**Backend: New `src-tauri/src/marketplace/` module system (6 files):**

| Module | Purpose |
|---------|---------|
| `mod.rs` | Module root, shared `reqwest::Client` |
| `types.rs` | Shared DTOs: `MarketplaceApp`, `MarketplaceAppDetail`, `VersionInfo`, `SearchFilters` (with `github_token`) |
| `fdroid.rs` | F-Droid search API (`search.f-droid.org/api/search_apps`) + detail enrichment |
| `izzy.rs` | IzzyOnDroid cross-reference (checks F-Droid results against `/api/v1/packages/`) |
| `github.rs` | GitHub Search API with proper URL encoding, APK-only asset filter, PAT support, trending feed |
| `aptoide.rs` | Aptoide ws75 API: TRUSTED-only malware filter, OBB/module skip, screenshots |

**New Tauri commands:**
- `marketplace_get_trending` — Trending GitHub Android apps (stars > 50, recently pushed)
- `marketplace_list_versions` — GitHub release history with APK assets

**Frontend: 8 marketplace components + view/dialog rewrite:**

| Component | Purpose |
|------|---------|
| `SearchBar.tsx` | Ctrl+K shortcut, 600ms debounce, settings gear icon |
| `FilterBar.tsx` | Provider toggle chips (F-Droid/IzzyOnDroid/GitHub/Aptoide), grid/list toggle, result count |
| `AppCard.tsx` | Grid card with icon, provider badge, rating, inline install |
| `AppListItem.tsx` | Compact list row for list view |
| `MarketplaceEmptyState.tsx` | Hero, popular app chips, trending GitHub feed |
| `ProviderBadge.tsx` | Color-coded source badges |
| `AttributionFooter.tsx` | "Powered by" provider links |
| `MarketplaceSettings.tsx` | Settings dialog: providers, GitHub PAT, preferences, cache |
| `ViewMarketplace.tsx` | Complete rewrite: search card + provider filters + grid/list results + empty state |
| `AppDetailDialog.tsx` | Enhanced: screenshots, GitHub stats, expand/collapse description, version history with per-version install, copyable package name |
| `marketplaceStore.ts` | Rewritten: provider filters, view mode, search history, trending, GitHub PAT, settings state — all persisted in localStorage |

**Key design decisions:**
- **Uptodown removed** — scraping is fragile and ToS-grey
- **APK-only filtering** — GitHub assets filtered via `is_apk_asset()`, Aptoide skips OBB entries
- **Malware filtering** — Aptoide shows only TRUSTED rank by default
- **Concurrent search** — `tokio::join!` fires F-Droid + GitHub + Aptoide simultaneously; IzzyOnDroid runs after F-Droid (cross-reference)
- **GitHub-Store model** — Search API with topic qualifiers, proper URL encoding, PAT support
- **State persistence** — View mode, provider filters, search history, GitHub PAT saved to localStorage

**Pre-existing clippy fixes (bonus):** Fixed 15 warnings across OPS/OFP modules:
- `crypto.rs`: needless_range_loop, manual_rotate, redundant_closure, sliced_string_as_bytes
- `ops_parser.rs`/`ofp_qc.rs`/`detect.rs`: collapsible_if, unnecessary_cast
- `extractor.rs`: redundant_locals

**Files changed:** 17 (6 new Rust + 7 new TypeScript + 4 modified TypeScript + 7 modified Rust)

---

### 2026-04-03 — OPS Decryption Bug Fixes (3 Critical Bugs)

**Problem:** OPS firmware loading showed an error toast — decryption was failing silently.

**Root Causes Found & Fixed:**

| Bug | File | Issue | Fix |
|-----|------|-------|-----|
| 1. **mbox treated as packed u32** | `crypto.rs` | `sbox_as_u32_array()` was `[u32; 512]` — too small, and `key_update` was XORing with packed u32 values instead of byte values | Changed to `[u32; 2048]` with one byte-value per entry |
| 2. **XML validation on full buffer** | `crypto.rs` | `try_decrypt_ops_xml()` checked entire padded buffer as UTF-8 — padding bytes are invalid UTF-8 | Check only first 256 bytes for `b"xml "`, return `String::from_utf8_lossy()` |
| 3. **Missing `<Image>` elements** | `ops_parser.rs` | Parser only handled `<File>` tags — actual firmware is in `<Image>` inside `<program>` | Added `<Image>` element parsing with program label tracking |

**Additional fixes:**
- XML offset now computed from end of file (matching Python reference), not `config_offset * 0x200`
- BOM stripping (`\u{FEFF}`) and replacement character cleanup before XML parsing
- Updated unit tests for real XML structure with `<Image>` elements

**Verification:** 62 partitions found from OnePlus 8 Pro `.ops` file (was 4 before fixes).

**Documentation:** Comprehensive technical guide written in `docs/guides/ops-ofp-firmware-extraction.md`.

---

### 2026-04-03 — OPS/OFP Firmware Format Support (Backend + Frontend Integration)

**Feature:** Added native decryption and extraction support for OnePlus `.ops` and Oppo `.ofp`
(Qualcomm + MediaTek) firmware containers to the existing Payload Dumper. Uses a **unified dispatch**
pattern — existing `extract_payload` and `list_payload_partitions_with_details` Tauri commands
auto-detect `.ops`/`.ofp` by file extension and route to the dedicated OPS pipeline. Zero changes
to frontend extraction/listing actions.

**New Rust modules (`src-tauri/src/payload/ops/`):**

| Module | Purpose |
|--------|---------|
| `mod.rs` | Shared types (`OpsPartitionEntry`, `OpsFooter`, `OpsMetadata`), constants |
| `detect.rs` | Format detection: CrAU, PK/ZIP, 0x7CEF footer, MTK brute-force |
| `crypto.rs` | OPS custom S-box cipher (3 mbox variants), OFP-QC AES-128-CFB (7 key sets + V1), OFP-MTK (9 key sets + mtk_shuffle) |
| `sbox.bin` | 2048-byte S-box lookup table (`include_bytes!`) |
| `ops_parser.rs` | Footer parsing, mbox-variant XML decryption brute-force, `quick-xml` manifest parsing |
| `ofp_qc.rs` | Page size detection (0x200/0x1000), AES key brute-force, partial encryption (first 256K) |
| `ofp_mtk.rs` | mtk_shuffle header/entry table binary parsing |
| `sparse.rs` | Android sparse image un-sparsing (Raw, Fill, Don't Care, CRC32 chunks) |
| `extractor.rs` | Parallel extraction, format-specific decryption dispatch, sparse detection, progress events |

**New dependencies:** `aes 0.8`, `cfb-mode 0.8`, `md-5 0.10`, `quick-xml 0.37`

**Frontend changes (minimal):**
- `SelectPayloadFile()` and DropZone accept `.ops`/`.ofp` extensions
- `OpsMetadata` interface added to `models.ts`
- `GetOpsMetadata()` backend wrapper added
- `get_ops_metadata` Tauri command registered
- View subtitle updated to mention OPS/OFP

**Key design decisions:**
- Unified dispatch by file extension — no new frontend actions needed
- `OpsPartitionEntry` → `PartitionDetail` mapping in `list_ops_partitions()` makes format transparent
- OPS custom cipher ported from Python (`opscrypto.py`) to Rust with `include_bytes!` S-box
- Mbox variant brute-force: tries mbox5 → mbox6 → mbox4 in order of likelihood
- OFP-QC: tries V1 keyshuffle first, then 6 V2 key triplets
- OFP-MTK: 9 key sets with mtk_shuffle2 deobfuscation
- Sparse images un-sparsed in-place after extraction

**Files changed:** 13 (9 new Rust + 4 modified Rust + 4 modified TypeScript)

---

### 2026-04-03 — Remote Payload Metadata UI (Collapsible Details Panel)

**Feature:** Implemented a collapsible "Show Details / Hide Details" panel inside the `FileBanner`
component for remote OTA payloads. When partitions load from a remote URL, the banner shows a
chevron toggle that expands to reveal 7 metadata sections.

**Data sources — 3 layers of metadata aggregation:**

| Section | Source | Data |
|---|---|---|
| OTA Package | `META-INF/com/android/metadata` (ZIP entry) | Device, Android version, build fingerprint, OTA type, security patch, build date, version, wipe flag |
| Payload Properties | `payload_properties.txt` (ZIP entry) | File SHA-256 hash, file size, metadata hash, metadata size |
| HTTP | HEAD response headers | Content-length, content-type, server, last-modified, ETag |
| ZIP Archive | EOCD/CD binary parsing | Compression method, payload.bin offset, uncompressed size |
| OTA Manifest | CrAU protobuf header | CrAU version, block size, update type, timestamp, dynamic groups |
| Extraction | Frontend state | Mode (prefetch/direct), output path |

**Key implementation details:**
- **`read_text_file_from_zip()`** in `http_zip.rs` — reads any named file from a remote ZIP via
  Central Directory scanning + HTTP range request. Returns `Ok(None)` when file missing (best-effort).
- **`parse_kv_text()`** helper — parses `key=value` text files into HashMap
- **`FileBannerDetails.tsx`** — 7-section metadata display with SDK→Android version mapping,
  copyable hashes, OTA type badge, conditional section rendering
- **Fire-and-forget metadata fetch** — non-blocking after partition load; silent on failure
- **Zustand persistence** — metadata survives view navigation, cleared on reset

**Files changed:** 9 (5 Rust + 4 TypeScript)

---

### 2026-04-03 — Sticky Header Root Fix (Viewport Height Boundary)

**Problem:** The header was still scrollable despite being `shrink-0` inside a flex-col
`SidebarInset`. The `shrink-0` class has no effect unless the parent has a **concrete, bounded
height** to distribute from. Without it, `flex-1` inside `SidebarInset` resolves to ∞ and
everything scrolls at the body level.

**Root cause:** The outer `<div>` wrapper around `SidebarProvider` in `MainLayout.tsx` had no
height — only `opacity-0/100` classes. Without a fixed height ancestor, `flex-1` children
can't establish a scroll boundary.

**Two-line fix:**

| File | Change | Reason |
|---|---|---|
| `MainLayout.tsx` | Outer `<div>`: added `h-svh overflow-hidden` | Creates hard viewport-height boundary |
| `sidebar.tsx` | `SidebarProvider` wrapper: `min-h-svh` → `h-full` | Fills boundary instead of overriding it |

**All gates:** `pnpm format:check` ✅ → `pnpm lint:web` ✅ → `pnpm build` ✅

---

## Current Verification Evidence

Last verified: **2026-04-08** (after Emulator Manager bug fix — commit `a52ca2e`)
- `pnpm build` ✅ — TypeScript + Vite bundle clean
- `pnpm lint` ✅ — ESLint + cargo clippy -D warnings clean
- `pnpm format:check` ✅ — Formatting clean
- `cargo check` ✅ — Rust compilation clean
- `cargo clippy -- -D warnings` ✅ — Zero warnings
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL — not a code bug)
- `pnpm tauri build --debug` ⚠️ — blocked when `adb-gui-next.exe` is already running

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Layout | ✅ Fixed | h-svh boundary, flex-col pinned header, overflow-x-hidden containment |
| Responsive | ✅ Fixed | All 8 views — min-w-0 chain complete, no horizontal overflow |
| Header | ✅ Fixed | Structurally pinned via flex-col — never scrolls regardless of content |
| Sidebar | ✅ Fixed | No phantom scrollbar gutter; overflow-x-hidden on content |
| Payload Dumper | ✅ Enhanced | Remote metadata panel, OPS/OFP/sparse support, URL persistence, viewport-relative heights |
| OPS/OFP | ✅ Working | Decryption verified, 62 partitions, comprehensive docs written |
| Marketplace | ✅ Working | 4-provider Unified Discovery with all providers returning results. F-Droid search API, IzzyOnDroid cross-reference, GitHub with proper encoding + PAT support, Aptoide ws75. Settings dialog with provider management + GitHub PAT. 600ms debounce, min 2-char query. |
| Emulator Manager | ✅ Fixed & Working | AVD discovery via INI scan (no emulator binary needed), `resolve_emulator_binary()` for SDK-aware launch, crash detection, error visibility. Running emulators appear in roster with correct serial/status. |
| App Manager | ✅ Fixed | Viewport-relative virtualizer + APK list heights |
| Connected Devices | ✅ Fixed | min-w-0 + truncate on device name/serial |
| FileSelector | ✅ Fixed | min-w-0 on outer div for path truncation chain |
| Frontend | ✅ Complete | shadcn Sidebar + 8 views + bottom panel |
| Bottom Panel | ✅ Polished | Fixed position, fluid resize (DOM-first/RAF), smart tab toggle |
| File Explorer | ✅ Enhanced | Full CRUD, dual-pane, history, search, sort, human sizes, symlinks |
| Device Management | ✅ Centralized | Global DeviceSwitcher in header, single polling source |
| App Manager | ✅ Improved | shadcn Command search, destructive glow, non-blocking install |
| Flasher | ✅ Overhauled | Async flash/wipe, DropArea with position hit-testing, queue actions |
| Backend | ✅ Complete | All 36 Tauri commands fully async |
| Security | ✅ Hardened | Shell injection, SSRF, path traversal, content-length validation |

---

## Critical Patterns & Gotchas

### Layout & CSS

- **h-svh boundary is MANDATORY**: The outer `<div>` wrapper in `MainLayout` MUST have `h-svh overflow-hidden`. Without it, `flex-1` resolves to ∞ and the header scrolls.
- **`min-h-svh` is wrong for desktop apps**: Web pages use it to grow; Tauri apps need `h-full` (fill the bounded container).
- **`overflow-hidden` breaks sticky**: Never add `overflow: hidden` to an ancestor of a `position: sticky` element — it terminates the scroll-ancestor search. Use `overflow-x-hidden` for desktop layout boundaries.
- **NO `position: sticky` in this app**: The header is pinned by being a `shrink-0` flex sibling above the `flex-1 overflow-y-auto` scroll area. No z-index management needed.
- **`position: fixed` children are NOT affected by `overflow-hidden`**: Fixed elements (BottomPanel, Toaster) use the viewport as their containing block. Only a CSS `transform` on an ancestor would re-contain them.
- **`min-w-0` chain must be unbroken**: Every flex ancestor between the scroll boundary and a `truncate` text element must have `min-w-0`. Missing one link = overflow escapes upward.
- **`scrollbar-gutter: stable` must be scoped**: Applied via `.main-scroll-area` class only. Global application causes phantom gutters in sidebar and nested scroll containers.
- **Viewport-relative heights for scroll lists**: Use `max-h-[40vh]` not `max-h-100` (400px). Always pair with a `min-h-[Npx]` so lists don't collapse to zero on tall windows.

### OPS/OFP Porting

- **mbox is a list of byte-values, NOT packed u32**: Each `mbox[i]` is 0-255. Never use `u32::from_le_bytes()` to pack adjacent bytes.
- **XML uses `<Image>` in `<program>` tags**: Not just `<File>` elements. Missing `<Image>` parsing loses 90%+ of partitions.
- **XML offset is from END of file**: `file_size - 0x200 - aligned_xml_length`, not `config_offset * 0x200`.
- **Decrypted XML has BOM + NUL padding**: Must strip `\u{FEFF}`, `\0`, and `\u{FFFD}` before parsing.
- **sbox_as_u32_array must be [u32; 2048]**: One entry per byte of sbox.bin, not 512.
- **mtk_shuffle ≠ mtk_shuffle2**: Operation order (XOR vs nibble-swap) is reversed.

### React & State

- **`loadFiles` deps = `[]`**: Uses `historyIndexRef.current`. Adding `historyIndex` causes infinite render loop (50+ ADB calls/sec).
- **`fileList.length === 0 && creatingType === null`**: The empty-state condition. Missing `creatingType === null` breaks inline creation in empty directories.
- **Device polling**: Single `useQuery(['allDevices'], 3s)` in MainLayout — never add per-view polling.
- **`selectedSerial` auto-select**: disconnect → clear, single device → auto-select, user pick → persist.
- **Bottom panel resize**: Use `panelRef` + RAF + `setState` only on mouseup. Never `setState` on mousemove.

### Rust

- **Tauri sync commands = main thread**: `pub fn` commands block WebView. Always `pub async fn` + `tokio::task::spawn_blocking`.
- **`State<'_, T>` in async commands**: Cannot use `spawn_blocking` (needs `'static`). Use `block_in_place` instead.
- **`split_args` in spawn_blocking**: Must be called **inside** the `spawn_blocking` closure — borrows from the closure-owned String, not across 'static boundary.
- **`cargo test` on Windows**: STATUS_ENTRYPOINT_NOT_FOUND — pre-existing Tauri DLL issue, not a code bug.
- **`pnpm tauri build --debug` can fail with `os error 5`**: If `src-tauri/target/debug/adb-gui-next.exe` is still running or locked by another process, packaging fails until the lock is released.
- **`emulator` binary is NOT bundled**: Unlike `adb`/`fastboot`, the Android `emulator` binary lives in `$SDK/emulator/`. Use `sdk::resolve_emulator_binary_from_current_env()` — never `resolve_binary_path(app, "emulator")` — for emulator-specific operations. `ANDROID_HOME`/`ANDROID_SDK_ROOT` may not be set; the `LOCALAPPDATA` fallback covers the default Android Studio install path.
- **`emulator -list-avds` is fragile**: It requires the `emulator` binary. Prefer scanning `~/.android/avd/*.ini` files directly for AVD enumeration — these files are the canonical ground truth and require zero binary dependencies.
- **Windows `config.ini` uses backslashes**: `image.sysdir.1` in a Windows AVD's `config.ini` uses backslashes (`system-images\android-31\...`). Always normalise to forward slashes before `PathBuf::join` to avoid broken path resolution.

### Component Patterns

- **`AppManager shouldFilter={false}`**: Mandatory — cmdk's built-in filter conflicts with virtualizer.
- **Drag-drop hit-testing**: Tauri's `onDragDropEvent` is window-level. Always use `getBoundingClientRect()` + cursor `(x, y)`.
- **One `OnFileDrop` per page**: Calling it replaces the previous handler. Multiple drop areas = single handler + hit-test per ref.
- **ErrorBoundary**: Keyed to `activeView` so navigating away + back resets it.
- **Tauri `DragDropEvent` API**: `type` is `'enter' | 'over' | 'drop' | 'leave'` — NOT `'cancel'`.
- **`deviceStatus.ts`**: Single source of truth. Import `getStatusConfig()` from `@/lib/deviceStatus` — never define locally.
- **`loadFiles` request sequencing**: `loadRequestIdRef = useRef(0)`, stamp `requestId = ++ref.current`, discard stale after each `await`.
