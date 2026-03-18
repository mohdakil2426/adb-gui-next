# Progress

## Overall Status

ADB GUI Next is a working root-level Tauri 2 application on `main`.

## What Works

### Frontend

- App shell loads under Vite/React
- Copied views compile and build
- Frontend now calls a native `src/lib/desktop/` Tauri abstraction directly

### Backend

- Core ADB and fastboot command routing exists
- Wireless ADB flows are implemented
- Package install and uninstall flows are implemented
- File list, push, and pull commands are implemented
- Log saving and folder opening are implemented

### Payload Dumper

- Lists partitions from payload files
- Supports OTA ZIP input
- Extracts selected partitions
- Emits progress events
- Handles multi-extent writes
- Verifies operation checksums
- Cleans up cached payload files

### Packaging

- Windows debug MSI and NSIS bundles build successfully
- Platform-specific resource bundling is configured

### Tooling

- React Strict Mode is enabled
- TypeScript strict mode is enabled
- ESLint flat config is active for the web app
- Prettier is active for the web app
- `cargo fmt` and strict `cargo clippy` are active for Rust
- `pnpm check` runs the main verification workflow

## Remaining Work

- Broader end-to-end parity validation with real devices
- Cleanup of placeholder Rust dialog commands
- Potential backend modularization
- Additional payload tests for more compressed operation paths
- Gradual cleanup of remaining ESLint warnings in copied frontend files

## Risks / Known Issues

- `src-tauri/src/lib.rs` is large and should eventually be split
- Large frontend bundle chunk warning remains during build
