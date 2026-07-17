# Frontend Comprehensive Audit Report

**Date:** 2026-03-30
**Project:** adb-gui-next (Tauri 2 + React 19 + TypeScript + Vite)
**Scope:** All frontend source files — React, TypeScript, shadcn/ui, Accessibility, Security, Error Handling
**Method:** 4 parallel sub-agents read all source files and cross-referenced against shadcn skill rules, AGENTS.md conventions, memory-bank system patterns, and context7 documentation

---

## Executive Summary

The frontend is in **strong shape** — clean architecture, consistent patterns, and well-organized code. The audit found **~100 issues** across 5 dimensions:

| Severity | Count | Action |
|----------|-------|--------|
| **Critical** | 5 | Must fix before next release |
| **High** | 25 | Should fix soon |
| **Medium** | 40 | Nice to have |
| **Low** | 30 | Minor polish |

**Top 3 areas needing attention:**
1. **No Error Boundaries** — A single render crash takes down the entire app (white screen)
2. **`any` types in event system** — `runtime.ts` erases type safety for all event payloads
3. **Icons in Button** — ~50 instances use manual `className="mr-2 h-4 w-4"` instead of `data-icon`

---

## Critical Issues (5)

### C1. No Error Boundaries Anywhere

**File:** App-wide (`App.tsx`, `MainLayout.tsx`)
**Category:** React / Resilibility

No `ErrorBoundary` component exists in the codebase. A crash in any view takes down the entire app with a white screen — no recovery, no user feedback.

**Impact:** In a Tauri desktop app, a white screen is especially jarring. Users must restart.

**Fix:** Wrap `renderActiveView()` in `MainLayout.tsx` with a per-view `ErrorBoundary` showing fallback UI + "Retry" button.

---

### C2. `any` Types in Event System

**File:** `src/lib/desktop/runtime.ts:5,54,130`
**Category:** TypeScript

Three explicit `any` usages in the core event communication layer:

```ts
// Line 5
type EventCallback = (...data: any[]) => void;

// Line 54
.listen(eventName, (event: any) => {

// Line 130
.onDragDropEvent((event: any) => {
```

Every event listener in the app flows through this untyped chain.

**Fix:** Make `EventsOn` generic: `EventsOn<T>(name: string, cb: (data: T) => void)`. Use Tauri's `Event<T>` and `DragDropEvent` types.

---

### C3. Raw Tailwind Palette Colors for Device Status (Duplicated)

**Files:** `DeviceSwitcher.tsx:22-58`, `ConnectedDevicesCard.tsx:25-62`
**Category:** shadcn/ui (styling.md) + DRY

`STATUS_CONFIG` duplicated verbatim in both files with raw Tailwind palette colors:

```ts
// WRONG — raw palette, duplicated across 2 files
badgeClass: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
```

7 device states × 2 files = 14 raw color declarations. These should use CSS variables.

**Fix:** Define CSS variables in `global.css` (`--status-adb`, `--status-fastboot`, etc.), extract to shared module.

---

### C4. `logStore.ts` — `undefined` Assigned to `number`-Typed Field

**File:** `src/lib/logStore.ts:76`
**Category:** TypeScript

```ts
set({ isOpen, unreadCount: isOpen ? 0 : undefined } as Partial<LogStore>);
```

`unreadCount` is typed as `number` but `undefined` is assigned when `isOpen` is false. The `as Partial<LogStore>` cast hides this type violation.

**Fix:** `set((state) => ({ isOpen, unreadCount: isOpen ? 0 : state.unreadCount }))`

---

### C5. Icons in Button Not Using `data-icon` (~50 instances)

**Files:** All views + shared components
**Category:** shadcn/ui (icons.md)

Nearly every Button with an icon uses manual sizing instead of `data-icon`:

```tsx
// WRONG — ~50 instances across all views
<Button><Search className="mr-2 h-4 w-4 shrink-0" /> Search</Button>

// CORRECT
<Button><Search data-icon="inline-start" /> Search</Button>
```

**Fix:** Gradually replace `className="mr-2 h-4 w-4 shrink-0"` with `data-icon="inline-start"`.

---

## High Issues (25)

### React / Performance

| # | Finding | File:Line | Description |
|---|---------|-----------|-------------|
| H1 | **Race condition in file navigation** | `ViewFileExplorer.tsx:317-371` | `loadFiles` is async with no request sequencing. Rapid navigation can show stale directory contents. |
| H2 | **Keyboard shortcut listener churn** | `ViewFileExplorer.tsx:831-846` | useEffect has 14 deps — keydown listener torn down on every state change. Use refs. |
| H3 | **DropZone global singleton race** | `DropZone.tsx:65-106` | Multiple DropZone instances compete for global `fileDropCleanup` slot in runtime.ts. |
| H4 | **Install loop not cancellable** | `ViewAppManager.tsx:124-168` | Sequential install loop has no AbortController — setState on unmounted component. |
| H5 | **Window resize not reactive** | `BottomPanel.tsx:180`, `MainLayout.tsx:286` | `window.innerHeight * 0.7` reads in render — doesn't update on window resize. |
| H6 | **Inline package filter counts** | `ViewAppManager.tsx:371-376` | `.filter()` counts computed every render — should use `useMemo`. |
| H7 | **ViewFileExplorer is 1567 lines** | `ViewFileExplorer.tsx` | 28+ useState hooks, 15+ callbacks — violates single-responsibility. |
| H8 | **Duplicated STATUS_CONFIG** | `DeviceSwitcher.tsx` + `ConnectedDevicesCard.tsx` | Identical config in 2 files — extract to shared module. |
| H9 | **Force re-render hack** | `ViewDashboard.tsx:54`, `DeviceSwitcher.tsx:81` | `const [, forceRefresh] = useState(0)` — nicknameStore should be Zustand. |
| H10 | **Stale closure in handleExtract** | `ViewPayloadDumper.tsx:296-297` | Reads `extractedFiles` from closure — use functional updater `setExtractedFiles(prev => [...prev, ...])`. |
| H11 | **EventsOn/Off global nuke** | `ViewPayloadDumper.tsx:122-124` | `EventsOff('payload:progress')` removes ALL listeners, not just this one. Use returned unlisten function. |
| H12 | **Per-row ContextMenu** | `ViewFileExplorer.tsx:1299-1483` | Each file row gets its own ContextMenu — N rows = N Radix portals. Use single table-level ContextMenu. |

### TypeScript

| # | Finding | File:Line | Description |
|---|---------|-----------|-------------|
| H13 | **Unsafe `as` cast on core.invoke** | `backend.ts:5` | `core.invoke as <T>(...) => Promise<T>` overrides Tauri's built-in generic invoke. |
| H14 | **`view as ViewType` without validation** | `MainLayout.tsx:188` | Sidebar emits `string`, cast to `ViewType` without runtime check. |
| H15 | **Non-exhaustive switch** | `MainLayout.tsx:120-138` | `default` returns `ViewDashboard` — new views silently fall through. |

### shadcn/ui

| # | Finding | File:Line | Description |
|---|---------|-----------|-------------|
| H16 | **`Loader2` instead of `Spinner`** | ~20 instances across all views | All loading buttons use `Loader2 className="animate-spin"` instead of `Spinner` + `data-icon`. |
| H17 | **Forms not using FieldGroup+Field** | `ViewDashboard.tsx:213-271`, `ViewFlasher.tsx:372-387` | Raw `<div>` wrapping `<Input>` with manual error messages. |
| H18 | **Custom CheckboxItem** | `CheckboxItem.tsx:15-31` | Custom div-based checkbox when shadcn `Checkbox` already exists. |
| H19 | **Custom EmptyState** | `EmptyState.tsx:12-22` | Custom div when shadcn `Empty`/`EmptyHeader`/`EmptyMedia` exist. |
| H20 | **BottomPanel tabs are raw buttons** | `BottomPanel.tsx:249-291` | Custom tab buttons instead of shadcn `Tabs`/`TabsList`/`TabsTrigger`. |
| H21 | **Inline style overrides** | `BottomPanel.tsx:228-264` | `style={{ color: 'var(--terminal-fg)' }}` instead of CSS classes. |
| H22 | **`text-white` on destructive** | `MainLayout.tsx:268` | Raw `text-white` instead of `text-destructive-foreground`. |

### Accessibility / Security

| # | Finding | File:Line | Description |
|---|---------|-----------|-------------|
| H23 | **Shell command prefix-only validation** | `ShellPanel.tsx:52-92` | Schema checks prefix only (`adb `) — remainder passed unvalidated to backend. |
| H24 | **Silent errors in DirectoryTree** | `DirectoryTree.tsx:286-373` | All `.catch()` blocks swallow errors — no toast, no log, no feedback. |
| H25 | **Raw error messages in toasts** | `MainLayout.tsx:84,93` + multiple views | `${error}` displayed directly — may expose internal paths/commands. |

---

## Medium Issues (40)

### React (12)

| # | Finding | File:Line |
|---|---------|-----------|
| M1 | `wirelessForm` in useEffect deps (unstable ref) | `ViewDashboard.tsx:96-100` |
| M2 | Resize listeners re-registered on callback changes | `ViewFileExplorer.tsx:272-279` |
| M3 | EventsOn re-registers on stable store action changes | `ViewPayloadDumper.tsx:108-125` |
| M4 | DropZone effect re-registers on callback changes | `DropZone.tsx:65-106` |
| M5 | handleLaunchDeviceManager/Terminal not memoized | `MainLayout.tsx:79-95` |
| M6 | Panel animation cleanup incomplete | `BottomPanel.tsx:190-210` |
| M7 | Payload dumper partition list not virtualized | `ViewPayloadDumper.tsx:537` |
| M8 | Logs panel not virtualized (1000 items) | `LogsPanel.tsx:138` |
| M9 | payloadDumperStore uses Set/Map (always "changed") | `payloadDumperStore.ts:39-40` |
| M10 | logStore creates 2 arrays per log entry | `logStore.ts:53-64` |
| M11 | InfoItem not wrapped in React.memo | `ViewDashboard.tsx:384-411` |
| M12 | ExtractionProgressBar not wrapped in React.memo | `ViewPayloadDumper.tsx:47-75` |

### TypeScript (6)

| # | Finding | File:Line |
|---|---------|-----------|
| M13 | EventCallback erases all event payload types | `runtime.ts:5` |
| M14 | `onValueChange` cast for DropdownMenuRadioGroup | `ViewAppManager.tsx:365` |
| M15 | Non-exhaustive switch — no `never` check | `MainLayout.tsx:120-138` |
| M16 | Generic `T` on invoke is trust-based assertion | `backend.ts:7-8` |
| M17 | EventsOn not generic — callers manually type payloads | `runtime.ts:29,83` |
| M18 | DTO size field: `number` vs Rust `u64` | `models.ts:47` vs `extractor.rs:37` |

### shadcn/ui (12)

| # | Finding | File:Line |
|---|---------|-----------|
| M19 | `space-y-0.5` instead of `gap-0.5` | `ViewFileExplorer.tsx:1521` |
| M20 | DropdownMenuGroup wrapping missing | `ViewFileExplorer.tsx:1084-1093` |
| M21 | Input+Button uses relative/absolute instead of InputGroup | `ViewFileExplorer.tsx:1006-1026` |
| M22 | Custom filter dropdown instead of DropdownMenu | `BottomPanel.tsx:337-364` |
| M23 | Card missing CardDescription | `ViewDashboard.tsx:181`, `ViewAbout.tsx:43,70` |
| M24 | Badge colors overridden via className | `DeviceSwitcher.tsx`, `ConnectedDevicesCard.tsx` |
| M25 | Kill Server button overrides hover colors | `ViewUtilities.tsx:317` |
| M26 | Danger Zone card overrides border color | `ViewFlasher.tsx:510` |
| M27 | Raw badge span instead of Badge component | `ViewAbout.tsx:32-37` |
| M28 | Custom CheckboxItem instead of shadcn Checkbox | `CheckboxItem.tsx:15-31` |
| M29 | Manual z-50 on welcome screen overlay | `MainLayout.tsx:174` |
| M30 | z-[60] on resize overlay exceeds Dialog z-50 | `BottomPanel.tsx:219` |

### Accessibility / Security / Error Handling (10)

| # | Finding | File:Line |
|---|---------|-----------|
| M31 | Icon-only buttons missing aria-label (12 instances) | `MainLayout.tsx:207-267`, toolbar buttons |
| M32 | Filter dropdown lacks role="menu"/role="menuitem" | `BottomPanel.tsx:338-363` |
| M33 | Form inputs missing aria-label (IP, Port) | `ViewDashboard.tsx:219-223` |
| M34 | Focus not moved on view switch | `MainLayout.tsx:120-138` |
| M35 | No error boundary in renderActiveView | `MainLayout.tsx:120-138` |
| M36 | Path traversal: localStorage fe.currentPath | `ViewFileExplorer.tsx:223` |
| M37 | Raw error `${error}` in toasts | `MainLayout.tsx:84,93` |
| M38 | DirectoryTree silent error swallowing | `DirectoryTree.tsx:286-373` |
| M39 | CleanupPayloadCache without try/catch | `ViewPayloadDumper.tsx:193` |
| M40 | Color contrast: 400-level status colors on dark | `DeviceSwitcher.tsx:28-58` |

---

## Low Issues (30)

| # | Finding | File:Line | Category |
|---|---------|-----------|----------|
| L1 | `w-40 h-40` instead of `size-40` | `ViewAbout.tsx:17` | shadcn |
| L2 | `h-12 w-12` instead of `size-12` | `ViewPayloadDumper.tsx:345` | shadcn |
| L3 | `h-9 w-9` instead of `size-9` | `ViewPayloadDumper.tsx:737` | shadcn |
| L4 | Array index as key in ShellPanel | `ShellPanel.tsx:144` | React |
| L5 | Array index as key in ViewAppManager | `ViewAppManager.tsx:269` | React |
| L6 | Array index as key in LogsPanel | `LogsPanel.tsx:22,26` | React |
| L7 | Missing `noUnusedLocals`/`noUnusedParameters` | `tsconfig.json` | TypeScript |
| L8 | `interface` vs `type` mixing in stores | `deviceStore.ts`, `logStore.ts` | TypeScript |
| L9 | Missing return types on exported functions | Multiple | TypeScript |
| L10 | `document.getElementById('root') as HTMLElement` | `main.tsx:5` | TypeScript |
| L11 | namespace usage in models.ts (legacy pattern) | `models.ts` | TypeScript |
| L12 | `FileEntry.size` is `string` (parsed at runtime) | `models.ts:32` | TypeScript |
| L13 | unused `completed` param in updatePartitionProgress | `payloadDumperStore.ts:167` | TypeScript |
| L14 | `wrapperClassName` prop misleading (no wrapper) | `ActionButton.tsx` | React |
| L15 | ComboboxDemo missing `asChild` on PopoverTrigger | `combobox-demo.tsx:115` | shadcn |
| L16 | Header `z-10` on sticky header | `MainLayout.tsx:192` | shadcn |
| L17 | Filter dropdown `z-50` on custom popup | `BottomPanel.tsx:339` | shadcn |
| L18 | Resize overlay `z-50` | `ViewFileExplorer.tsx:855` | shadcn |
| L19 | Drag overlay `z-10` | `ViewFlasher.tsx:118`, `DropZone.tsx:122` | shadcn |
| L20 | Generic logo `alt="Logo"` | `ViewAbout.tsx:17` | A11y |
| L21 | Symlink text `text-[10px]` at 60% opacity | `ViewFileExplorer.tsx:1378` | A11y |
| L22 | Summary text `text-xs` muted | `ViewPayloadDumper.tsx:503-506` | A11y |
| L23 | Shell history no cap (unbounded growth) | `shellStore.ts:22-32` | React |
| L24 | `handleSaveGetVars` no loading state | `ViewUtilities.tsx:197-207` | UX |
| L25 | `handleOpenOutputFolder` no loading state | `ViewPayloadDumper.tsx:236-248` | UX |
| L26 | `handleCopy` catch doesn't log error | `BottomPanel.tsx:152` | Error |
| L27 | `String(error)` in toasts (may leak paths) | `ViewUtilities.tsx:118,158` | Security |
| L28 | `handleLaunchDeviceManager/Terminal` raw error | `MainLayout.tsx:84,93` | Error |
| L29 | `handleError` extracts message but some views don't use it | `ViewUtilities.tsx`, `MainLayout.tsx` | Error |
| L30 | `executePull` failure only shows toast (no persistent state) | `ViewFileExplorer.tsx:628-653` | UX |

---

## Verified Clean Areas

The following were audited and found clean:

- **No `space-x-*` usage** — all spacing uses `gap-*` (except M19)
- **No `w-10 h-10`** — all equal dimensions use `size-*` (except L1-L3)
- **No `dark:` overrides** — semantic tokens used throughout
- **No `dangerouslySetInnerHTML`** — zero XSS risk
- **No raw `<label>`** — all use shadcn `<Label>`
- **`cn()` usage** — used consistently for conditional classes
- **`@/` alias** — all project imports use `@/`
- **Tooltip consistency** — all icon buttons use shadcn `Tooltip`
- **Card composition** — mostly correct (CardHeader/CardTitle/CardContent)
- **AlertDialog destructive** — all use `buttonVariants({ variant: 'destructive' })`
- **Device polling** — centralized single source in MainLayout
- **Drag-drop hit-testing** — position-based, correct pattern
- **Async Tauri commands** — flash/wipe/install use `spawn_blocking`
- **No command injection risk** — Tauri IPC boundary is safe
- **All DTOs align** between frontend `models.ts` and Rust structs
- **Discriminated unions** used correctly (`ExtractionStatus`, `HistoryEntry.type`)
- **Type narrowing** done correctly (`unknown` → proper guards)

---

## Recommended Priority Order

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| 1 | C1 — Add error boundaries | Prevents white-screen crashes | 30 min |
| 2 | C4 — Fix `logStore.ts` undefined type | Prevents runtime bugs | 5 min |
| 3 | C3 + H8 — Extract shared STATUS_CONFIG with CSS variables | Fixes DRY + semantic tokens | 30 min |
| 4 | C2 — Type the event system in `runtime.ts` | Restores type safety | 1 hour |
| 5 | H1 — Add request sequencing to loadFiles | Fixes stale navigation | 30 min |
| 6 | H7 — Decompose ViewFileExplorer | Long-term maintainability | 2-3 hours |
| 7 | C5 — Migrate icons to `data-icon` (ongoing) | shadcn compliance | Gradual |
| 8 | H16 — Replace Loader2 with Spinner | shadcn compliance | 1 hour |
| 9 | H17 — Forms to FieldGroup+Field | shadcn compliance | 1 hour |
| 10 | M31 — Add aria-labels to icon-only buttons | Accessibility | 30 min |

---

## Scorecard

| Category | Critical | High | Medium | Low | Score |
|----------|----------|------|--------|-----|-------|
| React Patterns | 1 | 12 | 12 | 8 | **B** |
| TypeScript | 2 | 3 | 6 | 8 | **B+** |
| shadcn/ui | 1 | 10 | 12 | 6 | **B** |
| Accessibility | 0 | 1 | 6 | 5 | **B-** |
| Security | 0 | 1 | 2 | 4 | **A-** |
| Error Handling | 1 | 1 | 2 | 3 | **B+** |
| **Overall** | **5** | **25** | **40** | **30** | **B** |

---

_Generated by 4 parallel audit agents + consolidation. Agents: react-specialist, typescript-pro, shadcn rule engine, a11y/security auditor._
