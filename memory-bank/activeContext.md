# Active Context

## Current State

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.
All responsive layout fixes, sticky header, and adaptive hardening are complete.

---

## Recently Completed

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

**Final working layout tree:**
```
<div h-svh overflow-hidden>                 ← BOUNDARY: exactly 100svh
  <SidebarProvider h-full>                  ← FILL: uses the boundary
    <AppSidebar />                          ← sidebar (fixed width, full height)
    <SidebarInset flex-1 flex-col overflow-x-hidden min-w-0>
      <header shrink-0>                     ← PINNED: 48px, never moves
      <div flex-1 overflow-y-auto overflow-x-hidden main-scroll-area>
        <div w-full p-4 sm:p-6>
          <div max-w-(--content-max-width) mx-auto>
            {activeView}                    ← ONLY THIS SCROLLS
```

**All gates:** `pnpm format:check` ✅ → `pnpm lint:web` ✅ → `pnpm build` ✅

---

### 2026-04-03 — Sticky Header Architecture + App-Wide Adaptive Hardening

**Problem:** After adding `overflow-hidden` to `SidebarInset`, `position: sticky` on the header
stopped working. `overflow: hidden` terminates the scroll-ancestor search that sticky needs.

**Architectural decision:** Don't use `position: sticky` at all. In a viewport-locked desktop app
(Tauri), the correct pattern is a flex-column layout where the header is structurally above the
scroll container — it never moves because it's a sibling to the scroller, not inside it.

**Overflow axis precision:**
Both `SidebarProvider` wrapper and `SidebarInset` use `overflow-x-hidden` (not `overflow-hidden`):
- Clips horizontal overflow (the original overflow bug)
- Preserves vertical flex flow for flex-col children (header + scroll area)
- `position: fixed` children (BottomPanel, Toaster) are unaffected — fixed elements use the
  viewport as their containing block, only re-contained by transformed ancestors (none here)

**Adaptive improvements applied across all views:**

| File | Change | Reason |
|---|---|---|
| `sidebar.tsx` | `SidebarContent`: `overflow-auto` → `overflow-y-auto overflow-x-hidden` | Eliminate phantom sidebar scrollbar gutter |
| `sidebar.tsx` | `SidebarInset`: `overflow-hidden` → `overflow-x-hidden` | Allow vertical flex flow |
| `MainLayout.tsx` | Header: `sticky top-0` removed → `shrink-0` | Structural pinning, not CSS sticky |
| `MainLayout.tsx` | Scroll div: `overflow-auto` → `overflow-y-auto overflow-x-hidden` | Explicit axis control |
| `ViewAppManager.tsx` | APK list: `max-h-75` → `max-h-[30vh] min-h-[100px] overflow-x-hidden` | Viewport-relative |
| `ViewAppManager.tsx` | Package virtualizer: `h-75` → `h-[40vh] min-h-[150px] overflow-x-hidden` | Viewport-relative |
| `ConnectedDevicesCard.tsx` | Device info div: `flex flex-col` → `flex flex-col min-w-0 flex-1` + `truncate` on spans | Serial/name overflow |
| `FileSelector.tsx` | Root div: added `min-w-0` | Completes truncation chain for file path `<p>` |

**All gates:** `pnpm format:check` ✅ → `pnpm lint:web` ✅ → `pnpm build` ✅

---

### 2026-04-03 — App-Wide Responsive Layout Fixes (7 Root Causes)

**Problem:** 7 responsive/adaptive layout issues — content clipping behind sidebar, phantom sidebar
scrollbar, horizontal overflow from long remote OTA URLs, fixed partition table heights.

**Systemic root causes fixed:**

1. **`SidebarContent`** — `overflow-auto` → `overflow-y-auto overflow-x-hidden`
   (stops horizontal scrollbar gutter in sidebar nav)

2. **`SidebarInset`** — Added `min-w-0` to enable flex shrink participation
   (systemic fix for all 7 views — content no longer clips behind sidebar)

3. **`global.css`** — `scrollbar-gutter: stable` scoped to `.main-scroll-area` class only;
   removed from global `html`/`body` (phantom gutter eliminated from sidebar and nested containers)

4. **`global.css`** — `--content-min-width: 400px` → `0px` (removed rigid 656px total minimum
   that forced horizontal scrolling on narrow windows: 256px sidebar + 400px content)

5. **`MainLayout.tsx`** — `min-w-(--content-min-width)` → `w-full` on content wrapper;
   `main-scroll-area` class added to scroll div for scoped `scrollbar-gutter`

6. **`PartitionTable.tsx`** — `max-h-100` (fixed 400px) → `max-h-[40vh] min-h-[120px] overflow-x-hidden`

7. **`PayloadSourceTabs.tsx`** — `overflow-hidden` added to remote `<TabsContent>`
   (completes containment chain for the URL input)

8. **`FileBanner.tsx`** — `min-w-0 max-w-full` added to URL `<p>` (defense-in-depth)

**Key insight:** The `min-w-0` propagation chain must be unbroken from root to leaf:
`SidebarProvider` → `SidebarInset` → content wrapper → card → component → text element.
Any missing link causes overflow to escape upward, widening the viewport.

**All gates:** `pnpm format:check` ✅ → `pnpm lint:web` ✅ → `pnpm build` ✅

---

### 2026-04-01 — Full Codebase Review: Security Hardening + Code Quality Cleanup

**Security fixes (Rust):**
1. `validate_shell_command()` — blocks shell metacharacters from `run_shell_command`
2. Empty-string guards on `run_adb_host_command` and `run_fastboot_host_command`
3. `is_private_url()` — SSRF prevention (loopback, private, link-local, CGNAT ranges blocked)
4. `open_folder` — path canonicalization + directory verification
5. `tempfile::TempDir` for APKS extraction (crash-safe cleanup)
6. `save_log` prefix sanitization (alphanumeric + `-`/`_`, max 50 chars)
7. Content-Length validation in HTTP range reads

**Code quality (Frontend):**
- `files.sort()` → `[...files].sort()` (no in-place mutation of backend response)
- `key={idx}` → `key={path}` in APK list (stable React keys)
- `formatBytes`/`formatBytesNum` consolidated into `lib/utils.ts`
- 11 unused React imports removed
- Dead code: `isRefreshingDevices`, unused `_activeView` props removed

**Commit:** `3618a30`

---

### 2026-04-01 — Rust Fixes: remote_zip Default Feature + Code Quality

- `remote_zip` added to default features in `Cargo.toml` — remote extraction always active
- `unreachable!()` macro replaces `Err(anyhow!("Unreachable"))` in retry loops
- `new(url: impl ToString)` — more ergonomic API
- Field docs added to `RemotePayload`; redundant `as u64` casts removed
- `commands/payload.rs` — `output_dir` canonicalization + `payload_path` existence check

---

## Current Verification Evidence

Last verified: **2026-04-03** (after remote metadata UI)
- `pnpm format:check` ✅ — Prettier + cargo fmt clean
- `pnpm lint` ✅ — ESLint + cargo clippy clean
- `pnpm build` ✅ — TypeScript + Vite bundle clean
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL — not a code bug)

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Layout | ✅ Fixed | h-svh boundary, flex-col pinned header, overflow-x-hidden containment |
| Responsive | ✅ Fixed | All 7 views — min-w-0 chain complete, no horizontal overflow |
| Header | ✅ Fixed | Structurally pinned via flex-col — never scrolls regardless of content |
| Sidebar | ✅ Fixed | No phantom scrollbar gutter; overflow-x-hidden on content |
| Payload Dumper | ✅ Enhanced | Remote metadata panel (7 sections), URL persistence, viewport-relative heights |
| App Manager | ✅ Fixed | Viewport-relative virtualizer + APK list heights |
| Connected Devices | ✅ Fixed | min-w-0 + truncate on device name/serial |
| FileSelector | ✅ Fixed | min-w-0 on outer div for path truncation chain |
| Frontend | ✅ Complete | shadcn Sidebar + 7 views + bottom panel |
| Bottom Panel | ✅ Polished | Fixed position, fluid resize (DOM-first/RAF), smart tab toggle |
| File Explorer | ✅ Enhanced | Full CRUD, dual-pane, history, search, sort, human sizes, symlinks |
| Device Management | ✅ Centralized | Global DeviceSwitcher in header, single polling source |
| App Manager | ✅ Improved | shadcn Command search, destructive glow, non-blocking install |
| Flasher | ✅ Overhauled | Async flash/wipe, DropArea with position hit-testing, queue actions |
| Backend | ✅ Complete | All 30+ Tauri commands fully async |
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

### Component Patterns

- **`AppManager shouldFilter={false}`**: Mandatory — cmdk's built-in filter conflicts with virtualizer.
- **Drag-drop hit-testing**: Tauri's `onDragDropEvent` is window-level. Always use `getBoundingClientRect()` + cursor `(x, y)`.
- **One `OnFileDrop` per page**: Calling it replaces the previous handler. Multiple drop areas = single handler + hit-test per ref.
- **ErrorBoundary**: Keyed to `activeView` so navigating away + back resets it.
- **Tauri `DragDropEvent` API**: `type` is `'enter' | 'over' | 'drop' | 'leave'` — NOT `'cancel'`.
- **`deviceStatus.ts`**: Single source of truth. Import `getStatusConfig()` from `@/lib/deviceStatus` — never define locally.
- **`loadFiles` request sequencing**: `loadRequestIdRef = useRef(0)`, stamp `requestId = ++ref.current`, discard stale after each `await`.