# Active Context

## Current Focus

**2026-09-18 — Ultracite Oxlint/Oxfmt migration, Curated Tools complete removal, and repo-wide gate fixes:**

- **Marketplace Cleanup:**
  - Completely removed `CuratedPowerToolsGrid.tsx` frontend component and its invocations.
  - Removed dead `marketplace_get_curated_tools` Tauri command, backend service endpoint, test, and permissions entries.
  - Updated `MarketplaceOverviewTab` to focus on discovery chips and dual telemetry charts.
- **Linter & Formatter Upgrade (Ultracite Oxlint + Oxfmt):**
  - Configured `oxfmt.config.ts` (`printWidth: 100`) and ignore patterns for docs, memory-bank, .github, .agents, and src-tauri.
  - Configured `oxlint.config.ts` with matching ignore patterns.
  - Removed deprecated `biome.jsonc`.
  - Resolved all linter diagnostics (`eslint(no-empty-function)`, `unicorn(no-useless-undefined)`, `vitest(prefer-expect-resolves)`, `vitest(prefer-called-with)`) with zero rule suppressions.
  - Resolved TypeScript strict typing in React effects, debloater, and payload stores.
- **Quality Gates Status:**
  - **Ultracite (Oxlint + Oxfmt):** 0 errors, all files formatted.
  - **TypeScript (`tsc --noEmit`):** 0 errors.
  - **Vitest:** 48 / 48 test files passed (324 / 324 tests).
  - **Rust Backend (`cargo check`):** Dev profile compiles cleanly.

**Last updated:** 2026-09-18
