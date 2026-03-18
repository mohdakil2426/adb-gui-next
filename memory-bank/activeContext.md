# Active Context

## Current State

ADB GUI Next now lives directly on `main` as the active product codebase.

## Recently Completed

- Root-level Tauri 2 app structure is in place
- Frontend runs through the native desktop layer under `src/lib/desktop/`
- Rust backend command surface is active
- Payload dumper runs natively in Rust
- Platform-specific Tauri resource configs are in place for Windows and Linux
- Pure-Tauri frontend wiring is complete with `wailsjs/` removed
- Project-wide linting, formatting, and quality scripts are now configured
- Repo-managed git hooks have been removed from the current workflow
- Unused placeholder Rust dialog commands have been removed from `src-tauri/src/lib.rs`
- Host command parsing now preserves quoted arguments for ADB and fastboot commands
- Tauri build and runtime no longer depend on the legacy archive; payload protobuf input now lives under `src-tauri/`
- Main-branch verification has passed

## Current Verification Evidence

Verified on `main` with:

- `pnpm check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm build`
- `pnpm tauri build --debug`

## Immediate Follow-up Candidates

- Run broader device-backed parity tests for the main views
- Split `src-tauri/src/lib.rs` into smaller modules
- Work down the remaining ESLint warnings in the copied frontend

## Important Notes

- Preserve the legacy archive permanently as offline reference material only
- Preserve the historical plan archive at `TAURI_MIGRATION_PLAN.md`
- `.mcp.json` currently shows as deleted in the working tree and was not modified during merge finalization
