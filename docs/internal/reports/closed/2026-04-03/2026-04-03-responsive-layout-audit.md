# Responsive Layout Audit — ADB GUI Next

**Date:** 2026-04-03  
**Triggered by:** Screenshot showing Payload Dumper with loaded partitions exhibiting content overflow, content hidden behind sidebar, and sidebar scrollbar visible in collapsed/expanded state.

---

## Visual Evidence (Screenshot Analysis)

From the attached screenshot the following are directly observable:

| # | Symptom | Area |
|---|---------|------|
| A | Sidebar text "Payload Dumper" clips into "yload Dumper" — left edge of content is hidden BEHIND the sidebar | `SidebarInset` / `MainLayout` |
| B | Page title "Extraction Setup" clips as "ction Setup" — same cause as A | `SidebarInset` |
| C | Remote OTA URL is truncated mid-string but a horizontal scrollbar is STILL visible inside the FileBanner | `FileBanner.tsx` |
| D | A scrollbar thumb is VISIBLE inside the sidebar (bottom portion) when it should be hidden | `SidebarContent` / `global.css` |
| E | The general main content region appears to be overflowing horizontally — window had been resized | `MainLayout` content wrapper |

---

## Root Cause Analysis

### Issue 1 — Content Clipped Behind Sidebar (Critical)

**Symptom:** Page headings clipped on the left — "Payload Dumper" → "yload Dumper".

**Root Cause:**  
`SidebarProvider` wraps the layout in a flex row. The sidebar gap div takes
`width: var(--sidebar-width)` = `16rem` = 256px. The `SidebarInset` (`<main>`) is `flex-1 w-full`
and should receive the remaining space.

The issue surfaces when the Tauri window is narrow. The sidebar gap (256px) + inner content
minimum width (`min-w-(--content-min-width)` = 400px) = **656px total required** — far more than
many desktop Tauri window sizes. When the viewport is narrower:
- The sidebar still claims its 256px
- `SidebarInset` has no `overflow-hidden` or `min-w-0`, so it does NOT shrink below its content size
- Content bleeds under the sidebar OR the viewport scrolls horizontally

**Affected code:**
```tsx
// sidebar.tsx:280-287 — SidebarInset has no min-w-0 or overflow-hidden
function SidebarInset({ className, ...props }) {
  return (
    <main
      className={cn(
        'relative flex w-full flex-1 flex-col bg-background',
        //       ^ no min-w-0, no overflow-hidden
        ...
      )}
```

```tsx
// MainLayout.tsx:292 — rigid 400px minimum width
<div className="min-h-full min-w-(--content-min-width) p-4 sm:p-6">
```

```css
/* global.css:65 */
--content-min-width: 400px; /* hardcoded, no breakpoint variation */
```

---

### Issue 2 — Sidebar Scrollbar Visible (High)

**Symptom:** A scrollbar thumb is visible inside the sidebar navigation area.

**Root Cause (two layers):**

**Layer A — `scrollbar-gutter: stable` applied globally:**
```css
/* global.css:199-204 */
html, body {
  scrollbar-width: thin;
  scrollbar-color: oklch(0 0 0 / 20%) transparent;
  scrollbar-gutter: stable;  /* reserves gutter even with no overflow */
}
```
`scrollbar-gutter: stable` reserves persistent gutter space even when the element has no overflow.
Applied on `html` and `body`, it cascades into nested `overflow-auto` containers — including
`SidebarContent` — causing a visible scrollbar gutter.

**Layer B — `SidebarContent` uses `overflow-auto` in expanded state:**
```tsx
// sidebar.tsx:339-341
'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden'
//                                                ^ shows scrollbar in expanded mode
```
`overflow-auto` shows a scrollbar when the sidebar content height approaches the sidebar container
height, which happens frequently on shorter windows.

---

### Issue 3 — Remote OTA URL Overflows Horizontally in FileBanner (High)

**Symptom:** Long remote URL causes FileBanner to overflow horizontally despite `truncate` class.

**Root Cause (multi-layer chain failure):**

**Layer 1 — `SidebarInset` missing `overflow-hidden` and `min-w-0`** (same as Issue 1):
Without these, `<main>` expands beyond its flex allocation to accommodate the URL string, pulling
the window wider instead of truncating.

**Layer 2 — `overflow-hidden` on a flex column does not constrain child widths:**
```tsx
// ViewPayloadDumper.tsx:88
<Card className="w-full overflow-hidden min-w-0">
  <CardContent className="flex flex-col gap-4 w-full overflow-hidden min-w-0">
```
`overflow-hidden` on a flex column prevents the container from overflowing its parent but does NOT
prevent its flex children from reporting a larger intrinsic width upward in the layout tree — it
only clips visual rendering.

**Layer 3 — FileBanner URL `<p>` needs the full containment chain:**
```tsx
// FileBanner.tsx:54
<p className="text-sm font-medium truncate" title={displayName}>
  {displayName}  {/* full URL string */}
</p>
```
`truncate` works only when every ancestor from the `<p>` up to a constrained container has either
a fixed width or `min-w-0`. If any ancestor is missing `min-w-0`, the text's intrinsic width
"leaks" upward.

---

### Issue 4 — BottomPanel `left` Edge Uses Hardcoded CSS Variable Fallbacks (Medium)

**Root Cause:**
```tsx
// BottomPanel.tsx:44-47
const panelLeft =
  sidebarState === 'expanded' ? 'var(--sidebar-width, 16rem)' : 'var(--sidebar-width-icon, 3rem)';
```
The panel is `position: fixed`. The CSS variables `--sidebar-width` and `--sidebar-width-icon` are
set as inline styles on the `SidebarProvider` wrapper div. The fallback values `16rem` / `3rem`
are hardcoded and don't account for future sidebar width customisation.

---

### Issue 5 — `PartitionTable` Uses Fixed `max-h-100` (Medium)

**Root Cause:**
```tsx
// PartitionTable.tsx:82
<div className="divide-y divide-border/50 max-h-100 overflow-y-auto">
//                                          ^ max-height: 400px — magic number
```
`max-h-100` = 400px (25rem). On a 600px-tall window, this table alone occupies 2/3 of the screen.
No `overflow-x: hidden` is set either, so wide partition names could cause horizontal sub-scroll.

---

### Issue 6 — `PayloadSourceTabs` Remote Tab Containment Gap (Low)

**Root Cause:**
```tsx
// PayloadSourceTabs.tsx:77
<TabsContent value="remote" className="mt-4 min-w-0">
//                                     ^ min-w-0 is correct but overflow-hidden is missing
```
`min-w-0` allows the element to shrink but does not prevent overflow of rendered content. Without
`overflow-hidden`, `TabsContent` (a Radix div) can expand horizontally if a child exceeds its
available space.

---

### Issue 7 — `SidebarProvider` Wrapper Can Expand With Overflow (Medium)

**Root Cause:**
```tsx
// sidebar.tsx:114-118
className={cn(
  'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
  //                                  ^ w-full without overflow-hidden
```
`w-full` without `overflow-hidden` means the flex container will expand to accommodate any
overflowing child, allowing the entire layout to escape the viewport.

---

## Summary Table

| ID | Severity | Issue | Root Cause | Affected File(s) |
|----|----------|-------|------------|-----------------|
| 1 | Critical | Content hidden behind sidebar on narrow window | `SidebarInset` no `overflow-hidden`/`min-w-0`; `min-w-(--content-min-width)` too rigid | `sidebar.tsx`, `MainLayout.tsx`, `global.css` |
| 2 | High | Sidebar scrollbar visible unnecessarily | `scrollbar-gutter: stable` on `html`/`body` + `SidebarContent` uses `overflow-auto` | `global.css`, `sidebar.tsx` |
| 3 | High | Remote OTA URL overflows horizontally in FileBanner | Multi-layer: `SidebarInset` not isolated; containment chain broken | `sidebar.tsx`, `FileBanner.tsx`, `MainLayout.tsx` |
| 4 | Medium | BottomPanel `left` edge hardcoded CSS var fallbacks | Panel is `position: fixed`, reads sidebar width via CSS variable with inflexible fallbacks | `BottomPanel.tsx` |
| 5 | Medium | `PartitionTable` uses fixed `max-h-100` regardless of viewport | Magic pixel value; no `overflow-x: hidden` | `PartitionTable.tsx` |
| 6 | Low | `PayloadSourceTabs` remote tab Input overflow on narrow window | `TabsContent` needs `overflow-hidden` alongside `min-w-0` | `PayloadSourceTabs.tsx` |
| 7 | Medium | `SidebarProvider` wrapper can grow with overflow | `w-full` without `overflow-hidden` | `sidebar.tsx` |

---

## Proposed Fixes

### Fix 1 — `SidebarInset`: Add `overflow-hidden min-w-0` (Resolves Issues 1, 3, 7)

```diff
 function SidebarInset({ className, ...props }) {
   return (
     <main
       className={cn(
-        'relative flex w-full flex-1 flex-col bg-background',
+        'relative flex min-w-0 w-full flex-1 flex-col overflow-hidden bg-background',
         '...',
```

**Also update `SidebarProvider` wrapper:**
```diff
 className={cn(
-  'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
+  'group/sidebar-wrapper flex min-h-svh w-full overflow-hidden has-data-[variant=inset]:bg-sidebar',
```

---

### Fix 2 — `global.css`: Remove `scrollbar-gutter: stable` from global scope (Resolves Issue 2)

```diff
 html,
 body {
   scrollbar-width: thin;
   scrollbar-color: oklch(0 0 0 / 20%) transparent;
-  scrollbar-gutter: stable;
 }
```

Apply `scrollbar-gutter: stable` only to the main scroll area:
```diff
+/* MainLayout: add class 'main-scroll-area' to the flex-1 overflow-auto div */
+.main-scroll-area {
+  scrollbar-gutter: stable;
+}
```

Update `SidebarContent` to use `overflow-y-auto` + `overflow-x-hidden`:
```diff
-'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden'
+'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden group-data-[collapsible=icon]:overflow-hidden'
```

---

### Fix 3 — `MainLayout.tsx`: Remove rigid `min-w-(--content-min-width)` (Resolves Issues 1, 3)

```diff
-<div className="min-h-full min-w-(--content-min-width) p-4 sm:p-6">
+<div className="min-h-full w-full p-4 sm:p-6">
```

```diff
 /* global.css */
-  --content-min-width: 400px;
+  --content-min-width: 0px; /* containment handled by SidebarInset overflow-hidden */
```

---

### Fix 4 — `PartitionTable.tsx`: Viewport-relative max height (Resolves Issue 5)

```diff
-<div className="divide-y divide-border/50 max-h-100 overflow-y-auto">
+<div className="divide-y divide-border/50 max-h-[40vh] min-h-[120px] overflow-y-auto overflow-x-hidden">
```

---

### Fix 5 — `PayloadSourceTabs.tsx`: Add `overflow-hidden` to remote tab (Resolves Issue 6)

```diff
-<TabsContent value="remote" className="mt-4 min-w-0">
+<TabsContent value="remote" className="mt-4 min-w-0 overflow-hidden">
```

---

### Fix 6 — `FileBanner.tsx`: Harden URL `<p>` containment (Defense-in-depth for Issue 3)

```diff
-<p className="text-sm font-medium truncate" title={displayName}>
+<p className="text-sm font-medium truncate min-w-0 max-w-full" title={displayName}>
```

---

## Implementation Priority

| Phase | Fix IDs | Expected Outcome | Risk |
|-------|---------|-----------------|------|
| Phase 1 — Critical | Fix 1, Fix 3 | Eliminates content-behind-sidebar; eliminates horizontal overflow at root | Low |
| Phase 2 — High | Fix 2 | Eliminates sidebar scrollbar gutter | Low |
| Phase 3 — Medium | Fix 4, Fix 5 | Viewport-aware partition list; input containment hardened | Low |
| Phase 4 — Polish | Fix 6 | Defense-in-depth URL truncation | Trivial |

---

## Design System Principles Violated

### 1. Missing `min-w-0` propagation chain
In CSS Flexbox, `flex: 1` (or `flex-1`) children do NOT shrink below their intrinsic content size
by default. Every flex child in a horizontal flex row that may contain long text MUST have `min-w-0`.
This must propagate from `SidebarProvider` -> `SidebarInset` -> content wrapper -> card ->
FileBanner -> `<p>`. **Any missing link breaks the chain.**

### 2. `scrollbar-gutter: stable` scope creeping
`scrollbar-gutter: stable` reserves a permanent scrollbar lane even when content does not overflow.
Applying it globally on `html` and `body` causes it to affect every `overflow-auto` container in
the tree — including the sidebar — producing phantom scrollbar gutters.

### 3. Fixed pixel minimums in a variable-width desktop app
Setting `min-width: 400px` inside a container whose available space may be 300px (after the
sidebar claims its share) guarantees overflow. Desktop GUI apps must use `min-width: 0` on inner
content and rely on the OS window's minimum size as the hard floor.

---

*Report generated 2026-04-03 | ADB GUI Next v0.1.0*
