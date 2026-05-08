# Rooting Pipeline — Diagnostic Analysis & Fix Plan

**Date:** 2026-04-09  
**Scope:** Root cause analysis of why current automated root pipeline fails to produce a bootable rooted emulator.  
**Goal:** 100% automated, one-click rooting with zero user intervention, plus running-state visibility in the AVD Switcher.

---

## Table of Contents

1. [Current Flow Walkthrough](#1-current-flow-walkthrough)
2. [Bug Report — 12 Issues Found](#2-bug-report--12-issues-found)
3. [Root Cause of "Done but not rooted"](#3-root-cause-of-done-but-not-rooted)
4. [Fix Plan — Prioritised](#4-fix-plan--prioritised)
5. [AvdSwitcher Boot State UI Enhancement](#5-avdswitcher-boot-state-ui-enhancement)
6. [Pre-Root Checklist — What Must Be True](#6-pre-root-checklist--what-must-be-true)
7. [Post-Root Verification](#7-post-root-verification)
8. [Implementation Order](#8-implementation-order)

---

## 1. Current Flow Walkthrough

When the user clicks **Root → Continue → (waits)**, the following happens in `root.rs::root_avd_automated()`:

```
Step 1: Validate      → Check serial online, find ramdisk path, create .backup
Step 2: Acquire        → Download Magisk stable APK (or use local file)
Step 3: Extract        → Unzip APK, pull magiskboot/magiskinit/magisk64/busybox
Step 4: Push           → adb push all binaries + ramdisk.img to /data/local/tmp/adb-gui-root
Step 5: Patch          → patch_ramdisk_in_emulator() via ADB shell
Step 6: Pull           → adb pull ramdiskpatched.img
Step 7: Write          → fs::copy patched ramdisk → system-image dir
Step 8: Install        → adb install Magisk.apk, cleanup
```

The user then cold-boots the emulator. **Result: emulator boots unrooted.**

---

## 2. Bug Report — 12 Issues Found

### 🔴 BUG-01: `magiskboot decompress` misuse — wrong subcommand

**Location:** `root.rs:353-357`

```rust
adb_shell(app, serial, &format!(
    "{mb} decompress {ROOT_WORKDIR}/ramdisk.img {ROOT_WORKDIR}/ramdisk.cpio"
));
```

**Problem:** `magiskboot decompress` is designed for single-format decompression (e.g., `.gz` → raw). But AVD ramdisk files can be:
- **LZ4-legacy** (most x86_64 AVDs) — magic `02214c18`
- **GZIP** (older AVDs) — magic `1f8b0800`
- **Raw CPIO** (rare)

`magiskboot decompress` may silently fail or produce an invalid CPIO if the format doesn't match expectations. rootAVD detects the compression method first (`detect_ramdisk_compression_method()`) and handles each case differently.

**Impact:** 🔴 Critical — if decompress fails, the entire downstream pipeline operates on garbage data, producing a corrupt `ramdiskpatched.img`.

**Fix:** Before decompressing, detect the compression method. If `magiskboot decompress` returns an error or produces a 0-byte output, try alternative approaches (direct CPIO if raw).

---

### 🔴 BUG-02: Recompression uses hardcoded `lz4_legacy` with fallback — ignores original method

**Location:** `root.rs:434-441`

```rust
adb_shell(app, serial, &format!(
    "{mb} compress=lz4_legacy {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdiskpatched.img \
     || {mb} compress=gz {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdiskpatched.img"
));
```

**Problem:** rootAVD **detects** the original compression method during `detect_ramdisk_compression_method()` and recompresses with the **same method** (`compress=$METHOD`). Our code blindly tries `lz4_legacy` first. If the original ramdisk was gzip-compressed, the emulator bootloader may fail to load an LZ4-compressed ramdisk because it expects gzip.

**Impact:** 🔴 Critical — mismatched compression = emulator fails to decompress ramdisk during boot = boot loop or no Magisk.

**Fix:** Detect the original compression method (check magic bytes via ADB: `xxd -p -l4` on the original ramdisk) and recompress with the same method.

---

### 🔴 BUG-03: No SHA1 hash in config file — Magisk may reject the patch

**Location:** `root.rs:376-377`

```rust
let config_content = "KEEPVERITY=true\nKEEPFORCEENCRYPT=true\nRECOVERYMODE=false";
```

**Problem:** rootAVD includes a `SHA1=<hash>` line in the config for stock ramdisks (see `patching_ramdisk()` line 1687):
```bash
[ ! -z $SHA1 ] && echo "SHA1=$SHA1" >> config
```
Where `SHA1` is computed via `magiskboot sha1 ramdisk.cpio`. This hash is used by Magisk during boot to verify the ramdisk integrity. If missing, some Magisk versions may silently skip init replacement.

**Impact:** 🟡 Medium — may cause boot-time verification failures on certain Magisk versions.

**Fix:** After decompressing ramdisk.cpio, run `magiskboot sha1 ramdisk.cpio` and include the output in the config file.

---

### 🔴 BUG-04: No `stub.xz` inclusion — Magisk ≥ 25 requires it

**Location:** `root.rs:415-424`

The patch command includes `magiskinit`, `magisk64.xz`, `magisk32.xz`, but **never includes `stub.xz`**. rootAVD checks for `stub.apk` (line 1702-1705):
```bash
if $STUBAPK; then
    $BASEDIR/magiskboot compress=xz stub.apk stub.xz
fi
```
And adds it to the CPIO:
```bash
"$SKIPSTUB add 0644 overlay.d/sbin/stub.xz stub.xz"
```

**Problem:** Magisk v25+ requires `stub.xz` in the ramdisk overlay for proper init operation. Without it, Magisk init may fail to bootstrap.

**Impact:** 🔴 Critical for Magisk v25+ — init may fail to launch the Magisk daemon.

**Fix:** If `MagiskPackageContents::stub_apk` is `Some(path)`:
1. Push `stub.apk` to the workdir
2. Compress: `magiskboot compress=xz stub.apk stub.xz`
3. Add to CPIO: `add 0644 overlay.d/sbin/stub.xz stub.xz`

---

### 🔴 BUG-05: Cold boot in `RootWizard.tsx` does NOT use `-no-snapshot-save`

**Location:** `RootWizard.tsx:100-107`

```typescript
LaunchAvd(avd.name, {
  wipeData: false,
  writableSystem: false,
  coldBoot: true,
  noSnapshotLoad: true,
  noSnapshotSave: false,  // ← BUG: should be true
  noBootAnim: false,
})
```

**Problem:** After rooting, when the user clicks "Cold Boot Emulator" in the result step, the emulator is launched with `noSnapshotSave: false`. This means:
1. The emulator cold boots with the patched ramdisk ✓
2. Magisk initializes ✓
3. **The emulator saves a snapshot of the Magisk-enabled state** ✗
4. On next normal boot, it loads this snapshot — which is **frozen in time** and may have stale Magisk daemon state

More critically: if the user later restores stock ramdisk but the snapshot is still "rooted", the emulator will appear rooted from snapshot even with stock ramdisk, causing confusion.

**Impact:** 🟡 High — causes confusing state where snapshot and ramdisk are out of sync.

**Fix:** Set `noSnapshotSave: true` for the post-root cold boot.

---

### 🟡 BUG-06: No boot-completion wait before rooting

**Location:** `root.rs:149-154`

```rust
if !runtime::is_serial_online(app, &request.serial) {
    return Err("Emulator is not online over ADB...");
}
```

**Problem:** `is_serial_online()` only checks if the serial appears in `adb devices` with status `device`. This does NOT mean the emulator has fully booted. If the user starts the emulator and immediately clicks Root, the emulator may be in the boot animation phase. ADB operations like `getprop` may return empty/stale values, and file operations may fail because `/data` isn't yet mounted.

rootAVD doesn't have this issue because it's a manual script — by the time the user runs it, the emulator is already booted.

**Impact:** 🟡 High — race condition that can cause sporadic failures.

**Fix:** After confirming serial is online, poll `getprop sys.boot_completed` until it returns `1` (with a timeout of ~60s). Emit progress: "Waiting for emulator boot to complete…"

---

### 🟡 BUG-07: `adb_shell` error handling is too permissive

**Location:** `root.rs:74-76`

```rust
fn adb_shell(app: &AppHandle, serial: &str, cmd: &str) -> CmdResult<String> {
    run_binary_command_allow_output_on_failure(app, "adb", &["-s", serial, "shell", cmd])
}
```

**Problem:** `run_binary_command_allow_output_on_failure` returns `Ok(output)` even when the command fails with a non-zero exit code. This means:
- `magiskboot decompress` failing silently → patch proceeds on empty/corrupt CPIO
- `magiskboot cpio ... patch` failing → no actual init replacement
- `magiskboot compress=xz` failing → no compressed binaries in overlay

rootAVD checks `$?` after every critical command. We don't.

**Impact:** 🟡 High — silent failures in any pipeline step propagate to a corrupt ramdisk.

**Fix:** For critical pipeline steps (decompress, cpio operations, compress), check the command output for error indicators or use `adb shell "cmd; echo EXIT:$?"` to capture the exit code. Fail immediately if any step returns non-zero.

---

### 🟡 BUG-08: Emulator may need snapshot deletion before cold boot

**Location:** N/A — not implemented

**Problem:** When the user cold boots after rooting, if a **previous Quick Boot snapshot** exists, the emulator may still attempt to load it despite `-no-snapshot-load`. Some emulator versions have bugs where the snapshot partially loads. The safest approach (used by rootAVD) is to **shut down the AVD** before replacing the ramdisk and then cold boot.

But our pipeline replaces the ramdisk **while the emulator is running** and then tells the user to cold boot. This creates a window where:
1. The running emulator may re-save a snapshot with the old ramdisk
2. The snapshot file may contain cached ramdisk data that conflicts with the patched version

**Impact:** 🟡 Medium — can cause intermittent boot failures or "root didn't apply" scenarios.

**Fix:** After writing the patched ramdisk (Step 7), automatically stop the emulator via `adb emu kill` or `adb shell setprop sys.powerctl shutdown`, then provide the cold boot option. Consider deleting the snapshot: delete `<avd_path>/snapshots/default_boot/` before cold boot.

---

### 🟡 BUG-09: Multi-CPIO archives not handled (API ≥ 30)

**Location:** `root.rs:352-357` — decompress step

**Problem:** On API 30+ AVDs, the ramdisk may contain **multiple concatenated CPIO archives** separated by `TRAILER!!!` markers. rootAVD has explicit logic for this (`decompress_ramdisk()` lines 1471-1558):
```bash
if [[ $API -ge 30 ]]; then
    COUNT=`strings -t d $RDF | grep TRAILER\!\! | wc -l`
    if [[ $COUNT -gt 1 ]]; then
        REPACKRAMDISK=1
    fi
fi
```

When multiple CPIOs exist, rootAVD splits them, extracts each, merges into a single directory, then re-creates one CPIO. Our code just runs `magiskboot decompress` which may only handle the first CPIO.

**Impact:** 🟡 High for API 30+ — root may not apply correctly because Magisk init is only injected into the first CPIO segment while the kernel loads multiple segments.

**Fix:** `magiskboot` (Magisk's own tool) actually handles this internally in newer versions. Verify by checking the output of `magiskboot cpio ramdisk.cpio test` — if it returns a valid status without error, `magiskboot` is handling multi-CPIO. If not, implement the split/merge logic. **Test on an API 34 AVD to confirm.**

---

### 🟡 BUG-10: Config file `KEEPVERITY`/`KEEPFORCEENCRYPT` are hardcoded to `true`

**Location:** `root.rs:376`

```rust
let config_content = "KEEPVERITY=true\nKEEPFORCEENCRYPT=true\nRECOVERYMODE=false";
```

**Problem:** rootAVD dynamically determines these values:
- `KEEPVERITY`: `true` if system-as-root (most modern AVDs), `false` otherwise
- `KEEPFORCEENCRYPT`: `true` if data is encrypted, `false` otherwise
- `RECOVERYMODE`: `true` only for API 28

For AVDs, hardcoding `true/true/false` is actually **correct for most cases** (AVDs are system-as-root, not encrypted, and not API 28). But for API 28 AVDs, `RECOVERYMODE` should be `true`.

**Impact:** 🟢 Low — only affects API 28 AVDs, which are rare.

**Fix (nice-to-have):** Check API level from the AVD config; set `RECOVERYMODE=true` for API 28.

---

### 🟢 BUG-11: `ramdisk.cpio.orig` backup path may collide

**Location:** `root.rs:421`

```rust
"'backup {ROOT_WORKDIR}/ramdisk.cpio.orig'"
```

**Problem:** The `magiskboot cpio backup` subcommand creates a binary diff between the stock and patched CPIO and stores the stock hash. If the backup path already exists from a previous root attempt (e.g., user re-roots), the old backup may be overwritten silently. This is actually fine for our use-case but worth noting.

**Impact:** 🟢 Low — no functional impact if re-rooting.

---

### 🟢 BUG-12: AvdSwitcher doesn't show boot state (cold vs. normal)

**Location:** `AvdSwitcher.tsx:173-181`

The switcher shows `Running` or `Stopped` but doesn't differentiate between:
- **Cold Boot** (fresh boot with no snapshot) — root applies
- **Normal Boot** (quick boot from snapshot) — root may NOT apply if snap was saved pre-root

**Impact:** 🟡 UX — user can't tell if the emulator is in the "right" state for rooting to take effect.

**Fix:** See Section 5 below.

---

## 3. Root Cause of "Done but not rooted"

Based on the analysis, the **primary root cause** is a combination of:

1. **BUG-02 (compression mismatch)**: The patched ramdisk is recompressed with `lz4_legacy`, but the original may have been `gzip`. The emulator's bootloader tries to decompress with the original method, fails, and falls back to the stock ramdisk (or crashes to a boot loop).

2. **BUG-04 (missing stub.xz)**: Without `stub.xz`, Magisk v25+ init cannot properly bootstrap the daemon. Even if the ramdisk loads, Magisk never starts.

3. **BUG-01 (decompress failure)**: If `magiskboot decompress` fails silently, the entire pipeline operates on corrupt data, and the "patched" ramdisk is actually broken.

4. **BUG-07 (no error checking)**: Because we use `allow_output_on_failure`, none of these failures are caught. The pipeline reports "Done" when in reality every step after decompress was operating on garbage.

**Combined Effect**: The pipeline runs to completion, reports success, but the output `ramdiskpatched.img` is either:
- Incorrectly compressed (won't decompress at boot)
- Missing critical Magisk components (stub.xz, correct init)
- A corrupt CPIO that the kernel can't mount

---

## 4. Fix Plan — Prioritised

### Priority 1 — Critical (Must fix for root to work)

| # | Bug | Fix | Effort |
|---|-----|-----|--------|
| 1 | BUG-01 | Detect compression before decompress; verify decompress succeeded (check output file size > 0) | Medium |
| 2 | BUG-02 | Detect original compression via magic bytes; recompress with the same method | Medium |
| 3 | BUG-04 | Push stub.apk, compress to stub.xz, add to CPIO | Small |
| 4 | BUG-07 | Add exit-code checking to all critical ADB shell commands | Medium |

### Priority 2 — High (Reliability & UX)

| # | Bug | Fix | Effort |
|---|-----|-----|--------|
| 5 | BUG-05 | Set `noSnapshotSave: true` in post-root cold boot | Trivial |
| 6 | BUG-06 | Add `sys.boot_completed` polling before starting root pipeline | Small |
| 7 | BUG-08 | Stop emulator after writing patched ramdisk, before cold boot | Small |
| 8 | BUG-03 | Add SHA1 hash to config file | Small |

### Priority 3 — Nice-to-have

| # | Bug | Fix | Effort |
|---|-----|-----|--------|
| 9 | BUG-09 | Verify multi-CPIO handling on API 30+; add split/merge if needed | Large |
| 10 | BUG-10 | Dynamic config based on API level | Trivial |
| 11 | BUG-12 | AvdSwitcher boot state badge | Medium |

---

## 5. AvdSwitcher Boot State UI Enhancement

### Goal
Show users whether their emulator is in a state where root will take effect.

### Backend: Detect Boot Mode

Add a new function to `runtime.rs`:

```rust
pub enum EmulatorBootMode {
    ColdBoot,     // Booted without snapshot
    NormalBoot,   // Booted from snapshot (Quick Boot)
    Unknown,
}

pub fn detect_boot_mode(app: &AppHandle, serial: &str) -> EmulatorBootMode {
    // Check if snapshot was loaded:
    // Method 1: getprop dev.bootcomplete + check snapshot indicator
    // Method 2: Check if snapshot directory has recent timestamps
    // Method 3: adb emu avd snapshot list → check if "default_boot" was loaded
}
```

**Practical approach**: The simplest reliable method is to check the emulator console:
```
adb -s <serial> emu avd snapshot list
```
If the output shows a snapshot was loaded, it's Normal Boot. If not, it's Cold Boot.

Alternative: Check `getprop ro.boot.hardware.revision` or look for the emulator's snapshot load log in `logcat`.

### Frontend: AvdSwitcher Badge

Add boot mode to `AvdSummary`:
```typescript
export interface AvdSummary {
  // ... existing fields
  bootMode?: 'cold' | 'normal' | 'unknown';
}
```

Display in the AvdSwitcher pill:

```
┌─────────────────────────────────────────┐
│ ● Pixel_8_API_34    Running · Cold Boot │
│   API 34 · x86_64 · Rooted             │
│                                         │
│ ○ Pixel_7_API_33    Running · Normal    │
│   API 33 · x86_64 · Stock              │
│                                         │
│ ○ Nexus_5X_API_30   Stopped            │
│   API 30 · x86_64 · Modified           │
└─────────────────────────────────────────┘
```

Badge colors:
| Boot Mode | Badge | Color |
|-----------|-------|-------|
| Cold Boot | `Cold Boot` | `bg-blue-500/15 text-blue-700` |
| Normal | `Normal` | `bg-amber-500/15 text-amber-700` |
| Stopped | (no mode badge) | — |
| Unknown | `Running` | (current green) |

---

## 6. Pre-Root Checklist — What Must Be True

Before the root pipeline starts, verify ALL of these:

| Check | How | Fail Action |
|-------|-----|-------------|
| AVD selected | `avd != null` | Block: "Select an AVD" |
| AVD running | `avd.isRunning && avd.serial` | Block: "Launch emulator first" |
| ADB online | `is_serial_online(serial)` | Block: "Emulator not accessible via ADB" |
| Boot completed | `getprop sys.boot_completed == 1` | Wait with spinner: "Waiting for boot…" |
| Ramdisk exists | `ramdisk_path.exists()` | Error: "System image not installed" |
| Ramdisk writable | `fs::metadata(ramdisk_path).permissions().readonly() == false` | Error: "Ramdisk is read-only" |
| Ramdisk not shared | Check if multiple AVDs reference same `image.sysdir` | Warn: "Shared system image — all AVDs affected" |
| Package valid | Extension check + zip integrity | Error: "Invalid package file" |
| Disk space | Check temp dir has ≥ 200MB free | Error: "Not enough disk space" |

### Implementation

Create a new function `pre_root_checks()` in `root.rs` that runs before the main pipeline:

```rust
fn pre_root_checks(app: &AppHandle, request: &RootAvdRequest) -> CmdResult<PreRootReport> {
    // 1. Verify ADB online
    // 2. Poll sys.boot_completed (up to 60s)
    // 3. Verify ramdisk path exists and is writable
    // 4. Detect API level
    // 5. Detect ABI
    // 6. Return a report struct with all detected properties
}
```

---

## 7. Post-Root Verification

After the patched ramdisk is written and the emulator is cold-booted, verify root:

```rust
pub struct RootVerification {
    pub su_available: bool,
    pub magisk_version: Option<String>,
    pub daemon_running: bool,
    pub manager_installed: bool,
}

pub fn verify_root(app: &AppHandle, serial: &str) -> CmdResult<RootVerification> {
    let su = adb_shell(app, serial, "su -c 'id -u'")
        .map(|o| o.trim() == "0")
        .unwrap_or(false);
    
    let ver = adb_shell(app, serial, "su -c 'magisk -v'")
        .ok()
        .map(|o| o.trim().to_string());
    
    let daemon = adb_shell(app, serial, "su -c 'magisk --daemon'")
        .is_ok();
    
    let manager = adb_shell(app, serial, "pm list packages magisk")
        .map(|o| !o.trim().is_empty())
        .unwrap_or(false);
    
    Ok(RootVerification { su_available: su, magisk_version: ver, daemon_running: daemon, manager_installed: manager })
}
```

This should be triggered **after a cold boot**, not immediately after patching (since the emulator must restart for root to take effect).

---

## 8. Implementation Order

### Phase 1: Fix the patching pipeline (make root actually work)

1. **BUG-02**: Detect original compression method
   - Add `detect_ramdisk_compression()` that runs `adb shell xxd -p -l4 {workdir}/ramdisk.img` to read magic bytes
   - Store the detected method (lz4_legacy/gzip)
   - Use detected method for recompression

2. **BUG-01**: Validate decompress output  
   - After `magiskboot decompress`, check: `adb shell stat -c%s {workdir}/ramdisk.cpio`
   - If size is 0 or command failed, abort with clear error

3. **BUG-07**: Add exit code checking
   - Change critical ADB shell calls to append `; echo EXITCODE:$?`
   - Parse the exit code and fail on non-zero

4. **BUG-04**: Add stub.xz
   - Push `stub.apk` if present in `MagiskPackageContents`
   - Compress and add to CPIO

5. **BUG-03**: Add SHA1 to config
   - Run `magiskboot sha1 ramdisk.cpio` after decompress
   - Include in config

### Phase 2: Reliability improvements

6. **BUG-06**: Boot-completion polling
7. **BUG-05**: Fix cold boot snapshot flags
8. **BUG-08**: Auto-stop emulator after patching

### Phase 3: UX enhancements

9. **BUG-12**: AvdSwitcher boot state badge
10. Pre-root checklist UI
11. Post-root verification

---

## Appendix A: rootAVD vs. Our Pipeline — Step-by-Step Comparison

| Step | rootAVD (reference) | Our pipeline | Match? |
|------|---------------------|--------------|--------|
| Detect compression | `compress_method()` reads magic bytes | ❌ Not done | ❌ |
| Decompress ramdisk | `magiskboot decompress` with known format | `magiskboot decompress` blind | ⚠️ |
| Multi-CPIO split | Explicit split/merge for API ≥ 30 | Not handled | ❌ |
| Test patch status | `magiskboot cpio test; echo $?` | ✅ Done | ✅ |
| Compute SHA1 | `magiskboot sha1 ramdisk.cpio` | ❌ Not done | ❌ |
| Write config | KEEPVERITY/KEEPFORCEENCRYPT/SHA1 | KEEPVERITY/KEEPFORCEENCRYPT only | ⚠️ |
| Compress magisk64.xz | `magiskboot compress=xz` | ✅ Done | ✅ |
| Compress magisk32.xz | `magiskboot compress=xz` (conditional) | ✅ Done | ✅ |
| Compress stub.xz | `magiskboot compress=xz stub.apk stub.xz` | ❌ Not done | ❌ |
| Create overlay dirs | `mkdir 0750 overlay.d` + `overlay.d/sbin` | ✅ Done | ✅ |
| Add init → magiskinit | `add 0750 init magiskinit` | ✅ Done | ✅ |
| Add magisk64.xz | `add 0644 overlay.d/sbin/magisk64.xz` | ✅ Done | ✅ |
| Add magisk32.xz | `add 0644 overlay.d/sbin/magisk32.xz` (conditional) | ✅ Done | ✅ |
| Add stub.xz | `add 0644 overlay.d/sbin/stub.xz` (conditional) | ❌ Missing | ❌ |
| Patch | `patch` | ✅ Done | ✅ |
| Backup | `backup ramdisk.cpio.orig` | ✅ Done | ✅ |
| Add .backup/.magisk | `mkdir 000 .backup` + `add 000 .backup/.magisk config` | ✅ Done | ✅ |
| Compress CPIO (if flagged) | `cpio compress` if status & 4 | ✅ Done | ✅ |
| Recompress to ramdisk | `compress=$METHOD ramdisk.cpio out.img` | ❌ Hardcoded lz4_legacy | ❌ |
| Verify output | Check file exists + size | ✅ Done (partial) | ⚠️ |
| Shutdown AVD | `setprop sys.powerctl shutdown` | ❌ Not done | ❌ |

**Score: 10/18 steps correct, 3 partially correct, 5 missing.**

---

## Appendix B: Compression Detection — Magic Bytes Reference

| Format | First 4 bytes (hex) | `magiskboot` method string |
|--------|--------------------|----|
| LZ4-legacy | `02 21 4c 18` | `lz4_legacy` |
| LZ4-block  | `04 22 4d 18` | `lz4_lg` |
| GZIP | `1f 8b 08 00` | `gzip` |
| XZ | `fd 37 7a 58` | `xz` |
| Raw CPIO (070701) | `30 37 30 37` | (no compression) |
| ZStd | `28 b5 2f fd` | `zstd` |

Detection command (via ADB):
```bash
adb shell "xxd -p -l4 /data/local/tmp/adb-gui-root/ramdisk.img"
```

If `xxd` is not available (some stripped Android shells), use:
```bash
adb shell "od -A n -t x1 -N 4 /data/local/tmp/adb-gui-root/ramdisk.img | tr -d ' '"
```

---

## Appendix C: Recommended `patch_ramdisk_in_emulator()` Rewrite

```rust
fn patch_ramdisk_in_emulator(
    app: &AppHandle,
    serial: &str,
    pkg: &MagiskPackageContents,
) -> CmdResult<()> {
    let mb = format!("{ROOT_WORKDIR}/magiskboot");

    // 1. Detect compression method from magic bytes
    let method = detect_compression_method(app, serial)?;
    log::info!("[root] Detected ramdisk compression: {method}");

    // 2. Decompress ramdisk → ramdisk.cpio
    let decompress_out = adb_shell_checked(app, serial, &format!(
        "{mb} decompress {ROOT_WORKDIR}/ramdisk.img {ROOT_WORKDIR}/ramdisk.cpio"
    ))?;
    
    // Verify CPIO was created and is non-empty
    verify_file_exists(app, serial, &format!("{ROOT_WORKDIR}/ramdisk.cpio"))?;

    // 3. Test patch status
    let status = adb_shell_exit_code(app, serial, &format!(
        "{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio test"
    ))?;
    
    if status == 2 {
        return Err("Ramdisk was patched by an unsupported tool. Restore stock first.".into());
    }

    // 4. Compute SHA1 for config (stock ramdisks only)
    let sha1 = if status == 0 {
        adb_shell(app, serial, &format!("{mb} sha1 {ROOT_WORKDIR}/ramdisk.cpio"))
            .ok()
            .map(|s| s.trim().to_string())
    } else {
        None
    };

    // 5. Write config
    let mut config = format!(
        "KEEPVERITY=true\nKEEPFORCEENCRYPT=true\nRECOVERYMODE=false"
    );
    if let Some(ref hash) = sha1 {
        config.push_str(&format!("\nSHA1={hash}"));
    }
    adb_shell(app, serial, &format!("echo '{config}' > {ROOT_WORKDIR}/config"))?;

    // 6. Compress magisk binaries
    let is_64bit = magisk_package::is_64bit_abi(&pkg.abi_dir);
    let has_magisk32 = pkg.magisk32.is_some();
    
    if is_64bit {
        adb_shell_checked(app, serial, &format!(
            "{mb} compress=xz {ROOT_WORKDIR}/magisk64 {ROOT_WORKDIR}/magisk64.xz"
        ))?;
    }
    if has_magisk32 {
        adb_shell_checked(app, serial, &format!(
            "{mb} compress=xz {ROOT_WORKDIR}/magisk32 {ROOT_WORKDIR}/magisk32.xz"
        ))?;
    }

    // 7. Compress stub.apk if present
    let has_stub = pkg.stub_apk.is_some();
    if has_stub {
        adb_shell_checked(app, serial, &format!(
            "{mb} compress=xz {ROOT_WORKDIR}/stub.apk {ROOT_WORKDIR}/stub.xz"
        ))?;
    }

    // 8. Create overlay directories
    adb_shell_checked(app, serial, &format!(
        "{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio \
         'mkdir 0750 overlay.d' \
         'mkdir 0750 overlay.d/sbin'"
    ))?;

    // 9. Build the patch command dynamically
    let skip32 = if has_magisk32 { "" } else { "#" };
    let skip64 = if is_64bit { "" } else { "#" };
    let skip_stub = if has_stub { "" } else { "#" };

    let patch_cmd = format!(
        "{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio \
         'add 0750 init {ROOT_WORKDIR}/magiskinit' \
         '{skip64} add 0644 overlay.d/sbin/magisk64.xz {ROOT_WORKDIR}/magisk64.xz' \
         '{skip32} add 0644 overlay.d/sbin/magisk32.xz {ROOT_WORKDIR}/magisk32.xz' \
         '{skip_stub} add 0644 overlay.d/sbin/stub.xz {ROOT_WORKDIR}/stub.xz' \
         'patch' \
         'backup {ROOT_WORKDIR}/ramdisk.cpio.orig' \
         'mkdir 000 .backup' \
         'add 000 .backup/.magisk {ROOT_WORKDIR}/config'"
    );
    adb_shell_checked(app, serial, &patch_cmd)?;

    // 10. Compress CPIO if flagged
    if status & 4 != 0 {
        adb_shell_checked(app, serial, &format!(
            "{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio compress"
        ))?;
    }

    // 11. Recompress with ORIGINAL method
    adb_shell_checked(app, serial, &format!(
        "{mb} compress={method} {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdiskpatched.img"
    ))?;

    Ok(())
}
```

Key new helper functions needed:

```rust
/// Detect ramdisk compression by reading magic bytes
fn detect_compression_method(app: &AppHandle, serial: &str) -> CmdResult<String> {
    let hex = adb_shell(app, serial, &format!(
        "xxd -p -l4 {ROOT_WORKDIR}/ramdisk.img || od -A n -t x1 -N 4 {ROOT_WORKDIR}/ramdisk.img | tr -d ' '"
    ))?.trim().to_lowercase().replace(" ", "");
    
    match hex.get(..8).unwrap_or("") {
        "02214c18" => Ok("lz4_legacy".to_string()),
        "1f8b0800" | "1f8b08" => Ok("gzip".to_string()),
        h if h.starts_with("30373037") => Ok("raw".to_string()), // raw CPIO
        other => Err(format!("Unknown ramdisk compression: {other}"))
    }
}

/// Run ADB shell command and verify exit code is 0
fn adb_shell_checked(app: &AppHandle, serial: &str, cmd: &str) -> CmdResult<String> {
    let wrapped = format!("{cmd}; echo MAGISK_EXIT:$?");
    let output = adb_shell(app, serial, &wrapped)?;
    
    if let Some(code) = parse_exit_code(&output, "MAGISK_EXIT:") {
        if code != 0 {
            return Err(format!("Command failed (exit {code}): {cmd}\nOutput: {output}"));
        }
    }
    Ok(output)
}

/// Verify a file exists and is non-empty on the device
fn verify_file_exists(app: &AppHandle, serial: &str, path: &str) -> CmdResult<()> {
    let size_str = adb_shell(app, serial, &format!("stat -c%s {path} 2>/dev/null || echo 0"))?;
    let size: u64 = size_str.trim().parse().unwrap_or(0);
    if size == 0 {
        return Err(format!("Expected file {path} is missing or empty"));
    }
    Ok(())
}
```
