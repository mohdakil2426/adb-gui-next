# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-22 — Dependency & Quality Audit
- Verified all frontend dependencies are at latest versions
- Verified all Rust dependencies are at current versions
- Updated Rust edition from 2021 to 2024
- Fixed all 11 clippy collapsible_if warnings using Rust 2024 let_chains
- Verified `pnpm check` passes (lint + format + tests + build)
- Updated all memory-bank files with accurate information

### Previous Milestones
- Root-level Tauri 2 app structure is in place
- Frontend runs through the native desktop layer under `src/lib/desktop/`
- Rust backend command surface is active (26 commands)
- Payload dumper runs natively in Rust with checksum verification
- Platform-specific Tauri resource configs for Windows and Linux
- Project-wide linting, formatting, and quality scripts configured

## Current Verification Evidence

Verified on `main` (2026-03-22) with:
- `pnpm check` ✅ — Full gate (lint + format + tests + build)
- `cargo clippy --all-targets -- -D warnings` ✅ — Zero warnings
- `cargo test --manifest-path src-tauri/Cargo.toml` ✅ — 8 tests passing
- `pnpm build` ✅ — TypeScript + Vite bundle successful

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | 8 views, Zustand stores, shadcn/ui |
| Backend | ✅ Complete | 26 Tauri commands, payload parser |
| IPC Layer | ✅ Complete | backend.ts, runtime.ts, models.ts |
| Linting | ✅ Complete | ESLint 10 flat config + typescript-eslint |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |
| Testing | ⚠️ Partial | 8 Rust tests, no JS/TS tests |
| Documentation | ✅ Complete | Memory bank updated |

## Immediate Follow-up Candidates

- Split `src-tauri/src/lib.rs` into smaller modules (currently 833 lines)
- Centralize device polling (currently duplicated across views)
- Add Vitest for React component testing
- Run broader device-backed parity tests for main views

## Important Notes

- Rust edition updated to 2024 (uses let_chains feature)
- All clippy warnings resolved with -D warnings
- Dependencies verified as up-to-date as of 2026-03-22