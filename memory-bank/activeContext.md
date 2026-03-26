# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-26 — File Explorer: Explicit Multi-Select Mode (Checkbox Gate)

**Final selection model (after three iterations):**
- **Plain click does NOT select** — no accidental selection, no SelectionSummaryBar on click
- **Multi-select mode** (`isMultiSelectMode: boolean`) is an explicit gate that makes the checkbox column visible
- `isMultiSelectMode` activates ONLY via:
  - `Ctrl+Click` — toggles item in selection set, activates mode
  - `Ctrl+A` — selects all items, activates mode  
  - Right-click → **Select** — adds that item to selection, activates mode
- `isMultiSelectMode` deactivates when:
  - `Escape` key (clears selection + exits mode)
  - Clear button in `SelectionSummaryBar`
  - All checkboxes toggled off (`toggleCheckbox` auto-exits when set hits zero)
  - Header checkbox deselect-all (`handleSelectAll` on already-all-selected exits mode)
  - Navigating to a new directory (resets everything)
- `SelectionSummaryBar` is gated on `isMultiSelectMode && selectedNames.size > 0`

**Checkbox column behaviour:**
- `isMultiSelectMode = false`: checkbox column is **completely absent from the DOM** (not just invisible)
- `isMultiSelectMode = true`: header checkbox (select-all / indeterminate) + per-row checkboxes appear
- Checkbox column absent during inline rename (`isBeingRenamed`)

**Context menu (right-click any row):**
```
☑ Select           ← always first; enters multi-select mode + adds item
─────────────────
📂 Open            ← directories/symlinks only
─────────────────
✏  Rename          ← disabled when >1 selected OR row is not the only selection
🗑  Delete          ← smart label: "Delete 3 items" when multi-selecting
─────────────────
⬇  Export          ← disabled when not exactly 1 item selected
```

**Keyboard shortcuts:**
- `Ctrl+Click` — toggle item, enter multi-select mode
- `Ctrl+A` — select all, enter multi-select mode
- `F2` — start inline rename (must be in multi-select mode with exactly 1 item selected)
- `Delete` — open delete confirmation (any selection ≥1)
- `Escape` — cancel rename → then exit multi-select mode + clear selection

**Rename (inline — F2 or right-click only):**
- No click-to-rename (removed — was tied to single-click selection which was removed)
- F2 key → inline Input in place, Enter=confirm, Escape/blur=cancel
- Validation: empty, same name, forbidden chars `/ \ : * ? " < > |`
- On success: `adb shell mv 'old' 'new'` → refresh directory, keep new name selected

**Delete (AlertDialog):**
- Lists up to 5 items with type icons (📁 📄 🔗), then "… and N more"
- On confirm: `adb shell rm -rf 'p1' 'p2' ...` — all paths quoted, single call
- Post-delete: refresh directory, clear selection, exit multi-select mode

### 2026-03-26 — File Explorer: Dual-Pane Navigation + 5 Edge Case Fixes

**Dual-pane layout:**
- New `DirectoryTree` component: lazy-loaded tree showing both files and directories
  - Lazy expansion via `loadDirEntries()` — fetches only when node is first expanded
  - Auto-reveals current path: `expandToPath(currentPath)` sequentially expands ancestors
  - `refreshTrigger` prop: incremented every time right pane refreshes → reloads stale tree
  - Keyboard navigation: `ArrowRight`/`ArrowLeft` to expand/collapse, `Enter`/`Space` to navigate
- Resizable dual-pane (`MIN 180px / DEFAULT 180px / MAX 420px`), horizontal drag-to-resize
- **Editable address bar**: click path → edit as monospace Input, `Enter` navigate, `Escape` cancel
- **Tree collapse**: `PanelLeftClose` in tree header; `PanelLeft` restore in toolbar

**5 Edge Case Fixes:**
1. **Device disconnect → stale data**: `loadFiles` catch clears `fileList`, categorizes error
2. **Permission denied → silent empty**: `list_files` Rust checks for `"permission denied"` before parsing
3. **Symlinks as navigable**: `Symlink` type treated as directory everywhere (tree, double-click, pull)
4. **Spaces in paths**: `list_files` wraps path in single-quotes; escapes embedded `'` via `'\''`
5. **Narrow window / responsive**: tree collapse/expand; button labels hidden on `sm:` breakpoint

**UI State Persistence (localStorage):**
- `fe.currentPath` — saved on every successful `loadFiles`; restored on mount
- `fe.treeCollapsed` — saved on toggle; restored on mount

### 2026-03-23 — GitHub Readiness Audit & Fixes

- CSP: `font-src` + `style-src` for Google Fonts
- `freezePrototype: true` for prototype pollution protection
- `README.md`, `LICENSE` (MIT), CI workflows (`.github/workflows/`)
- `.gitattributes` for LF normalization + Git LFS for ADB binaries
- `.gitignore` added agent/memory dirs

### 2026-03-23 — App Icons & Branding

- 1024×1024px source: `docs/original_icons.png` — 3D glassmorphic terminal icon
- `pnpm tauri icon` → 17 platform icons; `public/logo.png` + `public/favicon.png` synced
- `lib.rs` `.setup()` hook: `window.set_icon(app.default_window_icon())` for taskbar fix

### 2026-03-23 — UI Consistency Audit (~72% → 95%)

- Semantic tokens: `text-success` / `bg-success` (replaced all `[var(--terminal-log-success)]`)
- CardTitle icons: `className="h-5 w-5"` standardized
- shadcn `<Label>` everywhere (removed raw `<label>`)
- `buttonVariants({ variant: 'destructive' })` on all `AlertDialogAction`
- Shared `CheckboxItem`, `EmptyState` components created
- `sidebar-context.ts` extracted for Vite Fast Refresh compliance
- Accessibility: `role`/`aria-*`/`tabIndex`/`onKeyDown` on clickable div lists

### 2026-03-23 — shadcn Sidebar Migration

- Replaced inline sidebar JSX with shadcn `Sidebar` (`collapsible="icon"`)
- `AppSidebar.tsx` with grouped nav (Main/Advanced), SidebarRail, SidebarHeader, SidebarFooter
- `MainLayout.tsx` refactored with `SidebarProvider` + `SidebarInset`
- `Ctrl+B` keyboard shortcut, automatic icon-mode tooltips, mobile sheet support

### 2026-03-23 — VS Code-Style Bottom Panel

- `BottomPanel.tsx` + `LogsPanel.tsx` + `ShellPanel.tsx`
- `logStore.ts` (ring buffer, filter, search), `shellStore.ts`
- 12 terminal CSS variables in `global.css`
- Shell moved from sidebar view to bottom panel tab

---

## Current Verification Evidence

Verified on `main` (2026-03-26 — commits `0d11e84`, `d201f26`, `1beffa0`, `e544d37`):
- `pnpm build` ✅ — TypeScript + Vite bundle
- `pnpm format:check` ✅ — Prettier + cargo fmt clean
- `pnpm lint:web` ✅ — ESLint (0 errors, 0 warnings)
- `pnpm lint:rust` ✅ — cargo clippy -D warnings clean
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL not available in bare test runtime; not a code bug)
- shadcn components installed: `Checkbox`, `ContextMenu`

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | shadcn Sidebar (grouped nav, icon collapse) + 7 views + bottom panel (Logs/Shell tabs) |
| File Explorer | ✅ Enhanced | Dual-pane + explicit multi-select mode + inline rename + delete + context menu + keyboard shortcuts |
| UI Consistency | ✅ Complete | ~95% — semantic tokens, icon sizes, Label, aria roles, shared CheckboxItem/EmptyState |
| Accessibility | ✅ Improved | role/aria/tabIndex/onKeyDown on all interactive elements |
| Backend | ✅ Complete | 28 Tauri commands (added delete_files, rename_file), payload parser |
| IPC Layer | ✅ Complete | backend.ts, runtime.ts, models.ts |
| Bottom Panel | ✅ Complete | VS Code-style with tabs, filter, search, follow, maximize |
| Device Polling | ✅ Complete | TanStack Query replaces all manual setIntervals |
| Clipboard | ✅ Complete | Tauri plugin + shared CopyButton component |
| Linting | ✅ Complete | ESLint 10 flat config + typescript-eslint |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |

---

## Important Patterns & Gotchas

- **`isMultiSelectMode`**: Always the checkbox-column gate. Never show selection UI unless this is `true`.
- **`SelectionSummaryBar`**: Always gated on `isMultiSelectMode && selectedNames.size > 0 && !renamingName`.
- **Plain click**: Does NOT modify `selectedNames`. This is intentional.
- **`buttonVariants({ variant: 'destructive' })`** — used in all `AlertDialogAction` buttons (never inline className).
- **Sidebar**: `sidebar-context.ts` holds all non-component exports — `sidebar.tsx` exports only React components.
- **Shell**: Now in the bottom panel, not a sidebar view.
- **Icon pattern**: `className="h-5 w-5"` (CardTitle), `className="h-4 w-4 shrink-0"` (inline/button).
- **`@/` alias**: All internal imports except `../../lib/desktop/` from views.
- **Rust Edition 2024**: let-chains in use; clippy `-D warnings` always passes.
- **`cargo test` on Windows**: crashes with STATUS_ENTRYPOINT_NOT_FOUND (pre-existing Tauri DLL issue, not a bug in this code).