# Feature Plan: File Explorer — Create File/Folder + Native Keyboard Shortcuts

> **Status:** Design locked — awaiting implementation  
> **Author:** Brainstorming session (2026-03-26)  
> **Version:** 1.0  
> **Branch:** `main`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [Feasibility Assessment](#3-feasibility-assessment)
4. [Native Keyboard Shortcuts Research](#4-native-keyboard-shortcuts-research)
5. [Design Approaches Evaluated](#5-design-approaches-evaluated)
6. [Recommended Design](#6-recommended-design)
7. [Backend Implementation Plan](#7-backend-implementation-plan)
8. [Frontend Implementation Plan](#8-frontend-implementation-plan)
9. [Validation Rules](#9-validation-rules)
10. [Keyboard Shortcut Specification](#10-keyboard-shortcut-specification)
11. [Context Menu Additions](#11-context-menu-additions)
12. [Toolbar Changes](#12-toolbar-changes)
13. [State Machine Specification](#13-state-machine-specification)
14. [Affected Files](#14-affected-files)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Decision Log](#16-decision-log)
17. [Implementation Checklist](#17-implementation-checklist)
18. [Effort Estimate](#18-effort-estimate)

---

## 1. Overview

This document covers the complete design for adding two new operations to the ADB GUI Next File Explorer:

- **Create File** — create an empty file on the connected Android device with any extension
- **Create Folder** — create a new directory on the connected Android device

These features are exposed via three entry points:
1. Native keyboard shortcuts (`Ctrl+N` / `Ctrl+Shift+N`)
2. Toolbar buttons (`FilePlus2` / `FolderPlus` icons)
3. Right-click context menu on empty space in the file list

The UX model is **inline phantom row** creation — consistent with the existing inline rename flow, VS Code, Windows Explorer, and macOS Finder behavior.

---

## 2. Current State Analysis

### File Explorer Capabilities (as of 2026-03-26)

| Capability | Status | Implementation |
|---|---|---|
| List files/directories | ✅ | `list_files` Rust command → `ListFiles` TS wrapper |
| Navigate (double-click, tree, address bar) | ✅ | `loadFiles()` in `ViewFileExplorer.tsx` |
| Push file/folder from host → device | ✅ | `push_file` Rust command → `PushFile` TS wrapper |
| Pull file/folder device → host | ✅ | `pull_file` Rust command → `PullFile` TS wrapper |
| Inline rename | ✅ | `rename_file` Rust command → `RenameFile` TS wrapper; `F2` / right-click |
| Bulk delete | ✅ | `delete_files` Rust command → `DeleteFiles` TS wrapper; `Delete` key / right-click |
| Explicit multi-select mode | ✅ | `isMultiSelectMode` state gate; `Ctrl+Click`, `Ctrl+A`, right-click → Select |
| Right-click context menu | ✅ | shadcn `ContextMenu` per row |
| **Create file on device** | ❌ | **Missing** |
| **Create folder on device** | ❌ | **Missing** |
| **Keyboard: New File / New Folder** | ❌ | **Missing** |

### Existing Keyboard Shortcuts in File Explorer

| Shortcut | Action |
|---|---|
| `Ctrl+Click` | Toggle row selection, enter multi-select mode |
| `Ctrl+A` | Select all, enter multi-select mode |
| `F2` | Inline rename (requires 1 item selected) |
| `Delete` | Open delete dialog (requires ≥1 item selected) |
| `Escape` | Cancel rename → then clear selection |

### Existing Global Shortcuts (not File Explorer specific)

| Shortcut | Action | Location |
|---|---|---|
| `Ctrl+B` | Toggle sidebar | `SidebarProvider` (shadcn) |
| `` Ctrl+` `` | Toggle bottom panel | `MainLayout.tsx` |

### Existing Rust Commands in `files.rs`

| Command | Shell Call | Pattern |
|---|---|---|
| `list_files` | `adb shell ls -lA '<path>'` | Read-only |
| `push_file` | `adb push <local> <remote>` | Host → Device |
| `pull_file` | `adb pull -a <remote> <local>` | Device → Host |
| `delete_files` | `adb shell rm -rf 'p1' 'p2'` | Destructive, bulk |
| `rename_file` | `adb shell mv 'old' 'new'` | In-place mutation |

---

## 3. Feasibility Assessment

### ✅ Verdict: Straightforward

Both operations map directly to POSIX ADB shell commands available on all Android versions:

```bash
# Create an empty file (any extension)
adb shell touch '/sdcard/Download/notes.txt'

# Create a directory (with parent creation safety)
adb shell mkdir -p '/sdcard/Download/NewFolder'
```

**No new Rust dependencies required.**  
**No new Tauri plugins required.**  
**Follows the exact same `run_binary_command()` + single-quote escaping pattern** as every existing files.rs command.

### Risk Table

| Risk | Severity | Mitigation |
|---|---|---|
| Name validation (empty, forbidden chars, `.`/`..`) | Low | Reuse existing `FORBIDDEN_CHARS` regex from rename |
| Spaces/special chars in paths | Low | Already solved with single-quote escaping in all Rust commands |
| `touch` silently succeeds on existing file | Medium | No destructive effect — `touch` only updates mtime; treat as success |
| `mkdir -p` silently succeeds if dir exists | Low | No destructive effect; treat as success |
| Permission denied on target directory | Low | `run_binary_command` propagates error string → toast + log |
| Two simultaneous inline-edit modes (rename + create) | Medium | Strict mutual exclusion in state machine (see §13) |
| Tauri DLL crash on `cargo test` (Windows) | Low | Pre-existing known issue; not introduced by this feature |

---

## 4. Native Keyboard Shortcuts Research

### Platform Standards for File Manager Shortcuts

| Action | Windows | macOS | Linux (Nautilus/Dolphin) |
|---|---|---|---|
| **New Folder** | `Ctrl+Shift+N` | `Cmd+Shift+N` | `Ctrl+Shift+N` |
| **New File** | *No universal standard* | `Cmd+N` (app-specific) | *No universal standard* |
| Rename | `F2` | `Return` | `F2` |
| Delete | `Delete` | `Cmd+Backspace` | `Delete` |
| Select All | `Ctrl+A` | `Cmd+A` | `Ctrl+A` |
| Go Up One Level | `Alt+Up` | `Cmd+Up` | `Alt+Up` |

### Key Finding

> **"New File" has no universal standard** on any platform. We adopt `Ctrl+N` (the VS Code convention for "new document") because:
> - Users of this developer-focused app are highly likely to know VS Code
> - `Ctrl+N` is the most semantically natural shortcut ("N" = New)
> - It has zero collision risk in our current shortcut map

### JavaScript/Tauri Cross-Platform Pattern

```typescript
// Ctrl on Windows/Linux, Cmd on macOS — identical to Ctrl+A already in use
const isMod = e.ctrlKey || e.metaKey;  // metaKey = Cmd on macOS
```

### Collision Audit

| Proposed Shortcut | Collides With | Safe? |
|---|---|---|
| `Ctrl+N` | Nothing | ✅ |
| `Ctrl+Shift+N` | Nothing | ✅ |

---

## 5. Design Approaches Evaluated

### Approach A — Inline Phantom Row (Chosen)

**Flow:**
1. User triggers via keyboard / toolbar / context menu.
2. A phantom row appears at the **top** of the file list with an `<Input>` pre-focused.
3. User types the name (e.g., `notes.txt` or `Backup`).
4. `Enter` → invoke backend → refresh directory.
5. `Escape` or blur → cancel, remove phantom row.

| | |
|---|---|
| ✅ Consistent with existing inline rename pattern | ❌ Custom UI state not in `fileList` |
| ✅ No modal — feels native and fast | ❌ Must be mutually exclusive with rename |
| ✅ Extension included naturally in the typed name | |
| ✅ Matches VS Code, Windows Explorer, macOS Finder, Nautilus | |

---

### Approach B — Dialog Modal (Rejected)

Open a shadcn `Dialog` with an `Input` and a confirm button.

| | |
|---|---|
| ✅ Simpler state management | ❌ Extra modal click to dismiss |
| ✅ Already have pattern in codebase | ❌ Not what any native file manager does |
| | ❌ Interrupts flow more than inline editing |

**Rejected.** Approach A is strictly better for power users.

---

### Approach C — Context Menu on Empty Space Only (Rejected as Standalone)

Right-click on empty area of file list → context menu with "New File / New Folder".

| | |
|---|---|
| ✅ Discoverable for new users | ❌ Doesn't satisfy keyboard shortcut requirement |
| ✅ No extra toolbar buttons | ❌ Harder to implement (must detect right-click on non-row area) |

**Not rejected entirely** — kept as a **third entry point** that calls the same inline creation flow as Approach A.

---

## 6. Recommended Design

### Three Entry Points → One Unified Flow

```
Keyboard: Ctrl+N / Ctrl+Shift+N
                  │
Toolbar: FilePlus2 / FolderPlus buttons    ──→  startCreate('file' | 'folder')
                  │                                        │
Right-click: Empty space context menu                      ▼
                                              Phantom row with focused Input
                                                  Enter → create + refresh
                                                Escape → cancel + remove
```

### Visual Hierarchy in File List

```
┌──────────────────────────────────────────────────────┐
│ [toolbar: ↑ Back | /sdcard/ | ⟳ | New File | New Folder | Import ▾ | Export] │
├──────────────────────────────────────────────────────┤
│ 📄 [___________ new file name ___________] ← phantom row (Input pre-focused)    │
├──────────────────────────────────────────────────────┤
│ 📁 Android                                            │
│ 📁 Download                                           │
│ 📄 notes.txt                                          │
└──────────────────────────────────────────────────────┘
```

---

## 7. Backend Implementation Plan

### File: `src-tauri/src/commands/files.rs`

Add two new `#[tauri::command]` functions following the exact existing pattern:

```rust
/// Creates an empty file on the connected device at the given path.
/// Uses POSIX `touch`, which is available on all Android versions.
#[tauri::command]
pub fn create_file(app: AppHandle, path: String) -> CmdResult<String> {
    info!("Creating file: {}", path.trim());
    let quoted = format!("'{}'", path.trim().replace('\'', r"'\''"));
    let cmd = format!("touch {quoted}");
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Created file: {}", path.trim()))
}

/// Creates a directory (and any missing parents) on the connected device.
/// Uses `mkdir -p` to avoid errors if intermediate directories are missing.
#[tauri::command]
pub fn create_directory(app: AppHandle, path: String) -> CmdResult<String> {
    info!("Creating directory: {}", path.trim());
    let quoted = format!("'{}'", path.trim().replace('\'', r"'\''"));
    let cmd = format!("mkdir -p {quoted}");
    run_binary_command(&app, "adb", &["shell", &cmd])?;
    Ok(format!("Created directory: {}", path.trim()))
}
```

**Notes:**
- Both follow `CmdResult<T> = Result<T, String>` — mandatory for all Tauri commands.
- Single-quote path escaping (`'${path.replace("'", "'\\''")}`) is the established pattern.
- `mkdir -p` is safe to call even if the directory already exists.
- `touch` is safe to call even if the file already exists (only updates mtime).

### File: `src-tauri/src/lib.rs`

Add to the `tauri::generate_handler![...]` invocation:

```rust
// In the generate_handler! macro, add:
commands::files::create_file,
commands::files::create_directory,
```

---

## 8. Frontend Implementation Plan

### File: `src/lib/desktop/backend.ts`

Add two new wrappers following the `RenameFile` / `DeleteFiles` pattern:

```typescript
/**
 * Creates an empty file on the connected Android device.
 * @param path - Full absolute path on the device (e.g. /sdcard/Download/notes.txt)
 */
export async function CreateFile(path: string): Promise<string> {
  return core.invoke<string>('create_file', { path });
}

/**
 * Creates a directory (and any missing parents) on the connected Android device.
 * @param path - Full absolute path on the device (e.g. /sdcard/Download/NewFolder)
 */
export async function CreateDirectory(path: string): Promise<string> {
  return core.invoke<string>('create_directory', { path });
}
```

### `models.ts` — No Changes Needed

Both commands return `string`, no new DTOs required.

### File: `src/components/views/ViewFileExplorer.tsx`

#### 8a. New Imports

```typescript
import { CreateFile, CreateDirectory } from '../../lib/desktop/backend';
import { FilePlus2, FolderPlus } from 'lucide-react';
```

> lucide-react `^0.577.0` includes both `FilePlus2` and `FolderPlus`.

#### 8b. New State

```typescript
// ── Create (new file / new folder) ──────────────────────────────────────────
type CreatingType = 'file' | 'folder' | null;
const [creatingType, setCreatingType] = useState<CreatingType>(null);
const [createName, setCreateName] = useState('');
const [createError, setCreateError] = useState('');
const [isCreating, setIsCreating] = useState(false);
```

#### 8c. Updated `isBusy`

```typescript
const isBusy = isLoading || isPushing || isPulling || isDeleting || isRenaming || isCreating;
```

#### 8d. `startCreate` Function

```typescript
const startCreate = useCallback((type: 'file' | 'folder') => {
  // Mutual exclusion: cancel any active rename
  if (renamingName) handleRenameCancel();
  setCreatingType(type);
  setCreateName('');
  setCreateError('');
}, [renamingName, handleRenameCancel]);

const cancelCreate = useCallback(() => {
  setCreatingType(null);
  setCreateName('');
  setCreateError('');
}, []);
```

#### 8e. `handleCreateChange` (validation)

```typescript
const RESERVED_NAMES = /^\.\.?$/; // rejects "." and ".."

const handleCreateChange = (val: string) => {
  setCreateName(val);
  if (!val.trim()) {
    setCreateError('Name cannot be empty');
    return;
  }
  if (FORBIDDEN_CHARS.test(val)) {
    setCreateError('Invalid characters: / \\ : * ? " < > |');
    return;
  }
  if (RESERVED_NAMES.test(val.trim())) {
    setCreateError('Reserved name: use a different name');
    return;
  }
  setCreateError('');
};
```

#### 8f. `handleCreateConfirm` (submit)

```typescript
const handleCreateConfirm = useCallback(async () => {
  if (!creatingType) return;
  const trimmed = createName.trim();
  if (!trimmed || createError) return;

  const fullPath = path.posix.join(currentPath, trimmed);
  setIsCreating(true);
  try {
    if (creatingType === 'file') {
      await CreateFile(fullPath);
      toast.success(`Created file "${trimmed}"`);
      useLogStore.getState().addLog(`Created file: ${fullPath}`, 'success');
    } else {
      await CreateDirectory(fullPath);
      toast.success(`Created folder "${trimmed}"`);
      useLogStore.getState().addLog(`Created folder: ${fullPath}`, 'success');
    }
    setCreatingType(null);
    loadFiles(currentPath);
  } catch (error) {
    handleError(creatingType === 'file' ? 'Create File' : 'Create Folder', error);
  } finally {
    setIsCreating(false);
  }
}, [creatingType, createName, createError, currentPath, loadFiles]);
```

#### 8g. Keyboard Handler Additions

In the existing `onKey` handler (inside the `useEffect`), add **before** the `isInput` guard:

```typescript
// New File: Ctrl+N / Cmd+N
if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'n') {
  e.preventDefault();
  startCreate('file');
  return;
}

// New Folder: Ctrl+Shift+N / Cmd+Shift+N
// Note: e.key === 'N' (uppercase) when Shift is held — browser standard
if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
  e.preventDefault();
  startCreate('folder');
  return;
}
```

Also extend the `Escape` handler to cancel creation:

```typescript
if (e.key === 'Escape') {
  if (renamingName) {
    handleRenameCancel();
  } else if (creatingType) {   // ← ADD THIS BRANCH
    cancelCreate();
  } else if (!isInput && selectedNames.size > 0) {
    clearSelection();
  }
  return;
}
```

Also extend `loadFiles` to cancel creation on navigation (already resets rename):

```typescript
// In loadFiles(), after setRenamingName(null):
setCreatingType(null);
setCreateName('');
setCreateError('');
```

#### 8h. Phantom Row (in the `<TableBody>`)

Insert **before** the `fileList.map(...)` call:

```tsx
{/* Phantom row for inline creation — appears at top of list */}
{creatingType !== null && (
  <TableRow>
    {isMultiSelectMode && <TableCell className="pl-3 pr-0 w-10" />}
    <TableCell className="w-10 pr-0">
      {creatingType === 'folder' ? (
        <Folder className="h-4 w-4 text-muted-foreground" />
      ) : (
        <File className="h-4 w-4 text-muted-foreground" />
      )}
    </TableCell>
    <TableCell colSpan={4}>
      <div className="flex items-center gap-2">
        <Input
          value={createName}
          onChange={(e) => handleCreateChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreateConfirm();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelCreate();
            }
          }}
          onBlur={cancelCreate}
          placeholder={creatingType === 'folder' ? 'New folder name' : 'filename.ext'}
          className="h-6 text-sm font-mono max-w-xs"
          aria-label={creatingType === 'folder' ? 'New folder name' : 'New file name'}
          autoFocus
          disabled={isCreating}
        />
        {createError && (
          <span className="text-destructive text-xs shrink-0">{createError}</span>
        )}
        {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" />}
      </div>
    </TableCell>
  </TableRow>
)}
```

---

## 9. Validation Rules

| Rule | File | Folder | Enforcement |
|---|---|---|---|
| Name cannot be empty or whitespace-only | ✅ | ✅ | `!val.trim()` |
| Forbidden characters: `/ \ : * ? " < > \|` | ✅ | ✅ | Existing `FORBIDDEN_CHARS` regex |
| Reserved names: `.` and `..` | ✅ | ✅ | `/^\.\.?$/` regex |
| Name must be confirmed with `Enter` | ✅ | ✅ | `onKeyDown` |
| Extension required | ❌ (user's choice) | N/A | Not enforced — YAGNI |
| Max name length | ❌ (device enforces) | ❌ | Android enforces 255 bytes — no FE check |

---

## 10. Keyboard Shortcut Specification

### Complete Updated Shortcut Map for File Explorer

| Shortcut | Platform | Action | Scope |
|---|---|---|---|
| `Ctrl+N` | Win / Linux | New File (inline create) | File Explorer only |
| `Cmd+N` | macOS | New File (inline create) | File Explorer only |
| `Ctrl+Shift+N` | Win / Linux | New Folder (inline create) | File Explorer only |
| `Cmd+Shift+N` | macOS | New Folder (inline create) | File Explorer only |
| `Ctrl+A` / `Cmd+A` | All | Select all items | File Explorer only |
| `Ctrl+Click` / `Cmd+Click` | All | Toggle item selection | File Explorer only |
| `F2` | All | Inline rename (1 item selected) | File Explorer only |
| `Delete` | All | Open delete dialog | File Explorer only |
| `Escape` | All | Cancel create → cancel rename → clear selection | File Explorer only |
| `Ctrl+B` | Win / Linux | Toggle sidebar | Global |
| `Cmd+B` | macOS | Toggle sidebar | Global |
| `` Ctrl+` `` | All | Toggle bottom panel | Global |

### Implementation Note: Shift+Key Case

When `shiftKey` is held, `e.key` reports the **shifted character**:
- `e.key === 'N'` (uppercase) when `Shift+N` is pressed on all platforms
- This is browser-standard KeyboardEvent behavior
- No special detection needed — `e.shiftKey && e.key === 'N'` is sufficient

---

## 11. Context Menu Additions

### 11a. Row-Level Context Menu (Existing — Unchanged)

The per-row context menu wrapped in `<ContextMenu>` per `fileList.map()` is **not modified**.

### 11b. Table-Level / Empty-Area Context Menu (New)

Wrap the entire `<ScrollArea>` content in a second `<ContextMenu>` that fires when the user right-clicks on non-row space:

```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <ScrollArea className="flex-1">
      {/* existing content */}
    </ScrollArea>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => startCreate('file')} disabled={isBusy}>
      <FilePlus2 className="h-4 w-4 shrink-0" />
      New File
      <span className="ml-auto text-xs text-muted-foreground">Ctrl+N</span>
    </ContextMenuItem>
    <ContextMenuItem onClick={() => startCreate('folder')} disabled={isBusy}>
      <FolderPlus className="h-4 w-4 shrink-0" />
      New Folder
      <span className="ml-auto text-xs text-muted-foreground">Ctrl+Shift+N</span>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

> **UX Note:** The row-level `ContextMenu` will intercept right-clicks on rows (preventing the table-level one from firing). The table-level one only fires on truly empty space. This is the standard behavior of nested `ContextMenu` components in Radix UI.

---

## 12. Toolbar Changes

Add two icon buttons **after the Refresh button** and **before the Import split-button** in the toolbar:

```tsx
{/* New File */}
<Button
  variant="ghost"
  size="icon"
  className="size-7"
  onClick={() => startCreate('file')}
  disabled={isBusy}
  title="New File (Ctrl+N)"
>
  <FilePlus2 className="h-4 w-4 shrink-0" />
</Button>

{/* New Folder */}
<Button
  variant="ghost"
  size="icon"
  className="size-7"
  onClick={() => startCreate('folder')}
  disabled={isBusy}
  title="New Folder (Ctrl+Shift+N)"
>
  <FolderPlus className="h-4 w-4 shrink-0" />
</Button>

<Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />
```

> `title` attributes show tooltips on hover and include the keyboard shortcut for discoverability.

---

## 13. State Machine Specification

### New State Variables

```
creatingType: 'file' | 'folder' | null  — what is being created; null = not in creation mode
createName: string                       — current value of the name input
createError: string                      — validation error message ('' = no error)
isCreating: boolean                      — true while the Tauri command is in flight
```

### Mutual Exclusion

| Active State | Can Enter Create? | Can Enter Rename? |
|---|---|---|
| `creatingType !== null` | N/A | ❌ cancel create first |
| `renamingName !== null` | ❌ cancel rename first | N/A |
| Neither | ✅ | ✅ |

`startCreate()` always calls `handleRenameCancel()` before setting `creatingType`.  
`startRename()` implicitly resets `creatingType` via `setCreatingType(null)` (to be added).

### Activation Triggers

| Trigger | Action |
|---|---|
| `Ctrl+N` / `Cmd+N` keyboard | `startCreate('file')` |
| `Ctrl+Shift+N` / `Cmd+Shift+N` keyboard | `startCreate('folder')` |
| Toolbar `FilePlus2` button | `startCreate('file')` |
| Toolbar `FolderPlus` button | `startCreate('folder')` |
| Empty-area context menu → New File | `startCreate('file')` |
| Empty-area context menu → New Folder | `startCreate('folder')` |

### Deactivation Triggers

| Trigger | Action |
|---|---|
| `Enter` key in Input (valid name) | Submit → `handleCreateConfirm()` → `setCreatingType(null)` |
| `Enter` key (invalid name) | No-op (error shown) |
| `Escape` key | `cancelCreate()` |
| `onBlur` on Input | `cancelCreate()` |
| Navigate to new directory (`loadFiles`) | Reset all create state |
| `Escape` key (no active rename) | `cancelCreate()` if `creatingType !== null` |

---

## 14. Affected Files

| File | Type of Change | Estimated Lines Added |
|---|---|---|
| `src-tauri/src/commands/files.rs` | +2 Tauri commands | ~22 |
| `src-tauri/src/lib.rs` | Register 2 new commands | ~2 |
| `src/lib/desktop/backend.ts` | +2 TS wrappers | ~14 |
| `src/components/views/ViewFileExplorer.tsx` | +state, handlers, phantom row, keyboard, toolbar, context menu | ~115 |

**Total:** ~153 lines  
**New files created:** None  
**Dependencies added:** None  
**Tauri plugins added:** None

---

## 15. Non-Functional Requirements

| Requirement | Assumption / Approach |
|---|---|
| **Performance** | Negligible — two ADB shell one-liners; same latency as rename/delete |
| **Security** | Same single-quote path escaping used for all existing ADB commands |
| **Reliability** | All errors propagated via `CmdResult<T>` → `toast.error()` + `handleError()` |
| **Accessibility** | Phantom `<Input>` has `autoFocus`, `aria-label`, and proper keyboard navigation |
| **Maintainability** | No new abstractions, no new patterns — pure extension of existing code |
| **Backwards Compatibility** | No existing behavior changes |
| **Scope** | Shortcuts are File Explorer-scoped (`activeView === 'files'` guard already in place) |

---

## 16. Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|---|---|---|
| 1 | **Inline phantom row** (not dialog) | Dialog modal | Consistent with existing inline rename; native-feeling; zero extra clicks |
| 2 | **`Ctrl+N`** for New File | `Ctrl+Shift+F`, `Alt+N`, `Ctrl+T` | VS Code standard for "new"; no collision; most discoverable |
| 3 | **`Ctrl+Shift+N`** for New Folder | `Ctrl+D`, `Ctrl+F`, `Ctrl+M` | Platform-native on Windows Explorer, macOS Finder, Nautilus/Dolphin |
| 4 | **`touch`** for file creation | `echo -n > file`, `printf '' > file` | POSIX-standard; available on all Android; no assumption about content |
| 5 | **`mkdir -p`** for folder creation | `mkdir` | `-p` prevents error when intermediate dirs exist; safer |
| 6 | **Empty files only** | File templates | YAGNI — templates are a Phase 2 concern |
| 7 | **Phantom row at top of list** | At bottom, at sorted position | Most discoverable; confirmed best practice by VS Code, Explorer, Finder |
| 8 | **3 entry points** | Single entry point | Keyboard-first, mouse-first, and explorer-style users all covered |
| 9 | **Mutual exclusion with rename** | Allow both simultaneously | Simultaneous inline edits cause ambiguous state and broken UX |
| 10 | **No "." / ".." names** | Allow and let device reject | Fail-fast in FE is better UX than backend error for obvious invalids |
| 11 | **`onBlur` cancels creation** | `onBlur` submits | Consistent with existing rename behavior; prevents accidental creation |
| 12 | **Context menu on empty space** — table-level wrapper | Row-level only | Gives right-click discoverability; Radix nested ContextMenu handles the scoping correctly |

---

## 17. Implementation Checklist

### Backend (Rust)

- [ ] Add `create_file` command to `src-tauri/src/commands/files.rs`
- [ ] Add `create_directory` command to `src-tauri/src/commands/files.rs`
- [ ] Register both in `src-tauri/src/lib.rs` `generate_handler![]`

### Frontend — IPC Layer

- [ ] Add `CreateFile()` wrapper to `src/lib/desktop/backend.ts`
- [ ] Add `CreateDirectory()` wrapper to `src/lib/desktop/backend.ts`

### Frontend — `ViewFileExplorer.tsx`

- [ ] Import `CreateFile`, `CreateDirectory` from backend
- [ ] Import `FilePlus2`, `FolderPlus` from lucide-react
- [ ] Add `creatingType`, `createName`, `createError`, `isCreating` state
- [ ] Update `isBusy` to include `isCreating`
- [ ] Implement `startCreate(type)` — cancels rename, sets creatingType
- [ ] Implement `cancelCreate()` — resets all create state
- [ ] Implement `handleCreateChange(val)` — validation
- [ ] Implement `handleCreateConfirm()` — async submit
- [ ] Extend `loadFiles()` to reset create state on navigation
- [ ] Add `Ctrl+N` / `Cmd+N` keyboard shortcut handler
- [ ] Add `Ctrl+Shift+N` / `Cmd+Shift+N` keyboard shortcut handler
- [ ] Extend `Escape` handler to cancel create before clearing selection
- [ ] Add `FilePlus2` toolbar button
- [ ] Add `FolderPlus` toolbar button with `Separator`
- [ ] Add phantom row in `<TableBody>` before `fileList.map()`
- [ ] Wrap `<ScrollArea>` in table-level `<ContextMenu>` for empty-area right-click
- [ ] Add "New File" + "New Folder" items to table-level context menu

### Quality Gates

- [ ] `pnpm format:check` passes (run `pnpm format` if not)
- [ ] `pnpm lint` passes (ESLint + cargo clippy -D warnings)
- [ ] `pnpm build` passes (TypeScript + Vite)
- [ ] `cargo test` — expect Windows crash (pre-existing, not a code bug)
- [ ] `pnpm tauri build --debug` passes (full packaging)
- [ ] Manual verification in `pnpm tauri dev`: create file, create folder, keyboard shortcuts, right-click context menu, Escape cancel, blur cancel, error display, navigation reset

---

## 18. Effort Estimate

| Task | Estimated Time |
|---|---|
| Rust backend (2 commands + registration) | 15 min |
| `backend.ts` wrappers | 5 min |
| State variables + `isBusy` update | 5 min |
| `startCreate` / `cancelCreate` / `handleCreateChange` / `handleCreateConfirm` | 20 min |
| `loadFiles` create state reset | 5 min |
| Keyboard shortcut handlers | 10 min |
| Phantom row UI | 20 min |
| Toolbar buttons + Separator | 10 min |
| Table-level context menu | 15 min |
| Quality gates (`pnpm check` + manual test) | 30 min |
| **Total** | **~2 hours 15 min** |

---

## Appendix A — File Explorer Shortcut Quick-Reference Card

```
# File Explorer — Keyboard Shortcuts (ADB GUI Next)

Navigation
  Alt+Up (← planned)    Go up one directory level
  Enter / Double-click   Open directory
  Click address bar      Edit path manually

Selection
  Ctrl+A               Select all items
  Ctrl+Click            Toggle individual item selection
  Escape                Clear selection / exit multi-select mode

Editing
  F2                    Inline rename (requires 1 item selected)
  Delete                Delete selected items (shows confirmation)
  Escape                Cancel rename → clear selection

Creation (NEW)
  Ctrl+N               New File (inline phantom row)
  Ctrl+Shift+N         New Folder (inline phantom row)
  Escape                Cancel creation

macOS: Replace Ctrl with Cmd (⌘)
```

---

*Document created: 2026-03-26*  
*Feature target: v0.2.0*  
*Author: Design session via brainstorming skill*
