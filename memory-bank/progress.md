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
| React Doctor | **61/100** after top-3 pass; **remaining backlog deferred** (see activeContext + audit report) |

## Major capabilities (done)

- FE layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- Device poll 30s (`MainLayout`); AVD poll 5s (Emulator view)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote
- Debloat SDK-aware + device-keyed cache; marketplace serial install
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel: split into `PanelHeader` / `PanelHeaderActions` / resize hook (doctor top-3)
- File Explorer: thin view + `useFileExplorerViewModel` (doctor top-3)

## Known issues / gaps

| Item | Note |
| --- | --- |
| **React Doctor rest** | **Work later** — errors (impure updaters, FileBanner layout anim, marketplace timer cleanup) + warnings; report under `docs/internal/reports/active/2026-07-18/` |
| Windows `cargo test` | Possible Tauri loader `STATUS_ENTRYPOINT_NOT_FOUND` |
| Debloat multi-device | Some Rust paths may still use default adb serial |
| Deferred product audit | OPS stream decrypt, ZIP64 http_zip, ACL split, single-instance |
| Delta OTA | Limited vs full CrAU extract |
| Active view | Not URL-persisted |

## Changelog policy

No long session diaries here. Design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Status/gaps only in this file.
