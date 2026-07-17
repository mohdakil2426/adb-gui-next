# Frontend Audit Fixes Plan

**Date:** 2026-03-30
**Based on:** `docs/reports&audits/frontend-comprehensive-audit-2026-03-30.md`
**Scope:** Critical + High severity fixes from the 03-30 audit (100 issues, 5 Critical, 25 High)

> **Note:** The 03-28 audit references files that don't exist on `main` (`src/pages/`, `bottom-tab-bar.tsx`, demo file manager). It appears to be from a different branch or prior state. This plan focuses exclusively on the 03-30 audit which targets the current `main` codebase.

---

## Scope: Critical Issues (C1-C5)

### C1. No Error Boundaries Anywhere

**Problem:** No `ErrorBoundary` component exists. A render crash in any view produces a white screen with no recovery path.

**Fix:**

1. Create `src/components/ErrorBoundary.tsx` — a React class component that catches render errors and shows a fallback UI with a "Retry" button that resets the error state.
2. Wrap `renderActiveView()` return in `MainLayout.tsx` with `<ErrorBoundary key={activeView}>` so each view gets its own boundary and `key` forces remount on view switch.

**Files to create/modify:**
- `src/components/ErrorBoundary.tsx` (new)
- `src/components/MainLayout.tsx` (wrap renderActiveView)

**Estimated effort:** ~30 min

---

### C2. `any` Types in Event System

**Problem:** `runtime.ts` uses 3 explicit `any` usages:
- Line 5: `type EventCallback = (...data: any[]) => void;`
- Line 54: `.listen(eventName, (event: any) => ...)`
- Line 130: `.onDragDropEvent((event: any) => ...)`

Every event listener in the app flows through this untyped chain.

**Fix:**

1. Make `EventsOn` generic: `EventsOn<T>(name: string, cb: (data: T) => void)`
2. Use Tauri's typed `Event<T>` for the listen callback
3. Use Tauri's `DragDropEvent` type for the drag-drop callback
4. Update callers to provide type params (ViewPayloadDumper already does inline typing)

**Files to modify:**
- `src/lib/desktop/runtime.ts` (3 `any` removals + generic signature)

**Note:** `EventsOff` and `EventsOffAll` remain untyped (no payload involved) — no change needed.

**Estimated effort:** ~1 hour

---

### C3 + H8. Duplicated STATUS_CONFIG with Raw Tailwind Colors

**Problem:** `STATUS_CONFIG` is duplicated verbatim in `DeviceSwitcher.tsx` (lines 22-59) and `ConnectedDevicesCard.tsx` (lines 25-62). 7 device states × 2 files = 14 raw Tailwind palette color declarations like `bg-emerald-400/15 text-emerald-400 border-emerald-400/30`.

**Fix:**

1. Define CSS custom properties in `src/styles/global.css` for each status color (e.g., `--status-adb`, `--status-fastboot`, etc.)
2. Create a shared module `src/lib/deviceStatus.ts` exporting the canonical `STATUS_CONFIG` using those CSS variables
3. Update both `DeviceSwitcher.tsx` and `ConnectedDevicesCard.tsx` to import from the shared module
4. Remove the duplicate definitions from both files

**Files to create/modify:**
- `src/styles/global.css` (add CSS variables)
- `src/lib/deviceStatus.ts` (new — shared config)
- `src/components/DeviceSwitcher.tsx` (import + remove inline config)
- `src/components/ConnectedDevicesCard.tsx` (import + remove inline config)

**Estimated effort:** ~30 min

---

### C4. `logStore.ts` — `undefined` Assigned to `number`-Typed Field

**Problem:** Line 76:
```ts
set({ isOpen, unreadCount: isOpen ? 0 : undefined } as Partial<LogStore>);
```
`unreadCount` is typed as `number` but `undefined` is assigned when `isOpen` is false. The `as Partial<LogStore>` cast hides the type violation.

**Fix:** Replace with a functional updater that preserves `unreadCount` when closing:
```ts
set((state) => ({ isOpen, unreadCount: isOpen ? 0 : state.unreadCount }));
```

**Files to modify:**
- `src/lib/logStore.ts` (line 76)

**Estimated effort:** ~5 min

---

### C5. Icons in Button Not Using `data-icon`

**Problem:** ~50 instances across all views use manual `className="mr-2 h-4 w-4 shrink-0"` instead of `data-icon="inline-start"` for icons inside buttons.

**Fix:** Gradually replace manual icon sizing with `data-icon="inline-start"`. This is a mechanical refactor — each instance is independent. Prioritize the most visible views first (Dashboard, Flasher, AppManager).

**Files to modify:**
- All view components + shared components with `<Button>` containing icons

**Estimated effort:** ~1-2 hours (mechanical, can be done incrementally)

**Decision:** Include C5 in scope but treat as lowest priority. Can be split into a separate PR if needed.

---

## Scope: High Severity Issues (selected)

### H1. Race Condition in File Navigation

**Problem:** `loadFiles` is async with no request sequencing. Rapid directory navigation can show stale contents because a slower request can resolve after a faster one.

**Fix:** Use a request ID / abort pattern. Increment a counter on each `loadFiles` call; in the `finally`, only apply results if the counter still matches.

**Files to modify:**
- `src/components/views/ViewFileExplorer.tsx` (loadFiles function)

**Estimated effort:** ~30 min

---

### H16. `Loader2` Instead of `Spinner`

**Problem:** ~20 instances across all views use `Loader2 className="animate-spin"` instead of the shadcn `Spinner` component with `data-icon`.

**Fix:** Replace all `Loader2 className="animate-spin"` with `<Spinner data-icon="inline-start" />` or `<Spinner data-icon="inline-end" />` depending on context.

**Files to modify:**
- All views with loading buttons

**Estimated effort:** ~1 hour

---

### H11. EventsOn/Off Global Nuke in PayloadDumper

**Problem:** The cleanup in `ViewPayloadDumper.tsx:122-124` calls `EventsOff('payload:progress')` which removes ALL listeners for that event, not just the one registered by this component.

**Fix:** Use the unlisten function returned by `EventsOn` instead of calling `EventsOff`. This requires `EventsOn` to return the unlisten function (which it already does — `registerEventListener` returns `entry.dispose`).

Current code:
```ts
EventsOn('payload:progress', (data) => { ... });
return () => { EventsOff('payload:progress'); };
```

Fix:
```ts
const unlisten = EventsOn('payload:progress', (data) => { ... });
return unlisten;
```

**Files to modify:**
- `src/components/views/ViewPayloadDumper.tsx` (lines 108-125)

**Estimated effort:** ~5 min

---

## Out of Scope (High issues deferred)

The following High issues are deferred to a future PR because they require deeper refactoring:

| Issue | Reason |
|-------|--------|
| H2 (keyboard shortcut listener churn) | Needs refactoring to use refs — touches FileExplorer hotkeys |
| H3 (DropZone global singleton race) | Architectural change to DropZone registration |
| H4 (install loop not cancellable) | Needs AbortController integration across AppManager |
| H5 (window resize not reactive) | Needs ResizeObserver — touches BottomPanel + MainLayout |
| H6 (inline package filter counts) | Simple useMemo but low impact |
| H7 (ViewFileExplorer is 1567 lines) | Major decomposition — separate PR |
| H9 (force re-render hack) | Needs nicknameStore migration to Zustand |
| H10 (stale closure in handleExtract) | Minor fix but touches extraction flow |
| H12 (per-row ContextMenu) | Architectural change to context menu pattern |
| H13-H15 (TypeScript cast issues) | Minor type safety improvements |
| H17 (forms not using FieldGroup) | Requires form pattern migration |
| H18-H22 (shadcn component replacements) | Incremental shadcn compliance |
| H23-H25 (accessibility/security) | Important but separate concern |

---

## Implementation Order

| Step | Task | Effort |
|------|------|--------|
| 1 | C4 — Fix logStore.ts undefined type | 5 min |
| 2 | H11 — Fix EventsOn/Off global nuke in PayloadDumper | 5 min |
| 3 | C1 — Add ErrorBoundary component | 30 min |
| 4 | C3+H8 — Extract shared STATUS_CONFIG with CSS variables | 30 min |
| 5 | H1 — Add request sequencing to loadFiles | 30 min |
| 6 | C2 — Type the event system in runtime.ts | 1 hour |
| 7 | H16 — Replace Loader2 with Spinner | 1 hour |
| 8 | C5 — Migrate icons to data-icon (if time permits) | 1-2 hours |

Steps 1-2 are trivial quick wins. Steps 3-5 are medium effort. Steps 6-8 are larger mechanical changes.

---

## Pre-Commit Checklist

After all changes:
1. `pnpm format:check` — if fails, `pnpm format`
2. `pnpm lint` — fix any ESLint/clippy errors
3. `pnpm build` — fix any TypeScript errors
4. `cargo test --manifest-path src-tauri/Cargo.toml` — verify Rust tests pass
5. `pnpm tauri build --debug` — verify full build
