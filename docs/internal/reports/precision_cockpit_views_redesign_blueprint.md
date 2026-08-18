# Precision Hardware Cockpit: Cross-Screen Transformation & Visual Elevation Blueprint

**Date:** 2026-08-18  
**Scope:** Marketplace, Flasher, Payload Dumper, Utilities, Scrcpy, Emulator  
**Standard:** Parity with Dashboard (`DeviceHeroBanner`, `TRIO_GRID_CLASS`) and Applications (`AppManagerView`, `AppOverviewTab`)

---

## 1. Executive Summary & Design System Axioms

This transformation elevates all remaining secondary screens into first-class **Precision Hardware Cockpits**. Every screen adheres to the design axioms established in `DESIGN.md`, `src/AGENTS.md`, and demonstrated in the Dashboard and Applications manager:

1. **Precision Hero Banners**: Elevated `@container` header cards with brand/state avatar container, live pulsing status dot, key metric specifications (4-8 spec grid), and consolidated sync/refresh action.
2. **Segmented Tab Hardware Navigation**: Consistent, top-level `<Tabs>` navigation with custom tab triggers featuring Lucide icons, live count/status badges, and smooth state switching.
3. **Dedicated Overview & Telemetry Tabs**:
   - **Visual Pure-SVG Telemetry**: Zero external charting libraries (`freezePrototype: true` invariant compliant). Custom SVG Donut charts, proportional Segmented Distribution meters, gradient sparklines, and horizontal bar charts using token colors (`var(--chart-1)` through `var(--chart-5)`).
   - **Interactive Technical Guides & Flowcharts**: Dedicated educational ASCII and SVG architectural diagrams explaining underlying subsystem mechanics (Android A/B partition structure, OTA Payload blobs, ADB server/daemon socket transport, Scrcpy H.264/H.265 video pipelines, AVD RAMDisk Magisk/KernelSU patching).
4. **Symmetrical Equal-Height Card Grids**: Utilizing `@container` queries (`@lg:grid-cols-2`, `@3xl:grid-cols-4`, `TRIO_GRID_CLASS`), `items-stretch`, `PanelCard`, and `flex-1 flex flex-col justify-between` to guarantee crisp baselines and zero text truncation.
5. **Zero Layout Shifts & Desktop-First**: Strictly avoids `sm:` / `md:` viewport breakpoints in favor of container queries `@container` + `@xs`/`@sm`/`@lg`/`@xl`/`@2xl`/`@4xl`.

---

## 2. Screen-by-Screen Architectural Blueprint

```
+----------------------------------------------------------------------------------------------------+
|                                    PRECISION HARDWARE COCKPIT SYSTEM                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | [HERO BANNER]  [Avatar/Icon] Primary Title · Status Badge · Subtitle               [Refresh] |  |
|  |                Grid: Spec 1 | Spec 2 | Spec 3 | Spec 4 | Spec 5 | Spec 6                     |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | [TABS LIST]  [📊 Overview & Telemetry]  [🚀 Primary Studio]  [⚙️ Advanced]  [📚 Guides]       |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  +--------------------------------------------+  +--------------------------------------------+  |
|  | [CARD 1: Pure SVG Visualizer]              |  | [CARD 2: Metric Distribution Meter]        |  |
|  | - Custom SVG Donut / Waveform Area         |  | - Proportional Bar / Safety Spectrum       |  |
|  | - Live Legend with Tokens                  |  | - Interactive Tooltip Scrubber             |  |
|  +--------------------------------------------+  +--------------------------------------------+  |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | [CARD 3: Symmetrical Action Grid / Deep Technical Architecture Guide / Interactive Flow]    |  |
|  | [Action 1] [Action 2] [Action 3]  /  ASCII Flowchart & Diagnostic Verification Matrix       |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

### 2.1. Screen 1: Marketplace (`src/features/marketplace/`)

#### Layout & Tab Hierarchy
- **Header Banner:** `MarketplaceHeroBanner`
  - Total available packages, Target device compatibility indicator (`Android 14 · API 34 · arm64-v8a`), Active source repositories (`F-Droid`, `GitHub Releases`, `IzzyOnDroid`), Rate limit status, Sync button.
- **Tabs:**
  1. `Overview & Discover` (`MarketplaceOverviewTab`)
     - **Curated Power Tools Grid**: Top open-source Android tools (Termux, Shizuku, Magisk, ViPER4Android, Revanced, Lawnchair, Proton Pass, PipePipe) with instant 1-click install.
     - **Visual Telemetry**:
       - `SourceCompositionDonut`: Visual repository source breakdown.
       - `CategoryDistributionMeter`: Categories (System, Privacy, Dev, Media, Tools).
       - `LicenseSafetyMatrix`: License breakdown (GPLv3, Apache-2.0, MIT, MPL).
     - **Marketplace Technical Guide**: Flowchart showing APK signature verification, direct GitHub release asset extraction, F-Droid index caching, and safe sideloading pipeline.
     - **Quick Install Queue & Recent Searches**: Instant search tags + live install tracker.
  2. `Browse & Search` (`MarketplaceBrowseTab`)
     - Search bar + Filter bar (Chips, Source toggles, Sort by: Stars/Updated/Name/Relevance).
     - Grid (`AppCard`) / List (`AppListItem`) switcher.
     - Responsive container queries with ABI/SDK device compatibility indicators.
     - In-place slide-out `AppDetailView` with screenshots, markdown README, release asset selector.
  3. `Installed & Updates` (`MarketplaceUpdatesTab`)
     - Compares device installed packages against marketplace catalog packages.
     - Identifies installed apps with available newer releases on GitHub/F-Droid.
     - Single-click "Update All" batch runner and per-app "Update" buttons with release changelog snippets.
  4. `Sources & Settings` (`MarketplaceSourcesTab`)
     - Repository management (enable/disable F-Droid, GitHub, IzzyOnDroid).
     - GitHub Personal Access Token (PAT) configuration for 5,000 req/hr rate limit + status verification.
     - Cache manager (clear search cache, re-index repos, view disk cache size).

---

### 2.2. Screen 2: Flasher (`src/features/flasher/`)

#### Layout & Tab Hierarchy
- **Header Banner:** `FlasherCockpitHero`
  - Connection mode (`FASTBOOT` / `FASTBOOTD` / `SIDELOAD` / `ADB`), Bootloader Lock State (`LOCKED` 🔒 / `UNLOCKED` 🔓), Active Slot (`Slot _a` / `Slot _b`), Product Board Name, Fastboot Protocol Version, Battery Level Safety Guard (>50%).
- **Tabs:**
  1. `Overview & Safety Guide` (`FlasherOverviewTab`)
     - **Android A/B Partition Hierarchy Flowchart (Pure SVG & ASCII)**:
       ```
       [Bootloader (ABOOT / XBL)]
                  |
         +--------+--------+
         |                 |
       [Slot A]         [Slot B]
         |                 |
       +-[boot.img / init_boot.img / vendor_boot.img / dtbo / vbmeta]
       |
       +-[super.img (Dynamic Partitions: system, vendor, product, system_ext)]
       |
       +-[userdata (Encrypted FBE / Ext4 / F2FS)]
       ```
     - **Pre-Flight Diagnostic Matrix**: 6-row hardware check: Device state validation, Bootloader unlocked check, Battery level safety (>50%), USB 3.0 link verification, Driver handshake, Slot consistency.
     - **Sideload vs Fastboot Knowledge Base**: Interactive guide explaining when to use Fastboot (raw partition images) vs FastbootD (dynamic `super` partitions) vs Sideload (full OTA/ROM zips).
     - **Recent Flash History & Audit Log**: Session flash operations log with timestamp, target partition, image size, and execution exit status.
  2. `Partition Flasher` (`FlasherPartitionTab`)
     - Drag & Drop Image DropZone with auto-partition detection (dropping `boot.img` auto-selects `boot`, `vbmeta.img` auto-selects `vbmeta`).
     - Quick Partition Selector chips (Boot & Kernel, Recovery & Init, System & Super, Radio & Modem, Full list).
     - Multi-partition batch queue (queue `boot.img`, `vendor_boot.img`, `dtbo.img`, `vbmeta.img` and flash in deterministic order).
     - Visual Slot Switcher (`Set Active Slot A / Slot B`) with 1-click switch & reboot fastboot.
     - Safe Flash Confirmation Modal with SHA-256 checksum verification and target partition warning level.
  3. `ADB Sideload / Recovery` (`FlasherSideloadTab`)
     - Dedicated OTA & Custom ROM Sideload studio.
     - Drag & Drop ZIP DropArea with file size, MD5/SHA256 calculation, zip integrity check.
     - Live progress streaming bar with byte transfer speed and step status.
     - One-click helper buttons: `Reboot to Recovery`, `Check Sideload State`.
  4. `Partitions & Wipe Utility` (`FlasherWipeTab`)
     - Formatted partition wipe tools: `Wipe Userdata / Factory Reset`, `Erase Cache`, `Erase Metadata`, `Erase System`.
     - Multi-step safety gate: requires typing `WIPE` or checking 2 critical safety toggles before proceeding with destructive erase operations.

---

### 2.3. Screen 3: Payload Dumper (`src/features/payload-dumper/`)

#### Layout & Tab Hierarchy
- **Header Banner:** `PayloadDumperHeroBanner`
  - Loaded Payload File / URL name, Format badge (Standard `payload.bin`, Factory ZIP, OTA ZIP, OPS/OFP), Total Payload Size, Total Partitions Count, Target Android Version / Build Fingerprint, Compression Ratio, Extraction Destination Directory with 1-click folder reveal.
- **Tabs:**
  1. `Overview & Telemetry` (`PayloadOverviewTab`)
     - **Pure SVG Telemetry Visualizations**:
       - `PayloadCompositionDonut`: Core Boot (`boot`, `init_boot`, `vendor_boot`, `dtbo`, `vbmeta`) vs Dynamic OS (`system`, `vendor`, `product`, `system_ext`) vs Modem & Firmware (`modem`, `dsp`, `bluetooth`) partition distribution.
       - `PartitionSizeBarChart`: Top 10 largest partitions visual horizontal bars with formatted sizes and compression status.
       - `CompressionEfficiencyGauge`: Raw size vs uncompressed extracted footprint.
     - **Payload Architecture Guide & Information Card**: Complete interactive guide explaining Android Delta/Full OTA `payload.bin` structure (Header, Manifest protobuf, Blob operations: `REPLACE`, `REPLACE_XZ`, `REPLACE_BZ`, `ZERO`, `DIFF`), hash verification, and partition header offsets.
     - **Quick Extraction Presets**:
       - ⚡ *Root Kit* (1-click selects `boot`, `init_boot`, `vendor_boot`, `vbmeta`)
       - 📱 *System & Vendor* (1-click selects `system`, `vendor`, `product`, `system_ext`)
       - 📻 *Modem & Radio* (1-click selects `modem`, `radio`, `bluetooth`, `dsp`)
       - 📦 *Full Flash Image* (selects all)
  2. `Extractor & Partitions Table` (`PayloadExtractorTab`)
     - Filterable, searchable partition data grid with category chips (All, Boot/Kernel, System, Modem, Other).
     - Select all / Invert selection / Search filter.
     - Output Directory selector with free space check.
     - Live Extraction Progress Cockpit: Real-time per-partition animated progress bars, overall progress gauge, extraction speed (MB/s), elapsed time & estimated time remaining, cancel extraction button with clean abort.
  3. `Source & Remote Loader` (`PayloadSourceTab`)
     - Split source picker: **Local File** (Drag & Drop `.bin`, `.zip`, `.ops`, `.ofp`) vs **Remote URL** (Direct OTA HTTP/HTTPS streaming with chunk pre-flight).
     - Remote URL Preset Catalog (Direct download links helper for Google Pixel, OnePlus, Xiaomi, Nothing Phone, Motorola, LineageOS OTA formats).
     - Download resume & partial header stream engine.
  4. `Extracted Outputs & History` (`PayloadHistoryTab`)
     - List of successfully extracted partitions with file sizes, output paths, and quick actions (`Flash to Device`, `Open in Explorer`, `Compute Checksum`).

---

### 2.4. Screen 4: Utilities (`src/features/utilities/`)

#### Layout & Tab Hierarchy
- **Header Banner:** `UtilitiesCockpitHero`
  - ADB Server version & status (Running / Restarting / Stopped), Host Platform-tools version, Connected Device Serial & Mode (`device` / `recovery` / `sideload` / `fastboot` / `offline`), Fastboot binary path status, Quick Restart Server button.
- **Tabs:**
  1. `Overview & Quick Actions` (`UtilitiesOverviewTab`)
     - **Device Vitals & Diagnostic Matrix**: 6-item live status: USB Debugging state, SELinux enforcement (`Enforcing` / `Permissive`), Battery Temp & Voltage, Root status (`su` available), Display resolution & density (DPI), Android Security Patch.
     - **Instant Action Command Cockpit (Symmetrical 3x2 Grid)**:
       - 📸 `Capture Screenshot` (instant preview + copy to clipboard + save PNG)
       - 🎥 `Screen Record` (quick 30s record to host)
       - 📋 `Dump Bugreport / Sysinfo`
       - 🧹 `Clear Logcat Buffer`
       - 🌐 `Toggle Wi-Fi / Airplane Mode`
       - 📱 `Toggle Demo Mode (Status Bar)`
     - **ADB Transport & Utilities Guide**: Interactive technical guide explaining ADB daemon architecture, TCP/IP ports (5037 server, 5555 device), USB endpoints, and shell permissions.
  2. `ADB Power & System Tweaks` (`UtilitiesPowerTab`)
     - Symmetrical 3x2 Reboot Actions Grid (System, Recovery, Bootloader, FastbootD, EDL 9008, Soft Reboot).
     - Android UI & System Tweaker (Window Animation Scale toggles, Dark Theme force toggle, Battery Saver toggle, Keep Screen Awake, Custom DPI adjuster).
  3. `Diagnostics & Live Tools` (`UtilitiesDiagnosticsTab`)
     - **Interactive Screenshot Studio**: Instant high-res device screenshot pull with frame container, copy to clipboard, save to disk, and refresh.
     - **Live Logcat Stream Viewer**: Fast log buffer viewer with log level selector (Verbose, Debug, Info, Warning, Error, Fatal), Tag filter, search query, auto-scroll toggle, clear buffer, and export to `.txt`.
  4. `Fastboot & Bootloader Tools` (`UtilitiesFastbootTab`)
     - Symmetrical Fastboot Power Grid (Reboot System, Reboot Bootloader, Reboot Recovery, Reboot FastbootD).
     - `getvar all` Deep Inspector: Searchable table of all device bootloader variables (`product`, `serialno`, `secure`, `unlocked`, `current-slot`, `slot-count`, `max-download-size`, `partition-type:*`, `partition-size:*`).
     - One-click Slot Switcher (`Set Slot A` / `Set Slot B`).
     - Fastboot Wipe & Erase actions with confirmation gates.
  5. `Host Environment & Drivers` (`UtilitiesHostTab`)
     - Google USB Driver installer & updater (`pnputil /add-driver` for Windows).
     - Google Platform-tools setup & PATH registration (`C:\Android\platform-tools`).
     - ADB Port conflict detector & process killer.

---

### 2.5. Screen 5: Scrcpy (`src/features/scrcpy/`)

#### Layout & Tab Hierarchy
- **Header Banner:** `ScrcpyCockpitHero`
  - Scrcpy Engine Version & Binary Status (Installed / Needs Update / Downloading), Active Mirroring Sessions Count badge with live pulsating dot, Connected Device Targets, Connection Transport (`USB 3.0` / `Wireless TCP 5555`), Quick "Launch Mirror" / "Stop All" primary action.
- **Tabs:**
  1. `Overview & Quick Mirror` (`ScrcpyOverviewTab`)
     - **Target Device Selector**: Multi-device support with visual device tiles, nickname display, battery level, resolution, and connection type (USB vs Wireless).
     - **1-Click Quality Presets Cockpit (4 Hero Cards)**:
       - ⚡ *High Performance / Gaming*: 60 FPS, 16 Mbps, Low Latency, H.265/HEVC, Audio Passthrough
       - 💼 *Productivity & Work*: Native Resolution, 12 Mbps, Stay Awake, Clipboard Auto-Sync, Physical Keyboard forwarding
       - 🔋 *Battery Saver / Ultra-Light*: 1080p, 4 Mbps, 30 FPS, Turn Screen Off on launch
       - 🎙️ *Content Creator / Recording*: Max Resolution, 24 Mbps, H.265, Audio Forward, Auto-Record to MP4/MKV
     - **Scrcpy Keyboard Shortcuts Cheat-Sheet Cockpit**: Interactive visual guide of all Scrcpy shortcuts (`MOD+F`, `MOD+H`, `MOD+B`, `MOD+S`, `MOD+O`, `MOD+N`, `MOD+P`, `MOD+R`).
     - **Active Session Controller**: Shows active mirroring sessions with per-device Stop button and Floating Toolbar toggle.
  2. `Display & Video Engine` (`ScrcpyDisplayTab`)
     - Fine-grained Video Stream Tuning: Resolution (Original / 2160p / 1440p / 1080p / 720p / Custom px), Bitrate Stepper (2 to 64 Mbps), Max FPS (30, 60, 90, 120, Unlimited), Video Codec (H.264, H.265/HEVC, AV1), Display Orientation, Video Buffer, Crop Display rect.
  3. `Audio & Recording Studio` (`ScrcpyAudioTab`)
     - Audio Engine Settings: Audio Forwarding (Enabled / Muted / Disabled), Audio Codec (OPUS, AAC, FLAC, RAW), Audio Bitrate & Buffer.
     - Recording Studio: Auto Record on launch toggle, Container format (MP4 vs MKV), Output Directory selector with timestamp pattern.
  4. `Input, Controls & Automation` (`ScrcpyInputTab`)
     - Physical Keyboard Mode (SDK vs UHID vs AOA), Mouse Forwarding (SDK vs UHID), Automation Toggles (Turn screen off on launch, Stay awake, Show touches, Power off on close, Borderless/Fullscreen/Always on top).
  5. `Binary Management & Diagnostics` (`ScrcpyBinaryTab`)
     - Official Genymobile Scrcpy binary manager: Check updates, Re-download, Uninstall, Open installation folder.
     - Live generated CLI command preview!

---

### 2.6. Screen 6: Emulator (`src/features/emulator/`)

#### Layout & Tab Hierarchy
- **Header Banner:** `EmulatorCockpitHero`
  - Selected AVD Name with OS Avatar, Android API Level & OS Version (`Android 14.0 · API 34`), CPU Architecture & ABI (`x86_64` / `arm64-v8a`), VM State Badge (`RUNNING` 🟢 / `STOPPED` ⚪ / `COLD BOOT NEEDED` 🟡), Display Resolution, Root Status, Primary 1-Click Launch / Force Stop Action.
- **Tabs:**
  1. `Overview & Resource Telemetry` (`EmulatorOverviewTab`)
     - **Pure SVG Hardware & Allocation Telemetry**:
       - `AvdResourceAllocationMeter`: RAM assigned to AVD vs System Total RAM.
       - `DiskUsageBreakdown`: Internal Storage image size vs Userdata size vs Snapshot overlay size.
       - `CpuCoreDistribution`: Virtual CPU core count allocation.
     - **AVD Hardware Spec Card (Equal-Height Grid)**: Graphics Engine (`Host GPU / SwiftShader / ANGLE`), Display Density & Skin, SD Card size, Network speed & latency profile.
     - **Emulator & Rooting Knowledge Base**: Interactive guide explaining Android Emulator virtualization (HAXM / WHPX / KVM), Rooting architecture (Magisk vs KernelSU vs SuperSU on x86_64), RAMDisk patching, Cold boot requirements (`-no-snapshot-load`), and Writable System (`-writable-system`) SELinux constraints.
  2. `AVD Manager & Launch Studio` (`EmulatorLaunchStudioTab`)
     - AVD List Grid & Quick Switcher with visual cards, search, and status.
     - Launch Modes & Profiles: Standard Quick Boot, Cold Boot Clean (`-no-snapshot-load`), Wipe Data & Reset (`-wipe-data`), Writable System Root Mode (`-writable-system -selinux permissive`), Headless / No Window Mode (`-no-window`).
     - Advanced Launch Flags: GPU Acceleration mode, Custom DNS, Memory limits, Port forward.
  3. `Root Engine & Superuser Wizard` (`EmulatorRootTab`)
     - Enhanced Multi-Step Root Wizard:
       - Step 1: Pre-flight Compatibility Check (Verifies API level, ABI, system image writable check).
       - Step 2: Superuser Payload Selection (Magisk vs KernelSU vs SuperSU).
       - Step 3: Automated RAMDisk / `boot.img` Extraction & Patching with live animated progress.
       - Step 4: Installation & Reboot to Rooted State.
       - Step 5: Verification (`su -c id -u` check with interactive root badge).
  4. `Snapshots & Recovery Studio` (`EmulatorRestoreTab`)
     - Snapshot history and state viewer.
     - Automated Backup & Restore Plan: Shows system files modified by rooting, backup verification, and 1-click restore to stock pristine state.

---

## 3. Parallel Subagent Dispatch Strategy

The implementation tasks are decoupled by feature directory and can be executed via independent subagents in parallel waves:

- **Wave 1 (Parallel Feature Redesign - 6 Subagents)**:
  - **Subagent 1**: Marketplace Redesign (`src/features/marketplace/**`)
  - **Subagent 2**: Flasher Redesign (`src/features/flasher/**`)
  - **Subagent 3**: Payload Dumper Redesign (`src/features/payload-dumper/**`)
  - **Subagent 4**: Utilities Redesign (`src/features/utilities/**`)
  - **Subagent 5**: Scrcpy Redesign (`src/features/scrcpy/**`)
  - **Subagent 6**: Emulator Redesign (`src/features/emulator/**`)

- **Wave 2 (Integration & Verification)**:
  - Vitest test suite execution and test updates.
  - Ultracite linter verification (`bun run lint:web`).
  - TypeScript build verification (`bun run build`).
  - Memory-bank and documentation real-time synchronization.

---
