# Marketplace Feature Guide

`src/features/marketplace/` is the 4-tab Hardware Cockpit frontend (`marketplace-view.tsx`) for browsing, searching, downloading, and managing Android apps and tools. Parent: `src/AGENTS.md`.

## Architecture & Invariants

- Split state: `marketplaceStore` (persisted settings/history) vs `downloadStore` (non-persisted high-frequency progress).
- `ReadmeMarkdown` uses a zero-dependency AST parser to avoid prototype mutations under webview freeze.

## Rules & Traps (Ponytail Ultra Format)

- **Wrong:** relying solely on initial in-memory auth state which defaults to null/signed-out on fresh launch.
  **Right:** call `useMarketplaceAuthStore.getState().refresh()` in a mount `useEffect` to rehydrate token status from the native keychain.
  **Id:** Marketplace auth store keychain rehydration
- **Wrong:** saving 8 Hz `marketplace:download-progress` events into a `zustand/persist` store causing localStorage write churn.
  **Right:** record high-frequency progress in non-persisted `downloadStore` with 8 Hz throttling and auto-clear.
  **Id:** Marketplace download progress store separation
- **Wrong:** omitting `cx={SIZE / 2}` on rotated (`-rotate-90`) SVG `<circle>` arcs in `SourceCompositionDonut`, or using a 3-column grid for 5 items in `CategoryDistributionMeter`.
  **Right:** set both `cx={SIZE / 2}` and `cy={SIZE / 2}` on every SVG `<circle>`, and use a 2-column grid with `isLastOdd && "@sm:col-span-2"` to prevent truncation and empty cells.
  **Id:** Marketplace overview chart geometry and grid balance

## Ownership Map

`ui/` + `overview/` + `browse/` + `updates/` + `sources/` (tabs/views), `model/` (stores), `hooks/` (auth/search), `utils/` (install).
