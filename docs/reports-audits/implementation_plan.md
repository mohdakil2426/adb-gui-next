# Marketplace Provider Fixes + Settings Dialog + UI/UX Improvements

Comprehensive fix for all 4 marketplace providers failing to return search results, plus Settings dialog and UI improvements.

## User Review Required

> [!CAUTION]
> **4 Critical Bugs Found**: F-Droid, IzzyOnDroid, and GitHub providers are ALL broken — only Aptoide works. See full analysis in [marketplace-analysis.md](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/reports-audits/marketplace-analysis.md).

> [!IMPORTANT]
> **IzzyOnDroid has NO search API**. The endpoint the code calls (`?search=X`) returns HTTP 400. We need to decide between:
> - **Option A (Recommended)**: Cross-reference — use F-Droid search results, check if each app also exists on IzzyOnDroid
> - **Option B**: Drop IzzyOnDroid search, only use it for detail enrichment
> - **Option C**: Download+cache the full IzzyOnDroid index (~5MB) for local search

> [!WARNING]
> **GitHub PAT**: Should we implement a simple text input for now, or the full OAuth Device Flow that GitHub-Store uses? Text input is simpler but less secure. I recommend simple PAT input for MVP.

---

## Proposed Changes

### Phase 1 — Critical Bug Fixes (Providers Working)

---

#### Backend: F-Droid Fix

##### [MODIFY] [fdroid.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/marketplace/fdroid.rs)
- Change `FdroidSearchResponse.hits` → `FdroidSearchResponse.apps`
- Update `FdroidHit` struct fields to match actual API: `name`, `summary`, `icon` (full URL), `url`
- Extract `packageName` from `url` field (parse last path segment)
- Fix icon URL handling (now full URLs from `ftp.fau.de`)
- Fix download URL construction (extract package name first)
- Fix `get_detail()`: cache search data and merge with version-only API response

---

#### Backend: IzzyOnDroid Fix

##### [MODIFY] [izzy.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/marketplace/izzy.rs)
- Remove broken `?search=` endpoint call
- Implement cross-reference approach: accept list of package names, check each against IzzyOnDroid API
- Add new function `check_availability(client, packages: &[String]) -> Vec<MarketplaceApp>`
- Fix `versionCode` parsing: IzzyOnDroid returns it as STRING, not integer
- Keep `get_detail()` as-is (it works correctly for known package names)

---

#### Backend: GitHub Fix

##### [MODIFY] [github.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/marketplace/github.rs)
- Fix query encoding: use spaces instead of `+` between qualifiers
- Use `reqwest::Client::query()` method instead of manual URL construction
- Remove overly restrictive `NOT topic:library` qualifier
- Fix trending query: remove `topic:app`, lower star threshold, add recency filter
- Add `X-GitHub-Api-Version: 2022-11-28` header
- Accept `token` parameter (for PAT support later)

---

#### Backend: Search Command

##### [MODIFY] [marketplace.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/commands/marketplace.rs)
- Update IzzyOnDroid search flow to use cross-reference approach
- Add per-provider error capture (don't silently swallow errors)
- Log provider-specific success/failure counts

---

### Phase 2 — UI/UX: Settings Dialog + Status Indicators

---

#### Frontend: Settings Dialog

##### [NEW] [MarketplaceSettings.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/marketplace/MarketplaceSettings.tsx)
- Dialog component with sections: Providers, GitHub Access, Preferences
- GitHub PAT input with show/hide toggle
- Provider enable/disable toggles with connection status
- Default sort preference
- Results per provider limit
- Persisted via `localStorage` with `marketplace_` prefix

##### [MODIFY] [SearchBar.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/marketplace/SearchBar.tsx)
- Add settings gear icon button to right side of search bar (next to ⌘K)

##### [MODIFY] [marketplaceStore.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/marketplaceStore.ts)
- Add `githubPat: string` field (persisted)
- Add `resultsPerProvider: number` field (persisted)
- Add `isSettingsOpen: boolean` field
- Add `setGithubPat`, `openSettings`, `closeSettings` actions

##### [MODIFY] [models.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/models.ts)
- Add `githubToken` to `MarketplaceSearchFilters` interface

##### [MODIFY] [backend.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/backend.ts)
- Pass `githubToken` through to backend calls

---

### Phase 3 — Polish

---

##### [MODIFY] [ViewMarketplace.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewMarketplace.tsx)
- Increase debounce from 400ms to 600ms
- Add minimum 2-character query length
- Render settings dialog

##### [MODIFY] [MarketplaceEmptyState.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/marketplace/MarketplaceEmptyState.tsx)
- Show search history chips
- Improve trending section with better loading states

##### [MODIFY] [FilterBar.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/marketplace/FilterBar.tsx)
- Add per-provider status indicators (✅ / ⚠️ / 🔄)

---

## Open Questions

> [!IMPORTANT]
> 1. **IzzyOnDroid approach**: Which option for IzzyOnDroid search? (A: Cross-reference, B: Drop search, C: Local index cache)
> 2. **GitHub auth**: Simple PAT text input vs. OAuth Device Flow?
> 3. **Aptoide malware filter**: Should we relax from `TRUSTED`-only to include `UNKNOWN` rank? Many legitimate apps have `UNKNOWN` status.

---

## Verification Plan

### Automated Tests
```bash
# After all changes:
pnpm format:check                  # Gate 1
pnpm lint                          # Gate 2
pnpm build                         # Gate 3
cargo test --manifest-path src-tauri/Cargo.toml  # Gate 4
```

### Manual Verification
1. Search "NewPipe" → verify results from F-Droid, GitHub, and Aptoide
2. Search "Signal" → verify results from multiple providers
3. Click an F-Droid result → verify detail dialog shows name and description
4. Click a GitHub result → verify releases with APK assets are shown
5. Open Settings dialog → verify all fields save and persist
6. Set a GitHub PAT → verify increased rate limit
7. Toggle providers on/off → verify search respects filters
8. Check home page → verify trending apps load
9. Test with no internet → verify graceful error messages
