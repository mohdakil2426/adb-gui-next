# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-26 — File Explorer: Major UX Enhancements + Bug Fixes

A comprehensive upgrade of `ViewFileExplorer.tsx` (~1520 lines), `files.rs`, `models.ts`, and `backend.ts`.

#### New Features

**Create File / Create Folder:**
- Inline "phantom row" input at the top of the file list (consistent with rename UX)
- Keyboard shortcuts: `Ctrl+N` (New File), `Ctrl+Shift+N` (New Folder)
- Context menu on empty space: "New File" / "New Folder" entries with shortcut hints
- Empty directory state: "New File" + "New Folder" quick-action buttons shown inline
- Validation: `FORBIDDEN_CHARS` regex, `RESERVED_NAMES` regex, empty-name guard
- Backend: `create_file` (`adb shell touch`) + `create_directory` (`adb shell mkdir -p`) in `files.rs`
- Registered in `lib.rs` + wrapped in `backend.ts`

**Context Menu — Import/Export + Copy Path:**
- Right-click folder → "Import into [folder]" pushes file directly into that dir
- Right-click file → "Export" pulls that exact item, no selection required
- Right-click any item → "Copy Path" → `navigator.clipboard.writeText()` with full Android path

**Back / Forward Navigation History:**
- `navHistory: string[]` stack (max 50 entries) + `historyIndex: number`
- `historyIndexRef = useRef(0)` keeps ref in sync for use inside `loadFiles` closure
- `← Back` + `→ Forward` toolbar buttons with `Alt+←` / `Alt+→` keyboard shortcuts
- Correct browser-style behavior: navigating cuts forward history
- `loadFiles(path, pushToHistory = true)` — refresh (`false`) never writes history

**Search / Filter:**
- Inline search `<Input>` in toolbar; expands on focus (w-32 → w-48 CSS transition)
- `Ctrl+F` to focus search input (id: `fe-search-input`)
- `Escape` clears search (priority: create → rename → search → selection)
- Client-side filter via `visibleList = sortEntries(filteredFileList, field, dir)`
- "No files match …" empty row shown when filter yields 0 results

**Sortable Columns:**
- Clickable Name / Size / Date column headers with sort indicator chevrons
- `sortEntries(entries, field, dir)` pure function — directories always float above files
- Size column: integer-aware comparison; date: lexically sortable ISO format `YYYY-MM-DD HH:MM`

**Human-Readable File Sizes:**
- `formatBytes(raw: string)` helper: `0 B` / `14.0 MB` / `1.2 GB`
- Directories show `—` instead of raw block size bytes
- Size cell styled `tabular-nums text-right text-xs text-muted-foreground`

**Symlink Target Display:**
- `parse_file_entries` splits `name -> /target` and stores both separately
- `FileEntry` gets `link_target: String` (Rust) / `linkTarget: string` (TS model)
- Symlink rows show `→ /target/path` as a tiny faint subtitle under the name

#### Bug Fixes

**Infinite Render Loop (critical — 50+ ADB calls/sec, screen jam):**
- Root cause: `loadFiles` in `useCallback([historyIndex])` called `setHistoryIndex` → changed `historyIndex` → new loadFiles reference → `useEffect([activeView, loadFiles])` re-fired → infinite loop
- Fix: `loadFiles` deps changed to `[]`; reads `historyIndexRef.current` (not stale closure value); updates ref + state atomically on history push

**Back/Forward Black Screen:**
- Root cause: `handleGoBack/Forward` called `setHistoryIndex` (async) then used stale `navHistory` snapshot
- Fix: both handlers read `historyIndexRef.current` synchronously, compute target path via `setNavHistory` updater (always receives latest state)

**Empty Directory Creation Not Working:**
- Root cause: `fileList.length === 0` condition showed empty state even when `creatingType !== null`, hiding the phantom row table branch
- Fix: condition changed to `fileList.length === 0 && creatingType === null`

**DRY Refactor:**
- `executePull(file)` shared helper replaces 3 duplicated pull implementations
- `executePush(localPath, targetDir)` shared helper replaces 3 duplicated push implementations

---

### 2026-03-26 — File Explorer: Explicit Multi-Select Mode (Checkbox Gate)

**Final selection model:**
- Plain click does NOT select — no accidental selection
- `isMultiSelectMode` gates checkbox column visibility
- Activated ONLY via: `Ctrl+Click`, `Ctrl+A`, right-click → Select
- Deactivated: `Escape`, Clear, uncheck-all, header deselect-all, navigation

**Full Keyboard Shortcut Map:**
- `Ctrl+Click` — toggle item, enter multi-select mode
- `Ctrl+A` — select all
- `F2` — inline rename (single selection)
- `Delete` — delete confirmation dialog
- `Ctrl+N` — New File (phantom row)
- `Ctrl+Shift+N` — New Folder (phantom row)
- `Ctrl+F` — focus search input
- `Alt+←` — Go Back in nav history
- `Alt+→` — Go Forward in nav history
- `Escape` — cancel create → cancel rename → clear search → clear selection

**Context menu (right-click row):**
```
☑ Select           ← always first; enters multi-select mode + adds item
📋 Copy Path       ← copies full Android path to clipboard
─────────────────
📂 Open            ← directories/symlinks only
─────────────────
✏  Rename          ← disabled when >1 selected
🗑  Delete          ← smart label: "Delete 3 items" when multi-selecting
─────────────────
⬆  Import          ← context-aware: "Import into [folder]" or "Import File"
⬇  Export          ← pulls this exact row directly (no selection needed)
```

---

### 2026-03-26 — File Explorer: Dual-Pane Navigation + Edge Cases

- `DirectoryTree` component: lazy-loaded tree, auto-reveal, keyboard nav
- Resizable dual-pane (180px–420px), editable address bar, localStorage persistence
- 5 edge cases: permission denied, spaces in paths, symlinks, device disconnect, responsive

---

## Current Verification Evidence

Verified (2026-03-26):
- `pnpm build` ✅ — TypeScript + Vite bundle clean
- `pnpm format` ✅ — Prettier + cargo fmt clean
- `pnpm lint` ✅ — ESLint + cargo clippy -D warnings (0 errors, 0 warnings)
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL — not a code bug)

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | shadcn Sidebar + 7 views + bottom panel |
| File Explorer | ✅ Enhanced | Full CRUD, dual-pane, history, search, sort, human sizes, symlink targets, copy path |
| Backend | ✅ Complete | 30 Tauri commands (added `create_file`, `create_directory`) |
| IPC Layer | ✅ Complete | `backend.ts` + `models.ts` (FileEntry + linkTarget) |
| Linting | ✅ Complete | ESLint 10 flat config + cargo clippy -D warnings |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |

---

## Critical Patterns & Gotchas

- **`loadFiles` MUST have `[]` deps** — uses `historyIndexRef.current`. Adding `historyIndex` causes an infinite render loop (50+ ADB calls/sec).
- **`fileList.length === 0 && creatingType === null`** — the empty-state condition. Missing `creatingType === null` breaks inline creation in empty directories.
- **`pushToHistory = false`** for refresh/back/forward; `true` (default) for user navigation.
- **`isMultiSelectMode`**: Always the checkbox-column gate. Never show selection UI unless `true`.
- **`buttonVariants({ variant: 'destructive' })`** — all `AlertDialogAction` buttons.
- **Sidebar**: `sidebar-context.ts` holds all non-component exports (Vite Fast Refresh).
- **Shell**: In bottom panel, not a sidebar view.
- **Icon pattern**: `h-5 w-5` (CardTitle), `h-4 w-4 shrink-0` (inline/button).
- **`cargo test` on Windows**: STATUS_ENTRYPOINT_NOT_FOUND — pre-existing Tauri DLL issue, not a code bug.