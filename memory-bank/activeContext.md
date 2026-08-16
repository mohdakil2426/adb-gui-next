# Active Context

## Current state

ADB GUI Next is a working Tauri 2 app, version **0.2.5**. Agent docs: root `AGENTS.md` router + `src/AGENTS.md` / `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`.

**Current focus: `feat/scrcpy-and-ui-overhaul` in worktree `adb-gui-next-scrcpy-overhaul`.** Research + plan: `docs/internal/reports/2026-08-16-scrcpy-and-ui-overhaul-research.md` and `PLAN-scrcpy-and-ui-overhaul.md`. **No commits** on this branch until the user asks.

v2 UI/UX (`feat/ui-ux-reimagine-v2`) is already on this HEAD. This overhaul adds Neutral true-black theme, scrcpy, app icons, editor open, marketplace README/releases **and browse redesign**, utilities regroup + typed host IPC, logcat/screenshot, CI persist-credentials.

### Durable decisions from this overhaul

| Area | Decision |
| --- | --- |
| **Theme** | shadcn Neutral; dark `--canvas: oklch(0 0 0)`; tokens only in `global.css` |
| **Scrcpy** | Official Genymobile zip/tar + SHA256SUMS; store under `app_data_dir()/scrcpy/`; detached native spawn; CLI flags only; event `scrcpy:download-progress` |
| **App icons** | Rust `app_icons.rs`: `pm list packages -f`, pull APK, pick raster from zip, disk+memory cache, batch max 24 |
| **File editor** | Pull allowlisted text to temp; Windows `code`→Notepad; Linux `code`→gedit/kate→xdg-open; macOS `code`→`open -t` |
| **Marketplace GitHub** | Paginate releases (10×100), every APK asset; raw README; FE renders a small Markdown subset (no new dep) |
| **Marketplace browse** | Search-first layout; source chips + installable-only + sort/view in a toolbar; search stays in Rust |
| **Utilities** | Domain `utilities/` validates slot/wipe/logcat bounds; dedicated restart/kill/version commands; UI grouped host/power/diagnostics/fastboot |
| **CI** | `actions/checkout` `persist-credentials: false` (and `lfs: true` where platform-tools are needed) |

### Durable decisions from this overhaul

| Area | Decision |
| --- | --- |
| **Theme** | shadcn Neutral; dark `--canvas: oklch(0 0 0)`; tokens only in `global.css` |
| **Scrcpy** | Official Genymobile zip/tar + SHA256SUMS; store under `app_data_dir()/scrcpy/`; detached native spawn; CLI flags only; event `scrcpy:download-progress` |
| **App icons** | Rust `app_icons.rs`: `pm list packages -f`, pull APK, pick raster from zip, disk+memory cache, batch max 24 |
| **File editor** | Pull allowlisted text to temp; Windows `code`→Notepad; Linux `code`→gedit/kate→xdg-open; macOS `code`→`open -t` |
| **Marketplace GitHub** | Paginate releases (10×100), every APK asset; raw README; FE renders a small Markdown subset (no new dep) |
| **Marketplace browse** | Last-search cache + installable-only filter are display-only; Rust still owns search/install |
| **Utilities** | Single scroll: Host / Device / Inspect / Danger sections. Wipe requires typing `WIPE`. Screenshot is `save_screenshot` PNG |
| **CI** | `actions/checkout` `persist-credentials: false` (and `lfs: true` where platform-tools are needed) |

## Open / deferred

- Cannot run the desktop GUI in this session — validate with lint/tests only
- Official scrcpy archives: Windows x64 + Linux x64; no official Win ARM64 / Linux ARM64 zip — PATH fallback
- macOS builds still paused; scrcpy/editor paths exist for a future unpause
- `operationStore` still App Manager–centric; scrcpy download uses its own progress event
- Windows local `cargo test` may hit loader `0xc0000139` — use `--no-run` if so

## Next steps

- User review of the worktree (no commit/push until asked)
- Manual smoke: scrcpy download+launch, icon batch, open `.prop` in editor, GitHub marketplace README, marketplace browse filters, utilities wipe phrase WIPE, marketplace filters/cache, utilities tabs + screenshot

**Last updated:** 2026-08-16
