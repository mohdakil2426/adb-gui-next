# Active Context

## Current state

ADB GUI Next is a **working Tauri 2 app on `main`** (pushed through `82bc219`), app version **0.2.5**. Agent docs: root `AGENTS.md` router + `src/AGENTS.md` / `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`. Reports: `docs/internal/reports/`.

## Focus / recent durable changes (2026-07 packaging + app hardening)

| Area | Note |
| --- | --- |
| **Versioning** | Official: `tauri.conf.json` → `"version": "../package.json"`. Cargo still bumped; `bun run version:sync` |
| **Packaging** | `tauri-apps/tauri-action` for installers; custom only `scripts/make-windows-portable.ps1` |
| **CI** | Path filters; split `quality-web` / `quality-rust`; package multi-arch on main packaging paths |
| **Platforms** | Win x86_64/i686/aarch64; Linux x86_64 + aarch64 (PATH tools); macOS **code present, builds paused** |
| **Identity** | `productName` ADB GUI Next; `identifier` `com.astrixforge.adbguinext`; artifacts `ADB-GUI-Next-v…` |
| **Debloat** | Explicit FE `serial` on debloat IPC (`adb -s`) for multi-device |
| **Desktop** | `tauri-plugin-single-instance`; ACL `allow-device-read` + `allow-device-mutate` |
| **UI** | Active view in `localStorage` via `usePersistedActiveView` |
| **Signing** | Not used (product decision) |

## Open / deferred

- OPS **stream** decrypt (full-file OPS/OFP exists)
- Delta OTA full “real work” (clearer errors only for now)
- Native Win aarch64 platform-tools (currently PE x86 + emulation)
- Optional FE: further `useFileExplorerViewModel` size split
- Windows local `cargo test` loader `0xc0000139` — use `--no-run`; Linux CI executes

## Session lessons (keep)

| Never | Do instead |
| --- | --- |
| Triple-sync version with custom verify script | package.json SoT + conf path + Cargo via `version:sync` |
| Full collect-release renamer for installers | tauri-action naming patterns |
| Ship Linux aarch64 with x86_64 bundled adb | Empty resources conf + PATH tools |
| `setState` side effects inside functional updaters | Pure updater only |
| Parallel multi-APK install on one device | Serial install/uninstall |
| Reintroduce macOS as shipped without explicit unpause | Policy in `docs/project_rules.md` |

## Next steps

- Watch first CI package run on `main` (tauri-action names, arm runners)
- Manual smoke: installers + portable + multi-device debloat
- Only unpause macOS on explicit product request

**Last updated:** 2026-07-20
