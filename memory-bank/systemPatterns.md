# System Patterns

## Architecture Overview

The current app uses a Tauri desktop architecture.

- Frontend: React 19 + TypeScript + Vite
- Backend: Rust commands under `src-tauri/`
- Desktop bridge: Tauri 2 APIs
- Frontend desktop layer: `src/lib/desktop/`

## High-Level Structure

```text
/
├── src/                    # Copied and adapted frontend
├── src-tauri/              # Rust backend and Tauri config
├── src/lib/desktop/        # Frontend desktop command/runtime layer
├── docs/                   # Docs plus preserved legacy reference source
├── memory-bank/            # Current project memory bank
└── TAURI_MIGRATION_PLAN.md # Historical plan archive
```

## Key Patterns

### 1. Preserved frontend shell

The frontend shell was brought into the root `src/` tree with minimal behavioral changes. Host/runtime concerns are handled around it instead of rewriting the UI architecture.

### 2. Native desktop abstraction

`src/lib/desktop/backend.ts`, `src/lib/desktop/runtime.ts`, and `src/lib/desktop/models.ts` provide the frontend-facing Tauri abstraction for commands, runtime events, dialogs, and DTO types.

### 3. Manual view switching

The app still uses the legacy single-shell, no-router architecture centered around `MainLayout`.

### 4. Resource-bundled tool execution

Bundled Android binaries live under `src-tauri/resources/`. Rust resolves them from packaged resources first, then local dev resources, then system PATH.

### 5. Payload as dedicated subsystem

The payload extractor lives in `src-tauri/src/payload.rs` and handles manifest parsing, ZIP payload caching, extraction, progress reporting, and checksum verification.

## Known Architectural Gaps

- `src-tauri/src/lib.rs` is still too large and should eventually be split.
