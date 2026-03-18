# ADB GUI Next Project Summary

## Overview

ADB GUI Next is a root-level Tauri 2 desktop application that preserves the legacy reference implementation under `docs/adb-gui-kit/refernces/` as permanent in-repo documentation. The app uses a React frontend, a Rust backend, and bundled Android platform tools for Windows and Linux.

The repository now contains:

- a root Vite + React 19 frontend
- a `src-tauri/` Rust backend using Tauri 2
- a native frontend desktop layer under `src/lib/desktop/`
- preserved legacy reference source and docs under `docs/adb-gui-kit/refernces/`

## What Was Implemented

### Application foundation

- Scaffolded the root project from the Tauri 2 React TypeScript template.
- Kept `docs/` and the historical plan archive intact.
- Copied the legacy frontend into the root `src/` tree with minimal structural change.
- Replaced the Astro host with a Vite React host while preserving the existing app shell and manual view-switching architecture.

### Native frontend desktop layer

- Added `src/lib/desktop/backend.ts` as the frontend command layer over Tauri `invoke()`.
- Added `src/lib/desktop/runtime.ts` for browser open, events, and drag/drop helpers.
- Added `src/lib/desktop/models.ts` for shared frontend DTO types.
- Rewired the copied frontend away from `wailsjs/*` imports completely.
- Deleted the old `wailsjs/` compatibility folder.

### Rust backend

- Added a Tauri Rust backend in `src-tauri/src/lib.rs`.
- Implemented command execution for:
  - ADB host commands
  - ADB shell commands
  - fastboot host commands
  - reboot and mode-specific reboot flows
  - package install and uninstall
  - `.apks` extraction and `adb install-multiple`
  - file list, push, and pull
  - wireless ADB enable, connect, and disconnect
  - device info and mode detection
  - log saving and folder opening
- Added bundled Android binaries under `src-tauri/resources/windows/` and `src-tauri/resources/linux/`.

### Payload dumper

- Ported payload parsing and extraction into `src-tauri/src/payload.rs`.
- Added protobuf compilation in `src-tauri/build.rs` using `prost-build`.
- Implemented:
  - payload header parsing
  - manifest decoding
  - partition listing with sizes
  - ZIP-backed `payload.bin` extraction and caching
  - selected partition extraction
  - multi-extent destination writing
  - `ZERO`, `REPLACE`, `REPLACE_XZ`, `REPLACE_BZ`, and `ZSTD` operation handling
  - progress event emission through Tauri
  - payload operation checksum verification
  - payload cache cleanup on command and app exit

### Packaging

- Configured Tauri bundle resources.
- Split resource bundling by platform using:
  - `src-tauri/tauri.windows.conf.json`
  - `src-tauri/tauri.linux.conf.json`
- Verified Windows debug MSI and NSIS bundle output from the merged main branch.

## Verification Performed

The current `main` branch was verified with:

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm build`
- `pnpm tauri build --debug`

The current Rust payload tests cover:

- partition listing from `payload.bin`
- selected partition extraction
- ZIP-backed payload cache cleanup
- multi-extent extraction and `ZERO` operation handling
- checksum mismatch rejection

## What Remains / Known Gaps

### High-value remaining work

- Broader parity testing across all views with real devices:
  - Dashboard
  - App Manager
  - File Explorer
  - Flasher
  - Utilities
  - Shell
- The Rust backend still contains placeholder dialog commands that return empty values. They are not currently used by the frontend because the new `src/lib/desktop/backend.ts` layer handles dialog selection directly, but they remain misleading dead surface area.

### Medium-value improvements

- Add tests for compressed payload extraction paths beyond the currently covered cases.
- Consider splitting `src-tauri/src/lib.rs` into smaller modules for commands, services, and models.
- Add startup diagnostics for bundled binary availability.
- Consider reducing the large frontend output chunk size through code splitting.

### Current warnings

- Generated protobuf types include dead-code warnings for unused message types like `Signatures` and `ApexMetadata`.
- The repo currently has an unrelated local `.gitignore` modification in the working tree.

## Important Preservation Rules

- Do not delete or overwrite `docs/adb-gui-kit/refernces/`.
- Do not delete or overwrite the historical plan archive at `TAURI_MIGRATION_PLAN.md`.
- Treat the legacy reference app as documentation and comparison material, not as active app code.

## Key Paths

- Root frontend: `src/`
- Tauri backend: `src-tauri/`
- Frontend desktop layer: `src/lib/desktop/`
- Build plan archive: `docs/superpowers/plans/2026-03-18-tauri-migration.md`
- Legacy reference app: `docs/adb-gui-kit/refernces/`
