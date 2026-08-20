# Active Context

## Current Focus

**Universal Firmware Dumper Engine & Live OEM Firmware Hub**:
Universal Android firmware container extraction and real-time OEM firmware catalog scraping in the Rust backend (`src-tauri/src/payload/` and `src-tauri/src/firmware/`), paired with a reactive React 19 frontend (`src/features/payload-dumper/`).

### Key Implementations & Capabilities
1. **Dynamic Partitions (`src-tauri/src/payload/lp/`)**: Native Rust `liblp` binary parser (`LpMetadataGeometry` 0x616c4467, `LpMetadataHeader` 0x414C5030, `LpMetadataPartition`, `LpMetadataExtent`) and `unpack_super_image` streaming sub-partitions (`system.img`, `vendor.img`, `product.img`, `system_ext.img`, `odm.img`) directly from `super.img` to disk without temporary file overhead.
2. **Incremental & Delta OTA Differential Engine (`src-tauri/src/payload/delta/`)**: `DeltaEngine` executing `SOURCE_COPY`, `SOURCE_BSDIFF` (via `bsdiff-android`), `PUFFDIFF` (via `puffdiff` deflate puff-repuff), and `BROTLI_BSDIFF` (Brotli patch stream decompression + BSDiff against base blocks), accompanied by `SourceMatcher` for pre-OTA base partition SHA-256 resolution.
3. **CrAU Dynamic Manifest & Header Engine (`src-tauri/src/payload/crau/` & `src-tauri/src/payload/remote/mod.rs`)**: `read_remote_crau_header` dynamically reading the exact Protobuf `DeltaArchiveManifest` length and signature offset from the 32-byte header prefix, resolving 1MB truncations on multi-MB modern OTA manifests (e.g. Nothing OS 2.06MB manifest) across all remote inspection and extraction endpoints.
4. **SSRF-Validated Range Request Redirect Engine (`src-tauri/src/payload/remote/http.rs`)**: `validated_redirect_policy` and `validated_blocking_redirect_policy` enforcing per-hop SSRF validation (`validate_outbound_url`) while following up to 5 `301`, `302`, `307`, and `308` redirects with preserved `Range: bytes={start}-{end}` headers, resolving `302 Found` errors from Google/Nothing OTA CDNs (`android.googleapis.com` $\rightarrow$ `*.gvt1.com`).
5. **Xiaomi / Redmi / POCO Live Multi-Feed Scraper (`src-tauri/src/firmware/providers/xiaomi.rs`)**: Concurrent multi-feed aggregator joining `latest.yml`, `hyperos.yml`, and `devices/latest.yml` into a 4,600+ build catalog across 340+ device families. Features hardware SoC/series enrichment, base codename normalization, human size parsing, and brand-specific **Recovery ROM (Remote Stream)** vs **Fastboot ROM (TGZ)** classification.
6. **Nothing OS & CMF Live Scraper (`src-tauri/src/firmware/providers/nothing.rs`)**: Live Docusaurus v3 HTML scraper targeting `https://nothingarchive.tech/docs/firmware`, parsing all 12 Nothing and CMF devices with 24-hour two-tier disk caching.
7. **Google Pixel Live Scraper (`src-tauri/src/firmware/providers/google.rs`)**: Scraper fetching Factory Images and Full OTAs with `devsite_wall_acks` cookie authentication and hardware metadata enrichment.
8. **OnePlus Live Scraper & 50+ Models Catalog (`src-tauri/src/firmware/providers/oneplus.rs`)**: Live GitHub release ingestion from `spike0en/oneplus_archive` with direct OTA CDN linking (`allawnofs.com`, `googleapis.com`, `archive.org`) and comprehensive 50+ model catalog across Flagship (OnePlus 13 down to One), Nord, Foldable (Open), Tablet (Pad/Pad 2), and Ace series.
9. **Samsung Live FOTA & 70+ Models Catalog (`src-tauri/src/firmware/providers/samsung.rs`)**: Live Samsung FOTA `version.xml` query and doc.html changelog parsing with exhaustive 70+ model database across Galaxy S (S25 to S7), Galaxy Z (Fold/Flip 6 to Fold 1), Galaxy Note (Note 20 to Note 8), Galaxy A, M, F, and Galaxy Tab S/A lines.
10. **Universal Frontend Hub & Precision Extractor Workspace (`src/features/payload-dumper/`)**:
   - Reorganized tab architecture: Tab 1: Overview, Tab 2: Extractor & Partitions, Tab 3: Firmware Hub, Tab 4: Extracted Outputs & History.
   - 1-click **Remote Stream Extract** from Firmware Hub straight into active partition streaming.
   - Persistent Local & Remote source ingestion tabs at the top of the Extractor tab.
   - Recent Links history strip with localStorage caching in `RemoteUrlPanel`.
   - Brand-specific segmented controls (`Recovery ROM (Remote Stream)` vs `Fastboot ROM (TGZ)` for Xiaomi).
   - High-precision `RemoteLoadProgressCard` with 4-phase stepper, live elapsed timer, and telemetry metrics.
9. **Samsung Odin `.tar.md5` & LZ4 Streaming Unpacker (`src-tauri/src/payload/samsung/`)**: `SamsungTarMd5Extractor` streaming tar entries and decompressing `.lz4` partition frames on-the-fly (`lz4_flex`) with in-flight MD5 verification.
10. **Xiaomi `transfer.list` & Brotli `dat.br` Extractor (`src-tauri/src/payload/xiaomi/`)**: `TransferList` script interpreter and `XiaomiDatExtractor` streaming Brotli-decompressed blocks into sparse target images.
11. **Cross-Platform Native Sparse File IOCTL Manager (`src-tauri/src/payload/io/sparse_ioctl.rs`)**: `SparseFileExt` implementing Windows `FSCTL_SET_SPARSE` / `FSCTL_SET_ZERO_DATA`, Linux `fallocate(FALLOC_FL_PUNCH_HOLE)`, and macOS `fcntl(F_PUNCHHOLE)`.
12. **Storage Pre-Flight Validation & Resilient Mover (`src-tauri/src/payload/storage_check.rs`)**: User-quota-aware free space verification (5% headroom + 256 MiB metadata margin), FAT32 4GB limit rejection, and `dunce::canonicalize` path normalization.
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

**Last updated:** 2026-08-19
