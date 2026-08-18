# UI to Rust Backend Logic Migration: Implementation Plan
**Date:** 2026-08-18  
**Architecture:** Tauri 2 (Rust 2024 + Tokio) + React 19 (TypeScript, Zustand, TanStack Query, Tailwind v4, shadcn)

---

## 1. Goal & Principles

- **Maximum Logic in Rust Backend**: All telemetry aggregation, hardware spec inspection, file magic byte sniffing, batch execution queues, dynamic update checking, cryptographic hashing, and CLI parsing migrate to fat domain modules in `src-tauri/src/`.
- **Pure UI & Presentation in React**: Frontend components become clean visual views rendering strongly-typed DTOs from Rust via `src/desktop/backend.ts`.
- **Zero Feature Regressions**: All 11 views, navigation, design tokens, and user workflows remain identical or improved.
- **High Performance & Safety**: Parallel Tokio/Rayon worker tasks, event-driven streaming progress, zero-polling where possible, no uncoordinated sequential subprocess loops, and 100/100 React Doctor & Ultracite compliance.

---

## 2. Phased Subagent-Driven Execution Plan

### Phase 1: Rust Backend Domain Modules & Tauri IPC Commands
1. **Module `src-tauri/src/apps/` & `src-tauri/src/commands/apps.rs`**:
   - Create `apps/mod.rs`, `apps/telemetry.rs`, `apps/install.rs`.
   - `get_app_overview_telemetry`: Query `dumpsys diskstats` / `dumpsys package`, calculate true composition, SDK compliance distribution, and dangerous permissions.
   - Enrich `InstalledPackage` with `target_sdk`, `min_sdk`, `apk_size_bytes`.
   - Add `batch_inspect_package_files` in `apk_inspector.rs`.
   - Add `batch_install_packages` with `app_install_progress` event emitter.
   - Streamline `debloat_packages` (single-pass execution with progress events).

2. **Module `src-tauri/src/flasher/` & `src-tauri/src/commands/flasher.rs`**:
   - Create `flasher/mod.rs`, `flasher/vitals.rs`, `flasher/partitions.rs`, `flasher/batch.rs`, `flasher/sideload.rs`, `flasher/wipe.rs`.
   - `get_flasher_vitals`: Single `fastboot getvar all` call in Rust returning `FastbootVitals` and 6-point preflight diagnostics.
   - `inspect_partition_image`: Sniff binary magic bytes (`ANDROID!`, `0x3AFF26ED`, `AVB0`, `0xD00DFEED`).
   - `flash_partition_batch`: Background Tokio task with topological priority ordering and `flasher:batch-progress` events.
   - `sideload_package_stream`: Async stdout percentage stream emitting `flasher:sideload-progress`.
   - `erase_partition`: Safe partition erase with authorization phrase verification.

3. **Module `src-tauri/src/scrcpy/` & `src-tauri/src/emulator/`**:
   - `scrcpy/flags.rs`: Expose `scrcpy_preview_command`, `scrcpy_profiles`, `scrcpy_calculate_bandwidth_metrics`.
   - `scrcpy/toolbar.rs`: Add `scrcpy_toolbar_action` typed enum dispatcher (fixes zoom keyevent 0 bug).
   - `emulator/avd.rs`: Add `emulator_get_avd_specs` (real `config.ini`) and `emulator_get_disk_breakdown` (real host disk file sizes).
   - `emulator/runtime.rs`: Fix `stop_avd` name-to-serial resolution.
   - `commands/system.rs`: Add `system_host_resources` (sysinfo host RAM and CPU cores).

4. **Module `src-tauri/src/marketplace/`, `src-tauri/src/payload/`, `src-tauri/src/commands/device.rs`**:
   - `marketplace/updates.rs`: Add `marketplace_check_updates` comparing installed packages against catalog.
   - `marketplace/compatibility.rs`: Add `match_best_apk_asset` matching target device CPU ABI.
   - `marketplace/service.rs`: Add `marketplace_get_overview_stats` and `marketplace_get_curated_tools`.
   - `commands/payload.rs`: Expose `compute_partition_file_sha256` and `get_extraction_presets`.
   - `commands/device.rs`: Add `get_all_devices` (combining ADB + Fastboot with `tokio::join!`); delete legacy 12-spawn `get_device_info`.
   - `commands/system.rs`: Add `execute_cli_command`.
   - `host_setup/http.rs`: Switch to async `tokio::fs` + `ProgressThrottle`.

---

### Phase 2: Desktop IPC & TypeScript DTO Models (`src/desktop/`)
1. Update `src/desktop/models.ts`:
   - Add new DTOs: `AppOverviewTelemetry`, `FastbootVitals`, `DiagnosticItem`, `PartitionTargetInfo`, `ScrcpyCommandPreview`, `ScrcpyQualityProfile`, `BandwidthMetrics`, `AvdHardwareDetails`, `AvdDiskBreakdown`, `HostHardwareCapacity`, `AppUpdateCandidate`, `MarketplaceOverviewStats`, `CliExecutionResult`.
   - Tighten string types to string literal unions matching Serde enums.
2. Update `src/desktop/backend.ts`:
   - Export typed invoke wrappers for all new backend commands.
3. Update `src/desktop/runtime.ts`:
   - Add typed event listeners for new progress event streams.

---

### Phase 3: Frontend Feature Migrations & UI Wire-Up (`src/features/*`)
1. **App Manager & Debloater**:
   - Update `AppOverviewTab.tsx`, `AppMetricsHeroBanner.tsx`, `TopStorageConsumersChart.tsx`, `TargetSdkDistributionMeter.tsx`, `PermissionDensityMatrix.tsx` to consume `GetAppOverviewTelemetry`.
   - Update `InstalledAppsTab.tsx` and `InstalledPackageList.tsx` to use real `apkSizeBytes` and `targetSdk`.
   - Delete `getPackageMetrics` hash faker and `packageStats.ts` mock math.
   - Update `InstallationTab.tsx` and `PreFlightApkCard.tsx` to use `BatchInspectPackages` and `BatchInstallPackages`, deleting `mapSerial.ts`.
   - Update `DebloaterTab.tsx` to use `DebloatPackages`, deleting `debloatApply.ts`.
   - Deduplicate `PackageCompositionDonut.tsx`.
2. **Flasher**:
   - Update `useFlasherTelemetry.ts` to use single `GetFlasherVitals`, deleting the 9-spawn parallel loop.
   - Update `FlasherPartitionTab.tsx` and `useFlashBatchQueue.ts` to use `InspectPartitionImage` and `FlashPartitionBatch`.
   - Update `FlasherSideloadTab.tsx` and `SideloadProgressCard.tsx` to use `SideloadPackageStream` with live events.
   - Update `FlasherWipeTab.tsx` to use `ErasePartition`.
3. **Scrcpy & Emulator**:
   - Update `CliCommandPreview.tsx` to use `ScrcpyPreviewCommand`, deleting `cli.ts`.
   - Update `QualityPresetsCard.tsx` to use `ScrcpyProfiles`.
   - Update `BandwidthGauge.tsx` to use `ScrcpyCalculateBandwidthMetrics`.
   - Update `ScrcpyFloatingToolbar.tsx` to use `ScrcpyToolbarAction`.
   - Update `AvdHardwareSpecCard.tsx`, `DiskUsageBreakdownChart.tsx`, `AvdResourceAllocationMeter.tsx` to use real `EmulatorGetAvdSpecs`, `EmulatorGetDiskBreakdown`, `GetHostHardwareCapacity`.
4. **Marketplace & Payload Dumper & Shell**:
   - Update `MarketplaceUpdatesTab.tsx` to use `MarketplaceCheckUpdates`, deleting `CATALOG_KNOWN_UPDATES`.
   - Update `CuratedPowerToolsGrid.tsx` and overview charts to use `MarketplaceGetOverviewStats` and `MarketplaceGetCuratedTools`.
   - Update `HistoryRecordCard.tsx` to use real `ComputePartitionFileSha256`.
   - Update `queries.ts` and `MainLayout.tsx` to use `GetAllDevices`.
   - Update `ShellInput.tsx` to use `ExecuteCliCommand`.
   - Add disconnect cleanup to `memoryHistoryStore.ts`.

---

### Phase 4: Quality Gates & Verification
1. `cargo check --manifest-path src-tauri/Cargo.toml`
2. `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
3. `bun run check` (TypeScript typecheck)
4. `bun x ultracite fix`
5. `bun test` (Vitest test suite)
6. Real-time update of `memory-bank/` and documentation.
