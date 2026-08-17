# Internal reports index

Layout:

```text
docs/internal/reports/<active|closed>/YYYY-MM-DD/YYYY-MM-DD-short-topic-<category>.md
```

Categories (filename suffix): `audit` | `research` | `summary` | `validation`.

## Active

_Empty — open investigations go here as dated folders._

## Closed

All former `docs/reports/active` and `docs/reports/closed` write-ups were migrated into `closed/YYYY-MM-DD/` with kebab-case names and category suffixes (2026-07-18). Remaining `active/` audits (CI packaging, React Doctor, full-stack redesign) and the 2026-08-16 scrcpy/UI overhaul research + plan were closed on 2026-08-17.

Browse by date under `docs/internal/reports/closed/`. Treat closed files as historical unless you re-open a topic into `active/`.

## Superpowers (not reports)

| Path | Naming |
| --- | --- |
| `docs/superpowers/plans/` | `YYYY-MM-DD-<feature-name>.md` |
| `docs/superpowers/specs/` | `YYYY-MM-DD-<topic>-design.md` |

Do not put audit/research reports under superpowers — use `docs/internal/reports/` instead.
