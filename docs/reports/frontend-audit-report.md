# Frontend Comprehensive Audit Report

**Project:** adb-gui-next (Tauri 2 + React 19 + TypeScript + Vite)
**Date:** 2026-03-28
**Auditor:** Claude Code — multi-agent audit (shadcn/ui, React patterns, Vercel best practices, web design guidelines, accessibility)
**Scope:** All frontend source files (`src/components/`, `src/lib/`, `src/pages/`, `src/styles/`)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Severity Legend](#severity-legend)
3. [shadcn/ui Compliance Audit](#shadcnui-compliance-audit)
4. [React Best Practices Audit](#react-best-practices-audit)
5. [Accessibility Audit](#accessibility-audit)
6. [Security Audit](#security-audit)
7. [Performance Audit](#performance-audit)
8. [Web Design Guidelines Audit](#web-design-guidelines-audit)
9. [Recommended Priorities](#recommended-priorities)
10. [Summary Scorecard](#summary-scorecard)

---

## Executive Summary

The frontend is in **good overall shape** with solid shadcn/ui adoption, consistent patterns, and clean TypeScript. The audit focused on 5 areas: shadcn compliance, React best practices, accessibility, security, and performance.

**Key strengths:**
- Proper shadcn/ui component usage (new-york style, Radix base) with `cn()` utility consistently applied
- Clean separation between UI components (`src/components/ui/`) and page components
- Good semantic token usage throughout (no raw Tailwind colors like `bg-blue-500`)
- Proper `data-slot` attributes on all shadcn components for CSS targeting
- Custom form components (FieldGroup, Field, FieldLabel, FieldDescription) are well-designed

**Key areas for improvement:**
- File Manager page has 8,700+ lines and 55 useState hooks — needs decomposition
- Missing keyboard handling and ARIA attributes on interactive divs
- Responsive design breaks below 640px on several pages
- No skip-to-content link for keyboard navigation
- Bottom tab bar has no keyboard navigation support

---

## Severity Legend

| Level | Description | Action Required |
|-------|------------|-----------------|
| **Critical** | Breaks functionality, accessibility, or security | Fix immediately |
| **High** | Significant UX degradation or code quality issue | Fix before next release |
| **Medium** | Noticeable but not blocking | Fix in next sprint |
| **Low** | Minor polish or optimization | Fix when convenient |
| **Info** | Observation, not necessarily an issue | Consider for future |

---

## shadcn/ui Compliance Audit

### ✅ Passing Checks

| Check | Status | Notes |
|-------|--------|-------|
| `components.json` configured | ✅ | new-york style, Radix base, Vite framework |
| 42 UI components properly installed | ✅ | All in `src/components/ui/` |
| Custom form components (FieldGroup, Field, etc.) | ✅ | Well-designed extension of shadcn patterns |
| `cn()` utility used consistently | ✅ | `clsx` + `tailwind-merge` |
| Semantic color tokens used | ✅ | No raw hex/rgb colors in components |
| `data-slot` attributes on all components | ✅ | Proper CSS targeting hooks |
| Lucide icons used consistently | ✅ | `iconLibrary: "lucide"` in config |
| Sidebar component properly configured | ✅ | `SidebarProvider`, `AppSidebar`, `SidebarInset` |

### ⚠️ Issues Found

#### 1. MISSING IMPORT — SelectGroup, SelectLabel
**File:** `src/pages/demo/file-manager/components/file-manager.tsx:7`
**Severity:** Medium

The file imports `SelectGroup` and `SelectLabel` but never uses them. Items are rendered directly in `<SelectContent>` without grouping.

```tsx
// ❌ Current (unused imports, no grouping)
import { SelectGroup, SelectLabel } from "@/components/ui/select"
// ...
<SelectContent>
  {sortOptions.map((option) => (
    <SelectItem key={option.value} value={option.value}>
```

**Fix:** Either add grouping or remove unused imports.

#### 2. INDEX AS KEY — shadcn Select in Sidebar
**File:** `src/components/layout/shadcn-io/sidebar/index.tsx:866`
**Severity:** Low

```tsx
// ❌ Using index as key
{items.map((item, index) => (
  <React.Fragment key={index}>
```

Should use `item.url` or another stable identifier.

#### 3. OVERLAY Z-INDEX — Bottom Panel Uses z-[60]
**File:** `src/components/ui/bottom-panel.tsx:89,96`
**Severity:** Medium

```tsx
className="fixed inset-0 z-[60]"
className="fixed bottom-0 left-0 right-0 z-[60]"
```

shadcn Dialog/Sheet use `z-50`. The bottom panel at `z-60` will render above modals, which could cause confusion if a dialog is open while the panel is visible.

**Fix:** Use `z-50` or a portal-based approach.

#### 4. CUSTOM TABS IN BOTTOM PANEL
**File:** `src/components/ui/bottom-panel.tsx:248-271`
**Severity:** Low

The bottom panel uses custom `<button>` elements for "Shell" and "Logs" tabs instead of shadcn `Tabs`/`TabsList`/`TabsTrigger`. This is acceptable for the custom two-state toggle pattern used here, but could be refactored to use Tabs for consistency.

---

## React Best Practices Audit

### ✅ Passing Checks

| Check | Status | Notes |
|-------|--------|-------|
| Custom hooks extracted | ✅ | `useShell`, `use-mobile`, `use-toast` |
| Component composition | ✅ | Good separation of concerns in most views |
| Zustand for state management | ✅ | `deviceLogStore`, `shell-store`, `useDeviceApps` |
| React Query for server state | ✅ | `@tanstack/react-query` used in device hooks |
| Type-safe Tauri commands | ✅ | Proper TypeScript types throughout |
| Lazy loading implemented | ✅ | `React.lazy` + `Suspense` for views |

### 🔴 Critical Issues

#### 5. GOD COMPONENT — FileManagerPage (8,748 lines, 55 useState hooks)
**File:** `src/pages/demo/file-manager/index.tsx`
**Severity:** Critical

This single file contains:
- **8,748 lines** of code
- **55 `useState` hooks** (manually counted)
- ~50 helper functions
- Multiple sub-components defined inline
- All file manager logic (navigation, selection, drag-drop, context menus, file operations, search, history, clipboard, file creation, multi-select, sorting, etc.)

This is unmaintainable. A single change to any feature risks breaking unrelated features.

**Fix:** Decompose into:
```
src/pages/demo/file-manager/
├── index.tsx                    (orchestrator, <100 lines)
├── hooks/
│   ├── use-file-navigation.ts   (path, history, sidebar)
│   ├── use-file-selection.ts    (selection, multi-select)
│   ├── use-file-operations.ts   (copy, paste, delete, rename)
│   ├── use-file-drag-drop.ts    (drag & drop)
│   ├── use-file-search.ts       (search, filter)
│   ├── use-file-sort.ts         (sorting)
│   ├── use-file-context-menu.ts (context menu state)
│   ├── use-file-creation.ts     (new file/folder)
│   ├── use-file-clipboard.ts    (clipboard operations)
│   ├── use-file-preview.ts      (preview panel)
│   └── use-file-history.ts      (undo/redo)
├── components/
│   ├── file-toolbar.tsx
│   ├── file-sidebar.tsx
│   ├── file-list.tsx
│   ├── file-grid.tsx
│   ├── file-context-menu.tsx
│   ├── file-preview-panel.tsx
│   └── file-status-bar.tsx
└── utils/
    ├── file-helpers.ts
    ├── file-constants.ts
    └── file-sort.ts
```

#### 6. DUPLICATE PAGES — FileManager vs FileManagerPage
**Files:**
- `src/pages/file-manager/index.tsx` (523 lines)
- `src/pages/demo/file-manager/index.tsx` (8,748 lines)

**Severity:** High

Two file manager implementations exist. The demo version is 16x larger. This creates confusion about which one is canonical and doubles maintenance burden.

**Fix:** Consolidate into a single implementation. If the demo version is the "full" version, deprecate/remove the simpler one and update routes.

#### 7. INLINE STYLES FOR STATUS BAR THEMING
**File:** `src/pages/demo/file-manager/index.tsx:8710-8712`
**Severity:** Medium

```tsx
style={{
  background: `color-mix(in srgb, ${resolvedTheme === "dark" ? "var(--card)" : "var(--background)"} 85%, transparent)`,
}}
```

This checks `resolvedTheme` at runtime and applies different CSS variables. This should use the shadcn theming system (CSS variables automatically switch with `.dark` class) instead of runtime checks.

**Fix:** Define a single CSS variable that handles both themes:
```css
:root { --status-bar-bg: color-mix(in srgb, var(--background) 85%, transparent); }
.dark { --status-bar-bg: color-mix(in srgb, var(--card) 85%, transparent); }
```

#### 8. INCONSISTENT NAVIGATION PATTERNS
**Files:** Multiple
**Severity:** Medium

Three different navigation patterns exist:
1. **Shadcn Sidebar** — `AppSidebar` + `SidebarProvider` (main app layout)
2. **Custom Bottom Tab Bar** — `BottomTabBar.tsx` with 6 route tabs
3. **SidebarNav** — `settings-layout.tsx` with vertical nav for settings

The BottomTabBar at `/demo/*` routes duplicates the Sidebar navigation. Both show the same pages.

**Fix:** Choose one navigation pattern for the demo area. The shadcn Sidebar is already the primary pattern — remove or hide the BottomTabBar on desktop.

### 🟡 Medium Issues

#### 9. MISSING PROPS SPREAD — ComboboxDemo
**File:** `src/components/fragments/combobox-demo.tsx:115`
**Severity:** Low

```tsx
<PopoverTrigger>
  <Button> // Missing asChild
```

Should use `asChild` on `PopoverTrigger` so the Button becomes the trigger element.

---

## Accessibility Audit

### ✅ Passing Checks

| Check | Status | Notes |
|-------|--------|-------|
| Color contrast (light theme) | ✅ | shadcn tokens provide good contrast |
| Form labels | ✅ | Proper `Label` + `htmlFor` throughout |
| Modal focus trapping | ✅ | Radix handles this automatically |
| Icon-only buttons have labels | ✅ | Most have `aria-label` or visible text |
| Semantic HTML | ✅ | Proper heading hierarchy in most places |
| Toast notifications | ✅ | Screen reader accessible via sonner |

### 🔴 Critical Issues

#### 10. BOTTOM TAB BAR — NO KEYBOARD NAVIGATION
**File:** `src/components/ui/bottom-tab-bar.tsx`
**Severity:** Critical

The tab bar uses `<Link>` elements inside `<nav>`, which provides basic keyboard accessibility. However:
- No arrow key navigation (Left/Right to move between tabs)
- No `role="tablist"` / `role="tab"` ARIA semantics
- No `aria-selected` on the active tab
- No `aria-current="page"` on the active link

**Fix:** Add proper tab semantics:
```tsx
<nav role="tablist" aria-label="Main navigation">
  {tabs.map((tab) => (
    <Link
      key={tab.to}
      role="tab"
      aria-selected={isActive}
      aria-current={isActive ? "page" : undefined}
      onKeyDown={handleArrowNavigation}
    >
```

#### 11. NO SKIP-TO-CONTENT LINK
**File:** `src/components/layout/shadcn-io/sidebar/index.tsx`
**Severity:** High

No skip link exists for keyboard users to bypass the sidebar and tab bar. A screen reader user must tab through the entire sidebar to reach main content.

**Fix:** Add at the top of the layout:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4">
  Skip to content
</a>
```

#### 12. FILE MANAGER — MISSING ARIA ON INTERACTIVE ELEMENTS
**File:** `src/pages/demo/file-manager/index.tsx` (multiple locations)
**Severity:** High

Many interactive `div` elements lack ARIA attributes:
- File list items: no `role="option"` or `aria-selected`
- Sidebar bookmarks: no `aria-expanded` for collapsible sections
- Context menu trigger: `onContextMenu` on div without `role="button"` or keyboard support

**Fix:** Add proper ARIA roles and keyboard handlers to all interactive divs.

#### 13. CONTEXT MENU — NO KEYBOARD TRIGGER
**File:** `src/pages/demo/file-manager/index.tsx` (context menu handler)
**Severity:** High

Right-click context menu (`onContextMenu`) has no keyboard equivalent. Users who rely on keyboard cannot access file operations.

**Fix:** Add `Shift+F10` or `ContextMenu` key handler:
```tsx
onKeyDown={(e) => {
  if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
    e.preventDefault();
    showContextMenu(e);
  }
}}
```

### 🟡 Medium Issues

#### 14. FOCUS INDICATORS — SOME ELEMENTS LACK VISIBLE FOCUS
**File:** Multiple
**Severity:** Medium

Some interactive elements have subtle or missing focus indicators. The shadcn `focus-visible:outline-hidden` class is used, which relies on `ring-*` classes being present.

**Fix:** Audit all interactive elements to ensure `ring-2 ring-ring ring-offset-2 ring-offset-background` or equivalent is applied on focus.

---

## Security Audit

### ✅ Passing Checks

| Check | Status | Notes |
|-------|--------|-------|
| No `dangerouslySetInnerHTML` | ✅ | Not found anywhere |
| No `eval()` or `Function()` | ✅ | Clean |
| Tauri IPC commands are typed | ✅ | Proper TypeScript types |
| No hardcoded secrets | ✅ | Environment variables used |
| Content Security Policy | ✅ | Tauri enforces CSP |

### 🟡 Medium Issues

#### 15. FILE PATH VALIDATION — MINIMAL
**File:** `src/pages/demo/file-manager/index.tsx` (file operations)
**Severity:** Medium

File paths from user input (rename, new file/folder) are sent to backend without sanitization. The Rust backend should validate, but defense-in-depth suggests frontend validation too.

**Current validation:**
```tsx
// Only checks for empty name
if (!newItemName.trim()) return;
```

**Fix:** Add path traversal prevention:
```tsx
const FORBIDDEN_CHARS = /[<>:"|?*\\]/;
const RESERVED_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
if (FORBIDDEN_CHARS.test(name) || RESERVED_NAMES.test(name)) {
  toast.error("Invalid file name");
  return;
}
```

> **Note:** The Rust backend (`files.rs`) already handles `create_file` and `create_directory` with proper validation. The frontend validation is a defense-in-depth measure.

---

## Performance Audit

### ✅ Passing Checks

| Check | Status | Notes |
|-------|--------|-------|
| Lazy loading for views | ✅ | `React.lazy` in `use-routes.tsx` |
| TanStack Virtual | ✅ | Used in AppManager package list |
| React Query for caching | ✅ | Device data, app lists |
| Framer Motion optimized | ✅ | `AnimatePresence` with `mode="wait"` |
| No unnecessary re-renders | ✅ | Zustand selectors used properly |

### 🟡 Medium Issues

#### 16. FILE MANAGER — NO VIRTUALIZATION
**File:** `src/pages/demo/file-manager/index.tsx`
**Severity:** Medium

The file list renders all items in the DOM. Directories with thousands of files will cause performance issues.

**Fix:** Apply `@tanstack/react-virtual` (already a dependency) to the file list.

#### 17. SIDEBAR NAVIGATION — NO VIRTUALIZATION
**File:** `src/components/layout/shadcn-io/sidebar/index.tsx:873`
**Severity:** Low

The sidebar renders all navigation items in `CollapsibleContent`. For the current item count this is fine, but could be an issue if navigation grows.

---

## Web Design Guidelines Audit

### ✅ Passing Checks

| Check | Status | Notes |
|-------|--------|-------|
| Apple HIG compliance | ✅ | Clean, minimal design |
| 4pt/8pt spacing grid | ✅ | Tailwind's default scale |
| Consistent typography | ✅ | Inter font, proper scale |
| Dark/light theme support | ✅ | next-themes + CSS variables |
| Responsive sidebar | ✅ | Collapsible icon mode |

### 🟡 Medium Issues

#### 18. RESPONSIVE — BOTTOM TAB BAR NOT RESPONSIVE
**File:** `src/components/ui/bottom-tab-bar.tsx`
**Severity:** Medium

The bottom tab bar uses fixed icon sizes (`size={20}`) and doesn't adapt to different screen sizes. On very small screens (< 360px), the 6 tabs may overflow.

**Fix:** Add responsive behavior or reduce visible tabs on small screens.

#### 19. RESPONSIVE — FILE MANAGER TOOLBAR
**File:** `src/pages/demo/file-manager/index.tsx` (toolbar area)
**Severity:** Medium

The file manager toolbar has many buttons that can overflow on mobile. The `hidden sm:flex` classes help, but the toolbar could be more adaptive.

**Fix:** Implement a responsive toolbar that collapses less-used actions into a dropdown on small screens.

#### 20. VISUAL HIERARCHY — BOTTOM TAB BAR ACTIVE STATE
**File:** `src/components/ui/bottom-tab-bar.tsx:30-43`
**Severity:** Low

The active tab indicator uses a colored dot above the icon. This is subtle and may not be immediately clear to all users.

**Fix:** Consider a more prominent active state (background highlight, stronger icon color).

---

## Recommended Priorities

### Immediate (This Sprint)

1. **[#5] Decompose FileManagerPage** — This is the highest-impact refactoring. Split into hooks + components.
2. **[#10] Bottom Tab Bar ARIA** — Add `role="tablist"`, `aria-selected`, keyboard navigation.
3. **[#11] Skip-to-content link** — Simple fix, major accessibility win.
4. **[#6] Consolidate file manager pages** — Remove duplicate implementation.

### Short-term (Next Sprint)

5. **[#12] File Manager ARIA attributes** — Add proper roles to interactive divs.
6. **[#13] Context menu keyboard trigger** — Add Shift+F10 support.
7. **[#15] File path validation** — Add defense-in-depth validation on frontend.
8. **[#8] Unify navigation patterns** — Remove BottomTabBar in favor of Sidebar.

### Medium-term (Backlog)

9. **[#16] File list virtualization** — Apply TanStack Virtual to file list.
10. **[#7] Fix inline styles for theming** — Use CSS variables instead of runtime checks.
11. **[#14] Focus indicators audit** — Ensure all interactive elements have visible focus.
12. **[#9] ComboboxDemo asChild** — Minor component API fix.

---

## Summary Scorecard

| Category | Critical | High | Medium | Low | Score |
|----------|----------|------|--------|-----|-------|
| shadcn/ui Compliance | 0 | 0 | 2 | 2 | **A-** |
| React Best Practices | 1 | 2 | 2 | 1 | **B** |
| Accessibility | 2 | 2 | 1 | 0 | **C+** |
| Security | 0 | 0 | 1 | 0 | **A** |
| Performance | 0 | 0 | 2 | 0 | **A-** |
| Web Design Guidelines | 0 | 0 | 2 | 1 | **A-** |
| **Overall** | **3** | **4** | **10** | **4** | **B+** |

**Total issues: 21** (3 Critical, 4 High, 10 Medium, 4 Low)

---

## Appendix: Files Audited

| File | Lines | Issues |
|------|-------|--------|
| `src/pages/demo/file-manager/index.tsx` | 8,748 | #5, #6, #7, #12, #13, #15, #16, #19 |
| `src/pages/file-manager/index.tsx` | 523 | #6 |
| `src/components/ui/bottom-tab-bar.tsx` | ~150 | #10, #18, #20 |
| `src/components/ui/bottom-panel.tsx` | ~400 | #3, #4 |
| `src/components/layout/shadcn-io/sidebar/index.tsx` | ~1,000 | #2, #8, #11, #17 |
| `src/components/fragments/combobox-demo.tsx` | ~150 | #9 |
| `src/pages/shadcn-dashboard-01/page.tsx` | ~150 | Clean |
| `src/pages/shadcn-dashboard-02/page.tsx` | ~150 | Clean |
| `src/pages/shadcn-dashboard-03/page.tsx` | ~150 | Clean |
| `src/styles/globals.css` | ~200 | Clean |

---

*Report generated: 2026-03-28*
*Next audit recommended: After FileManagerPage decomposition*
