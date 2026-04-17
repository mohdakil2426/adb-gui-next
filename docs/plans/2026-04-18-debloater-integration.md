# Debloater Integration — App Manager Redesign

> **Date**: 2026-04-18
> **Status**: Draft — Awaiting Feedback
> **Scope**: Integrate UAD-style debloating into the App Manager page with a two-tab UI redesign

---

## 1. Executive Summary

Integrate Universal Android Debloater (UAD) functionality into the existing App Manager page. The current page has two separate Cards (Install APK + Uninstall Package). The redesign merges everything into a **single Card with two tabs**: **Debloater** (smart system package management with safety ratings) and **Installation** (APK install + uninstall, existing functionality).

---

## 2. UAD Reference Analysis

### 2.1 Core Concepts from UAD

| Concept | UAD Implementation | Our Adaptation |
|---|---|---|
| **Debloat Lists** | Community JSON with ~4000+ packages, fetched from GitHub | Fetch same JSON, cache locally, bundle fallback |
| **Package Metadata** | `id`, `list` (Aosp/Oem/Carrier/Google/Misc), `description`, `dependencies`, `neededBy`, `labels`, `removal` (Recommended/Advanced/Expert/Unsafe) | Map to our `DebloatPackageRow` DTO |
| **Package States** | Enabled / Disabled / Uninstalled | Same — detected via `pm list packages` flags |
| **Safety Tiers** | Recommended (safe), Advanced (some risk), Expert (functional loss), Unsafe (bootloop risk) | Color-coded badges + expert mode gate |
| **Actions** | Uninstall (`pm uninstall --user 0`), Disable (`pm disable-user`), Restore (`cmd package install-existing`) | Same ADB commands via our existing `run_binary_command` |
| **Multi-user** | Per-user `--user N` flag support | Phase 2 — start with user 0 |
| **Export/Import** | Save/load selection as text file | Phase 2 |
| **Disable Mode** | Toggle between uninstall vs disable | Include as a toggle in the UI |

### 2.2 UAD Data Format (uad_lists.json)

```json
{
  "id": "com.google.android.gms",
  "list": "Google",
  "description": "Google Play Services...",
  "dependencies": ["com.google.android.gsf"],
  "neededBy": ["com.google.android.apps.maps"],
  "labels": [],
  "removal": "Expert"
}
```

### 2.3 Key ADB Commands Used

```bash
# List all system packages (installed + uninstalled)
pm list packages -s -u
# List enabled system packages
pm list packages -s -e
# List disabled system packages
pm list packages -s -d
# Uninstall for user (without root)
pm uninstall --user 0 <package>
# Disable for user
pm disable-user --user 0 <package>
# Re-enable
pm enable --user 0 <package>
# Restore uninstalled
cmd package install-existing --user 0 <package>
# List users
pm list users
```

---

## 3. UI Design — Two-Tab Layout

### 3.1 ASCII Wireframe — Full Page

```
┌──────────────────────────────────────────────────────────────────────┐
│  CardHeader                                                          │
│  ┌─────┐                                                             │
│  │ 📦  │  Applications                                               │
│  └─────┘  Manage, debloat, and install apps on your device           │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬──────────────┐                                      │
│  │  Debloater  │ Installation │    ← TabsList (line variant)         │
│  └─────────────┴──────────────┘                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [TAB CONTENT RENDERS HERE]                                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Debloater Tab — Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOOLBAR ROW                                                          │
│ ┌──────────────────────┐  ┌─────────┐ ┌──────────┐ ┌──────┐ ┌────┐ │
│ │ 🔍 Search packages.. │  │ List ▾  │ │ Safety ▾ │ │State▾│ │ ⟳  │ │
│ └──────────────────────┘  └─────────┘ └──────────┘ └──────┘ └────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ STATUS BAR                                                           │
│ 142 of 380 system packages  •  UAD lists: ✓ Updated 2h ago          │
│ ┌──────────┐  ┌──────────────────┐                                   │
│ │☐ Disable │  │  Expert Mode: OFF │                                  │
│ └──────────┘  └──────────────────┘                                   │
├──────────────────────────────────────────────────────────────────────┤
│ PACKAGE LIST (virtualized)                                    h:40vh │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ ☐  com.google.android.gms          Google  Expert   [Enabled] │   │
│ │ ☐  com.samsung.android.bixby       Oem     Recomm  [Enabled] │   │
│ │ ☑  com.facebook.appmanager         Oem     Recomm  [Enabled] │   │
│ │ ☐  com.qualcomm.qti.autoregistr    Misc    Recomm  [Enabled] │   │
│ │ ☐  com.android.providers.media     Aosp    Unsafe  [Enabled] │   │
│ │    ...                                                        │   │
│ └────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│ DESCRIPTION PANEL                                             h:15vh │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Samsung Bixby Voice Assistant                                  │   │
│ │ Samsung's virtual assistant. Safe to remove — uses significant │   │
│ │ battery. No known dependencies.                                │   │
│ │                                                                │   │
│ │ Dependencies: none  •  Needed by: none                         │   │
│ └────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│ ACTION BAR                                                           │
│ ┌───────────┐ ┌─────────────┐            ┌─────────────────────────┐│
│ │ Select All│ │ Unselect All│            │ Review Selection (3)    ││
│ └───────────┘ └─────────────┘            └─────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Debloater — Review Selection Dialog

```
┌──────────────────────────────────────────────────────────────────┐
│                    Review Your Selection                          │
├──────────────────────────────────────────────────────────────────┤
│  Summary                                                         │
│  ┌─────────────┬───────────┬──────────┐                          │
│  │ Safety      │ To Remove │ To Restore│                         │
│  ├─────────────┼───────────┼──────────┤                          │
│  │ Recommended │     2     │    0     │                          │
│  │ Advanced    │     1     │    0     │                          │
│  │ Expert      │     0     │    0     │                          │
│  │ Unsafe      │     0     │    0     │                          │
│  └─────────────┴───────────┴──────────┘                          │
│                                                                  │
│  Selected Packages                                               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Recomm  Oem   com.facebook.appmanager          Uninstall│    │
│  │ Recomm  Oem   com.samsung.android.bixby        Uninstall│    │
│  │ Advanc  Misc  com.qualcomm.qti.autoregistr     Uninstall│    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ⚠ Disclaimer: You CANNOT brick your device, but removing       │
│  essential packages may cause a bootloop requiring a factory     │
│  reset. Make a backup first!                                     │
│                                                                  │
│  ┌────────┐                              ┌─────────────────┐    │
│  │ Cancel │                              │  Apply Actions  │    │
│  └────────┘                              └─────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.4 Installation Tab — Wireframe (existing, reorganized)

```
┌──────────────────────────────────────────────────────────────────────┐
│ INSTALL SECTION                                                      │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │  DropZone: "Drop APK files here"                               │   │
│ │  [Select App Files]                                            │   │
│ │  Accepts .apk and .apks files                                  │   │
│ └────────────────────────────────────────────────────────────────┘   │
│ (When files selected: file list + install button — same as current) │
├──────────────────────────────────────────────────────────────────────┤
│ UNINSTALL SECTION                                                    │
│ ┌──────────────────────────────────────────────────┐ ┌────┐ ┌────┐  │
│ │ 🔍 Search packages...                            │ │ ▾  │ │ ⟳  │  │
│ └──────────────────────────────────────────────────┘ └────┘ └────┘  │
│ 142 of 380 packages                                                  │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ ☐  com.whatsapp                                        [user] │   │
│ │ ☐  com.spotify.music                                   [user] │   │
│ │    ...                                                        │   │
│ └────────────────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  [Uninstall (2)]                                                 │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.5 Safety Tier Color Coding

| Tier | Badge Color | Meaning |
|---|---|---|
| Recommended | `bg-emerald-500/15 text-emerald-500` | Safe to remove, improves privacy/battery |
| Advanced | `bg-amber-500/15 text-amber-500` | Some functionality loss possible |
| Expert | `bg-orange-500/15 text-orange-500` | Significant functionality loss |
| Unsafe | `bg-red-500/15 text-red-500` | Risk of bootloop, requires expert mode |
| Unlisted | `bg-zinc-500/15 text-zinc-500` | Not in UAD database |

### 3.6 Package State Indicators

| State | Visual | Color |
|---|---|---|
| Enabled | Solid dot | `text-emerald-500` |
| Disabled | Half dot | `text-amber-500` |
| Uninstalled | Empty dot | `text-zinc-400` |

---

## 4. Architecture

### 4.1 Data Flow

```
┌──────────────────────┐     ┌──────────────────────┐
│   UAD GitHub JSON    │────▶│  Rust: fetch + cache  │
│   (remote/bundled)   │     │  debloat/lists.rs     │
└──────────────────────┘     └──────────┬───────────┘
                                        │
        ┌───────────────────────────────┘
        ▼
┌───────────────────┐     ┌─────────────────────────┐
│ Rust: sync device │────▶│  Tauri Command:          │
│ pm list packages  │     │  get_debloat_packages    │
│ -s -u / -s -e     │     │  Returns merged list     │
└───────────────────┘     └──────────┬──────────────┘
                                     │
        ┌────────────────────────────┘
        ▼
┌────────────────────────────────────────────────┐
│  Frontend: ViewAppManager                       │
│  Tab 1: Debloater (filter + select + action)   │
│  Tab 2: Installation (existing APK flow)       │
└────────────────────────────────────────────────┘
```

### 4.2 New Rust Types

```rust
// src-tauri/src/debloat/mod.rs

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebloatPackage {
    pub id: String,
    pub list: DebloatList,
    pub description: String,
    pub dependencies: Vec<String>,
    pub needed_by: Vec<String>,
    pub labels: Vec<String>,
    pub removal: RemovalTier,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
pub enum DebloatList {
    Aosp, Carrier, Google, Misc, Oem, Pending, Unlisted,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
pub enum RemovalTier {
    Recommended, Advanced, Expert, Unsafe, Unlisted,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
pub enum PackageState {
    Enabled, Disabled, Uninstalled,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebloatPackageRow {
    pub name: String,
    pub state: PackageState,
    pub description: String,
    pub list: DebloatList,
    pub removal: RemovalTier,
    pub dependencies: Vec<String>,
    pub needed_by: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebloatListStatus {
    pub source: String,
    pub last_updated: String,
    pub total_entries: usize,
}
```

### 4.3 New Tauri Commands

| Command | Signature | Description |
|---|---|---|
| `load_debloat_lists` | `() -> CmdResult<DebloatListStatus>` | Fetch UAD JSON from GitHub, cache locally, fallback to bundled |
| `get_debloat_packages` | `() -> CmdResult<Vec<DebloatPackageRow>>` | Merge device packages with UAD metadata |
| `debloat_packages` | `(packages, action) -> CmdResult<Vec<DebloatActionResult>>` | Apply uninstall/disable/restore |
| `restore_packages` | `(packages) -> CmdResult<Vec<DebloatActionResult>>` | Restore previously removed packages |

### 4.4 New Frontend Types

```typescript
// models.ts additions
export type DebloatList = 'Aosp' | 'Carrier' | 'Google' | 'Misc' | 'Oem' | 'Pending' | 'Unlisted';
export type RemovalTier = 'Recommended' | 'Advanced' | 'Expert' | 'Unsafe' | 'Unlisted';
export type PkgState = 'Enabled' | 'Disabled' | 'Uninstalled';

export interface DebloatPackageRow {
  name: string;
  state: PkgState;
  description: string;
  list: DebloatList;
  removal: RemovalTier;
  dependencies: string[];
  neededBy: string[];
}

export interface DebloatListStatus {
  source: string;
  lastUpdated: string;
  totalEntries: number;
}

export interface DebloatActionResult {
  packageName: string;
  success: boolean;
  error: string | null;
}
```

---

## 5. File Changes Map

### 5.1 New Files

| File | Purpose |
|---|---|
| `src-tauri/src/debloat/mod.rs` | Types + list loading (remote, cache, bundled fallback) |
| `src-tauri/src/debloat/sync.rs` | Device package sync + state detection |
| `src-tauri/src/debloat/actions.rs` | Package state change commands |
| `src-tauri/src/commands/debloat.rs` | Thin Tauri command wrappers |
| `src-tauri/resources/uad_lists.json` | Bundled fallback UAD list (~824KB) |
| `src/components/views/debloater/DebloaterTab.tsx` | Debloater tab component |
| `src/components/views/debloater/InstallationTab.tsx` | Installation tab (refactored) |
| `src/components/views/debloater/ReviewSelectionDialog.tsx` | Batch action review modal |
| `src/components/views/debloater/DescriptionPanel.tsx` | Package info display panel |
| `src/lib/debloatStore.ts` | Zustand store for debloat state |

### 5.2 Modified Files

| File | Change |
|---|---|
| `src/components/views/ViewAppManager.tsx` | Rewrite: single Card + Tabs shell |
| `src/lib/desktop/models.ts` | Add debloat DTOs |
| `src/lib/desktop/backend.ts` | Add debloat command wrappers |
| `src-tauri/src/commands/mod.rs` | Add `pub mod debloat;` |
| `src-tauri/src/lib.rs` | Register new commands |
| `src-tauri/permissions/autogenerated.toml` | Add debloat command permissions |

---

## 6. Implementation Phases

### Phase 1 — Backend Foundation (Rust)

1. Create `src-tauri/src/debloat/mod.rs` with types
2. Implement `load_debloat_lists()` — HTTP fetch from UAD GitHub → cache → bundled fallback
3. Implement `sync_device_packages()` — runs `pm list packages -s -u`, `-s -e`, `-s -d` and merges with UAD data
4. Implement `apply_package_action()` — pm uninstall/disable/restore commands
5. Create `src-tauri/src/commands/debloat.rs` with 4 Tauri commands
6. Register commands in `lib.rs`
7. Bundle `uad_lists.json` in resources
8. Add permission entries

### Phase 2 — Frontend Store + Types

1. Add DTOs to `models.ts`
2. Add command wrappers to `backend.ts`
3. Create `debloatStore.ts` with filters, selection, expert mode, list status

### Phase 3 — UI Redesign

1. Refactor `ViewAppManager.tsx` into tabbed layout
2. Extract current install/uninstall logic into `InstallationTab.tsx`
3. Build `DebloaterTab.tsx` with virtualized list, toolbar filters, description panel, action bar
4. Build `ReviewSelectionDialog.tsx`
5. Build `DescriptionPanel.tsx`

### Phase 4 — Polish + Testing

1. Loading states, error handling, toasts
2. Expert mode toggle (gates Unsafe package selection)
3. Dependency warnings when selecting packages with `neededBy`
4. Keyboard navigation
5. Verify all quality gates pass

---

## 7. Component Design — ViewAppManager Shell

```tsx
<Card>
  <CardHeader>
    <CardTitle><Package /> Applications</CardTitle>
    <CardDescription>Manage, debloat, and install apps</CardDescription>
  </CardHeader>
  <CardContent className="p-0">
    <Tabs defaultValue="debloater">
      <TabsList variant="line" className="px-6">
        <TabsTrigger value="debloater"><Shield /> Debloater</TabsTrigger>
        <TabsTrigger value="installation"><Package /> Installation</TabsTrigger>
      </TabsList>
      <div className="p-6">
        <TabsContent value="debloater"><DebloaterTab /></TabsContent>
        <TabsContent value="installation"><InstallationTab /></TabsContent>
      </div>
    </Tabs>
  </CardContent>
</Card>
```

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| UAD lists fetched at tab open, not app startup | Avoid blocking app launch |
| Bundled fallback JSON | Works offline; ~824KB acceptable |
| Disable mode as toggle, not default | Uninstall is more thorough |
| Expert mode gates Unsafe packages | Prevents accidental bootloops |
| No multi-user in Phase 1 | Simplifies; user 0 covers 95% |
| Review dialog before batch apply | Safety checkpoint |
| Separate Rust module (`debloat/`) | Isolated from `commands/apps.rs` |
| Existing uninstall stays in Installation tab | Debloater = system; Installation = user apps |
| Single Card + Tabs | Consistent with Emulator Manager Design 3 |

---

## 9. Safety Features

1. **Expert Mode Gate**: Unsafe packages cannot be selected unless expert mode is ON
2. **Dependency Warnings**: Selecting a package with `neededBy` entries shows a warning toast
3. **Review Dialog**: Always shown before batch actions — includes safety tier breakdown
4. **Disclaimer Banner**: Permanent warning about factory reset risk
5. **Restore Support**: Uninstalled packages can be restored via `cmd package install-existing`
6. **Logging**: Every action logged to LogStore
7. **No Root Required**: All operations use `--user 0` flag

---

## 10. Quality Gates

- [ ] `bun run format:check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` passes
- [ ] All new Rust structs have `#[serde(rename_all = "camelCase")]`
- [ ] All new commands return `CmdResult<T>`
- [ ] Frontend error handling wraps Tauri calls in try/catch
- [ ] Uses `@/` alias, `cn()`, semantic tokens
- [ ] Memory bank updated

---

## 11. Additional UAD Features (Now In-Scope)

### 11.1 Backup & Restore System (`save.rs`)

Snapshot the current state of every system package before debloating. Critical safety net.

- **Create Backup**: Save `{packageName: state}` map as timestamped JSON to app data dir
- **Restore Backup**: Re-apply a saved state (re-enable/reinstall packages that were removed)
- **Multiple Snapshots**: Pick from a list of historical backups via dropdown
- **Per-Device Storage**: Each `device_id` gets its own backup directory
- **Auto-prompt**: Review dialog prompts "Create backup first?" before applying actions

New Tauri commands: `create_debloat_backup`, `list_debloat_backups`, `restore_debloat_backup`

### 11.2 SDK-Aware Commands (`sync.rs`)

UAD generates different ADB commands based on Android version. We MUST do this to avoid breakage.

| SDK   | Version | Uninstall                       | Disable                             | Restore                          |
|-------|---------|---------------------------------|-------------------------------------|----------------------------------|
| ≥23   | 6.0+    | `pm uninstall --user N`         | `pm disable-user` + `am force-stop` + `pm clear` | `cmd package install-existing`   |
| 21-22 | 5.x     | `pm hide` + `pm clear`          | N/A                                 | `pm unhide`                      |
| 19-20 | 4.4     | `pm block` + `pm clear`         | N/A                                 | `pm unblock` + `pm clear`        |
| <19   | <4.4    | `pm uninstall` (no user flag)   | N/A                                 | N/A (not reversible)             |

Implementation: `resolve_debloat_command(sdk_version, action)` helper in Rust.

### 11.3 Disable Mode Toggle (`settings.rs`)

Per-device setting that changes the default action from "Uninstall" to "Disable":

- `pm disable-user --user 0` instead of `pm uninstall --user 0`
- Only available on Android 6.0+ (SDK ≥ 23) — show "Unavailable" badge for older
- Toggle lives in the status bar of the Debloater tab
- Safer than uninstall — package stays on device but is inactive
- Stored per-device so different devices can have different modes

### 11.4 UAD List Auto-Update (`update.rs`)

Keep the community debloat lists fresh without requiring an app update:

- "Update Lists" button in status bar fetches latest `uad_lists.json` from GitHub
- Show "Last updated: X ago" timestamp
- 30s timeout with cached/bundled fallback on failure
- Cache to `app_data_dir/debloat/uad_lists.json`
- Three-tier fallback: remote → cached → bundled

### 11.5 Multi-User Mode (`sync.rs` + `settings.rs`)

Android supports multiple user profiles. UAD handles this with a toggle:

- `pm list users` to discover all profiles
- Protected user detection (work profiles that can't be touched)
- Toggle: "Affect all users" — applies actions to every non-protected user
- Per-user package state tracking (a package can be enabled for user 0 but disabled for user 10)
- Default: user 0 only (safest)

### 11.6 Export/Import Selection Profiles

Save debloat selections as shareable files:

- **Export**: Save selected package names + actions to JSON file
- **Import**: Load a previously saved selection file
- Use case: Re-apply after factory reset or OTA update reinstalls bloatware
- Use case: Share "Samsung debloat profile" with friends

### 11.7 Per-Device Settings Persistence (`config.rs`)

Save device-specific preferences (disable mode, multi-user, expert mode) so they persist:

- Keyed by `device_id` (serial number)
- Stored in app data dir as JSON
- Auto-loaded when device connects
- Settings: `disable_mode`, `multi_user_mode`, `expert_mode`

---

## 12. Feature Priority Matrix

| # | Feature | Priority | Effort | Phase |
|---|---------|----------|--------|-------|
| 1 | Core debloater (list + uninstall + restore) | 🔴 Must | High | 1 |
| 2 | SDK-aware commands | 🔴 Must | Low | 1 |
| 3 | Backup/Restore system | 🔴 Must | Medium | 1 |
| 4 | UAD list auto-update | 🟡 High | Low | 1 |
| 5 | Disable mode toggle | 🟡 High | Low | 1 |
| 6 | Review dialog with safety recap | 🟡 High | Medium | 1 |
| 7 | Per-device settings persistence | 🟢 Nice | Low | 2 |
| 8 | Multi-user mode | 🟢 Nice | Medium | 2 |
| 9 | Export/Import profiles | 🟢 Nice | Low | 2 |
| 10 | OEM auto-detect via `ro.product.brand` | 🟢 Nice | Low | 2 |
| 11 | Batch presets (Privacy/Battery/Minimal) | 🔵 Future | Medium | 3 |
| 12 | Custom community lists | 🔵 Future | Medium | 3 |
| 13 | Undo history | 🔵 Future | Medium | 3 |
