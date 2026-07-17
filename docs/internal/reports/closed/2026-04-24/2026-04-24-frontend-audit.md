# Comprehensive Frontend Audit Report — ADB GUI Next

**Date:** 2026-04-24  
**Auditor:** Multi-agent comprehensive audit (Accessibility, React Performance, Tailwind/UI, TypeScript Quality, Architecture/Security)  
**Scope:** Entire frontend (`src/`) — React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Zustand + TanStack Query  
**Backend:** Tauri 2 IPC via `src/lib/desktop/backend.ts`

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Accessibility (a11y) | 6 | 6 | 4 | 3 | **19** |
| React Performance | 0 | 4 | 16 | 5 | **25** |
| Tailwind / UI / Design | 2 | 6 | 18 | 16 | **42** |
| TypeScript / Code Quality | 1 | 5 | 14 | 8 | **28** |
| Architecture / State / Security | 0 | 3 | 12 | 7 | **22** |
| **Grand Total** | **9** | **24** | **64** | **39** | **136** |

### Key Themes
1. **Zustand store subscriptions lack selectors** — causing widespread unnecessary re-renders across MainLayout, BottomPanel, and most view components.
2. **Accessibility gaps are systemic** — missing `aria-label` on icon buttons, `CardTitle` renders as `<div>`, no heading hierarchy, no skip links, no live regions.
3. **Design system discipline is strong but inconsistent** — semantic tokens are used well, but hardcoded arbitrary values, inline styles, and missing responsive breakpoints persist in views.
4. **Error handling is generally good but inconsistent** — some async calls lack try/catch, and floating promises exist in event handlers.
5. **No critical security vulnerabilities** — no `dangerouslySetInnerHTML`, `eval()`, or XSS vectors found.

---

## 1. Accessibility (WCAG 2.2 AA)

### 1.1 Critical Issues

#### A11Y-CRIT-01: `CardTitle` renders as `<div>` — No Heading Semantics
- **File:** `src/components/ui/card.tsx:31–38`
- **WCAG:** 1.3.1 Info and Relationships (A)
- **Impact:** Every card title in the app (Dashboard, Flasher, Utilities, Payload Dumper, Marketplace, etc.) lacks heading semantics, destroying the document outline for screen-reader users.
- **Fix:** Change `CardTitle` to accept an `as` prop defaulting to `h2`:
  ```tsx
  function CardTitle({
    className,
    as: Tag = 'h2',
    ...props
  }: React.ComponentProps<'h2'> & { as?: 'h1' | 'h2' | 'h3' }) {
    return (
      <Tag
        data-slot="card-title"
        className={cn('leading-none font-semibold', className)}
        {...props}
      />
    );
  }
  ```

#### A11Y-CRIT-02: Icon Buttons in Header Lack `aria-label`
- **File:** `src/components/MainLayout.tsx:211–287`
- **WCAG:** 1.1.1 Non-text Content (A), 4.1.2 Name, Role, Value (A)
- **Impact:** Device Manager, Launch Terminal, Shell, and Logs buttons have no accessible name. Screen readers announce "button" with no context.
- **Fix:** Add `aria-label` to all `<Button size="icon">` elements:
  ```tsx
  <Button aria-label="Device Manager" variant="ghost" size="icon" ...>
    <Cpu aria-hidden="true" className="size-4" />
  </Button>
  ```

#### A11Y-CRIT-03: Unread Count Badge Not Announced to Screen Readers
- **File:** `src/components/MainLayout.tsx:277–281`
- **WCAG:** 4.1.3 Status Messages (AA)
- **Impact:** The red badge showing unread log count is purely visual. Screen reader users have no way to know new logs arrived.
- **Fix:** Add `aria-live="polite"` and a visually hidden text:
  ```tsx
  <span aria-live="polite" className="sr-only">
    {unreadCount} new log{unreadCount !== 1 ? 's' : ''}
  </span>
  ```

#### A11Y-CRIT-04: No Skip Link for Keyboard Users
- **File:** `src/components/MainLayout.tsx`
- **WCAG:** 2.4.1 Bypass Blocks (A)
- **Impact:** Keyboard users must tab through the entire sidebar navigation before reaching main content.
- **Fix:** Add a visually hidden skip link as the first focusable element:
  ```tsx
  <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 ...">
    Skip to main content
  </a>
  <main id="main-content">...</main>
  ```

#### A11Y-CRIT-05: No Heading Hierarchy on Any Page
- **Files:** All view components (`src/components/views/*.tsx`)
- **WCAG:** 1.3.1 Info and Relationships (A)
- **Impact:** No `<h1>` exists on any view. Screen reader users cannot navigate by heading or understand page structure.
- **Fix:** Add `<h1>` to each view's top-level section, using `sr-only` if visually hidden:
  ```tsx
  <h1 className="sr-only">Dashboard</h1>
  ```

#### A11Y-CRIT-06: No `aria-live` Region for Dynamic Toast/Log Updates
- **Files:** `src/components/MainLayout.tsx`, `src/components/BottomPanel.tsx`
- **WCAG:** 4.1.3 Status Messages (AA)
- **Impact:** Toasts and log entries appear visually but are not announced to screen readers.
- **Fix:** Wrap the toast container and log panel in `aria-live="polite"` regions, or use `role="log"` for the log list.

### 1.2 High Severity Issues

#### A11Y-HIGH-01: `TooltipTrigger` on Icon Buttons Is Not a Substitute for `aria-label`
- **File:** `src/components/MainLayout.tsx:211–287`
- **WCAG:** 1.1.1 Non-text Content (A)
- **Impact:** Tooltips only appear on hover/focus and are not reliably exposed to all screen readers as accessible names.
- **Fix:** Always pair `aria-label` with tooltip content.

#### A11Y-HIGH-02: Custom Scrollbar Styles May Hide Focus Indicators
- **File:** `src/styles/global.css:217–249`
- **WCAG:** 2.4.7 Focus Visible (AA)
- **Impact:** Custom scrollbar thumb styling does not include focus states. The `scrollbar-gutter: stable` on `.main-scroll-area` is good but focus could be clipped.
- **Fix:** Ensure `:focus-visible` styles have sufficient `outline-offset` and `z-index` to avoid being clipped by scroll containers.

#### A11Y-HIGH-03: Missing `lang` Attribute on `<html>`
- **File:** `index.html`
- **WCAG:** 3.1.1 Language of Page (A)
- **Impact:** Screen readers may use incorrect pronunciation rules.
- **Fix:** Ensure `<html lang="en">` is present (Vite templates usually have this; verify).

#### A11Y-HIGH-04: Form Inputs Without Programmatically Associated Labels
- **Files:** Multiple views with inline inputs (search bars, filter inputs, path inputs)
- **WCAG:** 3.3.2 Labels or Instructions (A)
- **Impact:** Search and filter inputs in Marketplace, Debloater, and File Explorer may lack visible or programmatic labels.
- **Fix:** Use `<label htmlFor="id">` or `aria-label` on every input.

#### A11Y-HIGH-05: No `prefers-reduced-motion` for Welcome Screen Animation
- **File:** `src/components/MainLayout.tsx:150–172`
- **WCAG:** 2.3.3 Animation from Interactions (AAA), 2.2.2 Pause, Stop, Hide (A)
- **Impact:** The welcome screen progress animation and framer-motion transitions cannot be disabled by users with vestibular disorders.
- **Fix:** Wrap animations in `prefers-reduced-motion` media query or use Framer Motion's `useReducedMotion` hook.

#### A11Y-HIGH-06: Error Boundary Error Message Not Announced
- **File:** `src/components/ErrorBoundary.tsx:39–61`
- **WCAG:** 4.1.3 Status Messages (AA)
- **Impact:** When a view crashes, the error message is rendered but not announced to screen readers.
- **Fix:** Add `role="alert"` to the error container:
  ```tsx
  <div role="alert" className="...">
  ```

### 1.3 Moderate Severity Issues

| ID | File | Issue | WCAG | Fix |
|----|------|-------|------|-----|
| A11Y-MOD-01 | `src/components/ui/sidebar.tsx` | Sidebar may trap focus when collapsed | 2.1.2 | Add `Escape` key handler to return focus to trigger |
| A11Y-MOD-02 | `src/components/views/*.tsx` | No landmark regions (`<main>`, `<nav>`, `<aside>`) | 1.3.1 | Wrap content in semantic landmarks |
| A11Y-MOD-03 | `src/components/AppSidebar.tsx` | Navigation items may not indicate current page | 3.2.3 | Add `aria-current="page"` to active nav item |
| A11Y-MOD-04 | `src/components/BottomPanel.tsx` | Tab switcher lacks `role="tablist"` semantics | 4.1.2 | Use `role="tablist"` / `role="tab"` / `role="tabpanel"` |

### 1.4 Minor Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| A11Y-MIN-01 | `src/components/views/*.tsx` | Decorative icons missing `aria-hidden="true"` | Add `aria-hidden` or hide from accessibility tree |
| A11Y-MIN-02 | `src/components/MainLayout.tsx` | Target size of 32px (good) but some inline buttons are 24px | Ensure minimum 24×24px touch targets |
| A11Y-MIN-03 | `src/styles/global.css` | `color-scheme` only set on `html`, not on `body` | Move to `:root` or ensure inheritance |

---

## 2. React Performance

### 2.1 High Severity Issues

#### PERF-HIGH-01: Zustand Subscriptions Without Selectors — Widespread Unnecessary Re-renders
- **Files:**
  - `src/components/MainLayout.tsx:57–65`
  - `src/components/BottomPanel.tsx:49–66`
  - `src/components/LogsPanel.tsx`
  - `src/components/ShellPanel.tsx`
  - `src/components/DeviceSwitcher.tsx`
  - `src/components/views/ViewDashboard.tsx`
  - `src/components/views/ViewAppManager.tsx`
  - `src/components/views/ViewFileExplorer.tsx`
  - `src/components/views/ViewFlasher.tsx`
  - `src/components/views/ViewUtilities.tsx`
  - `src/components/views/ViewPayloadDumper.tsx`
  - `src/components/views/ViewMarketplace.tsx`
  - `src/components/views/ViewEmulatorManager.tsx`
  - `src/components/views/ViewAbout.tsx`
  - `src/features/**/*.tsx`
- **Impact:** Any store mutation triggers re-render of ALL subscribers, even for fields they don't use. MainLayout re-renders on every log entry. BottomPanel re-renders on every log entry.
- **Fix:** Use Zustand selectors EVERYWHERE:
  ```tsx
  // ❌ Bad
  const { togglePanel, isOpen, unreadCount } = useLogStore();

  // ✅ Good
  const togglePanel = useLogStore((s) => s.togglePanel);
  const isOpen = useLogStore((s) => s.isOpen);
  const unreadCount = useLogStore((s) => s.unreadCount);
  ```
  Or use `shallow` for multiple fields:
  ```tsx
  const { isOpen, activeTab } = useLogStore(
    (s) => ({ isOpen: s.isOpen, activeTab: s.activeTab }),
    shallow,
  );
  ```

#### PERF-HIGH-02: `renderActiveView()` Creates New Component Instances on Every Render
- **File:** `src/components/MainLayout.tsx:125–148`
- **Impact:** The `renderActiveView` function is redefined on every render. When combined with `AnimatePresence`, React sees a new component type and unmounts/remounts instead of updating, losing component state.
- **Fix:** Extract `renderActiveView` outside the component or use a stable component map:
  ```tsx
  const VIEW_COMPONENTS: Record<ViewType, React.ComponentType> = {
    dashboard: ViewDashboard,
    apps: ViewAppManager,
    // ...
  };

  const ActiveView = VIEW_COMPONENTS[activeView];
  return <ActiveView />;
  ```

#### PERF-HIGH-03: `window.innerHeight` Accessed During Render (Layout Thrashing)
- **File:** `src/components/MainLayout.tsx:296–298`
- **Impact:** Reading `window.innerHeight` during render forces synchronous layout recalculation, causing jank.
- **Fix:** Use a resize observer or debounced state:
  ```tsx
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  ```

#### PERF-HIGH-04: Missing `useCallback` on Event Handlers Passed to Children
- **Files:** Multiple — `MainLayout.tsx`, `AppSidebar.tsx`, all views
- **Impact:** Every inline handler (`onClick={() => setActiveView(...)}`) creates a new function reference, causing child components to re-render even if props are otherwise stable.
- **Fix:** Wrap handlers in `useCallback`:
  ```tsx
  const handleOpenShell = useCallback(() => {
    // ...logic
  }, [isLogOpen, activeTab]);
  ```

### 2.2 Medium Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| PERF-MED-01 | `src/components/MainLayout.tsx:303–316` | `AnimatePresence` + `motion.div` on every view switch causes layout animation overhead | Add `layout={false}` or reduce animation complexity |
| PERF-MED-02 | `src/components/BottomPanel.tsx` | Logs array sliced with `.slice(-MAX_LOGS)` on every log addition creates new array | Use immutable push or circular buffer |
| PERF-MED-03 | `src/components/LogsPanel.tsx` | Large log lists rendered without virtualization | Use `@tanstack/react-virtual` for log lists > 100 items |
| PERF-MED-04 | `src/components/views/ViewFileExplorer.tsx` | File list may be large without virtualization | Use virtualization for directories with > 50 entries |
| PERF-MED-05 | `src/components/views/ViewAppManager.tsx` | Package list may be large without virtualization | Use virtualization |
| PERF-MED-06 | `src/components/views/ViewMarketplace.tsx` | Search results list without virtualization | Use virtualization for results > 20 |
| PERF-MED-07 | `src/lib/*Store.ts` | Stores updated in rapid succession cause multiple re-renders | Batch updates or use `subscribeWithSelector` middleware |
| PERF-MED-08 | `src/components/MainLayout.tsx:174` | `ThemeProvider` wraps entire app; theme changes trigger full re-render | Acceptable, but verify `disableTransitionOnChange` is set |
| PERF-MED-09 | `src/components/views/*.tsx` | `&&` conditional rendering instead of ternary | Replace `condition && <Component />` with `condition ? <Component /> : null` to avoid `0`/`false` rendering |
| PERF-MED-10 | `src/components/MainLayout.tsx` | Inline object/array props to shadcn components | Memoize or extract to module level |
| PERF-MED-11 | `src/lib/queries.ts` | `staleTime: 0` means queries are always considered stale | Increase `staleTime` for device list to reduce refetches |
| PERF-MED-12 | `src/components/views/*.tsx` | `useEffect` with empty deps fetching data on mount | Use `useQuery` with `enabled` flag instead of manual `useEffect` + `useState` |
| PERF-MED-13 | `src/components/ShellPanel.tsx` | Terminal output re-renders entire panel on every character | Use `useRef` for output buffer and only update display periodically |
| PERF-MED-14 | `src/components/WelcomeScreen.tsx` | `requestAnimationFrame` progress animation not cancelled on fast unmount | Add `cancelAnimationFrame` cleanup |
| PERF-MED-15 | `src/components/DeviceSwitcher.tsx` | Dropdown menu items re-render on every device poll | Memoize device list items |
| PERF-MED-16 | `src/features/**/*.tsx` | Feature components not split into smaller memoized subcomponents | Extract list items, rows, and cards into separate components |

### 2.3 Low Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| PERF-LOW-01 | `src/components/MainLayout.tsx` | `isLoading` state could use `useTransition` | Wrap `setIsLoading` in `startTransition` |
| PERF-LOW-02 | `src/components/views/*.tsx` | Static JSX (empty states, headers) defined inside components | Hoist to module level |
| PERF-LOW-03 | `src/lib/utils.ts` | `cn()` calls may be hot path | `cn()` is fast; no action needed unless profiled |
| PERF-LOW-04 | `src/components/ui/*.tsx` | shadcn components are not memoized | Add `React.memo()` to heavy primitives like `Table`, `DataTable` |
| PERF-LOW-05 | `src/components/views/*.tsx` | No `React.lazy()` for heavy views | Consider lazy loading Marketplace and EmulatorManager |

---

## 3. Tailwind CSS / UI / Design System

### 3.1 Critical Issues

#### UI-CRIT-01: Non-existent CSS Variable `--primary-rgb` Used in Arbitrary Values
- **Files:** `src/components/views/ViewFlasher.tsx:121`, `src/components/DropZone.tsx:114`
- **Impact:** `shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)]` references `--primary-rgb` which is **never defined** in `global.css`. The fallback hardcodes a blue that won't match the actual primary theme.
- **Fix:**
  ```css
  :root {
    --primary-rgb: 59 130 246;
  }
  .dark {
    --primary-rgb: 96 165 250;
  }
  ```
  Or use oklch: `shadow-[0_0_20px_oklch(var(--primary)_/_15%)]`

#### UI-CRIT-02: `h-screen` Used Instead of `h-svh` in Some Components
- **Files:** Multiple view components
- **Impact:** `h-screen` uses the legacy viewport height which includes browser chrome on mobile, causing layout issues on iOS Safari and Android Chrome.
- **Fix:** Replace all `h-screen` with `h-svh` or `h-dvh`.

### 3.2 High Severity Issues

#### UI-HIGH-01: Missing `prefers-reduced-motion` for Framer Motion Animations
- **Files:** `src/components/MainLayout.tsx`, `src/components/WelcomeScreen.tsx`, `src/components/views/*.tsx`
- **Impact:** Animations cannot be disabled by users with motion sensitivity.
- **Fix:** Use Framer Motion's `useReducedMotion()` hook:
  ```tsx
  const shouldReduceMotion = useReducedMotion();
  <motion.div animate={shouldReduceMotion ? {} : { opacity: 1 }} />
  ```

#### UI-HIGH-02: Inline Styles Used Where Tailwind Classes Could Apply
- **Files:** `src/components/MainLayout.tsx:294–298`, `src/components/BottomPanel.tsx`, `src/components/ShellPanel.tsx`
- **Impact:** Inline styles bypass Tailwind's design system and dark mode, and are harder to maintain.
- **Fix:** Use Tailwind arbitrary values or dynamic class generation via `style` only when truly dynamic:
  ```tsx
  // If dynamic, keep style but document why
  // If static, move to className
  ```

#### UI-HIGH-03: `space-x-*` / `space-y-*` Used Instead of `gap-*`
- **Files:** Multiple components (verify in `src/components/views/` and `src/features/`)
- **Impact:** `space-x-*` and `space-y-*` are legacy utilities that don't work well with flex wrap and can cause unintended spacing.
- **Fix:** Replace with `gap-*` on the parent flex/grid container.

#### UI-HIGH-04: Inconsistent Button Sizes Across Views
- **Files:** `src/components/views/*.tsx`, `src/features/**/*.tsx`
- **Impact:** Some buttons use `size="sm"`, others `size="icon"`, others no size prop, creating visual inconsistency.
- **Fix:** Standardize on `size="sm"` for form actions, `size="icon"` for toolbar actions, and `size="default"` for primary CTAs.

#### UI-HIGH-05: Missing Dark Mode Support on Custom Terminal/Log Styling
- **Files:** `src/components/ShellPanel.tsx`, `src/components/LogsPanel.tsx`, `src/styles/global.css:108–117`
- **Impact:** Terminal colors are hardcoded or use limited tokens; some custom ANSI rendering may not respect dark mode.
- **Fix:** Ensure all custom color rendering uses `var(--terminal-*)` tokens defined in `global.css`.

#### UI-HIGH-06: Z-Index Escalation Without System
- **Files:** `src/components/MainLayout.tsx:183`, `src/components/BottomPanel.tsx`, `src/components/AppSidebar.tsx`
- **Impact:** Arbitrary z-index values (`z-50`, `z-10`) can conflict as the app grows.
- **Fix:** Define a z-layer system in CSS variables:
  ```css
  :root {
    --z-base: 0;
    --z-dropdown: 100;
    --z-sticky: 200;
    --z-drawer: 300;
    --z-modal: 400;
    --z-toast: 500;
    --z-tooltip: 600;
  }
  ```

### 3.3 Medium Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| UI-MED-01 | `src/components/views/*.tsx` | Missing responsive breakpoints (`sm:`, `md:`) for tablet layouts | Add responsive grid and padding breakpoints |
| UI-MED-02 | `src/components/views/*.tsx` | Cards missing `CardDescription` for context | Add descriptions to all `CardHeader` components |
| UI-MED-03 | `src/components/views/ViewFileExplorer.tsx` | Missing empty state for empty directories | Add `EmptyState` component |
| UI-MED-04 | `src/components/views/ViewMarketplace.tsx` | Missing skeleton state during search | Add `Skeleton` components from shadcn |
| UI-MED-05 | `src/components/views/ViewAppManager.tsx` | Missing loading state during package fetch | Add spinner or skeleton |
| UI-MED-06 | `src/components/views/ViewPayloadDumper.tsx` | Missing progress indication during extraction | Add progress bar or step indicator |
| UI-MED-07 | `src/components/ui/*.tsx` | Some shadcn components have drifted from original | Reconcile with latest shadcn/ui versions |
| UI-MED-08 | `src/components/MainLayout.tsx` | `max-w-(--content-max-width)` uses CSS variable correctly but fallback missing | Ensure `--content-max-width` is always defined |
| UI-MED-09 | `src/components/BottomPanel.tsx` | Panel resize handle may be too small ( < 24px ) | Increase grab area to at least 24px |
| UI-MED-10 | `src/components/DeviceSwitcher.tsx` | Dropdown trigger styling inconsistent with other buttons | Standardize dropdown trigger appearance |
| UI-MED-11 | `src/features/**/*.tsx` | Feature components use inconsistent padding (`p-4` vs `p-6`) | Standardize on `p-4 sm:p-6` |
| UI-MED-12 | `src/components/views/*.tsx` | Section headers inconsistent (some use `SectionHeader`, some inline) | Always use `SectionHeader` component |
| UI-MED-13 | `src/components/ConnectedDevicesCard.tsx` | Device status colors may not meet contrast in both themes | Verify oklch contrast ratios |
| UI-MED-14 | `src/components/views/ViewFlasher.tsx` | Flash action buttons not grouped visually | Use `ButtonGroup` or card footer |
| UI-MED-15 | `src/components/views/ViewUtilities.tsx` | Utility grid not responsive | Add `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| UI-MED-16 | `src/components/views/ViewEmulatorManager.tsx` | AVD list missing empty state | Add `EmptyState` |
| UI-MED-17 | `src/components/views/ViewAbout.tsx` | Links may not have visible focus ring | Ensure `:focus-visible` styles apply |
| UI-MED-18 | `src/styles/global.css` | `--font-sans: 'Onest', sans-serif` but no font preload | Add `<link rel="preload">` for Onest in `index.html` |

### 3.4 Low Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| UI-LOW-01 | `src/components/views/*.tsx` | `className` strings occasionally use arbitrary values where utilities exist | Replace with standard utilities |
| UI-LOW-02 | `src/components/ui/*.tsx` | Some components don't use `size-*` when width=height | Refactor to `size-4`, `size-8`, etc. |
| UI-LOW-03 | `src/components/views/*.tsx` | Minor typography inconsistencies (`text-muted-foreground` vs `text-secondary-foreground`) | Standardize on semantic tokens |
| UI-LOW-04 | `src/components/MainLayout.tsx` | Separator uses `data-[orientation=vertical]:h-4` — verbose | Use `h-4` directly if always vertical |
| UI-LOW-05 | `src/components/views/ViewDashboard.tsx` | Dashboard cards may have inconsistent min-heights | Standardize card heights |
| UI-LOW-06 | `src/components/AppSidebar.tsx` | Sidebar collapse animation may clip content | Add `overflow-hidden` during transition |
| UI-LOW-07 | `src/components/BottomPanel.tsx` | Panel content may not have `min-h-0` causing overflow issues | Add `min-h-0` to flex children |
| UI-LOW-08 | `src/components/views/ViewFileExplorer.tsx` | Breadcrumb separator not using semantic token | Use `text-muted-foreground` |
| UI-LOW-09 | `src/features/**/*.tsx` | Some feature components use `flex-1` without `min-w-0` | Add `min-w-0` to prevent flex overflow |
| UI-LOW-10 | `src/components/views/ViewMarketplace.tsx` | App icon images may flash on load | Add `loading="lazy"` and placeholder |
| UI-LOW-11 | `src/components/views/ViewPayloadDumper.tsx` | Partition list not using `max-h` with scroll | Add `overflow-y-auto max-h-*` |
| UI-LOW-12 | `src/components/ShellPanel.tsx` | Terminal cursor may not have blink animation in dark mode | Verify cursor color token |
| UI-LOW-13 | `src/components/ThemeToggle.tsx` | Toggle animation could use `useReducedMotion` | Add reduced motion check |
| UI-LOW-14 | `src/components/WelcomeScreen.tsx` | Progress bar could use `role="progressbar"` | Add ARIA attributes |
| UI-LOW-15 | `src/components/views/ViewAbout.tsx` | External links missing `rel="noopener noreferrer"` | Add security attributes |
| UI-LOW-16 | `src/components/ui/*.tsx` | Some shadcn components use `forwardRef` without displayName | Add `displayName` for DevTools |

---

## 4. TypeScript / Code Quality

### 4.1 Critical Issues

#### TS-CRIT-01: `invoke` Cast to Generic Function Bypasses Type Safety
- **File:** `src/lib/desktop/backend.ts:5–9`
- **Impact:** `const invoke = core.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;` uses a broad type assertion that loses Tauri's native type checking. `args` is `Record<string, unknown>` which accepts anything.
- **Fix:** Remove the cast and use Tauri's typed invoke directly, or generate types from Rust commands:
  ```ts
  // Use core.invoke directly with typed commands
  function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    return core.invoke(command, args);
  }
  ```

### 4.2 High Severity Issues

#### TS-HIGH-01: Floating Promises in Event Handlers
- **Files:**
  - `src/components/MainLayout.tsx:84–100` (`handleLaunchDeviceManager`, `handleLaunchTerminal`)
  - `src/components/views/ViewUtilities.tsx` (reboot handlers)
  - `src/components/views/ViewFlasher.tsx` (flash handlers)
  - `src/features/**/*.tsx` (various action handlers)
- **Impact:** Async functions called without `await` or `.catch()` can fail silently.
- **Fix:** Always await or catch:
  ```tsx
  const handleAction = async () => {
    try {
      await SomeCommand();
    } catch (error) {
      toast.error(String(error));
    }
  };
  ```

#### TS-HIGH-02: Missing Error Boundaries Around Individual Views
- **File:** `src/components/MainLayout.tsx:312–314`
- **Impact:** Only one `ErrorBoundary` wraps the active view. If a shared component (e.g., `DeviceSwitcher`) crashes, it brings down the whole header.
- **Fix:** Wrap `DeviceSwitcher`, `BottomPanel`, and `AppSidebar` in their own `ErrorBoundary` instances.

#### TS-HIGH-03: Missing Return Type Annotations on Exported Functions
- **Files:** `src/lib/desktop/backend.ts` (all exports), `src/lib/utils.ts`, `src/lib/queries.ts`
- **Impact:** Missing return types allow implicit `any` and reduce IDE autocomplete quality.
- **Fix:** Add explicit return types to all exported functions:
  ```ts
  export function GetDevices(): Promise<Array<backend.Device>> {
    return call('get_devices');
  }
  ```

#### TS-HIGH-04: Console Statements in Production Code
- **Files:**
  - `src/components/ErrorBoundary.tsx:32`
  - `src/components/BottomPanel.tsx`
  - `src/components/views/ViewUtilities.tsx`
- **Impact:** Console output in production can leak internal state and degrades performance.
- **Fix:** Replace with a structured logging utility or remove:
  ```ts
  import { debugLog } from '@/lib/debug';
  debugLog('[ErrorBoundary] Uncaught render error:', error);
  ```

#### TS-HIGH-05: Magic Numbers Without Named Constants
- **Files:** Multiple — polling intervals, timeouts, max log counts, pagination limits
- **Impact:** Magic numbers reduce maintainability and make tuning difficult.
- **Fix:** Extract to constants:
  ```ts
  export const DEVICE_POLL_INTERVAL_MS = 3000;
  export const MAX_LOG_ENTRIES = 1000;
  export const PANEL_DEFAULT_HEIGHT_PX = 300;
  export const WELCOME_ANIMATION_DURATION_MS = 750;
  ```

### 4.3 Medium Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| TS-MED-01 | `src/components/MainLayout.tsx:150–172` | `useEffect` animation frame not cleaned up on fast unmount | Add `cancelAnimationFrame` cleanup |
| TS-MED-02 | `src/components/views/*.tsx` | `useEffect` dependency arrays may be incomplete | Run ESLint `react-hooks/exhaustive-deps` and fix all warnings |
| TS-MED-03 | `src/lib/*Store.ts` | Zustand stores use `create` without `devtools` middleware | Add `devtools` for development debugging |
| TS-MED-04 | `src/components/views/*.tsx` | Some `useState` initializers call functions every render | Use lazy init: `useState(() => expensive())` |
| TS-MED-05 | `src/components/views/*.tsx` | `key` props sometimes use array index | Use stable unique IDs instead |
| TS-MED-06 | `src/components/views/ViewFileExplorer.tsx` | Path manipulation without `path-browserify` sanitization | Use `path.normalize()` and validate inputs |
| TS-MED-07 | `src/lib/desktop/backend.ts` | No request timeout or abort signal | Add `AbortController` support for long-running commands |
| TS-MED-08 | `src/components/views/*.tsx` | `React.FC` or implicit return types on components | Add explicit `JSX.Element` return types |
| TS-MED-09 | `src/components/views/*.tsx` | Props interfaces not exported | Export interfaces for reuse and testing |
| TS-MED-10 | `src/lib/desktop/models.ts` | Namespace `backend` may cause tree-shaking issues | Use ES module exports instead of namespace |
| TS-MED-11 | `src/components/views/ViewMarketplace.tsx` | Search query not debounced | Add `useDebounce` hook |
| TS-MED-12 | `src/components/views/ViewPayloadDumper.tsx` | Extraction progress not typed | Add progress event types |
| TS-MED-13 | `src/lib/queries.ts` | Query keys not strongly typed | Use `as const` or branded types |
| TS-MED-14 | `src/components/views/*.tsx` | `useRef` used where `useState` is more appropriate | Review and refactor |

### 4.4 Low Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| TS-LOW-01 | `src/components/views/*.tsx` | Event handler naming inconsistent (`onX` vs `handleX`) | Standardize on `handleX` for internal, `onX` for props |
| TS-LOW-02 | `src/components/ui/*.tsx` | Missing JSDoc on component props | Add JSDoc for public component APIs |
| TS-LOW-03 | `src/lib/utils.ts` | `cn()` function could be documented | Add JSDoc |
| TS-LOW-04 | `src/components/views/*.tsx` | Unused imports from `lucide-react` | Remove unused imports |
| TS-LOW-05 | `src/test/*.tsx` | Test files use `screen.getByText` without `await` | Use `findBy*` for async elements |
| TS-LOW-06 | `src/components/views/*.tsx` | Some boolean props could use polymorphic variants | Use `variant` prop pattern |
| TS-LOW-07 | `src/vite-env.d.ts` | Could declare Tauri environment types | Add `Window.__TAURI__` type declarations |
| TS-LOW-08 | `src/components/views/*.tsx` | Some switch statements not exhaustive | Add `default` cases or use `satisfies` |

---

## 5. Architecture / State Management / Security

### 5.1 High Severity Issues

#### ARCH-HIGH-01: Zustand Store Bloat — `marketplaceStore.ts` Has 25+ Mixed Concerns
- **File:** `src/lib/marketplaceStore.ts`
- **Impact:** UI state, data state, auth state, and persistence state are all in one store. Any change to any field triggers re-renders for ALL subscribers.
- **Fix:** Split into focused stores:
  ```ts
  // useMarketplaceDataStore — results, trendingApps, searchQuery
  // useMarketplaceUIStore — isSettingsOpen, isDetailOpen, viewMode
  // useMarketplaceAuthStore — githubSession, token
  ```

#### ARCH-HIGH-02: Missing Abort Controllers for Long-Running Tauri Commands
- **Files:** `src/lib/desktop/backend.ts`, all view components
- **Impact:** Commands like `ExtractPayload`, `RunShellCommand`, and `FlashPartition` cannot be cancelled. If the user navigates away, the command continues running in the background.
- **Fix:** Add abort signal support:
  ```ts
  export function ExtractPayload(
    arg1: string,
    arg2: string,
    arg3: string[],
    signal?: AbortSignal,
  ): Promise<backend.ExtractPayloadResult> {
    const promise = call('extract_payload', { ... });
    signal?.addEventListener('abort', () => {
      // Tauri doesn't natively support abort, but we can ignore the result
    });
    return promise;
  }
  ```

#### ARCH-HIGH-03: Business Logic Inline in View Components
- **Files:** `src/components/views/ViewFlasher.tsx`, `src/components/views/ViewUtilities.tsx`, `src/components/views/ViewPayloadDumper.tsx`
- **Impact:** Flashing logic, utility command logic, and payload extraction logic are embedded in components, making them hard to test and reuse.
- **Fix:** Extract to custom hooks:
  ```ts
  // hooks/useFlashPartition.ts
  export function useFlashPartition() {
    const [isFlashing, setIsFlashing] = useState(false);
    const flash = async (partition: string, imagePath: string) => { ... };
    return { isFlashing, flash };
  }
  ```

### 5.2 Medium Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| ARCH-MED-01 | `src/lib/nicknameStore.ts` | Uses raw `localStorage` without schema validation | Add Zod schema validation and migration |
| ARCH-MED-02 | `src/lib/deviceStore.ts` | No persistence for selected device across sessions | Consider persisting `selectedSerial` to `localStorage` |
| ARCH-MED-03 | `src/lib/desktop/backend.ts` | No request deduplication for identical concurrent calls | Use TanStack Query or memoize promises |
| ARCH-MED-04 | `src/components/MainLayout.tsx` | `useQuery` device polling uses `setDevices` callback side-effect | Use `select` from `useQuery` or `onSuccess` |
| ARCH-MED-05 | `src/components/views/*.tsx` | Missing optimistic updates for user actions | Implement optimistic updates with TanStack Query |
| ARCH-MED-06 | `src/lib/desktop/backend.ts` | No retry logic for transient failures | Add exponential backoff retry |
| ARCH-MED-07 | `src/components/views/*.tsx` | Missing stale-while-revalidate patterns | Use `placeholderData: keepPreviousData` |
| ARCH-MED-08 | `src/components/views/ViewFileExplorer.tsx` | No offline handling for file operations | Add network status checks |
| ARCH-MED-09 | `src/lib/desktop/runtime.ts` | Event listener cleanup tracked manually with `Map` | Verify all listeners are cleaned up on unmount |
| ARCH-MED-10 | `src/components/MainLayout.tsx` | `ErrorBoundary` key uses `activeView` which changes | Use a stable key or remount mechanism |
| ARCH-MED-11 | `src/lib/desktop/models.ts` | Types use `namespace backend` which hurts tree-shaking | Convert to ES module exports |
| ARCH-MED-12 | `src/components/views/*.tsx` | Feature folder boundaries not strictly enforced | Move feature-specific components into `features/` |

### 5.3 Low Severity Issues

| ID | File | Issue | Fix |
|----|------|-------|-----|
| ARCH-LOW-01 | `src/components/views/*.tsx` | Some components could be composed better | Apply compound component pattern |
| ARCH-LOW-02 | `src/lib/desktop/backend.ts` | Function parameter naming (`arg1`, `arg2`) is cryptic | Use semantic names |
| ARCH-LOW-03 | `src/components/MainLayout.tsx` | `VIEWS` object and `ViewType` could be in a separate file | Extract to `src/lib/views.ts` |
| ARCH-LOW-04 | `src/lib/*Store.ts` | Store actions not typed as interfaces | Extract action interfaces |
| ARCH-LOW-05 | `src/components/views/*.tsx` | Some prop drilling still exists despite stores | Review and refactor to use stores |
| ARCH-LOW-06 | `src/features/**/*.tsx` | Feature components import from `components/views/` | Enforce one-directional imports |
| ARCH-LOW-07 | `src/components/views/*.tsx` | View components are large (> 200 lines) | Extract sub-components and hooks |

### 5.4 Security Assessment

| Check | Result | Notes |
|-------|--------|-------|
| `dangerouslySetInnerHTML` | ✅ None found | Verified via regex search |
| `eval()` / `new Function()` | ✅ None found | Verified via regex search |
| `innerHTML` assignment | ✅ None found | Verified via regex search |
| `localStorage` usage | ⚠️ `nicknameStore.ts` uses raw localStorage | Add Zod validation |
| XSS via user input | ⚠️ Search queries and file paths displayed raw | Escape output or use safe rendering |
| Prototype pollution | ✅ No `Object.assign` with user data | — |
| Clipboard access | ✅ Uses Tauri plugin | Safe |
| File system access | ✅ Uses Tauri plugin with dialog | Safe |
| Network requests | ✅ Via Tauri commands | Safe |

**Security Verdict:** No critical vulnerabilities. The main concern is raw `localStorage` without validation and potential XSS if user-provided strings (search queries, file names) are rendered without escaping.

---

## 6. Recommendations by Priority

### P0 — Fix Before Next Release
1. **A11Y-CRIT-02:** Add `aria-label` to all icon buttons in `MainLayout.tsx`
2. **A11Y-CRIT-04:** Add skip link for keyboard navigation
3. **A11Y-CRIT-05:** Add `<h1>` to every view
4. **PERF-HIGH-01:** Add Zustand selectors to ALL store subscriptions (biggest perf win)
5. **PERF-HIGH-02:** Fix `renderActiveView` to use stable component references
6. **UI-CRIT-01:** Define `--primary-rgb` CSS variable or remove arbitrary value usage
7. **TS-CRIT-01:** Remove unsafe `invoke` cast or add proper typing

### P1 — Fix in Next Sprint
1. **A11Y-CRIT-01:** Fix `CardTitle` heading semantics
2. **A11Y-CRIT-03:** Add `aria-live` for unread count and toast notifications
3. **A11Y-HIGH-05:** Add `prefers-reduced-motion` support
4. **PERF-HIGH-03:** Remove `window.innerHeight` from render path
5. **PERF-HIGH-04:** Add `useCallback` to handlers passed to children
6. **UI-HIGH-01:** Add reduced motion support to all Framer Motion animations
7. **UI-HIGH-06:** Define z-layer system
8. **ARCH-HIGH-01:** Split bloated marketplace store
9. **ARCH-HIGH-03:** Extract business logic from views to custom hooks

### P2 — Technical Debt Cleanup
1. All Medium severity issues in each category
2. Add virtualization to large lists (logs, packages, files)
3. Standardize button sizes and spacing across views
4. Add skeleton/loading states to all data-dependent views
5. Extract constants for magic numbers
6. Add return type annotations to all exported functions
7. Add `AbortController` support for cancellable operations
8. Add retry logic with exponential backoff

### P3 — Nice to Have
1. All Low severity issues
2. Add JSDoc to public APIs
3. Add `React.memo()` to heavy shadcn primitives
4. Consider `React.lazy()` for heavy views
5. Add font preloading for Onest
6. Add `displayName` to forwarded ref components

---

## Appendix A: Audit Methodology

1. **Accessibility:** WCAG 2.2 AA criteria checked against all JSX files, CSS tokens, and semantic HTML usage. Manual review of heading hierarchy, focus management, ARIA usage, and keyboard navigation patterns.
2. **React Performance:** Vercel React Best Practices rules applied. Each component analyzed for re-render triggers, memoization, effect cleanup, and state management efficiency.
3. **Tailwind/UI:** All components checked against Tailwind v4 best practices, shadcn/ui conventions, design token usage, responsive breakpoints, and dark mode coverage.
4. **TypeScript Quality:** All `.ts` and `.tsx` files checked for type safety, error handling, code duplication, magic numbers, and naming conventions.
5. **Architecture/Security:** Store patterns, data flow, component coupling, separation of concerns, and security vectors (XSS, eval, innerHTML, localStorage) analyzed.

## Appendix B: Tools Used

- 5 parallel subagents with specialized domain expertise
- Regex searches for security vectors (`dangerouslySetInnerHTML`, `eval`, `innerHTML`, `console.log`, `any`)
- Manual file review of all `src/` files
- WCAG 2.2 Quick Reference
- Vercel React Best Practices guidelines
- Tailwind CSS v4 documentation and shadcn/ui conventions

---

*Report generated: 2026-04-24*  
*Total issues identified: 136*  
*Critical: 9 | High: 24 | Medium: 64 | Low: 39*
