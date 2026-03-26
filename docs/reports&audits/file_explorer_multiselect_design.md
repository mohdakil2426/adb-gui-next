# File Explorer — Multi-Select, Delete & Rename
**Design Document · Brainstorm Output**
_ADB GUI Next · 2026-03-26_

---

## Understanding Summary

| Item | Detail |
|------|--------|
| **What** | Multi-selection, delete (bulk), rename (single) in ViewFileExplorer |
| **Why** | File management is incomplete — users can push/pull but can't clean up or rename on-device |
| **Who** | Android power users, ROM flashers, QA engineers |
| **Key constraints** | ADB `rm -rf` + `mv`; no undo; paths need quoting; no batch rename |
| **Non-goals** | Cut/copy/paste, batch rename, drag-drop, recycle bin / undo |

---

## Assumptions

| ID | Assumption |
|----|-----------|
| A1 | Rename = same directory, new name only (no cross-dir move) |
| A2 | Delete uses `adb shell rm -rf` for all types — files, dirs, symlinks |
| A3 | Ctrl+Click multi-select is P0; Shift+Click range is P1 |
| A4 | Right-click ContextMenu is the primary rename discovery path |
| A5 | Two new Rust commands needed: `delete_files`, `rename_file` |
| A6 | `SelectionSummaryBar` shared component reused for the selection bar |

---

## Design Approaches Considered

### Option A — Checkbox-first (RECOMMENDED)
Add a leading checkbox column to the table. Each row has a checkbox.
Header checkbox = select all / deselect all (indeterminate state).
Click = single select; Ctrl+Click = multi; Shift+Click = range.
Context menu opens on right-click with Rename + Delete.

**Pros:** Familiar Windows Explorer / macOS Finder pattern. Discoverable. Works on narrow windows. Accessible (keyboard navigable).
**Cons:** Adds one column — slightly reduces name column width.

### Option B — Click-to-toggle (no checkboxes)
Click selects/deselects without checkboxes. Selected rows show bold border.

**Pros:** Cleaner visually.
**Cons:** Not discoverable. Users don't know they can multi-select. No "select all" header affordance.

### Option C — Toolbar-only actions
No checkboxes, no context menu. Actions only in toolbar buttons.

**Cons:** Violates desktop file manager conventions. Rejected.

---

## Final Design: Option A (Checkbox-first)

---

## ASCII Wireframes

### 1 — Normal State (no selection)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [≡] /sdcard/DCIM/Camera/  [↑]       [⟳] [⬆ Import ▾] [⬇ Export]       │
├────────────────────────────────────────────────────────────────────────-┤
│  ☐  │ 🗂  Name              │ Size    │ Date       │ Time               │
├─────┼──────────────────────┼─────────┼────────────┼────────────────────┤
│  ☐  │ 📁 Camera            │  —      │ 2024-12-01 │ 14:22              │
│  ☐  │ 📁 Screenshots       │  —      │ 2025-01-15 │ 09:11              │
│  ☐  │ 📄 README.md         │ 2.1 KB  │ 2025-03-20 │ 18:44              │
│  ☐  │ 📄 photo_01.jpg      │ 3.2 MB  │ 2025-03-22 │ 11:01              │
│  ☐  │ 🔗 link              │  —      │ 2025-01-01 │ 00:00              │
└─────┴──────────────────────┴─────────┴────────────┴────────────────────┘
  Export disabled when nothing selected.
```

### 2 — Multi-Selection Active (3 items selected)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [≡] /sdcard/DCIM/Camera/  [↑]       [⟳] [⬆ Import ▾] [⬇ Export]       │
├─────────────────────────────────────────────────────────────────────────┤
│  3 items selected                     [✕ Deselect All]  [🗑 Delete]     │
│─────────────────────────────────────────────────────────────────────────│
│  ☑  │ 🗂  Name              │ Size    │ Date       │ Time               │
├─────┼──────────────────────┼─────────┼────────────┼────────────────────┤
│  ☐  │ 📁 Camera            │  —      │ 2024-12-01 │ 14:22              │
│  ☑  │ 📁 Screenshots       │  —      │ 2025-01-15 │ 09:11  ◀ selected │
│  ☐  │ 📄 README.md         │ 2.1 KB  │ 2025-03-20 │ 18:44              │
│  ☑  │ 📄 photo_01.jpg      │ 3.2 MB  │ 2025-03-22 │ 11:01  ◀ selected │
│  ☑  │ 🔗 link              │  —      │ 2025-01-01 │ 00:00  ◀ selected │
└─────┴──────────────────────┴─────────┴────────────┴────────────────────┘
  Export disabled when >1 selected. Rename disabled when >1 selected.
  SelectionSummaryBar sits between toolbar and table header.
```

### 3 — Right-Click Context Menu

```
  Single item right-clicked:
  ┌──────────────────────────────┐
  │  📂 Open (navigate into)     │  ← only for dirs/symlinks
  │  ─────────────────────────── │
  │  ✏  Rename                   │  ← enabled only when 1 item selected
  │  🗑  Delete                   │
  │  ─────────────────────────── │
  │  ⬇  Export                   │
  └──────────────────────────────┘

  Row right-clicked when 3 items already selected:
  ┌──────────────────────────────┐
  │  ✏  Rename        (disabled) │  ← needs exactly 1
  │  🗑  Delete 3 items           │  ← shows count from selectedNames.size
  │  ─────────────────────────── │
  │  ⬇  Export         (disabled) │  ← needs exactly 1
  └──────────────────────────────┘
```

### 4 — Rename Dialog

```
  ┌─────────────────────────────────────────────────────┐
  │  ✏ Rename                                      [×] │
  │  ───────────────────────────────────────────────── │
  │  Rename "photo_01.jpg" to:                         │
  │                                                    │
  │  ┌──────────────────────────────────────────────┐  │
  │  │ photo_01.jpg                  (all selected) │  │
  │  └──────────────────────────────────────────────┘  │
  │                                                    │
  │  ⓘ  Renames in /sdcard/DCIM/Camera/               │
  │                                                    │
  │                          [Cancel]  [✏ Rename]      │
  └─────────────────────────────────────────────────────┘

  Validation:
  • Cannot be empty → Rename button disabled
  • Cannot match current name → Rename button disabled
  • Forbidden chars: / \ : * ? " < > | → inline error shown
  • Enter = confirm; Escape = cancel
```

### 5 — Delete Confirmation Dialog

```
  Single item:
  ┌─────────────────────────────────────────────────────┐
  │  Delete "photo_01.jpg"?                        [×] │
  │  ───────────────────────────────────────────────── │
  │  This will permanently delete the file from the   │
  │  device. This action cannot be undone.             │
  │                                                    │
  │                    [Cancel]  [🗑 Delete permanently] │
  └─────────────────────────────────────────────────────┘

  Multiple items (N ≤ 5 listed, else "... and N more"):
  ┌─────────────────────────────────────────────────────┐
  │  Delete 3 items?                               [×] │
  │  ───────────────────────────────────────────────── │
  │  Permanently deletes these items from the device.  │
  │  This action cannot be undone.                     │
  │                                                    │
  │    📁  Screenshots/                                 │
  │    📄  photo_01.jpg                                 │
  │    🔗  link                                         │
  │                                                    │
  │                    [Cancel]  [🗑 Delete permanently] │
  └─────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### State Changes in `ViewFileExplorer.tsx`

```ts
// BEFORE
const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

// AFTER
const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
const [lastClickedName, setLastClickedName] = useState<string | null>(null);
const [isDeleting, setIsDeleting] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [renameDialogOpen, setRenameDialogOpen] = useState(false);
const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
const [renameValue, setRenameValue] = useState('');
const [renameError, setRenameError] = useState('');
```

### New Handlers

```ts
// Click row body: plain = single-select, Ctrl = toggle, Shift = range
handleRowClick(file: FileEntry, e: React.MouseEvent)

// Checkbox cell click (always toggles, no single-select-clear)
toggleOne(name: string)

// Header checkbox
handleSelectAll()  // select all if none/partial selected; deselect all if all selected

// Opens delete AlertDialog
handleDeleteClick()

// Calls DeleteFiles backend, clears selection on success
handleConfirmDelete()

// Opens rename Dialog for a single file
handleRenameOpen(file: FileEntry)

// Validates + calls RenameFile backend
handleConfirmRename()
```

### Table Header Checkbox (indeterminate state)

```tsx
<TableHead className="w-10 pl-3">
  <Checkbox
    checked={
      fileList.length > 0 && selectedNames.size === fileList.length
        ? true
        : selectedNames.size > 0
        ? 'indeterminate'
        : false
    }
    onCheckedChange={handleSelectAll}
    aria-label="Select all"
  />
</TableHead>
```

### SelectionSummaryBar Usage

Reuse the existing shared component:

```tsx
{selectedNames.size > 0 && (
  <SelectionSummaryBar
    count={selectedNames.size}
    label={selectedNames.size === 1 ? 'item selected' : 'items selected'}
    onClear={() => {
      setSelectedNames(new Set());
      setLastClickedName(null);
    }}
    actions={
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDeleteClick}
        disabled={isDeleting}
      >
        <Trash2 className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Delete</span>
      </Button>
    }
  />
)}
```

### ContextMenu on TableRow

```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <TableRow
      key={file.name}
      data-state={selectedNames.has(file.name) ? 'selected' : ''}
      onClick={(e) => handleRowClick(file, e)}
      className="cursor-pointer"
    >
      ...
    </TableRow>
  </ContextMenuTrigger>
  <ContextMenuContent>
    {isNavigable && (
      <>
        <ContextMenuItem onClick={() => loadFiles(joinedPath)}>
          <FolderOpen className="h-4 w-4 shrink-0" />
          Open
        </ContextMenuItem>
        <ContextMenuSeparator />
      </>
    )}
    <ContextMenuItem
      disabled={selectedNames.size > 1}
      onClick={() => handleRenameOpen(
        selectedNames.size === 1
          ? fileList.find(f => selectedNames.has(f.name))!
          : file
      )}
    >
      <Pencil className="h-4 w-4 shrink-0" />
      Rename
    </ContextMenuItem>
    <ContextMenuItem
      className="text-destructive focus:text-destructive"
      onClick={handleDeleteClick}
    >
      <Trash2 className="h-4 w-4 shrink-0" />
      {selectedNames.size > 1 ? `Delete ${selectedNames.size} items` : 'Delete'}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem
      disabled={selectedNames.size !== 1}
      onClick={handlePull}
    >
      <Download className="h-4 w-4 shrink-0" />
      Export
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

---

## Backend — `commands/files.rs` additions

### `delete_files`

```rust
#[tauri::command]
pub fn delete_files(app: AppHandle, paths: Vec<String>) -> CmdResult<String> {
    if paths.is_empty() {
        return Err("No paths provided".into());
    }
    // Quote each path: 'path' with '' -> '\'' escaping
    let mut args = vec!["shell", "rm", "-rf"];
    let quoted: Vec<String> = paths
        .iter()
        .map(|p| format!("'{}'", p.trim().replace('\'', r"'\''")))
        .collect();
    // Pass all quoted paths as a single shell command string
    let cmd = format!("rm -rf {}", quoted.join(" "));
    let count = paths.len();
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Deleted {} item(s)", count))
}
```

### `rename_file`

```rust
#[tauri::command]
pub fn rename_file(app: AppHandle, old_path: String, new_path: String) -> CmdResult<String> {
    let old_q = format!("'{}'", old_path.trim().replace('\'', r"'\''")));
    let new_q = format!("'{}'", new_path.trim().replace('\'', r"'\''")));
    run_binary_command(&app, "adb", &["shell", "mv", &old_q, &new_q])?;
    Ok(format!("Renamed to {}", new_path.trim()))
}
```

### `backend.ts` additions

```ts
export function DeleteFiles(paths: string[]): Promise<string> {
  return call('delete_files', { paths });
}

export function RenameFile(oldPath: string, newPath: string): Promise<string> {
  return call('rename_file', { oldPath, newPath });
}
```

---

## Data Flow

### Multi-Select → Delete

```
Ctrl+click rows → selectedNames Set updated
  → SelectionSummaryBar appears with Delete button
  → User clicks Delete (or right-click → Delete)
  → deleteDialogOpen = true
  → Dialog shows item list (max 5 + "N more")
  → User clicks "Delete permanently"
  → setIsDeleting(true)
  → DeleteFiles(selectedPaths) called
  → Rust: adb shell rm -rf 'p1' 'p2' ...
  → toast.success("Deleted N items")
  → loadFiles(currentPath)     ← refresh table
  → setSelectedNames(new Set()) ← clear selection
  → setIsDeleting(false)
```

### Single-Item Rename

```
Right-click → Rename (or F2 with 1 item selected)
  → handleRenameOpen(file)
  → renameTarget = file; renameValue = file.name
  → renameDialogOpen = true  (entire text auto-selected)
  → User edits → clicks Rename or presses Enter
  → Frontend validates (not empty, no forbidden chars, not same)
  → RenameFile(oldPath, newPath) called
  → Rust: adb shell mv 'old' 'new'
  → toast.success("Renamed to new_name")
  → loadFiles(currentPath)
  → renameDialogOpen = false
```

---

## Error Handling

| Scenario | Handling |
|---------|---------|
| Partial delete failure | Rust returns error string → toast.error with output |
| Rename to existing name | `mv` fails → Rust error → toast.error |
| Rename empty or invalid | Frontend disabled Rename button + inline error text |
| Delete protected file | `rm -rf` fails → Rust returns stderr → toast.error |
| Device disconnect mid-op | ADB error → categorize → toast.error + refresh |

---

## Keyboard Shortcuts (Phase 2)

| Key | Action |
|-----|--------|
| `Ctrl+A` | Select all |
| `F2` | Open rename (when exactly 1 selected) |
| `Delete` | Open delete confirmation (when ≥1 selected) |
| `Escape` | Clear selection |
| `Shift+Click` | Range select from last clicked |

---

## Disabled State Logic

| Condition | Export | Rename (menu) | Delete |
|-----------|--------|---------------|--------|
| 0 selected | Disabled | Disabled | Hidden |
| 1 selected | Enabled | Enabled | Shown |
| 2+ selected | Disabled + tooltip | Disabled | Shown (count) |

---

## Shadcn Components Needed

| Component | Already installed? | Action if missing |
|-----------|-------------------|-------------------|
| `Checkbox` | Check `ui/checkbox.tsx` | `pnpm dlx shadcn add checkbox` |
| `ContextMenu` | Check `ui/context-menu.tsx` | `pnpm dlx shadcn add context-menu` |
| `AlertDialog` | ✅ Yes | None |
| `Dialog` | ✅ Yes | None |
| `SelectionSummaryBar` | ✅ Yes (shared) | None |

---

## Decision Log

| # | Decision | Alternatives | Reason |
|---|---------|-------------|--------|
| D1 | `Set<string>` keyed on `file.name` | Array, index | O(1) lookup; easy toggle; file names are unique per dir |
| D2 | Single `rm -rf` call with all paths | N separate calls | Fewer ADB round-trips |
| D3 | Rename via Dialog (not inline cell editing) | Inline edit | Safer; no accidental rename; easier to validate |
| D4 | ContextMenu on TableRow | Toolbar-only | Standard desktop right-click pattern, discoverable |
| D5 | Reuse `SelectionSummaryBar` | Custom bar | DRY — already used in AppManager |
| D6 | Export disabled at 2+ selected | Enable for all | Pull needs a single defined remote path |
| D7 | Max 5 items listed in delete dialog | List all | Prevents overflow on large selections |
| D8 | `rm -rf` for all types | Separate rm / rmdir | Handles files + dirs + symlinks uniformly |
| D9 | Plain click = single-select (clears others) | Plain click = toggle | Matches Windows Explorer muscle memory |

---

## Implementation Phases

### Phase 1 — Core (implement together)
1. Check + install `Checkbox` and `ContextMenu` shadcn components
2. Rust: `delete_files` + `rename_file` commands in `commands/files.rs`
3. Register commands in `lib.rs`
4. `backend.ts`: `DeleteFiles` + `RenameFile` wrappers
5. `ViewFileExplorer`: Replace `selectedFile` with `selectedNames: Set<string>`
6. Checkbox column in table header + each row
7. `SelectionSummaryBar` with Delete button (appears on selection)
8. `AlertDialog` for delete confirmation (with item list)
9. `Dialog` + `Input` for rename (pre-filled, validated)
10. `ContextMenu` on each `TableRow`
11. Update `isBusy` and `isPullDisabled` to use `selectedNames`

### Phase 2 — Keyboard & Polish
1. `Del` key → delete confirmation
2. `F2` key → rename dialog
3. `Ctrl+A` → select all
4. `Escape` → clear selection
5. Shift+Click range selection
6. Tooltip on disabled Export explaining "Select one item to export"
