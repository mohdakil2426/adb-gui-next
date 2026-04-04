# System Patterns

## Architecture Overview

The app uses a Tauri 2 desktop architecture with React 19 frontend and Rust backend.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + TypeScript + Vite)             │
│  main.tsx → App.tsx → MainLayout (SidebarProvider → AppSidebar + views) │
│  8 Views: Dashboard │ AppManager │ FileExplorer │ Flasher │             │
│           Utilities │ PayloadDumper │ Marketplace │ About                │
│  Bottom Panel: BottomPanel (Logs tab + Shell tab)                      │
│  Zustand Stores: deviceStore │ logStore │ shellStore │ payloadDumperStore│
│                 marketplaceStore + marketplace hooks                    │
│  Desktop Layer: src/lib/desktop/ (backend.ts, runtime.ts, models.ts)   │
├─────────────────────────────────────────────────────────────────────────┤
│                     Tauri 2 IPC Bridge                                  │
│  backend.ts → core.invoke<T>(command, args) → Rust commands            │
│  runtime.ts → event listeners, file drop, URL opener                   │
├─────────────────────────────────────────────────────────────────────────┤
│                     Backend (Rust — src-tauri/)                         │
│  lib.rs (~60 lines) — thin orchestrator                                 │
│  helpers.rs — shared utilities (binary resolution, command execution)   │
│  commands/ — 8 focused modules (device, adb, fastboot, files, apps,    │
│              system, payload, marketplace) — 41 total commands           │
│  payload/ — CrAU (7 modules) + OPS/OFP (9 modules in ops/)              │
│  marketplace/ — provider modules + auth/cache/ranking/service layers    │
│  resources/ — Bundled Android platform tools (adb, fastboot, etc.)     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Patterns

### 1. Desktop Abstraction Layer

`src/lib/desktop/` wraps every Tauri command:
- `backend.ts` — All `invoke<T>()` wrappers (including `DeleteFiles`, `RenameFile`)
- `runtime.ts` — Event listeners, file drop (with position-aware `DragDropHandler`), URL opener
- `models.ts` — DTO interfaces matching Rust structs

### 2. Drag-and-Drop (Position-Based Hit-Testing)

Tauri's `onDragDropEvent` fires at the **window level** — it doesn't know which DOM element the cursor is over. All drop zones would activate simultaneously without hit-testing.

**Pattern:** Use cursor `(x, y)` from the hover event + `getBoundingClientRect()` to determine which drop zone is under the cursor.

```ts
// DropZone.tsx — single drop zone per page
const containerRef = useRef<HTMLDivElement>(null);
OnFileDrop({
  onHover: (x, y) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const isOver = rect ? isPointInRect(x, y, rect) : false;
    setIsDragging(isOver); // only highlight when cursor is over THIS component
  },
});
```

```ts
// ViewFlasher — multiple drop areas on one page
// Register ONE handler, hit-test each section's ref
const flashRef = useRef<HTMLDivElement>(null);
const sideloadRef = useRef<HTMLDivElement>(null);
OnFileDrop({
  onHover: (x, y, paths) => {
    const overFlash = isPointInRect(x, y, flashRef.current?.getBoundingClientRect()!);
    const overSideload = isPointInRect(x, y, sideloadRef.current?.getBoundingClientRect()!);
    // Combine position + extension validation
    if (overFlash && paths?.some(isImgFile)) setDragTarget('flash');
    else if (overSideload && paths?.some(isZipFile)) setDragTarget('sideload');
    else setDragTarget('none');
  },
});
```

**Rules:**
- ONE `OnFileDrop()` per page (calling it replaces the previous handler)
- Pages with multiple drop areas: single handler + hit-test per ref
- `DragDropHandler.onHover` receives optional `paths?: string[]` for extension filtering
- Always use 150ms timeout to auto-clear drag state (cursor left window)

### 3. State Management

- **Zustand v5** for shared state (device, log, shell, payloadDumper)
- **localStorage** for user preferences that must survive view switches and restarts:
### 3a. Marketplace Feature Split

Marketplace now follows a hybrid state/orchestration pattern:
- `marketplaceStore.ts` keeps durable UI state and persisted preferences (providers, sort, view mode, history, OAuth client ID). GitHub PAT fallback is session-only and must not be persisted.
- `src/lib/marketplace/useMarketplaceSearch.ts` owns debounce cancellation + stale-response protection + request orchestration
- `src/lib/marketplace/useMarketplaceHome.ts` loads zero-query discovery sections (trending + fresh releases)
- `src/lib/marketplace/useMarketplaceAuth.ts` manages optional GitHub OAuth device-flow state in the frontend and polls using the exact client ID captured at challenge start
- `src/lib/marketplace/install.ts` centralizes APK download/install toast workflow for cards and dialogs

### 3b. Marketplace Backend Service Layer

Marketplace command wrappers are now intentionally thin:
- `commands/marketplace.rs` handles Tauri command surfaces only
- `marketplace/service.rs` handles provider orchestration and cache-key construction
- `marketplace/cache.rs` provides in-memory TTL caches for search/detail/trending
- `marketplace/ranking.rs` handles dedupe/grouping and deterministic sort/relevance rules
- `marketplace/auth.rs` handles GitHub OAuth device-flow start/poll and signed-in metadata fetch

This keeps provider-specific parsing isolated in `fdroid.rs`, `izzy.rs`, `github.rs`, and `aptoide.rs` while shared policies live outside command wrappers.

  - `nicknameStore` — device nicknames (no reactivity needed)
  - `fe.currentPath` — last visited File Explorer path (lazy `useState` initializer)
  - `fe.treeCollapsed` — File Explorer tree panel collapsed state
- **No router** — `useState<ViewType>` + switch statement in MainLayout

### 3. File Explorer — State Model & Critical Patterns

`ViewFileExplorer` uses several carefully designed state patterns:

**Multi-select gate (`isMultiSelectMode`):**
| State | Checkbox column | SelectionSummaryBar |
|-------|----------------|---------------------|
| `false` | **Absent from DOM** | Hidden |
| `true`, 0 items | Shown (empty) | Hidden |
| `true`, ≥1 item | Shown (checked) | Shown with count + Delete |

**Activation:** `Ctrl+Click`, `Ctrl+A`, right-click → Select  
**Deactivation:** `Escape`, Clear, uncheck-all, header deselect-all, navigation

**loadFiles stable reference pattern (CRITICAL):**
```ts
// loadFiles MUST have [] deps. Using [historyIndex] causes an infinite render loop:
// loadFiles → setHistoryIndex → historyIndex changes → new loadFiles ref → useEffect fires → ∞
const historyIndexRef = useRef(0); // mirrors historyIndex for use inside loadFiles
const loadFiles = useCallback(async (path, pushToHistory = true) => {
  if (pushToHistory) {
    const idx = historyIndexRef.current; // read from ref, not closed-over state
    historyIndexRef.current = newIdx;    // update ref synchronously
    setHistoryIndex(newIdx);             // schedule state update
  }
}, []); // stable — never changes reference
```

**Empty-directory creation guard:**
```tsx
// WRONG: fileList.length === 0 ? <EmptyState> : <Table with phantom row>
// If creatingType !== null, the table must render even in empty dirs
// CORRECT:
fileList.length === 0 && creatingType === null ? <EmptyState> : <Table>
```

**`pushToHistory` flag:**
- `loadFiles(path)` — user navigation (default `true`): writes to history stack
- `loadFiles(path, false)` — refresh/back/forward: no history entry added


### 4. Binary Resolution

Three-tier fallback for ADB/fastboot binaries:
1. Tauri resource dir (`src-tauri/resources/{platform}/`)
2. Repo `resources/` directory
3. System PATH via `which`

### 5. Payload Extraction

`src-tauri/src/payload/` handles OTA payload.bin (7 modules):
- `parser.rs` — CrAU header parsing, protobuf manifest decoding; returns `LoadedPayload { mmap: Arc<Mmap>, manifest, data_offset }`
- `extractor.rs` — Streaming decompression (XZ/BZ2/Zstd/Replace) with 256 KiB stack buffer; SHA-256 verification; parallel extraction via `std::thread::scope`
- `zip.rs` — Streaming ZIP extraction to `NamedTempFile`; caches path only (not bytes)
- `http.rs` — HTTP range request support; `HttpPayloadReader` with async + sync range reads; `Clone`; lazy blocking client; retry logic (remote_zip feature)
- `remote.rs` — Remote payload loading and extraction (remote_zip feature):
  - `extract_remote_prefetch()` — download full → mmap extract (best for slow connections)
  - `extract_remote_direct()` — manifest + HTTP ranges on-demand (starts immediately)
  - `list_remote_payload_partitions()` — manifest-only fetch for partition listing
- `tests.rs` — 5 payload tests

**Memory model:**
- `Arc<memmap2::Mmap>` — each thread gets an 8-byte Arc clone (not a 4–6 GB Vec clone)
- ZIP streamed to disk via `std::io::copy` + `NamedTempFile` — never buffered in RAM
- `Option<AppHandle>` — tests pass `None`; production passes `Some(app)` for live events

**Remote URL (remote_zip feature):**
- `HttpPayloadReader` — HEAD request to check range support, GET with Range header for partial downloads
- `read_range_sync()` — synchronous HTTP range reads for extraction threads (uses `reqwest::blocking`)
- `extract_remote_prefetch` — download full payload to temp, then mmap + parallel extraction
- `extract_remote_direct` — fetch manifest + HTTP ranges per-operation on-demand
- Retry logic: 3 retries with exponential backoff (1s, 2s, 4s delays)
- SSRF prevention: private IP blocklist, localhost domain blocking, HTTP/HTTPS only
- Content-Length validation: verifies returned bytes match requested range length
- Feature flag: `pnpm tauri build --features remote_zip`

### 5b. Remote Payload Metadata (OTA Package Info)

`get_remote_payload_metadata()` in `remote.rs` aggregates metadata from **3 sources** into a single `RemotePayloadMetadata` struct:

1. **HTTP headers** — `content-type`, `last-modified`, `server`, `etag` (captured during `HttpPayloadReader::new()`)
2. **ZIP entries** — `read_text_file_from_zip()` reads `META-INF/com/android/metadata` and `payload_properties.txt` as key=value text files
3. **CrAU protobuf manifest** — block size, minor version, security patch, dynamic groups

**Key design principles:**
- **Best-effort** — ZIP entry reads return `Ok(None)` when files don't exist; the function never fails due to missing metadata
- **Separate command** — metadata fetch is a dedicated Tauri command, not bundled into partition listing (keeps existing APIs clean)
- **Fire-and-forget** — frontend triggers metadata fetch after partition load completes; failure is logged silently
- **Zustand persistence** — `remoteMetadata` survives view navigation; cleared on `reset()` or `setPayloadPath()`

**Frontend rendering** (`FileBannerDetails.tsx`):
- OTA Package section is primary (device, Android version, build fingerprint, OTA type badge)
- Conditional sections — ZIP and Dynamic Groups hidden when not applicable
- SDK→Android version mapping (SDK 29 → "Android 10")
- Copyable hashes via clipboard API with visual feedback

### 5c. OPS/OFP Firmware Extraction (Unified Dispatch)

`src-tauri/src/payload/ops/` handles OnePlus OPS and Oppo OFP firmware containers (9 modules):

**Dispatch flow:**
```
extract_payload(path) / list_payload_partitions_with_details(path)
  → check extension (.ops/.ofp) → should_use_ops_pipeline()
  → detect_format(mmap) → match CrAU | Ops | OfpQualcomm | OfpMediaTek | ...
  → parse_ops() / parse_ofp_qc() / parse_ofp_mtk() → Vec<OpsPartitionEntry>
  → map to Vec<PartitionDetail> (same type as CrAU) → transparent to frontend
```

**Cryptographic pipeline:**
- **OPS**: Custom S-box cipher with 3 mbox key schedule variants (mbox4/5/6). Brute-forces all variants to find one that produces valid XML.
- **OFP-QC**: AES-128-CFB with 7 key triplets. Keys derived via ROL/nibble-swap deobfuscation + MD5 hex truncation. Also tries V1 keyshuffle method.
- **OFP-MTK**: 9 key sets with mtk_shuffle2 nibble-swap obfuscation. Binary header/entry table format (not XML).

**Sparse image support:**
- After extraction, checks if output file has Android sparse magic (`0xED26FF3A`)
- Un-sparses in-place: reads 4 chunk types (Raw, Fill, Don't Care, CRC32), writes raw image, replaces original file

**Key types:**
- `OpsPartitionEntry`: name, offset, size, sector_size, encrypted, encrypted_length, sha256, sparse
- `OpsMetadata`: format, project_id, firmware_name, cpu, flash_type, encryption, total_partitions, total_size, sections
- `FirmwareFormat`: PayloadBin, ZipOfp, Ops, OfpQualcomm, OfpMediaTek

### 6. Error Handling

- **Frontend**: `handleError()` in `errorHandler.ts` → toast + log + tauri log
- **Rust**: `CmdResult<T> = Result<T, String>` — all commands return this
- **Structured Logging**: `tauri-plugin-log` with Stdout + LogDir + Webview targets

### 6b. Security Patterns

- **Shell command validation**: `validate_shell_command()` blocks metacharacters (`;`, `|`, `&`, `$`, backticks, etc.) from `run_shell_command`
- **SSRF prevention**: `is_private_url()` blocks loopback, private, link-local, CGNAT, and unspecified IP ranges
- **Path canonicalization**: `open_folder` verifies path exists, is a directory, and canonicalizes before opening
- **TempDir RAII**: `tempfile::TempDir` auto-cleans on any exit path (APKS extraction)
- **Prefix sanitization**: `save_log` filters prefix to alphanumeric + `-`/`_` only, max 50 chars

### 7. Sidebar (shadcn)

shadcn `Sidebar` component with `collapsible="icon"` mode:
- `SidebarProvider` wraps entire layout (manages state, keyboard shortcut `Ctrl+B`)
- `AppSidebar.tsx` — grouped nav (Main/Advanced), SidebarHeader, SidebarFooter, SidebarRail
- `SidebarInset` wraps main content with header bar (`SidebarTrigger` + toolbar)
- `SidebarMenuButton tooltip={label}` — automatic tooltips in icon mode
- View switching via `useState<ViewType>` + switch statement (no router)
- `sidebar-context.ts` — holds all non-component exports (constants, context, `useSidebar` hook) so `sidebar.tsx` exports only React components (Vite Fast Refresh requirement)

### 8. Device Polling & Switcher

**Centralized polling** — Single `useQuery(['allDevices'], 3s)` in `MainLayout` replaces per-view polling.
- `MainLayout` fetches all devices (ADB + fastboot) and syncs to `deviceStore.setDevices()`
- All views read from `deviceStore` — no per-view `useQuery` for devices
- `DeviceSwitcher` component in sticky header: pill button + Popover with device list
- `selectedSerial` in store for multi-device switching (auto-select logic built-in)
- Semantic status colors: emerald (adb), amber (fastboot), orange (bootloader), blue (recovery), violet (sideload), red (unauthorized), zinc (offline)

### 9. Bottom Panel (VS Code-style, Fixed Position)

- `BottomPanel.tsx` — Fixed-position overlay (viewport-anchored, never scrolls); sidebar-aware `left` offset via `useSidebar()`
- **DOM-first resize pattern**: `isResizingRef` (not state) + direct `panelRef.current.style.height` writes + `requestAnimationFrame` throttle (60fps cap) + `will-change: height` GPU hint. Single `setPanelHeight(h)` commit only on `mouseup`. Zero React re-renders during drag.
- Slide-in/out `translateY` animation; `transition` ONLY on `transform` — never on `height` (conflicts with drag)
- `min-h-0` on flex children + `ScrollArea` → fixes shell input hiding at minimum panel height
- `paddingBottom` on main content scroll area = `panelHeight` when open (content stays reachable behind panel)
- **3-state header toggle**: closed→open+tab | open+same-tab→close | open+other-tab→switch tab
- `LogsPanel.tsx` — Filtered log viewer; uses `flex flex-col h-full` + `min-h-0` on `ScrollArea` (same layout as ShellPanel)
- `ShellPanel.tsx` — Interactive ADB/fastboot terminal; same flex + `min-h-0` layout
- `logStore.ts` — Ring buffer (1000 max), ISO timestamps, filter/search/panel state, unread count
- `shellStore.ts` — Shell history + command history Zustand store
- 12 terminal CSS variables in `global.css` for light/dark theme support
- Keyboard shortcut: `Ctrl+\`` to toggle panel

### 10. Action Queue Pattern (Bootloop Recovery)

For operations that require a device in a specific mode (fastboot/sideload), users may need to queue actions while waiting for a bootlooping device to appear briefly. The pattern enables immediate execution when the device connects.

**Pattern:**
```tsx
interface QueuedAction {
  type: 'flash' | 'sideload';
  partition?: string;  // for flash only
  filePath: string;
}

const [queuedAction, setQueuedAction] = useState<QueuedAction | null>(null);

// Button enabled when file is set, NOT when device is connected
<Button disabled={!file || !partition} onClick={handleFlash}>

// Handler queues if device not ready
const handleFlash = () => {
  if (hasFastbootDevice) {
    executeFlash(partition, filePath);
  } else {
    setQueuedAction({ type: 'flash', partition, filePath });
    toast.info('Waiting for fastboot device...');
  }
};

// Auto-execute when device connects
useEffect(() => {
  if (!queuedAction || isGlobalLoading) return;
  const isReady = queuedAction.type === 'flash' ? hasFastbootDevice : hasSideloadDevice;
  if (isReady) {
    const action = queuedAction;
    setQueuedAction(null);
    if (action.type === 'flash') executeFlash(action.partition!, action.filePath);
    else executeSideload(action.filePath);
  }
}, [queuedAction, hasFastbootDevice, hasSideloadDevice, isGlobalLoading]);

// Clear queue on file clear
onClick={() => {
  setFilePath('');
  if (queuedAction?.type === 'flash') setQueuedAction(null);
}}
```

**Visual Feedback:**
- Button shows `Clock` icon + "Waiting for Device..." when action is queued
- Button shows `Loader2` spinner when action is executing
- Button shows default icon + text when ready

### 11. UI Consistency Rules (Enforced)

| Rule | Pattern |
|------|---------|
| CardTitle icons | `className="h-5 w-5"` — never `size={N}` prop |
| Inline/list icons | `className="h-4 w-4 shrink-0"` |
| In-button icons | must include `shrink-0` |
| Form labels | always `<Label>` (shadcn), never raw `<label className="...">` |
| Destructive dialogs | `buttonVariants({ variant: 'destructive' })` on `AlertDialogAction` (includes glow) |
| Semantic colors | `text-success`, `bg-success` etc. — never `text-[var(--terminal-log-success)]` |
| Imports | `@/` alias for all internal imports |
| Clickable div lists | must have `role`, `aria-*`, `tabIndex`, `onKeyDown` |
| Checkbox UI | use shared `<CheckboxItem>` |
| Empty states | use shared `<EmptyState>` |
| Animations | use MainLayout's `motion.div` wrapper — do NOT add per-view `animate-in` classes |
| Links that open URL | `<button onClick={openLink}>` — never `<a href>` with `onClick` (double-open on Tauri) |
| Searchable lists | `<Command shouldFilter={false}>` + `<CommandInput>` — never hand-roll search icon+input |

### 12. Layout & Containment (Viewport-Locked Desktop Pattern)

This is a Tauri desktop app — the window is viewport-locked. The layout tree must respect this.

**Viewport height boundary (MANDATORY):**
```tsx
// MainLayout.tsx — outer wrapper
<div className={cn('h-svh overflow-hidden', isLoading ? 'opacity-0' : 'opacity-100 ...')}>
  <SidebarProvider>  {/* uses h-full, NOT min-h-svh */}
    <AppSidebar />
    <SidebarInset>  {/* flex-1 flex-col overflow-x-hidden min-w-0 */}
      <header className="shrink-0 ...">  {/* PINNED — never scrolls */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden main-scroll-area">  {/* SCROLLER */}
        {activeView}
```

**Rules:**
- `h-svh overflow-hidden` on the outer wrapper = hard viewport boundary. Without it, `flex-1` resolves to ∞ and everything scrolls at body level.
- `SidebarProvider` wrapper: `h-full` (not `min-h-svh`). `min-h-svh` is a web page pattern — it allows growing beyond the viewport.
- Header is `shrink-0` flex sibling above the scroll area. **No `position: sticky` needed or used.**
- Scroll only happens inside `flex-1 overflow-y-auto` — never at the body level.
- `position: fixed` children (BottomPanel, Toaster) reference the viewport, not the container. They are unaffected by `overflow-x-hidden` (only CSS `transform` would re-contain them).

**`overflow-x-hidden` vs `overflow-hidden`:**
- `overflow-x-hidden` on layout containers = clips horizontal escapes, preserves vertical flex flow.
- `overflow-hidden` on layout containers = breaks `position: sticky` by terminating the scroll-ancestor search AND clips vertical overflow unexpectedly.
- Rule: Use `overflow-x-hidden` on `SidebarProvider` wrapper and `SidebarInset`. Use `overflow-hidden` only on leaf components (tooltips, dropdowns, image crops).

**`min-w-0` propagation chain:**
```
SidebarProvider (overflow-x-hidden)
  SidebarInset (min-w-0 overflow-x-hidden)
    scroll div (w-full)
      content wrapper (w-full)
        Card (min-w-0 where needed)
          flex row (min-w-0)
            <p className="truncate">  ← WORKS
```
Any missing `min-w-0` in a flex ancestor allows the child to dictate its own width, breaking truncation for all descendant text.

**Scrollbar gutter:**
- `scrollbar-gutter: stable` is applied ONLY via `.main-scroll-area` class on the main content scroll div.
- Never apply globally to `html`/`body` — it creates phantom gutters in sidebar nav, nested scroll areas, and dialog overlays.

**Viewport-relative heights for scroll lists:**
```tsx
// DO: viewport-relative with floor
className="max-h-[40vh] min-h-30 overflow-y-auto"

// DON'T: fixed pixel heights
className="max-h-100"  // 400px — too small on large monitors, too large on small windows
```

## Component Architecture

```text
src/components/
├── MainLayout.tsx           # App shell: SidebarProvider + SidebarInset + header + views
├── AppSidebar.tsx           # shadcn Sidebar (grouped nav, header, footer, rail)
├── ThemeProvider.tsx        # next-themes provider
├── ThemeToggle.tsx          # Theme toggle using SidebarMenuButton
├── BottomPanel.tsx          # VS Code-style bottom panel (tabs, resize, actions)
├── LogsPanel.tsx            # Filtered log viewer with search highlight
├── ShellPanel.tsx           # Interactive ADB/fastboot terminal
├── DirectoryTree.tsx        # Lazy-loaded file system tree for File Explorer left pane
├── WelcomeScreen.tsx        # 750ms animated splash with Progress
├── ConnectedDevicesCard.tsx # Device list card (Dashboard only)
├── DeviceSwitcher.tsx       # Global header device pill + popover dropdown
├── EditNicknameDialog.tsx   # Shared nickname edit dialog
├── CheckboxItem.tsx         # Shared checkbox indicator (AppManager, PayloadDumper)
├── EmptyState.tsx           # Shared empty-state component
├── CopyButton.tsx           # Shared copy-to-clipboard button
├── FileSelector.tsx         # Shared file/dir picker (label + button + path hint)
├── LoadingButton.tsx        # Shared button with loading spinner
├── SectionHeader.tsx        # Shared section sub-header (Utilities, PayloadDumper)
├── SelectionSummaryBar.tsx  # Shared selection count + clear + actions bar
├── RemoteUrlPanel.tsx       # Remote URL input with connection status (PayloadDumper)
├── AppDetailDialog.tsx      # Marketplace app detail dialog (download + install + versions)
├── marketplace/             # 8 marketplace UI components
│   ├── SearchBar.tsx        # Ctrl+K shortcut, 600ms debounced search, settings icon
│   ├── FilterBar.tsx        # Provider chips, grid/list toggle, result count
│   ├── AppCard.tsx          # Grid card with icon, provider badge, install
│   ├── AppListItem.tsx      # Compact list row
│   ├── MarketplaceEmptyState.tsx  # Hero, popular chips, trending GitHub apps
│   ├── MarketplaceSettings.tsx    # Settings dialog: providers, GitHub PAT, preferences
│   ├── ProviderBadge.tsx    # Color-coded source badges (F-Droid/Izzy/GitHub/Aptoide)
│   └── AttributionFooter.tsx  # "Powered by" provider links
├── ui/                      # 23+ shadcn primitives (incl. Checkbox, ContextMenu, Command, Tabs)
└── views/                   # 8 feature views (Dashboard, AppManager, FileExplorer,
                             #   Flasher, Utilities, PayloadDumper, Marketplace, About)
```

## Known Architectural Notes

- `src-tauri/src/lib.rs` split into helpers + 8 command modules (38 total commands)
- `src-tauri/src/marketplace/` — modular provider architecture (fdroid, izzy, github, aptoide, types) with concurrent `tokio::join!` search; IzzyOnDroid uses cross-reference (no search API — checks F-Droid results against packages endpoint); GitHub uses proper URL encoding (`%20` not `+`) with optional PAT for rate limit increase
- Device polling centralized in MainLayout via single TanStack Query (`['allDevices']`, 3s) — syncs to `deviceStore`
- `ConnectedDevicesCard` only used in Dashboard; header `DeviceSwitcher` provides global device awareness
- Shell is no longer a sidebar view — lives in bottom panel as a tab
- `cargo test` crashes on Windows due to pre-existing Tauri DLL issue (not a code bug)
- **Shift+Click range selection** is Phase 2 — currently deferred (needs `lastClickedIndex` tracking in `isMultiSelectMode` context)
- **Tauri blocking commands = UI freeze**: `pub fn` commands calling `std::process::Command::output()` run on the main thread and block the WebView. Pattern: `pub async fn` + `tokio::task::spawn_blocking(move || ...)`. Applied to `install_package`, `uninstall_package`, `sideload_package`, `flash_partition`, `wipe_data`.
- **Bottom panel resize MUST be DOM-first**: Never `setState` on mousemove. Use `ref.current.style.height` + RAF for drag, `setState` only on mouseup.
- **AppManager virtualizer + Command**: `shouldFilter={false}` is mandatory when using `<Command>` with `@tanstack/react-virtual`. cmdk's built-in filter tries to render all items and conflicts with virtualization.
- **Layout boundary (CRITICAL)**: `h-svh overflow-hidden` on MainLayout outer div is the root of the entire flex height chain. `SidebarProvider` uses `h-full`. Without these, `flex-1` inside `SidebarInset` resolves to ∞ — header scrolls.
- **`overflow-x-hidden` not `overflow-hidden` on layout containers**: `overflow-hidden` terminates the scroll-ancestor chain (breaks sticky) and clips both axes. `overflow-x-hidden` clips only horizontal escapes, leaving vertical flex flow intact.
- **No `position: sticky` in this app**: Header is pinned structurally as a `shrink-0` sibling to the `flex-1 overflow-y-auto` scroll area inside the bounded `SidebarInset`.
