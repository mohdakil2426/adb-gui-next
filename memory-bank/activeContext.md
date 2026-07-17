# Active Context

## Current state

ADB GUI Next is a **working Tauri 2 app on `main`**, app version **0.2.5**. Agent docs: thin root `AGENTS.md` router + `src/AGENTS.md`, `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`. Reports: `docs/internal/reports/`.

## Focus / recent durable changes (keep short)

| Area | Note |
| --- | --- |
| Agent/docs layout | Router + module guides; skills sections (FE shadcn, BE rust-*); Ultracite skill + rules pointers |
| Quality scripts | Slim package scripts; Husky → lint-staged |
| CI / Rust bar | Quality all branches; package main-only; clippy `-D warnings` |
| Scaffold cleanup | Removed unused `public/{favicon,vite,tauri}.svg` + `src/assets/react.svg` |
| React Doctor (partial) | Full analysis report written; **top-3 fixes in working tree** (unused deps, BottomPanel/PanelHeader split + focusable resize, FileExplorer view-model extract). Score re-run **61/100** |

## Open / deferred — work later

### React Doctor backlog (later pass)

- **Report:** `docs/internal/reports/active/2026-07-18/2026-07-18-react-doctor-full-analysis-audit.md`
- **Score:** 61/100 after top-3; ~48 issues remain
- **Do not treat as done** until errors cleared and score re-checked
- **Next fix order (later):**
  1. **Errors:** `no-impure-state-updater` (FE selection/sort, DirectoryTree), `effect-needs-cleanup` (marketplace auth timer), `no-layout-property-animation` (FileBanner height)
  2. **High ROI warnings:** `button-has-type`, `<main>` vs role, stable list keys, LazyMotion, queries single-pass
  3. **Product calls:** unused shadcn files (keep vs delete), theme first-paint flash
- Uncommitted doctor-related code may still be in the tree (BottomPanel refactor, FE view-model, package.json deps) — commit when ready

### Other deferred

- OPS stream decrypt, ZIP64 `http_zip`, ACL split, Tauri single-instance
- Payload delta “real work” skipped
- Windows `cargo test` loader issue (`0xc0000139`)
- App Manager icons: Lucide placeholders (no live `app_icons` module)

## Next steps

- **Later:** resume React Doctor pass B+ from the report above
- Prefer architecture + module AGENTS over bloating this file
- Update this file only when current focus or open blockers change
