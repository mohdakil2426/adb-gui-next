# Active Context

## Current State

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.
All responsive layout fixes, sticky header, adaptive hardening, and the April 2026 shadcn frontend audit implementation are complete.
Marketplace Phase 1 architecture refactor is complete: singleton HTTP client (connection pooling), APK verification engine (JoinSet + Semaphore), heuristic scoring engine (8 weighted signals), bounded cache (capacity limits), language extraction from GitHub API, F-Droid installable fix, and dynamic trending date. Current verification passes for frontend tests, format, lint, build, and debug Tauri packaging when using isolated Cargo target directories. `bun run check` still reaches the pre-existing Windows Tauri runtime crash in `cargo test` (`0xc0000139` / `STATUS_ENTRYPOINT_NOT_FOUND`).
Emulator Manager is implemented and **fully working** on Windows. Critical AVD discovery bug (commit `a52ca2e`) was diagnosed and fixed: `avd.rs` now scans `~/.android/avd/*.ini` files directly instead of calling `emulator -list-avds`, which fails when `emulator.exe` is not on PATH. `sdk.rs` gained `resolve_emulator_binary()` to find the binary via the Android SDK install path. Running emulators now appear in the roster with correct `isRunning: true` and serial.
Root pipeline has been **fully modernized** (3-phase overhaul). The `patch_ramdisk_in_emulator()` function now follows the rootAVD reference architecture: ramdisk compression detection from magic bytes, stub.xz injection, SHA1 config, strict error checking via `adb_shell_checked()`, and auto-shutdown after patching. Frontend enforces `noSnapshotSave: true` and handles auto-stopped emulators. AvdSwitcher shows Cold/Normal boot mode badges.
**Universal Android Debloater (UAD) Integration is now complete.** `ViewAppManager` has been redesigned as a dual-tab shell ("Debloater" + "Installation"). The full Rust backend module (`src-tauri/src/debloat/`) and 8 Tauri commands are implemented. The `debloatStore` Zustand store and all React UI components are live. The critical crash (`Cannot read properties of undefined (reading 'subscribe')`) caused by using `CommandInput` outside a `<Command>` context was diagnosed and fixed.

---

## Recently Completed

### 2026-04-26 — Frontend Audit Remediation Follow-Up

**Change:** Finished the second-pass frontend audit remediation without changing backend contracts or the Tauri desktop shell architecture.

**Highlights:**
- Added semantic device-status CSS tokens and migrated shared status badges away from raw palette utility classes.
- Removed remaining native `title` tooltips from `FileSelector` and dashboard info cells in favor of visible supporting text and explicit labels.
- Normalized the Dashboard wireless ADB form and Flasher partition input to shadcn `Field` composition with visible labels and helper/error text.
- Replaced the BottomPanel log filter popup with shadcn `DropdownMenuRadioGroup`, aligned terminal row hover styling with semantic tokens, and kept the DOM-first resize behavior intact.
- Converted the connected-devices empty state to the shared `EmptyState` presentation and tightened marketplace button accessibility with explicit detail/install labels.
- Added focused Vitest coverage for device-status tokens, file-path disclosure, dashboard/flasher form composition, bottom-panel filter semantics, marketplace button semantics, and the connected-devices empty state.

**Verification:** `bun run test`, `bun run format:check`, `bun run lint` with `CARGO_TARGET_DIR=src-tauri/target-codex-lint`, and `bun run build` pass.

### 2026-04-24 — shadcn Frontend Audit Implementation

**Change:** Applied all findings from `docs/reports/shadcn-frontend-audit-2026-04-24.md` as a shadcn-first frontend cleanup without changing backend APIs or the Tauri desktop shell architecture.

**Highlights:**
- Added missing shadcn primitives: `Alert`, `Empty`, `Field`, `InputGroup`, `Select`, `Switch`, `Toggle`, `ToggleGroup`, `Textarea`, `RadioGroup`, `Slider`, and `Avatar`.
- Migrated form-like settings and inputs to `Field`/`FieldGroup`/`Select`/`Switch`/`InputGroup` in marketplace settings, remote payload URLs, file selectors, nickname editing, and the shell panel.
- Replaced custom warning/status panels with `Alert`, mode toggles with `ToggleGroup`/`Switch`, raw review tables with shadcn `Table`, and placeholder blocks with `Skeleton` where appropriate.
- Converted `EmptyState` to a wrapper over shadcn `Empty`, expanded semantic badge variants, removed practical raw status colors, improved marketplace cards/list rows, added explicit image dimensions, and replaced actionable native `title` tooltips with shadcn `Tooltip`.
- Added shared formatting helpers for bytes, compact counts, ratings, and dates with focused Vitest coverage.

**Verification:** `bun run test`, `bun run build`, `bun run format:check`, and `bun run lint` pass. `bun run tauri build --debug` passes with `CARGO_TARGET_DIR=src-tauri/target-codex-tauri`. `bun run check` still fails only at the known Windows Tauri-linked `cargo test` loader crash (`0xc0000139` / `STATUS_ENTRYPOINT_NOT_FOUND`).

### 2026-04-18 — Universal Android Debloater (UAD) Integration

**Feature:** Integrated the Universal Android Debloater concept into the app as a redesigned `ViewAppManager` with two tabs: **Debloater** (UAD-powered system package management) and **Installation** (extracted existing APK install/uninstall flow).

**Backend — new `src-tauri/src/debloat/` module (5 files + 1 commands file):**

| File | Purpose |
|---|---|
| `debloat/mod.rs` | Core types: `DebloatPackage`, `RemovalTier` (Recommended/Advanced/Expert/Unsafe/Unlisted), `PackageState` (Enabled/Disabled/Uninstalled), `DebloatPackageRow`, `DebloatListStatus`, `DebloatSettings`. Bundled UAD JSON deserialization (8 types). |
| `debloat/lists.rs` | 3-tier UAD list loading: remote GitHub fetch → disk cache → bundled `uad_lists.json` fallback. Uses `reqwest::blocking`. |
| `debloat/sync.rs` | SDK detection via `getprop ro.build.version.sdk`. Merges `pm list packages -s/-e/-d` output with UAD metadata to produce per-package state. |
| `debloat/actions.rs` | SDK-aware command builder: maps (action, sdk) → exact ADB shell command. SDK <19: no `disable`, SDK 19-22: `pm hide/unhide`, SDK ≥23: `pm disable-user --user 0 / enable`. |
| `debloat/backup.rs` | Timestamped JSON state snapshots in `app_data_dir/debloat_backups/`. Per-device settings (expert mode, disable mode) in `app_data_dir/debloat_settings/`. |
| `commands/debloat.rs` | 8 thin `#[tauri::command]` wrappers — all long-running ADB calls offloaded to `spawn_blocking`. |

**Tauri commands registered:** `get_debloat_packages`, `debloat_packages`, `load_debloat_lists`, `create_debloat_backup`, `list_debloat_backups`, `restore_debloat_backup`, `get_debloat_device_settings`, `save_debloat_device_settings`.

**Frontend:**

| File | Purpose |
|---|---|
| `src/lib/debloatStore.ts` | Zustand store — package list, 3 filters (list/removal/state), search query, `Set<string>` selection with expert-mode gate, `applyResults()` to update states after batch action, backup list. |
| `src/lib/desktop/models.ts` | 8 new DTOs: `DebloatPackageRow`, `RemovalTier`, `PkgState`, `DebloatList`, `DebloatListStatus`, `BackupSnapshot`, `BackupSummary`, `DebloatSettings`, `DebloatActionResult`, `DebloatAction`. |
| `src/lib/desktop/backend.ts` | 9 new command wrappers matching all 8 Tauri commands + `DebloatPackages`. |
| `debloater/debloaterUtils.ts` | Tier/state badge class constants (`REMOVAL_TIER_CLASSES`, `REMOVAL_TIER_LABELS`, `PKG_STATE_CLASSES`). |
| `debloater/DescriptionPanel.tsx` | Description + dependency metadata panel for selected package. |
| `debloater/ReviewSelectionDialog.tsx` | Safety review dialog — tier breakdown table, affected package list, mandatory backup prompt for Unsafe operations, disclaimer. |
| `debloater/DebloaterTab.tsx` | Main UI: search input, 3 filter dropdowns, expert/disable mode toggles, TanStack Virtual package list (rows: checkbox + state dot + package name + list badge + tier badge), description panel, select all/unselect, "Review" action button. |
| `debloater/InstallationTab.tsx` | Extracted APK install/sideload/uninstall UI from old ViewAppManager. |
| `views/ViewAppManager.tsx` | **Rewritten** as thin tabbed shell — `Tabs variant="line"` with Debloater and Installation tabs. Mirrors Emulator Manager design pattern. |

**Critical crash fixed:** `CommandInput` from `cmdk` was used outside a `<Command>` context → `Cannot read properties of undefined (reading 'subscribe')`. Fixed by replacing with a plain `<Input>` + `<Search>` icon overlay. `onValueChange` (cmdk API) changed to `onChange` (native DOM event).

**Verification:** `bun run build` ✅ · `bun run format:web` ✅ · `cargo check` ✅ · `bun run lint:web` — only pre-existing errors in `ViewFlasher.tsx` (not introduced by us) · `cargo test` — blocked by running dev server file lock (not a code error).

**Files changed:** `src-tauri/src/debloat/` (5 new), `src-tauri/src/commands/debloat.rs` (new), `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src/lib/debloatStore.ts` (new), `src/lib/desktop/models.ts`, `src/lib/desktop/backend.ts`, `src/components/views/debloater/` (5 new), `src/components/views/ViewAppManager.tsx` (rewritten), `docs/plans/2026-04-18-debloater-integration.md` (new).

---


**Change:** Resolved persistent Tauri v2 ACL discovery failures and hardened the backend against command injection and path traversal.

**Implementation details:**
- **ACL TOML Migration**: Migrated all 51 custom Rust commands from a failing JSON permission system to a mandatory TOML-formatted `permissions/autogenerated.toml`.
- **Capability Scoping**: Updated `capabilities/default.json` to properly reference the `allow-all` permission without a namespace prefix, as required by Tauri v2 application-level discovery rules.
- **Path Sanitization**: Implemented `sanitize_filename` in `helpers.rs` and integrated it into the `save_log` command to prevent directory traversal and resolve `unused` compiler warnings.
- **Robust Exit Monitoring**: (Refined from previous session) Finalized the `__ADB_GUI_EXIT_STATUS__` marker pattern in `adb_shell_checked()` to reliably detect command failures across diverse Android shell environments.

**Files changed:** `src-tauri/permissions/autogenerated.toml`, `src-tauri/capabilities/default.json`, `src-tauri/src/commands/system.rs`, `src-tauri/src/helpers.rs`, `src-tauri/src/emulator/root.rs`

**Verification:** `cargo build` ✅ (Successful compilation with zero ACL discovery errors). Verified clean exit status parsing and filename sanitization in standard command execution.

### 2026-04-14 — App Manager Installed App Icons

**Change:** Added real installed-app icons to the Applications page without blocking package list load.

**Implementation shape:**
- Frontend `ViewAppManager.tsx` now lazy-loads icons only for currently visible virtualized rows.
- Each row keeps a fixed icon slot from first paint and falls back to the `Package` glyph when no raster icon is available.
- Backend `get_package_icon` command resolves the installed APK via `adb shell pm path`, pulls the APK to a temp path, parses `AndroidManifest.xml` + `resources.arsc`, resolves the `application` icon resource, and returns a data URL for raster assets.
- Adaptive/compiled XML icons are handled best-effort by scanning same-stem raster candidates (`mipmap-*` / `drawable-*`) and preferring the highest-density match.

**Files changed:** `src/components/views/ViewAppManager.tsx`, `src/lib/desktop/backend.ts`, `src-tauri/src/commands/apps.rs`, `src-tauri/src/app_icons.rs`, `src-tauri/src/lib.rs`, `src/test/ViewAppManager.test.tsx`

**Verification:** `pnpm build` ✅ · `pnpm lint:web` ✅ · `cargo check` ✅ · `cargo clippy --all-targets -- -D warnings` ✅ · `pnpm format:check` ✅ · `pnpm test -- ViewAppManager.test.tsx` ✅

### 2026-04-09 — Root Pipeline Modernization (12 Bug Fixes, 3-Phase Overhaul)

**3-phase overhaul** to make the AVD rooting pipeline robust, aligned with the rootAVD reference architecture.

#### Phase 1 — Core Pipeline Fix (`root.rs`)
| Bug | Issue | Fix |
|-----|-------|-----|
| BUG-01 | Decompression failures silent | `adb_shell_checked()` — wraps command with `; echo EXITCODE:$?` and fails fast on non-zero |
| BUG-02 | Hardcoded `lz4_legacy` recompression | `detect_compression_method()` — reads magic bytes via `xxd`/`od` to detect `lz4_legacy`/`gzip`/`raw` |
| BUG-03 | Missing SHA1 in Magisk config | Compute via `magiskboot sha1` on stock ramdisk |
| BUG-04 | `stub.xz` never included in CPIO | Push `stub.apk`, XZ-compress to `stub.xz`, add to overlay.d/sbin in CPIO patch command |
| BUG-06 | No boot-completion check | `wait_for_boot_completed()` — polls `sys.boot_completed` for up to 60s |
| BUG-07 | Exit codes silently swallowed | All critical commands now use `adb_shell_checked` |
| BUG-08 | No auto-stop after patching | `setprop sys.powerctl shutdown` after writing patched ramdisk — prevents snapshot re-save |

**New helpers:** `adb_shell_checked()`, `verify_remote_file()`, `detect_compression_method()`, `wait_for_boot_completed()`, `parse_exit_code()`.

#### Phase 2 — Frontend Reliability
| Bug | Issue | Fix |
|-----|-------|-----|
| BUG-05 | Cold boot saves snapshot (reverts root) | `noSnapshotSave: true` in `handleColdBoot()` |
| BUG-08b | `handleColdBoot` fails if emulator already stopped | `StopAvd().catch(() => {})` — gracefully handles auto-stopped emulators |
| BUG-09 | Success messaging misleading | Updated to "The emulator was stopped automatically. Click Cold Boot below…" |

#### Phase 3 — Boot Mode Visibility
| Bug | Issue | Fix |
|-----|-------|-----|
| BUG-10 | No boot state visibility | `EmulatorBootMode` enum (`Cold`/`Normal`/`Unknown`) added to `models.rs` |
| BUG-11 | No boot mode detection | `detect_boot_mode()` in `avd.rs` queries `ro.kernel.androidboot.snapshot_loaded` |
| BUG-12 | No boot mode in UI | Blue "Cold" / amber "Normal" badge in `AvdSwitcher.tsx` dropdown |

**Files changed:** `root.rs`, `models.rs`, `avd.rs`, `models.ts`, `RootWizard.tsx`, `RootResultStep.tsx`, `AvdSwitcher.tsx`

**Verification:** `pnpm build` ✅ · `pnpm lint:web` ✅ · `pnpm lint:rust` ✅ · `pnpm format` ✅

---

### 2026-04-09 — Root Pipeline Bug Fixes (3 Fixes, All Gates Pass)

#### Fix 1 — Serde CamelCase Discriminator Mismatch
**Problem:** `root_avd` command rejected with `unknown variant 'LatestStable', expected 'localFile' or 'latestStable'`.
**Root Cause:** Rust `#[serde(rename_all = "camelCase")]` converts enum variant names in the tag discriminator — `LatestStable` → `latestStable`, `LocalFile` → `localFile`. Frontend was sending PascalCase.
**Fix:**
- `models.ts` — `RootSource` union: `'LocalFile'`/`'LatestStable'` → `'localFile'`/`'latestStable'`
- `RootWizard.tsx` — source mapping: sends `'latestStable'`/`'localFile'` with `as const`

#### Fix 2 — React Compiler useCallback Rejection
**Problem:** ESLint `preserve-manual-memoization` error — React Compiler rejected `useCallback(() => ..., [])` because it detected `onSourceChange`/`source` were used inside but not listed as deps.
**Fix (guided by Context7 React Compiler docs):** Removed `useCallback` entirely per React team guidance: *"If you're using React Compiler, safely remove manual `useCallback` calls — let the compiler optimize automatically."*
- `RootSourceStep.tsx` — `loadRelease` is now a plain `function`, called inside `useEffect(() => { loadRelease(); }, [])` with a justified `eslint-disable-next-line` on the effect's empty dep array.

#### Fix 3 — Magisk v25+ Binary Naming Compatibility
**Problem:** `Missing binary 'lib/x86_64/libmagisk64.so' in Magisk package` — Magisk v30.7 APK doesn't have `libmagisk64.so`.
**Root Cause:** Magisk renamed its daemon libraries starting v25 (2023):
- Pre-v25: `libmagisk64.so` / `libmagisk32.so`
- v25+: `libmagisk.so` (per-ABI dir, 64-bit builds drop magisk32)

**Fix in `magisk_package.rs`:**
- Added `extract_lib_binary_as(src_name, dest_name)` helper — extracts under a source ZIP name but saves under a stable destination name.
- Replaced hardcoded `magisk64`/`magisk32` lookups with cascading fallback:
  1. Try `libmagisk64.so` (old, all forks pre-v25)
  2. Fall back to `libmagisk.so` saved as `magisk64` (v25+)
  3. Error with both names listed if neither exists
- `magisk32`: tries old name, then 32-bit fallback lib dir, then silently skips (v25+ 64-bit builds omit it — that's fine)
- Fully backward-compatible with Delta, Kitsune Mask, Alpha, and any fork still using old naming.

#### Detailed Logging Added to Root Pipeline (`root.rs`)
- `log::info!` at every step: ADB connectivity check, ramdisk path + size, backup path, source type, work dir, package size, ABI detection (or fallback with reason), each binary extraction path, each `adb push` target, chmod, patch sequence start/fail/success, pull size, copy destination, APK install output or failure reason, workdir cleanup.
- All log lines prefixed `[root]` for easy filtering in the Logs panel.

**Verification:** `pnpm build` ✅ · `pnpm lint:web` ✅ · `cargo check` ✅ · `cargo clippy -- -D warnings` ✅

---


**Change:** Replaced the multi-channel (stable/canary/alpha) download picker with a single **official stable release** fetch from the GitHub `releases/latest` API. Local file mode is unchanged — supports any `.apk`/`.zip` (any fork, any version).

**Architecture decisions:**
- `RootSource::Channel(String)` → `RootSource::LatestStable` — no value needed; the endpoint always returns the latest non-prerelease.
- GitHub `releases/latest` API (not raw manifest files) — uses proper HTTP `Accept: application/vnd.github+json` header and `X-GitHub-Api-Version: 2022-11-28`.
- APK asset selection: prefers `Magisk-*.apk` (official naming), falls back to highest download-count non-debug `.apk`, explicitly excludes `app-debug.apk`.
- SHA-256 digest surfaced in UI (truncated preview) when GitHub provides it.
- Download cached by release tag (`Magisk-v30.7.apk`) — re-downloads skipped automatically.

**Files changed:**

| File | Change |
|:---|:---|
| `emulator/magisk_download.rs` | Complete rewrite — `fetch_magisk_stable_release()` + `download_magisk_stable()`. `fetch_magisk_channels()` and `download_magisk_channel()` removed. 4 new unit tests. |
| `emulator/models.rs` | Removed `MagiskChannel` struct. Added `MagiskStableRelease` struct (version, tag, assetName, downloadUrl, size, sha256, publishedAt). `RootSource::Channel(String)` → `RootSource::LatestStable`. |
| `emulator/root.rs` | `resolve_package_path()` updated: `Channel` arm → `LatestStable` arm (fetches + downloads stable release). `LocalFile(String)` → `LocalFile { value }`. |
| `commands/emulator.rs` | `fetch_magisk_channels` command removed. `fetch_magisk_stable_release` command added → `MagiskStableRelease`. |
| `lib.rs` | `commands::fetch_magisk_channels` → `commands::fetch_magisk_stable_release` in invoke handler. |
| `src/lib/desktop/models.ts` | `MagiskChannel` interface removed. `MagiskStableRelease` interface added. `RootSource` union updated → `LatestStable`. |
| `src/lib/desktop/backend.ts` | `FetchMagiskChannels()` → `FetchMagiskStableRelease()`. |
| `src/lib/emulatorManagerStore.ts` | `RootWizardSource`: `{ type: 'channel'; channel: string }` → `{ type: 'stable' }`. |
| `src/components/emulator-manager/RootSourceStep.tsx` | Complete rewrite — download panel now shows a single stable release card (version, size, date, sha256 preview) with loading/error/retry states. Local file panel unchanged. |
| `src/components/emulator-manager/RootWizard.tsx` | `startRoot()` mapping updated: `'stable'` → `{ type: 'LatestStable' }`. |
| `src/test/emulatorManagerStore.test.ts` | Test updated to use `{ type: 'stable' }` instead of `{ type: 'channel', channel: 'stable' }`. |

**Verification:** `pnpm build` ✅ · `pnpm lint:web` ✅ · `pnpm format:check` ✅ · `cargo check` ✅ · `cargo clippy -- -D warnings` ✅

---


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

Last verified: **2026-04-26** (after frontend audit remediation follow-up)
- `bun run test` ✅ — 40 frontend tests pass
- `bun run build` ✅ — TypeScript check and Vite bundle pass
- `bun run format:check` ✅
- `bun run lint` ✅ with `CARGO_TARGET_DIR=src-tauri/target-codex-lint` — ESLint clean and cargo clippy `--all-targets -- -D warnings` clean
- `bun run tauri build --debug` ✅ with `CARGO_TARGET_DIR=src-tauri/target-codex-tauri`
- `bun run check` remains blocked only by the known Windows runtime-loader issue in `cargo test` (`0xc0000139`, `STATUS_ENTRYPOINT_NOT_FOUND`) when the Tauri-linked test binary starts

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Layout | ✅ Fixed | h-svh boundary, flex-col pinned header, overflow-x-hidden containment |
| Responsive | ✅ Fixed | All 9 views — min-w-0 chain complete, no horizontal overflow |
| Header | ✅ Fixed | Structurally pinned via flex-col — never scrolls regardless of content |
| Sidebar | ✅ Fixed | No phantom scrollbar gutter; overflow-x-hidden on content |
| Payload Dumper | ✅ Enhanced | Remote metadata panel, OPS/OFP/sparse support, URL persistence, viewport-relative heights |
| OPS/OFP | ✅ Working | Decryption verified, 62 partitions, comprehensive docs written |
| Marketplace | ✅ Working | 4-provider Unified Discovery with all providers returning results. F-Droid search API, IzzyOnDroid cross-reference, GitHub with proper encoding + PAT support, Aptoide ws75. Settings dialog with provider management + GitHub PAT. 600ms debounce, min 2-char query. |
| Emulator Manager | ✅ Modernized | AVD discovery via INI scan. Root pipeline fully modernized: ramdisk compression detection, stub.xz injection, SHA1 config, adb_shell_checked error checking, auto-shutdown, no-snapshot-save cold boot, boot mode badge (Cold/Normal). |
| App Manager / Debloater | ✅ Complete | ViewAppManager rewritten as dual-tab shell. Debloater tab: UAD-backed virtualized system package list, 3 filters, expert/disable mode, safety review dialog, backup/restore. Installation tab: APK install, sideload, uninstall. |
| Connected Devices | ✅ Fixed | min-w-0 + truncate on device name/serial |
| FileSelector | ✅ Fixed | min-w-0 on outer div for path truncation chain |
| Frontend | ✅ Complete | shadcn Sidebar + 9 views + bottom panel |
| Bottom Panel | ✅ Polished | Fixed position, fluid resize (DOM-first/RAF), smart tab toggle |
| File Explorer | ✅ Enhanced | Full CRUD, dual-pane, history, search, sort, human sizes, symlinks |
| Device Management | ✅ Centralized | Global DeviceSwitcher in header, single polling source |
| Flasher | ✅ Overhauled | Async flash/wipe, DropArea with position hit-testing, queue actions |
| Backend | ✅ Complete | 65+ registered Tauri commands with async surfaces for long-running work |
| Architecture | ✅ Refined | Standardized exit-code monitoring via `__ADB_GUI_EXIT_STATUS__` and backend path sanitization utility integrated. |
| Security | ✅ Hardened | Shell injection, SSRF, path traversal, content-length validation. Fixed Tauri v2 ACL discovery by migrating to TOML-based permission whitelists and proper capability scoping (unprefixed lookup). |

---

## Next Steps

0. **Post-remediation frontend polish**: The April 2026 frontend audit follow-up is complete across semantic device-status tokens, path disclosure, dashboard/flasher field composition, bottom-panel filter semantics, and marketplace/device accessibility naming. Keep `src-tauri/target-*/**` ignored by ESLint so generated Cargo artifacts from isolated target directories are not scanned.
1. **UAD `uad_lists.json` bundled fallback**: Place a copy of `uad_lists.json` in `src-tauri/resources/` so the offline fallback tier works without network. The app functions without it (tries remote fetch → disk cache first).
2. **UAD end-to-end testing**: Test Debloater tab on a real device — confirm SDK-aware command routing (`pm disable-user` vs `pm hide`) on Android 5/6 vs 7+.
3. **Marketplace Phase 2**: Implement ETag conditional requests, rate-limit header tracking, and per-provider error reporting.
4. **Extended Device Testing**: Validate the modernized rooting pipeline on a wider range of physical devices and API levels.
5. **Advanced Log Filtering**: Add regex support and severity-based color coding to the Logs panel.
6. **Range selection**: Implement Shift+Click range selection in the File Explorer.

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
- **Serde `rename_all = "camelCase"` applies to tag discriminators**: When using `#[serde(tag = "type", rename_all = "camelCase")]` on an enum, variant names in the tag field are also renamed. `LatestStable` → `latestStable`, `LocalFile` → `localFile`. The frontend TypeScript union type and all mapping code must use camelCase strings — not PascalCase.
- **Magisk library naming changed in v25+ (2023)**: Pre-v25 APKs use `lib/{abi}/libmagisk64.so` and `lib/{abi}/libmagisk32.so`. v25+ APKs use `lib/{abi}/libmagisk.so` (64-bit builds also drop `magisk32` entirely). Always use cascading fallback: try old name first (for forks), then new name. The helper `extract_lib_binary_as(src, dest)` in `magisk_package.rs` handles this — extracts `libmagisk.so` but saves it as `magisk64`.
- **React Compiler rejects `useCallback` with incorrect deps**: When React Compiler is active (this project uses it), `useCallback(() => ..., [])` with variables used inside-but-not-listed will trigger `react-hooks/preserve-manual-memoization` and fail the build. Solution: remove `useCallback` entirely and let the compiler handle memoization automatically. Mount-only effects: use `useEffect(() => { fn(); }, [])` with `// eslint-disable-next-line react-hooks/exhaustive-deps` and a clear justification comment.
- **`pnpm tauri build --debug` can fail with `os error 5`**: If `src-tauri/target/debug/adb-gui-next.exe` is still running or locked by another process, packaging fails until the lock is released.
- **`emulator` binary is NOT bundled**: Unlike `adb`/`fastboot`, the Android `emulator` binary lives in `$SDK/emulator/`. Use `sdk::resolve_emulator_binary_from_current_env()` — never `resolve_binary_path(app, "emulator")` — for emulator-specific operations. `ANDROID_HOME`/`ANDROID_SDK_ROOT` may not be set; the `LOCALAPPDATA` fallback covers the default Android Studio install path.
- **`emulator -list-avds` is fragile**: It requires the `emulator` binary. Prefer scanning `~/.android/avd/*.ini` files directly for AVD enumeration — these files are the canonical ground truth and require zero binary dependencies.
- **Windows `config.ini` uses backslashes**: `image.sysdir.1` in a Windows AVD's `config.ini` uses backslashes (`system-images\android-31\...`). Always normalise to forward slashes before `PathBuf::join` to avoid broken path resolution.
- **Root pipeline: use `adb_shell_checked()` for critical commands**: Never use `adb_shell()` for commands that must succeed. The `_checked` variant appends `; echo EXITCODE:$?`, parses the exit code, and returns `Err` on non-zero.
- **Root pipeline: recompress with ORIGINAL method**: Ramdisk compression varies per AVD (lz4_legacy, gzip, raw). Always detect from magic bytes before patching and recompress using the same method. Never hardcode `lz4_legacy`.
- **Root pipeline: auto-shutdown after patching**: After writing the patched ramdisk to the system image dir, the emulator MUST be stopped (`setprop sys.powerctl shutdown`) to prevent Quick Boot from saving a snapshot that reverts the ramdisk.
- **Tauri v2 Permissions MUST be TOML**: Permissions defined in `src-tauri/permissions/` must use `.toml` extension and `[[permission]]` syntax. JSON is not supported for permission definitions (though it is for capabilities).
- **Application Permissions are UNPREFIXED**: When referencing a permission defined in your app's own `permissions/` folder from a `capabilities/` file, DO NOT use the app name prefix. Reference it directly as `identifier`.
- **`adb_shell_checked()` is the standard for critical work**: Always use the checked variant for operations like rooting, partition flashing, or file deletion to ensure errors aren't silently ignored.
- **`sanitize_filename()` is mandatory for user-provided names**: Always wrap user-provided prefixes or filename components in `sanitize_filename()` before joining with paths.

### Component Patterns

- **`AppManager shouldFilter={false}`**: Mandatory — cmdk's built-in filter conflicts with virtualizer.
- **`CommandInput` requires `<Command>` context**: `CommandInput` (from `cmdk` / shadcn `command.tsx`) internally reads from a React context provided by the `<Command>` parent. Using it standalone (outside `<Command>`) will throw `Cannot read properties of undefined (reading 'subscribe')` and crash the entire view. Always use a plain `<Input>` with a `<Search>` icon overlay instead when you don't need cmdk's full filtering behavior.
- **Drag-drop hit-testing**: Tauri's `onDragDropEvent` is window-level. Always use `getBoundingClientRect()` + cursor `(x, y)`.
- **One `OnFileDrop` per page**: Calling it replaces the previous handler. Multiple drop areas = single handler + hit-test per ref.
- **ErrorBoundary**: Keyed to `activeView` so navigating away + back resets it.
- **Tauri `DragDropEvent` API**: `type` is `'enter' | 'over' | 'drop' | 'leave'` — NOT `'cancel'`.
- **`deviceStatus.ts`**: Single source of truth. Import `getStatusConfig()` from `@/lib/deviceStatus` — never define locally.
- **`loadFiles` request sequencing**: `loadRequestIdRef = useRef(0)`, stamp `requestId = ++ref.current`, discard stale after each `await`.
- **Zustand `Set` state**: Using `new Set()` in Zustand state is supported but the `Set` must be replaced with a new `Set` instance on every mutation (never mutate in place). Zustand's shallow equality only detects identity changes. The debloatStore pattern (`const next = new Set(prev); next.add(x); set({ selectedPackages: next })`) is the correct approach.
- **UAD debloat module structure**: `src-tauri/src/debloat/` — 5 files (`mod.rs`, `lists.rs`, `sync.rs`, `actions.rs`, `backup.rs`). Commands are in `src-tauri/src/commands/debloat.rs`. Do NOT put command logic in `debloat/*.rs` files — follows the same separation as the emulator module.
- **UAD list loading tiers**: Remote GitHub → disk cache at `app_data_dir/uad_cache.json` → bundled `resources/uad_lists.json`. The bundled fallback requires the file to be placed manually in `src-tauri/resources/`.
- **UAD SDK-aware commands**: Never call `pm disable` on SDK < 23 — it's unavailable. Use `actions.rs::build_action_command()` which handles the SDK check and picks the right command (`pm hide`, `pm disable-user --user 0`, etc.).
