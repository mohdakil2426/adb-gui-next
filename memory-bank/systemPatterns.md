# System Patterns

## Architecture Overview

The app uses a Tauri 2 desktop architecture with React 19 frontend and Rust backend.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + TypeScript + Vite)             │
│  main.tsx → App.tsx → MainLayout (SidebarProvider → AppSidebar + views) │
│  7 Views: Dashboard │ AppManager │ FileExplorer │ Flasher │             │
│           Utilities │ PayloadDumper │ About                             │
│  Bottom Panel: BottomPanel (Logs tab + Shell tab)                      │
│  Zustand Stores: deviceStore │ logStore │ shellStore │ payloadDumperStore│
│  Desktop Layer: src/lib/desktop/ (backend.ts, runtime.ts, models.ts)   │
├─────────────────────────────────────────────────────────────────────────┤
│                     Tauri 2 IPC Bridge                                  │
│  backend.ts → core.invoke<T>(command, args) → Rust commands            │
│  runtime.ts → event listeners, file drop, URL opener                   │
├─────────────────────────────────────────────────────────────────────────┤
│                     Backend (Rust — src-tauri/)                         │
│  lib.rs (~60 lines) — thin orchestrator                                 │
│  helpers.rs — shared utilities (binary resolution, command execution)   │
│  commands/ — 7 focused modules (device, adb, fastboot, files, apps,    │
│              system, payload) — 28 total commands                       │
│  payload/ — 4 modules (parser, extractor, zip, tests)                  │
│  resources/ — Bundled Android platform tools (adb, fastboot, etc.)     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Patterns

### 1. Desktop Abstraction Layer

`src/lib/desktop/` wraps every Tauri command:
- `backend.ts` — All `invoke<T>()` wrappers (including `DeleteFiles`, `RenameFile`)
- `runtime.ts` — Event listeners, file drop, URL opener
- `models.ts` — DTO interfaces matching Rust structs

### 2. State Management

- **Zustand v5** for shared state (device, log, shell, payloadDumper)
- **localStorage** for user preferences that must survive view switches and restarts:
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

`src-tauri/src/payload/` handles OTA payload.bin (4 modules):
- `parser.rs` — CrAU header parsing, protobuf manifest decoding; returns `LoadedPayload { mmap: Arc<Mmap>, manifest, data_offset }`
- `extractor.rs` — Streaming decompression (XZ/BZ2/Zstd/Replace) with 256 KiB stack buffer; SHA-256 verification; parallel extraction via `std::thread::scope`
- `zip.rs` — Streaming ZIP extraction to `NamedTempFile`; caches path only (not bytes)
- `tests.rs` — 5 payload tests

**Memory model:**
- `Arc<memmap2::Mmap>` — each thread gets an 8-byte Arc clone (not a 4–6 GB Vec clone)
- ZIP streamed to disk via `std::io::copy` + `NamedTempFile` — never buffered in RAM
- `Option<AppHandle>` — tests pass `None`; production passes `Some(app)` for live events

### 6. Error Handling

- **Frontend**: `handleError()` in `errorHandler.ts` → toast + log + tauri log
- **Rust**: `CmdResult<T> = Result<T, String>` — all commands return this
- **Structured Logging**: `tauri-plugin-log` with Stdout + LogDir + Webview targets

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

### 10. UI Consistency Rules (Enforced)

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
├── ui/                      # 23+ shadcn primitives (incl. Checkbox, ContextMenu, Command)
└── views/                   # 7 feature views (Dashboard, AppManager, FileExplorer,
                             #   Flasher, Utilities, PayloadDumper, About)
```

## Known Architectural Notes

- `src-tauri/src/lib.rs` split into helpers + 7 command modules (28 total commands)
- Device polling centralized in MainLayout via single TanStack Query (`['allDevices']`, 3s) — syncs to `deviceStore`
- `ConnectedDevicesCard` only used in Dashboard; header `DeviceSwitcher` provides global device awareness
- Shell is no longer a sidebar view — lives in bottom panel as a tab
- `cargo test` crashes on Windows due to pre-existing Tauri DLL issue (not a code bug)
- **Shift+Click range selection** is Phase 2 — currently deferred (needs `lastClickedIndex` tracking in `isMultiSelectMode` context)
- **Tauri blocking commands = UI freeze**: `pub fn` commands calling `std::process::Command::output()` run on the main thread and block the WebView. Pattern: `pub async fn` + `tokio::task::spawn_blocking(move || ...)`. Applied to `install_package`, `uninstall_package`, `sideload_package`.
- **Bottom panel resize MUST be DOM-first**: Never `setState` on mousemove. Use `ref.current.style.height` + RAF for drag, `setState` only on mouseup.
- **AppManager virtualizer + Command**: `shouldFilter={false}` is mandatory when using `<Command>` with `@tanstack/react-virtual`. cmdk's built-in filter tries to render all items and conflicts with virtualization.
