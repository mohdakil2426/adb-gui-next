# Frontend module guide

`src/` owns the entire React/Vite client for ADB GUI Next. It must not own Rust domain logic (`src-tauri/`) or reintroduce Next.js / browser routing.

## Read first

- Root `AGENTS.md` (router)
- `docs/architecture.md` for cross-module design
- `docs/project_rules.md` for workflow and gates
- `src-tauri/AGENTS.md` when changing IPC contracts

## Ownership map

| Area | Path |
| --- | --- |
| Bootstrap | `src/main.tsx` → `src/app/App.tsx` (`QueryClientProvider`) |
| Shell | `src/app/shell/` — MainLayout, viewConfig, Header, AppSidebar, BottomPanel, ViewContent |
| Desktop IPC only | `src/desktop/backend.ts`, `runtime.ts`, `models.ts` |
| Features | `src/features/<feature>/` — `*View.tsx`, optional `hooks/`, `model/`, `ui/`, `utils/` |
| Shared | `src/shared/{ui,components,stores,utils}/` |
| Theme | `src/styles/global.css` |
| Tests | `src/test/` only |
| Alias | `@/` → `src/` (`vite.config.ts`) |

### Views (no React Router)

Defined in `src/app/shell/viewConfig.tsx`:

| `ViewType` | Feature entry |
| --- | --- |
| `dashboard` | `features/dashboard/DashboardView.tsx` |
| `apps` | `features/app-manager/AppManagerView.tsx` |
| `files` | `features/file-explorer/FileExplorerView.tsx` |
| `marketplace` | `features/marketplace/MarketplaceView.tsx` |
| `flasher` | `features/flasher/FlasherView.tsx` |
| `utils` | `features/utilities/UtilitiesView.tsx` |
| `payload` | `features/payload-dumper/PayloadDumperView.tsx` |
| `emulator` | `features/emulator/EmulatorView.tsx` |
| `about` | `features/about/AboutView.tsx` |

Switching: `MainLayout` `useState<ViewType>` + `VIEW_RENDERERS`. Active view is not URL-persisted (reload → dashboard).

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
| nickname helpers | `nicknameStore.ts` | localStorage helpers (not Zustand `create`) |

### Feature stores (under `features/*/model/`)

- `app-manager/debloater/model/debloatStore.ts`, `installationStore.ts`
- `marketplace/model/marketplaceStore.ts`
- `payload-dumper/model/payloadDumperStore.ts`
- `emulator/model/emulatorManagerStore.ts`

File Explorer, Flasher, Utilities, About: local React state / hooks (no feature Zustand required).

### TanStack Query

- Provider defaults: `App.tsx` (`staleTime: 0`, `gcTime: 5m`, `retry: 1`).
- **Device poll only in `MainLayout`:** `queryKeys.allDevices()`, `STALE_TIME.ALL_DEVICES` = **30_000** ms (`shared/utils/queries.ts`). `fetchAllDevices` merges ADB + fastboot by serial.
- **Do not** add per-view device polling.
- Emulator view: separate AVD list poll with **`refetchInterval: 5000`** in `EmulatorView.tsx` (AVDs only, not phone devices).
- Query keys / `STALE_TIME` catalog: `shared/utils/queries.ts`.

## Shell / layout invariants

- Outer boundary: `h-svh overflow-hidden` on MainLayout.
- `SidebarProvider` fills with `h-full` (not `min-h-svh`).
- Header: structural `shrink-0` pin — no sticky hacks.
- Main scroll: `main-scroll-area` with `overflow-y-auto overflow-x-hidden` by default; File Explorer and Marketplace may own internal scroll.
- Preserve `min-w-0` chain for truncating text.
- BottomPanel resize: DOM-first during drag; React height commit on mouseup.
- Sonner: top-right in `MainLayout`.
- New view: update `viewConfig.tsx` + `AppSidebar` + add `features/<feature>/`.

## UI / style invariants

- Vite/Tauri client only — no Next.js patterns, no router.
- Prefer `@/` imports; `import type` for type-only imports.
- shadcn primitives in `shared/ui/`; feature UI stays in `features/`.
- Semantic tokens from `global.css` — no raw hex/rgb in components.
- `gap-*` not `space-x-*` / `space-y-*`; `size-*` when width === height.
- Icon buttons: `aria-label`. Rows: keyboard accessible or real `<button>`.
- Virtualized cmdk: `<Command shouldFilter={false}>`. Never `CommandInput` outside `<Command>`.
- Errors: `try/catch` + `handleError` / toast + logs (`shared/utils/errorHandler.ts`).

## Feature invariants (verified)

| Feature | Must keep |
| --- | --- |
| Device targeting | Pass `selectedSerial` into device-scoped desktop APIs |
| File Explorer | Stable `loadFiles` (refs, not historyIndex in deps); mutations re-list with `loadFiles(path, false)`; empty state `fileList.length === 0 && creatingType === null`; snapshot serial before host dialogs; clear root grant on serial change |
| Debloat | Reload when `selectedSerial` changes; SDK-aware actions; DTO field `listStatus` (camelCase) |
| Marketplace | Install with selected serial; session-only PAT/OAuth (not localStorage); provider orchestration stays on Rust side |
| Emulator | AVD discovery is backend `~/.android/avd/*.ini`; root progress via `EventsOn('root:progress')` only |
| Payload Dumper | Progress/load via runtime events above; cancel tokens when using cancellable extract |
| App Manager list | Virtualized list uses Lucide placeholders for icons unless a future lazy fixed-slot icon path is reintroduced |

## Tests

- All Vitest FE tests live under `src/test/`.
- No committed `.only` / `.skip`.
- IPC allowlist regression: `src/test/tauriPermissions.test.ts` when command permissions change.

## Validation

| Change type | Minimum gate |
| --- | --- |
| Docs only under `src/` | `git diff --check` |
| Frontend code | `bun run lint:web`, `bun run test`, `bun run build` |
| IPC contract | Also update `src-tauri` handler + permissions + desktop models |

Full gate (`bun run check`) only after **all** tasks for the request finish — see `docs/project_rules.md`.
