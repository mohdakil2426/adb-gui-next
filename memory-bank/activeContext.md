# Active Context

## Current state

ADB GUI Next is a **working Tauri 2 app on `main`**, app version **0.2.5**. Agent docs use a thin root `AGENTS.md` router plus `src/AGENTS.md`, `src-tauri/AGENTS.md`, `docs/project_rules.md`, and `docs/architecture.md`.

## Focus / recent durable changes (keep short)

| Area | Note |
| --- | --- |
| Agent/docs layout | Router + module guides; reports under `docs/internal/reports/closed/` |
| Quality scripts | Slim `package.json` scripts; Husky → `lint-staged` (staged only) |
| CI | Quality on all branches; package artifacts **main push only** (Win/Linux) |
| Rust bar | Cargo `[lints]` + `clippy.toml`; clippy `-D warnings` |
| Security remediations | Extract basename jail, SSRF redirect hops, debloat device-keyed cache + SDK fail-closed, marketplace serial install, Magisk live fetch |
| Payload dumper | Domain restructure + remote load progress/stats; factory-image remote path; delta real-work skipped; single-instance plugin deferred |

## Open / deferred (not stale history)

- OPS stream decrypt, ZIP64 `http_zip`, ACL split, Tauri single-instance (deferred from audit)
- Payload delta “real work” skipped in upgrade plan
- Windows: `cargo test` may hit Tauri loader `0xc0000139` — use `--no-run` / Linux CI
- Release v0.2.5: macOS signing secrets optional; product still Win/Linux first-class
- App Manager list icons: **Lucide placeholders** in product (no live `app_icons` module)

## Next steps

- Prefer `docs/architecture.md` + module `AGENTS.md` over expanding this file
- Update this file only when **current** focus or open blockers change
