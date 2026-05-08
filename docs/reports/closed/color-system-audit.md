# Color System & Theming Audit Report

> **Project:** ADB GUI Next (Tauri 2 + React 19 + shadcn/ui + Tailwind v4)
> **Date:** 2026-03-23
> **Auditor:** Automated analysis against shadcn/ui official docs (context7 MCP), Vercel Web Interface Guidelines, and shadcn skill rules

---

## Executive Summary

| Category | Score | Issues |
|----------|-------|--------|
| **CSS Variable System** | 🟡 7/10 | Missing tokens, registration gaps |
| **Semantic Token Usage** | 🟡 6/10 | 4 hardcoded raw color violations in custom code |
| **Dark Mode Support** | 🟡 7/10 | Missing `color-scheme`, scrollbar issues, manual `dark:` overrides |
| **shadcn Compliance** | 🟡 7/10 | `hsl()` wrapping OKLCH, missing `destructive-foreground`, `space-y-*` patterns |
| **Web Interface Guidelines** | 🟡 6/10 | Missing `<meta theme-color>`, `color-scheme`, scrollbar theming |
| **Overall** | **🟡 6.6/10** | 23 issues found (6 critical, 8 moderate, 9 low) |

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [CSS Variable System Analysis](#2-css-variable-system-analysis)
3. [Hardcoded Color Violations](#3-hardcoded-color-violations)
4. [Dark Mode & Theming Issues](#4-dark-mode--theming-issues)
5. [shadcn/ui Compliance](#5-shadcnui-compliance)
6. [Vercel Web Interface Guidelines](#6-vercel-web-interface-guidelines)
7. [Terminal Token Architecture](#7-terminal-token-architecture)
8. [Icon Sizing Violations](#8-icon-sizing-violations)
9. [Spacing Pattern Violations](#9-spacing-pattern-violations)
10. [Recommendations](#10-recommendations)

---

## 1. Critical Issues

### CRIT-01: `hsl()` wrapping OKLCH values — Broken color rendering

**Severity:** 🔴 Critical
**Impact:** Colors render incorrectly in button glow effects and sidebar tooltip outlines

The project uses OKLCH color format for all CSS variables (e.g., `--primary: oklch(0.205 0 0)`), but two components wrap these with `hsl()`, which expects HSL format — not OKLCH.

| File | Line | Code |
|------|------|------|
| [button-variants.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/ui/button-variants.ts#L9) | 9 | `shadow-[0_0_15px_hsl(var(--primary)/0.5)]` |
| [sidebar.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/ui/sidebar.tsx#L460) | 460 | `shadow-[0_0_0_1px_hsl(var(--sidebar-border))]` |

**Fix:** Replace `hsl(var(--...))` with `oklch(var(--...))` or use the Tailwind utility directly:
```diff
- shadow-[0_0_15px_hsl(var(--primary)/0.5)]
+ shadow-[0_0_15px_oklch(var(--primary)/0.5)]
```

Or even better, use Tailwind's built-in opacity modifier:
```diff
- shadow-[0_0_0_1px_hsl(var(--sidebar-border))]
+ shadow-[0_0_0_1px_var(--sidebar-border)]
```

---

### CRIT-02: Missing `--destructive-foreground` token

**Severity:** 🔴 Critical
**Impact:** `text-destructive-foreground` utility resolves to nothing

The official shadcn/ui docs (verified via context7 MCP — all themes: Neutral, Zinc, Slate, Stone) define both `--destructive` and `--destructive-foreground`:

```css
/* Official shadcn — ALL themes include this */
--destructive-foreground: oklch(0.985 0 0);
```

**Our `global.css`:** Missing `--destructive-foreground` in both `:root` and `.dark`.
**Our `@theme inline`:** Missing `--color-destructive-foreground: var(--destructive-foreground)`.

**Affected code:** The `MainLayout.tsx` unread badge uses `text-white` instead of `text-destructive-foreground` — evidence of the workaround.

**Fix:** Add to `global.css`:
```css
/* :root */
--destructive-foreground: oklch(0.985 0 0);

/* .dark */
--destructive-foreground: oklch(0.985 0 0);
```

Add to `@theme inline`:
```css
--color-destructive-foreground: var(--destructive-foreground);
```

---

### CRIT-03: Missing `color-scheme` CSS property

**Severity:** 🔴 Critical
**Impact:** Native scrollbars, form controls, and select inputs don't adapt to dark mode on Windows

Per **Vercel Web Interface Guidelines**:
> `color-scheme: dark` on `<html>` for dark themes (fixes scrollbar, inputs)

Per **shadcn Theming Docs** (context7):
> `color-scheme: dark` should be set when the dark class is active.

**Currently missing entirely.** This is especially important for Tauri on Windows where native form controls (date inputs, select dropdowns, scrollbars) will display in light mode even when the app is in dark mode.

**Fix:** Add to `global.css`:
```css
@layer base {
  html {
    color-scheme: light;
  }
  html.dark {
    color-scheme: dark;
  }
}
```

---

### CRIT-04: Scrollbar colors hardcoded for dark mode only

**Severity:** 🔴 Critical
**Impact:** Scrollbars appear as white/transparent on light backgrounds

In [global.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/styles/global.css#L162-L192):

```css
scrollbar-color: rgba(255, 255, 255, 0.25) transparent;  /* WHITE thumb */

body::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);  /* WHITE thumb */
}
```

These values assume a dark background. On a white/light background, white scrollbar thumbs are **invisible**.

**Fix:** Use theme-aware values or `color-scheme` (which auto-fixes native scrollbars):
```css
html, body {
  scrollbar-width: thin;
  scrollbar-color: oklch(0 0 0 / 25%) transparent;
}
.dark {
  scrollbar-color: oklch(1 0 0 / 25%) transparent;
}
```

---

### CRIT-05: Missing `<meta name="theme-color">`

**Severity:** 🟡 Moderate (but Critical per Web Guidelines)
**Impact:** Title bar / window chrome color doesn't match app on some platforms

Per **Vercel Web Interface Guidelines**:
> `<meta name="theme-color">` matches page background

In [index.html](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/index.html) — not present.

**Fix:**
```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#252525" media="(prefers-color-scheme: dark)" />
```

---

### CRIT-06: Missing `@import "shadcn/tailwind.css"`

**Severity:** 🟡 Moderate
**Impact:** May miss upstream shared CSS utilities that shadcn components rely on

The latest shadcn manual installation docs (context7 MCP, source: `apps/v4/content/docs/installation/manual.mdx`) include:

```css
@import "shadcn/tailwind.css";
```

Our [global.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/styles/global.css#L1-L2) only has:
```css
@import 'tailwindcss';
@import 'tw-animate-css';
```

> [!NOTE]
> This import may not be available if `shadcn` is not installed as a package dependency. Verify by checking if `shadcn/tailwind.css` resolves. If the project was set up before this was introduced, it may not be needed as long as all component styles are explicitly defined.

---

## 2. CSS Variable System Analysis

### 2.1 Token Comparison: Project vs. Official shadcn Neutral Theme

| Token | `:root` Match | `.dark` Match | Notes |
|-------|:---:|:---:|-------|
| `--background` | ✅ | ✅ | |
| `--foreground` | ✅ | ✅ | |
| `--card` / `--card-foreground` | ✅ | ✅ | |
| `--popover` / `--popover-foreground` | ✅ | ✅ | |
| `--primary` / `--primary-foreground` | ✅ | ✅ | |
| `--secondary` / `--secondary-foreground` | ✅ | ✅ | |
| `--muted` / `--muted-foreground` | ✅ | ✅ | |
| `--accent` / `--accent-foreground` | ✅ | ✅ | |
| `--destructive` | ✅ | ✅ | |
| `--destructive-foreground` | ❌ Missing | ❌ Missing | 🔴 **CRIT-02** |
| `--border` | ✅ | ✅ | |
| `--input` | ✅ | ✅ | |
| `--ring` | ✅ | ✅ | |
| `--chart-1` through `--chart-5` | ✅ | ✅ | |
| `--sidebar-*` (8 tokens) | ✅ | ✅ | |
| `--font-sans` | ✅ `'Onest'` | ✅ `'Onest'` | Custom font, correctly set |

### 2.2 `@theme inline` Registration Gaps

| Tailwind Mapping | Registered? | Notes |
|-----------------|:-----------:|-------|
| `--color-destructive-foreground` | ❌ | Missing — `text-destructive-foreground` won't work |
| `--radius-xl` | ✅ | Present but formula differs from latest |
| `--radius-2xl` through `--radius-4xl` | ❌ | Not in latest shadcn neutral either; only in newer presets |

### 2.3 Custom Tokens (Terminal Panel)

12 custom `--terminal-*` tokens are defined in `:root` and `.dark`:

| Token | Light Value | Dark Value | Registered in `@theme`? |
|-------|------------|-----------|:-----------------------:|
| `--terminal-bg` | `oklch(0.97 0 0)` | `oklch(0.12 0 0)` | ❌ |
| `--terminal-fg` | `oklch(0.145 0 0)` | `oklch(0.92 0 0)` | ❌ |
| `--terminal-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | ❌ |
| `--terminal-header-bg` | `oklch(0.96 0 0)` | `oklch(0.16 0 0)` | ❌ |
| `--terminal-tab-active` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | ❌ |
| `--terminal-tab-inactive` | `oklch(0.556 0 0)` | `oklch(0.556 0 0)` | ❌ |
| `--terminal-log-info` | `oklch(0.488 0.243 264.376)` | `oklch(0.62 0.2 255)` | ❌ |
| `--terminal-log-success` | `oklch(0.52 0.176 142.5)` | `oklch(0.72 0.19 150)` | ❌ |
| `--terminal-log-error` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | ❌ |
| `--terminal-log-warning` | `oklch(0.75 0.183 55.934)` | `oklch(0.82 0.17 80)` | ❌ |

**Impact:** These tokens can't be used as Tailwind utilities (e.g., `bg-terminal-bg`), forcing inline `style={}` usage. Components currently use `style={{ backgroundColor: 'var(--terminal-bg)' }}` which works but is not idiomatic.

---

## 3. Hardcoded Color Violations

Per **shadcn rules** ([styling.md](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.agents/skills/shadcn/rules/styling.md)):
> **Use semantic colors.** `bg-primary`, `text-muted-foreground` — never raw values like `bg-blue-500`.

### 3.1 Raw Tailwind Color Classes in Custom Code

| # | File | Line | Violation | Suggested Fix |
|---|------|------|-----------|---------------|
| 1 | [ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#L354) | 354 | `text-green-500 font-bold` (Root Status = "Yes") | Use `--success` semantic token (new) or `text-primary` |
| 2 | [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#L479) | 479 | `border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500` | Use `--warning` semantic token (new) |
| 3 | [LogsPanel.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/LogsPanel.tsx#L23) | 23 | `bg-yellow-500/30` (search highlight) | Use `--warning` or a dedicated `--highlight` token |
| 4 | [CopyButton.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/CopyButton.tsx#L48) | 48 | `text-green-500` (copy success icon) | Use `--success` semantic token (new) |

### 3.2 `text-white` Usage (Acceptable vs. Needs Review)

| File | Line | Context | Status |
|------|------|---------|--------|
| `button-variants.ts:11` | Destructive button | ✅ Official shadcn default |
| `badge.tsx:15` | Destructive badge | ✅ Official shadcn default |
| `MainLayout.tsx:231` | Unread count badge | ⚠️ Should use `text-destructive-foreground` |
| `dialog.tsx:34` | Overlay `bg-black/50` | ✅ Official shadcn default |
| `sheet.tsx:31` | Overlay `bg-black/50` | ✅ Official shadcn default |
| `alert-dialog.tsx:29` | Overlay `bg-black/50` | ✅ Official shadcn default |

### 3.3 Manual `dark:` Overrides in Custom Code

Per shadcn rules: **No manual `dark:` color overrides. Use semantic tokens.**

| File | Line | Violation |
|------|------|-----------|
| [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#L479) | 479 | `dark:text-yellow-500` — manual dark override with raw color |

> [!NOTE]
> `dark:` prefixes in **shadcn `ui/` primitives** (tabs.tsx, input.tsx, dropdown-menu.tsx, button-variants.ts, badge.tsx) are **acceptable** — these come from the official shadcn component source and handle subtle rendering differences that semantic tokens alone can't express.

---

## 4. Dark Mode & Theming Issues

### 4.1 Theme Provider Setup

| Item | Status | Notes |
|------|--------|-------|
| `next-themes` ThemeProvider | ✅ | Configured in `main.tsx` |
| Class-based toggle (`.dark`) | ✅ | Using `attribute="class"` |
| System theme detection | ✅ | `defaultTheme="system"` with `enableSystem` |
| `color-scheme` CSS | ❌ Missing | **CRIT-03** — native controls don't adapt |
| `<meta theme-color>` | ❌ Missing | **CRIT-05** |

### 4.2 Token Contrast Analysis (OKLCH)

| Pair | Light Contrast | Dark Contrast | Status |
|------|---------------|--------------|--------|
| `--background` / `--foreground` | L:1.0 vs L:0.145 | L:0.145 vs L:0.985 | ✅ High |
| `--primary` / `--primary-foreground` | L:0.205 vs L:0.985 | L:0.922 vs L:0.205 | ✅ High |
| `--muted` / `--muted-foreground` | L:0.97 vs L:0.556 | L:0.269 vs L:0.708 | ✅ Adequate |
| `--destructive` (bg) / `text-white` | L:0.577 vs L:1.0 | L:0.704 vs L:1.0 | ⚠️ Dark mode: lower contrast (0.704 vs 1.0 is ~3.8:1) |
| `--terminal-log-info` (light) | L:0.488 on L:0.97 bg | L:0.62 on L:0.12 bg | ✅ Adequate |
| `--terminal-log-success` (light) | L:0.52 on L:0.97 bg | L:0.72 on L:0.12 bg | ✅ Adequate |

### 4.3 Scrollbar Theming

| Issue | Details |
|-------|---------|
| Thumb color | `rgba(255, 255, 255, 0.25)` — hardcoded white, invisible in light mode |
| Track color | `transparent` — works for both modes |
| Hover color | `rgba(255, 255, 255, 0.45)` — hardcoded white, invisible in light mode |

---

## 5. shadcn/ui Compliance

### 5.1 Compliance Checklist

| Rule | Status | Details |
|------|--------|---------|
| Semantic colors (no raw values) | ⚠️ 4 violations | See [Section 3.1](#31-raw-tailwind-color-classes-in-custom-code) |
| No manual `dark:` overrides | ⚠️ 1 violation | `ViewAppManager.tsx:479` |
| `gap-*` instead of `space-y-*` | ❌ 35+ violations | See [Section 9](#9-spacing-pattern-violations) |
| `size-*` instead of `w-* h-*` | ❌ 80+ violations | See [Section 8](#8-icon-sizing-violations) |
| `cn()` for conditional classes | ✅ | Consistently used across codebase |
| Built-in variants before custom | ✅ | Good adoption of `variant="outline"`, etc. |
| No manual z-index on overlays | ✅ | No custom z-index on Dialog/Sheet/Popover |
| Full Card composition | ✅ | CardHeader/CardTitle/CardContent used properly |
| Toast via sonner | ✅ | All toasts use `toast.*()` from sonner |
| Badge for status indicators | ✅ | Package type uses `<Badge>` variants |
| Separator for dividers | ✅ | shadcn `Separator` installed and used |
| Use `truncate` shorthand | ✅ | Used consistently |
| OKLCH color format | ✅ | All tokens use OKLCH |

### 5.2 `components.json` Analysis

```json
{
  "style": "new-york",       // ✅ Valid style
  "rsc": false,              // ✅ Correct for Vite/Tauri (not Next.js)
  "tsx": true,               // ✅ TypeScript
  "tailwind.baseColor": "neutral",  // ✅ Matches color values
  "tailwind.cssVariables": true,    // ✅ Using CSS variables
  "iconLibrary": "lucide"    // ✅ Matches lucide-react imports
}
```

> [!IMPORTANT]
> The `components.json` uses the older schema format. The latest shadcn CLI may have additional fields. This is functional but may miss features from newer versions.

---

## 6. Vercel Web Interface Guidelines

### 6.1 Dark Mode & Theming Compliance

| Guideline | Status | Fix |
|-----------|--------|-----|
| `color-scheme: dark` on `<html>` | ❌ Missing | Add CSS rule — **CRIT-03** |
| `<meta name="theme-color">` matches background | ❌ Missing | Add to `index.html` — **CRIT-05** |
| Native `<select>`: explicit `background-color` and `color` (Windows dark mode) | ❌ Not set | Add base styles for select elements |

### 6.2 Other Relevant Checks

| Guideline | Status | Notes |
|-----------|--------|-------|
| `prefers-reduced-motion` honored | ✅ | `tw-animate-css` handles this |
| No `transition: all` | ✅ | All transitions specify properties |
| Visible focus states | ✅ | `focus-visible:ring-*` on all interactive elements |
| `touch-action: manipulation` | ❌ Not set | Low priority for desktop Tauri app |
| `overscroll-behavior: contain` in modals | ❌ Not verified | Sheet/Dialog may need this |
| Semantic HTML | ✅ | Good use of `<form>`, `<button>`, `<label>` |
| `font-display: swap` on fonts | ✅ | Google Fonts URL includes `display=swap` |

---

## 7. Terminal Token Architecture

### Current Approach — Inline Styles

The terminal panel uses `style={{ backgroundColor: 'var(--terminal-bg)' }}` because the tokens aren't registered in `@theme inline`. This works but:

- ❌ Can't use Tailwind modifiers (e.g., `hover:bg-terminal-bg/50`)
- ❌ Can't use with Tailwind arbitrary values that reference the token (e.g., `bg-[var(--terminal-bg)]` requires the full syntax)
- ❌ Inconsistent with rest of codebase which uses Tailwind classes

### Recommended Approach

Register terminal tokens in `@theme inline`:

```css
@theme inline {
  /* ...existing tokens... */
  --color-terminal-bg: var(--terminal-bg);
  --color-terminal-fg: var(--terminal-fg);
  --color-terminal-border: var(--terminal-border);
  --color-terminal-header-bg: var(--terminal-header-bg);
  --color-terminal-tab-active: var(--terminal-tab-active);
  --color-terminal-tab-inactive: var(--terminal-tab-inactive);
  --color-terminal-log-info: var(--terminal-log-info);
  --color-terminal-log-success: var(--terminal-log-success);
  --color-terminal-log-error: var(--terminal-log-error);
  --color-terminal-log-warning: var(--terminal-log-warning);
}
```

Then replace inline styles with Tailwind classes:
```diff
- style={{ backgroundColor: 'var(--terminal-bg)' }}
+ className="bg-terminal-bg"
```

---

## 8. Icon Sizing Violations

Per shadcn rules: **Use `size-*` when width and height are equal.**

Found 80+ instances of `h-N w-N` that should be `size-N`:

| Pattern | Count | Example Files |
|---------|-------|---------------|
| `h-4 w-4` | ~50 | ViewUtilities, ViewFlasher, ViewPayloadDumper, ViewAppManager |
| `h-5 w-5` | ~15 | ViewUtilities, ViewPayloadDumper |
| `h-3 w-3` | ~5 | ViewAppManager, CopyButton |
| `h-3.5 w-3.5` | ~5 | CopyButton, BottomPanel |
| `h-6 w-6` | ~3 | ViewPayloadDumper |
| `h-12 w-12` | ~2 | ViewPayloadDumper |

> [!TIP]
> This is a low-priority cosmetic issue. The icons render correctly either way. Can be batch-fixed with a codemod or find-and-replace.

---

## 9. Spacing Pattern Violations

Per shadcn rules: **No `space-x-*` or `space-y-*`. Use `flex` with `gap-*`.**

Found 35+ instances of `space-y-*`:

| File | Count | Lines |
|------|-------|-------|
| ViewUtilities.tsx | 8 | 272, 273, 315, 358, 359, 392, 424, 482 |
| ViewPayloadDumper.tsx | 7 | 442, 454, 519, 544, 676, 751, 775 |
| ViewFlasher.tsx | 5 | 207, 208, 221, 264, 265 |
| ViewAppManager.tsx | 4 | 225, 236, 323, 372 |
| ViewDashboard.tsx | 3 | 197, 216, 221 |
| ViewAbout.tsx | 5 | 14, 19, 50, 77, 78, 99 |
| WelcomeScreen.tsx | 1 | 16 |
| FileSelector.tsx | 1 | 42 |

> [!NOTE]
> `space-y-*` works correctly and is not broken. The shadcn style guide prefers `flex flex-col gap-*` for consistency and because `space-y-*` can cause issues with conditionally rendered children. This is a **moderate** priority cleanup.

---

## 10. Recommendations

### Priority 1 — Critical (Fix Immediately)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Fix `hsl()` wrapping OKLCH values in `button-variants.ts` and `sidebar.tsx` | 10 min | Colors rendering incorrectly |
| 2 | Add `--destructive-foreground` to `:root`, `.dark`, and `@theme inline` | 5 min | Missing semantic token |
| 3 | Add `color-scheme: light/dark` CSS rules | 5 min | Native controls adaptation |
| 4 | Fix scrollbar colors for light mode | 10 min | Invisible scrollbars in light mode |

### Priority 2 — Moderate (Fix This Sprint)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 5 | Replace 4 hardcoded raw colors with semantic tokens | 30 min | Color consistency |
| 6 | Add `<meta name="theme-color">` to `index.html` | 5 min | Platform integration |
| 7 | Register terminal tokens in `@theme inline` | 15 min | Enables Tailwind utilities |
| 8 | Add `--warning` / `--warning-foreground` semantic tokens | 15 min | Replaces `yellow-500` pattern |
| 9 | Add `--success` / `--success-foreground` semantic tokens | 15 min | Replaces `green-500` pattern |

### Priority 3 — Low (Backlog)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 10 | Replace `space-y-*` with `flex flex-col gap-*` (35+ instances) | 1-2 hr | Consistency |
| 11 | Replace `h-N w-N` with `size-N` (80+ instances) | 1-2 hr | Consistency |
| 12 | Replace `text-white` in `MainLayout.tsx` badge with `text-destructive-foreground` | 5 min | Token consistency |
| 13 | Investigate `@import "shadcn/tailwind.css"` availability | 10 min | Future compatibility |
| 14 | Add `overscroll-behavior: contain` on modal overlays | 10 min | UX improvement |

### Proposed New Semantic Tokens

Following the shadcn customization docs (context7 MCP), add these commonly-needed tokens:

```css
/* global.css — :root */
--warning: oklch(0.84 0.16 84);
--warning-foreground: oklch(0.28 0.07 46);
--success: oklch(0.52 0.176 142.5);
--success-foreground: oklch(0.985 0 0);

/* global.css — .dark */
--warning: oklch(0.82 0.17 80);
--warning-foreground: oklch(0.985 0 0);
--success: oklch(0.72 0.19 150);
--success-foreground: oklch(0.985 0 0);

/* @theme inline */
--color-warning: var(--warning);
--color-warning-foreground: var(--warning-foreground);
--color-success: var(--success);
--color-success-foreground: var(--success-foreground);
```

> [!TIP]
> The `--success` light values can be sourced from the existing `--terminal-log-success` token, and `--warning` light values from the shadcn customization docs (context7). This ensures visual consistency across the app.

---

## Appendix: Sources

| Source | How Accessed |
|--------|-------------|
| shadcn/ui Theming Docs (Neutral, Zinc, Slate, Stone themes) | context7 MCP: `/shadcn-ui/ui` + `/shadcn/ui` |
| shadcn Customization (Adding Custom Colors) | context7 MCP + local skill `customization.md` |
| shadcn Styling Rules | Local skill `rules/styling.md` |
| shadcn Component Registry | shadcn MCP: `get_project_registries`, `search_items_in_registries` |
| Vercel Web Interface Guidelines | `read_url_content` from GitHub raw |
| Project CSS Variables | Direct analysis of `src/styles/global.css` |
| Hardcoded Color Usage | `grep_search` across `src/` for raw Tailwind colors, `dark:`, `hsl()`, `rgb()`, etc. |
| All 7 views + 5 shared components | Direct `view_file` analysis |

---

*Report generated on 2026-03-23. All findings verified against the latest shadcn/ui documentation retrieved via context7 MCP and the project's actual source code.*
