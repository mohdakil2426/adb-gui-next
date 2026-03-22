# System Patterns

## Architecture Overview

The app uses a Tauri 2 desktop architecture with React 19 frontend and Rust backend.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + TypeScript + Vite)             │
│  main.tsx → App.tsx → MainLayout (sidebar + view switch + log panel)   │
│  8 Views: Dashboard │ AppManager │ FileExplorer │ Flasher │             │
│           Utilities │ PayloadDumper │ Shell │ About                     │
│  Zustand Stores: deviceStore │ logStore │ payloadDumperStore            │
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

- **Zustand v5** for shared state (device, log, payloadDumper)
- **localStorage** for nickname persistence (no reactivity)
- **No router** — `useState<ViewType>` + switch statement in MainLayout

### 3. Binary Resolution

Three-tier fallback for ADB/fastboot binaries:
1. Tauri resource dir (`src-tauri/resources/{platform}/`)
2. Repo `resources/` directory
3. System PATH via `which`

### 4. Payload Extraction

`src-tauri/src/payload.rs` handles OTA payload.bin:
- CrAU header parsing
- Protobuf manifest decoding (prost)
- Per-operation decompress (XZ/BZ2/Zstd/Zero)
- SHA-256 checksum verification
- ZIP payload caching with temp directory

### 5. Error Handling

- **Frontend**: Every Tauri call wrapped in try/catch → `toast.error()` + `addLog()`
- **Rust**: `CmdResult<T> = Result<T, String>` — all commands return this

### 6. View Switching

No router. Manual view switching via:
```tsx
const [activeView, setActiveView] = useState<ViewType>('dashboard');
// switch (activeView) { case 'dashboard': return <ViewDashboard />; ... }
```

### 7. Device Polling

`setInterval` per view (3-4s) — duplicated in Dashboard, Flasher, Utilities

## Component Architecture

```text
src/components/
├── MainLayout.tsx           # App shell: sidebar nav, view switch, log panel
├── ConnectedDevicesCard.tsx # Shared device list (Dashboard, Flasher, Utilities)
├── TerminalLogPanel.tsx     # Resizable right drawer, timestamped logs
├── WelcomeScreen.tsx        # 750ms animated splash
├── ui/                      # 11 shadcn primitives (button, card, table, dialog, etc.)
└── views/                   # 8 views (Dashboard, AppManager, FileExplorer, Flasher,
                           #   Utilities, PayloadDumper, Shell, About)
```

## Known Architectural Notes

- `src-tauri/src/lib.rs` is 833 lines and should eventually be split into modules
- Device polling is duplicated across views (could be centralized)
- No JS/TS test framework configured (only 8 Rust tests)