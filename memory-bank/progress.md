# Progress

## Overall Status

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.

## What Works

### Frontend

- App shell loads under Vite/React with Strict Mode enabled
- shadcn Sidebar (`collapsible="icon"` mode) with grouped navigation (Main/Advanced)
- `AppSidebar.tsx` extracted component with SidebarHeader, SidebarFooter, SidebarRail
- `sidebar-context.ts` holds non-component exports (constants, context, hook) — Fast Refresh clean
- `Ctrl+B` keyboard shortcut for sidebar toggle
- 7 sidebar views compile and build successfully
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

### Backend (30 Tauri Commands)

| Category | Commands |
|----------|----------|
| Device | `get_devices`, `get_device_info`, `get_device_mode`, `get_fastboot_devices` |
| ADB | `run_adb_host_command`, `run_shell_command`, `connect_wireless_adb`, `disconnect_wireless_adb`, `enable_wireless_adb` |
| Fastboot | `flash_partition` *(async)*, `reboot`, `wipe_data` *(async)*, `set_active_slot`, `get_bootloader_variables`, `run_fastboot_host_command` |
| Files | `list_files`, `push_file`, `pull_file`, `delete_files`, `rename_file`, `create_file`, `create_directory` |
| Apps | `install_package` *(async)*, `uninstall_package` *(async)*, `sideload_package` *(async)*, `get_installed_packages` |
| System | `open_folder`, `launch_terminal`, `save_log`, `launch_device_manager` |
| Payload | `extract_payload`, `list_payload_partitions`, `list_payload_partitions_with_details`, `cleanup_payload_cache` |
| Payload (remote_zip) | `check_remote_payload` *(async)*, `list_remote_payload_partitions` *(async)*, `get_remote_payload_metadata` *(async)* — now in default features |

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
├── lib.rs (~60 lines) — thin orchestrator
├── helpers.rs — shared utilities (binary resolution, command execution, device info)
├── commands/
│   ├── mod.rs — re-exports
│   ├── device.rs — get_devices, get_device_info, get_device_mode, get_fastboot_devices
│   ├── adb.rs — wireless ADB, run_adb_host_command, run_shell_command
│   ├── fastboot.rs — flash_partition, reboot, wipe_data, set_active_slot
│   ├── files.rs — list_files, push_file, pull_file, delete_files, rename_file
│   ├── apps.rs — install_package, uninstall_package, sideload_package
│   ├── system.rs — open_folder, save_log, launch_terminal, launch_device_manager
│   └── payload.rs — payload command wrappers + remote URL commands
└── payload/
    ├── mod.rs — re-exports + chromeos_update_engine protobuf
    ├── parser.rs — CrAU header parsing, protobuf decoding
    ├── extractor.rs — partition extraction with SHA-256 verification
    ├── zip.rs — ZIP payload handling and caching
    ├── http.rs — HTTP range request support (remote_zip feature)
    ├── http_zip.rs — Remote ZIP parsing via HTTP range requests (EOCD/CD parsing, text file reading)
    ├── remote.rs — Remote payload loading (direct + ZIP URLs, remote_zip feature)
    └── tests.rs — 13 payload tests (5 local + 8 HTTP ZIP)
```

## Documentation

- `docs/reports&audits/ui_consistency_audit.md` — Comprehensive UI consistency audit (2026-03-23)
- `docs/reports&audits/payload-dumper-optimization-audit.md` — Payload dumper audit vs reference (2026-04-01)
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
|----------|------|-------|
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
- `cargo clippy` blocked on Windows when `AdbWinApi.dll` is locked by another process (pre-existing)
- Large frontend bundle chunk warning during build (~274 KB JS)

## Version History

| Date | Version | Changes |
|------|---------|---------|
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
