# Active Context

## Current state

ADB GUI Next is a working Tauri 2 app, version **0.2.5**. Agent docs: root `AGENTS.md` router + `src/AGENTS.md` / `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`.

**Work here on local `main` only** (`C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next`). HEAD includes the 2026-08-16 overhaul (`5a6d3d5`) and Utilities one-page layout (`540d152`). The worktree `adb-gui-next-scrcpy-overhaul` / branch `feat/scrcpy-and-ui-overhaul` is the same SHA; do not treat it as in-flight. **Nothing from this overhaul has been pushed to `origin/main`.**

Research/plan (historical): `docs/internal/reports/2026-08-16-scrcpy-and-ui-overhaul-research.md`, `PLAN-scrcpy-and-ui-overhaul.md`.

v2 UI/UX (`feat/ui-ux-reimagine-v2`) is already on `main` (merged as PR #1). The overhaul retinted Neutral to true black/white and added scrcpy, app icons, editor open, marketplace README/releases + browse toolbar, utilities sections + typed host IPC, logcat/screenshot, CI `persist-credentials: false`.

### Durable decisions (verify in code)

| Area | Decision |
| --- | --- |
| **Theme** | shadcn Neutral achromatic: light `--canvas: oklch(1 0 0)`, dark `--canvas: oklch(0 0 0)`. Tokens only in `src/styles/global.css`. Status colours = device state, not UI emphasis. |
| **Scrcpy** | Official Genymobile zip/tar + SHA256SUMS; store under `app_data_dir()/scrcpy/`; detached native spawn (not in the webview); CLI flags only; event `scrcpy:download-progress`. Official archives: Win/Linux **x64**. ARM uses PATH fallback. |
| **App icons** | Rust `app_icons.rs` / `get_app_icons`: `pm list packages -f`, pull APK, pick raster from zip, disk+memory cache, batch max 24. FE `useAppIcons` displays only. |
| **File editor** | Pull allowlisted text to temp; Windows `code`→Notepad; Linux `code`→gedit/kate→xdg-open; macOS `code`→`open -t` (builds still paused). Listing uses `ls -lA` (hidden entries). |
| **Marketplace GitHub** | Paginate releases (10×100), every APK asset; raw README; FE renders a small Markdown subset (no markdown library). |
| **Marketplace browse** | Search-first toolbar (source chips, installable-only, sort, grid/list). Last-search cache + installable filter are display-only; Rust owns search/install. |
| **Utilities** | Single scroll: Host / Device / Inspect / Danger sections. Domain `utilities/` validates slot (`a`/`b`), wipe phrase `WIPE`, logcat clamp. IPC: `restart_adb_server`, `kill_adb_server`, `get_host_tool_versions`. Screenshot: `save_screenshot` PNG. |
| **CI** | `actions/checkout` `persist-credentials: false` (keep `lfs: true` where platform-tools are needed). |
| **Branch policy** | Continue on **local `main`**. Do not reopen the overhaul worktree for new work unless asked. |

## Open / deferred

- Desktop GUI was not smoke-tested in the overhaul session (lint/tests only)
- Official scrcpy archives: Windows x64 + Linux x64 only — no official Win ARM64 / Linux ARM64 zip
- macOS builds still paused; scrcpy/editor paths exist for a future unpause
- `operationStore` still App Manager–centric; scrcpy download uses `scrcpy:download-progress`
- Windows local `cargo test` may hit loader `0xc0000139` — use `--no-run` if so
- No F-Droid catalog home (search-first); logcat is a snapshot, not a live stream
- Flasher wipe uses its own UI confirm, not the utilities `WIPE` phrase
- `origin/main` is behind local `main` until the user asks to push
- Unrelated unstaged leftovers on this checkout (do not mix into feature commits unless asked): `.gitignore`, `docs/architecture.md`

## Next steps

- Stay on **main** for further product work
- Push to origin only when the user asks
- Manual smoke when a device is available: scrcpy download+launch, icon batch, open `.prop` in editor, GitHub marketplace README, utilities WIPE, stacked Utilities sections

**Last updated:** 2026-08-16
