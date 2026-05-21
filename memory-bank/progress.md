# Progress

## Overall Status

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.

**Emulator Root Tabbed Setup & Simplified Wizard complete (2026-05-22):** Redesigned the Emulator Root Tab's step-by-step wizard to consolidate the timeline into a streamlined 4-stage pipeline (Preflight, Setup, Patching, Verify). Made preflight scan manual (replacing automated trigger and auto-proceed with explicit clicks and a "Start Preflight Scan" button) and improved the Manual Fallback layout by vertically stacking the "Create fakeboot.img" button beneath the package picker card. Embedded the Autopilot automated flow and FAKEBOOTIMG manual fallback flow to live side-by-side inside horizontal sub-tabs within the unified Setup stage. Integrated manual mode finalization with the store-level wizard results to route to the premium, unified result and verification layout, and implemented a smooth redirection to the Manual tab upon an automated patch failure. Verified and resolved all formatting, Biome checks, and React unit tests (174/174 pass).


**Flasher side-by-side grid, spacing alignment, and drop zone centering complete (2026-05-21):** Migrated the flasher tools into a responsive dual-column grid (`grid-cols-1 lg:grid-cols-2`), converted card content wrappers to vertical flex containers, and added balanced `flex-grow` spacers inside the Recovery Sideload content area to vertically center the drop zone and preserve healthy spacing above the recovery helper text.
**Ultimate Payload Dumper implementation complete (2026-05-10):** All 22 tasks across 7 phases implemented — DOS protection, 4-layer verification, SIMD optimization, delta OTA support, cancellation, per-byte progress, extraction history, partition search, property-based tests, fuzzing, and benchmarks.
**Payload Dumper loaded-state UI polish complete (2026-05-11):** added explicit source-path disclosure under the payload title, moved the partition search field into the table surface, widened the footer action buttons, compacted the extraction status card, and let partition filenames wrap with their `.img` display. Also removed the duplicate sidebar theme toggle and moved Sonner toasts to the top-right.
**File Explorer layout hardening complete (2026-05-14):** the file table now uses one explicit grid column model for header, create, empty, and virtualized rows so name/size/date/time stay aligned. Long filenames and symlink targets wrap inside the name column, and long filenames in delete confirmation dialogs wrap instead of overflowing the modal.
**Frontend feature architecture migration complete (2026-05-14):** frontend code now uses `src/app`, `src/desktop`, `src/shared`, and `src/features/<feature>` boundaries. Legacy `src/components` and `src/lib` folders are removed, raw Tauri invoke calls are confined to `src/desktop/backend.ts`, and the architecture test enforces feature implementation files under 300 lines.
**Dashboard Wireless ADB card collapsible (2026-05-15):** wrapped in shadcn `Collapsible` (Radix), collapsed by default with chevron toggle. Uses existing `src/shared/ui/collapsible.tsx` primitive.
**File Explorer toolbar overlap fix (2026-05-15):** replaced viewport-based `h-[calc(100svh-4rem)]` with flex layout propagation. MainLayout wrapper chain now uses `flex flex-col` + `flex-1 min-h-0` to propagate height from scroll area to views.
**File Explorer scroll containment fix (2026-05-15):** the file list now owns a bounded `min-h-0 overflow-auto` scroll container, TanStack Virtual points directly at that container, the table header stays sticky inside it, and the toolbar action group is horizontally contained for narrow widths.
**File Explorer tree scroll fix (2026-05-15):** expanded directory nodes no longer use a fixed 500px height cap. Large tree folders render fully and the side panel's `ScrollArea` owns vertical overflow, preserving access to lower root entries like `storage` and `root`.
**File Explorer tree resize handle (2026-05-15):** replaced the hard-to-grab one-pixel splitter with a 12px pointer target, retained a one-pixel visual divider, added keyboard arrow resizing, and changed tree width defaults to 280px with 220px/520px bounds.
**react-doctor audit (2026-05-16):** Score 69→81/100. 137 issues fixed across 67+ files. Session interruption caused first-round fixes to be lost; all re-applied. 140 remaining issues are false positives or intentional. Report at `REACT_DOCTOR_AUDIT_REPORT.md`. Summary at `REACT_DOCTOR_FIX_SUMMARY.md`.
**File Explorer root access (2026-05-15):** added remembered manual shield grant with `su -c id -u` verification, path-derived `FileAccessMode` IPC, a stable tree with `sdcard`/`storage`/`root`, root shell mutations, and `/data/local/tmp/adb-gui-next-root-transfer/` staging for protected-path import/export. Enabling the shield does not switch the whole explorer into root mode; normal storage paths remain normal.

**Dashboard Wireless ADB UI persistence (2026-05-16):** collapsible open/closed state, IP address, and port field persist via `useWirelessAdbStore` (Zustand + `persist` middleware). Form defaults read from store; changes sync back via `useWatch` + `useEffect`.

**File Explorer toolbar consolidation (2026-05-16):** standalone New File, New Folder, and Export buttons removed. 3-dot More Actions menu always visible. `FileExplorerImportButton` replaced with `FileExplorerTransferButton` — unified Transfer dropdown with Import File, Import Folder, and Export.

**File Explorer tree panel width persistence (2026-05-16):** `leftWidth` initializes from `localStorage` key `fe.treeWidth` (validated against min/max bounds), defaults to 280px. Width changes persist via `useEffect`.

Marketplace now has Phase 1 architecture refactor complete: singleton HTTP client (connection pooling via `ManagedHttpClient`), APK verification engine (ghost result elimination via JoinSet + Semaphore), heuristic-based ranking (8 weighted signals: topics, language, freshness, installability), bounded cache (capacity limits with eviction), language extraction from GitHub API, F-Droid installable fix, and dynamic trending date. Phase 2 deferred: ETag caching, rate limit tracking, per-provider error reporting.

Emulator Manager is **fully working** on Windows (commit `a52ca2e`). AVD discovery scans `~/.android/avd/*.ini` directly. Root pipeline **fully modernized** 2026-04-16: (1) backend ACL hardened with mandatory TOML permissions and proper capability scoping, (2) `adb_shell_checked()` with `__ADB_GUI_EXIT_STATUS__` marker for diverse shell support, (3) `sanitize_filename()` utility for all user-provided paths, (4) Magisk v25+ binary naming compatibility, (5) 3-phase pipeline overhaul — ramdisk compression detection from magic bytes, stub.xz injection, SHA1 config, auto-shutdown after patching, boot-completion polling, no-snapshot-save cold boot, `EmulatorBootMode` detection and Cold/Normal badge in AvdSwitcher.

**UAD Debloater integration complete (2026-04-18):** `ViewAppManager` redesigned as dual-tab shell (Debloater + Installation). Full Rust backend (`src-tauri/src/debloat/` — 5 files, 8 commands), Zustand `debloatStore`, and 5 new React components. Critical runtime crash (`CommandInput` outside `<Command>` context) diagnosed and fixed.

**shadcn frontend audit implementation complete (2026-04-24):** Applied all findings from `docs/reports/shadcn-frontend-audit-2026-04-24.md` as a shadcn-first cleanup. Added missing primitives, migrated custom form/status/toggle/table/empty/loading patterns, expanded semantic badge variants, improved marketplace cards/list rows, added shared formatters with tests, and preserved backend APIs plus the desktop shell layout. `bun run test`, `bun run build`, `bun run format:check`, `bun run lint`, and isolated-target `bun run tauri build --debug` pass; `bun run check` is blocked only by the known Windows Tauri-linked `cargo test` loader crash.

**frontend audit remediation follow-up complete (2026-04-26):** Closed the remaining frontend consistency and accessibility gaps from the April audit. Added semantic device-status tokens, replaced the last native `title` path/info tooltips with visible supporting text, converted Dashboard and Flasher inputs to shadcn `Field` composition, migrated the BottomPanel log filter to shadcn dropdown-menu radios, normalized the connected-devices empty state with the shared `EmptyState` wrapper, and gave marketplace detail/install actions explicit accessible names. Added focused Vitest coverage for these regressions. Verified `bun run test`, `bun run format:check`, `bun run lint` with `CARGO_TARGET_DIR=src-tauri/target-codex-lint`, and `bun run build`.

**Emulator Root UX Audit complete (2026-04-26):** Root wizard redesigned as a guided 4-step flow (Preflight → Source → Rooting → Done). New `scan_avd_root_readiness` Tauri command performs 10 pre-flight diagnostics. `RootPreflightStep.tsx` renders the checklist with inline fix actions. Smart gate replaces dead-end alert in `EmulatorRootTab`. Boot mode (❄/⚠) and root state (🟢/🟡) badges added to `ViewEmulatorManager` toolbar. Progress labels rewritten; result step extended with 4-step post-root guidance, always-cold-boot reminder, FAKEBOOTIMG explanation, and bootloop safe-mode tip. 40/40 tests pass.

**Emulator Root preflight loop fix (2026-04-26):** Fixed rapid repeated `scan_avd_root_readiness` calls when the automatic preflight scan fails. `RootWizard` now treats auto-scan as one-shot per selected AVD/serial while preflight is open, and manual Rescan remains explicit. Added `RootWizard.test.tsx` regression coverage; frontend test count is now 41/41.

**Emulator Root preflight permission fix (2026-04-26):** Fixed the Scan button error `scan_avd_root_readiness not allowed. Command not found` by adding the registered command to `src-tauri/permissions/autogenerated.toml`. Added `tauriPermissions.test.ts` to prevent future command allowlist drift.

**Emulator Root Magisk CPIO backup fix (2026-04-26):** Fixed `Ramdisk patching failed` at `magiskboot cpio ... 'backup ramdisk.cpio.orig'` by matching the rootAVD stock-ramdisk flow: mask `magiskboot cpio test` with `status & 3`, create `{ROOT_WORKDIR}/ramdisk.cpio.orig` from the raw CPIO for stock ramdisks, verify it exists, then run the patch command. Added `rootAvdPipeline.test.ts` regression coverage.

**Tauri dev OPS crypto import fix (2026-04-26):** Fixed `bun tauri dev` failing after RustCrypto dependency resolution moved to `aes 0.9` / `cfb-mode 0.9` / `cipher 0.5.1`. Removed the stale `aes::cipher::AsyncStreamCipher` import from `payload/ops/crypto.rs`; the current `cfb-mode` decryptor API compiles with `KeyIvInit` only.

**Emulator Root verification fix (2026-04-28):** The automated root flow now reports `patchInstalled` instead of immediate success. A new `verify_avd_root` command verifies post-cold-boot root by checking ADB online state, `sys.boot_completed`, Magisk-family package presence, and `su -c id -u == 0`. The result screen shows "Patch Installed" until verification passes, then "Root Verified". The backend also fails checked shell commands when the exit marker is missing, installs Magisk Manager before shutdown, and logs multi-CPIO ramdisk detection without falsely blocking API 30+ AVDs before `magiskboot` validation. Manual verification template added at `docs/reports/emulator-root-verification-manual-test.md`.

**Emulator Root multi-CPIO + rootAVD-compatible Magisk fix (2026-04-28):** The API 33 Google Play x86_64 AVD root failure was reproduced and resolved against the local rootAVD reference. Automated ramdisk patching now repacks API 30+ multi-CPIO layouts before Magisk patching, and the automatic source uses rootAVD-compatible Magisk v25.2 instead of current latest stable Magisk for the direct ramdisk workflow. Added PowerShell diagnostics/E2E scripts and verified the live `Medium_Phone` emulator reaches `su -c id -u == 0` after stock restore, patch, and cold boot.

**FAKEBOOTIMG manual UI + offline boot polling fix (2026-04-28):** The Root wizard now has a dedicated **Manual Mode (FAKEBOOTIMG)** step wired to the existing `prepare_avd_root` / `finalize_avd_root` IPC commands. Manual mode is accessible before failure from the Source step and from the failure fallback button. It lets users choose a local Magisk `.apk`/`.zip`, create `/sdcard/Download/fakeboot.img`, follow Magisk patch instructions inside the emulator, and finalize the patched ramdisk from the UI. The automated boot wait now checks ADB serial online state before running `getprop sys.boot_completed`, reducing repeated `device offline` log spam during emulator startup.

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
  - Header toolbar is now the only theme-toggle surface; the duplicate sidebar footer toggle was removed
- **Responsive layout (fully hardened across all 7 views)**:
  - No horizontal overflow from any view — `min-w-0` chain intact from root to text nodes
  - Viewport-relative scroll container heights (`max-h-[40vh]`, `h-[40vh]`) replace all fixed px heights
  - `scrollbar-gutter: stable` scoped to `.main-scroll-area` class only (no phantom sidebar gutters)
  - Long device serials, file paths, URLs, package names all truncate correctly
- shadcn/ui components (35+ primitives incl. Alert, Empty, Field, InputGroup, Select, Switch, ToggleGroup, RadioGroup, Slider, Avatar, Popover) with Tailwind CSS v4
- Light/dark/system theme support via next-themes
- Toast notifications via sonner
- Framer Motion view transitions (opacity fade 150ms via AnimatePresence in MainLayout)
- Terminal panel with filter dropdown, search highlighting, auto-scroll toggle, maximize/minimize
- Sonner toasts now mount at top-right globally
- App Manager: virtualized package list (TanStack Virtual), user/system filter, type Badge, shadcn `Command`/`CommandInput`/`CommandEmpty` search (shouldFilter=false), toolbar layout (count left, filter+refresh right), non-blocking install via spawn_blocking, stable React keys for removable APK list
- **UAD Debloater (dual-tab ViewAppManager)**:
  - Tab 1 — Debloater: UAD-backed system package list with TanStack Virtual, 3-way filter (List/Safety/State), search input (`<Input>` + `<Search>` icon — NOT `CommandInput`), expert/disable mode switches, state dot per package, semantic safety tier badge, description panel, Select All / Unselect All, Review button
  - Safety review dialog: shadcn `Table` tier breakdown, affected package list, mandatory backup creation for Unsafe ops, shadcn `Alert` disclaimer
  - Tab 2 — Installation: APK install, sideload, uninstall (extracted from original ViewAppManager)
  - Rust backend: `src-tauri/src/debloat/` (mod, lists, sync, actions, backup) + `commands/debloat.rs` — 8 commands, all `spawn_blocking`
  - 3-tier UAD list strategy: remote GitHub → disk cache → bundled fallback
  - SDK-aware debloat: `pm hide/unhide` (SDK 19-22) vs `pm disable-user --user 0` (SDK ≥23)
  - Timestamped JSON backups + per-device settings persistence
- App Manager installed-app icons:
  - Lazy visible-row icon loading via `GetPackageIcon(packageName)` — package list still appears immediately
  - Fixed icon slot per row — no layout shift in the virtualized list
  - Backend APK icon extraction from installed packages via `pm path` + manifest/resource resolution + same-stem raster fallback for adaptive-icon XML entries
- **File Explorer (full-featured dual-pane, split feature modules)**:
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
  - **Aligned table grid**: header, phantom create row, search-empty row, and virtualized rows share the same grid columns so size/date/time stay aligned
  - **Long-name wrapping**: file names, symlink targets, and delete-dialog filenames break within their containers instead of overflowing
  - **No in-place array mutation** — all sorts use spread copy
  - Feature code lives under `src/features/file-explorer/` with model, hooks, utils, and UI modules; `FileExplorerView.tsx` stays a coordinator.
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
| Apps | `install_package` *(async)*, `uninstall_package` *(async)*, `sideload_package` *(async)*, `get_installed_packages`, `get_package_icon` *(async)* |
| System | `open_folder`, `launch_terminal`, `save_log`, `launch_device_manager` |
| Payload | `extract_payload`, `list_payload_partitions`, `list_payload_partitions_with_details`, `cleanup_payload_cache`, `get_ops_metadata`, `diagnose_payload`, `extract_delta_payload` |
| Payload (remote_zip) | `check_remote_payload` *(async)*, `list_remote_payload_partitions` *(async)*, `get_remote_payload_metadata` *(async)* — now in default features |
| Marketplace | `marketplace_search` *(async)*, `marketplace_get_app_detail` *(async)*, `marketplace_download_apk` *(async)*, `marketplace_install_apk` *(async)*, `marketplace_get_trending` *(async)*, `marketplace_list_versions` *(async)*, `marketplace_clear_cache`, `marketplace_github_device_start` *(async)*, `marketplace_github_device_poll` *(async)* |
| Emulator | `list_avds` *(async)*, `launch_avd` *(async)*, `stop_avd` *(async)*, `get_avd_restore_plan` *(async)*, `restore_avd_backups` *(async)*, `prepare_avd_root` *(async)*, `finalize_avd_root` *(async)*, `scan_avd_root_readiness` *(async)*, `verify_avd_root` *(async)*, `fetch_magisk_stable_release` *(async)*, `root_avd` *(async)* |
| Debloat | `get_debloat_packages` *(async)*, `debloat_packages` *(async)*, `load_debloat_lists` *(async)*, `create_debloat_backup` *(async)*, `list_debloat_backups` *(async)*, `restore_debloat_backup` *(async)*, `get_debloat_device_settings` *(async)*, `save_debloat_device_settings` *(async)* |
| Cancel | `create_cancellation_token`, `cancel_extraction` |

### Payload Dumper (Ultimate Dumper — Complete)

**Phase 1: Foundation — Security Hardening**
- **Manifest Size Cap**: `MAX_MANIFEST_SIZE = 100_000_000` (100MB) in `parser.rs` — prevents DOS from malicious 10GB manifest declarations
- **OPS Hash Verification**: Disk-based SHA-256 verification after flush (not in-memory)
- **Streaming Unsparse**: `unsparse_streaming()` in `sparse.rs` — 256KB buffer, never loads entire 4GB+ sparse file into RAM
- **MTK Overflow Protection**: `checked_mul`/`checked_add` arithmetic in `ofp_mtk.rs` + entry count sanity check (≤500)
- **XML Entity Limit**: `MAX_XML_SIZE = 1MB` enforced in `ops_parser.rs`

**Phase 2: 4-Layer Verification Engine**
- `VerifyMode` struct with `layer3_enabled` (decompressed stream hash) and `layer4_enabled` (output file hash)
- `compute_file_sha256()` in `verify.rs` — 64KB chunked file hashing
- Hash verification wired into extraction loop — conditional on verify mode

**Phase 3: Performance — SIMD & Zero-Copy**
- **AVX-512 Copy Path**: `copy_avx512()` uses `_mm512_loadu_si512` / `_mm512_storeu_si512` with `_mm_sfence()`; falls back to AVX2 for remainder
- **Non-Temporal Stores**: `NonTemporalWriter` in `write.rs` — `memmap2::MmapMut` with `madvise(MADV_SEQUENTIAL)` + `msync(MS_SYNC)` flush
- **Zero-Copy ZIP mmap**: `ZipPayloadMmap` in `zip_mmap.rs` — `Deref<Target=[u8]>` for direct slice access into mmap

**Phase 4: Delta OTA & Full Op Support**
- `Type::Move` — copies data between extents within partition (reads from output file while writing)
- `Type::SourceCopy` — Delta OTA: reads from source partition file, writes to destination extents
- `Type::BrotliBsdiff` — Brotli decompression via `brotli::Decompressor` (behind `brotli` feature)

**Phase 5: Async & Cancellation**
- `CancellationToken` — `Arc<AtomicBool>` with `cancel()` / `is_cancelled()` / `check()` methods
- Global `TOKEN_REGISTRY` with `create_cancellation_token` / `cancel_extraction` Tauri commands
- Cancellation checks at operation boundaries in `extract_partition()`
- Frontend: Cancel button in `ActionFooter.tsx`, `createAndSetCancellationToken` / `cancelExtraction` in store

**Phase 6: Frontend Improvements**
- **Per-Byte Progress**: `emit_progress()` calculates throughput (MB/s) and ETA (seconds) every 250ms; events include `bytesWritten`, `totalBytes`, `throughputMbps`, `etaSeconds`
- **Extraction History**: `ExtractionRecord` interface (id, timestamp, payloadPath, outputDir, partitions, duration, totalBytes, status); persisted to localStorage (last 50 records)
- **Partition Search/Filter**: Search `<Input>` in `PartitionTable.tsx` filters by partition name; shows "X of Y" count when filtered

**Phase 7: Testing & Benchmarking**
- **Property-Based Tests**: `tests/proptest.rs` — 4 proptest cases (extent arithmetic, coalescing, header minimum size, header version) using proptest 1.11 closure-style syntax
- **Fuzzing**: `fuzz/fuzz_targets/parse_header.rs` — libfuzzer target for malformed payload headers
- **Benchmarks**: `benches/copy_benchmark.rs` — Criterion benchmarks for `copy_raw_slice` across 4 sizes (1KB, 64KB, 1MB, 16MB)

**Core Architecture:**
- CrAU parser: `Arc<memmap2::Mmap>` shared across threads — 8-byte pointer, not 4GB copy
- Streaming decompression: 256 KiB stack buffer (XZ/BZ2/Zstd/Brotli/Replace) — never buffers full decompressed block
- Parallel extraction: `rayon::par_iter()` across partitions
- Output pre-allocation: `set_len()` before writing; Zero ops do sparse seeks
- SHA-256 verification: per-operation compressed blob hash (AOSP standard)
- Transaction guard: `TransactionGuard` auto-cleans on failure/panic

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
├── lib.rs (~136 lines) — orchestrator + 71 registered commands
├── helpers.rs — shared utilities (binary resolution, command execution, device info)
├── app_icons.rs — installed APK icon extraction + manifest/resource walk
├── commands/ — 10 focused modules (device, adb, fastboot, files, apps, system, payload, marketplace, emulator, debloat) — 71+ registered commands
│   ├── mod.rs — re-exports
│   ├── device.rs — get_devices, get_device_info, get_device_mode, get_fastboot_devices
│   ├── adb.rs — wireless ADB, run_adb_host_command, run_shell_command
│   ├── fastboot.rs — flash_partition, reboot, wipe_data, set_active_slot
│   ├── files.rs — list_files, push_file, pull_file, delete_files, rename_file
│   ├── apps.rs — install_package, uninstall_package, sideload_package
│   ├── system.rs — open_folder, save_log, launch_terminal, launch_device_manager
│   ├── payload.rs — payload command wrappers + remote URL commands + OPS dispatch + cancel tokens
│   ├── marketplace.rs — thin wrappers for search, detail, download, install, trending, versions
│   └── debloat.rs — 8 thin debloat command wrappers (all spawn_blocking)
├── marketplace/ — modular provider architecture
│   ├── mod.rs — module root, shared reqwest::Client
│   ├── types.rs — MarketplaceApp, MarketplaceAppDetail, VersionInfo DTOs
│   ├── fdroid.rs       # F-Droid search API (search.f-droid.org/api/search_apps) + detail enrichment
│   ├── izzy.rs         # IzzyOnDroid cross-reference (checks F-Droid results against packages API)
│   ├── github.rs       # GitHub Search API (proper URL encoding + PAT + APK filter + trending)
│   ├── aptoide.rs      # Aptoide ws75 API (TRUSTED-only, OBB/module skip)
│   ├── auth.rs         # GitHub OAuth device-flow start/poll helpers
│   ├── cache.rs        # In-memory TTL caches for search/detail/trending
│   ├── ranking.rs      # Result dedupe + sort/relevance rules
│   └── service.rs      # Orchestration layer
├── debloat/ — UAD debloater backend domain
│   ├── mod.rs — core types (DebloatPackage, RemovalTier, PackageState, DebloatPackageRow, DebloatListStatus, DebloatSettings)
│   ├── lists.rs — 3-tier UAD list loading (remote GitHub → disk cache → bundled fallback)
│   ├── sync.rs — device package state detection + SDK-level merge with UAD metadata
│   ├── actions.rs — SDK-aware command builder (pm hide / pm disable-user based on API level)
│   └── backup.rs — timestamped JSON snapshots + per-device settings persistence
├── emulator/ — AVD management domain
│   ├── sdk.rs — ANDROID_SDK_ROOT resolution, emulator binary lookup
│   ├── avd.rs — AVD discovery via ~/.android/avd/*.ini scan, boot mode detection
│   ├── runtime.rs — launch/stop orchestration, arg building, crash detection
│   ├── backup.rs — sidecar backup files, restore plans
│   ├── root.rs — automated ramdisk patching (rootAVD-aligned), scan_avd_root_readiness, verify_avd_root
│   ├── magisk_package.rs — Magisk APK binary extraction with v25+ naming compatibility
│   ├── magisk_download.rs — GitHub releases/latest API fetch
│   └── models.rs — Emulator DTOs (EmulatorBootMode, RootReadinessScan, etc.)
└── payload/
    ├── mod.rs — re-exports + chromeos_update_engine protobuf
    ├── parser.rs — CrAU header parsing, 100MB manifest cap, protobuf decoding
    ├── extractor.rs — Streaming decompression, SHA-256 verification, parallel extraction, per-byte progress, cancellation checks, verify mode
    ├── copy.rs — SIMD copy engine (Scalar/SSE2/AVX2/AVX-512)
    ├── write.rs — NonTemporalWriter with mmap-based non-temporal stores
    ├── zip_mmap.rs — ZipPayloadMmap for zero-copy STORED ZIP entries
    ├── cancel.rs — CancellationToken with AtomicBool
    ├── verify.rs — VerifyMode, compute_file_sha256, plausibility_check
    ├── transaction.rs — TransactionGuard with lock-poison-safe cleanup
    ├── delta.rs — Delta OTA SourceCopy operation support
    ├── zip.rs — ZIP payload handling and caching
    ├── http.rs — HTTP range request support (remote_zip feature)
    ├── http_zip.rs — Remote ZIP parsing via HTTP range requests
    ├── remote.rs — Remote payload loading (direct + ZIP URLs, remote_zip feature)
    ├── tests.rs — 13 payload tests (5 local + 8 HTTP ZIP)
    └── ops/ — OPS/OFP firmware format support (9 files)
        ├── mod.rs, detect.rs, crypto.rs, sbox.bin
        ├── ops_parser.rs, ofp_qc.rs, ofp_mtk.rs
        ├── sparse.rs, extractor.rs
```

## Documentation

- `docs/superpowers/plans/2026-05-10-ultimate-payload-dumper.md` — Ultimate Payload Dumper implementation plan (7 phases, 22 tasks)
- `docs/reports/active/PAYLOAD_RESEARCH_REPORT.md` — Deep-dive analysis of 4 implementations (otaripper, payload-dumper-rust, Go tools, ours)
- `docs/reports/active/ULTIMATE_DUMPER_ROADMAP.md` — Side-by-side feature matrix, architecture blueprint
- `docs/plans/2026-04-18-debloater-integration.md` — Comprehensive UAD Debloater integration plan
- `docs/guides/ops-ofp-firmware-extraction.md` — Comprehensive OPS/OFP firmware extraction technical guide
- `docs/reports&audits/ui_consistency_audit.md` — Comprehensive UI consistency audit
- `docs/reports&audits/payload-dumper-optimization-audit.md` — Payload dumper audit vs reference
- `docs/reports&audits/marketplace_architecture_audit.md` — Marketplace architecture audit
- `docs/superpowers/specs/2026-04-05-emulator-manager-design.md` — Emulator Manager feature spec
- `docs/superpowers/plans/2026-04-05-emulator-manager.md` — Step-by-step implementation plan for Emulator Manager
- `docs/rust-audit-report.md` — Code quality audit
- `docs/rust-performance-research.md` — Performance optimization research

## Performance Optimizations (Implemented)

- ✅ AVX-512 SIMD copy: 64-byte `_mm512` intrinsics for 2.8 GB/s throughput target
- ✅ Non-temporal stores: bypass CPU cache for large sequential writes (>1MB)
- ✅ Zero-copy ZIP mmap: direct slice access for STORED ZIP entries
- ✅ Sparse zero handling: `Type::Zero` returns empty vec, seeks past region
- ✅ Position tracking: skips redundant seeks
- ✅ Block size from manifest: reads `block_size` field
- ✅ Async Tauri commands: `extract_payload`, `cleanup_payload_cache` on Tokio
- ✅ `install_package`, `uninstall_package`, `sideload_package`: async + `tokio::task::spawn_blocking` (fixes UI freeze)
- ✅ `flash_partition`, `wipe_data`: async + `tokio::task::spawn_blocking` (fixes 1-2 min UI freeze during flashing)
- ✅ Drag-drop position hit-testing: `getBoundingClientRect()` + cursor (x,y) — drop zones only highlight when cursor is physically over them
- ✅ Parallel partition extraction: `rayon::par_iter` (4-8x faster)

## Remaining Work

| Priority | Task | Notes |
|----------|------|----|
| High | Bundle `uad_lists.json` in `src-tauri/resources/` | Offline fallback tier for UAD list loader. App works without it (remote fetch first). |
| High | Validate UAD debloat on real device (SDK 23+) | Test `pm disable-user --user 0` vs `pm enable` round-trip |
| Medium | Validate UAD debloat on older device (SDK 19-22) | Test `pm hide/unhide` path |
| Medium | Validate full root/restore flow end-to-end on real physical devices | Pipeline is validated on emulators. Needs testing on physical hardware to confirm broad compatibility. |
| Medium | Shift+Click range selection in File Explorer | Phase 2 — needs `lastClickedIndex` tracking |
| ~~Medium~~ | ~~Add tests for bottom panel components~~ | ✅ Done: logStore.test.ts, shellStore.test.ts, debloatStore.test.ts, deviceStore.test.ts, nicknameStore.test.ts, deviceStatus.test.ts added (162 total tests) |
| Medium | Test remote ZIP extraction with real Google factory URLs | Need to verify EOCD/CD parsing works on large ZIPs |
| Medium | Shell command validation UX | Current metacharacter block is strict — consider confirmation dialog approach for power users |
| ~~High~~ | ~~ESLint Strict Mode Implementation~~ | ✅ Done: Phases 1-3 complete, 0 lint errors, added 6 tsconfig strict flags |
| ~~High~~ | ~~Codebase Audit Accessibility Fixes~~ | ✅ Done: aria-labels, button替换, h1 sr-only, aria-describedby, aria-live |
| ~~High~~ | ~~Codebase Audit UI/UX Fixes~~ | ✅ Done: 50+ icon size-* and 15 gap-* patterns applied |
| ~~High~~ | ~~Codebase Audit Code Quality Fixes~~ | ✅ Done: 54 parameter renames in backend.ts |
| ~~High~~ | ~~Codebase Audit Error Handling Fixes~~ | ✅ Done: console.error → logStore in nicknameStore |
| ~~Medium~~ | ~~Add open folder button to Emulator Restore Tab~~ | ✅ Done: ExternalLink icon with Tooltip, opens parent directory |
| ~~High~~ | ~~Ultimate Payload Dumper~~ | ✅ Done: All 22 tasks across 7 phases implemented |
| Low | Migrate GitHub tokens to secure storage | Use `@tauri-apps/plugin-store` instead of localStorage (TODO added) |
| Low | Virtual list for log entries | react-window for 1000+ entries performance |
| Low | Extend RHF to ViewFlasher | partition/file form (datalist approach works well for now) |
| Low | Adopt EmptyState in remaining views | Dashboard empty device list |
| Low | Run device-backed parity tests | Need real Android devices |

## Risks / Known Issues

- `cargo test` abnormal exit on Windows (pre-existing — Tauri DLL not available in bare `cargo test` process; not a code bug)
- Installed app icons are best-effort: if an APK exposes only unsupported XML/vector/adaptive resources with no same-stem raster fallback, the Applications page keeps the placeholder glyph for that package
- `pnpm tauri build --debug` succeeds when the debug executable is not already running; Windows file locking can still block it if `src-tauri/target/debug/adb-gui-next.exe` is open
- Large frontend bundle chunk warning during build (~274 KB JS)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-22 | 0.2.5 | Release prep for macOS support: bumped package, Tauri, Cargo, and Cargo.lock versions to 0.2.5; added `.github/release-notes/v0.2.5.md`; updated the manual release workflow default to 0.2.5. Verified release version consistency, format, web lint, Rust clippy, frontend tests, build, and Rust test compilation. Local `cargo test` execution still hits the documented Windows Tauri loader crash (`0xc0000139`). |
| 2026-05-22 | 0.2.0 | Emulator Root Tabbed Setup & Simplified Wizard: Reorganized the step-by-step wizard timeline into 4 stages (Preflight, Setup, Patching, Verify). Embedded the automated (Autopilot) and manual fallback (FAKEBOOTIMG) flows side-by-side inside a secondary horizontal tabs layout under the Setup step. Made preflight scan manual (replacing automated trigger and auto-proceed with explicit clicks and start button) and improved the Manual Fallback layout by vertically stacking the "Create fakeboot.img" button beneath the package picker card. Integrated manual mode finalization to map its result to the global wizard result store, routing to the unified success/verification screens. Restructured manual mode component to strip redundant action buttons and back links. Updated all React unit tests and verified all checks. |
| 2026-05-21 | 0.2.0 | Flasher Spacing Layout and Drop Zone Centering: updated both cards to use symmetrical full-height vertical flex layouts, vertically centered the Recovery Sideload drop zone via top and bottom `flex-grow` spacers, and added a protective bottom `min-h-4` gap to prevent squishing with the helper text. |
| 2026-05-15 | 0.2.0 | File Explorer root access + layout hardening: added verified shield-based root grant, path-derived normal/root access mode, root-aware file IPC and staging, stable `sdcard`/`storage`/`root` tree roots, bounded list scrolling, responsive toolbar overflow handling, side-panel tree scrolling, and an accessible wider tree resize handle. Verified frontend and Rust gates. |
| 2026-05-15 | 0.2.0 | File Explorer toolbar overlap fix: replaced viewport-based `h-[calc(100svh-4rem)]` with flex layout propagation through MainLayout wrapper chain (`flex flex-col` + `flex-1 min-h-0`). Dashboard Wireless ADB card made collapsible with shadcn Collapsible (Radix), collapsed by default with chevron toggle. |
| 2026-05-14 | 0.2.0 | Frontend feature architecture migration: moved the app shell to `src/app`, Tauri IPC to `src/desktop`, shared primitives/components/stores/utils to `src/shared`, and product code to `src/features/<feature>`. Removed legacy `src/components` and `src/lib`, split oversized feature files, and added strict frontend architecture tests. |
| 2026-05-14 | 0.2.0 | File Explorer layout hardening: fixed table row/header drift with a shared explicit grid column model, preserved fixed size/date/time alignment, wrapped long names and symlink targets in the name column, and fixed delete confirmation overflow for long filenames. Added `ViewFileExplorer.test.tsx` regression coverage. |
| 2026-05-11 | 0.1.0 | Payload Dumper UI polish + app-shell cleanup: added wrapped source-path disclosure under the payload title, moved the partition search field into the table surface, widened the bottom action buttons, compacted the extraction status card, wrapped partition names with `.img` display, removed the duplicate sidebar theme toggle, and moved Sonner toasts to top-right. Verified `bun run lint:web` and `bun run build`. |
| 2026-05-10 | 0.1.0 | **Ultimate Payload Dumper — Complete**: All 22 tasks across 7 phases implemented. Phase 1: 100MB manifest size cap, OPS disk hash verify, streaming unsparse, MTK overflow checks, XML entity limits. Phase 2: 4-layer verification engine (VerifyMode with layer3/layer4). Phase 3: AVX-512 SIMD copy path, non-temporal stores, zero-copy ZIP mmap. Phase 4: Move operation, Delta OTA SourceCopy, Brotli decompression. Phase 5: CancellationToken with global registry, frontend cancel button. Phase 6: Per-byte progress with throughput/ETA, extraction history (localStorage), partition search/filter UI. Phase 7: Property-based tests (proptest), cargo-fuzz target, Criterion benchmarks. Also: lock poisoning fixes, Cargo.toml feature syntax fix, Tauri permission allowlist updates for new commands. All gates pass: `bun run lint`, `bun run format:check`, `bun run build`, `cargo clippy -D warnings`. |
| 2026-05-08 | 0.1.0 | UI/UX Polish + Toggle Control Standardization + Sidebar Rename: (1) Emulator status chips — replaced emojis (🟢/🟡) with accessible Lucide icons (ShieldCheck/PenTool) and improved contrast using bg-success-light/text-success pattern; (2) Green color consolidation — fixed recovery device status to use success token instead of chart-2, added CSS opacity scale (--success-muted/--success-light/--success-subtle) for consistent backgrounds; (3) DeviceSwitcher ADB badge — unified green pattern to match Emulator Manager (bg-success-light text-success border-success/35); (4) Toggle control audit — changed EmulatorLaunchTab launch option Checkboxes to Switch (binary settings), changed MarketplaceSettings provider Checkbox to Switch (binary on/off), kept Checkbox for confirmation acknowledgments (correct pattern), kept ToggleGroup for mutually exclusive options; (5) Sidebar rename — "Emulator Manager" → "Emulator", "Payload Dumper" → "Dumper", updated toast messages to match; (6) Debloater select toggle — consolidated Select All / Unselect All buttons into single toggle button showing current action; (7) Tests — added deviceStore.test.ts, nicknameStore.test.ts, total now 162 passing tests. All gates pass: `bun run lint:web`, `bun run test` (162), `bun run build`. |
| 2026-05-08 | 0.1.0 | ESLint Strict Mode + Codebase Audit fixes: (1) ESLint Phase 1 — upgraded warn→error rules, enabled noUnusedLocals/noUnusedParameters in tsconfig; (2) ESLint Phase 2 — added strictTypeChecked + stylisticTypeChecked configs, 6 new tsconfig strict flags (noUncheckedIndexedAccess, noImplicitReturns, noImplicitOverride, exactOptionalPropertyTypes, verbatimModuleSyntax, isolatedModules); (3) ESLint Phase 3 — added type-aware rules (no-floating-promises, no-unsafe-*, prefer-nullish-coalescing, etc.) + React strict rules + import order, fixed 527 lint errors to 0; (4) Accessibility Critical (9 files) — aria-labels, div[role="button"]→button替换, h1→h1.sr-only; (5) Accessibility High (3 files) — aria-describedby for form inputs, aria-live for log panel, TODO for secure storage migration; (6) UI/UX — replaced 50+ icon h-*w-*→size-*, 15 space-y-*→gap-*; (7) Code Quality — renamed 54 arg1/arg2/arg3 to semantic names in backend.ts; (8) Testing — created 3 new test files (debloatStore.test.ts, shellStore.test.ts, logStore.test.ts) with 57 tests, total now 119; (9) Error Handling — replaced console.error with logStore in nicknameStore; (10) Emulator Restore Tab — added open folder icon button (ExternalLink) with Tooltip, opens parent directory of backupPath, consistent with payload dumper pattern. All gates pass: `bun run format:check`, `bun run lint:web` (0 errors), `bun run test` (119 tests), `bun run build`. |
| 2026-04-30 | 0.1.0 | Device switcher and multi-device routing fix: header device popover now aligns from the trigger start with collision padding to avoid overlapping the collapsed sidebar. Device-scoped ADB/fastboot wrappers and Rust commands now accept/pass `serial` for device info, shell, app install/uninstall/list/sideload, file explorer operations, flasher actions, utilities reboot/slot/wipe, and fastboot host commands. Views now derive behavior from `selectedSerial` instead of the first connected device, clear stale device info/selections on device switch, and disable install/uninstall actions when no selected device exists. Added `deviceSelectionRouting.test.ts` and updated AppManager test setup for selected-device state. Verified `bun run format:check`, `bun run lint`, `bun run test`, `bun run build`, `cargo check --no-default-features --features local_zip,remote_zip`, and `bun run tauri build --debug` with isolated `CARGO_TARGET_DIR`. `cargo test` still hits the known Windows Tauri-linked startup crash (`0xc0000139`). |
| 2026-04-26 | 0.1.0 | Emulator Root UX Audit: redesigned the root wizard as a guided 4-step flow (Preflight → Source → Rooting → Done). New `scan_avd_root_readiness` Rust command with 10 pre-flight checks (running state, boot completion, boot mode snapshot detection, ABI, API level, ramdisk existence + writability, shared-ramdisk advisory, root state, safe mode). New `RootPreflightStep.tsx` checklist UI with status icons, inline fix actions, summary bar, and Continue gate. `EmulatorRootTab` rewritten with smart Launch/Cold Boot gate (replaces dead-end alert). Boot mode (❄ Cold Boot / ⚠ Normal Boot) and root state (🟢 Rooted / 🟡 Modified) badges added to `ViewEmulatorManager` toolbar. Progress labels rewritten as beginner-friendly; result step adds 4-step post-root guide, always-cold-boot reminder, FAKEBOOTIMG explanation, bootloop safe-mode tip. Source step adds Magisk "why" introduction. `emulatorManagerStore.test.ts` updated for new initial step `'preflight'`. Verified `bun vitest run` ✅ (40/40) · `bun tsc --noEmit` ✅ · `bun run format:check` ✅ · `cargo check` ✅ · `cargo fmt --check` ✅. |
| 2026-04-26 | 0.1.0 | Frontend audit remediation follow-up: added semantic device-status CSS tokens, removed remaining native `title` tooltips from shared path/info surfaces, normalized Dashboard wireless ADB and Flasher partition forms to shadcn `Field` composition, migrated the BottomPanel log filter to shadcn `DropdownMenuRadioGroup`, converted connected-devices empty state to the shared `EmptyState` presentation, and clarified marketplace detail/install accessible names. Added focused Vitest coverage for device-status, FileSelector, Dashboard, Flasher, BottomPanel, Marketplace, and connected-devices regressions. Verified `bun run test`, `bun run format:check`, `bun run lint` with `CARGO_TARGET_DIR=src-tauri/target-codex-lint`, and `bun run build`. |
| 2026-04-24 | 0.1.0 | shadcn frontend audit implementation: added official primitives (`Alert`, `Empty`, `Field`, `InputGroup`, `Select`, `Switch`, `ToggleGroup`, `Textarea`, `RadioGroup`, `Slider`, `Avatar`), migrated custom forms/status panels/mode controls/tables/loading placeholders to shadcn patterns, expanded semantic badge variants, replaced actionable native `title` tooltips with `Tooltip`, improved marketplace card/list semantics and image sizing, added shared formatting helpers with Vitest coverage, and preserved frontend-only scope. Verified `bun run test`, `bun run build`, `bun run format:check`, `bun run lint` with `CARGO_TARGET_DIR=src-tauri/target-codex-lint`, and `bun run tauri build --debug` with `CARGO_TARGET_DIR=src-tauri/target-codex-tauri`. `bun run check` still fails only at the known Windows Tauri-linked `cargo test` loader crash (`0xc0000139` / `STATUS_ENTRYPOINT_NOT_FOUND`). |
| 2026-04-24 | 0.1.0 | Frontend audit cleanup: improved app shell accessibility and consistency with skip link/main landmark, reduced-motion handling, error boundaries, semantic tab/log regions, accessible icon buttons, stable viewport sizing for BottomPanel, focused Zustand selectors, safer Tauri invoke typing, semantic CSS tokens, heading hierarchy fixes, lazy marketplace imagery, React Hook Form `useWatch` usage, and lint-compatible TanStack Virtual annotations. Added polymorphic `CardTitle` plus tests and updated stale AppManager/EmulatorManager tests. Fixed Rust clippy findings in debloat backend. User requested lint-only verification: `bun run lint` passes with `CARGO_TARGET_DIR=src-tauri/target-codex-lint`; ESLint now ignores `src-tauri/target-*/**` generated Cargo directories. |
| 2026-04-18 | 0.1.0 | UAD Debloater integration: `ViewAppManager` rewritten as dual-tab shell (Debloater + Installation). New Rust `src-tauri/src/debloat/` domain module (5 files: mod, lists, sync, actions, backup) + `commands/debloat.rs` (8 commands, all `spawn_blocking`). New Zustand `debloatStore`. New frontend components: `DebloaterTab`, `InstallationTab`, `ReviewSelectionDialog`, `DescriptionPanel`, `debloaterUtils`. Critical crash fixed: `CommandInput` outside `<Command>` context throws `Cannot read properties of undefined (reading 'subscribe')` — replaced with plain `<Input>` + `<Search>` icon. Verified `bun run build` ✅ · `bun run format:web` ✅ · `cargo check` ✅. |
| 2026-04-16 | 0.1.0 | Security hardening & ACL migration: resolved Tauri v2 ACL discovery failures by migrating application permissions to the mandatory TOML format (`autogenerated.toml`) and properly scoping them in `capabilities/default.json` (no prefix lookup). Hardened the rooting pipeline with a robust `__ADB_GUI_EXIT_STATUS__` shell marker in `adb_shell_checked()` and integrated a centralized `sanitize_filename` utility in `helpers.rs` to prevent path traversal and resolve `unused` compiler warnings. Verified clean compilation with `cargo build`. |
| 2026-04-14 | 0.1.0 | Applications page installed-app icons: added lazy visible-row icon loading with fixed icon slots in the virtualized App Manager list, a new backend `get_package_icon` command, APK manifest/resource parsing in `app_icons.rs`, same-stem raster fallback for adaptive/XML icon resources, and a focused `ViewAppManager.test.tsx`. Verified `pnpm build`, `pnpm lint:web`, `cargo check`, `cargo clippy --all-targets -- -D warnings`, `pnpm format:check`, and `pnpm test -- ViewAppManager.test.tsx` pass. |
| 2026-04-09 | 0.1.0 | Root pipeline modernization (3-phase, 12 bug fixes): Phase 1 — `adb_shell_checked()` strict error checking, `detect_compression_method()` from magic bytes (removes hardcoded lz4_legacy), SHA1 config, `stub.xz` injection, `wait_for_boot_completed()`, auto-shutdown after patching. Phase 2 — `noSnapshotSave: true`, auto-stopped emulator handling, updated success messaging. Phase 3 — `EmulatorBootMode` enum (`Cold`/`Normal`/`Unknown`), `detect_boot_mode()` via `ro.kernel.androidboot.snapshot_loaded`, Cold/Normal badge in AvdSwitcher. All gates pass: `pnpm build` ✅ · `pnpm lint` ✅ · `pnpm format` ✅ |
| 2026-04-09 | 0.1.0 | Root pipeline bug fixes: (1) Serde camelCase discriminator mismatch fixed — `RootSource` tag values must be camelCase (`latestStable`/`localFile`) to match `rename_all = "camelCase"`. Fixed in `models.ts` and `RootWizard.tsx`. (2) Magisk v25+ binary naming — `libmagisk64.so` → `libmagisk.so` rename in v25+. Added `extract_lib_binary_as()` helper and cascading fallback in `magisk_package.rs`. (3) Detailed `[root]` step logging added to `root_avd_automated()` — ABI detection, each binary push, patch sequence, pull sizes, APK install result. (4) React Compiler `useCallback` fix in `RootSourceStep.tsx` — removed manual memoization per React Compiler guidance; mount-only `useEffect` with justified `eslint-disable-next-line`. All gates pass: `pnpm build` ✅ · `pnpm lint:web` ✅ · `cargo check` ✅ · `cargo clippy -D warnings` ✅ |
| 2026-04-08 | 0.1.0 | Emulator Manager bug fix: `avd.rs` replaced `emulator -list-avds` with direct `~/.android/avd/*.ini` scanning (`scan_avd_names()`). `sdk.rs` added `resolve_emulator_binary(env)` + `resolve_emulator_binary_from_current_env()` for SDK-aware binary lookup (no PATH required). `runtime.rs` `launch_avd()` uses SDK resolver with fallback, sets working dir to emulator binary parent, adds 1s crash detection. `ViewEmulatorManager.tsx` surfaces `GetAvdRestorePlan` errors to activity log. `resolve_system_image_dir()` normalises Windows backslashes. All gates pass. |
| 2026-04-05 | 0.1.0 | Emulator Manager implemented: added a dedicated Rust `emulator/` domain module, new Tauri emulator commands, typed desktop wrappers, Zustand `emulatorManagerStore`, an Advanced `Emulator Manager` view with roster/header/quick actions/tabs/activity log, and frontend tests. Verified `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm format:check`, and `cargo check` pass. `cargo test` still exits abnormally on Windows (`0xc0000139`, pre-existing) and `pnpm tauri build --debug` was blocked in this session by a locked target executable. |
| 2026-04-05 | 0.1.0 | Emulator Manager planning: created the feature spec and implementation plan for a new Advanced `Emulator Manager` view. Scope is limited to existing official Android Studio AVDs. The planned architecture uses a dedicated Rust `emulator/` domain module, a React hybrid manager layout, safe launch presets, local `.apk`/`.zip` root package import, assisted fake-boot root orchestration, and backup-based restore/unroot. `rootAVD` and `EMU.bat` remain local reference material only, not runtime dependencies. |
| 2026-04-05 | 0.1.0 | Marketplace Architecture Phase 1 (High-Performance Refactor): implemented all critical and medium findings from the architecture audit across 10 files (7 Rust, 3 TypeScript). 11 new unit tests added. |
| 2026-04-05 | 0.1.0 | Marketplace Architecture Audit Revision 2 (Deep Analysis): exhaustive code-level analysis of all 9 marketplace Rust modules (1,418 lines) + command layer. Benchmarked against GitHub-Store (10.5k★ KMP app) and GitHub API best practices. Full report rewritten from 103 lines → 508 lines. |
| 2026-04-04 | 0.1.0 | Marketplace UX Overhaul + GitHub Device Flow: major Marketplace execution pass focused on professional UX, search/filter quality, zero-query discovery, Rust architecture, and optional GitHub OAuth device-flow sign-in. |
| 2026-04-04 | 0.1.0 | TypeScript 6 Upgrade + `baseUrl` Deprecation Migration: upgraded frontend toolchain from TypeScript 5.9.3 to **6.0.2** and removed deprecated `compilerOptions.baseUrl` from `tsconfig.json`. |
| 2026-04-04 | 0.1.0 | Marketplace Bug Fixes: All 4 Providers Working + Settings Dialog. 4 critical bugs fixed (F-Droid `hits`→`apps`, IzzyOnDroid no search API, GitHub `+` double-encoding, GitHub trending too restrictive). |
| 2026-04-03 | 0.1.0 | Marketplace V2: "Unified Discovery" (4-Provider Modular Architecture). Complete overhaul from 3-provider flat list to Design B with 4 providers, modular Rust backend, and rich frontend components. |
| 2026-04-03 | 0.1.0 | OPS Decryption Bug Fixes (3 Critical Bugs): sbox array size, XML validation, missing `<Image>` element. |
| 2026-04-03 | 0.1.0 | OPS/OFP Firmware Support: Native decryption + extraction for OnePlus `.ops` and Oppo `.ofp` firmware. |
| 2026-04-03 | 0.1.0 | Remote Payload Metadata UI: collapsible details panel in FileBanner with 7 sections. |
| 2026-04-03 | 0.1.0 | Sticky header root fix: `h-svh overflow-hidden` on MainLayout outer div. |
| 2026-04-03 | 0.1.0 | Adaptive hardening: `overflow-x-hidden` on SidebarProvider + Inset. |
| 2026-04-03 | 0.1.0 | App-wide responsive layout: 7 root causes fixed. |
| 2026-04-02 | 0.1.0 | Payload Dumper: CSS Flexbox layout adjustments. |
| 2026-04-01 | 0.1.0 | Full Codebase Review Fixes: Shell metacharacter validation, ADB/fastboot host command guards, SSRF prevention, path canonicalization, TempDir for APKS extraction, save_log prefix sanitization, Content-Length validation, in-place sort mutation fix, stable React keys, formatBytes consolidation, 11 unused React imports removed, dead isRefreshingDevices removed, 4 unused _activeView props removed. |
| 2026-04-01 | 0.1.0 | Rust Review Fixes: Path validation, unreachable fixes, `impl ToString` param, field docs, clippy cast cleanup, `remote_zip` added to default feature. |
| 2026-04-01 | 0.1.0 | Payload Audit: Fixed temp file leak in `extract_remote_prefetch()`. `PayloadCache::read_payload()` marked `#[allow(dead_code)]`. Audit vs `payload-dumper-rust` reference confirmed full Remote URL, Prefetch, Retry, Parallel extraction implementation. |
| 2026-04-01 | 0.1.0 | Payload Dumper: Remote URL extraction with HTTP range requests. Optional `remote_zip` feature flag. Tabs UI for Local/Remote mode. Connection status display. |
| 2026-03-31 | 0.1.0 | Flasher: Action queue system for bootloop recovery. |
| 2026-03-29 | 0.1.0 | Utilities View UX Overhaul: `ActionButton` component with 4-state lifecycle. |
| 2026-03-27 | 0.1.0 | Flasher overhaul: async flash_partition/wipe_data, DropArea, partition datalist. |
| 2026-03-27 | 0.1.0 | Bottom panel polish + AppManager improvements. |
| 2026-03-27 | 0.1.0 | Global Device Switcher: header pill + popover, centralized device polling. |
| 2026-03-26 | 0.1.0 | File Explorer: Create File/Folder, Back/Forward history, Search/Filter, sortable columns. |
| 2026-03-26 | 0.1.0 | File Explorer: Import/Export context menu. |
| 2026-03-26 | 0.1.0 | File Explorer: explicit multi-select mode gate. |

(End of file - total 360 lines)
