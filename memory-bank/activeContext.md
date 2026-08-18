# Active Context

## Current state

ADB GUI Next is a working Tauri 2 app, version **0.2.5**. Agent docs: root `AGENTS.md` router + `src/AGENTS.md` / `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`.

**Work here on local `main` only** (`C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next`). HEAD includes the 2026-08-16 overhaul plus Utilities one-page layout. The worktree `adb-gui-next-scrcpy-overhaul` / branch `feat/scrcpy-and-ui-overhaul` is the same overhaul SHA; do not treat it as in-flight. **Overhaul commits are still unpushed** (`origin/main` behind).

Current product work: File Explorer chrome follows Windows Explorer (nav + command bands, Places, Details columns). Host files/folders drop in via `OnFileDrop` + `host_path_kinds` + `push_file`. In-app drag onto folders / Places / tree / crumbs moves with `transfer_device_files`. Drag-out to Explorer is not supported. Host setup on Utilities → Host is already on `main`: official Google platform-tools and USB driver are **separate** installs. Tools go to `C:\Android\platform-tools`; system Path is HKLM; USB uses `pnputil`. This app still uses bundled ADB.

Research/plan (historical): `docs/internal/reports/closed/2026-08-16/2026-08-16-scrcpy-and-ui-overhaul-research.md`, `docs/internal/reports/closed/2026-08-16/2026-08-16-scrcpy-and-ui-overhaul-plan.md`.

v2 UI/UX (`feat/ui-ux-reimagine-v2`) is already on `main` (merged as PR #1).

### Durable decisions (verify in code)

| Area | Decision |
| --- | --- |
| **Theme** | Official shadcn Neutral: light `--background: oklch(1 0 0)`, dark `--background: oklch(0.145 0 0)`. `canvas`/`surface` alias those tokens. Status colours = device state, not UI emphasis. |
| **Scrcpy** | Official Genymobile zip/tar + SHA256SUMS; store under `app_data_dir()/scrcpy/`; detached native spawn (not in the webview); CLI flags only; event `scrcpy:download-progress`. Official archives: Win/Linux **x64**. ARM uses PATH fallback. Companion floating pill toolbar (`scrcpy-toolbar-*`) secondary Tauri webview with Freeform and Lock (magnetic window tracking + Y-offset adjustment) modes. |
| **Dashboard** | Precision hardware cockpit: `DeviceHeroBanner` (connection status pulse, 8-spec hardware grid with hover-only copy buttons: Serial, Platform, Architecture, Security Patch, Kernel Version, Build Number, Uptime, Locale/Timezone) + 2 equal-height stretched rows (`BatteryGauge` dual-arc radial meter + 4-chip electrical/thermal grid, `MemoryPanel` with live area waveform sparkline, `StoragePanel` partition cards, `SecurityPanel` 6-row diagnostic list with zero truncation, `QuickActionsPanel` 3×2 symmetric grid with direct Mirror and Shell, `WirelessAdbPanel`). |
| **About** | Modernized `AboutHero` banner with badge metadata; equal-height `Build` + `Licence` stretched cards; interactive `Built with` tech grid opening official URLs via `BrowserOpenURL`. |
| **App icons** | Rust `app_icons.rs` / `get_app_icons`: `pm list packages -f`, pull APK, pick raster from zip, disk+memory cache, batch max 24. FE `useAppIcons` displays only. |
| **File editor / explorer** | Pull allowlisted text to temp; Windows `code`→Notepad; Linux `code`→gedit/kate→xdg-open; macOS `code`→`open -t` (builds still paused). Show in Explorer is MTP This PC, not that temp dir. Listing uses `ls -lA` (hidden entries). Host OS drop → `host_path_kinds` + `push_file`. In-app row drag is HTML5 MIME + `transfer_device_files`. No OS drag-out. |
| **Marketplace GitHub** | Paginate releases (10×100), every APK asset; raw README; FE renders a small Markdown subset (no markdown library). |
| **Marketplace browse** | Search-first toolbar (source chips, installable-only, sort, grid/list). Last-search cache + installable filter are display-only; Rust owns search/install. |
| **Utilities** | Single scroll: Host / Device / Inspect / Danger sections. Domain `utilities/` validates slot (`a`/`b`), wipe phrase `WIPE`, logcat clamp. IPC: `restart_adb_server`, `kill_adb_server`, `get_host_tool_versions`. Screenshot: `save_screenshot` PNG. |
| **Host setup** | Domain `host_setup/`. Official `dl.google.com` catalog only (no third-party setup EXE). Separate UAC actions: copy platform-tools + HKLM Path vs `pnputil` USB INF. Status: registry Path + `pnputil /enum-drivers`. Event `host-setup:progress`. Card hidden off Windows. |
| **CI** | `actions/checkout` `persist-credentials: false` (keep `lfs: true` where platform-tools are needed). |
| **Branch policy** | Continue on **local `main`**. Do not reopen the overhaul worktree for new work unless asked. |

## Open / deferred

- Desktop GUI was not smoke-tested in the overhaul session (lint/tests only)
- Official scrcpy archives: Windows x64 + Linux x64 only — no official Win ARM64 / Linux ARM64 zip
- macOS builds still paused; scrcpy/editor paths exist for a future unpause
- `operationStore` still App Manager–centric; scrcpy download uses `scrcpy:download-progress`; host setup uses `host-setup:progress`
- Windows local `cargo test` may hit loader `0xc0000139` — use `--no-run` if so
- No F-Droid catalog home (search-first); logcat is a snapshot, not a live stream
- Flasher wipe uses its own UI confirm, not the utilities `WIPE` phrase
- `origin/main` is behind local `main` until the user asks to push
- Unrelated unstaged leftover: `.gitignore` (`akila-prompt-temp.md`) — do not mix into feature commits unless asked
- Host setup needs a Windows rebuild + UAC smoke: tools Path in a **new** cmd, USB row from `pnputil`

## Next steps

- Stay on **main** for further product work
- Push to origin only when the user asks
- Manual smoke: host setup split installs + system Path; scrcpy; icons; editor; marketplace; utilities WIPE

**Last updated:** 2026-08-18
