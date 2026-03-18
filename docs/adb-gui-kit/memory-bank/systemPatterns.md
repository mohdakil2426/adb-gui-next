# System Patterns

## Architecture Overview
ADBKit Enhanced uses a Wails desktop architecture.

- **Backend:** Go services execute ADB/Fastboot commands, interact with the filesystem and OS, manage payload extraction, and expose exported methods through Wails.
- **Frontend:** Astro hosts a React application shell. React renders the UI, calls Wails-generated bindings, manages local and global client state, and displays feedback through toasts and logs.
- **Bridge:** Wails bindings provide direct frontend-to-backend calls without a REST API.

## High-Level Structure
```text
/
├── backend/              # Go backend and platform-specific helpers
├── frontend/             # Astro/React UI
│   ├── src/components/   # App shell, shared UI, major views
│   ├── src/lib/          # Zustand stores and helpers
│   ├── src/styles/       # Global Tailwind/theme styles
│   └── wailsjs/          # Generated Wails bindings/runtime
├── build/                # Wails build assets and platform packaging files
├── docs/                 # Project documentation
├── memory-bank/          # Persistent project context files
├── screenshots/          # UI screenshots for docs/marketing
├── main.go               # Wails entrypoint
└── wails.json            # Build/runtime configuration
```

## Backend Patterns

### 1. Single Wails App Root
`backend/app.go` defines the root `App` bound to Wails.

Responsibilities:
- store runtime context
- own long-lived services like `PayloadService`
- expose exported methods consumed by the frontend
- handle startup/shutdown lifecycle
- provide shared desktop actions like saving logs and opening folders

### 2. Context-Aware Command Execution
`backend/executor.go` centralizes command execution.

Patterns:
- resolve binary path before every execution
- use `exec.CommandContext`
- apply a default timeout if no context exists
- combine stdout and stderr because fastboot often writes useful output to stderr
- wrap errors with operation context

### 3. Embedded Binary Extraction
Platform binaries are embedded via `embed_windows.go` and `embed_linux.go` and extracted to temp on demand. Extraction is guarded by `sync.Once`.

Notes:
- Windows path resolution uses extracted embedded binaries first.
- Linux packaging includes embedded binaries, but current runtime resolution primarily depends on PATH lookup.

### 4. Sentinel Errors + Constants
Shared error and constant definitions are centralized.

Files:
- `backend/errors.go`
- `backend/constants.go`

Benefits:
- better consistency
- easier error classification
- fewer magic strings

### 5. Service Interfaces for Testability
`backend/interfaces.go` defines capability interfaces for ADB, Fastboot, payload extraction, and dialogs, with compile-time interface assertions.

### 6. Platform-Specific Files
Platform-specific behavior is isolated using build tags.

Examples:
- `embed_windows.go`, `embed_linux.go`
- `exec_windows.go`, `exec_other.go`
- `terminal_windows.go`, `terminal_other.go`
- `device_manager_windows.go`, `device_manager_other.go`
- `unsupported_platform.go`

## Backend Feature Areas

### ADB Service
`backend/adb_service.go`

Patterns:
- one exported method per user action or workflow
- parse raw ADB output into structured models
- use helper methods for repeated property lookups
- support both high-level workflows and direct command execution

Key responsibilities:
- connected devices
- device info aggregation
- reboot/mode detection
- wireless ADB
- install/uninstall apps
- list/push/pull files
- sideload packages
- raw adb/adb shell command execution

### Fastboot Service
`backend/fastboot_service.go`

Responsibilities:
- list fastboot devices
- flash partitions
- wipe data
- set active slot
- get bootloader variables
- run fastboot commands

### Payload Service
`backend/payload_service.go`

Patterns:
- wrapper service around core payload extraction package
- ZIP-aware payload handling with cache for extracted `payload.bin`
- emit progress to frontend through Wails runtime events
- return stable result objects instead of exposing internal implementation

### Payload Extraction Engine
`backend/payload/`

Patterns:
- dedicated subsystem instead of shelling out to an external tool
- manifest-driven extraction
- concurrent worker-based processing
- progress callback support
- support for OTA operation formats like XZ/BZ/ZSTD/zero-fill style flows

## Frontend Patterns

### 1. Single App Shell with Manual View Switching
`frontend/src/components/MainLayout.tsx`

Pattern:
- one layout component owns navigation, active view, theme chrome, global toasts, and shell history
- no router-based navigation; views are switched by local `activeView` state

### 2. View-Based Feature Modules
Major features live in `frontend/src/components/views/`.

Each view:
- owns its feature-specific UI
- calls Wails bindings directly
- manages loading and error state locally
- writes user-visible events to the global log store when useful

### 3. Lightweight Global State with Zustand
Stores in `frontend/src/lib/` are used for cross-view or persistent UI state.

Current stores:
- `logStore.ts` for global logs panel state and entries
- `deviceStore.ts` for connected device/device info persistence across views
- `payloadDumperStore.ts` for payload extraction state and progress

Nicknames are persisted separately in `nicknameStore.ts` via `localStorage`.

### 4. Wails Runtime Events for Long-Running Feedback
Real-time payload extraction progress is pushed from backend to frontend through `payload:progress` events.

Pattern:
- backend emits structured progress payloads
- frontend subscribes and updates Zustand store
- UI renders per-partition progress bars and completion state

### 5. Global Operational Logs
Pattern:
- views manually append user-facing logs to `logStore`
- `TerminalLogPanel` renders them globally
- users can copy or save logs via backend `SaveLog`

This is an observer/store pattern rather than a true backend log stream.

### 6. Theme and Design Tokens
`frontend/src/styles/global.css` defines semantic design tokens and layout constants.

Patterns:
- Tailwind CSS 4 with semantic CSS variables
- OKLCH color tokens
- dark mode via `next-themes`
- consistent layout sizing via CSS custom properties

## UI Navigation Map
Main views in current shell:
- Dashboard
- Application / App Manager
- File
- Flasher
- Utility
- Payload Dumper
- Terminal
- About

## Notable Implementation Characteristics
- The frontend is optimized for practical desktop workflows, not web routing.
- The shell view is a command runner, not a real PTY terminal.
- The payload dumper is the most specialized subsystem in the project.
- Polling is used for device state in several views; implementation quality varies by view.
- Destructive actions are generally guarded by confirmation dialogs in the UI.

## Known Architectural Gaps
- Linux standalone packaging expectations are not perfectly aligned with current binary lookup behavior.
- Some docs/build assets still mention broader Wails defaults, even though project support is narrowed to Windows/Linux.
- There is no automated backend/frontend event model beyond targeted Wails events like payload progress.