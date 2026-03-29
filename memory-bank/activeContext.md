# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-29 — Utilities Micro-Animations & UI Consistency

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

Verified (2026-03-27):
- `pnpm lint:web` ✅ — ESLint clean (exit 0)
- `cargo clippy` ✅ — 0 errors, 0 warnings
- `pnpm build` ✅ — TypeScript + Vite bundle clean
- `pnpm format` ✅ — Prettier + cargo fmt clean
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
| Backend | ✅ Complete | 30 Tauri commands; flash/wipe/install/uninstall/sideload all async (spawn_blocking) |
| IPC Layer | ✅ Complete | `backend.ts` + `models.ts` (FileEntry + linkTarget) |
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