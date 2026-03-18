# ADB GUI Next: Tauri Migration Summary

## Overview

ADB GUI Next is now a root-level Tauri 2 desktop application that preserves the legacy Wails implementation under `docs/adb-gui-kit/refernces/` as a permanent in-repo reference. The migration kept the legacy React UI structure, replaced the Wails runtime/backend bridge with Tauri-compatible shims and Rust commands, and bundled the required Android platform tools for Windows and Linux.

The repository now contains:

- a root Vite + React 19 frontend
- a `src-tauri/` Rust backend using Tauri 2
- a `wailsjs/` compatibility layer to preserve most legacy frontend call sites
- preserved legacy reference source and docs under `docs/adb-gui-kit/refernces/`

## What Was Implemented

### Application foundation

- Scaffolded the root project from the Tauri 2 React TypeScript template.
- Kept `docs/` and `TAURI_MIGRATION_PLAN.md` intact during migration.
- Copied the legacy frontend into the root `src/` tree with minimal structural change.
- Replaced the Astro host with a Vite React host while preserving the existing app shell and manual view-switching architecture.

### Compatibility layer

- Added `wailsjs/go/backend/App.ts` as a Tauri-backed compatibility wrapper.
- Added `wailsjs/runtime/runtime.ts` for the runtime subset actually used by the copied frontend.
- Preserved existing frontend imports for most view files instead of rewriting feature code broadly.
- Routed file/folder selection to `@tauri-apps/plugin-dialog` from the compatibility layer.

### Rust backend migration

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

The merged result on `main` was verified with:

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
- The Rust backend still contains placeholder dialog commands that return empty values. They are not currently used by the copied frontend because the JS compatibility layer handles dialog selection directly, but they remain misleading dead surface area.
- `wailsjs/runtime/runtime.d.ts` still exposes a much larger Wails runtime surface than is actually implemented in `wailsjs/runtime/runtime.ts`.

### Medium-value improvements

- Add tests for compressed payload extraction paths beyond the currently covered cases.
- Consider splitting `src-tauri/src/lib.rs` into smaller modules for commands, services, and models.
- Add startup diagnostics for bundled binary availability.
- Consider reducing the large frontend output chunk size through code splitting.

### Current warnings

- Generated protobuf types include dead-code warnings for unused message types like `Signatures` and `ApexMetadata`.
- The repo currently has an unstaged deletion of `.mcp.json` on `main` that pre-existed merge finalization and was intentionally left untouched.

## Important Preservation Rules

- Do not delete or overwrite `docs/adb-gui-kit/refernces/`.
- Do not delete or overwrite `TAURI_MIGRATION_PLAN.md`.
- Treat the legacy reference app as documentation and comparison material, not as disposable migration scaffolding.

## Key Paths

- Root frontend: `src/`
- Tauri backend: `src-tauri/`
- Compatibility layer: `wailsjs/`
- Migration plan: `docs/superpowers/plans/2026-03-18-tauri-migration.md`
- Legacy reference app: `docs/adb-gui-kit/refernces/`

