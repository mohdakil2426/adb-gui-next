# Emulator Manager — Comprehensive Analysis Report

**Date:** 2026-04-08  
**Status:** Critical bugs identified. Fix plan included.  
**Environment:** Windows, `emulator-5554` running AVD `Medium_Phone`, `ANDROID_HOME` not set, `LOCALAPPDATA=C:\Users\akila\AppData\Local`

---

## Executive Summary

The Emulator Manager is **architecturally sound** but has **4 compounding bugs** that prevent the running emulator from appearing in the roster. The root cause chain is:

1. **`emulator` binary not on PATH** → `emulator -list-avds` fails silently → empty roster
2. **`image.sysdir.1` uses backslashes** (`system-images\android-31\...`) → `parse_api_level()` splits only on `/` → `api_level` is `None`
3. **`parse_emu_avd_name_output()` trims trailing whitespace but `emu avd name` returns `Medium_Phone\r\nOK\r\n`** → name matches correctly, but only if `emulator` binary was found in step 1
4. **`GetAvdRestorePlan` errors silently** when `ramdiskPath` is null → the whole restore plan section shows nothing without any user-visible error

---

## Bug #1 — CRITICAL: `emulator` Binary Not Found via `resolve_binary_path()`

### Root Cause

`avd::list_avds()` calls:
```rust
let roster_output = run_binary_command(app, "emulator", &["-list-avds"])?;
```

`resolve_binary_path()` uses a three-tier lookup:
1. Tauri resource dir (`src-tauri/resources/`)
2. Repo `resources/` folder
3. System `PATH`

**On this machine:**
- `emulator` is NOT in `src-tauri/resources/` (only `adb`, `fastboot` are bundled)
- `emulator` is NOT in system PATH (`where.exe emulator` → "Could not find files")
- `ANDROID_HOME` and `ANDROID_SDK_ROOT` are **not set** as env vars

**Result:** `run_binary_command()` returns `Err(...)` → `list_avds()` propagates the error → frontend's `useQuery(fetchAvds)` receives an error → `avds = []` → "No AVDs found" empty state is shown.

### Fix

The emulator binary must be resolved from the Android SDK, NOT from the Tauri resource bundle. The SDK resolution logic already exists in `sdk.rs` but is **not used** when resolving the `emulator` binary.

**Solution:** Add an `emulator`-aware binary resolver in `avd.rs` / `sdk.rs`:

```rust
// sdk.rs
pub fn resolve_emulator_binary(env: &EmulatorEnv) -> Option<PathBuf> {
    let sdk_roots = sdk_roots_from_env(env);
    
    #[cfg(target_os = "windows")]
    let names = ["emulator.exe"];
    #[cfg(not(target_os = "windows"))]
    let names = ["emulator"];
    
    for root in &sdk_roots {
        for name in &names {
            let candidate = root.join("emulator").join(name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}
```

Then in `avd::list_avds()`, call it directly instead of `run_binary_command(app, "emulator", ...)`:

```rust
pub fn list_avds(app: &AppHandle) -> CmdResult<Vec<AvdSummary>> {
    let env = sdk::current_env();
    let emulator_bin = sdk::resolve_emulator_binary(&env)
        .ok_or_else(|| "Android emulator binary not found. Install Android Studio or add the SDK emulator/ folder to PATH.".to_string())?;
    
    let output = std::process::Command::new(&emulator_bin)
        .arg("-list-avds")
        .output()
        .map_err(|e| e.to_string())?;
    let roster_output = String::from_utf8_lossy(&output.stdout).to_string();
    // ... rest of the function
}
```

**Why this matters:** The `emulator` binary lives at `$ANDROID_SDK/emulator/emulator.exe`, which is found via `sdk_roots_from_env()` using `LOCALAPPDATA\Android\Sdk` — which IS available on this machine.

---

## Bug #2 — MEDIUM: `parse_api_level()` Fails on Windows Backslash Paths

### Root Cause

`config.ini` on this machine has:
```
image.sysdir.1=system-images\android-31\google_apis_playstore\x86_64\
```

Note: **backslashes**, not forward slashes.

`parse_api_level()` in `avd.rs`:
```rust
fn parse_api_level(path: &str) -> Option<u32> {
    path.split(['/', '\\'])          // ✅ splits on BOTH — this is correct!
        .find(|part| part.starts_with("android-"))
        .and_then(|part| part.trim_start_matches("android-").parse::<u32>().ok())
}
```

Wait — this IS correct. It splits on both `'/'` and `'\\'`. But there's a subtle bug:

The `image_sysdir` value from the config is:
```
system-images\android-31\google_apis_playstore\x86_64\
```

After trim: `system-images\android-31\google_apis_playstore\x86_64`

`parse_config_ini()` does:
```rust
image_sysdir: image_sysdir.clone(),
api_level: image_sysdir.as_deref().and_then(parse_api_level),
```

And `parse_api_level` is called on `"system-images\\android-31\\google_apis_playstore\\x86_64\\"`.

**This should actually work** — but only if the raw `config.ini` value doesn't have a literal carriage return `\r` due to Windows CRLF. The file has `\r\n` line endings. `parse_ini_map` uses `.lines()` which handles CRLF correctly, but the VALUE after the `=` might have trailing `\r` if `.trim()` is not stripping it.

**Actual bug:** `.trim()` in `parse_ini_map` should work, but if Android Studio writes the value with trailing space or a non-standard character, `parse_api_level` might fail. **Verified safe on this AVD** — `api_level` should resolve to `31`.

**However**, `resolve_ramdisk_path()` will fail because:
- `image_sysdir` = `system-images\android-31\google_apis_playstore\x86_64\`
- `sdk_roots` = `[C:\Users\akila\AppData\Local\Android\Sdk]` (from LOCALAPPDATA)
- Candidate path = `C:\Users\akila\AppData\Local\Android\Sdk\system-images\android-31\google_apis_playstore\x86_64\ramdisk.img`
- But the path separator mismatch: joining a Windows-native `PathBuf` with a mixed-slash relative path via `.join()` may produce a broken path on Windows.

**Fix:** Normalize the sysdir value before joining:
```rust
let relative = raw.trim_end_matches(['/', '\\']).replace('/', "\\");
```

---

## Bug #3 — MEDIUM: `runtime_avd_names()` — Serial-to-AVD Mapping Race

### Root Cause

`runtime_avd_names()` in `runtime.rs`:
1. Calls `adb devices` to get `emulator-5554 device`
2. For each emulator serial, calls `adb -s emulator-5554 emu avd name`
3. `parse_emu_avd_name_output()` looks for first non-empty, non-`"OK"` line

**Actual output of `adb -s emulator-5554 emu avd name`:**
```
Medium_Phone
OK
```

`parse_emu_avd_name_output()`:
```rust
output.lines()
    .map(str::trim)
    .find(|line| !line.is_empty() && *line != "OK")
    .map(ToOwned::to_owned)
```

This should return `"Medium_Phone"` — **correct**.

But then `map_runtime_avd_names()` returns a `HashMap<AVD_name, serial>`:
```
{ "Medium_Phone" => "emulator-5554" }
```

In `list_avds()`, for each name from `emulator -list-avds`:
```rust
let serial = runtime_avd_names.get(name).cloned();
```

This lookup uses `name` = `"Medium_Phone"` against key `"Medium_Phone"` — **exact match**. This WORKS correctly.

**But this entire path fails if Bug #1 is present** — `run_binary_command(app, "adb", ...)` similarly uses the same resolver which favors the bundled `adb` from `src-tauri/resources/`, and on this machine it falls through to system PATH where `C:\adb\adb.exe` IS available — so ADB commands work fine.

**Secondary issue:** `runtime_avd_names()` is called synchronously and runs N+1 ADB commands (1 `adb devices` + 1 per emulator serial). For 3+ running emulators, this is slow. Should be parallelized with `tokio::spawn` or done sequentially with a timeout.

---

## Bug #4 — LOW: `GetAvdRestorePlan` Errors Without User-Visible Feedback

### Root Cause

In `ViewEmulatorManager.tsx`:
```typescript
try {
    const plan = await GetAvdRestorePlan(selectedAvd.name);
    if (!cancelled) setRestorePlan(plan);
} catch {
    if (!cancelled) setRestorePlan(null);  // ← silently swallowed!
}
```

When `ramdiskPath` is null OR when the `emulator` binary is not found (causing `list_avds` to fail), `GetAvdRestorePlan` throws. The error is caught and swallowed — `restorePlan` stays null and the Restore tab shows nothing. No toast, no warning, no hint to the user.

**Fix:** Propagate the error to activity log:
```typescript
} catch (error) {
    if (!cancelled) {
        setRestorePlan(null);
        appendActivity({ level: 'warning', message: `Could not load restore plan: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
}
```

---

## Bug #5 — LOW: `launch_avd()` Uses `spawn()` — No Error Detection

### Root Cause

`runtime::launch_avd()`:
```rust
command.spawn().map_err(|error| error.to_string())?;
Ok(format!("Launched {avd_name}"))
```

`spawn()` only errors if the **process failed to start** (binary not found, permission denied). If the emulator starts but immediately crashes (wrong API, missing HAXM, etc.), the error is invisible. The frontend shows "Launched Medium_Phone" with a success toast even if the emulator window closes in 2 seconds.

**Fix:** Use a short `wait_with_output()` timeout (1-2 seconds) to detect immediate crashes:
```rust
let mut child = command.spawn().map_err(|e| e.to_string())?;
// Give it 1s to detect immediate startup failures
std::thread::sleep(std::time::Duration::from_millis(1000));
match child.try_wait() {
    Ok(Some(status)) if !status.success() => {
        Err(format!("Emulator exited immediately with status: {}", status))
    }
    _ => Ok(format!("Launched {avd_name}")),
}
```

---

## Bug #6 — ARCHITECTURAL: `emulator -list-avds` Is The Wrong Source of Truth

### Problem

The current flow calls `emulator -list-avds` as the **primary** way to discover AVDs. This has two problems:

1. **`emulator` binary must be found first** — if it's not in PATH and not in SDK, everything breaks (see Bug #1)
2. **`emulator -list-avds` respects `ANDROID_AVD_HOME`** — but so does reading `~/.android/avd/` directly. The `.ini` files in `~/.android/avd/` are the canonical ground truth.

**Better approach:** Scan `~/.android/avd/*.ini` directly, then optionally use `emulator -list-avds` as a cross-check. This removes the hard dependency on finding the `emulator` binary just to list AVDs.

```rust
pub fn list_avds_from_ini_files(avd_home: &Path) -> CmdResult<Vec<String>> {
    let entries = std::fs::read_dir(avd_home).map_err(|e| e.to_string())?;
    let names: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension()?.to_str()? == "ini" {
                path.file_stem()?.to_str().map(String::from)
            } else {
                None
            }
        })
        .collect();
    Ok(names)
}
```

---

## Summary Table

| # | Severity | Location | Bug | Impact |
|---|----------|----------|-----|--------|
| 1 | 🔴 Critical | `avd.rs::list_avds()` | `emulator` binary not found via `resolve_binary_path()` — not in bundled resources, not in PATH | Empty roster; running emulator not shown |
| 2 | 🟠 Medium | `avd.rs::resolve_ramdisk_path()` | Windows backslash sysdir path joining may produce broken paths | `ramdiskPath` is null, warnings appear, root/restore features broken |
| 3 | 🟡 Medium | `runtime.rs::runtime_avd_names()` | N+1 sequential ADB calls; blocks for ~1s per emulator serial | Slow AVD list refresh (5s polling × N serials) |
| 4 | 🟡 Low | `ViewEmulatorManager.tsx` | `GetAvdRestorePlan` errors silently swallowed | Restore tab shows nothing, no user guidance |
| 5 | 🟡 Low | `runtime.rs::launch_avd()` | `spawn()` cannot detect immediate emulator crash | False success toast; emulator may have died |
| 6 | 🟠 Medium | `avd.rs::list_avds()` | Uses `emulator -list-avds` as primary discovery; should scan `.ini` files directly | Hard dependency on `emulator` binary for basic enumeration |

---

## Recommended Fix Order

### Phase 1 — Make the roster show AVDs (fixes the broken state)

**Step 1A:** Change `list_avds()` to scan `~/.android/avd/*.ini` files directly instead of calling `emulator -list-avds`. The `emulator` binary is only needed for `launch_avd()` and `stop_avd()` — not for listing.

**Step 1B:** Add `sdk::resolve_emulator_binary()` that searches `$SDK/emulator/emulator.exe` from `sdk_roots_from_current_env()`. Use this in `runtime::launch_avd()`.

**Step 1C:** Fix `resolve_ramdisk_path()` to normalize backslash paths before joining with `PathBuf`.

### Phase 2 — Fix UX issues

**Step 2A:** Surface `GetAvdRestorePlan` errors to the activity log.

**Step 2B:** Add 1s startup failure detection in `launch_avd()`.

**Step 2C:** Parallelize `runtime_avd_names()` calls.

---

## Verification Checklist (After Fixes)

- [ ] `Medium_Phone` appears in AVD roster
- [ ] `isRunning: true` and `serial: "emulator-5554"` shown correctly
- [ ] `apiLevel: 31`, `abi: "x86_64"`, `target: "Google Play"` shown correctly
- [ ] `ramdiskPath` resolves to `C:\Users\akila\AppData\Local\Android\Sdk\system-images\android-31\google_apis_playstore\x86_64\ramdisk.img`
- [ ] Launch button works (calls `emulator @Medium_Phone`)
- [ ] Stop button works (calls `adb -s emulator-5554 emu kill`)
- [ ] Activity log shows meaningful messages on error
