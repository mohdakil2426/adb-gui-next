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
│  lib.rs (52 lines) — thin orchestrator                                 │
│  helpers.rs — shared utilities (binary resolution, command execution)   │
│  commands/ — 7 focused modules (device, adb, fastboot, files, apps,    │
│              system, payload)                                          │
│  payload/ — 4 modules (parser, extractor, zip, tests)                  │
│  resources/ — Bundled Android platform tools (adb, fastboot, etc.)     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Patterns

### 1. Desktop Abstraction Layer

`src/lib/desktop/` wraps every Tauri command:
- `backend.ts` — All `invoke<T>()` wrappers
- `runtime.ts` — Event listeners, file drop, URL opener
- `models.ts` — DTO interfaces matching Rust structs

### 2. State Management

- **Zustand v5** for shared state (device, log, shell, payloadDumper)
- **localStorage** for nickname persistence (no reactivity — `nicknameStore`)
- **No router** — `useState<ViewType>` + switch statement in MainLayout

### 3. Binary Resolution

Three-tier fallback for ADB/fastboot binaries:
1. Tauri resource dir (`src-tauri/resources/{platform}/`)
2. Repo `resources/` directory
3. System PATH via `which`

### 4. Payload Extraction

`src-tauri/src/payload/` handles OTA payload.bin (4 modules):
- `parser.rs` — CrAU header parsing, protobuf manifest decoding; returns `LoadedPayload { mmap: Arc<Mmap>, manifest, data_offset }`
- `extractor.rs` — Streaming decompression (XZ/BZ2/Zstd/Replace) with 256 KiB stack buffer; SHA-256 verification; parallel extraction via `std::thread::scope`
- `zip.rs` — Streaming ZIP extraction to `NamedTempFile`; caches path only (not bytes)
- `tests.rs` — 5 payload tests

**Memory model:**
- `Arc<memmap2::Mmap>` — each thread gets an 8-byte Arc clone (not a 4–6 GB Vec clone)
- ZIP streamed to disk via `std::io::copy` + `NamedTempFile` — never buffered in RAM
- `Option<AppHandle>` — tests pass `None`; production passes `Some(app)` for live events

### 5. Error Handling

- **Frontend**: `handleError()` in `errorHandler.ts` → toast + log + tauri log
- **Rust**: `CmdResult<T> = Result<T, String>` — all commands return this
- **Structured Logging**: `tauri-plugin-log` with Stdout + LogDir + Webview targets

### 6. Sidebar (shadcn)

shadcn `Sidebar` component with `collapsible="icon"` mode:
- `SidebarProvider` wraps entire layout (manages state, keyboard shortcut `Ctrl+B`)
- `AppSidebar.tsx` — grouped nav (Main/Advanced), SidebarHeader, SidebarFooter, SidebarRail
- `SidebarInset` wraps main content with header bar (`SidebarTrigger` + toolbar)
- `SidebarMenuButton tooltip={label}` — automatic tooltips in icon mode
- View switching via `useState<ViewType>` + switch statement (no router)
- `sidebar-context.ts` — holds all non-component exports (constants, context, `useSidebar` hook) so `sidebar.tsx` exports only React components (Vite Fast Refresh requirement)

### 7. Device Polling

**TanStack Query v5** — `useQuery({ refetchInterval: 3000 })` in Dashboard, Flasher, and Utilities.

### 8. Bottom Panel (VS Code-style)

- `BottomPanel.tsx` — Container with vertical resize, tab bar (Logs/Shell), action buttons
- `LogsPanel.tsx` — Filtered log viewer with search highlighting, auto-scroll detection
- `ShellPanel.tsx` — Interactive ADB/fastboot terminal (previously `ViewShell.tsx`)
- `logStore.ts` — Ring buffer (1000 max), ISO timestamps, filter/search/panel state, unread count
- `shellStore.ts` — Shell history + command history Zustand store
- 12 terminal CSS variables in `global.css` for light/dark theme support
- Keyboard shortcut: `Ctrl+\`` to toggle panel

### 9. UI Consistency Rules (Enforced)

| Rule | Pattern |
|------|---------|
| CardTitle icons | `className="h-5 w-5"` — never `size={N}` prop |
| Inline/list icons | `className="h-4 w-4 shrink-0"` |
| In-button icons | must include `shrink-0` |
| Form labels | always `<Label>` (shadcn), never raw `<label className="...">` |
| Destructive dialogs | `buttonVariants({ variant: 'destructive' })` on `AlertDialogAction` |
| Semantic colors | `text-success`, `bg-success` etc. — never `text-[var(--terminal-log-success)]` |
| Imports | `@/` alias for all internal imports |
| Clickable div lists | must have `role`, `aria-*`, `tabIndex`, `onKeyDown` |
| Checkbox UI | use shared `<CheckboxItem>` |
| Empty states | use shared `<EmptyState>` |
| Animations | use MainLayout's `motion.div` wrapper — do NOT add per-view `animate-in` classes |
| Links that open URL | `<button onClick={openLink}>` — never `<a href>` with `onClick` (double-open on Tauri) |

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
├── WelcomeScreen.tsx        # 750ms animated splash with Progress
├── ConnectedDevicesCard.tsx # Shared device list (Dashboard, Flasher, Utilities)
├── EditNicknameDialog.tsx   # Shared nickname edit dialog
├── CheckboxItem.tsx         # Shared checkbox indicator (AppManager, PayloadDumper)
├── EmptyState.tsx           # Shared empty-state component
├── CopyButton.tsx           # Shared copy-to-clipboard button
├── FileSelector.tsx         # Shared file/dir picker (label + button + path hint)
├── LoadingButton.tsx        # Shared button with loading spinner
├── SectionHeader.tsx        # Shared section sub-header (Utilities, PayloadDumper)
├── SelectionSummaryBar.tsx  # Shared selection count + clear bar (AppManager)
├── ui/                      # 20+ shadcn primitives (sidebar, sidebar-context, sheet, etc.)
└── views/                   # 7 views (Dashboard, AppManager, FileExplorer, Flasher,
                           #   Utilities, PayloadDumper, About)
```

## Known Architectural Notes

- `src-tauri/src/lib.rs` has been split into 8 focused files (helpers + 7 command modules)
- Device polling centralized via TanStack Query v5 (`useQuery` with `refetchInterval`)
- Shell is no longer a sidebar view — it lives in the bottom panel as a tab
- `cargo test` crashes on Windows due to pre-existing Tauri DLL issue (not a code bug)
