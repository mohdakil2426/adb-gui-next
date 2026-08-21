# Active Context

## Current Focus

**2026-08-21 — Dashboard "Instrument Deck" redesign + Applications overview upgrade (uncommitted per user request):**

- **Dashboard (`features/dashboard/`)** — full visual rebuild, same tokens:
  - Global entrance cascade via `PanelCard delay` (hero → battery → memory → storage → security → actions → wireless → apps); reduced-motion aware.
  - `BatteryGauge`: 128px tick-bezel radial + charging aura; `MicroScale` band meters for temperature/voltage (zone tints + scaleX fill).
  - `MemorySparkline`: 25/50/75% gridlines, crosshair scrubber, live endpoint pulse; `MemoryPanel` % headline.
  - `StoragePanel`: `StorageAllocationBar` stacked capacity map; volume rows carry matching legend dots (`model/storageColors.ts`).
  - `SecurityPanel`: `PostureSpectrum` six-segment strip ("N of M nominal").
  - New `AppsPanel` + interactive `AppsCompositionDonut` (hover-linked center readout) + Target SDK health meter; `hooks/useAppOverview.ts` shares the `appOverviewTelemetry` query key with App Manager.
  - Fills animate **scaleX only** (doctor: no layout-property animation); `UsageBar` migrated too. `role="meter"` → `role="progressbar"` (prefer-tag-over-role).
- **Applications overview (`features/app-manager/overview/`)** — same deck language:
  - `AppMetricsHeroBanner` staggered cells; `PackageCompositionDonut` rewritten interactive (dead `standalone`/`composition` API removed — single call site verified).
  - `TargetSdkDistributionMeter` + `DebloatSafetySpectrum`: raw emerald/sky/amber/rgb colors → success/info/warning tokens; staggered scaleX arcs/fills.
  - `PermissionDensityMatrix`: token risk tones + per-category density mini-meters; dormant `userAppCount` prop now used in the caption.
  - `TopStorageConsumersChart` / `QuickLaunchpadCard`: staggered entrances (test contracts preserved: ranks, quote-stripping, empty text).
- **Docs updated:** `DESIGN.md` (Dashboard screen row, Charts list, new "Instrument Deck Choreography" pattern), `src/AGENTS.md` (charts paragraph, Dashboard invariant), this file.

## Quality Gates Status
- **Ultracite (Biome):** 475 files checked, 0 errors, 0 warnings
- **TypeScript:** `tsc --noEmit` passed (via `bun run build`)
- **Vitest:** 48 / 48 files passed, 285 / 285 tests passed
- **React Doctor:** 86/100 — zero findings in dashboard or app-manager files; remaining deductions are pre-existing marketplace debt (`authStore` unused exports, `ReadmeMarkdown` label, `useMarketplaceAuth` deps) and the pre-existing `pkgName || index` key fallback required by the missing-packageName test.
- **No commits made** per user request (pre-existing work was committed first in 6 logical commits earlier this session).

**Last updated:** 2026-08-21
