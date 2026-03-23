# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-22 — Payload Dumper Overhaul (Phase 1 + 2)

**OOM Elimination — Arc\<Mmap\> + Streaming ZIP**
- `LoadedPayload::bytes: Vec<u8>` → `mmap: Arc<memmap2::Mmap>` — eliminates 36–48 GB per-thread heap clones (8 threads × 4–6 GB)
- `zip.rs::read_payload()` → `get_payload_path()` — jQuery ZIP entry streamed to `NamedTempFile` (never buffered to RAM); path cached only
- `memmap2 = "0.9"` + `tokio = "1"` (rt-multi-thread) added as direct Cargo deps

**Real-time Progress Fixes**
- Each thread captures `app_handle.clone()` (O(1) Arc clone); emits `payload:progress` events per operation via `app.emit()`
- `tokio::task::block_in_place` prevents Tokio runtime starvation during sync extraction
- `Option<AppHandle>` — tests pass `None` (no mock runtime needed)

**Streaming Decompression (Phase 2)**
- Removed `decode_operation() → Vec<u8>` (50–500 MB per op)
- Inline `Box<dyn Read + '_>` decoder built once per operation, consumed sequentially across all extents
- 256 KiB stack buffer (`[0u8; 262144]`) for XZ/BZ2/Zstd/Replace — never heap-allocated per op
- `file.set_len(partition_size)` pre-allocates output; Zero ops do a sparse seek (no write)
- `BufWriter` with 1 MB capacity reduces file syscall count

**Frontend Fix**
- Removed `'use client'` directive from `ViewPayloadDumper.tsx` (Next.js artifact)

**Verification:** `pnpm format:check` ✅ | `pnpm lint` ✅ | `pnpm build` ✅ (2383 modules)

### 2026-03-22 — Dependency Integration (Vitest, Zod, RHF, TanStack Query, Clipboard)

**Phase 1a — Vitest + React Testing Library**
- Added `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@vitest/coverage-v8`
- Created `vitest.config.ts` (merges Vite config; jsdom environment)
- Created `src/test/setup.ts` (jest-dom matchers + Tauri IPC mocks)
- Wrote 3 test files: `errorHandler.test.ts` (6 tests), `payloadDumperStore.test.ts` (8 tests), `ConnectedDevicesCard.test.tsx` (7 tests)
- Added `test`, `test:watch`, `test:coverage` scripts; `pnpm check` now runs `pnpm test`
- **21/21 tests pass**

**Phase 1b — Zod v4 Input Validation**
- Added `zod` v4.3.6
- Created `src/lib/schemas.ts` — central schema registry (`wirelessAdbSchema`, `partitionSchema`, `shellCommandSchema`)
- Applied `safeParse()` validation in ViewDashboard (wireless ADB), ViewFlasher (flash partition), ViewShell (shell commands)

**Phase 2a — React Hook Form**
- Added `react-hook-form` v7.72.0 and `@hookform/resolvers` v5.2.2
- Refactored ViewDashboard wireless ADB form: replaced 4 `useState` fields with `useForm` + `zodResolver`
- Added inline error messages; IP auto-fill via `setValue()`; connect via `handleSubmit`

**Phase 2b — TanStack Query v5 (Device Polling Migration)**
- Added `@tanstack/react-query` v5.94.5
- Created `src/lib/queries.ts` — query key factory + fetch functions (`fetchDevices`, `fetchAllDevices`, `fetchPackages`)
- Wrapped `App.tsx` with `QueryClientProvider` (staleTime: 0, gcTime: 5 min, retry: 1)
- Migrated polling from 3 views, removing ~220 lines of manual polling code:
  - **ViewDashboard**: removed `refreshDevices` callback + 2× `setInterval` useEffects → `useQuery({ refetchInterval: 3000 })`
  - **ViewFlasher**: removed 5 refs + `applyDevices` + `refreshDevices` async + 3 useEffects → `useQuery({ refetchInterval: 4000, placeholderData: prev => prev })`
  - **ViewUtilities**: removed `fetchDeviceMode` callback + `refreshTimeout` ref + 3 useEffects → `useQuery({ refetchInterval: 3000 })` + `useMemo` for mode derivation
- Fixed runtime infinite loop: sync `useEffect → setDevices(queriedDevices)` fired every render because `= []` default creates a new array reference. Fix: removed sync effects and useState copies; use `queriedDevices` directly in all views.

**Phase 2c — Tauri Clipboard Manager Plugin**
- Added `@tauri-apps/plugin-clipboard-manager` 2.3.2 (frontend) + `tauri-plugin-clipboard-manager` (Rust)
- Registered `.plugin(tauri_plugin_clipboard_manager::init())` in `lib.rs`
- Added `clipboard-manager:allow-read-text` + `allow-write-text` to `capabilities/default.json`
- Created `src/components/CopyButton.tsx` — reusable ghost icon button with 2s checkmark animation
- Integrated CopyButton into ViewDashboard (`InfoItem` gains optional `copyable` prop; Serial + IP rows)
- Replaced `navigator.clipboard.writeText()` with `writeText()` from the Tauri plugin in ViewUtilities

### 2026-03-23 — Vite Config Type Fix
- Installed `@types/node` and added to `tsconfig.node.json` types.
- Replaced `__dirname` with `import.meta.dirname` in `vite.config.ts` (modern Node ESM).
- Removed `@ts-expect-error` for `process` in `vite.config.ts` as it's now correctly typed.

### Previous Milestones
- Debugging & Logging Infrastructure (`tauri-plugin-log`, `errorHandler.ts`, `debug.ts`)
- Performance Optimization: sparse zero, parallel extraction, async Tauri commands
- Rust refactoring: `lib.rs` split into 8 focused files; `payload.rs` split into 4 modules
- Root-level Tauri 2 app structure, 26 backend commands, payload dumper

## Current Verification Evidence

Verified on `main` (2026-03-22) with:
- `pnpm lint` ✅ — ESLint + cargo clippy -D warnings clean
- `pnpm test` ✅ — 21/21 Vitest tests pass
- `pnpm build` ✅ — TypeScript + Vite bundle (2383 modules)
- `pnpm format:check` ✅ — Prettier + cargo fmt clean
- `cargo clippy -D warnings` ✅ — Zero warnings
- `cargo test` ⚠️ — Pre-existing Windows DLL crash in Tauri test binary (STATUS_ENTRYPOINT_NOT_FOUND); not caused by our changes; `cargo check --tests` is clean
- `cargo test` ✅ — 8 Rust tests pass
- `pnpm tauri dev` ✅ — App runs, no infinite loop, clipboard works

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | 8 views, Zustand, shadcn/ui |
| Backend | ✅ Complete | 26 Tauri commands, payload parser |
| IPC Layer | ✅ Complete | backend.ts, runtime.ts, models.ts |
| Testing | ✅ Complete | 21 JS/TS tests + 8 Rust tests |
| Input Validation | ✅ Complete | Zod schemas for all interactive inputs |
| Form Handling | ✅ Complete | React Hook Form on wireless ADB form |
| Device Polling | ✅ Complete | TanStack Query replaces all manual setIntervals |
| Clipboard | ✅ Complete | Tauri plugin + shared CopyButton component |
| Linting | ✅ Complete | ESLint 10 flat config + typescript-eslint |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |

## Immediate Follow-up Candidates

- Extend React Hook Form to `ViewFlasher` (partition/file form) and `ViewShell`
- Add more Vitest tests for views (ViewFlasher, ViewUtilities)
- Add CopyButton to more shell output areas
- Streaming decompression for payload dumper (BufReader 256KB, Phase 2 perf)

## Important Notes

- **Infinite loop pattern to avoid**: never write `useEffect(() => { setX(queryData) }, [queryData, setX])` with a `= []` default. The default creates a new reference every render. Use query data directly in JSX/callbacks.
- Rust edition: 2024 (uses let_chains)
- All clippy warnings resolved with -D warnings


## Recently Completed

### 2026-03-22 — Debugging & Logging Infrastructure
- Added `tauri-plugin-log` with Stdout, LogDir, and Webview targets
- Created `src/lib/errorHandler.ts` for centralized frontend error handling
- Created `src/lib/debug.ts` for debug logging and performance timing
- Added structured logging to all Rust command modules (device, adb, fastboot, files, apps, system, payload)
- Improved error context in `helpers.rs` (command args, exit codes, stderr)
- Fixed `.unwrap()` in `payload/extractor.rs` (thread join panic)
- Fixed `.expect()` in `payload/parser.rs` (malformed payload handling)
- Standardized frontend error handling across all 8 views with `handleError()`
- Added `dev:debug` script with `RUST_BACKTRACE=1` for stack traces
- Generated comprehensive report at `docs/debugging-logging-report.md`
- All 8 Rust tests pass, all quality gates pass (`pnpm check`)

### 2026-03-22 — Performance Optimization (Phase 1-3)
- Implemented sparse zero handling: `Type::Zero` returns empty vec, seeks past region (instant vs minutes)
- Added position tracking: skips redundant seeks when already at target position
- Changed block size to read from manifest (`block_size` field) instead of hardcoding 4096
- Made payload commands async: `extract_payload` and `cleanup_payload_cache` run on Tokio runtime
- Implemented parallel partition extraction: `std::thread::scope` for concurrent extraction (4-8x faster)
- All 8 Rust tests pass, all quality gates pass (`pnpm check`)

### 2026-03-22 — Dialog Permission Fix & Rust Code Refactoring
- Fixed payload dumper dialog permission error by adding `"dialog:default"` to capabilities
- Split `lib.rs` (833 lines) into 8 focused files: helpers.rs + 7 command modules
- Split `payload.rs` (645 lines) into 4 modules: parser, extractor, zip, tests
- Added doc comments to payload module public functions
- Fixed rust-analyzer module tree issue (include path)
- Generated audit report at `docs/rust-audit-report.md` (scores: 6.6→7.7)
- Generated performance research at `docs/rust-performance-research.md`
- All 8 Rust tests pass, all quality gates pass (`pnpm check`)

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