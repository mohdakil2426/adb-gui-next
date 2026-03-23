# System Patterns

## Architecture Overview

The app uses a Tauri 2 desktop architecture with React 19 frontend and Rust backend.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + TypeScript + Vite)             │
│  main.tsx → App.tsx → MainLayout (sidebar + views + bottom panel)      │
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
- `backend.ts` — All `invoke<T>()` wrappers (252 lines)
- `runtime.ts` — Event listeners, file drop, URL opener (139 lines)
- `models.ts` — DTO classes matching Rust structs (121 lines)

### 2. State Management

- **Zustand v5** for shared state (device, log, shell, payloadDumper)
- **localStorage** for nickname persistence (no reactivity)
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
- `tokio::task::block_in_place` wraps sync extraction to prevent Tokio thread starvation
- `BufWriter` (1 MB) on output files reduces syscall overhead
- `file.set_len(partition_size)` pre-allocates output; `Type::Zero` ops seek (no write)
- `Option<AppHandle>` — tests pass `None`; production passes `Some(app)` for live events

### 5. Error Handling

- **Frontend**: Centralized via `errorHandler.ts` → `handleError()` (toast + log + tauri log)
- **Rust**: `CmdResult<T> = Result<T, String>` — all commands return this
- **Structured Logging**: `tauri-plugin-log` with Stdout + LogDir + Webview targets
- **Debug Mode**: `debug.ts` provides `debugLog()` and `timedOperation()` utilities

### 6. View Switching

No router. Manual view switching via:
```tsx
const [activeView, setActiveView] = useState<ViewType>('dashboard');
// switch (activeView) { case 'dashboard': return <ViewDashboard />; ... }
```

### 7. Device Polling

Migrated to **TanStack Query v5** — `useQuery({ refetchInterval: 3000 })` in Dashboard, Flasher, and Utilities. Replaced ~220 lines of manual `setInterval` + `useEffect` code.

### 8. Bottom Panel (VS Code-style)

VS Code-style bottom panel replaces the old right-side drawer log panel:
- `BottomPanel.tsx` — Container with vertical resize, tab bar (Logs/Shell), action buttons
- `LogsPanel.tsx` — Filtered log viewer with search highlighting, auto-scroll detection
- `ShellPanel.tsx` — Interactive ADB/fastboot terminal (previously `ViewShell.tsx`)
- `logStore.ts` — Ring buffer (1000 max), ISO timestamps, filter/search/panel state, unread count
- `shellStore.ts` — Shell history + command history Zustand store
- 12 terminal CSS variables in `global.css` for light/dark theme support
- Keyboard shortcut: `Ctrl+\`` to toggle panel

## Component Architecture

```text
src/components/
├── MainLayout.tsx           # App shell: sidebar nav, view switch, bottom panel
├── BottomPanel.tsx          # VS Code-style bottom panel (tabs, resize, actions)
├── LogsPanel.tsx            # Filtered log viewer with search highlight
├── ShellPanel.tsx           # Interactive ADB/fastboot terminal
├── ConnectedDevicesCard.tsx # Shared device list (Dashboard, Flasher, Utilities)
├── WelcomeScreen.tsx        # 750ms animated splash
├── ui/                      # 13 shadcn primitives (button, card, table, tabs, dropdown-menu, etc.)
└── views/                   # 7 views (Dashboard, AppManager, FileExplorer, Flasher,
                           #   Utilities, PayloadDumper, About)
```

## Known Architectural Notes

- `src-tauri/src/lib.rs` has been split into 8 focused files (helpers + 7 command modules)
- Device polling centralized via TanStack Query v5 (`useQuery` with `refetchInterval`)
- Vitest + React Testing Library configured — 21 JS/TS tests pass
- 5 Rust payload tests; `cargo test` crashes on Windows due to pre-existing Tauri DLL issue (not a code bug)
- Shell is no longer a sidebar view — it lives in the bottom panel as a tab
