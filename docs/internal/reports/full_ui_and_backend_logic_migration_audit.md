# Full UI & Backend Logic Migration Audit Report
**Date:** 2026-08-18  
**Scope:** Entire Frontend UI (`src/features/*`, `src/shared/*`, `src/app/*`, `src/desktop/*`) and Rust Backend (`src-tauri/src/*`)  
**Objective:** Identify all business logic, data parsers, hardware metrics, calculations, state transformations, disk operations, batch loops, and network/caching logic that can and should be migrated to the Rust backend while keeping UI/presentation purely in React.

---

## 1. Executive Summary

Following the complete UI transformation across all views in `adb-gui-next`, this audit evaluated every subsystem to establish the optimal architectural boundary: **Pure UI & Reactive State in React** and **High-Performance Fat Domain Logic & Hardware Orchestration in Rust**.

### Key Architectural Findings:
1. **Frontend Synthetic Data & Fabricated Metrics**:
   - **App Manager Overview**: Target SDK distribution, storage footprint (`~42.8 GB`), permission density counts, and top 5 storage consumers are currently mathematically faked in TypeScript.
   - **Debloater / Installed Apps**: `debloaterUtils.ts` uses polynomial string hashing (`getPackageMetrics`) to fake package sizes (8MB–260MB) and target SDKs (29–35), which the virtualized list sorts against!
   - **Emulator Overview**: `avdSpecs.ts` invents hardware details (resolution, RAM, vCPUs, cameras) via string matching, `DiskUsageBreakdownChart.tsx` uses hardcoded formulas instead of real host file sizes, and `AvdResourceAllocationMeter.tsx` hardcodes 16GB host RAM and 8 cores.
   - **Marketplace Overview & Updates**: Overview charts use hardcoded mock counts; `MarketplaceUpdatesTab.tsx` compares installed apps against a static 6-app dictionary `CATALOG_KNOWN_UPDATES`.
   - **Payload Dumper History**: `HistoryRecordCard.tsx` calculates a fake simulated SHA-256 hash using `record.id` and partition name instead of hashing the actual `.img` file on disk.

2. **Uncoordinated Sequential Subprocess & IPC Loops in Frontend**:
   - **Flasher Telemetry**: `useFlasherTelemetry.ts` spawns **9 concurrent child processes** (`fastboot getvar <key>`) via `Promise.all`, causing USB contention and command timeouts.
   - **Multi-Partition Flash Queue**: `useFlashBatchQueue.ts` executes sequential flashes in a JavaScript loop. If the UI unmounts or glitches, the flash pipeline is interrupted mid-way.
   - **Sideloading**: `InstallationTab.tsx` uses `mapSerial` for sequential installs; `SideloadProgressCard.tsx` uses a simulated CSS animation rather than streaming true ADB progress.
   - **Debloat Double-Chunking**: Frontend chunks packages into groups of 25, while backend internally chunks into 100 and calls `query_package_states` (3 `pm list` commands) after each chunk.

3. **Subsystem Logic Migration Opportunities**:
   - **Scrcpy**: CLI command generation/preview, quality profiles catalog, bandwidth metrics calculation, and toolbar action dispatching belong in Rust `scrcpy/`.
   - **Flasher & Fastboot**: Single `fastboot getvar all` parser in Rust, binary magic byte image sniffer (`ANDROID!`, `0x3AFF26ED`, `AVB0`), deterministic background batch flasher, and typed partition erase authorization.
   - **Marketplace**: Real dynamic update inspector, device ABI compatibility matcher, typed Serde DTOs, and safe markdown parsing.
   - **App Manager**: Real package telemetry aggregator, enriched `InstalledPackage` with real `targetSdk` and `apkSizeBytes`, batch APK inspection in Rust, and streamlined debloat actions.
   - **Dashboard & Shell**: Unified `get_all_devices` (combining ADB + Fastboot in Rust), deprecation of legacy 12-spawn `get_device_info`, and unified CLI command router.

---

## 2. Detailed Subsystem Audit Matrix

| Subsystem | Current Frontend Logic / Problem | Proposed Rust Domain & IPC Solution | Impact / Simplification |
| :--- | :--- | :--- | :--- |
| **App Manager: Telemetry** | `packageStats.ts` fakes SDK distribution (`62% / 31%`), storage footprint, and permission densities. | `apps::telemetry::get_app_overview_telemetry` parses real diskstats, target SDKs, and dangerous permissions in Rust. | Truthful hardware metrics; eliminates `packageStats.ts` mock math. |
| **App Manager: Installed Apps** | `debloaterUtils.ts` fakes package sizes and SDKs using polynomial hash; list sorts on fake values. | Enrich `InstalledPackage` in Rust with real `targetSdk`, `minSdk`, and `apkSizeBytes`. | Real on-disk byte sizes and accurate SDK sorting; deletes `getPackageMetrics`. |
| **App Manager: Sideload** | `InstallationTab.tsx` uses sequential `mapSerial`; `PreFlightApkCard.tsx` issues unbatched single-file IPC calls. | `apk_inspector::batch_inspect_packages` and `apps::batch_install_packages` with progress events. | Parallel worker thread inspection; single atomic install pipeline. |
| **App Manager: Debloater** | Frontend chunker (25) + backend chunker (100) causes 12 ADB list queries per 100 packages. | Single `debloat_packages` command in Rust with streaming progress and single post-sync query. | Eliminates `debloatApply.ts` and double-chunking overhead. |
| **Marketplace: Updates** | `MarketplaceUpdatesTab.tsx` matches against static 6-app dictionary `CATALOG_KNOWN_UPDATES`. | `marketplace::updates::marketplace_check_updates` dynamically queries F-Droid/GitHub for installed apps. | Real upstream update detection for any installed package. |
| **Marketplace: Compatibility** | Backend picks first APK asset regardless of device CPU architecture (`arm64-v8a`, `x86_64`). | `marketplace::compatibility::match_best_apk_asset` matches target device ABI. | Prevents `INSTALL_FAILED_NO_MATCHING_ABIS` runtime errors. |
| **Marketplace: Stats & Catalog** | Mock counts in `SourceCompositionDonut.tsx` and `CategoryDistributionMeter.tsx`. | `marketplace_get_overview_stats` and `marketplace_get_curated_tools` in Rust. | Dynamic data driven by real backend cache and catalog. |
| **Payload Dumper: Hash** | `HistoryRecordCard.tsx` computes simulated hash via `crypto.subtle` on ID string. | Expose `compute_partition_file_sha256` in Rust reading actual extracted `.img` file. | Authentic cryptographic integrity verification. |
| **Payload Dumper: Presets** | Partition categorization and presets hardcoded in `partitionCategories.ts`. | Enrich `PartitionDetail` with `category` and expose `get_extraction_presets` in Rust. | Consistent categorization across CLI and UI. |
| **Flasher: Telemetry** | `useFlasherTelemetry.ts` spawns 9 concurrent `fastboot getvar` child processes. | `flasher::vitals::get_flasher_vitals` parses single `fastboot getvar all` output in Rust. | Probing latency drops from ~1.8s to ~150ms; zero USB contention. |
| **Flasher: Batch Flash** | `useFlashBatchQueue.ts` orders and executes flash sequence in client JS loop. | `flasher::batch::flash_partition_batch` with topological priority ordering and progress events. | Deterministic, crash-resilient multi-partition flashing. |
| **Flasher: Image Detection** | 29-entry filename regex dictionary in `flasherConstants.ts`. | `flasher::partitions::inspect_partition_image` sniffs magic bytes (`ANDROID!`, `0x3AFF26ED`, `AVB0`). | Accurate partition targeting regardless of file naming. |
| **Flasher: Sideload** | Sideload in `apps.rs` is blocking; progress bar in UI is simulated CSS animation. | `flasher::sideload::sideload_package_stream` parses stdout percentages and emits events. | True real-time transfer progress for recovery ZIPs. |
| **Scrcpy: Command & Presets** | CLI command formatting, flag explanations, and presets hardcoded in TypeScript. | `scrcpy_preview_command` and `scrcpy_profiles` in Rust `scrcpy/flags.rs`. | Eliminates `cli.ts`; server-validated command preview. |
| **Scrcpy: Toolbar** | Android keycodes hardcoded in TS; zoom sends keyevent 0 (unknown/no-op). | `scrcpy_toolbar_action` typed enum in Rust; fixes zoom to 1:1 window sizing. | Type-safe action dispatching; fixes zoom bug. |
| **Emulator: Hardware Specs** | `avdSpecs.ts` invents hardware details via string regex; charts use hardcoded formulas. | `emulator::avd::emulator_get_avd_specs` parses real `config.ini` and `hardware-qemu.ini`. | Accurate hardware specifications directly from host disk. |
| **Emulator: Disk Breakdown** | Arbitrary storage calculation formulas in `DiskUsageBreakdownChart.tsx`. | `emulator::avd::emulator_get_disk_breakdown` measures actual `system.img`, `userdata.img` sizes. | True disk usage metrics and snapshot storage gauges. |
| **Emulator: Host Telemetry** | `AvdResourceAllocationMeter.tsx` hardcodes 16GB host RAM and 8 cores. | `system_host_resources` queries actual host capacity via `sysinfo` in Rust. | Accurate host allocation percentages. |
| **Emulator: Bug Fix** | `StopAvd` passes AVD name to `adb -s <serial> emu kill`, causing failure. | `runtime::stop_avd` accepts either AVD name or active serial, resolving automatically. | Fixes broken AVD stop action. |
| **Dashboard: Device Discovery** | `fetchAllDevices()` runs separate ADB and Fastboot IPC calls and merges in JS. | `get_all_devices` in Rust using `tokio::join!` with native deduplication. | Single IPC roundtrip; eliminates duplicate polling logic. |
| **Dashboard: Legacy DeviceInfo** | `legacyDeviceInfo.ts` formats mock strings; Rust maintains 12-spawn `get_device_info`. | Deprecate `get_device_info` and `toLegacyDeviceInfo`; consume `telemetry.identity` directly. | Removes 12 child process spawns per telemetry cycle. |
| **Shell: CLI Routing** | `ShellInput.tsx` parses strings with regex to route between 3 separate IPC commands. | `execute_cli_command` in Rust handles tokenization, execution, and timing. | Single unified CLI endpoint returning exit code and latency. |

---

## 3. Code Quality & Performance Improvements

### 3.1 Rust Backend Optimization
1. **Async I/O in HTTP Setup**: Convert `host_setup/http.rs` from blocking `std::fs::File` to `tokio::fs::File` and apply `ProgressThrottle` to prevent UI event saturation during high-speed downloads.
2. **String Allocation Cleanup**: Replace 32-iteration `format!` loops in `commands/files.rs` (`file_fingerprint`) with `hex::encode(digest)`.
3. **Exit Code Marker Consolidation**: Remove the duplicate `EXIT_CODE_MARKER` implementation in `emulator/root.rs` in favor of `AdbClient::shell_checked`.
4. **Token Registry Eviction**: Add explicit drop-safety or timeout-based eviction for `TOKEN_REGISTRY` in `commands/payload.rs`.
5. **Typed Serde DTOs for Marketplace**: Replace loose `serde_json::Value` indexing in `github.rs`, `fdroid.rs`, and `aptoide.rs` with typed structs (`GithubRepoDto`, `GithubReleaseDto`, `AptoideAppDto`).

### 3.2 Frontend Code Quality & React Best Practices
1. **TypeScript Advanced Types**: Update `src/desktop/models.ts` to replace generic `string` types with strict string literal unions matching Rust Serde enums (`ApkFormat`, `PackageType`, `DeviceStatus`, `ProviderSource`, `RebootTarget`).
2. **Deduplicate Components**: Merge duplicated `PackageCompositionDonut.tsx` components into a single shared component in `src/features/app-manager/overview/charts/PackageCompositionDonut.tsx`.
3. **Zustand Selectors Optimization**: Consolidate multi-selector subscriptions in `useMarketplaceSearch.ts` and `useInstalledPackages.ts` using `useShallow` to eliminate unnecessary re-renders.
4. **Memory Leak Safeguard**: Add disconnection cleanup in `memoryHistoryStore.ts` to prune RAM history samples when devices disconnect.
5. **Clean Cutover**: Delete all unused frontend helpers (`packageStats.ts` mock generators, `mapSerial.ts`, `debloatApply.ts` chunking, `flasherConstants.ts` filename dictionary, `cli.ts` scrcpy command generator).

---

## 4. Next Phase

Proceeding to Phase 4: Constructing a detailed, actionable, multi-stage implementation plan to execute these migrations systematically using subagents.
