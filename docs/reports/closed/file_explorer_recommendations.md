# File Explorer — Analysis & Recommendations

> Full analysis of `ViewFileExplorer.tsx` (1265 lines) + `files.rs` (130 lines) + `backend.ts`.
> Prioritized by impact vs effort.

---

## Current Capabilities Summary

| Feature | Status |
|---|---|
| Directory tree (left pane, resizable) | ✅ |
| File list table (name, size, date, time) | ✅ |
| Navigate: double-click / tree / editable address bar / Up button | ✅ |
| Multi-select: Ctrl+Click, Ctrl+A, right-click Select | ✅ |
| Delete (single, multi) with confirmation dialog | ✅ |
| Rename (inline, F2 / right-click) | ✅ |
| Create File / Create Folder (inline phantom row, Ctrl+N / Ctrl+Shift+N) | ✅ |
| Import File / Import Folder (push from host) | ✅ |
| Export (pull single item to host) | ✅ |
| Right-click context menu (per-row + empty-space) | ✅ |
| Error states: Permission Denied, No Device, Unknown | ✅ |
| Path persisted to localStorage | ✅ |

---

## What's Missing / Can Be Improved

---

### 🟢 TIER 1 — High Impact, Low Effort (Quick Wins)

---

#### 1. File Size Display Is Bytes-Only (No Human-Readable Format)
**Problem:** `ls -lA` returns raw byte counts (e.g., `14680064`). The table shows these as-is.  
**Fix:** Format in Rust or JS — `14.0 MB`, `1.2 KB`, `34 B`.  
**Location:** `parse_file_entries()` in `files.rs` → `size` field, or a formatter in the FE.  
**Effort:** 30 min  

```ts
// FE utility
function formatBytes(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${(n / 1_073_741_824).toFixed(1)} GB`;
}
```

---

#### 2. Symlink Target Not Shown
**Problem:** `ls -lA` output for a symlink is `lrwxrwxrwx ... link_name -> /target/path`. The `name` field strips the `-> /target/path` part but doesn't save it.  
**Fix:** Parse and store `linkTarget` in `FileEntry`, display it as a faint `→ /target` subtitle under the symlink name in the table.  
**Location:** `parse_file_entries()` in `files.rs`, `FileEntry` struct, `models.ts`.  
**Effort:** 45 min  

---

#### 3. Copy Full Path to Clipboard (Context Menu)
**Problem:** Users often need the full Android path of a file (e.g., for `adb shell` commands). There's no way to copy it.  
**Fix:** Add a "Copy Path" item to the row context menu using `navigator.clipboard.writeText()`.  
**Effort:** 15 min  

```tsx
<ContextMenuItem onClick={() => navigator.clipboard.writeText(path.posix.join(currentPath, file.name))}>
  <Copy className="h-4 w-4 shrink-0" />
  Copy Path
</ContextMenuItem>
```

---

#### 4. Selection Summary Bar Missing Export / Multi-Export Action
**Problem:** When multiple items are selected, the Summary Bar only shows "Delete". There's no bulk export option.  
**Fix:** Export is disabled when >1 item is selected (ADB `pull` supports multiple arguments). Add a "Export X items" button to the summary bar.  
**Effort:** 1 hour (backend: `pull_file` already works; add multi-path support)  

---

#### 5. Empty Directory: Allow Creation from Empty State
**Problem:** When a directory is empty, the table shows "This directory is empty." but there are no quick-action buttons — the user must use the toolbar.  
**Fix:** Add "New File" and "New Folder" ghost buttons inside the empty state view.  
**Effort:** 20 min  

---

#### 6. Address Bar: No Back/Forward History
**Problem:** The address bar + Up button only go "up". There's no back button for navigating to a previously visited directory.  
**Fix:** Maintain a `navHistory: string[]` stack + `historyIndex`. Add `←` (Back) and `→` (Forward) buttons next to the Up button.  
**Effort:** 1.5 hours  

---

### 🟡 TIER 2 — High Impact, Medium Effort

---

#### 7. Sortable Columns
**Problem:** The table always sorts directories first, then files alphabetically. Users can't sort by size, date, or name direction.  
**Fix:** Add clickable column headers with sort state (`field: 'name'|'size'|'date'`, `dir: 'asc'|'desc'`).  
**Effort:** 1.5 hours (pure FE — sort already done in `loadFiles`)  

---

#### 8. Search / Filter Bar
**Problem:** Large directories (e.g., `/sdcard/`) can have hundreds of files. There's no way to filter.  
**Fix:** Add a search `<Input>` in the toolbar that filters `fileList` by name client-side. No backend call needed.  
**Effort:** 45 min  

```ts
const filteredList = searchQuery
  ? fileList.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  : fileList;
```

---

#### 9. File Permissions Display + Chmod
**Problem:** `permissions` field is already parsed and stored (e.g., `-rw-r--r--`) but never shown in the UI.  
**Fix (a):** Add a "Permissions" column (optional, toggled in settings).  
**Fix (b):** Right-click → "Properties" dialog showing full permissions, size, date.  
**Fix (c):** Right-click → "Change Permissions" → `chmod` via ADB shell.  
**Effort:** (a) 30 min, (b) 1 hour, (c) 2 hours  

---

#### 10. Drag-and-Drop Import
**Problem:** Users can't drag files from their OS explorer into the app to push them.  
**Fix:** Add `onDrop` event handler on the file list pane. Tauri 2 has `tauri_plugin_drag` or the `runtime.ts` already imports file drop event support.  
**Effort:** 2 hours  

---

#### 11. Breadcrumb Navigation (Replace / Augment Address Bar)
**Problem:** The address bar shows the raw path as text. Users can't quickly jump to parent segments.  
**Fix:** Parse `currentPath` and render each segment as a clickable breadcrumb chip:  
`[sdcard] / [Android] / [data] / [com.example]`  
**Effort:** 1.5 hours  

---

#### 12. Context Menu — "Open in Terminal"
**Problem:** Users sometimes need to `adb shell` into a directory. Currently there's no shortcut.  
**Fix:** Add right-click → "Open in ADB Shell" that calls `RunShellCommand("cd " + path + " && $SHELL")` or opens the Shell view pre-populated with the path.  
**Note:** Already have `LaunchTerminal` and the Shell view — just need to wire navigation state between views.  
**Effort:** 1 hour  

---

#### 13. "Move" / "Duplicate" Operations
**Problem:** Users can only rename (which is `mv` with a new name in same dir). Cross-directory moves aren't possible.  
**Fix (move):** Multi-step UX — "Cut" to clipboard state, navigate to target, "Paste". Backend: `mv` via ADB shell (already exists pattern).  
**Fix (duplicate):** Right-click → "Duplicate" → `adb shell cp -r 'path' 'path_copy'`.  
**Effort:** Move = 3 hours, Duplicate = 1 hour  

---

### 🔴 TIER 3 — High Value, Higher Effort

---

#### 14. File Preview Panel (Images, Text, Logs)
**Problem:** Users can't inspect file contents without exporting them first.  
**Fix:** Add a right-side preview pane (collapsible). For small text files: `adb shell cat`. For images: pull to temp dir and render. For `.log` files: syntax highlight.  
**Effort:** 4–6 hours  

---

#### 15. Progress Indicator for Large File Transfers
**Problem:** `push` and `pull` can take minutes for large files. The only feedback is a loading toast with no progress %.  
**Fix:** Parse ADB's stderr output (`adb push` outputs `[100%] file.bin`). Tauri can stream stderr via a spawned child process + events.  
**Effort:** 3–4 hours (requires streaming output, not one-shot `run_binary_command`)  

---

#### 16. Bookmarks / Favorites
**Problem:** Users repeatedly navigate to the same paths (`/sdcard/DCIM`, `/data/local/tmp`).  
**Fix:** Bookmark button in the toolbar saves `currentPath` to `localStorage`. Show bookmarks in a quick-access popover or in the tree panel header. Zero backend required.  
**Effort:** 2 hours  

---

## Architecture Observations

| Observation | Recommendation |
|---|---|
| `handlePull` and `handlePullItem` duplicate 80% of logic | Extract a shared `pullItemToHost(file, currentPath)` helper |
| `handlePushFile`, `handlePushFolder`, `handlePushFileToDir` are 3 similar functions | Extract a shared `pushToDevice(localPath, remotePath)` helper |
| Sort logic is inline in `loadFiles` | Extract `sortEntries(entries, field, dir)` for reuse with column sort |
| File entry size is raw string bytes | Format `size` in `parse_file_entries()` in Rust or add a `rawSize: u64` field and format in TS |
| `currentPath` persisted to `localStorage` | Consider adding `navHistory` alongside it |
| `ViewFileExplorer.tsx` is 1265 lines | Consider splitting: `FileTable`, `FileToolbar`, `FileContextMenu` into sub-components |

---

## My Top 5 Recommendations to Implement Next

| # | Feature | Why | Effort |
|---|---|---|---|
| 1 | **Human-readable file sizes** | Breaks the basic UX expectation — every file manager does this | 30 min |
| 2 | **Search/Filter bar** | Massive quality of life in `/sdcard/` which has hundreds of entries | 45 min |
| 3 | **Copy Path to clipboard** | Power user staple — needed every time someone wants to do something in ADB shell | 15 min |
| 4 | **Sortable columns** | Standard table expectation | 1.5 hours |
| 5 | **Back/Forward navigation history** | Right now every navigation is one-way; disorienting | 1.5 hours |

> **Combined effort for top 5:** ~4.5 hours
