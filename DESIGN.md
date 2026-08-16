# Design

Desktop toolkit, not a website. Dense, quiet, official **shadcn Neutral**. Colour never shouts; **device state** may.

Tokens: `src/styles/global.css`. Primitives: `src/shared/ui/`. Composites: `src/shared/components/`. Feature chrome: `src/features/<name>/`. Names: `VIEW_META` once (`src/shared/commands/navigation.ts`).

## Taste

- Achromatic chrome. Primary **inverts** (near-black light / near-white dark).
- One language: same tabs, cards, type, radius, gaps (`gap-4`).
- 13px body. No gradients, no chart libs, no second UI kit.
- If it isn’t a token class, it doesn’t ship.

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
| **Dashboard** | No device → `NoDeviceOnboarding`. Else `PanelCard` grid (`@lg` 2 / `@4xl` 3): identity, battery (`BatteryGauge`), memory (`UsageBar` + sparkline), storage, security, quick actions, wireless ADB. Reboot = confirm dialog |
| **Applications** | Donut summary, then one card of **equal tabs**: Install / Installed / Debloat |
| **File Explorer** | Split pane (`bg-surface` + border): tree + table. Breadcrumb path, toolbar, checkboxes, context menu, virtualized rows. Owns scroll. Delete = `AlertDialog` |
| **Marketplace** | Device banner + search (`InputGroup`/`Popover`) + `FilterBar` (chips, `Switch`, `ToggleGroup` grid/list) + results (`AppCard` / list) or `Empty`. Detail in-place. Settings = `Dialog`. Owns scroll |
| **Flasher** | Fastboot `DeviceGate`. Cards: image drop + partition `Input`, sideload, danger wipe. Confirms before flash |
| **Payload Dumper** | Empty: equal tabs Local / Remote (`DropZone` / `RemoteUrlPanel`). Loaded: partition table + `PartitionSizeChart` + extract progress cards |
| **Utilities** | `TabsWithIcon` Host / ADB / Fastboot. Host = server + Windows setup. ADB = power + logcat/screenshot. Fastboot = slots/wipe. Default tab follows device mode |
| **Scrcpy** | Cards: install/update + `Progress`; session options; launch opens a **native** window (not in-webview) |
| **Emulator** | Toolbar + AVD list. Card tabs: Launch / Root / Restore. Root wizard has its own equal tabs. Restore = confirm |
| **About** | Identity strip + `AboutCard` rows (version, tools, licence, links). No bottom panel |

## Primitives (`src/shared/ui`)

shadcn New York + Radix + Lucide. Edit here; don’t fork.

| Kit | Rule |
| --- | --- |
| **tabs** | List `w-full`; triggers `flex-1`. Active: light `bg-background`+shadow; dark `bg-input/30`+`border-input`. No `variant="line"`, no `grid-cols-*`. Never `flex` on `TabsContent` (breaks hide). Icon helper: `TabsWithIcon` (`src/components/shadcn-studio/tabs/tabs-03.tsx`) |
| **button** | `default`/`destructive`/`outline`/`secondary`/`ghost`/`link`. Depth = inset `--control-highlight`, not glow. Icon: `aria-label`. Non-submit: `type="button"` |
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

Hand-rolled only (`chart-1..5`): `BatteryGauge`, `UsageBar`, `MemorySparkline`, `PackageCompositionDonut`, `PartitionSizeChart`. No Recharts — `freezePrototype`.

## Do not

True-black canvas. Viewport breakpoints. Next.js / extra kits. Status colour as decoration. Dead unused primitives. Static value-imports across lazy view boundaries.

Code wins; then update this file.
