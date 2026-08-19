# Progress

## Overall status

Fully functional Tauri 2 desktop app on **local `main`** (v**0.2.5**). Core features: device dashboard, wireless ADB, app manager + UAD debloat + APK icons, file explorer (root grant, hidden listing, open-in-editor), flasher, utilities (stacked Host/Device/Inspect/Danger + Windows Google host setup), **scrcpy** (official binaries, native window), payload dumper (local/remote/OPS/OFP/factory), marketplace (search-first + GitHub releases/README), emulator + Magisk root wizard, bottom logs/shell.

Packaging/CI: tauri-action multi-arch, official version path, portable-only custom script, multi-device debloat serial, single-instance, ACL split, view persistence, `persist-credentials: false` on checkout.

**Overhaul is merged into local `main`** (`5a6d3d5` + `540d152`). Same SHA as `feat/scrcpy-and-ui-overhaul`. **Not pushed.** v2 “Precision Instrument” UI later retinted to Neutral black/white is also on this HEAD (PR #1).

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | `lint:web` / `format:web` / `lint:rust` / `format:rust` / `format:check` / `lint` / `check` / `version:sync` |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt staged only) |
| CI detect | `dorny/paths-filter` → web / rust / packaging |
| CI quality | Split **quality-web** + **quality-rust** (path-gated; PRs always relevant side) |
| CI package | **main** + packaging-path changes; multi-arch Win/Linux; `tauri-action` + portable zip |
| Publish | Manual draft via tauri-action; notes file required; SHA256SUMS finalize |
| React Doctor | Target **100/100** (`npx react-doctor@latest .`) |
| Code signing | **Not used** |

## Major capabilities (done)

- FE layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- **11 views** code-split (`React.lazy` + `VIEW_PRELOADERS`), including Scrcpy
- Device-list poll 30s (`MainLayout`); AVD poll 5s (Emulator view); dashboard telemetry poll 15s (Dashboard only, stops on error)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote; ZIP64 CD extra parse tested
- Debloat SDK-aware + device-keyed cache + **explicit serial** IPC; backup restore wired (`RestoreDebloatBackup`)
- App Manager: 4-tab Hardware Cockpit: Telemetry Overview (`AppOverviewTab` with 5-spec metric strip, hand-rolled pure SVG `PackageCompositionDonut`, proportional `TargetSdkDistributionMeter` with legacy API compliance warnings, `TopStorageConsumersChart` sparklines, `DebloatSafetySpectrum` UAD health, `PermissionDensityMatrix`, `QuickLaunchpadCard` direct ADB intents), Virtualized Installed Apps (`InstalledAppsTab` with 8-way sorting, live state chips, inline hover actions, floating `InstalledBatchBar`), Sideload Studio (`InstallationTab` with `.apk`/`.apks`/`.xapk`/`.apkm` pre-flight AXML binary inspection, `InstallFlagsCockpit` switches, `InstallProgressCard`), and UAD Debloater (`DebloaterTab` with safety tier chips, vendor filters, 1-click toggles, `BackupRestorePanel` snapshot/rollback) + slide-out Radix `Sheet` `PackageInspectorDrawer` (top-11 header-aligned, lifecycle ops, storage paths with 1-click copy, live permissions)
- App icons: Rust `get_app_icons` + disk/memory cache; Installed apps tab via `useAppIcons`
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel + shell history stable ids
- File Explorer: thin view + hook composition; Explorer-style nav/command bands, Places + Root/Storage tree, resizable Details columns; host drop-in + in-app move; open allowlisted text in host editor; `ls -lA`
- Scrcpy: 5-tab Precision Hardware Cockpit (`ScrcpyCockpitHero` with live session count & transport badges, `ScrcpyOverviewTab` with 4 tailored 1-click quality presets & keyboard shortcuts cheat-sheet, `ScrcpyDisplayTab` with resolution/bitrate/FPS/codec tuners and pure SVG bandwidth gauge, `ScrcpyAudioTab` with audio forwarding and MP4/MKV recording studio, `ScrcpyInputTab` with physical keyboard/mouse emulation, and `ScrcpyBinaryTab` with Genymobile binary lifecycle manager and live CLI command preview)
- Utilities: 5-tab Precision Hardware Cockpit (`UtilitiesCockpitHero` with live ADB daemon status, `UtilitiesOverviewTab` with Instant Action Command Cockpit and interactive ADB Transport & Socket Architecture guide, `UtilitiesPowerTab` with symmetrical 3x2 reboot grid & Android System Tweaker, `UtilitiesDiagnosticsTab` with screenshot studio & real-time logcat buffer filter, `UtilitiesFastbootTab` with bootloader slot controller & deep `getvar all` variable inspector, and `UtilitiesHostTab` with Google standalone platform-tools & USB driver installer)
- Flasher: 4-tab Precision Hardware Cockpit (`FlasherCockpitHero` with live connection mode, lock state, slot switcher, and 6-spec hardware vitals, `FlasherOverviewTab` with interactive pure SVG/ASCII Android A/B partition hierarchy diagram and 6-row pre-flight hardware matrix, `FlasherPartitionTab` with auto-detecting image DropArea, partition chips, slot switcher, and deterministic multi-partition queue, `FlasherSideloadTab` with recovery ZIP sideload studio and pipeline tracker, and `FlasherWipeTab` with multi-step safety interlock gate)
- Payload Dumper: 4-tab Precision Hardware Cockpit (`PayloadDumperHeroBanner` with container format detection, uncompressed footprint, and destination reveal, `PayloadOverviewTab` clean overview screen, `PayloadExtractorTab` with searchable partition grid and output destination picker, `PayloadSourceTab` with local/remote stream loaders and OTA link catalog, and `PayloadHistoryTab` with output files explorer)
- Marketplace: 4-tab Precision Hardware Cockpit (`MarketplaceHeroBanner` with live repository sync badge and device ABI/SDK compatibility indicator, `MarketplaceOverviewTab` with curated open-source power tools showcase, pure SVG `SourceCompositionDonut`, `CategoryDistributionMeter`, and safe sideloading architecture guide, `MarketplaceBrowseTab` with high-density search, filters, and in-place detail view, `MarketplaceUpdatesTab` with batch update runner and changelog snippets, and `MarketplaceSourcesTab` with repository catalogs and GitHub PAT manager)
- Emulator: 4-tab Precision Hardware Cockpit (`EmulatorCockpitHero` with 8-spec hardware grid, VM state badge, and quick switcher, `EmulatorOverviewTab` with pure SVG `AvdResourceAllocationMeter`, `DiskUsageBreakdownChart`, hardware spec card, and virtualization knowledge base, `EmulatorLaunchStudioTab` with 5 quick startup presets and granular launch flags, `EmulatorRootStudioTab` with Magisk/KernelSU wizard, and `EmulatorRestoreStudioTab` with snapshot restore plans)
- Single-instance; ACL read/mutate permissions; active view localStorage
### v2 redesign (already on `main`)

- Design-token system in `global.css`: Neutral black/white (not chroma-tinted), four surface levels, 13px-base type scale (11px floor), motion + z-index tokens
- Self-hosted Inter + JetBrains Mono; Google Fonts removed from `index.html` **and** CSP
- Shell: Header (`VIEW_META` title + breadcrumb) → `ViewContent` (fluid width) → `StatusBar` → bottom-panel dock spacer
- ⌘K command palette + `shared/commands/` registry + `SHORTCUT_HELP`
- `operationStore` + `StatusBar` (App Manager wired)
- Dashboard: precision hardware cockpit with `DeviceHeroBanner` (8-spec hardware grid with hover-only copy buttons: Serial, Platform, Architecture, Security Patch, Kernel Version, Build Number, Uptime, Locale/Timezone), dual-arc radial `BatteryGauge` + 4-chip electrical/thermal grid, `MemoryPanel` + area waveform sparkline, `StoragePanel` partition cards, `SecurityPanel` zero-truncation diagnostic list, symmetric 3×2 `QuickActionsPanel` (Screen Mirror, Open Shell, reboot targets), and `WirelessAdbPanel`
- About: modernized `AboutHero` banner with badge metadata, equal-height stretched `Build` and `Licence` cards, and interactive `Built with` open-source tech grid with direct URL exploration
- Rust `src/adb/` — `AdbClient`, `shell_batch`, telemetry parsers; `release` profile `opt-level = 3`
- Confirmation gates on flash + sideload; charts hand-rolled SVG/CSS (no charting library)
### Universal Firmware Dumper & Live Firmware Hub (Done)

- **Dynamic Partitions (`src-tauri/src/payload/lp/`)**: Native Rust `liblp` binary parser (`LpMetadataGeometry` `0x616c4467`, `LpMetadataHeader` `0x414C5030`, `LpMetadataPartition`, `LpMetadataExtent`) and `unpack_super_image` extracting sub-partitions (`system`, `vendor`, `product`, `system_ext`, `odm`) directly from `super.img` to disk without temporary file overhead.
- **Incremental & Delta OTA Differential Engine (`src-tauri/src/payload/delta/`)**: `DeltaEngine` executing `SOURCE_COPY`, `SOURCE_BSDIFF`, `PUFFDIFF`, and `BROTLI_BSDIFF` with 512 MB safety caps, accompanied by `SourceMatcher` for pre-OTA base partition SHA-256 resolution.
- **CrAU v1 & v2 Header Support**: Dual parsing of legacy 20-byte ChromeOS / Android 6 (v1) and modern 24-byte Android 7–15+ (v2) headers.
- **Samsung Odin `.tar.md5` & LZ4 Streaming Unpacker (`src-tauri/src/payload/samsung/`)**: `SamsungTarMd5Extractor` streaming tar entries and decompressing `.lz4` partition frames on-the-fly (`lz4_flex`) with in-flight MD5 verification.
- **Xiaomi `transfer.list` & Brotli `dat.br` Extractor (`src-tauri/src/payload/xiaomi/`)**: `TransferList` script interpreter and `XiaomiDatExtractor` streaming Brotli-decompressed blocks into sparse target images.
- **Cross-Platform Native Sparse File IOCTL Manager (`src-tauri/src/payload/io/sparse_ioctl.rs`)**: `SparseFileExt` implementing Windows `FSCTL_SET_SPARSE` / `FSCTL_SET_ZERO_DATA`, Linux `fallocate(FALLOC_FL_PUNCH_HOLE)`, and macOS `fcntl(F_PUNCHHOLE)` to eliminate physical SSD zero-writes.
- **Storage Pre-Flight Validation & Resilient Mover (`src-tauri/src/payload/storage_check.rs`)**: User-quota-aware free space verification (5% headroom + 256 MiB metadata margin), FAT32 4GB limit rejection, `dunce::canonicalize` Windows `\\?\` path normalization, and `move_file_cross_device` handling `EXDEV` / error 17.
- **Universal Firmware Hub Backend (`src-tauri/src/firmware/`)**: Pluggable `FirmwareProvider` trait, `GooglePixelScraper` fetching Factory Images and Full OTAs with `devsite_wall_acks` cookie authentication, hardware metadata enrichment (SoC, Release Year, Series, isLatest), and two-tier caching (RAM `RwLock` + 24h disk JSON TTL at `<cache_dir>/firmware/`).
- **Universal Frontend Hub & 1-Click Remote Extraction (`src/features/payload-dumper/ui/marketplace/`)**: Multi-brand selector chips (`All`, `Google Pixel`, `Nothing`, `Xiaomi`, `OnePlus`, `Samsung`), TanStack Query `useFirmwareCatalog`, live loading skeletons, 1-click **Remote Stream Extract** bridge into payload dumper, dynamic partition sub-unpack controls in `PayloadLoadedPanel` and `PayloadOverviewTab`, and complete removal of static mock data.
- **Verification & Quality**: Tested real 3+ GB ROM zip extraction on `C:\Users\akila\OneDrive\Desktop\AGN-Test\payloaddumper\EvolutionX-15.0-20260415-marble-10.16-Unofficial.zip`, 28/28 payload dumper Vitest tests passing, 0 TypeScript errors, 0 Biome lint errors across 49 files, and 0 Cargo compiler warnings.
| Item | Note |
| --- | --- |
| Windows `cargo test` | Prefer `--no-run` locally; Linux CI runs tests |
| Delta OTA | Limited incremental path; errors call out limitation |
| OPS stream decrypt | Deferred vs full-file OPS/OFP |
| Win aarch64 tools | Still PE x86 Google tools (emulation) |
| Scrcpy ARM | No official Genymobile ARM zip; PATH fallback |
| FE view-model size | Large orchestrator still allowlisted if arch-tested |
| macOS | Code/resources present; **builds paused** by product policy |
| `get_device_info` | Registered + permitted, **no frontend caller** left; keep or remove is undecided |
| `operationStore` coverage | App Manager only; flasher / payload / emulator / scrcpy use their own progress |
| `--content-max-width` | Token declared in `global.css`, no longer applied anywhere |
| Overhaul not on origin | Local `main` ahead of `origin/main` until push |
| GUI smoke | Overhaul not run inside the Tauri webview in that session |
| Marketplace catalog | Search-first; no F-Droid “home” browse without a query |
| Logcat | Snapshot only, not a live stream |
| Flasher wipe | Own confirm UI; does not send utilities `WIPE` phrase |
| Host setup smoke | Needs a rebuilt Windows app + UAC: Path in a new terminal, USB row vs Device Manager |
| Cargo.toml `[lints]` squiggle | Editor schema bug; `taplo.toml` disables Cargo.toml JSON schema |

## Changelog policy

No long session diaries here. Design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Status/gaps only in this file.

**Last updated:** 2026-08-18
