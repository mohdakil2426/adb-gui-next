# Emulator Root UX Audit — Beginner-First Pipeline Redesign

> **Date:** 2026-04-26
> **Scope:** Full audit of the Emulator Manager rooting workflow — backend pipeline, frontend wizard, and rootAVD reference comparison.
> **Goal:** Make rooting as effortless as possible for a first-time user who has never touched `adb` or `magiskboot`.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [rootAVD Reference Analysis](#2-rootavd-reference-analysis)
3. [Our Current Pipeline — What We Have](#3-our-current-pipeline)
4. [Gap Analysis — What a Beginner Hits](#4-gap-analysis)
5. [Pre-Flight Scan System (NEW)](#5-pre-flight-scan-system)
6. [Root Wizard UX Redesign](#6-root-wizard-ux-redesign)
7. [Backend Enhancements](#7-backend-enhancements)
8. [Implementation Plan](#8-implementation-plan)
9. [Risk Matrix](#9-risk-matrix)
10. [Edge Cases — Exhaustive Catalog](#10-edge-cases--exhaustive-catalog)

---

## 1. Executive Summary

### The Problem

A beginner user who opens the Root tab today encounters:

- A **gate** that says "emulator is not running" with no way to fix it inline
- No visibility into **why** cold boot matters, what boot mode they're in, or whether their system is in a safe state
- A 3-step wizard (Source → Rooting → Done) that assumes the user already knows the prerequisites
- **Zero pre-flight validation** — the pipeline starts running and only fails mid-way if the emulator isn't ready

### The Solution

Transform the Root tab from a "you must already know what you're doing" tool into a **guided, self-healing flow** that:

1. **Scans** the emulator state before showing the wizard
2. **Guides** the user through any required state changes (cold boot, stop, etc.)
3. **Explains** each step with beginner-friendly "why" text
4. **Recovers** gracefully from common failure modes

---

## 2. rootAVD Reference Analysis

### How rootAVD Works (2530-line bash script)

```
rootAVD.sh [path/to/ramdisk.img] [OPTIONS]
```

**Key architectural insights from the reference:**

| Aspect | rootAVD Approach | Our Approach | Status |
|--------|-----------------|--------------|--------|
| **Ramdisk location** | User must provide exact path | Auto-resolved from AVD INI + SDK roots | ✅ Better |
| **Compression detection** | Magic-byte check (LZ4/GZ/raw CPIO) | Same — `detect_compression_method()` | ✅ Parity |
| **Working directory** | `/data/data/com.android.shell/Magisk` | `/data/local/tmp/adb-gui-root` | ✅ Equivalent |
| **Magisk source** | Bundled `Magisk.zip` + online menu | GitHub API fetch or local file picker | ✅ Better |
| **CPIO patching** | `magiskboot cpio` with overlay.d dirs | Same sequence — init, magisk64.xz, stub.xz, patch, backup, config | ✅ Parity |
| **Shutdown** | `adb shell setprop sys.powerctl shutdown` | Same + 3s sleep | ✅ Parity |
| **Cold boot guidance** | Prints "Cold Boot Now" to terminal | UI shows Cold Boot button in result step | ✅ Better |
| **Backup/restore** | `.backup` files beside originals | Same pattern via `backup.rs` | ✅ Parity |
| **FAKEBOOTIMG** | Creates fake boot.img for Magisk App patching | Legacy fallback preserved in `root.rs` | ✅ Parity |
| **Pre-flight checks** | Only checks ADB connectivity | Only checks ADB connectivity + boot_completed | ⚠️ Both weak |
| **Boot mode detection** | ❌ None | `ro.kernel.androidboot.snapshot_loaded` | ✅ Better |
| **Writable-system check** | ❌ None | ❌ None | ❌ Gap |
| **API 28 (Pie) warning** | README note: "not supported" | ❌ No warning | ❌ Gap |
| **Magisk 26+ / FAKEBOOTIMG note** | README: "Magisk ≥26.x can only be properly installed with FAKEBOOTIMG" | ❌ No guidance | ⚠️ Gap |
| **64-bit only check** | README note: "needs Magisk 23.x" | ABI detection + binary selection | ✅ Better |

### rootAVD's Preconditions (from README)

1. The AVD **must be running**
2. A working **internet connection** (for online Magisk menu)
3. ADB shell must connect to the running AVD
4. User must know the **ramdisk.img path** for their API level

### rootAVD's Post-Patching Requirement

> "Shut-Down & Reboot **(Cold Boot Now)** the AVD and see if it worked"

This is the **#1 beginner failure mode** — users normal-boot after patching and the snapshot overwrites the patched ramdisk.

### rootAVD's ShutDownAVD Function (line 641)

```bash
ShutDownAVD() {
    echo "[-] Shut-Down & Reboot (Cold Boot Now) the AVD and see if it worked"
    ADBPULLECHO=$(adb shell setprop sys.powerctl shutdown 2>/dev/null)
    echo "[!] If the AVD doesn't shut down, try it manually!"
}
```

Our pipeline already does this identically (Step 7 of `root_avd_automated`).

---

## 3. Our Current Pipeline

### Backend (Rust) — `root.rs` (911 lines, 8-step pipeline)

```
Step 1: Validate — ADB online, boot_completed poll, ramdisk path, backup
Step 2: Acquire — Download from GitHub or use local file
Step 3: Detect ABI — Extract binaries from Magisk APK
Step 4: Push — magiskboot, magiskinit, magisk64, busybox, stub, ramdisk → emulator
Step 5: Patch — decompress → cpio test → sha1 → config → xz compress → cpio patch → recompress
Step 6: Pull — patched ramdisk back to host
Step 7: Install — Write ramdisk to system-image dir, shutdown emulator
Step 8: Cleanup — Install Magisk Manager APK, remove workdir
```

**Strengths:**
- Robust exit-code checking via `adb_shell_checked()` with `__ADB_GUI_EXIT_STATUS__` markers
- Magic-byte compression detection (LZ4/GZ/raw CPIO)
- Architecture-aware binary selection (x86_64, x86, arm64-v8a, etc.)
- Automatic backup before patching
- Auto-shutdown to prevent snapshot reversion
- Real-time progress events via Tauri `root:progress`

### Frontend — Root Wizard (3 steps)

```
Source → Progress → Result
```

| Component | Purpose |
|-----------|---------|
| `EmulatorRootTab.tsx` | Gate: shows warning if AVD not running |
| `RootWizard.tsx` | Step orchestrator (source → progress → result) |
| `RootSourceStep.tsx` | Magisk source picker (Download/Local) |
| `RootProgressStep.tsx` | 8-step checklist with live progress |
| `RootResultStep.tsx` | Success/failure with Cold Boot + Restore actions |

### State Management — `emulatorManagerStore.ts`

- `RootWizardStep`: source | progress | result
- `RootWizardSource`: stable | local | null
- `RootWizardState`: step, source, progress, result, error

### Data Models — `models.rs`

- `AvdSummary`: name, boot_mode, root_state, is_running, serial, warnings
- `EmulatorBootMode`: Cold | Normal | Unknown
- `AvdRootState`: Stock | Rooted | Modified | Unknown
- `RootProgress`: step, total_steps, label, detail

---

## 4. Gap Analysis — What a Beginner Hits

### 🔴 Critical Gaps

| # | Gap | Impact | Beginner Symptom |
|---|-----|--------|------------------|
| G1 | **No pre-flight scan** | User clicks Root, pipeline starts, fails at step 1 | "Why did it fail? I don't know what went wrong" |
| G2 | **Boot mode not surfaced before rooting** | User is on Normal boot, root succeeds but reverts on next launch | "I rooted it but it's not rooted anymore" |
| G3 | **No inline "Launch" action from Root tab** | User must manually switch tabs to launch emulator | "It says 'not running' but how do I start it?" |
| G4 | **No writable-system detection** | User launched with `-writable-system`, root may behave differently | Silent failure mode |
| G5 | **No API level compatibility warning** | API 28 (Pie) is unsupported; API 34+ needs Magisk 26+ | "Root failed" with no explanation |

### 🟡 UX Gaps

| # | Gap | Impact |
|---|-----|--------|
| G6 | **No "why" text in wizard steps** | User doesn't understand what cold boot means or why it matters |
| G7 | **Root tab gate is a dead end** | Just shows a warning + "go to Launch tab" text — no actionable button |
| G8 | **No root state visibility in AVD header** | User can't tell at a glance if an AVD is already rooted |
| G9 | **No estimated time** | User doesn't know if rooting takes 10 seconds or 5 minutes |
| G10 | **Progress step labels are technical** | "Patching ramdisk" means nothing to a beginner |

### 🟢 Already Handled (No Action Needed)

- Ramdisk path auto-resolution ✅
- Compression detection ✅
- ABI detection with fallback ✅
- Backup before patching ✅
- Auto-shutdown after patching ✅
- Cold Boot button in result step ✅
- Boot mode detection via `ro.kernel.androidboot.snapshot_loaded` ✅

---

## 5. Pre-Flight Scan System (NEW)

### Concept: "Readiness Check" Before Root Wizard

Before the user even sees the Source step, run a **pre-flight diagnostic** that checks every prerequisite and surfaces results as a checklist.

### Scan Checks

| Check | Method | Pass | Fail Action |
|-------|--------|------|-------------|
| **AVD running** | `avd.is_running && avd.serial.is_some()` | ● Running on emulator-5554 | Show "Launch" button inline |
| **Boot completed** | `getprop sys.boot_completed == 1` | ● Boot complete | Show "Wait…" spinner or "Emulator is still booting" |
| **Boot mode** | `avd.boot_mode` | ● Cold Boot | Show ⚠️ "Normal Boot detected — root may revert. Restart with Cold Boot?" + button |
| **Root state** | `avd.root_state` | ● Stock (ready) | Show ℹ️ "Already rooted" or "Modified — restore first?" |
| **API level** | `avd.api_level` | ● API 34 | Show ❌ "API 28 is not supported" or ⚠️ "API 34+ requires Magisk ≥26" |
| **Ramdisk exists** | `avd.ramdisk_path exists on disk` | ● Ramdisk found | Show ❌ "System image not installed" |
| **ABI supported** | `avd.abi` | ● x86_64 | Show ❌ if unsupported arch |

### Backend: New Tauri Command

```rust
#[tauri::command]
pub fn scan_avd_root_readiness(
    app: AppHandle,
    avd_name: String,
    serial: Option<String>,
) -> CmdResult<RootReadinessScan> { ... }
```

**New model:**

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootReadinessScan {
    pub checks: Vec<ReadinessCheck>,
    pub can_proceed: bool,
    pub has_warnings: bool,
    pub recommended_action: Option<RecommendedAction>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessCheck {
    pub id: String,           // e.g. "boot_mode", "api_level"
    pub label: String,        // e.g. "Boot Mode"
    pub status: CheckStatus,  // pass | warn | fail | info
    pub message: String,      // e.g. "Cold Boot ✓"
    pub detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CheckStatus { Pass, Warn, Fail, Info }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RecommendedAction {
    LaunchEmulator,
    ColdBoot,
    RestoreFirst,
    Unsupported { reason: String },
}
```

### Frontend: New "Preflight" Step (Step 0)

The Root Wizard becomes **4 steps**: `Preflight → Source → Rooting → Done`

```
┌─────────────────────────────────────────┐
│  ① Preflight   ② Source   ③ Rooting   ④ Done  │
├─────────────────────────────────────────┤
│                                         │
│  Root Readiness Check                   │
│                                         │
│  ✅ Emulator running (emulator-5554)    │
│  ✅ Boot completed                      │
│  ⚠️  Normal Boot — root may revert      │
│     [Restart with Cold Boot]            │
│  ✅ Stock ramdisk (ready to patch)      │
│  ✅ API 34 · x86_64                     │
│  ✅ Ramdisk found                       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Continue to Source Selection →  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ℹ️ Cold Boot recommended for reliable  │
│    root. Normal boot may load a         │
│    snapshot that overwrites root.        │
└─────────────────────────────────────────┘
```

---

## 6. Root Wizard UX Redesign

### 6.1 — Replace Dead-End Gate with Smart Entry

**Before (current `EmulatorRootTab.tsx`):**
```
⚠️ Pixel_8_API_34 is not running
   Launch the emulator and wait for it to fully boot before rooting.
   Tip: use the Launch tab to start this AVD, then return here.
```

**After:**
```
┌─────────────────────────────────────────┐
│  🔒 Pixel_8_API_34 is not running       │
│                                         │
│  The emulator must be running before    │
│  rooting. Choose how to start it:       │
│                                         │
│  [▶ Launch]  [❄ Cold Boot (Recommended)]│
│                                         │
│  ℹ️ Cold Boot is recommended for        │
│  rooting — it starts fresh without      │
│  loading a saved state.                 │
└─────────────────────────────────────────┘
```

### 6.2 — Boot Mode Badge in AVD Header

Add a visible badge next to the running status:

```
● Running · emulator-5554 · [Cold Boot] or [Normal Boot ⚠️]
```

This already exists in `AvdSummary.boot_mode` but is **never displayed** in the toolbar strip.

### 6.3 — Beginner-Friendly Progress Labels

| Current (technical) | Proposed (beginner) |
|---------------------|---------------------|
| Validating emulator state | Checking your emulator is ready… |
| Acquiring Magisk package | Downloading Magisk (root toolkit)… |
| Extracting Magisk binaries | Unpacking Magisk files… |
| Pushing files to emulator | Sending files to your emulator… |
| Patching ramdisk | Applying root patch to boot image… |
| Pulling patched ramdisk | Retrieving patched boot image… |
| Installing patched ramdisk | Saving root changes & stopping emulator… |
| Installing Magisk Manager | Installing Magisk app on emulator… |

### 6.4 — "Why" Tooltips / Info Text

Each wizard step should have a 1-line "why" explanation:

- **Source:** "Magisk is the tool that gives your emulator root access. You need a copy of it."
- **Preflight:** "We check your emulator's state to make sure rooting will succeed."
- **Progress:** "The boot image is being modified to include Magisk's root tools."
- **Result:** "Your emulator needs a Cold Boot to load the new root-enabled boot image."

### 6.5 — Root State Badge in AVD Card

Surface `AvdRootState` visually:

| State | Badge |
|-------|-------|
| Stock | (no badge) |
| Rooted | 🟢 `Rooted` |
| Modified | 🟡 `Modified` |
| Unknown | (no badge) |

---

## 7. Backend Enhancements

### 7.1 — `scan_avd_root_readiness` Command

New Tauri command in `src-tauri/src/emulator/root.rs`:

- Runs all checks from §5 table
- Returns structured `RootReadinessScan`
- Non-blocking, fast (~1-2s for all getprop calls)
- Register in `lib.rs` command list + capabilities TOML

### 7.2 — API Level Compatibility Warnings

Add to `avd.rs` or readiness scan:

```rust
fn check_api_compatibility(api: u32) -> Option<String> {
    match api {
        28 => Some("API 28 (Pie) is not supported for rooting due to system-as-root partitioning."),
        api if api >= 34 => Some("API 34+ (Android 14+) requires Magisk v26.x or newer."),
        _ => None,
    }
}
```

### 7.3 — Writable-System Detection

Check `ro.debuggable` + mount state to detect writable-system mode:

```rust
fn detect_writable_system(app: &AppHandle, serial: &str) -> bool {
    // Check if /system is mounted rw
    let mount_output = adb_shell(app, serial, "mount | grep ' /system '").unwrap_or_default();
    mount_output.contains("rw,")
}
```

### 7.4 — Expose Boot Mode in Toolbar

The `EmulatorBootMode` is already computed in `avd.rs` → `detect_boot_mode()`. We just need to surface it in the UI toolbar strip (§6.2).

---

## 8. Implementation Plan

### Phase 1: Pre-Flight Scan + Smart Gate (Priority: HIGH)

| Task | Files | Effort |
|------|-------|--------|
| Add `RootReadinessScan` model to `models.rs` | `models.rs` | S |
| Implement `scan_avd_root_readiness` command | `root.rs`, `lib.rs` | M |
| Register command + permissions | `lib.rs`, capabilities TOML | S |
| Add `ScanAvdRootReadiness` wrapper to `backend.ts` | `backend.ts` | S |
| Add scan models to `models.ts` | `models.ts` | S |
| Build `RootPreflightStep.tsx` component | New file | M |
| Replace dead-end gate in `EmulatorRootTab.tsx` | `EmulatorRootTab.tsx` | M |
| Update `RootWizard.tsx` to include preflight step | `RootWizard.tsx` | M |
| Update `emulatorManagerStore.ts` — add `'preflight'` step | `emulatorManagerStore.ts` | S |

### Phase 2: UX Polish (Priority: MEDIUM)

| Task | Files | Effort |
|------|-------|--------|
| Add boot mode badge to toolbar strip | `ViewEmulatorManager.tsx` | S |
| Add root state badge to AVD header | `ViewEmulatorManager.tsx` | S |
| Update progress labels to beginner-friendly text | `RootProgressStep.tsx` | S |
| Add "why" info text to each wizard step | All step components | S |
| Add inline Launch/Cold Boot buttons to Root tab gate | `EmulatorRootTab.tsx` | S |

### Phase 3: Backend Hardening (Priority: MEDIUM)

| Task | Files | Effort |
|------|-------|--------|
| API level compatibility warnings in scan | `root.rs` | S |
| Writable-system mount detection | `root.rs` | S |
| Estimated time display in progress | `RootProgressStep.tsx` | S |

**Effort Key:** S = Small (< 1hr), M = Medium (1-3hr), L = Large (3-8hr)

**Total estimated effort:** ~2-3 sessions

### Dependency Order

```
Phase 1 (models → backend command → permissions → FE wrapper → FE models → preflight component → wizard update → store update)
Phase 2 (can run in parallel after Phase 1)
Phase 3 (independent, can run anytime)
```

---

## 9. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Writable-system detection is unreliable | Medium | Low | Make it advisory only, not blocking |
| `getprop` calls add latency to scan | Low | Low | Run checks in parallel, cache results |
| API 28 users confused by "unsupported" | Low | Medium | Show clear explanation + link to docs |
| Normal boot warning annoys power users | Medium | Low | Make it dismissible, don't block Continue |
| Preflight step adds friction | Medium | Medium | Make it fast (<2s), auto-proceed if all green |

---

## 10. Edge Cases — Exhaustive Catalog

Every scenario below can occur in production. Each must be handled (blocked, warned, or auto-recovered) by the preflight scan or the pipeline itself.

---

### 10.1 — Environment & SDK

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| E1 | **No Android SDK installed** — `ANDROID_HOME` not set, no `system-images/` | `list_avds()` returns error "Unable to resolve AVD home" | 🔴 Dead end | Show clear "Install Android Studio" message with link |
| E2 | **SDK installed but no AVDs created** | Empty AVD list, empty state shown | 🟡 Confusing | Show "Create an AVD in Android Studio first" guidance |
| E3 | **SDK path has spaces or Unicode** (e.g. `C:\Program Files\Android`) | `PathBuf` handles it, but ADB shell quoting may break | 🟡 Subtle | Ensure all path args are properly quoted in ADB commands |
| E4 | **Multiple SDK installations** (e.g. Android Studio + standalone SDK) | `sdk_roots_from_current_env()` checks multiple roots | 🟢 Handled | — |
| E5 | **`ANDROID_AVD_HOME` overridden** to non-standard path | `resolve_avd_home()` checks it | 🟢 Handled | — |
| E6 | **System images deleted but AVD INI still exists** | Warning: "Resolved ramdisk path does not exist on disk" | 🟡 Confusing | Preflight: "System image missing — reinstall via SDK Manager" |
| E7 | **OneDrive/cloud-sync corrupting ramdisk.img** | Silent corruption, pipeline may extract garbage | 🔴 Rare but fatal | Preflight: verify ramdisk checksum / magic bytes before patching |
| E8 | **Antivirus quarantining `magiskboot` or `magiskinit`** binaries after extraction | `adb push` fails or binary is truncated | 🔴 Windows-specific | Detect push failure + suggest AV exclusion |

### 10.2 — Emulator Boot State

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| B1 | **Emulator still booting** (splash screen visible, `boot_completed != 1`) | `wait_for_boot_completed()` polls 30× at 2s intervals (60s timeout) | 🟢 Handled | — |
| B2 | **Emulator in recovery/safe mode** | Not detected; pipeline would try to proceed | 🟡 Rare | Preflight: check `ro.sys.safemode` property |
| B3 | **Normal Boot (snapshot loaded)** — root will revert on next launch | Boot mode detected but **not surfaced in UI** | 🔴 Critical | Preflight badge: ⚠️ "Normal Boot — root may revert. Cold Boot recommended" |
| B4 | **Emulator launched with `-writable-system`** | Not detected | 🟡 Informational | Preflight: check mount state of `/system` |
| B5 | **Emulator crashed/hung mid-boot** (`boot_completed` never becomes 1) | 60s timeout → error | 🟡 Unclear error | Better error: "Emulator may be stuck. Try Cold Boot or check AVD logs" |
| B6 | **Two emulators of same AVD running** (unlikely but possible) | `runtime_avd_names` maps first match | 🟡 Race | Warn if duplicate serial→AVD mappings detected |
| B7 | **Boot_completed property is `1` but home screen hasn't loaded** (fast device) | Pipeline proceeds; `adb shell` may still fail | 🟡 Timing | Add small delay (1-2s) after boot_completed confirmation |
| B8 | **User launches with Quick Boot save enabled** — next shutdown saves snapshot over patched ramdisk | Root succeeds once, reverts on next normal launch | 🔴 #1 beginner failure | Post-root: auto cold-boot with `-no-snapshot-save`; show persistent warning |
| B9 | **Emulator goes offline during pipeline** (user closes it, ADB timeout) | `adb_shell_checked()` returns error at whatever step | 🟡 Unclear | Detect "device offline" in error string → "Emulator disconnected during rooting" |
| B10 | **Emulator has no internet** (offline AVD) | Stable download fails; local file works | 🟢 Handled | Source step already shows "Switch to Local File" on fetch error |

### 10.3 — ADB Connection

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| A1 | **ADB server not running** | `adb devices` auto-starts it | 🟢 Handled | — |
| A2 | **Multiple ADB instances** (Android Studio + standalone) | Port conflicts, stale connections | 🟡 Subtle | Preflight: detect `adb devices` error patterns |
| A3 | **Physical device connected alongside emulator** | `parse_adb_devices` filters for `emulator-*` serials | 🟢 Handled | — |
| A4 | **Emulator serial changes on restart** (e.g. `emulator-5554` → `emulator-5556`) | `runtime_avd_names()` re-maps on each poll | 🟢 Handled | — |
| A5 | **`adb shell` command outputs CRLF on Windows emulator** | `trim()` normalizes line endings | 🟢 Handled | — |
| A6 | **ADB `unauthorized` state** (shouldn't happen on emulators) | Not detected; commands silently fail | 🟡 Rare | Preflight: parse `adb devices` status column for non-`device` states |
| A7 | **`/data/local/tmp` not writable** (very restricted image) | `adb_prepare_workdir()` mkdir fails | 🟡 Rare | Try fallback workdir `/data/data/com.android.shell` (rootAVD's primary choice) |
| A8 | **ADB push/pull timeout on large Magisk APK** (~15MB) | Platform-specific TCP timeout | 🟡 Rare | No action needed — Magisk APK is typically <15MB |
| A9 | **ADB version mismatch** between host and emulator | Usually auto-handled by ADB protocol | 🟡 Rare | — |

### 10.4 — Ramdisk & Filesystem

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| R1 | **Ramdisk is `ramdisk-qemu.img`** (Automotive images) | `resolve_ramdisk_path()` checks both candidates | 🟢 Handled | — |
| R2 | **Ramdisk is 0 bytes** (corrupt download or incomplete SDK install) | Step 1 check: `ramdisk_size` but only logs, doesn't block | 🟡 Silent | Preflight: block with "Ramdisk is empty — reinstall system image" |
| R3 | **Ramdisk is read-only** (filesystem permissions on `system-images/` dir) | `fs::copy` fails at Step 7 | 🟡 Late failure | Preflight: verify write permission on ramdisk parent directory |
| R4 | **Ramdisk already patched** (re-root attempt) | `cpio test` returns status 1 (patched) — pipeline continues and re-patches | 🟢 Works | Preflight: show "Already patched — re-rooting will overwrite" info |
| R5 | **Ramdisk patched by unsupported tool** | `cpio test` returns status 2 → error | 🟢 Handled | — |
| R6 | **Backup already exists from prior root** | `ensure_backup` skips if `.backup` exists | 🟢 Handled | — |
| R7 | **Backup file is corrupt** (user manually edited it) | Restore copies corrupt file back | 🟡 Rare | Verify backup size > 0 before allowing restore |
| R8 | **Ramdisk uses unknown compression** (not LZ4/GZ/raw CPIO) | `detect_compression_method()` returns error | 🟡 Rare | Show: "Unsupported ramdisk format — try a different system image" |
| R9 | **Multiple ramdisk files exist** (e.g. both `ramdisk.img` and `ramdisk-qemu.img`) | `resolve_ramdisk_path()` picks first existing candidate | 🟢 Handled | — |
| R10 | **Patched ramdisk is larger than original** (Magisk adds ~2MB) | No size check | 🟢 Normal | — |
| R11 | **Disk full on host** during ramdisk write-back (Step 7) | `fs::copy` returns error | 🟡 Unclear | Better error: "Disk full — free space and retry" |
| R12 | **Disk full on emulator** during ramdisk push | `adb push` fails | 🟡 Unclear | Parse ADB error for "No space left" → user-friendly message |
| R13 | **System-image directory is shared across AVDs** (same API level) | Patching affects ALL AVDs using that image | 🔴 Silent side-effect | Preflight: warn "This ramdisk is shared by N AVDs" if multiple AVDs reference same `image.sysdir.1` |

### 10.5 — Magisk Package

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| M1 | **Corrupt APK/ZIP** (incomplete download) | `ZipArchive::new()` fails | 🟢 Handled | — |
| M2 | **Magisk fork with different internal layout** (no `assets/util_functions.sh`) | Version falls back to `"unknown"` / `"0"` | 🟡 Cosmetic | — |
| M3 | **Magisk fork missing `stub.apk`** | `stub_apk` is `None`, skip stub injection | 🟢 Handled | — |
| M4 | **Magisk version < 26 on API 34+** | Pipeline succeeds but sepolicy may not load properly | 🔴 Silent | Preflight: parse version code, warn if < 26000 on API ≥ 34 |
| M5 | **Magisk version ≥ 26 with `FAKEBOOTIMG` recommendation** | Not communicated to user | 🟡 Informational | Note in source step: "Magisk 26+ — automated pipeline recommended over FAKEBOOTIMG" |
| M6 | **User provides `.zip` file instead of `.apk`** | `normalize_root_package()` renames to `.apk` | 🟢 Handled | — |
| M7 | **User provides completely wrong file** (e.g. a PDF renamed to `.apk`) | ZIP open fails | 🟢 Handled | — |
| M8 | **ABI mismatch** — package built for ARM only, emulator is x86_64 | `extract_magisk_package` tries fallback dirs, then fails | 🟢 Handled | — |
| M9 | **GitHub API rate-limited** during stable release fetch | HTTP error, user sees "Could not reach GitHub" | 🟢 Handled | Already shows retry + "Switch to Local File" |
| M10 | **GitHub releases JSON format changes** | `fetch_magisk_stable_release()` fails to parse | 🟡 Rare | Error surfaces, user falls back to local file |
| M11 | **Cached Magisk APK from prior download is stale** | No cache invalidation | 🟡 Minor | Check file age or always re-download |
| M12 | **Very old Magisk (< v23)** on 64-bit-only system image | rootAVD notes: "64 Bit Only Systems needs Magisk 23.x" | 🟡 Rare | Preflight: warn if version < 23 on 64-bit ABI |

### 10.6 — Pipeline Timing & Concurrency

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| T1 | **User clicks Root twice rapidly** | No mutex — could run two pipelines concurrently | 🔴 Race | Frontend: disable button during active wizard; backend: mutex on `root_avd_automated` |
| T2 | **User switches AVD mid-rooting** | Store updates `selectedAvdName` but pipeline runs on old serial | 🟡 Confusing | Lock AVD selection while rooting is in progress |
| T3 | **User closes app during rooting** | Pipeline orphaned — partial state on emulator workdir | 🟡 Stale files | Workdir cleaned on next run; backup protects ramdisk |
| T4 | **Emulator shuts down too fast at Step 7** — APK install skipped | `manager_installed = false` | 🟢 Handled | Result step already shows "install manually" note |
| T5 | **`boot_completed` poll races with emulator freeze** | 60s timeout, then error | 🟢 Handled | — |
| T6 | **User restores backup while emulator is still running** | Restore writes to disk, but emulator snapshot may overwrite on shutdown | 🟡 Subtle | Warn: "Stop the emulator before restoring" |
| T7 | **5s polling interval causes stale `is_running` state** | User sees "Running" but emulator just died | 🟡 Minor | Reduce poll interval to 3s for active Root tab |
| T8 | **Progress event arrives after user cancelled** | `cancelledRef` prevents state update | 🟢 Handled | — |

### 10.7 — Post-Root Lifecycle

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| P1 | **User normal-boots after root** — snapshot overwrites patched ramdisk | Root is lost silently | 🔴 #1 failure | Auto cold-boot from result step; persistent "always cold boot" reminder |
| P2 | **User wipes data** — Magisk Manager lost but ramdisk stays patched | Magisk still active, but manager needs reinstall | 🟡 Confusing | — |
| P3 | **AVD snapshot saved AFTER patching** (user enabled Quick Boot save) | Future normal boots will have root! But user doesn't know | 🟡 Surprising | — |
| P4 | **Magisk "Requires Additional Setup" popup on first boot** | User may not know to accept it | 🟡 UX | Add note in result step: "Accept the 'Additional Setup' prompt in Magisk" |
| P5 | **Magisk modules cause bootloop** | User is stuck | 🟡 Recovery | Result step: add "Safe Mode" instructions (hold Volume Down) |
| P6 | **User tries to root a Play Store image** (production build, `ro.debuggable=0`) | Our pipeline works on ramdisk regardless | 🟢 Works | — |
| P7 | **User tries to root a Google APIs image** (no Play Store) | Works identically | 🟢 Works | — |
| P8 | **System update inside emulator overwrites ramdisk** | Root lost; backup still exists | 🟡 Rare | — |

### 10.8 — Platform-Specific (Windows)

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| W1 | **Long path names** (>260 chars) — SDK deep in user profile + nested system-images | `\\?\` prefix not used | 🟡 Rare | Use extended-length path prefix on Windows |
| W2 | **File locked by another process** (Android Studio, antivirus scan) | `fs::copy` / `fs::write` fails | 🟡 Unclear | Parse error for "Access is denied" → "Close Android Studio and retry" |
| W3 | **Windows Defender SmartScreen blocks extracted binaries** | `adb push` succeeds (pushing raw bytes), but local `magiskboot` may be flagged | 🟢 N/A | We don't run `magiskboot` locally — it runs inside the emulator |
| W4 | **Line ending issues** (CRLF in ADB shell output) | `trim()` normalizes | 🟢 Handled | — |
| W5 | **Spaces in Windows username** (e.g. `C:\Users\John Doe\`) | PathBuf handles it; ADB quoting may break | 🟡 Possible | Verify all ADB command paths are properly quoted |

### 10.9 — API Level Compatibility

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| C1 | **API 28 (Pie)** — system-as-root, not supported by rootAVD | Not detected | 🔴 Unsupported | Preflight: block with "API 28 is not supported for ramdisk rooting" |
| C2 | **API 25 (Nougat)** — very old, may lack `xxd` or `od` | `detect_compression_method()` falls back to `od` | 🟢 Handled | — |
| C3 | **API 34+ (Android 14+)** — needs Magisk 26+ for sepolicy | Not checked | 🟡 Silent fail | Preflight: warn if Magisk version < 26 |
| C4 | **API 35+ (Android 15+)** — new boot image format changes | Unknown — depends on future Magisk releases | 🟡 Future | Monitor Magisk release notes |
| C5 | **Automotive / TV / Wear images** — different ramdisk naming | `ramdisk-qemu.img` support added | 🟢 Partially handled | Preflight: note "Automotive image — extra steps may be needed" |
| C6 | **Android Preview/Beta images** (non-numeric API like "UpsideDownCake") | `parse_api_level()` returns `None` | 🟡 Cosmetic | Show "Unknown API" instead of blocking |

### 10.10 — UI/UX State

| # | Edge Case | Current Handling | Risk | Proposed Fix |
|---|-----------|-----------------|------|-------------|
| U1 | **User on Root tab, AVD stops externally** (killed from Android Studio) | 5s poll catches it, but wizard may be mid-step | 🟡 Jarring | Detect `is_running` change during wizard → show "Emulator disconnected" |
| U2 | **User on Root tab with progress, switches to Launch tab and back** | Wizard state preserved in Zustand store | 🟢 Handled | — |
| U3 | **User clicks "Cold Boot" from result step but emulator fails to start** | `launch_avd` returns error → toast | 🟢 Handled | — |
| U4 | **User clicks "Restore Stock" but no backup exists** | `restore_backups` returns "backup files missing" error | 🟢 Handled | — |
| U5 | **User sees "Try Manual Mode (FAKEBOOTIMG)" but doesn't understand it** | No explanation | 🟡 UX | Add tooltip: "Opens Magisk App inside the emulator to patch manually" |
| U6 | **Window resized very small** — wizard steps overflow | Responsive flex layout | 🟢 Handled | — |
| U7 | **Multiple rapid AVD switches while loading restore plan** | `cancelled` flag in `useEffect` cleanup | 🟢 Handled | — |

---

### Summary: Priority Edge Cases for Pre-Flight Scan

These are the **must-handle** edge cases for the new preflight system:

| Priority | ID(s) | Check |
|----------|-------|-------|
| 🔴 P0 | B3, B8, P1 | Boot mode detection + cold boot enforcement |
| 🔴 P0 | C1 | API 28 blocking |
| 🔴 P0 | R13 | Shared ramdisk warning |
| 🟡 P1 | M4, C3 | Magisk version vs API level compatibility |
| 🟡 P1 | R2, R3 | Ramdisk integrity + write permission |
| 🟡 P1 | E6 | Missing system image detection |
| 🟡 P1 | T1, T2 | Concurrency guards (double-click, AVD switch) |
| 🟢 P2 | B2, B4 | Safe mode / writable-system detection |
| 🟢 P2 | E8, W2 | AV/file-lock error parsing |
| 🟢 P2 | P4, P5 | Post-root guidance (Additional Setup, Safe Mode) |

---

## Appendix: rootAVD Key Functions Reference

| Function | Purpose | Our Equivalent |
|----------|---------|----------------|
| `ShutDownAVD()` | `setprop sys.powerctl shutdown` | Step 7 of `root_avd_automated` |
| `create_backup()` | Copy ramdisk to `.backup` | `backup::ensure_backup()` |
| `restore_backups()` | Copy `.backup` → original | `RestoreAvdBackups` command |
| `TestADB()` | Check ADB connectivity | `runtime::is_serial_online()` |
| `create_fake_boot_img()` | FAKEBOOTIMG for Magisk App | `build_fake_boot_image()` |
| `CopyMagiskToAVD()` | Push ramdisk + script to emulator | Steps 4-5 of pipeline |
| `CheckAVDIsOnline()` | Internet connectivity check | Not needed (we download host-side) |
| `decompress_ramdisk()` | Magic-byte compression detect | `detect_compression_method()` |

---

> **Next action:** Begin Phase 1 implementation — start with the `RootReadinessScan` model and backend command, then build the preflight UI component.
