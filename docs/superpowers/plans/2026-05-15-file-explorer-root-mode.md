# File Explorer Root Access Implementation Plan

1. Keep backend root IPC support -> verify: `FileAccessMode` remains accepted by list/create/rename/delete/push/pull commands.
2. Replace frontend global root mode with `rootAccessGranted` -> verify: enabling the shield does not navigate away from the current path.
3. Add `getFileAccessModeForPath()` -> verify: `/sdcard`, `/storage`, and `/mnt` use `normal`; `/`, `/data`, `/system`, and other root-owned paths use `root` only after the grant is verified.
4. Keep the tree shape stable -> verify: top-level nodes are `sdcard`, `storage`, `root`, and no `data` shortcut remains.
5. Make the shield reflect grant state -> verify: active state uses `ShieldCheck` plus `text-destructive`.
6. Update focused tests -> verify: root access grant test, tree root loading test, and multi-device IPC routing test pass.
7. Run project checks -> verify: focused Vitest, full Vitest, web lint/format/build, Rust lint, and GitNexus change detection where practical.
