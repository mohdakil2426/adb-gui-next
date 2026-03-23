# Progress

## Overall Status

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.

## What Works

### Frontend

- App shell loads under Vite/React with Strict Mode enabled
- 7 sidebar views compile and build successfully
- VS Code-style bottom panel with Logs and Shell tabs
- Frontend calls native `src/lib/desktop/` Tauri abstraction
- Zustand v5 state management (device, log, shell, payloadDumper)
- shadcn/ui components (18 primitives: badge, progress, dialog, separator, skeleton + 13 existing) with Tailwind CSS v4
- Light/dark/system theme support via next-themes
- Toast notifications via sonner
- Framer Motion animations
- Terminal panel with filter dropdown, search highlighting, auto-scroll toggle, maximize/minimize
- App Manager: virtualized package list (TanStack Virtual), user/system filter, type Badge, accessible Input search
- Shared components: `LoadingButton`, `SectionHeader`, `FileSelector`, `SelectionSummaryBar`
- `getFileName()` utility in `utils.ts`
- `models.ts` DTOs migrated from Wails-2 classes to plain TypeScript interfaces

### Backend (26 Tauri Commands)

| Category | Commands |
|----------|----------|
| Device | `get_devices`, `get_device_info`, `get_device_mode`, `get_fastboot_devices` |
| ADB | `run_adb_host_command`, `run_shell_command`, `connect_wireless_adb`, `disconnect_wireless_adb`, `enable_wireless_adb` |
| Fastboot | `flash_partition`, `reboot`, `wipe_data`, `set_active_slot`, `get_bootloader_variables`, `run_fastboot_host_command` |
| Files | `list_files`, `push_file`, `pull_file` |
| Apps | `install_package`, `uninstall_package`, `sideload_package`, `get_installed_packages` |
| System | `open_folder`, `launch_terminal`, `save_log`, `launch_device_manager` |
| Payload | `extract_payload`, `list_payload_partitions`, `list_payload_partitions_with_details`, `cleanup_payload_cache` |

### Payload Dumper

- Lists partitions from payload files (plain `.bin` or OTA `.zip`)
- ZIP extraction streams to `NamedTempFile` — no 4–6 GB RAM spike
- Payload loaded via `Arc<memmap2::Mmap>` — no per-thread heap clone
- Streaming decompression: 256 KiB stack buffer (XZ, BZ2, Zstd, Replace)
- Output files pre-allocated with `set_len`; Zero ops do sparse seeks
- Real-time per-operation `payload:progress` Tauri events from inside threads
- SHA-256 operation checksum verification
- Cleans up cached temp files on demand

### Packaging

- Windows debug MSI and NSIS bundles build successfully
- Platform-specific resource bundling configured
- Payload protobuf compilation uses local `src-tauri/` source file

### Tooling & Quality

- React Strict Mode enabled
- TypeScript strict mode enabled
- ESLint 10 flat config active for web app
- Prettier 3.8.1 active for web app
- cargo fmt (Rust edition 2024) active
- cargo clippy with `-D warnings` (strict) active
- `pnpm check` runs full verification workflow
- 21 JS/TS tests + 8 Rust tests passing
- `tauri-plugin-log` for structured logging (Stdout + LogDir + Webview)
- `errorHandler.ts` for centralized frontend error handling
- `debug.ts` for debug logging and performance timing

## Rust Code Structure (Refactored)

```
src-tauri/src/
├── lib.rs (52 lines) — thin orchestrator
├── helpers.rs — shared utilities (binary resolution, command execution, device info)
├── commands/
│   ├── mod.rs — re-exports
│   ├── device.rs — get_devices, get_device_info, get_device_mode, get_fastboot_devices
│   ├── adb.rs — wireless ADB, run_adb_host_command, run_shell_command
│   ├── fastboot.rs — flash_partition, reboot, wipe_data, set_active_slot
│   ├── files.rs — list_files, push_file, pull_file
│   ├── apps.rs — install_package, uninstall_package, sideload_package
│   ├── system.rs — greet, open_folder, save_log, launch_terminal
│   └── payload.rs — payload command wrappers
└── payload/
    ├── mod.rs — re-exports + chromeos_update_engine protobuf
    ├── parser.rs — CrAU header parsing, protobuf decoding
    ├── extractor.rs — partition extraction with SHA-256 verification
    ├── zip.rs — ZIP payload handling and caching
    └── tests.rs — 5 payload tests
```

## Documentation

- `docs/rust-audit-report.md` — Code quality audit (scores: 6.6→7.7)
- `docs/rust-performance-research.md` — Performance optimization research (KISS-ordered)

## Performance Optimizations (Implemented)

- ✅ Sparse zero handling: `Type::Zero` returns empty vec, seeks past region (instant vs minutes)
- ✅ Position tracking: skips redundant seeks when already at target position
- ✅ Block size from manifest: reads `block_size` field instead of hardcoding 4096
- ✅ Async Tauri commands: `extract_payload` and `cleanup_payload_cache` run on Tokio runtime
- ✅ Parallel partition extraction: `std::thread::scope` for concurrent extraction (4-8x faster)

## Remaining Work

| Priority | Task | Notes |
|----------|------|-------|
| Medium | Add tests for bottom panel components | logStore, shellStore, BottomPanel, LogsPanel |
| Low | Virtual list for log entries | react-window for 1000+ entries performance |
| Low | Extend RHF to ViewFlasher | partition/file form |
| Low | Run device-backed parity tests | Need real Android devices |

## Risks / Known Issues

- Large frontend bundle chunk warning during build (589KB JS)
- Bottom panel Shell tab needs manual verification with `pnpm tauri dev`

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-23 | 0.1.0 | Comprehensive codebase quality: dead code removal, P0 reactivity fix, shadcn adoption (badge/progress/dialog/separator/skeleton), shared components, semantic token fixes, models.ts interface migration |
| 2026-03-23 | 0.1.0 | App Manager: virtualized list + user/system package filter |
| 2026-03-23 | 0.1.0 | VS Code-style bottom panel overhaul (BottomPanel, LogsPanel, ShellPanel, logStore, shellStore) |
| 2026-03-22 | 0.1.0 | Payload dumper overhaul, dependency integration, debugging infrastructure |
| 2026-03-22 | 0.1.0 | Dialog permission fix, Rust code refactoring, audit & performance research |
| 2026-03-22 | 0.1.0 | Rust edition 2024, all clippy warnings fixed, dependencies verified |
