# Progress

## Overall status

Fully functional Tauri 2 desktop app on `main` (v**0.2.5**). Core features shipped: device dashboard, wireless ADB, app manager + UAD debloat, file explorer (incl. root grant), flasher, utilities, payload dumper (local/remote/OPS/OFP/factory), marketplace, emulator + Magisk root wizard, bottom logs/shell.

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | `lint:web` / `format:web` / `lint:rust` / `format:rust` / `format:check` / `lint` / `check` (full gate) |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt on staged files only) |
| CI quality | All branches/PRs (Ubuntu): format, lint, tests, build |
| CI package | **main push only** — Windows + Linux installers |
| Publish | Win/Linux always; macOS only if Apple secrets present |
| Rust | Clippy `-D warnings` via package `[lints]` + `clippy.toml` |

## Major capabilities (done — not a changelog)

- Frontend feature layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- Device poll: single 30s poll in `MainLayout`
- Emulator AVD poll: 5s while Emulator view mounted
- Payload: streaming/mmap, cancel tokens, remote progress events, factory ZIP remote path
- Debloat: SDK-aware actions, device-keyed cache
- Marketplace: multi-provider service + session auth; install with selected serial
- Emulator root: preflight, autopilot + FAKEBOOTIMG, verify via `su -c id -u == 0`

## Known issues / gaps

| Item | Note |
| --- | --- |
| Windows `cargo test` | Known Tauri-linked loader failure possible (`STATUS_ENTRYPOINT_NOT_FOUND`) |
| Debloat multi-device IPC | FE reloads on serial; some Rust paths still depend on default `adb` serial — treat carefully |
| Deferred audit items | OPS stream decrypt, ZIP64 http_zip, ACL split, single-instance |
| Delta OTA | Domain hooks limited vs full CrAU extract |
| Active view | Not URL-persisted (reload → dashboard) |

## Changelog policy

Do **not** append long session diaries here. Durable design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Update this file only for status, gates, or known gaps.
