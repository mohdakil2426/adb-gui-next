# Progress

## Overall Status

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.

Marketplace now has Phase 1 architecture refactor complete: singleton HTTP client (connection pooling via `ManagedHttpClient`), APK verification engine (ghost result elimination via JoinSet + Semaphore), heuristic-based ranking (8 weighted signals: topics, language, freshness, installability), bounded cache (capacity limits with eviction), language extraction from GitHub API, F-Droid installable fix, and dynamic trending date. Phase 2 deferred: ETag caching, rate limit tracking, per-provider error reporting.

Emulator Manager is **fully working** on Windows (commit `a52ca2e`). Critical bug fixed: AVD discovery now scans `~/.android/avd/*.ini` files directly (no `emulator` binary needed for enumeration). `sdk.rs` gained `resolve_emulator_binary()` for SDK-aware launch. Running emulators appear in roster with correct serial and `isRunning: true`.

## What Works

### TypeScript Toolchain

- TypeScript upgraded to **6.0.2**
- `tsconfig.json` no longer uses deprecated `compilerOptions.baseUrl`
- `@/*` alias continues to work via `paths` without `baseUrl`
- `pnpm exec tsc --noEmit` passes on TypeScript 6.0.2

### Authentication
- GitHub OAuth Device Flow successfully tested and integrated. Backend `auth.rs` correctly extracts and propagates `error_description` from HTTP 4xx responses (e.g., `device_flow_disabled`), greatly streamlining developer onboarding.

### Frontend

- App shell loads under Vite/React with Strict Mode enabled
- shadcn Sidebar (`collapsible="icon"` mode) with grouped navigation (Main/Advanced)
- `AppSidebar.tsx` extracted component with SidebarHeader, SidebarFooter, SidebarRail
- `sidebar-context.ts` holds non-component exports (constants, context, hook) — Fast Refresh clean
- `Ctrl+B` keyboard shortcut for sidebar toggle
- 9 sidebar views compile and build successfully
- **Emulator Manager** (fully redesigned, Design 3 layout):
  - Advanced `Emulator Manager` route under the sidebar Advanced group
  - **Design 3 layout**: Two-row header bar (title + Refresh | AvdSwitcher pill + status meta + action buttons) + full-width content-only Card (TabsList flush at top, no CardHeader)
  - `AvdSwitcher` Popover pill component — mirrors `DeviceSwitcher` exactly (same pill+flyout UX pattern)
  - AVD discovery via `~/.android/avd/*.ini` scan (no `emulator` binary needed for enumeration)
  - Quick actions: Launch / Stop (context-aware toggle) + Cold boot + Open Folder
  - **Removed features (overkill):** Headless mode, Network speed/delay — removed from Rust model, Tauri command args, TS DTO, and all UI
  - Launch tab: cold boot, snapshot, boot animation, writable-system, wipe-data flags (with safety confirmation gate)
  - Assisted root tab: local `.apk`/`.zip` package picker, staged instructions, finalize action
  - Restore tab: explicit restore plan entries, backup-based restore/unroot action
- VS Code-style **fixed-position** bottom panel with Logs and Shell tabs:
  - Viewport-anchored (never scrolls with page); sidebar-aware left offset via `useSidebar()`
  - Fluid resize: DOM-first + RAF throttle (60fps), zero re-renders during drag, `will-change` GPU hint
  - Smart 3-state header button toggles (closed/open-same-tab/open-other-tab)
  - `min-h-0` flex fix ensures shell input always visible at min resize height
  - Main content `paddingBottom` = panel height when open (content reachable behind panel)
- **Pinned header bar** with DeviceSwitcher pill + toolbar buttons:
  - Viewport-locked via `h-svh overflow-hidden` boundary on outer wrapper
  - Structurally pinned as `shrink-0` flex sibling above `flex-1 overflow-y-auto` scroll area
  - No `position: sticky` — header never moves regardless of content height or window size
  - `SidebarProvider` uses `h-full` (fills boundary); `SidebarInset` uses `overflow-x-hidden min-w-0`
- **Responsive layout (fully hardened across all 7 views)**:
  - No horizontal overflow from any view — `min-w-0` chain intact from root to text nodes
  - Viewport-relative scroll container heights (`max-h-[40vh]`, `h-[40vh]`) replace all fixed px heights
  - `scrollbar-gutter: stable` scoped to `.main-scroll-area` class only (no phantom sidebar gutters)
  - Long device serials, file paths, URLs, package names all truncate correctly
- shadcn/ui components (22+ primitives incl. Popover) with Tailwind CSS v4
- Light/dark/system theme support via next-themes
- Toast notifications via sonner
- Framer Motion view transitions (opacity fade 150ms via AnimatePresence in MainLayout)
- Terminal panel with filter dropdown, search highlighting, auto-scroll toggle, maximize/minimize
- App Manager: virtualized package list (TanStack Virtual), user/system filter, type Badge, shadcn `Command`/`CommandInput`/`CommandEmpty` search (shouldFilter=false), toolbar layout (count left, filter+refresh right), non-blocking install via spawn_blocking, stable React keys for removable APK list
- **File Explorer (full-featured dual-pane)**:
  - Lazy-loaded `DirectoryTree` sidebar + resizable right-pane file list
  - Editable address bar; tree collapse/expand; localStorage persistence (`fe.currentPath`, `fe.treeCollapsed`)
  - 5 edge cases: permission denied, spaces in paths, symlinks, device disconnect, responsive
  - **Explicit multi-select mode** (`isMultiSelectMode` gate):
    - Checkbox column absent by default; activated via `Ctrl+Click`, `Ctrl+A`, right-click → Select
  - **Inline rename**: `F2` or right-click; inline Input, Enter/Escape/blur
  - **Bulk delete**: `Delete` key or right-click → AlertDialog
  - **Create File/Folder**: `Ctrl+N`/`Ctrl+Shift+N`, toolbar, right-click, empty-state buttons; inline phantom row
  - **Back/Forward history**: `navHistory` stack (50 max), `Alt+←`/`Alt+→`; `historyIndexRef` prevents infinite loop
  - **Search/Filter**: `Ctrl+F` to focus, client-side filter, `Escape` to clear
  - **Sortable columns**: Name/Size/Date clickable headers; dirs always float above files
  - **Human-readable sizes**: `formatBytes()` from `lib/utils.ts` — `14.0 MB`, dirs show `—`
  - **Symlink target display**: `→ /target` subtitle from parsed `ls -lA` output
  - **Right-click ContextMenu**: Select / Copy Path / Open / Rename / Delete / Import / Export
  - **Import/Export**: Context-aware context menu; `executePull/executePush` shared helpers (DRY)
  - **No in-place array mutation** — all sorts use spread copy
- Shared components: `ActionButton`, `LoadingButton`, `SectionHeader`, `FileSelector`, `SelectionSummaryBar`, `ConnectedDevicesCard` (Dashboard only), `DeviceSwitcher` (global header), `EditNicknameDialog`, `CheckboxItem`, `EmptyState`, `DirectoryTree`, `DropZone` (with position-based hit-testing), `RemoteUrlPanel`
- `getFileName()`, `formatBytes()`, `formatBytesNum()` utilities in `lib/utils.ts`
- `models.ts` DTOs as plain TypeScript interfaces
- No unused React imports (all cleaned up)
- No dead `_activeView` props (removed from 4 views)

### UI Consistency (~95%)

- All CardTitle icons: `className="h-5 w-5"` (no unsized icons, no `size={N}` prop)
- All inline/list icons: `className="h-4 w-4 shrink-0"`
- All form labels: shadcn `<Label>` (no raw `<label className="...">`)
- All destructive AlertDialogAction: `buttonVariants({ variant: 'destructive' })`
- Semantic color tokens everywhere: `text-success`, `bg-success`, `border-success`
- All internal imports use `@/` alias
- All clickable div lists have `role`/`aria-*`/`tabIndex`/`onKeyDown`
- `CheckboxItem` shared component used in AppManager + PayloadDumper
- `EmptyState` shared component used in AppManager

### Backend (Emulator Manager Added)

| Category | Commands |
|----------|-----------|
| Device | `get_devices`, `get_device_info`, `get_device_mode`, `get_fastboot_devices` |
| ADB | `run_adb_host_command`, `run_shell_command`, `connect_wireless_adb`, `disconnect_wireless_adb`, `enable_wireless_adb` |
| Fastboot | `flash_partition` *(async)*, `reboot`, `wipe_data` *(async)*, `set_active_slot`, `get_bootloader_variables`, `run_fastboot_host_command` |
| Files | `list_files`, `push_file`, `pull_file`, `delete_files`, `rename_file`, `create_file`, `create_directory` |
| Apps | `install_package` *(async)*, `uninstall_package` *(async)*, `sideload_package` *(async)*, `get_installed_packages` |
| System | `open_folder`, `launch_terminal`, `save_log`, `launch_device_manager` |
| Payload | `extract_payload`, `list_payload_partitions`, `list_payload_partitions_with_details`, `cleanup_payload_cache`, `get_ops_metadata` |
| Payload (remote_zip) | `check_remote_payload` *(async)*, `list_remote_payload_partitions` *(async)*, `get_remote_payload_metadata` *(async)* — now in default features |
| Marketplace | `marketplace_search` *(async)*, `marketplace_get_app_detail` *(async)*, `marketplace_download_apk` *(async)*, `marketplace_install_apk` *(async)*, `marketplace_get_trending` *(async)*, `marketplace_list_versions` *(async)*, `marketplace_clear_cache`, `marketplace_github_device_start` *(async)*, `marketplace_github_device_poll` *(async)* |
| Emulator | `list_avds` *(async)*, `launch_avd` *(async)*, `stop_avd` *(async)*, `get_avd_restore_plan` *(async)*, `restore_avd_backups` *(async)*, `prepare_avd_root` *(async)*, `finalize_avd_root` *(async)* |

### Payload Dumper

- Lists partitions from payload files (plain `.bin` or OTA `.zip`)
- ZIP extraction streams to `NamedTempFile` — no 4–6 GB RAM spike
- Payload loaded via `Arc<memmap2::Mmap>` — no per-thread heap clone
- Streaming decompression: 256 KiB stack buffer (XZ, BZ2, Zstd, Replace)
- Output files pre-allocated with `set_len`; Zero ops do sparse seeks
- Real-time per-operation `payload:progress` Tauri events from inside threads
- SHA-256 operation checksum verification
- Cleans up cached temp files on demand
- **Remote URL support** (now in default features, no feature flag required):
  - HTTP range requests for efficient partial downloads
  - `HttpPayloadReader` with retry logic (3 retries, exponential backoff)
  - Remote URL panel with connection status display
  - Tabs UI for Local/Remote mode switching
  - **ZIP URL support**: detects `.zip` URLs, parses EOCD/CD to find `payload.bin` offset
  - **Prefetch mode** (`prefetch=true`): download full file, then mmap extract — best for slow/high-latency connections
  - **Direct mode** (`prefetch=false`): fetch manifest + HTTP ranges on-demand — starts extraction immediately
  - **Cancel loading**: ref-based cancellation flag, red "Cancel Loading..." button during partition load
- **UI**: 3-zone layout (file banner + adaptive partition table + sticky action footer)
- **Adaptive columns**: 3-col pre-extraction, 4-col during/after extraction (`[28px_0.8fr_5fr_72px]`)
- **Loading overlay**: centered stage indicator during ZIP extraction / manifest parsing
- **Tooltips**: shadcn `Tooltip` component (not native `title=`) for all icon buttons
- **DropZone**: shared reusable component with native Tauri drag-drop events + position-based hit-testing (`containerRef` + `getBoundingClientRect`)
- **Remote Metadata UI**: collapsible details panel (Framer Motion `AnimatePresence`) in `FileBanner` with 7 sections:
  - OTA Package (from `META-INF/com/android/metadata`): device, Android version, build, fingerprint, OTA type badge, security patch, version, wipe
  - Payload Properties (from `payload_properties.txt`): SHA-256 hashes (copyable), file/metadata sizes
  - HTTP: full URL (copyable), content-type, server, last-modified, ETag
  - ZIP Archive: compression method, payload offset (hex), uncompressed size
  - OTA Manifest: CrAU version, block size, update type, timestamp, partial update
  - Dynamic Groups: group names, sizes, partition lists
  - Extraction: mode (prefetch/direct), output path
- **URL persistence**: `remoteUrl` in Zustand store survives view navigation
- **OPS/OFP support**: OnePlus `.ops` (custom S-box cipher, 3 mbox variants) and Oppo `.ofp` (Qualcomm AES-128-CFB with 7 key sets, MediaTek with mtk_shuffle + 9 key sets)
- **Android sparse image un-sparsing**: 4 chunk types (Raw, Fill, Don't Care, CRC32)
- **Unified dispatch**: `.ops`/`.ofp` files auto-detected by extension and routed to dedicated pipeline—same `PartitionDetail` output as CrAU

### Packaging

- Windows debug MSI and NSIS bundles build successfully
- Platform-specific resource bundling configured
- Native application icons: Windows (`.ico`), macOS (`.icns`), Linux (`.png`) via `pnpm tauri icon`
- ICO: 6 layers (32/16/24/48/64/256px, all 32bpp). `public/logo.png` + `public/favicon.png` synced.
- Mobile icon directories removed (out of scope)

### Tooling & Quality

- React Strict Mode enabled
- TypeScript strict mode enabled
- ESLint 10 flat config active for web app
- Prettier active for web app
- cargo fmt (Rust edition 2024) active
- cargo clippy with `-D warnings` (strict) active
- `pnpm check` runs full verification workflow

## Rust Code Structure

```
src-tauri/src/
├── lib.rs (~95 lines) — thin orchestrator
├── helpers.rs — shared utilities (binary resolution, command execution, device info)
├── commands/
│   ├── mod.rs — re-exports
│   ├── device.rs — get_devices, get_device_info, get_device_mode, get_fastboot_devices
│   ├── adb.rs — wireless ADB, run_adb_host_command, run_shell_command
│   ├── fastboot.rs — flash_partition, reboot, wipe_data, set_active_slot
│   ├── files.rs — list_files, push_file, pull_file, delete_files, rename_file
│   ├── apps.rs — install_package, uninstall_package, sideload_package
│   ├── system.rs — open_folder, save_log, launch_terminal, launch_device_manager
│   ├── payload.rs — payload command wrappers + remote URL commands + OPS dispatch
│   └── marketplace.rs — thin wrappers for search, detail, download, install, trending, versions
├── marketplace/ — modular provider architecture
│   ├── mod.rs — module root, shared reqwest::Client
│   ├── types.rs — MarketplaceApp, MarketplaceAppDetail, VersionInfo DTOs
│   ├── fdroid.rs       # F-Droid search API (search.f-droid.org/api/search_apps) + detail enrichment
│   ├── izzy.rs         # IzzyOnDroid cross-reference (checks F-Droid results against packages API)
│   ├── github.rs       # GitHub Search API (proper URL encoding + PAT + APK filter + trending)
│   └── aptoide.rs — Aptoide ws75 API (TRUSTED-only, OBB/module skip)
└── payload/
    ├── mod.rs — re-exports + chromeos_update_engine protobuf
    ├── parser.rs — CrAU header parsing, protobuf decoding
    ├── extractor.rs — partition extraction with SHA-256 verification
    ├── zip.rs — ZIP payload handling and caching
    ├── http.rs — HTTP range request support (remote_zip feature)
    ├── http_zip.rs — Remote ZIP parsing via HTTP range requests
    ├── remote.rs — Remote payload loading (direct + ZIP URLs, remote_zip feature)
    ├── tests.rs — 13 payload tests (5 local + 8 HTTP ZIP)
    └── ops/ — OPS/OFP firmware format support (9 files)
        ├── mod.rs — shared types, constants, re-exports
        ├── detect.rs — format detection (CrAU, ZIP, 0x7CEF footer, MTK brute-force)
        ├── crypto.rs — OPS S-box cipher + OFP AES-128-CFB + MTK shuffle
        ├── sbox.bin — 2048-byte S-box lookup table
        ├── ops_parser.rs — footer + XML manifest parsing
        ├── ofp_qc.rs — OFP Qualcomm parser
        ├── ofp_mtk.rs — OFP MediaTek parser
        ├── sparse.rs — Android sparse image un-sparsing
        └── extractor.rs — unified extraction + parallel dispatch
```

## Documentation

- `docs/guides/ops-ofp-firmware-extraction.md` — Comprehensive OPS/OFP firmware extraction technical guide (2026-04-03)
- `docs/reports&audits/ui_consistency_audit.md` — Comprehensive UI consistency audit (2026-03-23)
- `docs/reports&audits/payload-dumper-optimization-audit.md` — Payload dumper audit vs reference (2026-04-01)
- `docs/reports&audits/marketplace_architecture_audit.md` — Marketplace architecture audit, research, and improvement strategy (2026-04-05)
- `docs/superpowers/specs/2026-04-05-emulator-manager-design.md` — Emulator Manager feature spec covering scope, UX, backend architecture, root/restore safety, and testing strategy (2026-04-05)
- `docs/superpowers/plans/2026-04-05-emulator-manager.md` — Step-by-step implementation plan for the Emulator Manager backend, frontend, tests, and memory-bank updates (2026-04-05)
- `docs/rust-audit-report.md` — Code quality audit
- `docs/rust-performance-research.md` — Performance optimization research

## Performance Optimizations (Implemented)

- ✅ Sparse zero handling: `Type::Zero` returns empty vec, seeks past region
- ✅ Position tracking: skips redundant seeks
- ✅ Block size from manifest: reads `block_size` field
- ✅ Async Tauri commands: `extract_payload`, `cleanup_payload_cache` on Tokio
- ✅ `install_package`, `uninstall_package`, `sideload_package`: async + `tokio::task::spawn_blocking` (fixes UI freeze)
- ✅ `flash_partition`, `wipe_data`: async + `tokio::task::spawn_blocking` (fixes 1-2 min UI freeze during flashing)
- ✅ Drag-drop position hit-testing: `getBoundingClientRect()` + cursor (x,y) — drop zones only highlight when cursor is physically over them
- ✅ Parallel partition extraction: `std::thread::scope` (4-8x faster)

## Remaining Work

| Priority | Task | Notes |
|----------|------|----|
| Medium | Validate root/restore flows on real emulator | AVD discovery is fixed. Remaining: test prepare/finalize root and restore against a running `Medium_Phone` AVD. |
| Medium | Shift+Click range selection in File Explorer | Phase 2 — needs `lastClickedIndex` tracking |
| Medium | Add tests for bottom panel components | logStore, shellStore, BottomPanel, LogsPanel |
| Medium | Test remote ZIP extraction with real Google factory URLs | Need to verify EOCD/CD parsing works on large ZIPs |
| Medium | Shell command validation UX | Current metacharacter block is strict — consider confirmation dialog approach for power users |
| Low | Virtual list for log entries | react-window for 1000+ entries performance |
| Low | Extend RHF to ViewFlasher | partition/file form (datalist approach works well for now) |
| Low | Adopt EmptyState in remaining views | Dashboard empty device list |
| Low | Run device-backed parity tests | Need real Android devices |

## Risks / Known Issues

- `cargo test` abnormal exit on Windows (pre-existing — Tauri DLL not available in bare `cargo test` process; not a code bug)
- `pnpm tauri build --debug` succeeds when the debug executable is not already running; Windows file locking can still block it if `src-tauri/target/debug/adb-gui-next.exe` is open
- Large frontend bundle chunk warning during build (~274 KB JS)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-04-08 | 0.1.0 | Emulator Manager bug fix: `avd.rs` replaced `emulator -list-avds` with direct `~/.android/avd/*.ini` scanning (`scan_avd_names()`). `sdk.rs` added `resolve_emulator_binary(env)` + `resolve_emulator_binary_from_current_env()` for SDK-aware binary lookup (no PATH required). `runtime.rs` `launch_avd()` uses SDK resolver with fallback, sets working dir to emulator binary parent, adds 1s crash detection. `ViewEmulatorManager.tsx` surfaces `GetAvdRestorePlan` errors to activity log. `resolve_system_image_dir()` normalises Windows backslashes. All gates pass. |
| 2026-04-05 | 0.1.0 | Emulator Manager implemented: added a dedicated Rust `emulator/` domain module, new Tauri emulator commands, typed desktop wrappers, Zustand `emulatorManagerStore`, an Advanced `Emulator Manager` view with roster/header/quick actions/tabs/activity log, and frontend tests. Verified `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm format:check`, and `cargo check` pass. `cargo test` still exits abnormally on Windows (`0xc0000139`, pre-existing) and `pnpm tauri build --debug` was blocked in this session by a locked target executable. |
| 2026-04-05 | 0.1.0 | Emulator Manager planning: created the feature spec and implementation plan for a new Advanced `Emulator Manager` view. Scope is limited to existing official Android Studio AVDs. The planned architecture uses a dedicated Rust `emulator/` domain module, a React hybrid manager layout, safe launch presets, local `.apk`/`.zip` root package import, assisted fake-boot root orchestration, and backup-based restore/unroot. `rootAVD` and `EMU.bat` remain local reference material only, not runtime dependencies. |
| 2026-04-05 | 0.1.0 | Marketplace Architecture Audit: Deep-dive analysis of `GitHub-Store` reference architecture and research into Rust-native marketplace improvements. Proposed a three-stage roadmap: (1) Core Verification Engine with concurrent release-scanning, (2) Intelligence layer with weighted scoring heuristics and auto-pagination, (3) Security layer with Sigstore/Attestation verification. Created `docs/reports/marketplace_architecture_audit.md`. |
| 2026-04-04 | 0.1.0 | Marketplace hardening pass: APK downloads now reject non-HTTP(S) and private/internal targets, GitHub cache keys no longer embed token values, GitHub detail/release flows now fail on non-success HTTP responses, GitHub PAT fallback is session-only, device-flow polling keeps the original client ID, stale debounced searches are cancelled before quick-search/filter/auth reruns, external URL opening is validated, AppCard keyboard activation avoids nested interactive controls, and FilterBar view toggles expose accessible labels/state. Verified `pnpm test`, `pnpm lint`, `pnpm build`, `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`, `cargo fmt --check --manifest-path src-tauri/Cargo.toml`, and `pnpm tauri build --debug` pass. `cargo test` still exits abnormally on Windows (`0xc0000139`, pre-existing). |
| 2026-04-04 | 0.1.0 | Marketplace UX overhaul: new frontend hooks (`useMarketplaceSearch`, `useMarketplaceHome`, `useMarketplaceAuth`), redesigned SearchBar/FilterBar/EmptyState/Settings/AppDetailDialog, Lucide-based provider badges, recent-view persistence, Rust marketplace `auth.rs` + `cache.rs` + `ranking.rs` + `service.rs`, cache-aware search/detail/trending, `marketplace_clear_cache`, GitHub OAuth device-flow start/poll commands, result dedupe + sort support, and session-only GitHub token handling. Verified `pnpm check:fast`, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `cargo check`, and `pnpm tauri build --debug` all pass. `cargo test` still exits abnormally on Windows (`0xc0000139`, pre-existing). |
| 2026-04-04 | 0.1.0 | TypeScript toolchain upgrade: `typescript` 5.9.3 → 6.0.2. Removed deprecated `baseUrl` from `tsconfig.json` and kept `@/*` alias via `paths` only. Verified `pnpm exec tsc --noEmit`, `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass. `cargo test` still exits abnormally on Windows (`0xc0000139`, pre-existing). `pnpm tauri build --debug` currently blocked by a running `adb-gui-next.exe` locking the target binary. |
| 2026-04-04 | 0.1.0 | Marketplace Bug Fixes: 4 critical bugs fixed — F-Droid response key `hits` → `apps`, IzzyOnDroid broken search replaced with cross-reference approach, GitHub query encoding `+` → `%20`, trending query too restrictive. New Settings dialog (`MarketplaceSettings.tsx`) with provider toggles, GitHub PAT input, results-per-provider preference. `github_token` added to `SearchFilters` and passed through all API calls. Debounce 400ms → 600ms, min 2-char query. SearchBar settings icon. All quality gates pass. |
| 2026-04-03 | 0.1.0 | Marketplace V2 "Unified Discovery": Complete overhaul from 3-provider flat list to Design B with 4 providers (F-Droid, IzzyOnDroid, GitHub, Aptoide). New `src-tauri/src/marketplace/` modular provider architecture (6 files). 7 new frontend components (SearchBar, FilterBar, AppCard, AppListItem, MarketplaceEmptyState, ProviderBadge, AttributionFooter). ViewMarketplace and AppDetailDialog rewritten. Zustand store with provider filters, view modes, search history. 2 new commands (marketplace_get_trending, marketplace_list_versions). GitHub-Store model with APK-only filtering. Aptoide TRUSTED-only malware filter. Uptodown removed. 15 pre-existing clippy warnings fixed across OPS/OFP modules. All quality gates (format + lint + build) pass. |
| 2026-04-03 | 0.1.0 | App Marketplace (original): 3-provider search (F-Droid, IzzyOnDroid, GitHub) with concurrent `tokio::join!`, app detail dialog, download + ADB install. 4 new Tauri commands in `commands/marketplace.rs`. Frontend: `ViewMarketplace.tsx`, `AppDetailDialog.tsx`, `marketplaceStore.ts`. Sidebar nav in Main group with Store icon. Dependencies: `urlencoding`, reqwest `json` feature, tokio `macros` feature. |
| 2026-04-03 | 0.1.0 | OPS Decryption Bug Fixes: 3 critical bugs fixed — sbox array size `[u32; 512]` to `[u32; 2048]` with byte-value entries, XML validation on padded buffer, missing `<Image>` element parsing. XML offset corrected to compute from end of file. BOM/NUL/FFFD stripping. 62 partitions verified from OnePlus 8 Pro firmware. |
| 2026-04-03 | 0.1.0 | OPS/OFP Firmware Support: Native decryption + extraction for OnePlus `.ops` (custom S-box cipher, 3 mbox variants), Oppo `.ofp` Qualcomm (AES-128-CFB, 7 key sets), Oppo `.ofp` MediaTek (mtk_shuffle, 9 key sets). Android sparse image un-sparsing. Unified dispatch via file extension. 9 new Rust files in `payload/ops/`. 4 new Cargo deps (`aes`, `cfb-mode`, `md-5`, `quick-xml`). Frontend: file picker + DropZone accept `.ops`/`.ofp`, `OpsMetadata` interface, `GetOpsMetadata()` API, `get_ops_metadata` Tauri command. |
| 2026-04-03 | 0.1.0 | Remote Payload Metadata UI: collapsible details panel in FileBanner with 7 sections (OTA Package, Payload Properties, HTTP, ZIP, OTA Manifest, Dynamic Groups, Extraction). New `read_text_file_from_zip()` for reading `META-INF/com/android/metadata` + `payload_properties.txt` from ZIP. New `get_remote_payload_metadata` Tauri command. `FileBannerDetails.tsx` component with SDK→Android mapping, copyable hashes, OTA type badge. Fire-and-forget metadata fetch after partition load. |
| 2026-04-03 | 0.1.0 | Sticky header root fix: `h-svh overflow-hidden` on MainLayout outer div + `SidebarProvider` `min-h-svh` → `h-full`. Header structurally pinned as `shrink-0` flex sibling above `flex-1 overflow-y-auto` scroll area. No `position: sticky` needed. |
| 2026-04-03 | 0.1.0 | Adaptive hardening: `overflow-x-hidden` on SidebarProvider + Inset, viewport-relative heights in AppManager (`max-h-[30vh]` APK list, `h-[40vh]` virtualizer), `min-w-0 flex-1 + truncate` on ConnectedDevicesCard device info, `min-w-0` on FileSelector. |
| 2026-04-03 | 0.1.0 | App-wide responsive layout: 7 root causes fixed — SidebarContent/Inset overflow axis, `scrollbar-gutter` scoped to `.main-scroll-area`, `--content-min-width` removed, PartitionTable viewport-relative height, PayloadSourceTabs remote `overflow-hidden`, FileBanner URL truncation defense. |
| 2026-04-02 | 0.1.0 | Payload Dumper: CSS Flexbox layout adjustments ensuring responsive truncation for long remote OTA URLs preventing horizontal container overflow |
| 2026-04-01 | 0.1.0 | Full Codebase Review Fixes: Shell metacharacter validation (C-01), ADB/fastboot host command guards (H-01/H-02), SSRF prevention with private IP blocklist (H-03), path canonicalization for open_folder (H-04), TempDir for APKS extraction (M-01), save_log prefix sanitization (M-02), Content-Length validation in HTTP ranges (NEW-07), in-place sort mutation fix (M-04), stable React keys in AppManager (L-02), formatBytes consolidation, 11 unused React imports removed, dead isRefreshingDevices removed, 4 unused _activeView props removed. Added `url` crate dependency. |
| 2026-04-01 | 0.1.0 | Rust Review Fixes: Path validation in `commands/payload.rs`, unreachable fixes in `http.rs`, `impl ToString` param, field docs in `remote.rs`, clippy cast cleanup, `remote_zip` added to default feature in `Cargo.toml`. All feature-gated code now active by default. |
| 2026-04-01 | 0.1.0 | Payload Audit: Fixed temp file leak in `extract_remote_prefetch()`. `PayloadCache::read_payload()` marked `#[allow(dead_code)]`. Audit vs `payload-dumper-rust` reference confirmed full Remote URL, Prefetch, Retry, Parallel extraction implementation. |
| 2026-04-01 | 0.1.0 | Payload Dumper: Remote URL extraction with HTTP range requests. Optional `remote_zip` feature flag. Tabs UI for Local/Remote mode. Connection status display. |
| 2026-03-31 | 0.1.0 | Flasher: Action queue system for bootloop recovery — buttons enabled when file selected, actions queue and auto-execute when device connects. Visual feedback with Clock icon + "Waiting for Device..." text. Clear queue on file clear. |
| 2026-03-29 | 0.1.0 | Utilities View UX Overhaul: `ActionButton` component with 4-state lifecycle (idle, loading, sent, disabled), framer-motion micro-animations, semantic success glows, press scale. Centralized and namespaced `actionId`s for separated ADB/Fastboot rendering. UI grid bugfixes and tooltip cleanups. |
| 2026-03-27 | 0.1.0 | Flasher overhaul: async flash_partition/wipe_data (spawn_blocking), DropArea with position-based hit-testing, partition datalist suggestions, loading mutex, centralized error handling. DropZone.tsx: position-aware hit-testing fix (project-wide). runtime.ts: onHover now passes file paths. |
| 2026-03-27 | 0.1.0 | Bottom panel polish: fixed position, fluid resize (DOM-first/RAF), smart tab toggles, LogsPanel scroll fix. AppManager: shadcn Command search, toolbar swap, destructive button glow, non-blocking install/uninstall/sideload (spawn_blocking). |
| 2026-03-27 | 0.1.0 | Global Device Switcher: header pill + popover, centralized device polling in MainLayout, `selectedSerial` in deviceStore, semantic status colors (7 states), removed ConnectedDevicesCard from Flasher + Utilities |
| 2026-03-26 | 0.1.0 | File Explorer: Create File/Folder (Ctrl+N/Ctrl+Shift+N), Back/Forward history (Alt+←/→), Search/Filter (Ctrl+F), sortable columns, human-readable sizes, symlink targets, Copy Path; infinite render loop fix; empty-dir creation fix |
| 2026-03-26 | 0.1.0 | File Explorer: Import/Export context menu (context-aware push/pull); DRY executePull/executePush helpers |
| 2026-03-26 | 0.1.0 | File Explorer: explicit multi-select mode gate; no single-click selection |
| 2026-03-26 | 0.1.0 | File Explorer: checkbox column hidden until multi-select mode (isMultiSelectMode state); right-click Select menu item |
| 2026-03-26 | 0.1.0 | File Explorer multi-select + inline rename + delete + context menu + keyboard shortcuts; Checkbox + ContextMenu shadcn components |
| 2026-03-26 | 0.1.0 | File Explorer dual-pane: DirectoryTree, editable address bar, tree collapse, localStorage persistence, 5 edge case fixes |
| 2026-03-23 | 0.1.0 | App icon & branding: 3D premium terminal icon, `pnpm tauri icon` cross-platform generation |
| 2026-03-23 | 0.1.0 | UI consistency audit: semantic tokens, icon sizes, Label, aria roles, CheckboxItem, EmptyState, buttonVariants, shrink-0, Separator, sidebar-context.ts |
| 2026-03-23 | 0.1.0 | shadcn Sidebar migration: AppSidebar.tsx, grouped nav, SidebarProvider/SidebarInset, Ctrl+B shortcut |
| 2026-03-23 | 0.1.0 | Comprehensive codebase quality: dead code removal, P0 reactivity fix, shadcn adoption, shared components, semantic token fixes |
| 2026-03-23 | 0.1.0 | App Manager: virtualized list (TanStack Virtual) + user/system package filter |
| 2026-03-23 | 0.1.0 | VS Code-style bottom panel (BottomPanel, LogsPanel, ShellPanel, logStore, shellStore) |
| 2026-03-22 | 0.1.0 | Payload dumper overhaul, dependency integration, debugging infrastructure |
| 2026-03-22 | 0.1.0 | Rust edition 2024, all clippy warnings fixed, dependencies verified |
