# System Patterns

Living **working patterns** only. Full architecture diagrams and feature matrix: `docs/architecture.md`. Module rules: `src/AGENTS.md`, `src-tauri/AGENTS.md`.

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
- Hit-test cursor `(x,y)` on **hover and drop** with element rects.

### Device selection

- Single device list poll in `MainLayout` (30s). No per-view device polls.
- Features pass `selectedSerial` into device-scoped APIs.

### Shell layout

- Outer `h-svh overflow-hidden`; `SidebarProvider` `h-full` (not `min-h-svh`).
- Header structural pin (`shrink-0`); no sticky-header hacks.
- BottomPanel resize: DOM-first during drag; React state on mouseup.

### Feature modules

- Code under `src/features/<feature>/` with View + hooks/model/ui/utils as needed.
- Feature stores stay in feature `model/`; app-wide stores in `shared/stores/`.
- App Manager tabs: Installation + Debloater (UAD).
- App list icons: Lucide placeholders unless a future lazy fixed-slot path returns.

### Domain (Rust)

- Thin `commands/*`; logic in `payload/`, `marketplace/`, `emulator/`, `debloat/`, `helpers.rs`.
- Critical shell: `adb_shell_checked` (host OK ≠ shell OK).
- Payload: mmap/streaming; cancel tokens; `TransactionGuard` file-only cleanup.
- Events FE must use via runtime: `payload:progress`, `payload:load-progress`, `root:progress`.

### Marketplace / emulator / debloat (short)

| Area | Pattern |
| --- | --- |
| Marketplace | Thin commands → service/providers/ranking/cache; session tokens only; install owned temp + serial |
| Emulator | AVD via `~/.android/avd/*.ini`; root proof `verify_avd_root` / `su -c id -u == 0` |
| Debloat | Device-keyed cache; SDK-aware actions; no Disable when SDK unknown / API &lt; 23 |

### File Explorer

- View is thin: `FileExplorerView` + `useFileExplorerViewModel` + `model/fileExplorerReducers`.
- Stable `loadFiles` (refs; avoid historyIndex dep loops).
- Selection/sort: **pure** `setState` updaters only (no nested setters / ref writes inside updaters).

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
| Multi-APK | Serial install/uninstall on one device (`mapSerial` / then-chain) |
| Theme first paint | Prefer `useSyncExternalStore` / lazy init — avoid `useEffect(() => setState(), [])` flash |

Gate: `npx react-doctor@latest .` → expect 100 / 0 issues after FE changes that touch these areas.
- Mutations re-list with `loadFiles(path, false)`.
- Snapshot serial before host dialogs; clear root grant on serial change.

### Bottom panel

- Shell: `BottomPanel` + `PanelHeader` + `PanelHeaderActions` + `useBottomPanelResize`.
- Resize handle is focusable (`tabIndex={0}`) with keyboard height adjust.

## Anti-patterns

- Raw `invoke` / raw event listen in features
- React Router or Next.js patterns
- Per-view device polling
- `remove_dir_all` on user extract output dirs
- Auto-follow HTTP redirects without re-validating hops
- Reintroducing ESLint/Prettier as the FE toolchain (Ultracite is active)

**Last updated:** 2026-07-18
