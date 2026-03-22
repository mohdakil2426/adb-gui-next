# Progress

## Overall Status

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.

## What Works

### Frontend

- App shell loads under Vite/React with Strict Mode enabled
- 8 feature views compile and build successfully
- Frontend calls native `src/lib/desktop/` Tauri abstraction
- Zustand v5 state management (device, log, payloadDumper)
- shadcn/ui components with Tailwind CSS v4
- Light/dark/system theme support via next-themes
- Toast notifications via sonner
- Framer Motion animations

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
- 8 Rust tests passing
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
| Low | Streaming decompression | BufReader 256KB, 2-5x less memory (Phase 2) |
| Low | Centralize device polling | Duplicated across views |
| Low | Add Vitest for React testing | No JS/TS test framework |
| Low | Run device-backed parity tests | Need real Android devices |

## Risks / Known Issues

- Large frontend bundle chunk warning during build (589KB JS)
- Device polling duplicated across Dashboard, Flasher, Utilities views

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-22 | 0.1.0 | Dialog permission fix, Rust code refactoring, audit & performance research |
| 2026-03-22 | 0.1.0 | Rust edition 2024, all clippy warnings fixed, dependencies verified |
