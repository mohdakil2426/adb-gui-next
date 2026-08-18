# Frontend module guide

`src/` owns the entire React/Vite client for ADB GUI Next. It must not own Rust domain logic (`src-tauri/`) or reintroduce Next.js / browser routing.

## Read first

- Root `AGENTS.md` (router)
- `docs/architecture.md` for cross-module design
- `docs/project_rules.md` for workflow and gates
- `src-tauri/AGENTS.md` when changing IPC contracts
- **Project skills** (below) before implementing matching UI work

## Skills

Project skills live under `.agents/skills/`. Load the matching skill **before** coding when the task touches that area.

| Skill |
| --- |
| `.agents/skills/frontend/shadcn/SKILL.md` |

- **References are mandatory:** after opening a skill, also read that skill’s `references/` (or linked docs) for files **relevant to the current work only** — not every reference blindly.
- Expand this table when more frontend skills are wired in.

## Ownership map

| Area | Path |
| --- | --- |
| Bootstrap | `src/main.tsx` → `src/app/App.tsx` (`QueryClientProvider`) |
| Shell | `src/app/shell/` — MainLayout, viewConfig, Header, AppSidebar, BottomPanel, ViewContent, StatusBar, CommandPalette |
| Command registry | `src/shared/commands/` — palette actions, `VIEW_META`, `NAV_SECTIONS`, shortcut reference |
| Desktop IPC only | `src/desktop/backend.ts`, `runtime.ts`, `models.ts` |
| Features | `src/features/<feature>/` — `*View.tsx`, optional `hooks/`, `model/`, `ui/`, `utils/` |
| Shared | `src/shared/{ui,components,stores,hooks,utils}/` |
| Design tokens | `src/styles/global.css` |
| Fonts | `public/fonts/` — self-hosted Inter + JetBrains Mono woff2 (+ OFL texts), preloaded in `index.html` |
| Tests | `src/test/` only |
| Alias | `@/` → `src/` (`vite.config.ts`) |

### Views (no React Router, code-split)

Defined in `src/app/shell/viewConfig.tsx`. Every view is a `React.lazy` dynamic import, and every view also has a `VIEW_PRELOADERS` entry:

| `ViewType` | Feature entry |
| --- | --- |
| `dashboard` | `features/dashboard/DashboardView.tsx` |
| `apps` | `features/app-manager/AppManagerView.tsx` |
| `files` | `features/file-explorer/FileExplorerView.tsx` |
| `marketplace` | `features/marketplace/MarketplaceView.tsx` |
| `flasher` | `features/flasher/FlasherView.tsx` |
| `utils` | `features/utilities/UtilitiesView.tsx` |
| `scrcpy` | `features/scrcpy/ScrcpyView.tsx` |
| `payload` | `features/payload-dumper/PayloadDumperView.tsx` |
| `emulator` | `features/emulator/EmulatorView.tsx` |
| `about` | `features/about/AboutView.tsx` |

- Switching: `MainLayout` view state (persisted to `localStorage` via `usePersistedActiveView`) + `VIEW_RENDERERS`. `renderView` must stay a **module-level** function — `ViewContent` is `memo`ized and a fresh closure defeats it.
- `ViewContent` owns the single `<Suspense>` boundary and its skeleton fallback. Do not add per-view `Suspense`.
- `AppSidebar` warms chunks with `VIEW_PRELOADERS[view]` on `onPointerEnter` / `onFocus`. A new view must be added to **both** maps.
- **Never let a static value-import cross the lazy boundary.** Importing any runtime value from a view module (or its heavy deps) into shell/shared code pulls that chunk back into the entry bundle and silently undoes the split. `import type` is fine.

### Command palette + navigation metadata (`src/shared/commands/`)

| File | Owns |
| --- | --- |
| `navigation.ts` | `VIEW_META` (title / icon / description / palette keywords), `NAV_SECTIONS`, `sectionForView` |
| `registry.ts` | `buildCommands(ctx)`, `COMMAND_GROUPS` (`actions` · `navigate` · `devices`) |
| `appCommands.ts` / `deviceCommands.ts` | Action definitions composed by the registry |
| `shortcuts.ts` | `MOD_KEY`, `SHORTCUT_HELP` — the app's whole keyboard surface, rendered by the palette |
| `types.ts` | `CommandAction`, `CommandContext`, `CommandGroupId` |

A view is named **once**, in `VIEW_META`. Sidebar label, header title/breadcrumb and the palette's Navigate group all read from it — do not hard-code a view title anywhere else.

Shortcut ownership is split on purpose: `useGlobalShortcuts` binds **only** ⌘/Ctrl+K, in the **capture** phase with `stopPropagation` so it beats view-local Ctrl+K handlers (Marketplace search binds the same chord on `window` in the bubble phase). ⌘/Ctrl+B stays in `shared/ui/sidebar`; `Ctrl+\`` stays in `BottomPanel`. Any new shortcut also needs a `SHORTCUT_HELP` row — that table is the only user-visible reference.

## Desktop IPC (`src/desktop/`)

- **Only** place for `core.invoke`, Tauri events, window file-drop, opener.
- `backend.ts` — typed wrappers (snake_case command names, camelCase args).
- `models.ts` — `namespace backend` DTOs; match Rust `#[serde(rename_all = "camelCase")]` (tagged enum **values** are camelCase too).
- `runtime.ts` — `EventsOn` / `EventsOff`, `OnFileDrop`, `BrowserOpenURL` (http/https only).
- Features must import `@/desktop/backend` and `@/desktop/runtime`, not raw `@tauri-apps/api/event` or scatter `invoke`.

### Known events (FE subscribers)

| Event | Used by |
| --- | --- |
| `payload:progress` | `features/payload-dumper/hooks/usePayloadEvents.ts` |
| `payload:load-progress` | `features/payload-dumper/hooks/usePayloadLoadEvents.ts` |
| `root:progress` | `features/emulator/ui/RootWizard.tsx` |
| `scrcpy:download-progress` | `features/scrcpy/hooks/useScrcpyProgress.ts` |
| `host-setup:progress` | `features/utilities/hooks/useHostSetupProgress.ts` |
| `files:edit-pushed` | `features/file-explorer/hooks/useFileExplorerClipboard.ts` |

### File drop

`OnFileDrop` is window-level (one active registration). Hit-test cursor `(x, y)` against element rects on **hover and drop**. One handler per page when multiple drop zones share the page.

## State

### App-wide stores (`src/shared/stores/`)

| Store / helper | File | Role |
| --- | --- | --- |
| `useDeviceStore` | `deviceStore.ts` | devices, selectedSerial, deviceInfo |
| `useLogStore` | `logStore.ts` | logs + bottom-panel chrome |
| `useShellStore` | `shellStore.ts` | shell history |
| `useWirelessAdbStore` | `wirelessAdbStore.ts` | wireless ADB form persistence |
| `useOperationStore` | `operationStore.ts` | long-running operations shown in the status bar (never persisted) |
| nickname helpers | `nicknameStore.ts` | localStorage helpers (not Zustand `create`) |

`logStore.unreadCount` is **high-churn** (every log line, ~100 call sites). Read it only from `UnreadLogBadge` / `UnreadLogAnnouncer`. Subscribing from `MainLayout` re-renders header, sidebar, panel and the whole active view once per log line.

`operationStore` producers (`startOperation` / `updateOperation` / `finishOperation`) are plain functions, safe to call outside React. Currently wired from App Manager only (install, uninstall, debloat batch, backup restore) — extend to flasher / payload / emulator rather than adding a second progress mechanism.

### Feature stores (under `features/*/model/`)

- `app-manager/debloater/model/debloatStore.ts`, `installationStore.ts`
- `marketplace/model/marketplaceStore.ts`
- `payload-dumper/model/payloadDumperStore.ts` (persisted, `partialize`d — durable selections/settings only)
- `payload-dumper/model/payloadProgressStore.ts` (**not** persisted — high-frequency extraction progress)
- `emulator/model/emulatorManagerStore.ts`
- `dashboard/model/memoryHistoryStore.ts` (**not** persisted — session RAM samples for the sparkline)

**Never put high-frequency updates in a `zustand/persist` store.** `persist` wraps every `setState` with `partialize` + `JSON.stringify` + a blocking `localStorage.setItem` — no dirty check, no debounce. Split the churn into a sibling non-persisted store, as `payloadProgressStore` does.

File Explorer, Flasher, Utilities, About: local React state / hooks (no feature Zustand required).

### TanStack Query

- Provider defaults: `App.tsx` — `staleTime: STALE_TIME.DEFAULT` (30 s), `gcTime: 5m`, `retry: false`, `refetchOnWindowFocus: false`. Every query spawns an adb/fastboot subprocess; do not restore focus-refetch or blind retries globally. Queries that need to be fresher opt in individually.
- **Device *list* poll only in `MainLayout`:** `queryKeys.allDevices()`, `STALE_TIME.ALL_DEVICES` = **30_000** ms (`shared/utils/queries.ts`). `fetchAllDevices` merges ADB + fastboot by serial.
- **Do not** add a second device-list poll.
- Dashboard telemetry: `features/dashboard/hooks/useDeviceTelemetry.ts` — `GetDeviceTelemetry` for the selected serial, `staleTime` 10 s, `refetchInterval` 15 s, and the interval **stops on error** (inline error state carries the retry, no toast loop). Mounted only while the Dashboard is; it also feeds `deviceStore.setDeviceInfo` via `toLegacyDeviceInfo` and records `memoryHistoryStore` samples.
- Emulator view: separate AVD list poll (`STALE_TIME.EMULATOR_LIST`) in `EmulatorView.tsx` (AVDs only, not phone devices).
- Query keys / `STALE_TIME` catalog: `shared/utils/queries.ts`.
- Prefer `GetDeviceTelemetry` (typed numbers) over `GetDeviceInfo` (display strings) for anything charted, compared or computed. `GetDeviceInfo` currently has no caller.

## Shell / layout invariants

- Outer boundary: `h-svh overflow-hidden` on MainLayout.
- `SidebarProvider` fills with `h-full` (not `min-h-svh`).
- Header: structural `shrink-0` pin (44px) — no sticky hacks. Visible page title + breadcrumb come from `VIEW_META`; views keep their own `sr-only` `<h1>` (exactly one per view).
- Column order inside `SidebarInset`: Header → `ViewContent` (`flex-1 min-h-0`) → `StatusBar` (26px) → bottom-panel dock. `BottomPanel` is still `position: fixed`; the dock is a `shrink-0` spacer of the same height so `<main>` gets honest height. **No `paddingBottom` compensation.** When the panel becomes a static flex child, delete the dock.
- `ViewContent` is fluid width — no `max-w-(--content-max-width)` cap.
- Main scroll: `main-scroll-area` with `overflow-y-auto overflow-x-hidden` by default; File Explorer and Marketplace may own internal scroll.
- Preserve `min-w-0` chain for truncating text.
- BottomPanel resize: DOM-first during drag; React height commit on mouseup.
- Splash gating: `useAppReady()` (fonts settled + one frame, 2 s ceiling). Do not reintroduce a fixed-duration fake progress animation.
- Sonner: top-right in `MainLayout`.
- New view: update `viewConfig.tsx` (**renderer + preloader**) + `shared/commands/navigation.ts` (`VIEW_META`, `NAV_SECTIONS`) + add `features/<feature>/`.

## Adaptivity — container queries, not viewport breakpoints

This is a resizable desktop window, not a web page. `src-tauri/tauri.conf.json` pins it to **`minWidth: 1024, minHeight: 720`**.

| Rule | Why |
| --- | --- |
| **Never use `sm:` (640px) or `md:` (768px).** | They can never evaluate false above a 1024px floor — permanently-on conditionals that mislead the next reader. |
| **Use `@container` + `@xs`/`@sm`/`@lg`/`@xl`/`@2xl`/`@4xl`.** | The content width tracks the **sidebar** (`16rem` expanded ↔ `3rem` icon-only), not the window. At a 1280px window the content box is ~974px or ~1182px depending only on `Ctrl+B`. Viewport queries are blind to that. |
| Viewport queries only for genuine window-size concerns | e.g. bottom-panel max height. Pick a threshold meaningfully above 1024px. |
| **No fixed `vh` list heights** (`h-[40vh]`, `max-h-[38vh]`). | At the 720px minimum height with header (44px), status bar (26px) and an open bottom panel, they overflow or waste space. Use `min-h-0` + `flex-1` so lists fill what is actually available. |
| No horizontal page scroll at any size | Wide content scrolls inside its own container. |

Container scale (Tailwind 4.3.3 defaults): `@xs` 20rem · `@sm` 24rem · `@lg` 32rem · `@xl` 36rem · `@2xl` 42rem · `@4xl` 56rem.

**Reference arithmetic** — the narrowest real content box is the 1024px window with the sidebar expanded: `1024 − 256 (sidebar) − 40 (p-5) − 10 (scrollbar gutter) ≈ 718px`. Size breakpoints against that, not against the window.

Check any layout change at: 1024×720 sidebar-expanded **with the bottom panel open** (tightest real case), 1024×720 collapsed, 1280×820 (default), and 2560×1440 (cards must not smear to absurd line lengths).

## UI / style invariants

- Vite/Tauri client only — no Next.js patterns, no router.
- Prefer `@/` imports; `import type` for type-only imports.
- shadcn primitives in `shared/ui/`; feature UI stays in `features/`.
- Design tokens from `global.css` — no raw hex/rgb/oklch in components.
- **Palette ("Neutral"):** official shadcn Neutral tokens in `src/styles/global.css` (`:root` / `.dark`). Dark canvas is `oklch(0.145 0 0)`, not true black. `success` / `warning` / `destructive` / `info` describe **device** state, never UI emphasis.
- **Surfaces:** `canvas` < `surface` < `surface-raised` < `surface-overlay`. Pick a level; do not invent one with an ad-hoc `bg-*`.
- **Type scale** (each token carries its own line-height, tracking and weight — no companion `leading-*` / `font-*` needed):

  | Token | Size | Use |
  | --- | --- | --- |
  | `text-display` | 24px | view titles |
  | `text-title` | 17px | card headers, dialog titles |
  | `text-body` | **13px** | default body copy (base scale) |
  | `text-label` | 12px | form labels, table headers |
  | `text-caption` | 11px | metadata, timestamps, badges |
  | `text-mono` / `text-mono-sm` | 12 / 11px | serials, paths, logs, shell (pair with `font-mono`) |

  **11px is the floor** — nothing may be smaller. Do not use Tailwind's default `text-xs` / `text-sm` sizes in place of these.
- Numeric readouts (tables, byte counts, percentages, telemetry) get the `numeric` utility so digits do not jitter.
- Motion: `--motion-*` durations + `ease-standard`. Transform/opacity only — never `height`, never `all`.
- Fonts are **self-hosted** (`public/fonts/`, `@font-face` in `global.css`, preload in `index.html`). CSP allows `font-src 'self'` only — never re-add a Google Fonts link or CDN.
- **No charting library.** All charts are hand-rolled SVG/CSS against the `chart-1..5` tokens. Recharts was removed: its `decimal.js-light` dependency assigns `Decimal.prototype.valueOf` at module-eval time, which throws under Tauri `freezePrototype: true` and crashes the whole view. That failure is invisible to `vite build`, Vitest and the browser preview — it only reproduces inside the webview.
- `gap-*` not `space-x-*` / `space-y-*`; `size-*` when width === height.
- Icon buttons: `aria-label`. Rows: keyboard accessible or real `<button>`.
- Every non-submit `<button>` needs `type="button"`. Prefer semantic `<main>` over `role="main"`.
- **Button hierarchy & consistency:** Operational panel action grids (Host, ADB, Fastboot, Power) use `variant="outline"` (`ActionButton` default) with border definition for unified card grids. Primary CTAs use `default`, destructive actions use `destructive`, and icon-only toolbars use `ghost`.
- Errors: `try/catch` + `handleError` / toast + logs (`shared/utils/errorHandler.ts`).

## React correctness (keep doctor green)

Baseline after 2026-07-18 pass: **100/100** (`npx react-doctor@latest .`). Do **not** reintroduce:

| Avoid | Correct |
| --- | --- |
| Side effects inside `setState(prev => …)` (other setters, ref writes, flags) | Pure updater; effects in handler / `useEffect` |
| Timers without cleanup | `return () => clearTimeout/clearInterval` |
| Animate CSS `height` | transform / opacity / `grid-rows-[0fr]`↔`[1fr]` |
| Full `import { motion }` under shell | `LazyMotion` once in `MainLayout`; leaves use `m` |
| Index keys on dynamic lists | Stable ids (shell history: `id` when pushing) |
| Dead unused `shared/ui/*` / unused exports | Delete or wire a real call site — never eslint-disable / fake import |
| Parallel multi-APK on one serial | Serial only (`InstallationTab` mapSerial pattern) |
| `useEffect(() => setMounted(true), [])` for theme/UI flash | `useSyncExternalStore` or lazy `useState` init |
| Subscribing the shell root to a high-churn counter (`logStore.unreadCount`) | Isolated leaf subscriber (`UnreadLogBadge` / `UnreadLogAnnouncer`) |
| High-frequency writes into a `zustand/persist` store | Sibling non-persisted store (`payloadProgressStore`) |
| Static **value** import from a lazy view module into shell/shared | `import type`, or move the value into `shared/` |

Dead kit removed (do not re-add without product need): `avatar`, `radio-group`, `slider`, `toggle`, `collapsible` (keep `toggle-group` + `toggle-variants`).

Re-added **with real call sites** — each stays only while its call site exists:

| Primitive | Call site |
| --- | --- |
| `command` (+ `cmdk`) | global ⌘K palette — `app/shell/CommandPalette.tsx`, registry in `shared/commands/` |
| `kbd` | shortcut chips in `Header` and the palette footer / shortcut reference |
| `breadcrumb` | `Header` view breadcrumb from `VIEW_META` / `sectionForView` |

### Charts — do not add a charting library

`MemorySparkline` (polyline + gradient), `PackageCompositionDonut` (`stroke-dasharray` arcs), `PartitionSizeChart` (CSS grid bars), `BatteryGauge` and `UsageBar` are all hand-rolled. Any library that writes to a built-in prototype at import time (`recharts` → `decimal.js-light`) is incompatible with `freezePrototype: true` in `src-tauri/tauri.conf.json`.

## Feature invariants (verified)

| Feature | Must keep |
| --- | --- |
| Device targeting | Pass `selectedSerial` into device-scoped desktop APIs |
| Dashboard | Telemetry auto-loads on device selection (no "click refresh to load" dead end); formatting stays in the frontend (`shared/utils/format.ts`) — the backend returns numbers |
| File Explorer | Stable `loadFiles` (refs, not historyIndex in deps); mutations re-list with `loadFiles(path, false)`; empty state `fileList.length === 0 && creatingType === null`; snapshot serial before host dialogs; clear root grant on serial change; text files open via Rust pull + host editor (VS Code / Notepad). **Show in Explorer** opens the same path in Windows Explorer over MTP (File transfer) — not the editor temp folder. Copy/cut/paste and overwrite live in `transfer_device_files`; editor saves emit `files:edit-pushed`. Host files/folders drop into the open pane (or a folder / Place / tree / crumb) via `OnFileDrop` + `host_path_kinds` then serial `push_file`. In-app row/tree/Places/crumb drops move with `application/x-adb-gui-files`. Drag-out to Windows Explorer is not supported (no WebView2 file drag-out API). Chrome is nav band then command band (tree toggle first). Places + Device tree roots Internal storage `/sdcard/`, Root `/`, and Storage `/storage/`. Details columns Name / Date modified / Type / Size; Type uses extension and extensionless names (`hosts`, `.gitignore`, …). resize the column to the left of a divider; leftover width after Size (`fe.colWidths.v2`). No `SelectionSummaryBar`; empty-list click clears selection; checkbox lives in the Name cell |
| Debloat | Reload when `selectedSerial` changes; SDK-aware actions; DTO field `listStatus` (camelCase) |
| Marketplace | Install with selected serial; session-only PAT/OAuth (not localStorage); provider orchestration stays on Rust side; FE only filters/caches last search results |
| Emulator | AVD discovery is backend `~/.android/avd/*.ini`; root progress via `EventsOn('root:progress')` only |
| Payload Dumper | Progress/load via runtime events above; cancel tokens when using cancellable extract |
| Scrcpy | Official Genymobile binaries in app data; detached native window; CLI flags only; multi-device targeting; live session detection & targeted stop; presets catalog; `scrcpy:download-progress` |
| Utilities | Grouped host / power / diagnostics / fastboot; typed server + version IPC; wipe types `WIPE`; Windows-only Google platform-tools and USB driver as **separate** installs to `C:\Android\platform-tools` (system Path + `pnputil`) |
| App Manager list | Visible-row icon batch via `get_app_icons` (max 24); Lucide fallback when no raster |

## Tests

- All Vitest FE tests live under `src/test/`.
- No committed `.only` / `.skip`.
- IPC allowlist regression: `src/test/tauriPermissions.test.ts` when command permissions change.

## Validation

| Change type | Minimum gate |
| --- | --- |
| Docs only under `src/` | `git diff --check` |
| Frontend code | `bun run lint:web`, `bun run test`, `bun run build` |
| FE quality / doctor-sensitive | Also `npx react-doctor@latest .` when touching state/effects/motion/lists/unused ui |
| IPC contract | Also update `src-tauri` handler + permissions + desktop models |

Full gate (`bun run check`) only after **all** tasks for the request finish — see `docs/project_rules.md`.
