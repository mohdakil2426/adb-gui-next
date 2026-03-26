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
- Proper header bar with SidebarTrigger + toolbar buttons
- shadcn/ui components (20+ primitives) with Tailwind CSS v4
- Light/dark/system theme support via next-themes
- Toast notifications via sonner
- Framer Motion view transitions (opacity fade 150ms via AnimatePresence in MainLayout)
- Terminal panel with filter dropdown, search highlighting, auto-scroll toggle, maximize/minimize
- App Manager: virtualized package list (TanStack Virtual), user/system filter, type Badge, accessible Input search
- **File Explorer (full-featured dual-pane)**:
  - Lazy-loaded `DirectoryTree` sidebar + resizable right-pane file list
  - Editable address bar; tree collapse/expand; localStorage persistence (`fe.currentPath`, `fe.treeCollapsed`)
  - 5 edge cases: permission denied, spaces in paths, symlinks, device disconnect, responsive
  - **Explicit multi-select mode** (`isMultiSelectMode` gate):
    - Checkbox column absent by default; activated via `Ctrl+Click`, `Ctrl+A`, right-click → Select
  - **Inline rename**: `F2` or right-click; inline Input, Enter/Escape/blur
  - **Bulk delete**: `Delete` key or right-click → AlertDialog
  - **Create File/Folder**: `Ctrl+N`/`Ctrl+Shift+N`, toolbar, right-click, empty-state buttons; inline phantom row
  - **Back/Forward history**: `navHistory` stack (50 max), `Alt+←`/`Alt+→`; `historyIndexRef` prevents infinite loop
  - **Search/Filter**: `Ctrl+F` to focus, client-side filter, `Escape` to clear
  - **Sortable columns**: Name/Size/Date clickable headers; dirs always float above files
  - **Human-readable sizes**: `formatBytes()` — `14.0 MB`, dirs show `—`
  - **Symlink target display**: `→ /target` subtitle from parsed `ls -lA` output
  - **Right-click ContextMenu**: Select / Copy Path / Open / Rename / Delete / Import / Export
  - **Import/Export**: Context-aware context menu; `executePull/executePush` shared helpers (DRY)
- Shared components: `LoadingButton`, `SectionHeader`, `FileSelector`, `SelectionSummaryBar`, `ConnectedDevicesCard`, `EditNicknameDialog`, `CheckboxItem`, `EmptyState`, `DirectoryTree`
- `getFileName()` utility in `utils.ts`
- `models.ts` DTOs as plain TypeScript interfaces

### UI Consistency (~95%)

- All CardTitle icons: `className="h-5 w-5"` (no unsized icons, no `size={N}` prop)
- All inline/list icons: `className="h-4 w-4 shrink-0"`
- All form labels: shadcn `<Label>` (no raw `<label className="...">`)
- All destructive AlertDialogAction: `buttonVariants({ variant: 'destructive' })`
- Semantic color tokens everywhere: `text-success`, `bg-success`, `border-success`
- All internal imports use `@/` alias
- All clickable div lists have `role`/`aria-*`/`tabIndex`/`onKeyDown`
- `CheckboxItem` shared component used in AppManager + PayloadDumper
- `EmptyState` shared component used in AppManager

### Backend (28 Tauri Commands)

| Category | Commands |
|----------|----------|
| Device | `get_devices`, `get_device_info`, `get_device_mode`, `get_fastboot_devices` |
| ADB | `run_adb_host_command`, `run_shell_command`, `connect_wireless_adb`, `disconnect_wireless_adb`, `enable_wireless_adb` |
| Fastboot | `flash_partition`, `reboot`, `wipe_data`, `set_active_slot`, `get_bootloader_variables`, `run_fastboot_host_command` |
| Files | `list_files`, `push_file`, `pull_file`, `delete_files`, `rename_file`, `create_file`, `create_directory` |
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
- Native application icons: Windows (`.ico`), macOS (`.icns`), Linux (`.png`) via `pnpm tauri icon`
- ICO: 6 layers (32/16/24/48/64/256px, all 32bpp). `public/logo.png` + `public/favicon.png` synced.
- Mobile icon directories removed (out of scope)

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
├── lib.rs (~60 lines) — thin orchestrator
├── helpers.rs — shared utilities (binary resolution, command execution, device info)
├── commands/
│   ├── mod.rs — re-exports
│   ├── device.rs — get_devices, get_device_info, get_device_mode, get_fastboot_devices
│   ├── adb.rs — wireless ADB, run_adb_host_command, run_shell_command
│   ├── fastboot.rs — flash_partition, reboot, wipe_data, set_active_slot
│   ├── files.rs — list_files, push_file, pull_file, delete_files, rename_file
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

- ✅ Sparse zero handling: `Type::Zero` returns empty vec, seeks past region
- ✅ Position tracking: skips redundant seeks
- ✅ Block size from manifest: reads `block_size` field
- ✅ Async Tauri commands: `extract_payload` and `cleanup_payload_cache` on Tokio
- ✅ Parallel partition extraction: `std::thread::scope` (4-8x faster)

## Remaining Work

| Priority | Task | Notes |
|----------|------|-------|
| Medium | Shift+Click range selection in File Explorer | Phase 2 — needs `lastClickedIndex` tracking |
| Medium | Add tests for bottom panel components | logStore, shellStore, BottomPanel, LogsPanel |
| Low | Virtual list for log entries | react-window for 1000+ entries performance |
| Low | Extend RHF to ViewFlasher | partition/file form |
| Low | Adopt EmptyState in remaining views | Dashboard empty device list |
| Low | Run device-backed parity tests | Need real Android devices |

## Risks / Known Issues

- Large frontend bundle chunk warning during build (~274 KB JS)
- Bottom panel Shell tab needs manual verification with `pnpm tauri dev`
- `cargo test` abnormal exit on Windows (pre-existing — Tauri DLL not available in bare `cargo test` process; not a code bug)

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-26 | 0.1.0 | File Explorer: Create File/Folder (Ctrl+N/Ctrl+Shift+N), Back/Forward history (Alt+←/→), Search/Filter (Ctrl+F), sortable columns, human-readable sizes, symlink targets, Copy Path; infinite render loop fix; empty-dir creation fix |
| 2026-03-26 | 0.1.0 | File Explorer: Import/Export context menu (context-aware push/pull); DRY executePull/executePush helpers |
| 2026-03-26 | 0.1.0 | File Explorer: explicit multi-select mode gate; no single-click selection |
| 2026-03-26 | 0.1.0 | File Explorer: checkbox column hidden until multi-select mode (isMultiSelectMode state); right-click Select menu item |
| 2026-03-26 | 0.1.0 | File Explorer multi-select + inline rename + delete + context menu + keyboard shortcuts; Checkbox + ContextMenu shadcn components |
| 2026-03-26 | 0.1.0 | File Explorer dual-pane: DirectoryTree, editable address bar, tree collapse, localStorage persistence, 5 edge case fixes |
| 2026-03-23 | 0.1.0 | App icon & branding: 3D premium terminal icon, `pnpm tauri icon` cross-platform generation |
| 2026-03-23 | 0.1.0 | UI consistency audit: semantic tokens, icon sizes, Label, aria roles, CheckboxItem, EmptyState, buttonVariants, shrink-0, Separator, sidebar-context.ts |
| 2026-03-23 | 0.1.0 | shadcn Sidebar migration: AppSidebar.tsx, grouped nav, SidebarProvider/SidebarInset, Ctrl+B shortcut |
| 2026-03-23 | 0.1.0 | Comprehensive codebase quality: dead code removal, P0 reactivity fix, shadcn adoption, shared components, semantic token fixes |
| 2026-03-23 | 0.1.0 | App Manager: virtualized list (TanStack Virtual) + user/system package filter |
| 2026-03-23 | 0.1.0 | VS Code-style bottom panel (BottomPanel, LogsPanel, ShellPanel, logStore, shellStore) |
| 2026-03-22 | 0.1.0 | Payload dumper overhaul, dependency integration, debugging infrastructure |
| 2026-03-22 | 0.1.0 | Rust edition 2024, all clippy warnings fixed, dependencies verified |
