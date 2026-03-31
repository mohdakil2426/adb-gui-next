# Plan: Async Commands + Progressive Loading Bar

**Date:** 2026-03-30
**Context:** Commands like `list_files`, `get_installed_packages`, `reboot`, `delete_files`, `list_payload_partitions` use synchronous `std::process::Command::output()` which blocks the Tauri main thread, causing the WebView to freeze. The user wants a loading bar to show progress during these operations.

---

## Problem

Currently, **sync commands block the Tauri command thread**. Tauri runs all `#[tauri::command]` functions on its main thread by default. Only `async fn` commands get spawned into a thread pool. The following commands are currently synchronous `fn` but perform blocking I/O:

| Command | Module | Blocking Operation | Typical Duration |
|---------|--------|--------------------|-----------------|
| `get_devices` | device | `adb devices` | 200–500ms |
| `get_fastboot_devices` | device | `fastboot devices` | 200–500ms |
| `get_device_info` | device | 11+ `adb shell` calls (`getprop`, `df`, `cat`, etc.) | 1–5s |
| `get_device_mode` | device | calls `get_devices` + `get_fastboot_devices` | 400–1000ms |
| `reboot` | fastboot | `adb reboot` or `fastboot reboot` | 200–500ms |
| `get_bootloader_variables` | fastboot | `fastboot getvar all` | 500ms–2s |
| `run_fastboot_host_command` | fastboot | arbitrary fastboot command | varies |
| `run_adb_host_command` | adb | arbitrary adb command | varies |
| `run_shell_command` | adb | `adb shell <cmd>` | varies |
| `connect_wireless_adb` | adb | `adb connect` | 500ms–3s |
| `disconnect_wireless_adb` | adb | `adb disconnect` | 200–500ms |
| `enable_wireless_adb` | adb | `adb tcpip` | 500ms–2s |
| `get_installed_packages` | apps | 2× `adb shell pm list packages` | 1–5s |
| `list_files` | files | `adb shell ls -lA <path>` | 200ms–3s |
| `pull_file` | files | `adb pull` | seconds–minutes |
| `push_file` | files | `adb push` | seconds–minutes |
| `delete_files` | files | `adb shell rm -rf ...` | 200ms–5s |
| `rename_file` | files | `adb shell mv` | 200ms |
| `create_file` | files | `adb shell touch` | 200ms |
| `create_directory` | files | `adb shell mkdir` | 200ms |
| `list_payload_partitions` | payload | open+index ZIP + parse manifest | 500ms–3s |
| `list_payload_partitions_with_details` | payload | same + detail extraction | 1–5s |
| `set_active_slot` | fastboot | `fastboot set-active=` | 200–500ms |
| `save_log` | system | file write | <50ms |
| `open_folder` | system | OS path opener | <50ms |
| `launch_device_manager` | system | `cmd start devmgmt.msc` | <50ms |
| `launch_terminal` | system | `cmd start cmd` | <50ms |

---

## Solution

### 1. Make all blocking commands `async fn`

Tauri will automatically spawn `async fn` commands in its thread pool, keeping the WebView responsive. Since `run_binary_command` uses `std::process::Command::output()` (which is sync), we use `tokio::task::block_in_place` to tell the Tokio runtime to treat the blocking call appropriately.

**Approach for commands that call `run_binary_command`:**
```rust
// Before
#[tauri::command]
pub fn get_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    run_binary_command(&app, "adb", &["devices"])?;
    // ...
}

// After
#[tauri::command]
pub async fn get_devices(app: AppHandle) -> CmdResult<Vec<Device>> {
    tokio::task::block_in_place(|| {
        run_binary_command(&app, "adb", &["devices"])?;
        // ...
    })
}
```

**Approach for `get_device_info`** (which makes 11+ sequential `get_prop` calls):
- Wrap the entire function body in a single `block_in_place` call
- This is the existing pattern used by `extract_payload` in `commands/payload.rs`

**Commands that are purely filesystem/OS (no external process):** `save_log`, `open_folder`, `launch_device_manager`, `launch_terminal` — these are trivially fast (<50ms), but should also be async for consistency since they call `fs::write`, `Command::new().spawn()`, etc.

### 2. Add progress reporting infrastructure

Create a shared `ProgressHandle` type that commands can optionally accept to emit progress events:

```rust
// src-tauri/src/commands/progress.rs (new module)
pub struct ProgressHandle {
    app: AppHandle,
    command_id: String,
}

impl ProgressHandle {
    pub fn emit(&self, percent: u8, message: &str) {
        let _ = self.app.emit("command:progress", CommandProgress {
            command_id: self.command_id.clone(),
            percent,
            message: message.to_string(),
        });
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandProgress {
    pub command_id: String,
    pub percent: u8,
    pub message: String,
}
```

**Only multi-step commands use this** — `get_device_info` (11 sub-calls), `get_installed_packages` (2 calls), `list_payload_partitions_with_details`. Single-shot commands like `reboot`, `list_files`, etc. don't need granular progress — the frontend loading state is sufficient.

### 3. Frontend: `useCommand` hook + `CommandProgressBar`

A generic hook that wraps any `backend.ts` call with loading state, error handling, and progress listening:

```typescript
// src/lib/useCommand.ts (new)
function useCommand<TArgs extends unknown[], TResult>(
  command: (...args: TArgs) => Promise<TResult>,
  options?: { onSuccess?: (result: TResult) => void; onError?: (error: unknown) => void }
) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<CommandProgress | null>(null);

  const execute = useCallback(async (...args: TArgs) => {
    setIsLoading(true);
    setProgress(null);
    try {
      const result = await command(...args);
      options?.onSuccess?.(result);
      return result;
    } catch (error) {
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [command]);

  return { execute, isLoading, progress };
}
```

A thin `<CommandProgressBar>` component renders the animated bar when `isLoading` is true, with optional `progress.percent` + `progress.message` from backend events.

### 4. Frontend: Replace per-view loading state with `useCommand`

Currently each view manages its own loading booleans:
- `ViewDashboard.tsx`: `isRefreshingInfo`, `isRefreshingDevices`
- `ViewAppManager.tsx`: `isLoading`, `isInstalling`, `isUninstalling`
- `ViewFileExplorer.tsx`: `isLoading`, `isDeleting`, `isPushing`, `isPulling`

Replace these with `useCommand` calls that provide `isLoading` automatically. The loading bar appears globally at the top of the view.

---

## Files to Create

| File | Description |
|------|-------------|
| `src-tauri/src/commands/progress.rs` | `ProgressHandle`, `CommandProgress` struct |
| `src/components/CommandProgressBar.tsx` | Thin animated loading bar component |
| `src/lib/useCommand.ts` | Generic hook wrapping backend calls with loading + progress |

## Files to Modify

### Rust (src-tauri/src/)

| File | Changes |
|------|---------|
| `commands/mod.rs` | Add `mod progress; pub use progress::*;` |
| `commands/device.rs` | `get_devices`, `get_fastboot_devices`, `get_device_info`, `get_device_mode` → `async fn` with `block_in_place`. `get_device_info` accepts optional `ProgressHandle`. |
| `commands/adb.rs` | `connect_wireless_adb`, `disconnect_wireless_adb`, `enable_wireless_adb`, `run_adb_host_command`, `run_shell_command` → `async fn` with `block_in_place` |
| `commands/fastboot.rs` | `reboot`, `get_bootloader_variables`, `run_fastboot_host_command`, `set_active_slot` → `async fn` with `block_in_place` |
| `commands/files.rs` | `list_files`, `pull_file`, `push_file`, `delete_files`, `rename_file`, `create_file`, `create_directory` → `async fn` with `block_in_place` |
| `commands/apps.rs` | `get_installed_packages` → `async fn` with `block_in_place` + `ProgressHandle` |
| `commands/payload.rs` | `list_payload_partitions`, `list_payload_partitions_with_details` → `async fn` with `block_in_place` |
| `commands/system.rs` | `launch_device_manager`, `launch_terminal`, `open_folder`, `save_log` → `async fn` (trivially fast, but consistent) |
| `lib.rs` | Register `commands::progress` module (if not auto-pub-used) |

### Frontend (src/)

| File | Changes |
|------|---------|
| `src/lib/useCommand.ts` | New — generic hook |
| `src/components/CommandProgressBar.tsx` | New — thin animated bar |
| `src/components/MainLayout.tsx` | Add `<CommandProgressBar />` in the header area |
| `src/components/views/ViewDashboard.tsx` | Replace manual loading state with `useCommand` |
| `src/components/views/ViewAppManager.tsx` | Replace manual loading state with `useCommand` |
| `src/components/views/ViewFileExplorer.tsx` | Replace manual loading state with `useCommand` |

---

## Implementation Order

| Step | Task | Effort |
|------|------|--------|
| 1 | Create `progress.rs` module (ProgressHandle + CommandProgress) | 10 min |
| 2 | Convert all sync commands to `async fn` with `block_in_place` | 45 min |
| 3 | Wire `ProgressHandle` into `get_device_info` and `get_installed_packages` | 15 min |
| 4 | Create `useCommand.ts` hook | 15 min |
| 5 | Create `CommandProgressBar.tsx` component | 15 min |
| 6 | Integrate into MainLayout + wire event listener | 15 min |
| 7 | Refactor 3 views to use `useCommand` | 30 min |
| 8 | Quality gates (format + lint + build + test) | 15 min |

**Total estimated effort:** ~2.5 hours

---

## Pre-Commit Checklist

```bash
pnpm format:check                  # Gate 1: Format
pnpm lint                          # Gate 2: Lint (ESLint + cargo clippy -D warnings)
pnpm build                         # Gate 3: Type check (tsc before vite build)
cargo test --manifest-path src-tauri/Cargo.toml  # Gate 4: Rust tests
pnpm tauri build --debug           # Gate 5: Full build
```

---

## Verification

1. **WebView stays responsive** — Open DevTools, trigger `get_device_info` (11+ sub-calls). The UI should not freeze; the loading bar should animate smoothly.
2. **Progress events fire** — For multi-step commands, the progress bar should show incremental updates (e.g., "Getting model...", "Getting Android version...").
3. **No regressions** — All existing functionality (flash, install, file operations) should work identically, just without freezing the UI.
4. **Build passes** — `pnpm check` + `pnpm tauri build --debug` succeed.
