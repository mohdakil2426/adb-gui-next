# System Patterns

Living **working patterns** only. Full architecture diagrams and feature matrix: `docs/architecture.md`. Module rules: `src/AGENTS.md`, `src-tauri/AGENTS.md`. Packaging policy: `docs/project_rules.md`.

## Layer flow

```text
UI → feature/hook/store → desktop/backend|runtime → Tauri IPC
  → commands/* (thin) → helpers + domain → result/event → store/toast/log
```

## Patterns that prevent regressions

### Desktop IPC

- All `invoke` / events / file-drop / opener go through `src/desktop/` only.
- DTOs in `models.ts` match Rust `camelCase` (including tagged enum **values**).

### Window drag-and-drop

- One `OnFileDrop` registration per page (re-register replaces previous).
- Hit-test cursor `(x,y)` on **hover and drop** with element rects or `elementFromPoint`.
- File Explorer: `[data-fe-drop-dir]` / `[data-fe-drop-pane]`; DOM highlight; `host_path_kinds` then `push_file`. In-app MIME drag for moves. No OS drag-out.

### Device selection

- Single device **list** poll in `MainLayout` (30s). No second device-list poll.
- Device-scoped reads may own a query if they are mounted-view scoped: dashboard telemetry (15s, Dashboard only, stops on error), AVD list (5s, Emulator view).
- Features pass `selectedSerial` into device-scoped APIs (including **debloat**).
- Prefer `run_adb` / `run_adb_for_serial` with `-s` over bare `adb get-serialno` when UI has a selection.
- Query defaults (`App.tsx`): `staleTime` 30s, `retry: false`, `refetchOnWindowFocus: false` — every query spawns a subprocess.

### Shell layout

- Outer `h-svh overflow-hidden`; `SidebarProvider` `h-full` (not `min-h-svh`).
- Column inside `SidebarInset`: Header (44px, structural `shrink-0`) → `ViewContent` (`flex-1 min-h-0`) → `StatusBar` (26px) → bottom-panel dock.
- `BottomPanel` stays `position: fixed`; a `shrink-0` **dock spacer** of equal height reserves its space. No `paddingBottom` compensation.
- `ViewContent` is fluid width — no centred max-width cap.
- Header title + breadcrumb come from `VIEW_META`; views keep their own `sr-only <h1>`.
- BottomPanel resize: DOM-first during drag; React state on mouseup.
- Active view: **localStorage** via `usePersistedActiveView` (no React Router / URL routes).
- Splash gating: `useAppReady()` (fonts settled + one frame, 2s ceiling), not a fixed animation.

### Code splitting

- Views are `React.lazy` in `viewConfig.tsx`; `ViewContent` owns the only `<Suspense>`.
- `VIEW_PRELOADERS` warm chunks from `AppSidebar` `onPointerEnter` / `onFocus`. New view ⇒ both maps.
- `renderView` stays module-level so memoized `ViewContent` is not invalidated.
- No static **value** import from a view module into shell/shared — it rejoins the entry chunk. `import type` only.

### Command palette

- Registry in `shared/commands/` (`registry.ts` composes `appCommands` + `deviceCommands`); rendered by `app/shell/CommandPalette.tsx` over `cmdk`.
- `VIEW_META` names a view once — sidebar label, header title/breadcrumb and palette Navigate group all read it.
- `useGlobalShortcuts` owns **only** ⌘/Ctrl+K (capture phase + `stopPropagation`, so it beats view-local Ctrl+K). ⌘/Ctrl+B stays in `shared/ui/sidebar`, `Ctrl+\`` in `BottomPanel`. Every shortcut also gets a `SHORTCUT_HELP` row.

### Design tokens

- All colour/type/motion/z-index tokens in `src/styles/global.css`; no raw hex/rgb/oklch in components.
- Palette: **official shadcn Neutral** (light `oklch(1 0 0)` / dark `oklch(0.145 0 0)` background). Primary inverts with theme. Status colours (`success` / `warning` / `destructive` / `info`) describe **device** state, never UI emphasis.
- Surfaces: `canvas` < `surface` < `surface-raised` < `surface-overlay`.
- Type: 13px base; `display`/`title`/`body`/`label`/`caption`/`mono`/`mono-sm`, each with its own line-height/tracking/weight. **11px floor.** `numeric` utility on updating values.
- Motion: transform/opacity only; never `height`, never `all`.
- Fonts self-hosted from `public/fonts/`; CSP `font-src 'self'`.

### Feature modules

- Code under `src/features/<feature>/` with View + hooks/model/ui/utils as needed.
- Feature stores stay in feature `model/`; app-wide stores in `shared/stores/`.
- Persisted vs churn: durable selections in the persisted store, high-frequency progress in a sibling **non-persisted** store (`payloadProgressStore`, `memoryHistoryStore`, `operationStore`). `zustand/persist` writes `localStorage` synchronously on every `setState`.
- Long-running work registers with `operationStore` (`startOperation` / `updateOperation` / `finishOperation`) so `StatusBar` shows it — App Manager is wired; extend rather than adding a parallel mechanism.
- App Manager tabs: Install + Installed apps + Debloat (UAD).
- Package list icons: Rust `get_app_icons` (APK raster cache, batch 24) via `useAppIcons`; Lucide placeholders only while a batch is in flight / missing.

### Domain (Rust)

- Thin `commands/*`; logic in `adb/`, `payload/`, `marketplace/`, `scrcpy/`, `emulator/`, `debloat/`, `utilities/`, `host_setup/`, `apps/`, `flasher/`, `app_icons.rs`, `helpers.rs`.
- **All `adb` invocation goes through `adb::AdbClient`** — binary path resolved once per process (`OnceLock`), one exit-marker implementation, per-batch nonce markers.
- Critical shell: `AdbClient::shell_checked` (host OK ≠ shell OK); `helpers::adb_shell_checked` is a forwarder.
- Multiple device reads ⇒ `AdbClient::shell_batch` (N commands, 1 process, per-command exit codes). `get_device_telemetry` = 9 commands in 1 process.
- Rust returns **typed numbers**, not display strings; formatting is a frontend concern.
- `[profile.release]` is the speed profile (`opt-level = 3`, lto, 1 CGU). No `release-fast`, no `opt-level = "s"`.
- Payload: mmap/streaming; cancel tokens; `TransactionGuard` file-only cleanup; ZIP64 CD extras for remote factory ZIP.
- Events FE must use via runtime: `payload:progress`, `payload:load-progress`, `root:progress`, `scrcpy:download-progress`, `host-setup:progress`, `flasher:batch-progress`, `flasher:sideload-progress`.

### Precision Hardware Cockpits across feature views

| Area | Pattern |
| --- | --- |
| Marketplace | 4-tab Hardware Cockpit: `MarketplaceHeroBanner` (pulsating sync badge, device compatibility indicator, total apps, repository badges) + Overview & Curated (`CuratedPowerToolsGrid`, pure SVG `SourceCompositionDonut`, `CategoryDistributionMeter`, `MarketplaceGuideCard` ASCII sideloading pipeline) + Browse & Search (search bar, filter bar, grid/list mode, in-place `AppDetailView`) + Installed & Updates (`AppUpdateRow` with 1-click Update All batch runner) + Sources & Repos (`RepositorySourcesCard`, `GithubAuthCard` PAT rate limit, `CachePreferencesCard`) |
| Flasher | 4-tab Hardware Cockpit: `FlasherCockpitHero` (connection mode badge, lock state, active slot switcher, 6-spec hardware vitals) + Overview & Diagnostics (interactive pure SVG `PartitionHierarchyDiagram` and ASCII A/B hierarchy map, 6-row `PreFlightDiagnosticMatrix`, `FlasherKnowledgeBase`) + Partition Flasher (auto-detecting `DropArea`, partition selector chips, `SlotSwitcherCard`, `MultiPartitionQueue`) + Recovery Sideload (OTA/ROM ZIP sideload studio with live transfer tracker) + Partitions & Wipe (`WipeSafetyGate` multi-step safety authorization) |
| Payload Dumper | 4-tab Hardware Cockpit: `PayloadDumperHeroBanner` (format detection, uncompressed footprint, partition counts, folder reveal) + Overview & Telemetry (hand-rolled pure SVG `PayloadCompositionDonut`, top 10 largest `PartitionSizeBarChart`, `CompressionEfficiencyGauge`, 1-click `PayloadPresetsCard`, interactive `PayloadArchitectureGuide` for CrAU/Protobuf/blobs) + Extractor & Partitions (filter chips, search, `PartitionTableList`, `ExtractionLiveCockpit`) + Source & Remote Loader (local dropzone and remote HTTP stream loader with device catalog presets) + Extracted Outputs & History (`PayloadHistoryTab` output explorer) |
| Utilities | 5-tab Hardware Cockpit: `UtilitiesCockpitHero` (live ADB daemon port 5037 status, host toolchain versions, connected serial/mode, and server restart) + Overview & Quick Actions (`DeviceVitalsCard` 6-item live vitals, `InstantActionsCard` symmetrical 3x2 command grid, `AdbTransportGuideCard` interactive socket architecture guide) + Power & Tweaks (`TargetRebootCard` symmetrical 3x2 reboot grid, `SystemTweaksCard` window animations, dark mode, DPI) + Diagnostics (`ScreenshotStudioCard` frame capture, `LogcatStreamCard` real-time log buffer filter) + Fastboot (`FastbootSlotControlCard` active slot switcher & power, `FastbootGetVarCard` deep `getvar all` variable inspector) + Host Setup (`HostServerControlCard` server controls, `HostGoogleSetupCard` official Google platform-tools & USB driver installer) |
| Scrcpy | 5-tab Hardware Cockpit: `ScrcpyCockpitHero` (binary version status, active session count with live pulsing badge, connected target counter, primary Launch Mirror / Stop All actions) + Overview & Quick Mirror (`TargetDeviceSelector` multi-device selection, 4 tailored 1-click quality presets: Gaming, Productivity, Battery Saver, Creator, `ActiveSessionController` with floating toolbar toggle, `ShortcutsCheatSheet`) + Display & Video Engine (`ScrcpyDisplayTab` resolution presets, bitrate stepper with pure SVG bandwidth meter, FPS limiter, H.264/H.265/AV1 codecs) + Audio & Recording Studio (`ScrcpyAudioTab` audio forwarding and MP4/MKV recording studio) + Input, Controls & Keymaps (`ScrcpyInputTab` UHID/SDK/AOA keyboard and mouse forwarding, automation switches) + Binary Management (`ScrcpyBinaryTab` Genymobile binary lifecycle manager, live generated CLI preview) |
| Emulator | 4-tab Hardware Cockpit: `EmulatorCockpitHero` (selected AVD avatar, OS/API badge, CPU architecture, VM state badge, 8-spec hardware grid, quick switcher) + Overview & Telemetry (pure SVG `AvdResourceAllocationMeter`, `DiskUsageBreakdownChart`, `AvdHardwareSpecCard`, `EmulatorKnowledgeBase`) + AVD Launch Studio (`EmulatorLaunchStudioTab` with 5 quick startup presets and granular `LaunchFlagsCard`) + Root Engine (`EmulatorRootStudioTab` with Magisk/KernelSU wizard) + Snapshots & Restore (`EmulatorRestoreStudioTab` with snapshot backup plans and restore confirmation) |
| Host setup | Windows-only; official Google XML catalog; tools copy + HKLM Path vs USB `pnputil` are separate elevations; status from registry + `pnputil /enum-drivers`; bundled ADB unchanged |
### File Explorer

- View is thin: `FileExplorerView` + `useFileExplorerViewModel` + specialized hooks + `model/fileExplorerReducers`.
- Chrome: nav band then command band. Tree expand/collapse is the first command-band control. Band tooltips use `side="bottom"`.
- Sidebar: Places pins (Download, Documents, Pictures, DCIM, Movies, Music) then Device tree roots Internal storage `/sdcard/`, Root `/`, and Storage `/storage/` (`DirectoryTree` `INITIAL_NODES`).
- Details list: Name, Date modified, Type, Size. Pixel columns; leftover `1fr` after Size; each header divider resizes only the column to its left (`fe.colWidths.v2`).
- No `SelectionSummaryBar` here (that bar stays App Manager / debloat). Empty list area click clears selection. Checkbox sits in the Name cell.
- Stable `loadFiles` (refs; avoid historyIndex dep loops).
- Selection/sort: **pure** `setState` updaters only (no nested setters / ref writes inside updaters).
- Mutations re-list with `loadFiles(path, false)`.
- Snapshot serial before host dialogs; clear root grant on serial change.
- Hidden entries: device listing is `ls -lA`.
- Open allowlisted text (`.sh`, `.md`, `.txt`, `.toml`, `.xml`, `.bak`, … — not archives) by pulling to a unique temp name, then host editor (`code` / Notepad / Linux editors / macOS `open -t`). Saves are watched in Rust and pushed back (`files:edit-pushed`). **Show in Explorer** opens the matching MTP path in Windows Explorer when File transfer is on (not the temp editor folder). Copy/cut/paste is same-device only via `transfer_device_files` (overwrite dialog in the UI). Host OS drop imports via `OnFileDrop` + `host_path_kinds` + `push_file`. In-app drag onto folders / Places / tree / crumbs moves files. Drag-out to the host OS is not supported. Type column uses extension labels plus known extensionless names (`hosts`, `.gitignore`).

### Bottom panel

- Shell: `BottomPanel` + `PanelHeader` + `PanelHeaderActions` + `useBottomPanelResize`.
- Resize handle is focusable (`tabIndex={0}`) with keyboard height adjust.

### Packaging / release

| Pattern | Detail |
| --- | --- |
| Installers | Official **tauri-action** (not custom renamer for nsis/msi/deb/rpm/AppImage) |
| Portable | Custom `make-windows-portable.ps1` only |
| Version | package.json SoT; conf path; Cargo via `version:sync` |
| Artifacts | Per-bundle workflow artifacts; naming uses tauri-action `[platform]`/`[arch]`/`[setup]` |
| Identity | Display **ADB GUI Next**; id **com.astrixforge.adbguinext**; publisher Astrixforge |
| macOS | Resources/conf may exist; **builds paused** until explicit unpause |
| Signing | Not used |

### Desktop runtime

- Single-instance plugin: second launch focuses existing `main` window.
- Capabilities: `allow-device-read` + `allow-device-mutate` (+ core/plugin defaults).

### React quality (doctor 100 — keep green)

| Rule | Pattern |
| --- | --- |
| Updaters | Pure: return next state only |
| Effects | Timers/listeners always cleaned up |
| Motion | One `LazyMotion` in shell; leaf `m.*` (not full `motion`) |
| Anim | No animating layout `height`; prefer transform/opacity/grid 0fr→1fr |
| a11y | `type="button"`; semantic `<main>` |
| Lists | Stable keys / ids at write site (shell history) |
| Dead UI | Unused `shared/ui` → delete or real use; no suppressions |
| Multi-APK | Serial install/uninstall on one device |
| Theme first paint | Prefer `useSyncExternalStore` / lazy init — avoid `useEffect(() => setState(), [])` flash |
| High-churn state | Isolate the subscriber in a leaf (`UnreadLogBadge`), never in `MainLayout` |
| Lazy boundaries | No static value import from a view module into shell/shared |
| Buttons | Operational panel action grids use `variant="outline"` (`ActionButton` default); primary CTAs `default`; toolbars `ghost` |
Gate: `npx react-doctor@latest .` → expect 100 / 0 issues after FE changes that touch these areas.

## Anti-patterns

- Raw `invoke` / raw event listen in features
- React Router or Next.js patterns
- A second device-**list** poll outside `MainLayout`
- Fresh `Command::new(adb)` or hand-rolled exit markers instead of `adb::AdbClient`
- `opt-level = "s"` on `[profile.release]`, or re-adding a `release-fast` profile
- Google Fonts / CDN font loading (CSP is `font-src 'self'`)
- Type below 11px, or Tailwind default `text-xs`/`text-sm` in place of the scale tokens
- `paddingBottom` compensation for the fixed bottom panel
- `remove_dir_all` on user extract output dirs
- Auto-follow HTTP redirects without re-validating hops
- Reintroducing ESLint/Prettier as the FE toolchain (Ultracite is active)
- Reintroducing `collect-release-assets.ps1` / `verify-release-version.mjs`
- Shipping Linux aarch64 with wrong-arch bundled adb
- Claiming macOS first-class while builds are paused
- Charting libraries that write built-in prototypes at import time (Recharts / `decimal.js-light` vs `freezePrototype: true`)
- Viewport `sm:` / `md:` layout (window minWidth is 1024; use `@container`)

**Last updated:** 2026-08-17
