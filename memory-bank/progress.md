# Progress

## Overall status

Fully functional Tauri 2 desktop app on `main` (v**0.2.5**). Core features shipped: device dashboard, wireless ADB, app manager + UAD debloat, file explorer (incl. root grant), flasher, utilities, payload dumper (local/remote/OPS/OFP/factory), marketplace, emulator + Magisk root wizard, bottom logs/shell.

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | `lint:web` / `format:web` / `lint:rust` / `format:rust` / `format:check` / `lint` / `check` |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt staged only) |
| CI quality | All branches/PRs (Ubuntu) |
| CI package | **main push only** — Windows + Linux |
| React Doctor | **100/100**, 0 issues (2026-07-18 plan). Gate: `npx react-doctor@latest .` |

## Major capabilities (done)

- FE layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- Device poll 30s (`MainLayout`); AVD poll 5s (Emulator view)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote
- Debloat SDK-aware + device-keyed cache; marketplace serial install
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel: `PanelHeader` / `PanelHeaderActions` / resize + stable shell history ids
- File Explorer: thin view + `useFileExplorerViewModel`
- React Doctor hygiene: pure updaters, effect cleanups, LazyMotion, dead shadcn removed (`avatar`/`command`/`radio-group`/`slider`/`toggle` + `cmdk`)

## Known issues / gaps

| Item | Note |
| --- | --- |
| Doctor commit | Working tree may still hold uncommitted doctor fixes — user decides when to commit |
| Windows `cargo test` | Possible Tauri loader `STATUS_ENTRYPOINT_NOT_FOUND` |
| Debloat multi-device | Some Rust paths may still use default adb serial |
| Deferred product audit | OPS stream decrypt, ZIP64 http_zip, ACL split, single-instance |
| Delta OTA | Limited vs full CrAU extract |
| Active view | Not URL-persisted |
| FE view-model size | `useFileExplorerViewModel` large; arch test allowlisted — split later if desired |

## Changelog policy

No long session diaries here. Design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Status/gaps only in this file.
