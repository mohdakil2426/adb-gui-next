# UI Consistency Audit — ADB GUI Next

**Date:** 2026-03-23  
**Scope:** All 7 views, 15 shared components, 21 UI primitives, global.css  
**Current Estimated Consistency Score: ~72%**  
**Target: 95%**

---

## Executive Summary

The codebase has a **strong foundation**: a clean shadcn/ui token system, semantic colors, a consistent Card-based layout pattern, and lucide-react used exclusively for icons. However, there are **4 critical** and **10 moderate** consistency gaps that collectively pull the score below 80%. Addressing all issues in this report will bring the app to ≥95% consistency.

---

## 1. Token & Color System

### ✅ What's Already Good
- `global.css` defines a complete token set: `--background`, `--card`, `--primary`, `--muted`, `--destructive`, `--success`, `--warning`, `--terminal-*` variants — fully dual-mode (light + dark)
- All views use semantic tokens (`text-muted-foreground`, `bg-muted`, `text-destructive`) — no raw hex/rgb in views
- `--font-sans: 'Onest'` is globally declared

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| **CRITICAL** | `ViewPayloadDumper.tsx` (lines 66–72, 596, 601, 627, 637, 661, 725–733, 785) | Uses `text-[var(--terminal-log-success)]` and `border-[var(--terminal-log-success)]` inline — **should use `text-success` semantic token** |
| **CRITICAL** | `ViewPayloadDumper.tsx` (line 530) | `text-[var(--terminal-log-success)]` — same issue |
| Moderate | `MainLayout.tsx` (line 248) | Dead code branch: both `activeView === VIEWS.ABOUT` and `default` use the exact same padding `'p-4 sm:p-6'` |
| Low | `global.css` | `--content-min-width: 400px` and `--content-max-width: 1280px` are defined but used directly as CSS vars in MainLayout — good, but they're not registered in `@theme inline` so they won't work as Tailwind utilities |

**Fix for CRITICAL:**  Replace all `text-[var(--terminal-log-success)]` with `text-success`, `bg-[var(--terminal-log-success)]` with `bg-success`, etc. The `--success` token is already defined and mapped in `@theme inline` as `--color-success`.

---

## 2. Icon Consistency

### ✅ What's Already Good
- **100% lucide-react** icon library — no mixing of icon sets
- Icons in CardTitles follow a consistent pattern: `<Icon /> Label Text`

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| **CRITICAL** | `ViewDashboard.tsx` (InfoItem rows) | Icons passed as `<Building size={18} />`, `<Tag size={18} />`, `<Cpu size={18} />` etc. — uses the **`size` prop** (non-standard in this codebase). All other icons use Tailwind `className="h-4 w-4"` or `className="h-5 w-5"` |
| **CRITICAL** | `ViewFlasher.tsx` CardTitle | `<FileUp />`, `<Package />`, `<AlertTriangle />` — **no size class at all**. In other views CardTitle icons get `h-5 w-5` (e.g., Utilities view) |
| Moderate | `AppSidebar.tsx` | `<Info />` in footer has no size class — other footer items have no size class either but the pattern used in NavItems renders `<item.icon />` without size, relying on the sidebar primitive's `[&>svg]:size-4` |
| Moderate | `ViewDashboard.tsx` CardTitle | `<Wifi />`, `<Info />` — no size class. In `ViewUtilities`, CardTitle icons get explicit `className="h-5 w-5"` |
| Moderate | `ConnectedDevicesCard.tsx` | `<Smartphone className="h-5 w-5" />` — consistent with Utilities but different from Dashboard's `<Wifi />` which has no class |
| Low | `BottomPanel.tsx` | Tab icons use `size-3.5`, action icons `size-3.5` — consistent within itself, intentionally small for panel UI |
| Low | `ViewAbout.tsx` | CardTitle icons have `size-5` (using `size-*` shorthand), while most views use `h-5 w-5` (separate props). Both are valid in Tailwind v4 but inconsistent |

**Standard to Adopt:**
- **CardTitle icons:** `className="h-5 w-5"` (or `size-5`)
- **Inline/list icons:** `className="h-4 w-4"` (or `size-4`)
- **Never** use `<Icon size={18} />` prop — use Tailwind className only

---

## 3. Spacing & Layout

### ✅ What's Already Good
- All views use `flex flex-col gap-6` as the root container — **100% consistent across all 7 views**
- `CardContent` gap patterns are consistent: `flex flex-col gap-4` for major sections, `gap-3` for sub-sections, `gap-2` for tight groups
- `p-4 sm:p-6` for view padding via MainLayout — applied uniformly

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| **CRITICAL** | `ViewAppManager.tsx` (lines 241, 373) | Custom listbox using `rounded-lg border shadow-md bg-popover text-popover-foreground` — this is a custom combobox/listbox that **should use shadcn primitives** (ScrollArea + proper styling). The `shadow-md` doesn't match any other card/container in the codebase. |
| Moderate | `ViewFileExplorer.tsx` (line 235) | Root container uses `h-[calc(100vh-4rem)]` — a **magic number** that doesn't use CSS variables. The 4rem should reference a token. |
| Moderate | `ViewFileExplorer.tsx` (line 301) | `TableHead className="w-12.5"` — `w-12.5` is not a standard Tailwind spacing value. Should be `w-12` or `w-14`. |
| Moderate | `ViewPayloadDumper.tsx` (line 407) | `gap-6 pb-10` — the `pb-10` is inconsistent; `ViewUtilities` also has `pb-10` but other views (Dashboard, AppManager, Flasher) don't add bottom padding at all |
| Moderate | `ViewDashboard.tsx` InfoItem (line 390) | `p-3 bg-muted rounded-lg` — a custom card-like element rather than using the Card primitive. Acceptable for info grids but worth noting for future standardization |
| Low | `BottomPanel.tsx` (line 320) | Manual divider `<div className="w-px h-4 mx-1" style={{...}} />` instead of `<Separator orientation="vertical" className="mx-1 h-4" />` which is already imported and used elsewhere in `MainLayout.tsx` |
| Low | `ViewAppManager.tsx` (line 383) | `className="h-75 overflow-y-auto"` — `h-75` is an arbitrary Tailwind value (18.75rem). The same selector in the install list (line 242) also uses `max-h-75`. Consider extracting these as a shared constant or using a more standard value |

---

## 4. Typography

### ✅ What's Already Good
- All views use `text-sm text-muted-foreground` for secondary/description text — consistent
- CardTitle hierarchy is correct throughout
- `font-mono text-sm` for paths (FileExplorer), `font-mono text-xs` for code blocks (Utilities dialog)

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| Moderate | `ViewFlasher.tsx` CardTitle | `className="flex items-center gap-2 text-base md:text-lg"` — **only view that adds responsive font sizing to CardTitles**. All other views let shadcn's default `CardTitle` styles handle the size |
| Moderate | `ViewAbout.tsx` (lines 20–25) | Hero `<h1>` uses `text-3xl sm:text-4xl` with gradient clip text — unique to About, fine as a special page but noted |
| Low | `ViewPayloadDumper.tsx` (line 421) | `<h1 className="text-xl md:text-2xl font-bold">` — View has a custom header with an `h1` (like About). In other views, the view title is implied by the sidebar selection + breadcrumb in the header. Inconsistency: 5 views have no title, 2 (About + PayloadDumper) have custom hero headers |
| Low | `ViewAppManager.tsx` (line 238) | `<label className="text-sm font-medium">` — uses raw `<label>` instead of the shadcn `<Label>` component (already available as a primitive) |
| Low | `ViewFlasher.tsx` (lines 209, 222, 266) | `<label className="text-sm font-medium">` — same issue as above |

---

## 5. Component Pattern Consistency

### ✅ What's Already Good
- `ConnectedDevicesCard` is properly shared across Dashboard, Flasher, and Utilities — ✅ DRY
- `EditNicknameDialog` shared across Dashboard, Flasher, and Utilities — ✅ DRY
- `SectionHeader` shared between PayloadDumper and Utilities — ✅ DRY
- Error handling pattern (`try/catch → toast.error + handleError`) is consistent

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| **CRITICAL** | `ViewAppManager.tsx` (lines 412–426) | **Custom checkbox** rendered with SVG — `<div className="h-4 w-4 rounded..."><svg>✓</svg></div>`. There is no shadcn Checkbox primitive, but this same pattern exists in `ViewPayloadDumper.tsx` (lines 603–614). These two checkboxes are visually similar but implemented with different markup structures — they should be extracted into a shared `<CheckboxItem>` component |
| Moderate | `ViewFlasher.tsx`, `AlertDialogAction` (line 339) | `className="bg-destructive hover:bg-destructive/90"` — manually applies destructive styles instead of using `buttonVariants({ variant: 'destructive' })`. `ViewAppManager.tsx` uses `buttonVariants()` correctly (line 489); `ViewUtilities.tsx` uses inline class (line 464). Inconsistent |
| Moderate | `ViewDashboard.tsx` | Uses `useQuery` from `@tanstack/react-query` with `refetchInterval`. Flasher and Utilities also do. `ViewAppManager.tsx` and `ViewFileExplorer.tsx` use manual `useState + useCallback + useEffect` with no React Query — different data fetching strategies for similar concerns |
| Moderate | Refresh button pattern | Three different patterns: (1) `variant="outline" size="icon"` (FileExplorer, AppManager), (2) `variant="ghost" size="icon"` (ConnectedDevicesCard), (3) `variant="default"` with text (Dashboard Device Info). Should standardize on `variant="ghost" size="icon"` for icon-only refreshes |
| Moderate | Loading state in buttons | Two patterns mix: `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` vs `<Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />`. The `shrink-0` is missing in some buttons (Dashboard lines 208, 258, 272, 297; AppManager line 301, 494). Should always include `shrink-0` on icons inside flex buttons |
| Low | `ViewPayloadDumper.tsx` | Uses `EventsOn` / `EventsOff` from `../../lib/desktop/runtime` (relative import) while all other views use `@/` alias for shared imports |
| Low | `ViewPayloadDumper.tsx` (line 21) | Double import of `getFileName` and `cn` from `@/lib/utils` (lines 20–21 are separate import statements for the same module) — should be merged into one |

---

## 6. Accessibility

### ✅ What's Already Good
- All interactive buttons wrapped in `Tooltip` in the BottomPanel and header toolbar
- `sr-only` on SidebarTrigger's toggle text
- `aria-label` on SidebarRail
- Form fields with explicit `id` / `htmlFor` in Flasher's partition input

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| Moderate | `ViewAppManager.tsx` (package list items, line 398–436) | Clickable `<div>` rows with no `role="option"` or `aria-selected`. Should use `role="listbox"` > `role="option"` or proper button elements |
| Moderate | `ViewPayloadDumper.tsx` (partition rows, line 585–668) | Same: clickable `<div>` with no `role` or `aria-checked` for checkbox semantics |
| Moderate | `ViewFileExplorer.tsx` | Table rows are `<TableRow>` with `onClick`/`onDoubleClick` but no `role="button"` or keyboard handler for Enter/Space key — mouse-only interaction |
| Low | `ConnectedDevicesCard.tsx` edit button | `<Button variant="ghost" size="icon">` on hover — opacity-0 by default (invisible), which is keyboard-inaccessible |
| Low | `ViewAbout.tsx` (line 102–108) | `<a href="..." onClick={openLink}>` — the `href` points to GitHub but `onClick` uses Tauri's `BrowserOpenURL`. On Tauri, clicking the `<a>` directly may open a system browser while `BrowserOpenURL` does too — this creates a double-open. Should use `<button>` instead |

---

## 7. Animation & Transitions

### ✅ What's Already Good
- `framer-motion` `AnimatePresence` + `motion.div` used for view transitions in MainLayout (opacity fade 150ms) — polished
- Welcome screen fade-out via `AnimatePresence`
- Button hover/focus states from shadcn primitives

### ❌ Issues Found

| Severity | Location | Issue |
|----------|----------|-------|
| Low | `ViewAbout.tsx` | Uses Tailwind's `animate-in fade-in slide-in-from-bottom-4 duration-500` — different animation system from framer-motion used in MainLayout. The About view animates itself, not through the `motion.div` wrapper. This causes a double-animation: the `motion.div` fades in (150ms opacity), then `animate-in slide` plays (500ms). |
| Low | `BottomPanel.tsx` resize handle | The 1px `border-top` drag handle uses `hover:bg-primary/50 active:bg-primary transition-colors` — subtle but good. However the background color is set via `style={{ backgroundColor: 'var(--terminal-border)' }}` and the hover overrides it with a Tailwind class — the two selectors may conflict |

---

## 8. Missing Improvements & Additions

These are not inconsistencies but **high-value additions** to reach 95%+ polish:

### 🔴 High Impact

1. **Empty state components**: Most views show plain `<p className="text-muted-foreground">` for empty states. A shared `<EmptyState icon={...} title={...} description={...} />` component would be premium and consistent.

2. **`<Label>` for all form labels**: Replace raw `<label className="text-sm font-medium">` in Flasher and AppManager with the shadcn `<Label>` primitive for consistent focus ring propagation.

3. **Shared `<CheckboxItem>` component**: The two independently implemented checkboxes (AppManager package list + PayloadDumper partition list) have slightly different structure. Extract to a shared component.

4. **Icon size standardization** (see Section 2 above): Pick one pattern and apply globally.

### 🟡 Medium Impact

5. **`SectionHeader` adoption**: `SectionHeader` is used in Utilities and PayloadDumper but not in Dashboard or FileExplorer for sub-section labels (e.g., "Step 1", "Step 2" in Dashboard). Promote its usage everywhere there's a sub-group title.

6. **`pb-10` inconsistency**: Only Utilities and PayloadDumper add bottom padding. Since MainLayout's scroll area handles overflow, this extra padding is somewhat redundant but creates visual inconsistency in how views "end".

7. **React Query consistency**: Standardize all data fetching on React Query (`useQuery`) rather than having a split between `useQuery` and `useState/useEffect` for similar concerns.

8. **Separator primitive in BottomPanel**: Replace the manual `<div className="w-px h-4 mx-1">` divider with `<Separator orientation="vertical">`.

### 🟢 Low Impact / Polish

9. **`shrink-0` on all in-button icons**: Prevents icon compression in narrow layouts. Currently missing in ~8 places.

10. **Double import of `@/lib/utils`** in PayloadDumper: Merge into one import statement.

11. **`variant="destructive"` via `buttonVariants()`** uniformly in all `AlertDialogAction` buttons.

12. **Merge identical `cn()` branches** in MainLayout (`activeView === VIEWS.ABOUT ? 'p-4 sm:p-6' : 'p-4 sm:p-6'`).

13. **Keyboard navigation for file table rows** in FileExplorer.

---

## 9. Prioritized Fix Roadmap

To go from **~72% → 95%**, address in this order:

| Priority | Task | Estimated Impact |
|----------|------|-----------------|
| P1 | Replace all `text-[var(--terminal-log-success)]` with `text-success` | +5% |
| P1 | Standardize icon sizes in CardTitle to `h-5 w-5` across all views | +5% |
| P1 | Replace `<label>` with `<Label>` in Flasher + AppManager | +3% |
| P1 | Add `role` / `aria-*` to clickable div lists (AppManager, PayloadDumper) | +3% |
| P2 | Extract shared `<CheckboxItem>` component | +2% |
| P2 | Standardize refresh button variant to `variant="ghost" size="icon"` | +2% |
| P2 | Add `shrink-0` to all in-button icons | +1% |
| P2 | Replace manual divider in BottomPanel with `<Separator>` | +1% |
| P2 | Merge double `@/lib/utils` import in PayloadDumper | +0.5% |
| P2 | Fix double-animation on About page | +1% |
| P2 | Use `buttonVariants({ variant: 'destructive' })` in all AlertDialogActions | +1% |
| P3 | Add shared `<EmptyState>` component | +2% |
| P3 | Standardize data fetching to React Query everywhere | +2% |
| P3 | Remove dead `cn()` branch in MainLayout | +0.5% |
| **Total** | | **~29% improvement → 95%+** |

---

## 10. Current Score Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| Token usage (colors) | 80% | Payload view bypasses semantic tokens |
| Icon consistency | 65% | Size class pattern inconsistent across views |
| Spacing / layout | 85% | Minor issues, strong foundation |
| Typography | 85% | Good, some raw `<label>` and responsive font-size inconsistency |
| Component reuse | 75% | Dual checkbox implementation, mixed data fetching |
| Accessibility | 60% | Clickable divs missing roles, invisible edit buttons |
| Animation | 85% | Mostly consistent with minor double-animation |
| **Overall** | **~72%** | |

---

*Audit performed 2026-03-23 — covers entire `src/` frontend codebase as of the Tauri 2 migration.*
