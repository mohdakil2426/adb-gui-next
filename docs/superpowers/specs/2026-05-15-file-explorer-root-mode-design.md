# File Explorer Root Access Design

## Goal

Add an explicit root-access grant to File Explorer for rooted Android devices without turning the whole explorer into a different mode.

## Requirements

- The File Explorer keeps its current path, history, selection behavior, toolbar, and table behavior when root access is enabled or disabled.
- The toolbar shield verifies `su -c id -u` before granting root access.
- The active shield state is red and uses `ShieldCheck`; inactive uses `Shield`.
- The tree panel always keeps the normal top-level shortcuts and renames the old `data` shortcut to `root`.
- The `root` tree shortcut points to `/`.
- File commands use root only for root-owned paths after the grant is verified. Normal storage paths (`/sdcard`, `/storage`, `/mnt`) remain normal even while the shield is active.
- No automatic remount behavior is added. Read-only partitions surface the real command failure.

## Data Model

Frontend stores a boolean root grant:

```ts
rootAccessGranted: boolean
```

The access mode is derived per operation:

```ts
getFileAccessModeForPath(path, rootAccessGranted) -> 'normal' | 'root'
```

This avoids the bogus global-mode data model where enabling the shield changed the entire explorer.

## IPC Contract

The existing `FileAccessMode` IPC value stays useful at the backend boundary:

```ts
type FileAccessMode = 'normal' | 'root'
```

The frontend must pass it per target path. Backend command behavior remains:

- `normal`: preserve safe write prefix validation.
- `root`: verify path shape, bypass safe-prefix restrictions, execute shell mutations through `su -c`, and stage protected push/pull under `/data/local/tmp/adb-gui-next-root-transfer/`.

## Verification

Success is testable by:

1. Enable shield from `/sdcard/` -> verify root, reload `/sdcard/` with `normal`, and do not navigate to `/`.
2. Expand the tree `root` shortcut while granted -> `ListFiles('/', serial, 'root')`.
3. Shield active button has `text-destructive`.
4. Existing normal storage behavior remains unchanged.
