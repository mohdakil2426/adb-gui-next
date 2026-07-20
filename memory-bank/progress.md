# Progress

## Overall status

Fully functional Tauri 2 desktop app on `main` (v**0.2.5**). Core features shipped: device dashboard, wireless ADB, app manager + UAD debloat, file explorer (incl. root grant), flasher, utilities, payload dumper (local/remote/OPS/OFP/factory), marketplace, emulator + Magisk root wizard, bottom logs/shell.

Packaging/CI overhaul landed and pushed (commits through `82bc219`): tauri-action multi-arch, official version path, portable-only custom script, multi-device debloat serial, single-instance, ACL split, view persistence.

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | `lint:web` / `format:web` / `lint:rust` / `format:rust` / `format:check` / `lint` / `check` / `version:sync` |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt staged only) |
| CI detect | `dorny/paths-filter` → web / rust / packaging |
| CI quality | Split **quality-web** + **quality-rust** (path-gated; PRs always relevant side) |
| CI package | **main** + packaging-path changes; multi-arch Win/Linux; `tauri-action` + portable zip |
| Publish | Manual draft via tauri-action; notes file required; SHA256SUMS finalize |
| React Doctor | Target **100/100** (`npx react-doctor@latest .`) |
| Code signing | **Not used** |

## Major capabilities (done)

- FE layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- Device poll 30s (`MainLayout`); AVD poll 5s (Emulator view)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote; ZIP64 CD extra parse tested
- Debloat SDK-aware + device-keyed cache + **explicit serial** IPC
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel + shell history stable ids
- File Explorer: thin view + hook composition under `useFileExplorerViewModel`
- Single-instance; ACL read/mutate permissions; active view localStorage
- Packaging: Win x86_64/i686/aarch64; Linux x86_64 + aarch64 (PATH tools on arm)

## Known issues / gaps

| Item | Note |
| --- | --- |
| Windows `cargo test` | Prefer `--no-run` locally; Linux CI runs tests |
| Delta OTA | Limited incremental path; errors call out limitation |
| OPS stream decrypt | Deferred vs full-file OPS/OFP |
| Win aarch64 tools | Still PE x86 Google tools (emulation) |
| FE view-model size | Large orchestrator still allowlisted if arch-tested |
| macOS | Code/resources present; **builds paused** by product policy |
| First multi-arch CI | Confirm arm runners + tauri-action artifact name tokens in Actions UI |

## Changelog policy

No long session diaries here. Design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Status/gaps only in this file.

**Last updated:** 2026-07-20
