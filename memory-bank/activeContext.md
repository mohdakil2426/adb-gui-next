# Active Context

## Current State

The Tauri migration branch has been merged into `main`, and the worktree-based migration implementation is now the main project codebase.

## Recently Completed

- Root-level Tauri 2 app scaffold
- Legacy frontend copied into the root app
- Native frontend desktop layer added under `src/lib/desktop/`
- Rust backend foundation and command surface added
- Payload dumper ported to Rust
- Payload ZIP caching, progress events, and checksum verification added
- Platform-specific Tauri resource configs added for Windows and Linux
- Remaining `wailsjs/` imports removed and the `wailsjs/` folder deleted
- Main-branch verification run after merge

## Current Verification Evidence

Verified on `main` with:

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm build`
- `pnpm tauri build --debug`

## Immediate Follow-up Candidates

- Remove or implement placeholder Rust dialog commands
- Run broader device-backed parity tests for the main views
- Split `src-tauri/src/lib.rs` into smaller modules

## Important Notes

- Preserve `docs/adb-gui-kit/refernces/` permanently
- Preserve `TAURI_MIGRATION_PLAN.md`
- `.mcp.json` currently shows as deleted in the working tree and was not modified during merge finalization
