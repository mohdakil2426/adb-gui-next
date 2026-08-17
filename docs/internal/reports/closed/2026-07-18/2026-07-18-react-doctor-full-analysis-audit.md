# React Doctor full analysis (Tauri desktop) — audit

**Date:** 2026-07-18  
**Source run:** `C:\Users\akila\AppData\Local\Temp\react-doctor-e658572f-464e-4c73-924b-087ce864df52`  
**App context:** ADB GUI Next — **Tauri 2 + Vite SPA** (not Next.js / not SSR). Hydration-style findings need special care.  
**Totals:** **56** findings — **9 error**, **47 warning** (from `diagnostics.json`)

---

## Executive summary

| Question | Answer |
| --- | --- |
| Is 100/100 realistic this pass? | **Not without deliberate work.** Score is not published as a single number in the dump, but **9 errors** must clear first, then most **real** warnings. Noise exists (shadcn dead primitives, some desktop false friends). |
| Can we reach 100 eventually? | **Yes, if** all real bugs/a11y/perf issues are fixed **and** remaining false positives are accepted by the tool (or code is adjusted so they no longer fire). A pure “ignore false positives in the score” mode is not guaranteed. |
| Top risk to users | Impure state updaters (File Explorer / tree), marketplace timer cleanup, layout animations (jank), keyboard-unreachable resize handle |
| Top noise for Tauri | `rendering-hydration-no-flicker` (no SSR hydration in production window), some `unused-file` on optional shadcn primitives kept for design-system completeness |

---

## Score 100 feasibility

**Blocking to a clean React Doctor run:**

1. **Errors (9)** — treat as must-fix  
   - `no-impure-state-updater` ×5 (FE selection/sort + DirectoryTree)  
   - `effect-needs-cleanup` ×1 (`useMarketplaceAuth` setTimeout)  
   - `no-layout-property-animation` ×3 (`FileBanner` height animation)  

2. **High-value warnings** — a11y + real unused deps + giant components + button types  

3. **Likely false positives / low product value**  
   - Hydration flicker (desktop SPA; first paint still can flash theme — **partially real UX**, not classic SSR hydration)  
   - `unused-file` on shadcn inventory components (`avatar`, `slider`, …) if you **intentionally** keep them for future UI  
   - `PanelHeader.tsx` / `useBottomPanelResize.ts` flagged unused — **real dead code** today (BottomPanel inlined logic)  

**Honest 100 path:** fix all errors + real warnings; either use or delete dead modules; for intentional shadcn inventory, tool may still warn until used.

---

## Counts by rule

| Count | Rule | Severity (as reported) |
| ---: | --- | --- |
| 7 | deslop/unused-file | warning |
| 5 | no-array-index-as-key | warning |
| 5 | no-impure-state-updater | **error** |
| 5 | button-has-type | warning |
| 4 | use-lazy-motion | warning |
| 3 | exhaustive-deps | warning |
| 3 | prefer-module-scope-pure-function | warning |
| 3 | no-giant-component | warning |
| 3 | no-layout-property-animation | **error** |
| 2 | unused-dependency | warning |
| 2 | rendering-hydration-no-flicker | warning |
| 2 | js-combine-iterations | warning |
| 2 | prefer-explicit-variants | warning |
| 1 each | interactive-supports-focus, prefer-tag-over-role, prefer-module-scope-static-value, unused-export, async-await-in-loop, rerender-state-only-in-handlers, jsx-no-constructed-context-values, js-set-map-lookups, no-many-boolean-props, effect-needs-cleanup | mix |

`fixGroupId` was **not** present on this dump (all `"none"`) — treat each site carefully; still cluster by root cause manually.

---

## Top 3 (this pass) — validation

### 1. `deslop/unused-dependency` (×2) — package.json

| Dep | Verdict | Why |
| --- | --- | --- |
| `@radix-ui/react-switch` | **Real** | `src/shared/ui/switch.tsx` imports `Switch` from **`radix-ui`** package, not `@radix-ui/react-switch`. No src imports of the scoped package. |
| `canvas-confetti` (+ likely `@types/canvas-confetti`) | **Real** | Only listed in package.json; zero runtime imports under `src/`. |

**Human impact:** **Low for end users today** — does not crash the app. **Medium for maintainability** — extra install weight and supply-chain surface.

**Canonical fix:** Remove unused packages from `package.json` / lockfile.

---

### 2. `react-doctor/no-giant-component` (×3)

| Component | Lines (approx) | Verdict |
| --- | --- | --- |
| `BottomPanel` | ~603 | **Real** — large shell + resize + tabs + header UI inlined |
| `PanelHeader` | ~418 | **Real size**, but file is **currently unused** (no imports). Dead giant. |
| `ViewFileExplorer` | ~657 | **Real** — coordinator still too large despite hooks |

**Recipe (react.doctor):** Split by responsibility; extract sections/hooks; avoid pointless micro-splits.

**Human impact:** **Low direct UX** — app still works. **High developer cost** — bugs and regressions more likely when changing shell/explorer.

**Preferred root-cause strategy for BottomPanel:**

1. Wire existing `PanelHeader` + `useBottomPanelResize` instead of leaving them dead.  
2. Extract resize handle / tab chrome if still over 300 lines.  
3. FileExplorer: push more orchestration into hooks/UI children until `FileExplorerView` is thin.

**Note:** Flagging `PanelHeader` as “hard to change” while it is unused is still valid file smell; best fix is **use it or delete it**, not silence.

---

### 3. `react-doctor/interactive-supports-focus` (×1)

**Site:** `BottomPanel.tsx` ~292 — `div` with `role="separator"`, `onMouseDown`, `aria-label`, **no `tabIndex`**.

**Verdict:** **Real accessibility gap** (pointer resize works; keyboard users cannot focus the handle).

**Recipe:** Add `tabIndex={0}` (or `-1` if managed focus) + keyboard activation (e.g. arrows for resize) **or** use a more semantic control pattern. Native focusability is required for role=separator that is interactive.

**Human impact:** **Medium a11y** — keyboard/AT users cannot resize the bottom panel. Not a crash; fairness/usability issue.

---

## Full inventory with Tauri-aware FP notes

### Errors (fix first after top-3 batch if continuing)

| Rule | Sites | Real? | Human impact |
| --- | --- | --- | --- |
| no-impure-state-updater | FE selection (2), FE sort (1), DirectoryTree (2) | **Real risk** | Updaters may run twice (Strict Mode); nested setState can cause subtle selection/sort bugs |
| effect-needs-cleanup | useMarketplaceAuth timer | **Real** | Timer after unmount → warning/possible state-on-unmounted component |
| no-layout-property-animation | FileBanner height ×3 | **Real perf** | Height animation causes layout thrash / jank during expand |

### Accessibility

| Rule | Sites | Real? | Notes |
| --- | --- | --- | --- |
| interactive-supports-focus | BottomPanel separator | **Real** | Top-3 |
| prefer-tag-over-role | ViewContent `role="main"` | **Real, easy** | Prefer `<main>` |
| button-has-type | About, FE toolbar, FileBanner, … | **Real** | Default `type=submit` inside forms can accidental-submit; buttons outside forms are lower risk but still correct to set `type="button"` |

### Performance

| Rule | Real for Tauri? | Notes |
| --- | --- | --- |
| use-lazy-motion | **Mostly real** | Bundle size still matters in webview |
| js-set-map-lookups | **Real micro-perf** | payloadDumperStore includes-in-loop |
| js-combine-iterations | **Real style/perf** | queries.ts filter+map |
| rendering-hydration-no-flicker | **Partial FP** | No SSR hydrate; theme still can flash on first client paint — fix is UX polish via `useSyncExternalStore` / script, not “Next hydration” |
| async-await-in-loop | **Real if sequential not required** | InstallationTab multi-install |
| jsx-no-constructed-context-values | **Real re-render** | toggle-group context value |

### Maintainability / deslop

| Rule | Sites | Notes |
| --- | --- | --- |
| unused-dependency | package.json ×2 | Real — top-3 |
| unused-file | PanelHeader, useBottomPanelResize, avatar, command?, radio-group, slider, toggle | PanelHeader/resize: **real dead**. shadcn extras: **often intentional inventory** — product choice |
| unused-export | `isWindows` | Real dead export unless planned |
| no-giant-component | 3 files | Top-3 |
| prefer-explicit-variants / no-many-boolean-props | PanelHeader, WirelessAdbCard | Real design smell |
| prefer-module-scope-* | About, restore tab, marketplace, … | Real minor re-create on render |

### Bugs (warnings)

| Rule | Notes |
| --- | --- |
| no-array-index-as-key | Logs, shell history, root progress, marketplace, field — **real if lists reorder**; stable for static lists |
| exhaustive-deps | DirectoryTree getFileAccessMode — **real instability** of callbacks/effects |
| rerender-state-only-in-handlers | ShellPanel historyIndex — investigate dead state |

### command.tsx “unused-file”

React Doctor claims unused. Project history: debloat **stopped** using `Command`/`CommandInput` in some paths after a crash. Treat as **likely real dead (or only test)** until a live import is proven — do **not** delete without confirming no dynamic import / storybook.

---

## Recommended fix order

### Pass A — Top 3 (this request)

1. Remove unused deps (`@radix-ui/react-switch`, `canvas-confetti`, `@types/canvas-confetti` if unused).  
2. A11y: focusable resize separator (+ keyboard).  
3. Giant components: rewire BottomPanel to `PanelHeader`/`useBottomPanelResize`; thin FileExplorerView further.

### Pass B — Errors

4. Impure updaters (selection/sort/tree).  
5. Marketplace effect cleanup.  
6. FileBanner layout animation (transform/opacity instead of height).

### Pass C — High ROI warnings

7. `type="button"` on buttons.  
8. `<main>` instead of role.  
9. array keys where lists mutate.  
10. LazyMotion / motion imports.  
11. queries.ts single-pass merge.

### Pass D — Product decisions

12. Delete or adopt unused shadcn files.  
13. Hydration/theme flash polish if desired.

---

## Canonical recipes used

- [no-giant-component](https://react.doctor/docs/rules/react-doctor/no-giant-component)  
- [interactive-supports-focus](https://react.doctor/docs/rules/react-doctor/interactive-supports-focus)  
- unused-dependency: remove if no imports (deslop help text)

---

## Appendix — raw dump location

```text
C:\Users\akila\AppData\Local\Temp\react-doctor-e658572f-464e-4c73-924b-087ce864df52\
  diagnostics.json
  *.txt per rule
```

## Implementation notes (top-3 pass, same day)

| Issue | Status |
| --- | --- |
| Unused `@radix-ui/react-switch`, `canvas-confetti` (+ types) | **Fixed** — removed from package.json / lockfile |
| `interactive-supports-focus` resize handle | **Fixed** — `tabIndex={0}`, arrow-key height adjust via `adjustHeightBy` |
| Giant `BottomPanel` | **Fixed** — thin shell using `PanelHeader` + `useBottomPanelResize` (~194 lines) |
| Giant `PanelHeader` | **Fixed** — actions extracted to `PanelHeaderActions` (~164 lines) |
| Giant `ViewFileExplorer` | **Fixed** — logic in `useFileExplorerViewModel` + reducers module (~109 line view) |

**Verification:**

- `bun run lint:web` pass  
- Focused Vitest BottomPanel + ViewFileExplorer **6/6** pass  
- Re-run `npx react-doctor@latest`: **61/100** (was lower; **48** issues left: 9 errors / 39 warnings)  
- Top-3 groups for unused deps + giant components + resize focus **cleared** from the new dump summary  
- Tool message: *“You could improve +9% by fixing the top 3 issues”* on remaining backlog  

**100/100:** Still blocked mainly by **9 errors** (impure updaters, layout animations, effect cleanup) plus remaining warnings. Reachable with a dedicated pass, not this top-3-only change set.
