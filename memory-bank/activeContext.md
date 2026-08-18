# Active Context

## Current Focus

**UI-to-Rust Backend Logic Migration & Code Quality Optimization**: Migrating all heavy business logic, hardware telemetry calculations, data parsers, batch execution loops, dynamic update inspections, and cryptographic hashing into the Rust backend (`src-tauri/src/`) while keeping UI and presentation purely in React.

### Key Objectives
1. **App Manager Domain (`src-tauri/src/apps/`)**: Real `get_app_overview_telemetry` from `dumpsys diskstats` / packages, real `targetSdk` / `apkSizeBytes` on `InstalledPackage`, batch APK inspection, and atomic sideloading.
2. **Flasher Domain (`src-tauri/src/flasher/`)**: Single `fastboot getvar all` parser for `get_flasher_vitals`, binary magic byte sniffer for images, background transactional `flash_partition_batch`, and streaming `sideload_package_stream`.
3. **Scrcpy & Emulator Domains**: Server-side `scrcpy_preview_command`, quality profiles catalog, typed `scrcpy_toolbar_action` dispatcher, real `config.ini` hardware specs parser, real disk breakdown inspection, and host resource telemetry via `sysinfo`.
4. **Marketplace & Payload Domains**: Real dynamic update inspector, device ABI matching, `marketplace_get_overview_stats`, authentic on-disk SHA-256 partition hashing, and unified `get_all_devices`.
5. **Desktop IPC & Models**: Complete TypeScript DTOs in `src/desktop/models.ts` with strict literal unions and typed backend invoke wrappers.

See full audit and plan in `docs/internal/reports/full_ui_and_backend_logic_migration_audit.md` and `docs/internal/reports/ui_to_rust_migration_implementation_plan.md`.

| Area | Decision |
| --- | --- |
| **Theme** | Official shadcn Neutral: light `--background: oklch(1 0 0)`, dark `--background: oklch(0.145 0 0)`. `canvas`/`surface` alias those tokens. Status colours = device state, not UI emphasis. |
| **Scrcpy** | Official Genymobile zip/tar + SHA256SUMS; store under `app_data_dir()/scrcpy/`; detached native spawn (not in the webview); CLI flags only; event `scrcpy:download-progress`. Official archives: Win/Linux **x64**. ARM uses PATH fallback. Companion floating pill toolbar (`scrcpy-toolbar-*`) secondary Tauri webview with Freeform and Lock (magnetic window tracking + Y-offset adjustment) modes. |
| **Dashboard** | Precision hardware cockpit: `DeviceHeroBanner` (connection status pulse, 8-spec hardware grid with hover-only copy buttons: Serial, Platform, Architecture, Security Patch, Kernel Version, Build Number, Uptime, Locale/Timezone) + 2 equal-height stretched rows (`BatteryGauge` dual-arc radial meter + 4-chip electrical/thermal grid, `MemoryPanel` with live area waveform sparkline, `StoragePanel` partition cards, `SecurityPanel` 6-row diagnostic list with zero truncation, `QuickActionsPanel` 3×2 symmetric grid with direct Mirror and Shell, `WirelessAdbPanel`). |
| **App Manager** | 4-tab Precision Cockpit: `AppOverviewTab` (5-spec metric strip, hand-rolled pure SVG `PackageCompositionDonut`, proportional `TargetSdkDistributionMeter` with legacy API alerts, `TopStorageConsumersChart` sparklines, `DebloatSafetySpectrum` UAD health, `PermissionDensityMatrix`, `QuickLaunchpadCard`), `InstalledAppsTab` (virtualized data grid, 8-way sorting, live state chips, inline hover actions, floating `InstalledBatchBar`), `InstallationTab` (`InstallDropZone`, pre-flight AXML binary inspection `PreFlightApkCard`, `InstallFlagsCockpit` switches, `InstallProgressCard`), and `DebloaterTab` (safety tier chips, vendor filters, 1-click toggles, `BackupRestorePanel` snapshot/rollback) + slide-out Radix `Sheet` `PackageInspectorDrawer` (top-11 header-aligned, lifecycle ops, storage paths with 1-click copy, live permissions). |
| **About** | Modernized `AboutHero` banner with badge metadata; equal-height `Build` + `Licence` stretched cards; interactive `Built with` tech grid opening official URLs via `BrowserOpenURL`. |
| **App icons** | Rust `app_icons.rs` / `get_app_icons`: `pm list packages -f`, pull APK, pick raster from zip, disk+memory cache, batch max 24. FE `useAppIcons` displays only. |
| **File editor / explorer** | Pull allowlisted text to temp; Windows `code`→Notepad; Linux `code`→gedit/kate→xdg-open; macOS `code`→`open -t` (builds still paused). Show in Explorer is MTP This PC, not that temp dir. Listing uses `ls -lA` (hidden entries). Host OS drop → `host_path_kinds` + `push_file`. In-app row drag is HTML5 MIME + `transfer_device_files`. No OS drag-out. |
| **Marketplace GitHub** | Paginate releases (10×100), every APK asset; raw README; FE renders a small Markdown subset (no markdown library). |
| **Marketplace browse** | Search-first toolbar (source chips, installable-only, sort, grid/list). Last-search cache + installable filter are display-only; Rust owns search/install. |
| **Utilities** | Single scroll: Host / Device / Inspect / Danger sections. Domain `utilities/` validates slot (`a`/`b`), wipe phrase `WIPE`, logcat clamp. IPC: `restart_adb_server`, `kill_adb_server`, `get_host_tool_versions`. Screenshot: `save_screenshot` PNG. |
| **Host setup** | Domain `host_setup/`. Official `dl.google.com` catalog only (no third-party setup EXE). Separate UAC actions: copy platform-tools + HKLM Path vs `pnputil` USB INF. Status: registry Path + `pnputil /enum-drivers`. Event `host-setup:progress`. Card hidden off Windows. |
| **CI** | `actions/checkout` `persist-credentials: false` (keep `lfs: true` where platform-tools are needed). |
| **Branch policy** | Continue on **local `main`**. Do not reopen the overhaul worktree for new work unless asked. |

## Open / deferred

- Desktop GUI was not smoke-tested in the overhaul session (lint/tests only)
- Official scrcpy archives: Windows x64 + Linux x64 only — no official Win ARM64 / Linux ARM64 zip
- macOS builds still paused; scrcpy/editor paths exist for a future unpause
- `operationStore` still App Manager–centric; scrcpy download uses `scrcpy:download-progress`; host setup uses `host-setup:progress`
- Windows local `cargo test` may hit loader `0xc0000139` — use `--no-run` if so
- No F-Droid catalog home (search-first); logcat is a snapshot, not a live stream
- Flasher wipe uses its own UI confirm, not the utilities `WIPE` phrase
- `origin/main` is behind local `main` until the user asks to push
- Unrelated unstaged leftover: `.gitignore` (`akila-prompt-temp.md`) — do not mix into feature commits unless asked
- Host setup needs a Windows rebuild + UAC smoke: tools Path in a **new** cmd, USB row from `pnputil`

## Next steps

- Stay on **main** for further product work
- Push to origin only when the user asks
- Manual smoke: host setup split installs + system Path; scrcpy; icons; editor; marketplace; utilities WIPE

**Last updated:** 2026-08-18
