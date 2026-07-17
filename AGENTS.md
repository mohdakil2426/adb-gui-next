# ADB GUI Next — Agent Guide

ADB GUI Next is a **desktop-only Tauri 2** Android toolkit (ADB, fastboot, file explorer, flasher, debloat, marketplace, payload dumper, emulator). Stack: React 19 · TypeScript · Vite · Tailwind v4 · shadcn · Zustand · TanStack Query · Rust 2024 · Bun. Windows and Linux first-class; macOS and browser/Next.js are out of scope.

This root guide is a **router** plus durable **cross-module** rules. Frontend implementation lives in `src/AGENTS.md`. Backend implementation lives in `src-tauri/AGENTS.md`.

## Instruction model

- Follow platform, developer, and current-user instructions first.
- Read this guide, then the **closest** module `AGENTS.md` to paths you edit (`src/` or `src-tauri/`).
- Nested module guide closer to the path applies after root.
- Module guides own local implementation. `docs/project_rules.md` owns workflow, reports, verification, and hard stops. `docs/architecture.md` owns cross-module design.
- If a module guide and project rules conflict → **stop and ask**.

## Start every scoped task

1. Find affected paths → read the closest module `AGENTS.md` before edits.
2. Read only docs the routing table points to (plus live code).
3. Run `git status --short` before edits; preserve unrelated user changes.
4. Commits, pushes, PRs, and destructive actions need an **explicit** user request.
5. Keep changes surgical. Define success as a command or reproducible behavior.

## Routing table

| Task | Required guidance |
| --- | --- |
| Workflow, reports, hard stops, quality gates | `docs/project_rules.md` |
| Cross-module design / data flow / IPC map | `docs/architecture.md` |
| Entire frontend (`src/**`) | `src/AGENTS.md` |
| Entire Rust backend (`src-tauri/**`) | `src-tauri/AGENTS.md` |
| FE lint standards (Ultracite) | `.agents/rules/ultracite.md` |

## Project map

| Path | Owns |
| --- | --- |
| `src/` | Full React/Vite client (see `src/AGENTS.md`) |
| `src/main.tsx`, `src/app/` | Bootstrap, shell, MainLayout, view map, BottomPanel |
| `src/desktop/` | Only raw Tauri invoke / events / file-drop / models |
| `src/features/` | Product views and feature-local state |
| `src/shared/` | Cross-feature components, stores, shadcn, shared utils |
| `src/styles/` | Theme tokens (`global.css`) |
| `src/test/` | All Vitest frontend tests |
| `src-tauri/` | Rust lib, thin commands, domains, bundled platform-tools |
| `docs/architecture.md` | Cross-module architecture reference |
| `docs/project_rules.md` | Workflow, reports, hard stops |
| `docs/internal/reports/` | Audits / research / validation write-ups |
| `package.json` / `biome.jsonc` | Scripts, lint-staged, Ultracite config |

## Non-negotiable cross-module boundaries

- **Desktop-only.** No Next.js, no browser-first routing, no Electron.
- **IPC only through `src/desktop/`.** Features must not call raw `core.invoke` or raw Tauri event APIs.
- **Thin Rust commands, fat domains.** Logic in `src-tauri/src/{payload,marketplace,emulator,debloat}/` or `helpers.rs`; not bloated `commands/*` bodies.
- **No React Router.** View switching is `ViewType` + `VIEW_RENDERERS` in the shell.
- **One global device poll** in `MainLayout` (30s). Do not add per-view device polling.
- **Feature code** under `src/features/<feature>/`. **shadcn** under `src/shared/ui/`. **Theme tokens** in `src/styles/global.css` (no hard-coded colors in components).
- **IPC DTOs** live in `src/desktop/models.ts` and match Rust `camelCase` serde.
- **New production deps** only with clear user-visible payoff; prefer existing stack.

Keep this list short. Implementation detail stays in module guides.

## Change and documentation safety

- If docs and code disagree, inspect source and tests before changing docs.
- Module rules stay in module guides. Root only gets durable repo-wide rules.
- New cross-module contracts update `docs/architecture.md` and every affected module guide.
- One owner per topic; duplicates become a short pointer to the owner.
