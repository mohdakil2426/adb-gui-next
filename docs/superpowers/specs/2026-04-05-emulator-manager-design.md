# Emulator Manager Design

**Date:** 2026-04-05

## Goal

Add a new Advanced view called `Emulator Manager` that manages existing official Android Studio
AVDs, supports safe launch presets, shows runtime/config health, assists with local-package root
flows, and restores stock state from backups.

## Scope

### In Scope

- Discover existing official Android Studio AVDs from the local SDK/AVD directories
- Inspect AVD metadata: name, API, target, ABI, device profile, config path, ramdisk path,
  snapshot/writable-system capability, and backup state
- Show runtime status for launched emulators and map active `adb` serials back to AVDs
- Launch existing AVDs with safe presets and optional advanced flags
- Stop running AVDs
- Open relevant AVD folders/config files from the app
- Root an emulator using a user-selected local package (`.apk` or `.zip`)
- Restore/unroot by putting backed-up AVD artifacts back in place
- Log emulator/root actions in the page and forward summaries to the global log panel

### Out of Scope for V1

- Creating, cloning, renaming, or deleting AVDs
- Third-party emulators
- Bundling or invoking the archived `rootAVD` repo or `EMU.bat`
- Built-in Magisk channel downloaders
- Custom kernel/module injection, `PATCHFSTAB`, USB Host module installation, or fork-specific
  patch menus
- Snapshot CRUD UI beyond launch presets such as `cold boot`, `no snapshot load`, and
  `no snapshot save`

## Product Direction

The page uses the hybrid manager layout:

- Left column: existing AVD roster with health/status badges
- Main header: selected AVD identity, API/ABI/target tags, path health, root/backup state
- Quick actions: `Launch`, `Cold Boot`, `Headless`, `Stop`, `Open AVD Folder`, `Refresh`
- Main detail tabs: `Overview`, `Launch`, `Root`, `Restore`
- Embedded activity log card for emulator-specific operations

This keeps everyday emulator actions fast while moving destructive workflows like `Root`,
`Restore`, `Wipe Data`, and `Writable System` into explicit guided panels.

## UX Rules

### AVD Discovery

- The page loads with a left-side roster of existing AVDs only
- The first AVD auto-selects when nothing is selected
- Missing SDK tools, unreadable config, missing ramdisk, and running/offline mismatches surface as
  inline badges, not only toast errors

### Launch

- Quick actions expose opinionated presets:
  - `Launch` = default boot
  - `Cold Boot` = no snapshot load/save
  - `Headless` = `-no-window -no-audio`
- The `Launch` tab exposes advanced flags:
  - `wipeData`
  - `writableSystem`
  - `noBootAnim`
  - `netSpeed`
  - `netDelay`
- `Wipe Data` and `Writable System` require explicit confirmation in the tab before launch

### Root

- Root accepts a local `.apk` or `.zip` selected by the user
- The app does not know or care whether the package is stable, alpha, delta-style, or another
  compatible fork; compatibility comes from the user-supplied package and the assisted patch flow
- V1 uses an assisted `fake boot` flow instead of embedding Magisk patching logic on the desktop:
  1. Validate the AVD is running and reachable over `adb`
  2. Create backups before any modification
  3. Stage a fake boot image and install the selected package into the emulator
  4. Launch the app inside the emulator and instruct the user to patch the staged fake boot image
  5. Finalize by pulling the patched artifact, extracting the patched ramdisk on-device, and
     replacing the AVD ramdisk on disk
  6. Shut down the emulator and instruct the user to cold boot

This mirrors the compatibility advantage of `rootAVD` without shipping or depending on it.

### Restore

- Restore is one-click once backups exist
- The page shows exactly which files will be restored
- Restore always prefers app-created backups and refuses to run if backup metadata is incomplete
- Restore does not silently delete backups; it restores stock state and leaves backups intact

## Architecture

### Backend

Add a dedicated `src-tauri/src/emulator/` module with focused responsibilities:

- `models.rs` — serializable DTOs and request/response types
- `sdk.rs` — Android SDK, `emulator`, `avdmanager`, and AVD home resolution
- `avd.rs` — AVD discovery, config parsing, path inspection, and backup/root-state synthesis
- `runtime.rs` — running emulator detection, launch argument building, launch/stop helpers
- `backup.rs` — backup creation, manifest persistence, restore planning
- `root.rs` — assisted fake-boot root orchestration and restore finalization helpers

Add a thin command wrapper `src-tauri/src/commands/emulator.rs` and register new Tauri commands in
`src-tauri/src/lib.rs`, following the existing command-module pattern.

### Frontend

Add a focused emulator feature surface:

- `src/components/views/ViewEmulatorManager.tsx` — top-level page shell
- `src/components/emulator-manager/AvdRoster.tsx` — roster and selection
- `src/components/emulator-manager/EmulatorHeaderCard.tsx` — selected AVD summary
- `src/components/emulator-manager/EmulatorQuickActions.tsx` — launch/stop/open/refresh row
- `src/components/emulator-manager/EmulatorLaunchTab.tsx` — advanced launch flags
- `src/components/emulator-manager/EmulatorRootTab.tsx` — local package selection and guided root
- `src/components/emulator-manager/EmulatorRestoreTab.tsx` — backup/restore surface
- `src/components/emulator-manager/EmulatorActivityCard.tsx` — page-scoped action log

State and integration:

- `src/lib/emulatorManagerStore.ts` — selected AVD, active tab, per-view activity log, in-flight
  action state, root staging state
- `src/lib/desktop/models.ts` — new emulator DTOs
- `src/lib/desktop/backend.ts` — typed wrappers for emulator commands
- `src/lib/queries.ts` — AVD query key and fetch helper

## Data Model

### Core DTOs

- `AvdSummary`
  - `name`
  - `iniPath`
  - `avdPath`
  - `target`
  - `apiLevel`
  - `abi`
  - `deviceName`
  - `ramdiskPath`
  - `hasBackups`
  - `rootState`
  - `isRunning`
  - `serial`
  - `warnings`
- `EmulatorLaunchOptions`
  - `wipeData`
  - `writableSystem`
  - `headless`
  - `coldBoot`
  - `noSnapshotLoad`
  - `noSnapshotSave`
  - `noBootAnim`
  - `netSpeed`
  - `netDelay`
- `RootPreparationRequest`
  - `avdName`
  - `serial`
  - `rootPackagePath`
- `RootPreparationResult`
  - `normalizedPackagePath`
  - `fakeBootRemotePath`
  - `instructions`
- `RootFinalizeResult`
  - `restoredFiles`
  - `nextBootRecommendation`
- `RestorePlan`
  - `entries`
  - `createdAt`
  - `source`

### Root State

`rootState` should be conservative:

- `stock` — no backup overrides present and no obvious Magisk/root markers
- `rooted` — backup exists and runtime/device signals indicate Magisk/root
- `modified` — backup exists or ramdisk differs, but runtime root is inconclusive
- `unknown` — the app cannot inspect enough data safely

## Backend Workflow Details

### SDK and Tool Resolution

Resolution order:

1. `ANDROID_SDK_ROOT`
2. `ANDROID_HOME`
3. OS defaults like `%LOCALAPPDATA%\\Android\\Sdk` or `~/Android/Sdk`
4. System `PATH`

Required tools:

- `emulator`
- `adb`
- `avdmanager` only for inspection/helpful metadata, not creation in v1

### AVD Discovery

Use `emulator -list-avds` as the authoritative roster, then enrich each entry by reading:

- `~/.android/avd/<name>.ini`
- `<avd>.avd/config.ini`

Then merge runtime information from `adb devices` and `adb -s <serial> emu avd name` when
available. If console mapping fails, surface the runtime state as `running-unknown`.

### Root/Restore Safety

- Refuse to root if the selected AVD is not running and online
- Refuse to modify files if backup creation fails
- Never overwrite existing backups silently
- Normalize `.zip` packages into a temporary installable `.apk` only inside app-controlled temp
  storage
- Store backup metadata in app data, but keep backup files next to the original AVD artifacts for
  transparent restore
- Show explicit warnings for `writableSystem`, `wipeData`, and root finalization

## Testing Strategy

### Rust

- Unit-test SDK path resolution
- Unit-test AVD config parsing from fixture strings
- Unit-test launch argument building
- Unit-test backup manifest generation and restore planning
- Unit-test root package normalization and patched-output discovery helpers

### Frontend

- Store tests for selection, tab switching, log append/clear, and in-flight gating
- View tests for empty roster, selected AVD rendering, and disabled destructive buttons when
  prerequisites are missing
- Tab tests for local package validation and confirmation gating

### Verification

- `pnpm test`
- `pnpm build`
- `pnpm lint`
- `pnpm format:check`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

`cargo test` remains desirable, but this repo currently has a pre-existing Windows Tauri DLL issue.
The implementation should still add Rust unit tests and run them where the environment allows.

## Deferred Work

- AVD create/clone/delete flows
- Snapshot save/load/delete management
- Fork-aware package catalogs
- Automatic Magisk version heuristics
- Kernel/module injection and `PATCHFSTAB`
- More advanced emulator networking and sensor controls

## References

- Android Studio `avdmanager`: https://developer.android.com/tools/avdmanager
- Android Emulator command line: https://developer.android.com/studio/run/emulator-commandline
- Local reference only, not a runtime dependency:
  - `docs/refrences/github-repos/rootAVD/README.md`
  - `docs/refrences/github-repos/EMU.bat`
