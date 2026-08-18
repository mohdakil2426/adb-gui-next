# Design

Desktop toolkit, not a website. Dense, quiet, official **shadcn Neutral**. Colour never shouts; **device state** may.

Tokens: `src/styles/global.css`. Primitives: `src/shared/ui/`. Composites: `src/shared/components/`. Feature chrome: `src/features/<name>/`. Names: `VIEW_META` once (`src/shared/commands/navigation.ts`).

## Taste

- Achromatic chrome. Primary **inverts** (near-black light / near-white dark).
- One language: same tabs, cards, type, radius, gaps (`gap-4` / `gap-5`).
- 13px body. No gradients, no chart libs, no second UI kit.
- If it isn’t a token class, it doesn’t ship.
- **Precision Hardware Cockpit**: Dense, quiet, dark/light achromatic surfaces with device-state-driven illumination. High data density, zero text truncation, and hover-activated utilities.
## Theme

`components.json`: New York, `baseColor: "neutral"`. Dark is **gray**, not OLED black. `next-themes` puts `class="dark"` on `<html>`. Shell: `bg-background text-foreground`.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--card` / `--popover` | white | `oklch(0.205 0 0)` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--muted` / `--accent` / `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--border` / `--input` | `oklch(0.922 0 0)` | white 10% / 15% |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| `--radius` | `0.625rem` | same; scale `sm…4xl` from it |

Aliases: `canvas`→background · `surface`→card · `surface-raised`→secondary · `surface-overlay`→popover · `border-control`→input.

`success` / `warning` / `info` / `destructive` = device, danger, or ADB dots — never decorative headers. Device-status triples live as `--device-status-*`. Toasts: Sonner + **our** tokens, `resolvedTheme`. Overlays: official `bg-black/50`. No raw hex/rgb/oklch in components. `index.html` theme-color: `#ffffff` / `#242424`.

## Type

Token = size + leading + tracking + weight. No `text-xs`/`text-sm`, no extra `leading-*`/`font-*`.

| Class | px | Use |
| --- | --- | --- |
| `text-display` | 24 | rare; header owns the visible title |
| `text-title` | 17 | cards, dialogs |
| `text-body` | **13** | default |
| `text-label` | 12 | labels, table heads |
| `text-caption` | 11 | meta, badges — **floor** |
| `text-mono` / `text-mono-sm` | 12 / 11 | serials, paths, logs (+ `font-mono`) |

Updating numbers: `numeric`. One `sr-only` `<h1>` per view. Fonts: self-hosted Inter + JetBrains Mono.

## Layout

Window **min 1024×720**. Content width tracks sidebar (`16rem` ↔ `3rem`), not viewport.

- Never `sm:`/`md:`. `@container` + `@xs`/`@sm`/`@lg`/`@xl`/`@2xl`/`@4xl`.
- No `vh` list heights. `min-h-0` + `flex-1`. `gap-*`, square `size-*`.
- Motion: transform/opacity only (`--motion-*`, `ease-standard`). Never `height`/`all`. `LazyMotion` once in `MainLayout`.
- Column: Header 44px → `ViewContent` fluid → StatusBar 26px → bottom-panel dock. Main: `main-scroll-area`. Files + Marketplace may own inner scroll.

## Shell

| Piece | What it looks like |
| --- | --- |
| Splash | `WelcomeScreen` over `LoadingScreen` (fonts + 1 frame, 2s cap) |
| Sidebar | `bg-sidebar`. Sections **Device** / **Firmware** (risk) / **Tools**. About in footer. Hover/focus preloads the view chunk. `Ctrl+B` |
| Header | Breadcrumb + `VIEW_META` title (not `<h1>`). `DeviceSwitcher`, `ThemeToggle`, command-palette trigger (`Kbd`), logs/shell toggles + `UnreadLogBadge` |
| Palette | ⌘/Ctrl+K, `command` + `Dialog`. Groups: actions / navigate / devices. Footer shortcut legend |
| Status bar | ADB dot (`warning`/`success`/`destructive`) + selected device + in-flight `operationStore` |
| Bottom panel | `Ctrl+\``. Tabs Logs / Shell. `terminal-*` (aliased to theme). Resize DOM-first, commit on mouseup. Hidden on About |

No device? Dashboard onboarding + header switcher — don’t invent a second empty chrome.

## Screens

| View | Layout |
| --- | --- |
| **Dashboard** | No device → `NoDeviceOnboarding`. Else `DeviceHeroBanner` (pulsating connection badge, 8-spec hardware grid with hover-only copy buttons: Serial, Platform, Architecture, Security Patch, Kernel Version, Build Number, Uptime, Locale/Timezone) followed by two equal-height rows (`items-stretch` + `PanelCard` `h-full flex flex-col justify-between`):<br>• Row 1 (Vitals): `BatteryPanel` (120px dual-arc radial `BatteryGauge` + 4-chip electrical/thermal grid), `MemoryPanel` (used/available ratio bar + `MemorySparkline` area waveform), `StoragePanel` (partition cards for `/data` and `/sdcard` with capacity meters).<br>• Row 2 (Controls & Security): `SecurityPanel` (6 full-width vertical diagnostic status rows, zero truncation), `QuickActionsPanel` (3×2 symmetric action grid: Screen Mirror, Open Shell, System, Bootloader, Recovery, Fastbootd), `WirelessAdbPanel` (Wi-Fi network status + TCP/IP connect). Reboot = confirm dialog |
| **Applications** | Donut summary, then one card of **equal tabs**: Install / Installed / Debloat |
| **File Explorer** | Nav band (back/forward/up/refresh + address + search). Command band: tree toggle first, then **New** + icon groups (no labels on rename/delete/root/transfer). Tooltips open below both bands. Split: Places (Download, Documents, Pictures, DCIM, Movies, Music), then Device tree (Internal storage `/sdcard/`, Root `/`, Storage `/storage/`). Details list: Name, Date modified, Type, Size — pixel columns, leftover after Size, drag header dividers. Type column uses extension and known extensionless names (Text Document, zip Archive, Hosts File, `.gitignore`). Checkbox in Name. Empty-area click clears selection; no selection summary bar. Owns scroll. Delete = `AlertDialog`. Copy/cut/paste is same-device only; Replace dialog when the dest exists. … |
| **Marketplace** | Device banner + search (`InputGroup`/`Popover`) + `FilterBar` (chips, `Switch`, `ToggleGroup` grid/list) + results (`AppCard` / list) or `Empty`. Detail in-place. Settings = `Dialog`. Owns scroll |
| **Flasher** | Fastboot `DeviceGate`. Cards: image drop + partition `Input`, sideload, danger wipe. Confirms before flash |
| **Payload Dumper** | Empty: equal tabs Local / Remote (`DropZone` / `RemoteUrlPanel`). Loaded: partition table + `PartitionSizeChart` + extract progress cards |
| **Utilities** | `TabsWithIcon` Host / ADB / Fastboot. Host = server + Windows setup. ADB = power + logcat/screenshot. Fastboot = slots/wipe. Default tab follows device mode |
| **Scrcpy** | Cards: status (`ScrcpyStatusCard` with version stats, download/redownload with filled/outline state, update check, open folder, uninstall with `ConfirmDialog` + `Progress`) + session options (`ScrcpySessionCard` with `ScrcpyDeviceSelector` multi-device selection, live mirroring pulse badges, per-device stop, presets dropdowns + custom manual inputs for max size (Original default), bitrate, FPS, codecs, audio, flags, dynamic Launch ↔ Stop Mirror CTA, and companion floating pill toolbar opener). Launch opens a **native** window (not in-webview) paired with an Android Studio-style secondary floating toolbar (`scrcpy-toolbar-*`) supporting Freeform and Lock (magnetic window tracking + Y-offset sliding) modes |
| **Emulator** | Toolbar + AVD list. Card tabs: Launch / Root / Restore. Root wizard has its own equal tabs. Restore = confirm |
| **About** | Elevated `AboutHero` banner with version badge + build channel status on right side; equal-height 2-column stretched grid for `Build` (specs + bundled platform-tools) and `Licence` (MIT terms + copyright attribution + action links); bottom full-width interactive card grid for `Built with` (clickable tech tiles opening official URLs via `BrowserOpenURL`). No bottom panel |
## Primitives (`src/shared/ui`)

shadcn New York + Radix + Lucide. Edit here; don’t fork.

| Kit | Rule |
| --- | --- |
| **tabs** | List `w-full`; triggers `flex-1`. Active: light `bg-background`+shadow; dark `bg-input/30`+`border-input`. No `variant="line"`, no `grid-cols-*`. Never `flex` on `TabsContent` (breaks hide). Icon helper: `TabsWithIcon` (`src/components/shadcn-studio/tabs/tabs-03.tsx`) |
| **button** | `default`/`destructive`/`outline`/`secondary`/`ghost`/`link`. Operational card action grids (Host, ADB, Fastboot, Power) standardize on `variant="outline"` (`ActionButton` default). Depth = inset `--control-highlight`, not glow. Icon: `aria-label`. Non-submit: `type="button"` |
| **card** | `bg-card`/`bg-surface`, `border-border`, `rounded-lg`/`xl`. Dense views: `shadow-none` |
| **input** / **textarea** / **select** / **checkbox** | `border-border-control`, `dark:bg-input/30`. Placeholder `text-muted-foreground` |
| **input-group** | Compound search/path fields (Marketplace, shell) |
| **field** | Label + description stacks on forms |
| **badge** | Metadata `text-caption`. Solid `success`/`warning`/`destructive` only for status. Else `neutral`/`info`/`secondary`/`outline` |
| **dialog** / **alert-dialog** / **sheet** | Overlay `bg-black/50`. Confirms for destructive |
| **dropdown-menu** / **context-menu** / **popover** / **tooltip** | `bg-popover` |
| **command** + **kbd** | Palette only (plus shortcut chips) |
| **breadcrumb** | Header only |
| **sidebar** | Official sidebar tokens |
| **table** | File explorer, payload partitions, installed apps |
| **empty** | Onboarding + in-card voids (`EmptyState` wraps it; `tone="danger"` for failures) |
| **skeleton** | Loading placeholders |
| **progress** | Determinate host jobs (scrcpy download) |
| **switch** / **toggle-group** | Settings, Marketplace filters |
| **separator** / **scroll-area** / **label** | Structure |
| **sonner** | Top-right in `MainLayout` |
| **alert** | Inline warnings inside cards |

Dead — do not re-add: `avatar`, `radio-group`, `slider`, `toggle` (keep `toggle-group`), `collapsible`.

## App composites (`src/shared/components`)

`DeviceSwitcher` · `ThemeToggle` · `EmptyState` · `DropZone` · `FileSelector` · `RemoteUrlPanel` · `ConfirmDialog` · `EditNicknameDialog` · `SectionHeader` · `SelectionSummaryBar` · `DirectoryTree` · `CopyButton` · `RefreshButton` · `LoadingButton` / `ActionButton` · `CheckboxItem` · `UnreadLogBadge` · `WelcomeScreen` · `ErrorBoundary`.

## Charts

Hand-rolled only (`chart-1..5`): `BatteryGauge` (dual-arc radial with charging aura), `UsageBar`, `MemorySparkline` (SVG gradient area waveform with interactive scrubber), `PackageCompositionDonut`, `PartitionSizeChart`. No Recharts — `freezePrototype: true` invariant.

## Precision Hardware Cockpit UI Patterns

### 1. Hero Header Pattern (`DeviceHeroBanner`, `AboutHero`)
- **Container**: Elevated card (`rounded-xl border border-border bg-surface p-4.5 shadow-none`).
- **Branding Box**: Leading avatar container (`size-12 rounded-2xl border border-border/80 bg-surface-raised`) with live pulsating connection badge (`animate-ping bg-success`).
- **Metadata & Inline Actions**: Primary title (`text-title font-semibold`), inline nickname edit button, and status pills (`Badge`).
- **Consolidated Top-Right Sync**: Subtle timestamp + single multi-action sync button (`RefreshCw` with `animate-spin`). Never place floating action rows above the card.
- **8-Spec Hardware Grid**: Multi-column responsive grid (`grid @3xl:grid-cols-4 @sm:grid-cols-2 grid-cols-1 gap-2.5 border-border/50 border-t pt-3`):
  - **Row 1 (Software Stack)**: Platform (OS/API) ➔ Build Number ➔ Security Patch ➔ Kernel Version.
  - **Row 2 (Hardware & Environment)**: Serial Number ➔ Architecture/SOC ➔ Device Uptime ➔ Locale/Timezone.
  - **Hover-Only Copy Utility**: All copyable values carry a copy button that fades in on hover (`opacity-0 group-hover:opacity-100 transition-opacity`) to keep the interface clean and quiet.

### 2. Equal-Height Stretched Grid System (`TRIO_GRID_CLASS` + `PanelCard`)
- Multi-column rows use `items-stretch` and panels use `PanelCard` with `h-full flex flex-col justify-between`.
- `<CardContent>` uses `flex-1 flex flex-col justify-between` to guarantee equal top and bottom baselines across all cards in the row with zero jaggedness.

### 3. Full-Width Diagnostic Vertical Lists vs Squeezed Grids
- When cards sit in a 3-column macro row (~300px local width), **never** use inner multi-column grids that squeeze cells into <150px and cause `...` ellipsis truncation.
- Instead, use full-width vertical rows with `flex flex-1 flex-col justify-between gap-1.5` where metric label is on the left and semantic icon + status value is on the right.

### 4. Symmetrical 3×2 Action Grids
- Operational action panels pair actions symmetrically (e.g. Row 1: Primary tools `Screen Mirror` + `Open Shell`; Rows 2-3: Target reboots).

### 5. Toast Color Interpolation Invariant (`sonner`)
- All color-mixing in `sonner.tsx` MUST use `in oklab` (never `in oklch` over achromatic neutral surfaces) to eliminate reddish-brown hue interpolation artifacts.
- Toast background is locked to `var(--surface-raised)`, text to `var(--foreground)`, and status icons to semantic tokens (`text-success`, `text-destructive`, `text-warning`, `text-info`).

## Do not

True-black canvas. Viewport breakpoints. Next.js / extra kits. Status colour as decoration. Dead unused primitives. Static value-imports across lazy view boundaries. Squeezed multi-column inner grids that truncate telemetry text.

Code wins; then update this file.
