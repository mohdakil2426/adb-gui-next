# React Doctor Score 100 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use **superpowers:subagent-driven-development** (recommended). Dispatch one focused subagent per task (or small task cluster). Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Do not commit** unless the user later explicitly asks.  
> **Manual app verification:** Use **orca-cli** (`orca` / `ORCA` placeholder per orca-cli skill) for desktop/Tauri UI smoke — not only Vitest.  
> **Do not execute this plan in the writing session** — plan file only until the user says execute.

**Goal:** Drive React Doctor to **100/100** on ADB GUI Next **without breaking any product features**, by fixing real issues and clearing remaining tool flags via use-or-delete (never suppress rules).

**Architecture:** Baseline the current doctor dump → clear remaining **errors** first (impure updaters, effect cleanup, layout animations) → clear **warnings** in safe batches with focused Vitest + `bun run lint:web` + orca UI smokes after each batch → resolve **unused-file / design-kit** flags by either wiring a real import path or deleting dead modules (product-safe choice: prefer **delete unused shadcn files not imported anywhere** unless a near-term UI needs them; if keep, must be reachable from entry so doctor stops flagging) → treat Tauri SPA “hydration” findings as first-paint theme correctness via `useSyncExternalStore` / documented theme bootstrap, not Next SSR patterns → re-run doctor until score **100** and issue count **0**.

**Tech Stack:** React 19 · TypeScript · Vite 8 · Tauri 2 · Zustand · Framer Motion · Vitest · Ultracite · React Doctor (`npx react-doctor@latest`) · Orca CLI for live app smoke.

**Source of truth (analysis):**  
`docs/internal/reports/active/2026-07-18/2026-07-18-react-doctor-full-analysis-audit.md`  
**Latest measured score (after top-3 pass):** **61/100**, ~48 issues remaining (9 errors / 39 warnings).  
**Already in working tree (may be uncommitted):** unused deps removed; BottomPanel/PanelHeader split; resize `tabIndex`; FileExplorer view-model extract. **Task 0 must re-baseline.**

**Hard constraints:**

| Constraint | Rule |
| --- | --- |
| Features | No behavior removal; preserve selection, sort, tree expand, marketplace OAuth poll, payload banner expand, shell/logs resize |
| Commits | **None** during execution unless user explicitly requests |
| False positives | Do not `// eslint-disable` / silence rules; change code so doctor is clean **or** document that a flag is product-required and resolve via structure (use the file, not suppress) |
| Testing | After each task cluster: focused Vitest + `bun run lint:web`; after major UI clusters: **orca** smoke (below) |
| Execution | **Subagents** — one task (or tightly related pair) per subagent; orchestrator reviews before next |

---

## Execution model (subagents + orca)

### Orchestrator responsibilities

1. Run Task 0 baseline; write issue list to a working note in the report folder (optional append to active report).  
2. For each Task N: spawn **subagent** (`general-purpose` or `execute` capability) with the exact task body + constraints.  
3. Review diff: no commits, no drive-by refactors, tests green.  
4. If UI surface touched: run **orca smoke script** for that surface.  
5. Re-run `npx react-doctor@latest . --verbose` after every 1–2 tasks; track score.  
6. Stop on regressions; fix before continuing.

### Orca CLI smoke (mandatory for UI-impacting tasks)

Use orca-cli skill: pick executable once (`orca` / `orca-dev` / `ORCA_CLI_COMMAND`). Placeholder `ORCA` below = that executable.

**Preflight (once per execution session):**

```text
ORCA status --json
ORCA worktree current --json
ORCA terminal list --worktree active --json
```

**Dev app (Tauri + Vite):** open a terminal in the active worktree and run:

```text
ORCA terminal create --worktree active --title "tauri-dev" --command "bun run tauri dev" --json
ORCA terminal wait --terminal <handle> --for exit --timeout-ms 5000 --json
```

Note: `tauri dev` is long-running — do **not** wait for exit. Use:

```text
ORCA terminal create --worktree active --title "tauri-dev" --command "bun run tauri dev" --json
ORCA terminal read --terminal <handle> --json
```

Wait until log shows Vite ready (port **1420**) / window up. Prefer **Computer Use** skill for the **native Tauri window** (accessibility tree / screenshots) when orca embedded browser cannot see the desktop webview. Orca **embedded browser** can smoke pure Vite `http://localhost:1420` if `bun run dev` is enough for the surface:

```text
ORCA terminal create --worktree active --title "vite-dev" --command "bun run dev" --json
ORCA goto --url http://localhost:1420 --json
ORCA snapshot --json
```

**Smoke checklist (after UI batches):**

| Surface | Actions |
| --- | --- |
| Shell | App loads; sidebar switches Dashboard → Files → Payload → Emulator → About |
| Bottom panel | Ctrl+`` ` `` open/close; resize handle focus + ArrowUp/Down; Logs filter + Shell tab |
| File Explorer | List loads; multi-select; sort column; tree expand; root shield toggle (no crash) |
| Marketplace | Open settings / auth UI if visible; no console hang after leave |
| Payload | Load local or empty state; expand FileBanner details without jank |
| Theme | Toggle light/dark once; no crash |

**After each orca smoke:** `ORCA worktree set --worktree active --comment "doctor T<N> done; smoke OK" --json`

---

## File map (expected touches)

| Area | Paths |
| --- | --- |
| Doctor baseline | temp diagnostics folder from latest run; update report if needed |
| Impure updaters | `src/features/file-explorer/hooks/useFileExplorerSelection.ts`, `useFileExplorerSort.ts`, `src/shared/components/DirectoryTree.tsx` |
| Marketplace timer | `src/features/marketplace/hooks/useMarketplaceAuth.ts` |
| Layout animation | `src/features/payload-dumper/ui/FileBanner.tsx` |
| Buttons / main | About, FE toolbar, FileBanner*, `ViewContent.tsx` |
| Keys | LogsPanel, ShellPanel, RootProgressStep, AppDetailView, field.tsx |
| Motion | LoadingScreen, ViewContent, FileBanner, ActionButton (+ optional LazyMotion root) |
| Theme first paint | `ThemeToggle.tsx`, possibly `sidebar.tsx` cookie/state read |
| Context / perf | `toggle-group.tsx`, `payloadDumperStore.ts`, `queries.ts` |
| Shell panel dead state | `ShellPanel.tsx` |
| Module-scope helpers | AboutView, EmulatorRestoreTab, MarketplaceSettings, AttributionFooter |
| WirelessAdb props | `WirelessAdbCard.tsx` |
| Unused inventory | `src/shared/ui/{avatar,command,radio-group,slider,toggle}.tsx` + `platform.ts` `isWindows` |
| Already done (verify) | BottomPanel*, package.json deps, FileExplorer view-model |
| Tests | `src/test/*` matching surfaces; add focused tests when logic changes |
| Verification cmds | `bun run lint:web`, `bun run test`, `npx react-doctor@latest . --verbose` |

---

### Task 0: Baseline — inventory + confirm top-3 status

**Files:**

- Read: working tree + report `docs/internal/reports/active/2026-07-18/2026-07-18-react-doctor-full-analysis-audit.md`
- Write (optional): append “Execution baseline” section to that report

- [ ] **Step 1: Fresh doctor run**

```bash
npx --yes react-doctor@latest . --verbose
```

Expected: score + full diagnostics path printed (note path for later).

- [ ] **Step 2: Confirm top-3 already applied or still open**

Check:

- `package.json` has no `@radix-ui/react-switch`, no `canvas-confetti`
- `BottomPanel.tsx` imports `PanelHeader` and uses `tabIndex={0}` on resize separator
- `FileExplorerView.tsx` is thin and uses `useFileExplorerViewModel`

- [ ] **Step 3: Export issue checklist**

From new `diagnostics.json`, list every remaining `plugin/rule` + file:line. Group into Pass B/C/D matching this plan.

- [ ] **Step 4: Unit/lint baseline**

```bash
bun run lint:web
bun run test
```

Expected: pass (or known pre-existing failures documented — do not ignore new reds).

- [ ] **Step 5: No commit**

Do not commit. Update orca worktree comment: `doctor baseline T0 done`.

---

### Task 1: Errors — pure state updaters (File Explorer selection)

**Problem (plain language):** React may call `setState` updaters twice. If the updater also calls another `setState` or external work, selection can glitch.

**Files:**

- Modify: `src/features/file-explorer/hooks/useFileExplorerSelection.ts` (sites ~74, ~97)
- Test: `src/test/ViewFileExplorer.test.tsx` (extend if needed)

- [ ] **Step 1: Read current handlers**

Open `useFileExplorerSelection.ts`. Find every `setSelectedNames((prev) => { ... setIsMultiSelectMode(...) ...})` or nested setState inside updaters.

- [ ] **Step 2: Rewrite to pure updaters**

Pattern:

```ts
// BAD
setSelectedNames((prev) => {
  setIsMultiSelectMode(true); // side effect in updater
  return next;
});

// GOOD
setIsMultiSelectMode(true);
setSelectedNames((prev) => {
  const next = new Set(prev);
  // only compute next selection
  return next;
});
```

Keep multi-select activation **outside** the Set updater (event handler body).

- [ ] **Step 3: Tests**

```bash
bun vitest run src/test/ViewFileExplorer.test.tsx
```

Expected: PASS. Manually reason: Ctrl+click multi-select still works (orca smoke in Task 10).

- [ ] **Step 4: No commit**

---

### Task 2: Errors — pure state updaters (File Explorer sort)

**Files:**

- Modify: `src/features/file-explorer/hooks/useFileExplorerSort.ts` (~line 55)

- [ ] **Step 1: Read `handleSortColumn`**

Likely pattern: `setSortField` updater also calls `setSortDir`.

- [ ] **Step 2: Split updates**

```ts
// GOOD sketch
const handleSortColumn = useCallback((field: SortField) => {
  setSortField((prev) => {
    if (prev === field) {
      // cannot setSortDir here
      return prev;
    }
    return field;
  });
  // Better: read current field/dir from refs or compute both outside:
  setSortField((prevField) => {
    // pure
  });
}, []);
```

Preferred approach (clearer):

```ts
const handleSortColumn = useCallback(
  (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir('asc');
  },
  [sortField],
);
```

No nested setState inside another updater.

- [ ] **Step 3: Test**

```bash
bun vitest run src/test/ViewFileExplorer.test.tsx
bun run lint:web
```

- [ ] **Step 4: No commit**

---

### Task 3: Errors — pure state updaters (DirectoryTree)

**Files:**

- Modify: `src/shared/components/DirectoryTree.tsx` (~271, ~396)
- Test: `src/test/DirectoryTree.test.tsx`

- [ ] **Step 1: Identify impurity**

Look for updaters that:

- write `nodesRef.current = ...`
- call other setters
- use external mutable flags like `shouldLoad` incorrectly inside updater

- [ ] **Step 2: Move ref sync after setState**

```ts
// BAD
setNodesRaw((prev) => {
  const next = updater(prev);
  nodesRef.current = next; // impure
  return next;
});

// GOOD
setNodesRaw((prev) => updater(prev));
// then in useEffect:
useEffect(() => {
  nodesRef.current = nodes;
}, [nodes]);
```

Or compute `next` in the event handler, then `setNodesRaw(next)` + `nodesRef.current = next` **outside** functional updater (single assignment path).

- [ ] **Step 3: Load-path purity**

If expand triggers load:

```ts
// In event/effect — not inside setState updater:
const node = findNode(nodes, path);
if (node && !node.loaded) {
  void loadChildren(path);
}
setNodes((prev) => markExpanded(prev, path));
```

- [ ] **Step 4: Tests**

```bash
bun vitest run src/test/DirectoryTree.test.tsx
```

Expected: PASS; expand/collapse still works in orca later.

- [ ] **Step 5: No commit**

---

### Task 4: Errors — marketplace auth timer cleanup

**Files:**

- Modify: `src/features/marketplace/hooks/useMarketplaceAuth.ts` (~64)

- [ ] **Step 1: Find setTimeout in useEffect without cleanup**

- [ ] **Step 2: Always clear timer**

```ts
useEffect(() => {
  if (!shouldPoll) {
    return;
  }
  const id = window.setTimeout(() => {
    void pollOnce();
  }, delayMs);
  return () => {
    window.clearTimeout(id);
  };
}, [shouldPoll, delayMs /* stable deps only */]);
```

Do not leave dangling polls after unmount or when user leaves Marketplace.

- [ ] **Step 3: Lint + any marketplace tests**

```bash
bun run lint:web
bun vitest run src/test/ViewMarketplace.test.tsx src/test/marketplaceStore.test.ts
```

- [ ] **Step 4: No commit**

---

### Task 5: Errors — FileBanner layout animation

**Files:**

- Modify: `src/features/payload-dumper/ui/FileBanner.tsx` (~185–188)
- Related: `FileBannerDetails.tsx` if animation owned there

**Rule:** Do not animate CSS **height** (layout thrash). Prefer `transform` / `opacity` / grid `0fr`→`1fr` pattern without layout properties doctor flags.

- [ ] **Step 1: Read motion props**

Find `animate={{ height: ... }}` or similar.

- [ ] **Step 2: Replace with non-layout animation**

Example approach:

```tsx
// Prefer opacity + transform, or AnimatePresence with max-height only if doctor allows;
// safest: use grid-template-rows transition via class:
// className={cn(open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
// with overflow-hidden on inner — if still flagged, use opacity-only expand.
```

If product needs expand: measure once and animate **scaleY** from top with `transformOrigin: 'top'`, not height.

- [ ] **Step 3: Visual check**

```bash
bun vitest run src/test/RemoteLoadProgressCard.test.tsx
```

Plus orca: open Payload view, expand banner details.

- [ ] **Step 4: Doctor spot-check**

```bash
npx --yes react-doctor@latest . --verbose
```

Expected: `no-layout-property-animation` count **0**.

- [ ] **Step 5: No commit**

---

### Task 6: Doctor mid-run gate (errors = 0)

- [ ] **Step 1: Full doctor**

```bash
npx --yes react-doctor@latest . --verbose
```

Expected: **0 errors**. Score should jump well above 61.

- [ ] **Step 2: Full unit + lint**

```bash
bun run lint:web
bun run test
```

- [ ] **Step 3: Orca smoke (errors batch)**

Start Vite or Tauri; exercise File Explorer multi-select + sort + tree expand; Marketplace open/close; Payload banner expand.

- [ ] **Step 4: No commit**

---

### Task 7: Accessibility / buttons / main landmark

**Files (from baseline list; re-check after Task 0):**

- `src/features/about/AboutView.tsx`
- `src/features/file-explorer/ui/FileExplorerToolbar.tsx`
- `src/features/payload-dumper/ui/FileBanner.tsx`
- `src/features/payload-dumper/ui/FileBannerDetails.tsx`
- `src/app/shell/ViewContent.tsx` (`role="main"` → `<main>`)

- [ ] **Step 1: Add `type="button"`** to every bare `<button>` that is not a submit control.

```tsx
<button type="button" ...>
```

- [ ] **Step 2: Prefer semantic main**

```tsx
// Before
<div role="main" ...>

// After
<main ...>
```

Preserve same classes/ids.

- [ ] **Step 3: Tests + lint**

```bash
bun run lint:web
bun vitest run src/test/ViewDashboard.test.tsx src/test/ViewFileExplorer.test.tsx
```

- [ ] **Step 4: No commit**

---

### Task 8: Stable list keys (no array index where order can change)

**Files:**

- `src/app/shell/BottomPanel/LogsPanel.tsx`
- `src/app/shell/BottomPanel/ShellPanel.tsx`
- `src/features/emulator/ui/RootProgressStep.tsx`
- `src/features/marketplace/ui/AppDetailView.tsx`
- `src/shared/ui/field.tsx` (only if dynamic list)

- [ ] **Step 1: Prefer stable ids**

```tsx
// Logs already have id field in store — use log.id
key={log.id}

// Shell history: use `${index}-${command}` only if immutable append-only;
// better: assign id when pushing history entries
```

- [ ] **Step 2: If history has no id, add id at write site** in `shellStore` when pushing commands (do not break history UX).

- [ ] **Step 3: Tests**

```bash
bun vitest run src/test/BottomPanel.test.tsx src/test/shellStore.test.ts
```

- [ ] **Step 4: No commit**

---

### Task 9: Performance — LazyMotion, store lookups, queries, ShellPanel dead state

**Files:**

- `src/app/shell/LoadingScreen.tsx`
- `src/app/shell/ViewContent.tsx`
- `src/features/payload-dumper/ui/FileBanner.tsx`
- `src/shared/components/ActionButton.tsx`
- Optional root: `src/app/App.tsx` or `MainLayout.tsx` for single `LazyMotion` provider
- `src/features/payload-dumper/model/payloadDumperStore.ts` (~248)
- `src/shared/utils/queries.ts` (~63, ~71)
- `src/app/shell/BottomPanel/ShellPanel.tsx` (`historyIndex` set but unused)

- [ ] **Step 1: LazyMotion pattern**

```tsx
import { LazyMotion, domAnimation, m } from 'framer-motion';

// Once near app shell:
<LazyMotion features={domAnimation} strict>
  {children}
</LazyMotion>

// Replace motion.div with m.div in leaf components; stop importing { motion }
```

Do **one** provider; do not nest conflicting loaders.

- [ ] **Step 2: Set/Map for membership**

```ts
const selected = new Set(selectedPartitions);
// instead of array.includes inside loop
```

- [ ] **Step 3: Single-pass device merge** in `fetchAllDevices` (filter+map → one loop).

- [ ] **Step 4: ShellPanel** — remove dead `historyIndex` state or actually use it for up/down history navigation (prefer **wire correctly** if product expects shell history keys).

- [ ] **Step 5: Verify**

```bash
bun run lint:web
bun run test
npx --yes react-doctor@latest . --verbose
```

- [ ] **Step 6: No commit**

---

### Task 10: Theme first-paint + sidebar store flicker (Tauri-safe)

**Files:**

- `src/shared/components/ThemeToggle.tsx`
- `src/shared/ui/sidebar.tsx` (~567 area)

**Intent:** Eliminate doctor `rendering-hydration-no-flicker` without inventing SSR. Read theme/sidebar cookie or storage **before** paint via `useSyncExternalStore` or inline script already used by next-themes.

- [ ] **Step 1: Prefer useSyncExternalStore for client-only UI state** that previously used `useEffect(() => setState(...), [])`.

- [ ] **Step 2: Keep next-themes provider** — do not break light/dark/system cycle.

- [ ] **Step 3: Orca smoke**

Toggle theme twice; refresh Vite page if browser path; confirm no crash.

- [ ] **Step 4: Doctor**

```bash
npx --yes react-doctor@latest . --verbose
```

Expected: hydration-no-flicker **0**.

- [ ] **Step 5: No commit**

---

### Task 11: Module-scope pure helpers + WirelessAdb prop design

**Files:**

- `src/features/about/AboutView.tsx` (`openLink`)
- `src/features/emulator/ui/EmulatorRestoreTab.tsx`
- `src/features/marketplace/ui/MarketplaceSettings.tsx`
- `src/features/marketplace/ui/AttributionFooter.tsx` (`providerLinks`)
- `src/features/dashboard/ui/WirelessAdbCard.tsx` (boolean props / variants)

- [ ] **Step 1: Move pure functions / static arrays to module scope**

```ts
// outside component
function openExternal(url: string) { ... }

const PROVIDER_LINKS = [ ... ] as const;
```

- [ ] **Step 2: WirelessAdbCard** — reduce boolean explosion with a small status union or grouped props object **without** changing parent behavior:

```ts
type ConnectionBusy = {
  connecting: boolean;
  disconnecting: boolean;
  enablingTcpip: boolean;
};
```

Keep existing call sites working via adapter if needed.

- [ ] **Step 3: Tests**

```bash
bun vitest run src/test/ViewDashboard.test.tsx
```

- [ ] **Step 4: No commit**

---

### Task 12: Unused files / exports — use or delete (required for 100)

Doctor flags unused modules. **100 requires zero unused-file/export hits.** Product rule for this plan:

| Module | Decision for score 100 |
| --- | --- |
| `src/shared/ui/avatar.tsx` | **Delete** if zero imports; else wire one real UI use |
| `src/shared/ui/slider.tsx` | **Delete** if zero imports |
| `src/shared/ui/radio-group.tsx` | **Delete** if zero imports |
| `src/shared/ui/toggle.tsx` | **Delete** only if nothing imports it (toggle-group may use variants only — verify) |
| `src/shared/ui/command.tsx` | Grep entire repo; **delete** if unused, **or** restore one legitimate cmdk surface with `shouldFilter={false}` rules if product needs search palette |
| `src/shared/utils/platform.ts` `isWindows` | Remove export **or** use it where Windows-only UI exists |

- [ ] **Step 1: Grep each path for imports**

```bash
# example
# search for '@/shared/ui/avatar' etc. across src
```

- [ ] **Step 2: Delete or wire** — prefer delete for true dead kit to hit 100 without fake “usage”.

- [ ] **Step 3: Ensure no broken barrels**

- [ ] **Step 4: lint + test + doctor**

```bash
bun run lint:web
bun run test
npx --yes react-doctor@latest . --verbose
```

- [ ] **Step 5: No commit**

---

### Task 13: Remaining stragglers + async-await-in-loop

**Files:**

- `src/features/app-manager/debloater/ui/InstallationTab.tsx` (~150) sequential awaits
- Any leftover from latest doctor dump

- [ ] **Step 1: Parallelize only when safe**

```ts
// If installs must be serial for device stability, keep serial but structure so doctor is happy
// only if sequential is required for adb — document and use a for-loop without false parallelization
// Prefer: Promise.all only for independent work; for adb install batch, serial may be CORRECT.
// If doctor still flags serial adb installs, extract helper `async function installAllSerial(paths)` 
// and verify if rule still fires; if required serial, leave serial and re-check doctor version behavior.
```

**Product safety:** Multi APK install on one device should stay **serial** if concurrent adb install races. Prefer **keeping serial** for correctness; if doctor still errors, check whether severity is warning only and fix other remaining issues first.

- [ ] **Step 2: Exhaustive-deps leftovers** on DirectoryTree `getFileAccessMode` — stabilize with `useCallback` deps on `rootAccessGranted` / ref pattern already used in FE.

- [ ] **Step 3: Doctor until empty**

```bash
npx --yes react-doctor@latest . --verbose
```

Expected: **100/100**, **0 issues**.

- [ ] **Step 4: No commit**

---

### Task 14: Full verification gate (no score claim without evidence)

- [ ] **Step 1: Automated**

```bash
bun run lint:web
bun run test
bun run build
npx --yes react-doctor@latest . --verbose
```

Expected:

- lint clean  
- tests all pass  
- build succeeds  
- doctor **100/100** and **0 issues** (paste score line into report)

- [ ] **Step 2: Orca / Computer Use full smoke**

| # | Action | Pass criteria |
|---|--------|----------------|
| 1 | App starts (`tauri dev` or Vite) | Window/page visible |
| 2 | Navigate all 9 sidebar views | No crash/blank main |
| 3 | Bottom panel open/resize/filter | Resize keyboard works; filter works |
| 4 | File Explorer list/select/sort/tree | No selection glitch |
| 5 | Theme toggle | Both themes render |
| 6 | Payload banner expand | No layout thrash/crash |
| 7 | Marketplace open settings | No stuck timers after leave |

- [ ] **Step 3: Update memory-bank** (only if user asked in execution phase)

Set React Doctor backlog to **closed** only after 100 proven.

- [ ] **Step 4: No commit** (unless user asks)

---

## Subagent dispatch matrix (for execute phase)

| Task | Subagent focus | Parallel? |
| --- | --- | --- |
| 0 | Orchestrator only | — |
| 1–3 | FE impure updaters (can be 3 sequential agents; 1+2 parallel OK if no file clash) | 1 \|\| 2; then 3 |
| 4 | Marketplace auth | alone |
| 5 | FileBanner motion | alone |
| 6 | Orchestrator gate | — |
| 7 | a11y buttons/main | alone |
| 8 | keys | alone |
| 9 | motion/perf | alone |
| 10 | theme | alone |
| 11 | module-scope / WirelessAdb | alone |
| 12 | unused files | alone (careful) |
| 13 | leftovers | alone |
| 14 | Orchestrator + orca | — |

---

## Risk register

| Risk | Mitigation |
| --- | --- |
| Serial APK install “optimized” into parallel | Keep serial for device safety |
| Deleting shadcn file still needed later | Grep first; prefer delete only if zero imports |
| LazyMotion breaks animations | One provider; visual smoke |
| Theme store change flashes worse | Compare before/after; use sync external store |
| Orca cannot see Tauri webview | Use Computer Use on desktop window or Vite-only smoke for DOM surfaces |

---

## Success criteria

1. `npx react-doctor@latest . --verbose` → **100/100**, **0 issues** (command output saved).  
2. `bun run lint:web`, `bun run test`, `bun run build` green.  
3. Orca/Computer Use smoke checklist all pass.  
4. **No commits** unless user requests.  
5. No rule suppressions; no feature regressions.

---

## Self-review (plan author)

| Check | Status |
| --- | --- |
| Spec: score 100 without breaking features | Covered Tasks 1–14 + orca |
| Subagents | Execution model + matrix |
| Orca testing | Preflight, dev servers, smoke table |
| No commits | Explicit every task |
| Placeholder scan | No TBD; concrete paths/commands |
| Top-3 already done | Task 0 baseline handles |

---

**Plan only — do not execute until the user says to run it.**
