# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch. All codebase review findings have been addressed and committed.

## Recently Completed

### 2026-04-01 — Full Codebase Review: Security Hardening + Code Quality Cleanup

**Problem:** Comprehensive codebase review identified 13 security issues (1 CRITICAL, 4 HIGH, 4 MEDIUM, 2 LOW) and 15+ code quality issues across both Rust backend and TypeScript frontend.

**Security fixes applied (Rust backend):**

1. **C-01: Shell command injection prevention** — Added `validate_shell_command()` in `commands/adb.rs` that blocks shell metacharacters (`;`, `|`, `&`, `$`, backticks, parentheses, braces, angle brackets, newlines) from `run_shell_command`. Prevents arbitrary command execution on connected Android devices.

2. **H-01/H-02: ADB/Fastboot host command guards** — Added empty-string validation for `run_adb_host_command` and `run_fastboot_host_command`.

3. **H-03: SSRF prevention** — Added `is_private_url()` in `payload/http.rs` that blocks loopback (127.0.0.0/8, ::1), private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local (169.254.0.0/16, fe80::/10), CGNAT (100.64.0.0/10), and unspecified (0.0.0.0, ::) IP ranges. Only HTTP/HTTPS URLs allowed. Localhost domain names also blocked.

4. **H-04: Path canonicalization** — `open_folder` in `commands/system.rs` now verifies path exists, is a directory, and canonicalizes before opening to prevent path traversal.

5. **M-01: TempDir for APKS extraction** — Replaced manual temp directory with `tempfile::TempDir` in `commands/apps.rs` for crash-safe auto-cleanup on any exit path.

6. **M-02: Prefix sanitization** — `save_log` in `commands/system.rs` now filters prefix to alphanumeric + `-`/`_` only, max 50 chars, preventing path traversal via crafted filenames.

7. **NEW-07: Content-Length validation** — Both `read_range` and `read_range_sync` in `payload/http.rs` now verify returned byte count matches requested range length, preventing silent data corruption from malicious servers.

**Code quality fixes (Frontend):**

8. **M-04: In-place sort mutation** — `files.sort()` → `[...files].sort()` in `ViewFileExplorer.tsx` — no longer mutates backend response array.

9. **L-02: Stable React keys** — `key={idx}` → `key={path}` in `ViewAppManager.tsx` — uses file path as stable unique key for dynamically removable list items.

10. **Duplicate `formatBytes` consolidation** — Moved both implementations (string-input and number-input) into `lib/utils.ts` as `formatBytes()` and `formatBytesNum()`. Removed local copies from `ViewFileExplorer.tsx` and `ViewPayloadDumper.tsx`.

11. **11 unused React imports removed** — Cleaned up `import React from 'react'` from 11 component files (kept `main.tsx` for StrictMode).

12. **Dead code removal** — Removed `isRefreshingDevices` (always-false variable) from `ViewDashboard.tsx`. Removed unused `_activeView` props from 4 views (About, Flasher, PayloadDumper, Utilities) and updated `MainLayout.tsx` to not pass them.

**Dependency changes:**
- Added `url` crate to `Cargo.toml` for URL parsing and SSRF prevention.

**Verification:**
- `pnpm format:check` — ✅ Clean
- `pnpm lint:web` — ✅ 0 errors, 0 warnings
- `cargo check` — ✅ Clean
- `pnpm build` — ✅ Clean
- `cargo clippy` — ⚠️ Blocked by pre-existing Windows DLL lock (`AdbWinApi.dll` in use)

**Commit:** `3618a30` — `fix: address codebase review findings — security hardening + code quality cleanup`

**Files changed:** 32 files (6 Rust, 14 TypeScript, 12 deleted agent files, 1 new report)

---

### 2026-04-01 — Rust Code Review: MEDIUM Fixes + `remote_zip` Default Feature

**Problem:** Rust review identified 3 MEDIUM issues in the remote payload extraction code, and the `remote_zip` feature was not enabled by default — leaving all remote extraction code inactive in normal builds.

**Fixes applied:**

1. **`http.rs` (M-3):** Replaced `Err(anyhow!("Unreachable"))` with `unreachable!("retry loop should have returned by now")` in both `read_range_sync` and `read_range` retry loops. Communicates intent clearly instead of hiding dead code behind a misleading error.

2. **`http.rs` (M-4):** Changed `new(url: String)` → `new(url: impl ToString)` — more ergonomic API without breaking callers.

3. **`remote.rs` (M-5):** Added `///` doc comments to all public fields of `RemotePayload` (`manifest`, `http`, `data_offset`).

4. **`remote.rs` (clippy):** Removed redundant `as u64` casts in `extract_partition_from_remote` — values were already `u64`.

5. **`commands/payload.rs` (M-1/M-2):** Added path validation:
   - `output_dir` — `create_dir_all()` + `canonicalize()` to prevent path traversal
   - `payload_path` — existence check before passing to extractor

6. **`Cargo.toml`:** Added `remote_zip` to default features → `[\"local_zip\", \"remote_zip\"]`. All HTTP range request and remote extraction code is now active in normal builds (no `--features remote_zip` needed).

**Verification:**
- `cargo check` — OK
- `cargo clippy -D warnings` — OK
- `cargo fmt` — OK (auto-formatted `commands/payload.rs`)

**Files changed:**
- `src-tauri/src/payload/http.rs` — unreachable fix, generic URL param
- `src-tauri/src/payload/remote.rs` — field docs, unnecessary casts removed
- `src-tauri/src/commands/payload.rs` — path validation + canonicalization
- `src-tauri/Cargo.toml` — `remote_zip` added to default features

**All `#[cfg]` directives reviewed:** Only feature-gate in the project is `#[cfg(feature = "remote_zip")]` — now active by default. `local_zip` has no `#[cfg]` usage (always active).

---

### 2026-04-01 — Payload Dumper Audit: Temp File Leak Fix in Prefetch Mode

**Problem:** `extract_remote_prefetch()` had a confused ownership pattern:
1. `drop(temp)` — `NamedTempFile::drop()` deleted the underlying file from disk
2. `File::open(&temp_path)` — opened a file that was already deleted
3. `std::mem::forget(temp_path)` — only leaked the path string buffer

Worked by accident on Unix (open file handle survives deletion), but wasted disk space and leaked the mmap cache file descriptor.

**Fix:**
- `NamedTempFile::keep()` — properly persists the temp file on disk, returns `(File, PathBuf)` tuple
- `TempGuard` RAII struct — cleans up temp file on any early error during processing
`PayloadCache::read_payload()` — dead code (reads entire file into RAM, contradicts mmap design). `#[allow(dead_code)]` added.

**Files changed:**
- `src-tauri/src/payload/remote.rs` — `extract_remote_prefetch()`, `temp_path` via `keep()`, `TempGuard` cleanup
- `src-tauri/src/payload/zip.rs` — `read_payload()` marked `#[allow(dead_code)]`

**Verification:** `pnpm check` clean (format + lint + build). Tests crash on Windows due to pre-existing Tauri DLL issue.

---

### 2026-04-01 — Payload Dumper: Fix Prefetch Mode (Remote URL)

**Problem:** The `prefetch` checkbox in `RemoteUrlPanel` existed in the UI but was not wired to the backend — extraction always behaved the same regardless of the checkbox state.

**Fix:**
- Added `extract_remote_prefetch()` — downloads entire payload to temp file, then extracts via mmap (best for slow/high-latency connections)
- Added `extract_remote_direct()` — fetches manifest, reads HTTP ranges on-demand per operation (starts immediately, no full download wait)
- Added `read_range_sync()` to `HttpPayloadReader` for synchronous HTTP reads in extraction threads
- Added `Clone` impl for `HttpPayloadReader` to share across extraction threads
- `extract_payload` command now accepts `prefetch: Option<bool>` and routes to the appropriate function
- Frontend `ExtractPayload` wrapper now passes `prefetch` to backend

**Files changed:**
- `src-tauri/src/payload/http.rs` — Clone impl, `read_range_sync()`, lazy blocking client
- `src-tauri/src/payload/remote.rs` — `extract_remote_prefetch()`, `extract_remote_direct()`, `extract_partition_from_mmap()`, `extract_partition_from_remote()`
- `src-tauri/src/commands/payload.rs` — `prefetch: Option<bool>` param, routing logic
- `src-tauri/src/payload/mod.rs` — updated exports
- `src-tauri/Cargo.toml` — removed `async-compression` (conflicted with `xz2` via `lzma-sys`), added `reqwest/blocking` feature
- `src/lib/desktop/backend.ts` — `prefetch` parameter in `ExtractPayload`
- `src/components/views/ViewPayloadDumper.tsx` — passes `prefetch` to backend

---

### 2026-04-01 — Payload Dumper: Remote URL Extraction with HTTP Range Requests

**Problem:** Users had to download full OTA files (3+ GB) to extract single partitions (~50-100 MB). This wastes bandwidth and time.

**Solution:** Added HTTP range request support to extract partitions directly from URLs, downloading only required data.

**Backend Changes:**
- `src-tauri/src/payload/http.rs` — NEW: `HttpPayloadReader` with retry logic (3 retries, exponential backoff)
- `src-tauri/src/payload/remote.rs` — NEW: `load_remote_payload` async function, downloads to temp file + mmap
- `src-tauri/src/commands/payload.rs` — Added `check_remote_payload`, `list_remote_payload_partitions` Tauri commands
- `src-tauri/Cargo.toml` — Added optional `remote_zip` feature with `reqwest`, `async-compression`, `futures-util`
- `src-tauri/src/payload/mod.rs` — Conditional exports for remote modules
- `src-tauri/src/payload/parser.rs` — Made `LoadedPayload` public for remote use

**Frontend Changes:**
- `src/components/RemoteUrlPanel.tsx` — NEW: URL input component with connection status display
- `src/components/views/ViewPayloadDumper.tsx` — Added Tabs UI for Local/Remote mode switching
- `src/lib/desktop/backend.ts` — Added `CheckRemotePayload`, `ListRemotePayloadPartitions` API functions
- `src/lib/desktop/models.ts` — Added `RemotePayloadInfo` interface

**Feature Architecture:**
```
Default build:  pnpm tauri build              # Local file extraction only
Remote support: pnpm tauri build --features remote_zip  # + HTTP range requests
```

**UX Flow:**
1. User switches to "Remote URL" tab in Payload Dumper
2. Enters URL and clicks "Check URL" → verifies range request support
3. Clicks "Load Partitions from URL" → fetches manifest via HTTP
4. Selects partitions and extracts → downloads only required ranges

**Documentation:**
- `docs/reports&audits/payload-dumper-optimization-audit.md` — Comprehensive audit comparing to payload-dumper-rust reference

**Commit:** `2a8c25d feat(payload): add remote URL extraction with HTTP range requests`

---

### 2026-03-31 — Flasher: Queued Actions for Bootloop Recovery

**Problem:** Users with bootlooping devices need to flash immediately when a device briefly appears in fastboot/sideload mode. Previously, the Flash and Sideload buttons were disabled until a device was connected, making rapid flashing impossible.

**Solution:** Action queue system that lets users prepare operations while waiting for device connection.

**ViewFlasher.tsx changes:**
- Added `QueuedAction` interface with `type`, `partition?`, `filePath`
- Added `queuedAction` state to track pending operations
- Split handlers: `executeFlash()`/`executeSideload()` perform the action, `handleFlash()`/`handleSideload()` check device and queue if needed
- Added `useEffect` that watches device connection and auto-executes queued actions
- Button states: enabled when file is set (removed `!hasDevice` from disabled condition)
- Visual feedback: `Clock` icon + "Waiting for Device..." text when action is queued
- Clear queue on file selection clear

**UX Flow:**
1. User selects file → button becomes clickable
2. Click without device → toast: "Waiting for fastboot device..." + button shows waiting state
3. Device connects → queued action executes automatically
4. User can cancel by clearing file selection

---

### 2026-03-31 — Frontend Hardening (Audit P1–P4)

**ErrorBoundary (C1):**
- Created `src/components/ErrorBoundary.tsx` — class-based boundary, retry button, `viewName` prop
- Wrapped `renderActiveView()` in `MainLayout.tsx` inside `<ErrorBoundary key={activeView}>` — renders crash UI instead of white screen; retry remounts the view

**Shared deviceStatus.ts (C3+H8):**
- Created `src/lib/deviceStatus.ts` — single source of truth for `StatusConfig`, `getStatusConfig()`
- Removed the duplicate `STATUS_CONFIG` block (~50 lines each) from `DeviceSwitcher.tsx` and `ConnectedDevicesCard.tsx`

**runtime.ts type safety (C2):**
- `EventCallback<T = unknown>` and `registerEventListener<T>` are now generic
- `EventsOn<T>` passes `Event<T>` to listeners — no more `any`
- `onDragDropEvent` callback typed with Tauri's actual `DragDropEvent` import; `'enter'` handled alongside `'over'`; `'leave'` used instead of `'cancel'` (matching actual Tauri v2 API)

**loadFiles race condition (H1):**
- Added `loadRequestIdRef = useRef(0)` to `ViewFileExplorer.tsx`
- Each `loadFiles` call stamps `requestId = ++loadRequestIdRef.current`; results are discarded if a newer call has already been dispatch ed

**Full Rust async migration (D3):**
- `device.rs`: `get_devices`, `get_fastboot_devices`, `get_device_info`, `get_device_mode` → `async fn + spawn_blocking`
- `adb.rs`: `connect_wireless_adb`, `disconnect_wireless_adb`, `enable_wireless_adb`, `run_adb_host_command`, `run_shell_command` → `async fn + spawn_blocking`
- `fastboot.rs`: `get_bootloader_variables`, `reboot`, `run_fastboot_host_command`, `set_active_slot` → `async fn + spawn_blocking`; stray `}` + unused `error` import removed
- `files.rs`: all 7 commands (list/pull/push/delete/rename/create_file/create_directory) → `async fn + spawn_blocking`
- `apps.rs`: `get_installed_packages` → `async fn + spawn_blocking`
- `payload.rs`: `list_payload_partitions` + `list_payload_partitions_with_details` → `async fn + block_in_place` (State<'_> cannot be 'static)
- `split_args` calls moved **inside** blocking closures so `Vec<&str>` borrows from the closure-owned `String` (not crossed spawn boundary)

**Verification (2026-03-31):**
- `pnpm format:check` ✅, `pnpm lint:web` ✅, `pnpm lint:rust` ✅, `pnpm build` ✅, `cargo check` ✅
- `cargo test` ⚠️ pre-existing `STATUS_ENTRYPOINT_NOT_FOUND` — Windows Tauri DLL issue, not a code bug

---

**ActionButton Component (`ActionButton.tsx`):**
- Created a standalone, reusable button component that manages a strict 4-state lifecycle: Idle ➔ Loading (spinner) ➔ Sent (success checkmark) ➔ Disabled.
- Added tactile feedback via `active:scale-[0.97]` for immediate click response.
- Uses `framer-motion` `<AnimatePresence>` to smoothly crossfade icons without layout shifts.
- Integrates the project's semantic `--success` token to render a glowing green border (`ring-success/50` + `shadow`) when an action succeeds.

**Utilities View Overhaul (`ViewUtilities.tsx`):**
- Refactored 11 distinct power, server, and fastboot buttons to use the new `<ActionButton>`.
- Replaced manual toast/loading tracking with proper `toast.loading` ➔ `toast.success` flows integrated with the 2-second "Sent!" UI timer.
- Fixed a Tailwind CSS Grid issue where `<span>` wrappers used for tooltips broke `col-span-2` grid layouts (buttons now force `w-full` and use `wrapperClassName`).
- Removed unnecessary tooltips on disabled buttons as requested by user to keep the UI extremely clean.
- Namespaced `actionId`s (e.g. `adb_bootloader` vs `fb_bootloader`) so that equivalent actions in separate UI sections don't incorrectly trigger each other's success animations.

---

### 2026-03-27 — Flasher View Overhaul + Position-Based Drag-Drop Hit-Testing

**Rust — Async Fastboot Commands (P0 UI Freeze Fix):**
- `flash_partition` and `wipe_data` converted from sync `pub fn` → `pub async fn` + `tokio::task::spawn_blocking`
- Matches proven pattern from `apps.rs` — prevents WebView freezing during 1-2 min partition flashes and 30-60s factory resets

**ViewFlasher.tsx — Complete UX Overhaul:**
- Two visual DropArea components (Flash: .img, Sideload: .zip) with position-based hit-testing
- Page-level `OnFileDrop` handler routes files by extension (single global handler, no conflicts)
- Partition name suggestions via HTML5 `<datalist>` (20 common Android partitions)
- `FileSelector` with Tooltip'd clear button when file is selected
- Loading mutex (`loadingAction`) prevents concurrent flash/sideload/wipe operations
- Centralized error handling via `handleError()` from `errorHandler.ts`
- Fixed import paths to `@/` alias; uses `deviceStore` for device awareness
- `AlertDialog` confirmation for destructive Wipe Data operation

**Position-Based Drag-Drop Hit-Testing (Project-Wide Fix):**
- Root cause: Tauri `onDragDropEvent` fires at the window level — all drop zones activated when dragging anywhere on the page
- Fix: Use cursor `(x, y)` coordinates from the drag event + `getBoundingClientRect()` to hit-test each drop zone
- `DropZone.tsx`: Added `containerRef` + `isPointInRect(x, y, rect)` — only highlights when cursor is physically over the component (fixes AppManager, PayloadDumper)
- `ViewFlasher.tsx`: `flashSectionRef` + `sideloadSectionRef` — combines position hit-test with extension validation (drag .zip over flash = no highlight)
- `runtime.ts`: Extended `DragDropHandler.onHover` to pass `paths?: string[]` (optional, backward-compatible)

**Commits:**
- `e6d061e` — `feat(flasher): async fastboot commands + UX overhaul with drag-and-drop`
- `e912623` — `fix(drag-drop): position-based hit-testing for drop zones`

---

### 2026-03-27 — Bottom Panel Polish, AppManager Improvements, Async Fix

**Bottom Panel (BottomPanel.tsx):**
- Fixed position (viewport-anchored) — never scrolls with page content
- Sidebar-aware `left` offset via `useSidebar()` — panel edge tracks sidebar expand/collapse with `200ms` CSS transition
- **Fluid resize**: DOM-first, commit-last pattern — `isResizingRef` (not state), direct `panelRef.current.style.height` writes during drag, `requestAnimationFrame` throttle (60fps cap), `will-change: height` GPU hint; single `setPanelHeight` on mouseup. Zero React re-renders during drag.
- Slide-in/out `translateY` animation on open/close. `transition` only on `transform` — never on `height` (would fight drag).
- `min-h-0` on content wrapper + `ScrollArea` → fixes shell input hiding when panel resized to minimum
- `MIN_HEIGHT` = 120px (panel chrome 40px + input row 44px + scroll buffer)
- `paddingBottom` on main scroll area = `panelHeight` when open — content behind panel stays reachable

**Header Tab Buttons (MainLayout.tsx):**
- Smart 3-state toggle for both Shell `⌨` and Logs `≡` buttons:
  - Panel closed → open + switch to that tab
  - Panel open, same tab → close
  - Panel open, other tab → switch tab only
- Contextual tooltip text: `"Close Shell"` / `"Close Logs"` / `"Shell (Ctrl+\`)"` / `"Logs"`

**LogsPanel.tsx:**
- Wrapped `ScrollArea` in `flex flex-col h-full overflow-hidden` container
- Added `min-h-0` to `ScrollArea` — matches ShellPanel layout, scroll now works correctly

**AppManager — shadcn Command component:**
- Replaced hand-rolled search UI (raw `div` + stripped `Input` + custom `Search` icon) with proper `Command` + `CommandInput` + `CommandEmpty`
- `shouldFilter={false}` — disables cmdk's built-in filter; our `useMemo` + `@tanstack/react-virtual` pipeline handles filtering and rendering
- Installed `@shadcn/command` (`cmdk` dependency)
- Toolbar layout: package count moved to left, Filter dropdown + Refresh moved to right (`ml-auto`)

**AppManager — Destructive button glow:**
- Added ambient shadow glow + hover-expand to `destructive` variant in `button-variants.ts`
- Uses `--destructive` CSS token with `color-mix(in_oklch)` — works in light/dark without hardcoded values
- Rest: `shadow-[0_0_15px_..._40%]`; Hover: `shadow-[0_0_25px_3px_..._55%]`; `transition-shadow duration-300`
- Applies globally to ALL destructive buttons

**Rust — Fix UI freeze during batch APK install (`commands/apps.rs`):**
- Root cause: `install_package`, `uninstall_package`, `sideload_package` were sync `fn` → ran on Tauri main thread → blocked WebView/IPC for 10-60s per APK
- Fix: converted to `async fn` + wrapped `run_binary_command` calls in `tokio::task::spawn_blocking` → blocking work runs on OS thread pool, Tokio runtime + WebView stay free
- `install_apks` (zip extraction + `adb install-multiple`) also offloaded via `spawn_blocking`
- Frontend: event-loop yield (`await new Promise<void>(r => setTimeout(r, 0))`) between each install iteration so React flushes progress UI

**Commits:**
- `18fd2b1` — `feat(ui): floating bottom panel with fluid resize and shell/log UX fixes`
- `069252e` — `fix(apps): non-blocking install/uninstall + destructive button glow`

---

### 2026-03-27 — App Manager & Payload Dumper UI Overhaul

**Reusable DropZone Component:**
- `src/components/DropZone.tsx` — shared drag-and-drop component with native Tauri events
- Features: file extension filtering, animated drag-over overlay (bounce icon, primary border glow, backdrop blur), fallback Browse button
- Uses `getCurrentWebview().onDragDropEvent` (over/drop/cancel) — replaces unreliable HTML5 drag events
- 150ms debounce on continuous `over` events for smooth visual transitions

**`runtime.ts` Extended:**
- `OnFileDrop` now supports `DragDropHandler` interface (`onHover`, `onDrop`, `onCancel`)

**AppManager Refactor:**
- Install APK section: DropZone when empty, file list + "Add More" when populated

**PayloadDumper UI Overhaul (3 improvements):**
1. **Adaptive columns** — 3-col table (checkbox + name + size) pre-extraction; dynamically expands to 4-col (+ progress) during/after extraction. Grid: `[28px_0.8fr_5fr_72px]` for centered progress.
2. **Loading overlay** — full centered stage indicator ("Extracting payload from ZIP..." / "Parsing partition manifest...") replaces tiny spinner during ZIP processing
3. **File info banner + sticky footer** — compact banner (filename, partition count, total size, icon buttons), scrollable partition list (`max-h-400px`), always-visible Extract button with size info ("Extract (11) — 6.83 GB"), ghost Reset

**Tooltip Consistency:**
- All icon buttons use shadcn `Tooltip/TooltipTrigger/TooltipContent` (not native `title=`)

**Files Changed:**
- `src/components/DropZone.tsx` — NEW
- `src/components/views/ViewAppManager.tsx` — DropZone integration
- `src/components/views/ViewPayloadDumper.tsx` — full UI overhaul
- `src/lib/desktop/runtime.ts` — DragDropHandler support

---

### 2026-03-27 — Global Device Switcher (Header Pill + Popover)

Centralized device management: moved `ConnectedDevicesCard` out of Flasher and Utilities into a **global header pill** with a rich popover dropdown.

#### Key Changes

**New Component: `DeviceSwitcher.tsx`**
- Compact pill button in the sticky header: `[🟢 device-name  adb  ▾]`
- Popover with full device list, radio-style selection, inline nickname editing
- Semantic traffic-light status colors per device state (emerald/amber/orange/blue/violet/red/zinc)
- Reads from centralized `deviceStore` — no local polling

**Centralized Device Polling:**
- Single `useQuery(['allDevices'], 3s)` in `MainLayout` replaces 3 independent polls
- Dashboard, Flasher, Utilities all read from `deviceStore` (no per-view queries)

**deviceStore Changes:**
- Added `selectedSerial: string | null` with auto-select logic
- Auto-select: single device → select; disconnect → clear; new device → auto-select

**Header Cleanup:**
- Removed redundant view label (sidebar highlights active page)
- Made header `sticky` with `backdrop-blur-sm` for scroll persistence
- Added `shadcn Popover` component

**Status Colors (Option A — Semantic Traffic Light):**
| Status | Color | Meaning |
|--------|-------|----------|
| `device` (adb) | Emerald-400 | Connected, ready |
| `recovery` | Blue-400 | Special mode |
| `sideload` | Violet-400 | Transfer mode |
| `fastboot` | Amber-400 | Bootloader-level |
| `bootloader` | Orange-400 | Low-level |
| `unauthorized` | Red-400 | Blocked |
| `offline` | Zinc-500 | Unreachable |

**Files Changed:**
- `src/components/DeviceSwitcher.tsx` — NEW
- `src/components/ui/popover.tsx` — NEW (shadcn)
- `src/lib/deviceStore.ts` — `selectedSerial` + auto-select
- `src/components/MainLayout.tsx` — centralized polling, sticky header, DeviceSwitcher
- `src/components/ConnectedDevicesCard.tsx` — semantic badge colors, pencil icon inline
- `src/components/views/ViewDashboard.tsx` — uses shared store, no own polling
- `src/components/views/ViewFlasher.tsx` — removed ConnectedDevicesCard + polling
- `src/components/views/ViewUtilities.tsx` — removed ConnectedDevicesCard + polling
- `docs/device-switcher-design.md` — design doc with 3 approaches

---

A comprehensive upgrade of `ViewFileExplorer.tsx` (~1520 lines), `files.rs`, `models.ts`, and `backend.ts`.

#### New Features

**Create File / Create Folder:**
- Inline "phantom row" input at the top of the file list (consistent with rename UX)
- Keyboard shortcuts: `Ctrl+N` (New File), `Ctrl+Shift+N` (New Folder)
- Context menu on empty space: "New File" / "New Folder" entries with shortcut hints
- Empty directory state: "New File" + "New Folder" quick-action buttons shown inline
- Validation: `FORBIDDEN_CHARS` regex, `RESERVED_NAMES` regex, empty-name guard
- Backend: `create_file` (`adb shell touch`) + `create_directory` (`adb shell mkdir -p`) in `files.rs`
- Registered in `lib.rs` + wrapped in `backend.ts`

**Context Menu — Import/Export + Copy Path:**
- Right-click folder → "Import into [folder]" pushes file directly into that dir
- Right-click file → "Export" pulls that exact item, no selection required
- Right-click any item → "Copy Path" → `navigator.clipboard.writeText()` with full Android path

**Back / Forward Navigation History:**
- `navHistory: string[]` stack (max 50 entries) + `historyIndex: number`
- `historyIndexRef = useRef(0)` keeps ref in sync for use inside `loadFiles` closure
- `← Back` + `→ Forward` toolbar buttons with `Alt+←` / `Alt+→` keyboard shortcuts
- Correct browser-style behavior: navigating cuts forward history
- `loadFiles(path, pushToHistory = true)` — refresh (`false`) never writes history

**Search / Filter:**
- Inline search `<Input>` in toolbar; expands on focus (w-32 → w-48 CSS transition)
- `Ctrl+F` to focus search input (id: `fe-search-input`)
- `Escape` clears search (priority: create → rename → search → selection)
- Client-side filter via `visibleList = sortEntries(filteredFileList, field, dir)`
- "No files match …" empty row shown when filter yields 0 results

**Sortable Columns:**
- Clickable Name / Size / Date column headers with sort indicator chevrons
- `sortEntries(entries, field, dir)` pure function — directories always float above files
- Size column: integer-aware comparison; date: lexically sortable ISO format `YYYY-MM-DD HH:MM`

**Human-Readable File Sizes:**
- `formatBytes(raw: string)` helper: `0 B` / `14.0 MB` / `1.2 GB`
- Directories show `—` instead of raw block size bytes
- Size cell styled `tabular-nums text-right text-xs text-muted-foreground`

**Symlink Target Display:**
- `parse_file_entries` splits `name -> /target` and stores both separately
- `FileEntry` gets `link_target: String` (Rust) / `linkTarget: string` (TS model)
- Symlink rows show `→ /target/path` as a tiny faint subtitle under the name

#### Bug Fixes

**Infinite Render Loop (critical — 50+ ADB calls/sec, screen jam):**
- Root cause: `loadFiles` in `useCallback([historyIndex])` called `setHistoryIndex` → changed `historyIndex` → new loadFiles reference → `useEffect([activeView, loadFiles])` re-fired → infinite loop
- Fix: `loadFiles` deps changed to `[]`; reads `historyIndexRef.current` (not stale closure value); updates ref + state atomically on history push

**Back/Forward Black Screen:**
- Root cause: `handleGoBack/Forward` called `setHistoryIndex` (async) then used stale `navHistory` snapshot
- Fix: both handlers read `historyIndexRef.current` synchronously, compute target path via `setNavHistory` updater (always receives latest state)

**Empty Directory Creation Not Working:**
- Root cause: `fileList.length === 0` condition showed empty state even when `creatingType !== null`, hiding the phantom row table branch
- Fix: condition changed to `fileList.length === 0 && creatingType === null`

**DRY Refactor:**
- `executePull(file)` shared helper replaces 3 duplicated pull implementations
- `executePush(localPath, targetDir)` shared helper replaces 3 duplicated push implementations

---

### 2026-03-26 — File Explorer: Explicit Multi-Select Mode (Checkbox Gate)

**Final selection model:**
- Plain click does NOT select — no accidental selection
- `isMultiSelectMode` gates checkbox column visibility
- Activated ONLY via: `Ctrl+Click`, `Ctrl+A`, right-click → Select
- Deactivated: `Escape`, Clear, uncheck-all, header deselect-all, navigation

**Full Keyboard Shortcut Map:**
- `Ctrl+Click` — toggle item, enter multi-select mode
- `Ctrl+A` — select all
- `F2` — inline rename (single selection)
- `Delete` — delete confirmation dialog
- `Ctrl+N` — New File (phantom row)
- `Ctrl+Shift+N` — New Folder (phantom row)
- `Ctrl+F` — focus search input
- `Alt+←` — Go Back in nav history
- `Alt+→` — Go Forward in nav history
- `Escape` — cancel create → cancel rename → clear search → clear selection

**Context menu (right-click row):**
```
☑ Select           ← always first; enters multi-select mode + adds item
📋 Copy Path       ← copies full Android path to clipboard
─────────────────
📂 Open            ← directories/symlinks only
─────────────────
✏  Rename          ← disabled when >1 selected
🗑  Delete          ← smart label: "Delete 3 items" when multi-selecting
─────────────────
⬆  Import          ← context-aware: "Import into [folder]" or "Import File"
⬇  Export          ← pulls this exact row directly (no selection needed)
```

---

### 2026-03-26 — File Explorer: Dual-Pane Navigation + Edge Cases

- `DirectoryTree` component: lazy-loaded tree, auto-reveal, keyboard nav
- Resizable dual-pane (180px–420px), editable address bar, localStorage persistence
- 5 edge cases: permission denied, spaces in paths, symlinks, device disconnect, responsive

---

## Current Verification Evidence

Verified (2026-03-31):
- `pnpm lint:web` ✅ — ESLint clean (exit 0)
- `pnpm lint:rust` ✅ — cargo clippy -D warnings clean
- `cargo check` ✅ — all Rust types valid
- `pnpm build` ✅ — TypeScript + Vite bundle clean
- `pnpm format:check` ✅ — Prettier + cargo fmt clean
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL — not a code bug)

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | shadcn Sidebar + 7 views + bottom panel |
| Bottom Panel | ✅ Polished | Fixed position, fluid resize (DOM-first/RAF), smart tab toggle, scroll fixed |
| File Explorer | ✅ Enhanced | Full CRUD, dual-pane, history, search, sort, human sizes, symlink targets, copy path |
| Device Management | ✅ Centralized | Global DeviceSwitcher in header, single polling source, selectedSerial in store |
| App Manager | ✅ Improved | shadcn Command search, toolbar layout, destructive glow, non-blocking install |
| Flasher | ✅ Overhauled | Async flash/wipe (spawn_blocking), DropArea with position hit-testing, partition suggestions, loading mutex |
| Backend | ✅ Complete | All 30+ Tauri commands fully async (spawn_blocking / block_in_place) |
| IPC Layer | ✅ Complete | `backend.ts` + `models.ts` (FileEntry + linkTarget) |
| Error Boundary | ✅ Complete | `ErrorBoundary.tsx` wraps every view in MainLayout |
| Type Safety | ✅ Complete | runtime.ts generics, DragDropEvent typed |
| Shared Utils | ✅ Complete | `deviceStatus.ts` — single STATUS_CONFIG source of truth |
| Linting | ✅ Complete | ESLint 10 flat config + cargo clippy -D warnings |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |

---

## Critical Patterns & Gotchas

- **`loadFiles` MUST have `[]` deps** — uses `historyIndexRef.current`. Adding `historyIndex` causes an infinite render loop (50+ ADB calls/sec).
- **`fileList.length === 0 && creatingType === null`** — the empty-state condition. Missing `creatingType === null` breaks inline creation in empty directories.
- **`pushToHistory = false`** for refresh/back/forward; `true` (default) for user navigation.
- **`isMultiSelectMode`**: Always the checkbox-column gate. Never show selection UI unless `true`.
- **`buttonVariants({ variant: 'destructive' })`** — all `AlertDialogAction` buttons. Now includes ambient glow + hover-expand.
- **Sidebar**: `sidebar-context.ts` holds all non-component exports (Vite Fast Refresh).
- **Shell**: In bottom panel, not a sidebar view.
- **Icon pattern**: `h-5 w-5` (CardTitle), `h-4 w-4 shrink-0` (inline/button).
- **`cargo test` on Windows**: STATUS_ENTRYPOINT_NOT_FOUND — pre-existing Tauri DLL issue, not a code bug.
- **Device polling**: Single `useQuery(['allDevices'], 3s)` in MainLayout — never add per-view polling.
- **`selectedSerial` auto-select**: disconnect → clear, single device → auto-select, user pick → persist.
- **Bottom panel resize**: Use `panelRef` + RAF + `spawn_blocking` pattern. NEVER call `setPanelHeight` on mousemove (triggers re-renders every pixel).
- **Tauri sync commands = main thread**: Any `pub fn` (not `pub async fn`) Tauri command that calls `std::process::Command::output()` BLOCKS the WebView. Always use `async fn` + `tokio::task::spawn_blocking` for any command that runs a subprocess.
- **AppManager Command search**: `shouldFilter={false}` is mandatory — cmdk's built-in filter breaks the virtualizer by trying to render all items.
- **Drag-drop hit-testing**: Tauri's `onDragDropEvent` is window-level. Always use `getBoundingClientRect()` + cursor `(x, y)` coordinates to determine which drop zone the cursor is over. Never show drag-over animation globally. `DropZone.tsx` has this built in via `containerRef`. For pages with multiple drop areas (e.g. Flasher), register ONE `OnFileDrop` handler and hit-test each section's ref.
- **One `OnFileDrop` per page**: Calling `OnFileDrop()` replaces the previous handler. Pages with multiple drop areas must register a single handler and route internally (ViewFlasher pattern).
- **ErrorBoundary**: Class-based, keyed to `activeView` so navigating away + back resets the boundary. Wrap `renderActiveView()` in MainLayout — never individual views themselves.
- **Tauri `DragDropEvent` API**: `type` is `'enter' | 'over' | 'drop' | 'leave'` — NOT `'cancel'`. Import `DragDropEvent` from `@tauri-apps/api/webview` for correct typing.
- **`split_args` in spawn_blocking**: `helpers::split_args` returns `Vec<&str>` borrowing from input. MUST be called **inside** the `spawn_blocking` closure where the owned `String` lives — never before (lifetime crosses 'static boundary).
- **`State<'_, T>` in async Tauri commands**: Cannot use `spawn_blocking` (needs `'static`). Use `tokio::task::block_in_place` instead — see `payload.rs` list commands.
- **`deviceStatus.ts`**: Single source of truth for all device badge labels/colors. Import `getStatusConfig()` from `@/lib/deviceStatus` — never define STATUS_CONFIG locally in components.
- **`loadFiles` request sequencing**: Uses `loadRequestIdRef = useRef(0)`. Each call: `const requestId = ++loadRequestIdRef.current`. After `await`, check `if (requestId !== loadRequestIdRef.current) return` before any state updates.