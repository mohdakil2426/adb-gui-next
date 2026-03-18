# System Patterns

## Architecture Overview

The current app uses a Tauri desktop architecture.

- Frontend: React 19 + TypeScript + Vite
- Backend: Rust commands under `src-tauri/`
- Desktop bridge: Tauri 2 APIs
- Compatibility layer: `wailsjs/` shims that preserve most legacy frontend imports

## High-Level Structure

```text
/
├── src/                    # Copied and adapted frontend
├── src-tauri/              # Rust backend and Tauri config
├── wailsjs/                # Compatibility layer for legacy frontend imports
├── docs/                   # Docs plus preserved legacy reference source
├── memory-bank/            # Current project memory bank
└── TAURI_MIGRATION_PLAN.md # Top-level migration plan
```

## Key Patterns

### 1. Copy-first frontend migration

The frontend was copied from the legacy app into the root `src/` tree with minimal behavioral changes. Host/runtime concerns were handled around it instead of rewriting the UI architecture.

### 2. Compatibility-first bridge strategy

`wailsjs/go/backend/App.ts` and `wailsjs/runtime/runtime.ts` provide a compatibility layer so copied views can continue calling familiar APIs.

### 3. Manual view switching

The app still uses the legacy single-shell, no-router architecture centered around `MainLayout`.

### 4. Resource-bundled tool execution

Bundled Android binaries live under `src-tauri/resources/`. Rust resolves them from packaged resources first, then local dev resources, then legacy references, then system PATH.

### 5. Payload as dedicated subsystem

The payload extractor lives in `src-tauri/src/payload.rs` and handles manifest parsing, ZIP payload caching, extraction, progress reporting, and checksum verification.

## Known Architectural Gaps

- `src-tauri/src/lib.rs` is still too large and should eventually be split.
- Some placeholder Rust dialog commands remain registered but unused.
- The runtime type definitions advertise more API than the implementation actually supports.

