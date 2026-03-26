# Progress

## Overall Status

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.

## What Works

### Frontend

- App shell loads under Vite/React with Strict Mode enabled
- shadcn Sidebar (`collapsible="icon"` mode) with grouped navigation (Main/Advanced)
- `AppSidebar.tsx` extracted component with SidebarHeader, SidebarFooter, SidebarRail
- `sidebar-context.ts` holds non-component exports (constants, context, hook) — Fast Refresh clean
- `Ctrl+B` keyboard shortcut for sidebar toggle
- 7 sidebar views compile and build successfully
- VS Code-style bottom panel with Logs and Shell tabs
- Proper header bar with SidebarTrigger + toolbar buttons (Device Manager, Terminal, Shell, Logs)
- shadcn/ui components (20+ primitives) with Tailwind CSS v4
- Light/dark/system theme support via next-themes
- Toast notifications via sonner
- Framer Motion view transitions (opacity fade 150ms via AnimatePresence in MainLayout)
- Terminal panel with filter dropdown, search highlighting, auto-scroll toggle, maximize/minimize
- App Manager: virtualized package list (TanStack Virtual), user/system filter, type Badge, accessible Input search
- **File Explorer (dual-pane)**: lazy-loaded `DirectoryTree` sidebar + resizable right-pane file list; editable address bar; tree collapse/expand; `fe.currentPath` + `fe.treeCollapsed` persisted to localStorage; 5 edge cases fixed (permission denied, spaces in paths, symlinks, device disconnect, responsive)
- Shared components: `LoadingButton`, `SectionHeader`, `FileSelector`, `SelectionSummaryBar`, `ConnectedDevicesCard`, `EditNicknameDialog`, `CheckboxItem`, `EmptyState`
- `getFileName()` utility in `utils.ts`
- `models.ts` DTOs as plain TypeScript interfaces

### UI Consistency (~95%)

- All CardTitle icons: `className="h-5 w-5"` (no unsized icons, no `size={N}` prop)
- All inline/list icons: `className="h-4 w-4"`
- All in-button icons: `shrink-0` present
- All form labels: shadcn `<Label>` (no raw `<label className="...">`)
- All destructive AlertDialogAction: `buttonVariants({ variant: 'destructive' })`
- Semantic color tokens everywhere: `text-success`, `bg-success`, `border-success` (no `[var(--terminal-log-success)]` in className)
- All internal imports use `@/` alias
- All clickable div lists have `role`/`aria-*`/`tabIndex`/`onKeyDown`
- `CheckboxItem` shared component used in AppManager + PayloadDumper
- `EmptyState` shared component used in AppManager

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
- Platform-specific resource bundling configured
- Native application icons generated for Windows (`.ico`), macOS (`.icns`), and Linux (`.png`) via Tauri CLI using `docs/original_icons.png` as the final source. ICO: 6 layers (32/16/24/48/64/256px, all 32bpp, 32px first). `public/logo.png` synced from `src-tauri/icons/icon.png`.
- Mobile icon directories (`android/`, `ios/`) removed as they are out of project scope.

### Tooling & Quality

- React Strict Mode enabled
- TypeScript strict mode enabled
- ESLint 10 flat config active for web app
- Prettier active for web app
- cargo fmt (Rust edition 2024) active
- cargo clippy with `-D warnings` (strict) active
- `pnpm check` runs full verification workflow

## Rust Code Structure

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
│   ├── system.rs — open_folder, save_log, launch_terminal, launch_device_manager
│   └── payload.rs — payload command wrappers
└── payload/
    ├── mod.rs — re-exports + chromeos_update_engine protobuf
    ├── parser.rs — CrAU header parsing, protobuf decoding
    ├── extractor.rs — partition extraction with SHA-256 verification
    ├── zip.rs — ZIP payload handling and caching
    └── tests.rs — 5 payload tests
```

## Documentation

- `docs/reports&audits/ui_consistency_audit.md` — Comprehensive UI consistency audit (2026-03-23)
- `docs/rust-audit-report.md` — Code quality audit
- `docs/rust-performance-research.md` — Performance optimization research

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
| Low | Adopt EmptyState in remaining views | Dashboard empty device list |
| Low | Run device-backed parity tests | Need real Android devices |

## Risks / Known Issues

- Large frontend bundle chunk warning during build (589KB JS)
- Bottom panel Shell tab needs manual verification with `pnpm tauri dev`
- `cargo test` abnormal exit on Windows (pre-existing — Tauri DLL not available in bare `cargo test` process; not a code bug)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-26 | 0.1.0 | File Explorer dual-pane: DirectoryTree, editable address bar, tree collapse, localStorage persistence, 5 edge case fixes |
| 2026-03-23 | 0.1.0 | App icon & branding: 3D premium terminal icon, true PNG conversion, `pnpm tauri icon` cross-platform generation |
| 2026-03-23 | 0.1.0 | UI consistency audit: semantic tokens, icon sizes, Label, aria roles, CheckboxItem, EmptyState, buttonVariants, shrink-0, Separator, sidebar-context.ts |
| 2026-03-23 | 0.1.0 | shadcn Sidebar migration: `AppSidebar.tsx`, grouped nav, `SidebarProvider`/`SidebarInset`, header bar with `SidebarTrigger`, `Ctrl+B` shortcut |
| 2026-03-23 | 0.1.0 | Comprehensive codebase quality: dead code removal, P0 reactivity fix, shadcn adoption, shared components, semantic token fixes, models.ts interface migration |
| 2026-03-23 | 0.1.0 | App Manager: virtualized list + user/system package filter |
| 2026-03-23 | 0.1.0 | VS Code-style bottom panel overhaul (BottomPanel, LogsPanel, ShellPanel, logStore, shellStore) |
| 2026-03-22 | 0.1.0 | Payload dumper overhaul, dependency integration, debugging infrastructure |
| 2026-03-22 | 0.1.0 | Dialog permission fix, Rust code refactoring, audit & performance research |
| 2026-03-22 | 0.1.0 | Rust edition 2024, all clippy warnings fixed, dependencies verified |
