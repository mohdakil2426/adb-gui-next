# AVD Rooting Architecture Audit & Proposal

**Date:** 2026-04-08  
**Scope:** Deep analysis of `rootAVD` reference architecture vs. current `adb-gui-next` Emulator Manager rooting implementation  
**Goal:** Design a robust, one-click, fork-agnostic AVD rooting pipeline for non-technical users

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [rootAVD Reference Architecture — Deep Dive](#2-rootavd-reference-architecture--deep-dive)
3. [Current Implementation Audit](#3-current-implementation-audit)
4. [Gap Analysis — Feature Matrix](#4-gap-analysis--feature-matrix)
5. [Proposed Architecture — One-Click Root Pipeline](#5-proposed-architecture--one-click-root-pipeline)
6. [UX Workflow — Wizard Design](#6-ux-workflow--wizard-design)
7. [Edge Cases & Failure Modes](#7-edge-cases--failure-modes)
8. [Backend Implementation Roadmap](#8-backend-implementation-roadmap)
9. [Frontend Implementation Roadmap](#9-frontend-implementation-roadmap)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Executive Summary

### The Problem

Our current AVD rooting implementation is an "assisted workflow" that requires users to:
1. Manually select a root package file (`.apk`/`.zip`)
2. Wait for the tool to push a fake boot image and install the manager
3. **Manually open the root app inside the emulator, navigate to "Direct Install", select `fakeboot.img`, and patch it**
4. Return to our app and click "Finalize Root"
5. Cold boot the emulator

This 5-step manual process assumes the user already knows what Magisk is, what a ramdisk is, how the "Direct Install" workflow functions, and how to navigate the Magisk UI. **A non-technical user will not succeed.**

### The Solution

Replace the manual-patch-inside-emulator flow with a fully automated pipeline that performs the entire rootAVD algorithm natively — no dependency on the Magisk app patching the fake boot image inside the guest. The user's only job is:

1. Select an AVD
2. Optionally pick a Magisk package (or let us auto-download stable/canary/alpha)
3. Click **"Root"**
4. Wait for the progress bar
5. Cold boot

### Key Insight from rootAVD

rootAVD does **not** rely on the Magisk app to patch the ramdisk for the standard flow. It:
1. Extracts `magiskinit`, `magisk32`/`magisk64`, and `busybox` from the Magisk `.apk`/`.zip`
2. Decompresses the ramdisk (LZ4, GZ, or raw CPIO)
3. Uses `magiskboot` (extracted from the package) to inject Magisk init into the CPIO
4. Recompresses the patched ramdisk
5. Writes the patched ramdisk back to the system-image directory

The `FAKEBOOTIMG` mode (which our implementation mimics) is rootAVD's **fallback** for edge cases where the script can't run inside the emulator shell or for users who want to use Magisk's own patching logic. It is NOT the primary mechanism.

---

## 2. rootAVD Reference Architecture — Deep Dive

### 2.1 Dual Execution Model

rootAVD has a **split-brain** architecture:

```
Host Machine                    │  Emulator Guest (via ADB shell)
────────────────────────────────┼───────────────────────────────────
1. Parse args                   │
2. Resolve ANDROID_HOME         │
3. Find ramdisk.img path        │
4. Create backup (.backup)      │
5. Push ramdisk + Magisk.zip    │
6. Push rootAVD.sh itself       │
7. adb shell sh rootAVD.sh ──── │→ 8. Detect shell (emulator vs host)
                                │  9. Find BusyBox in Magisk.zip/APK
                                │  10. Extract Magisk via unzip/pm
                                │  11. Detect arch (x86/x64/arm/arm64)
                                │  12. Decompress ramdisk (LZ4/GZ)
                                │  13. Split multi-CPIO archives (API ≥30)
                                │  14. Test ramdisk patch status
                                │  15. Patch ramdisk with magiskinit
                                │  16. Recompress ramdisk
8. Pull patched ramdisk  ←───── │  17. Output ramdiskpatched4AVD.img
9. Pull Magisk.apk              │
10. Install APKs from Apps/     │
11. Shutdown AVD                │
```

### 2.2 Critical Algorithm Steps (Inside Guest)

#### Step A: BusyBox Bootstrap (`PrepBusyBoxAndMagisk`)
- The Magisk ZIP/APK contains a BusyBox binary in `lib/*/libbusybox.so`
- rootAVD extracts it, tests if it can `unzip`, tries multiple ABI variants
- BusyBox provides `cpio`, `gzip`, `lz4`, `sed`, `find`, `strings` — tools the bare Android shell lacks

#### Step B: Architecture Detection (`api_level_arch_detect`)
- Reads `ro.product.cpu.abi`, `ro.product.cpu.abilist32/64`
- Maps ABI → architecture for correct binary selection:
  - `x86` → x86/x86
  - `x86_64` → x64/x86
  - `arm64-v8a` → arm64/armeabi-v7a
  - default → arm/armeabi-v7a
- Determines IS64BIT, IS64BITONLY, IS32BITONLY flags

#### Step C: Ramdisk Decompression (`detect_ramdisk_compression_method` + `decompress_ramdisk`)
- Detects magic bytes: `02214c18` = LZ4, `1f8b0800` = GZ
- API >= 30: ramdisk may contain **multiple concatenated CPIO archives** (TRAILER!!). Must:
  1. Split at TRAILER boundaries
  2. Decompress each segment individually (LZ4/GZ)
  3. Extract all into a unified directory
  4. Re-create CPIO from the merged tree
- API < 30: simple decompress → single CPIO

#### Step D: Ramdisk Patching (`patching_ramdisk`)
- Sets environment config: `KEEPVERITY`, `KEEPFORCEENCRYPT`, `RECOVERYMODE`
- Compresses `magisk32`/`magisk64` with XZ to save ramdisk space
- Creates overlay directories: `overlay.d/sbin`
- Uses `magiskboot cpio` to:
  - Replace `init` with `magiskinit`
  - Add compressed `magisk32.xz`, `magisk64.xz`, `stub.xz`
  - Execute `patch` (sets Magisk's cpio patch markers)
  - Create `.backup` directory with original `ramdisk.cpio.orig`
  - Write `.backup/.magisk` config file

#### Step E: Ramdisk Repacking (`repacking_ramdisk`)
- If cpio was compressed (status flag `& 4`), re-compress the CPIO data
- Recompress with the original method (GZ or LZ4-legacy)
- Output: `ramdiskpatched4AVD.img`

#### Step F: Magisk Version Selection (`CheckAvailableMagisks`)
- If AVD is online, fetches `stable.json`, `canary.json`, `alpha.json` from:
  - `raw.githubusercontent.com/topjohnwu/magisk-files/master/`
  - `raw.githubusercontent.com/vvb2060/magisk_files/alpha/`
- Presents interactive menu (stable/canary/alpha)
- Downloads selected version, replaces local `Magisk.zip`
- If offline, uses whatever local `Magisk.zip` is present

#### Step G: FAKEBOOTIMG Mode (Our Current Approach)
- Creates a minimal Android boot image header + raw ramdisk CPIO
- Pushes to `/sdcard/Download/fakeboot.img`
- Installs Magisk app temporarily
- Launches Magisk via `monkey` command
- **User must manually patch inside the app** (60s timer)
- Pulls back `*magisk_patched*` file, extracts patched ramdisk

### 2.3 Key rootAVD Design Decisions

| Decision | Rationale |
|:---|:---|
| Runs patching inside the emulator shell | Access to `magiskboot` (native binary), correct ABI detection, access to device properties |
| BusyBox bootstrapping | Android shell lacks `cpio`, `gzip`, proper `find`, `strings` |
| Multi-CPIO split (API >= 30) | Google changed ramdisk format; single CPIO decompress would corrupt the image |
| `.backup` file convention | Simple file-adjacent backups; restore = copy `.backup` → original |
| Offline fallback | Works without internet by using local `Magisk.zip` |
| Version menu | Users want specific Magisk channels (stable vs canary vs alpha) |
| FAKEBOOTIMG as fallback | For cases where in-emulator patching fails or user prefers Magisk's internal patcher |

---

## 3. Current Implementation Audit

### 3.1 What We Have (root.rs — 270 lines)

| Component | What It Does | Status |
|:---|:---|:---|
| `validate_root_package_path()` | Checks `.apk`/`.zip` extension | ✅ Good |
| `normalized_root_package_path()` | Renames `.zip` → `.apk` (temp copy) | ⚠️ Workaround for Magisk APK install |
| `build_fake_boot_image()` | Constructs minimal Android boot header + raw ramdisk | ✅ Correct but limited |
| `extract_ramdisk_from_fake_boot()` | Parses boot header to extract patched ramdisk payload | ✅ Works |
| `detect_root_app_package()` | `pm list packages` → finds magisk/kitsune/delta/alpha | ✅ Fork detection |
| `prepare_root()` | Full workflow: backup → build fake boot → push → install APK → launch app | ⚠️ Relies on manual user patching |
| `finalize_root()` | Pulls `*magisk_patched*` → extracts ramdisk → writes to system-image | ⚠️ Fragile discovery |

### 3.2 Critical Gaps Identified

#### 🔴 GAP-01: No Native Ramdisk Patching
We rely entirely on the Magisk app's "Direct Install" feature inside the emulator to patch the fake boot image. This:
- Requires the user to know what to do inside Magisk
- Fails if Magisk doesn't auto-detect the fake boot image
- Fails with some Magisk forks that have different UX flows
- Depends on the emulator having a working UI and touch input
- Has a 60-second timer in rootAVD; we have no timer at all

#### 🔴 GAP-02: No Ramdisk Decompression
Our `build_fake_boot_image()` takes the raw `ramdisk.img` bytes and wraps them in a boot header. We never:
- Detect the compression method (LZ4 vs GZ vs raw)
- Handle multi-CPIO concatenated archives (API >= 30)
- Decompress/recompress the ramdisk

This means our fake boot image contains **compressed ramdisk bytes**, not a raw CPIO. Whether Magisk handles this during patching is architecture-dependent and fragile.

#### 🔴 GAP-03: No magiskboot Integration
rootAVD's primary mechanism extracts `magiskboot` from the Magisk package and uses it to:
- Test ramdisk patch status (`cpio test`)
- Patch the CPIO with magiskinit
- Create `.backup/.magisk` config
- Compress/decompress ramdisk

We have **zero** `magiskboot` integration. We could extract it from the provided Magisk package and run it on the host (for x86/x64 AVDs) or inside the emulator via ADB shell.

#### 🟡 GAP-04: No Magisk Channel Selection
rootAVD fetches and presents stable/canary/alpha versions. Our UI only accepts a local file picker. Users must manually find, download, and select the correct Magisk package.

#### 🟡 GAP-05: No Architecture-Aware Binary Selection
rootAVD detects the emulator's ABI and selects the matching `magisk32`/`magisk64`/`magiskinit` binaries. We don't do any ABI detection.

#### 🟡 GAP-06: No Patch Status Detection
rootAVD runs `magiskboot cpio ramdisk.cpio test` to detect:
- `0`: Stock boot image
- `1`: Magisk-patched boot image
- `2`: Unsupported patcher
- `& 4`: Compressed CPIO
- `& 8`: Two-stage init

We don't check if the ramdisk is already patched before attempting to re-root.

#### 🟡 GAP-07: No Online Magisk Download
rootAVD downloads Magisk from GitHub if the emulator has internet. We require users to bring their own file. For a "normal user who has no knowledge", this is a major blocker.

#### 🟡 GAP-08: Fragile Patched File Discovery
`finalize_root()` runs `ls -t /sdcard/Download/*magisk_patched*` and picks the newest. This fails if:
- The user patched a different file
- Multiple patched files exist from previous sessions
- The Download directory was cleared
- File permissions block listing

#### 🟡 GAP-09: No Progress Feedback
The entire prepare/finalize flow runs as a single blocking ADB operation. No incremental progress events are emitted. The user sees "Preparing…" / "Finalizing…" with no indication of what's happening.

#### 🟡 GAP-10: No Post-Root Verification
After replacing the ramdisk, we don't verify:
- Whether Magisk actually installed successfully on next boot
- Whether `su` binary is available
- Whether `magisk --daemon` is running

#### 🟢 GAP-11: Fork Detection Works
`detect_root_app_package()` correctly searches for `magisk`, `kitsune`, `delta`, `alpha` package names. This is already fork-aware.

#### 🟢 GAP-12: Backup System Works
`backup.rs` correctly creates `.backup` sidecar files and can restore them. Compatible with rootAVD's backup convention.

---

## 4. Gap Analysis — Feature Matrix

| Feature | rootAVD | Our Implementation | Priority |
|:---|:---:|:---:|:---:|
| Direct ramdisk patching (no app required) | ✅ | ❌ | 🔴 Critical |
| Ramdisk decompression (LZ4/GZ) | ✅ | ❌ | 🔴 Critical |
| Multi-CPIO split (API >= 30) | ✅ | ❌ | 🔴 Critical |
| `magiskboot` extraction & execution | ✅ | ❌ | 🔴 Critical |
| Architecture detection (x86/x64/ARM) | ✅ | ❌ | 🟡 High |
| Magisk channel selection (stable/canary/alpha) | ✅ | ❌ | 🟡 High |
| Online Magisk download | ✅ | ❌ | 🟡 High |
| Ramdisk patch status detection | ✅ | ❌ | 🟡 High |
| FAKEBOOTIMG fallback mode | ✅ | ✅ (current default) | ✅ Done |
| BusyBox bootstrap (inside emulator) | ✅ | N/A (host-side) | ⚪ Not needed if host-side |
| Backup/restore | ✅ | ✅ | ✅ Done |
| Fork detection (kitsune/delta/alpha) | ✅ | ✅ | ✅ Done |
| Post-root verification | ⚠️ (shutdown only) | ❌ | 🟡 High |
| Progress events | ❌ (terminal output) | ❌ | 🟡 High |
| Kernel module installation | ✅ | ❌ | 🟢 Low (niche) |
| fstab patching | ✅ | ❌ | 🟢 Low (niche) |
| BlueStacks support | ✅ | ❌ | ⚪ Out of scope |
| Custom RC script injection | ✅ | ❌ | ⚪ Out of scope |

---

## 5. Proposed Architecture — One-Click Root Pipeline

### 5.1 Strategy: Host-Side magiskboot Execution via ADB

Instead of implementing CPIO parsing, LZ4/GZ compression, and ramdisk patching in pure Rust (massive effort, fragile, must stay in sync with Magisk's evolving format), we use rootAVD's own strategy: **extract `magiskboot` from the Magisk package and run it inside the emulator via ADB shell**.

This is the correct approach because:
1. `magiskboot` is Magisk's own tool — it's always compatible with the Magisk version being installed
2. It handles all ramdisk formats, compression methods, and patch operations
3. It runs natively on the emulator's architecture (x86_64 in most cases)
4. rootAVD has proven this approach works across API 24–34+

### 5.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                               │
│  EmulatorRootTab → RootWizard (3-step)                             │
│    Step 1: Source Selection (local file / online channel picker)     │
│    Step 2: One-click Root (progress stepper with live status)       │
│    Step 3: Result (success/failure + next steps)                    │
├─────────────────────────────────────────────────────────────────────┤
│                      Tauri IPC                                      │
│  root_avd { avdName, serial, source: LocalFile|Channel }            │
│  → Emits: root:progress { step, message, percent }                  │
├─────────────────────────────────────────────────────────────────────┤
│                      Backend (Rust)                                  │
│  emulator/root.rs — Orchestrator                                    │
│    ┌────────────────────────────────────────────────────────────┐   │
│    │  Phase 1: Resolve & Validate                              │   │
│    │  ├─ Resolve AVD, ramdisk_path, API level, ABI            │   │
│    │  ├─ Create .backup of ramdisk.img                         │   │
│    │  └─ Validate emulator is running + ADB online             │   │
│    │                                                           │   │
│    │  Phase 2: Package Acquisition                              │   │
│    │  ├─ (Local) Validate .apk/.zip extension                  │   │
│    │  └─ (Online) Fetch channel JSON → download Magisk.zip     │   │
│    │                                                           │   │
│    │  Phase 3: Extract magiskboot + binaries                    │   │
│    │  ├─ Unzip Magisk package to temp dir                      │   │
│    │  ├─ Find lib/{abi}/libmagiskboot.so → magiskboot          │   │
│    │  ├─ Find lib/{abi}/libmagiskinit.so → magiskinit          │   │
│    │  ├─ Find lib/{abi}/libmagisk{32|64}.so → magisk{32|64}    │   │
│    │  ├─ Find lib/{abi}/libbusybox.so → busybox                │   │
│    │  └─ Find assets/stub.apk (if present)                     │   │
│    │                                                           │   │
│    │  Phase 4: Push & Patch (via ADB)                           │   │
│    │  ├─ Push ramdisk.img to emulator workdir                  │   │
│    │  ├─ Push magiskboot, magiskinit, magisk*, busybox         │   │
│    │  ├─ Detect compression: magiskboot decompress ramdisk.img │   │
│    │  ├─ Test patch status: magiskboot cpio ramdisk.cpio test  │   │
│    │  ├─ Patch: magiskboot cpio ramdisk.cpio [add init, ...]   │   │
│    │  ├─ If compressed: magiskboot cpio ramdisk.cpio compress  │   │
│    │  └─ Repack: magiskboot compress=METHOD ramdisk.cpio out   │   │
│    │                                                           │   │
│    │  Phase 5: Pull & Replace                                   │   │
│    │  ├─ Pull patched ramdisk from emulator                    │   │
│    │  ├─ Write to system-image ramdisk_path                    │   │
│    │  └─ Install Magisk.apk (for Magisk Manager access)        │   │
│    │                                                           │   │
│    │  Phase 6: Verify & Finalize                                │   │
│    │  ├─ Shutdown emulator via `adb emu kill`                  │   │
│    │  └─ Report success with cold-boot instructions            │   │
│    └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Magisk Package Structure (Reference)

```
Magisk-v28.1.apk (or .zip — identical structure):
├── lib/
│   ├── x86_64/
│   │   ├── libmagiskboot.so      → magiskboot (ramdisk patcher)
│   │   ├── libmagiskinit.so      → magiskinit (init replacement)
│   │   ├── libmagisk64.so        → magisk daemon (64-bit)
│   │   ├── libmagisk32.so        → magisk daemon (32-bit)
│   │   ├── libbusybox.so         → BusyBox multicall binary
│   │   └── libstub.so            → (64-bit only flag)
│   ├── x86/
│   │   └── ... (32-bit variants)
│   ├── arm64-v8a/
│   │   └── ... (ARM64 variants)
│   └── armeabi-v7a/
│       └── ... (ARM32 variants)
├── assets/
│   ├── stub.apk                  → Magisk stub APK
│   ├── util_functions.sh         → Version info (MAGISK_VER, MAGISK_VER_CODE)
│   └── ...
└── AndroidManifest.xml
```

### 5.4 ABI Mapping Matrix

| Emulator ABI (`ro.product.cpu.abi`) | Arch | Magisk lib dir | magisk binary | 32-bit fallback |
|:---|:---|:---|:---|:---|
| `x86_64` | x64 | `lib/x86_64/` | `libmagisk64.so` | `lib/x86/` |
| `x86` | x86 | `lib/x86/` | `libmagisk32.so` | — |
| `arm64-v8a` | arm64 | `lib/arm64-v8a/` | `libmagisk64.so` | `lib/armeabi-v7a/` |
| `armeabi-v7a` | arm | `lib/armeabi-v7a/` | `libmagisk32.so` | — |

---

## 6. UX Workflow — Wizard Design

### 6.1 Root Wizard (Replaces Current Root Tab)

The current Root Tab shows a flat form with a file picker and two buttons. Replace with a **3-step wizard**:

```
┌──────────────────────────────────────────────────────────┐
│  Root Emulator                                 [? Help]  │
│                                                          │
│  ● Step 1 — Source    ○ Step 2 — Root    ○ Step 3 — Done │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  How would you like to get Magisk?                       │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐          │
│  │   📥 Download      │  │   📁 Local File    │          │
│  │                    │  │                    │          │
│  │   Stable (v28.1)   │  │   Select a .apk    │          │
│  │   Canary (abc1234) │  │   or .zip file     │          │
│  │   Alpha  (xyz5678) │  │   from your PC     │          │
│  │                    │  │                    │          │
│  │   [Recommended]    │  │   [Advanced]       │          │
│  └────────────────────┘  └────────────────────┘          │
│                                                          │
│  ⚪ Supports: Magisk, KernelSU, Magisk Delta,            │
│    Kitsune Mask, and any other fork                      │
│                                                          │
│                                      [Continue →]        │
└──────────────────────────────────────────────────────────┘
```

**Step 2 — Root In Progress:**
```
┌──────────────────────────────────────────────────────────┐
│  Root Emulator                                           │
│                                                          │
│  ✅ Step 1 — Source   ● Step 2 — Root    ○ Step 3 — Done │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  Rooting Medium_Phone (API 34, x86_64)                   │
│  Using Magisk Stable v28.1                               │
│                                                          │
│  ✅ Backup created                                       │
│  ✅ Magisk binaries extracted (x86_64)                   │
│  ✅ Files pushed to emulator                             │
│  ⏳ Patching ramdisk...                                  │
│  ○ Pulling patched ramdisk                               │
│  ○ Writing to system image                               │
│  ○ Installing Magisk Manager                             │
│  ○ Verifying installation                                │
│                                                          │
│  ████████████████░░░░░░  65%                             │
│                                                          │
│                                      [Cancel]            │
└──────────────────────────────────────────────────────────┘
```

**Step 3 — Done:**
```
┌──────────────────────────────────────────────────────────┐
│  Root Emulator                                           │
│                                                          │
│  ✅ Step 1 — Source   ✅ Step 2 — Root    ● Step 3 — Done│
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  🎉 Root Successful!                                     │
│                                                          │
│  Medium_Phone is now rooted with Magisk v28.1            │
│                                                          │
│  Next steps:                                             │
│  1. Cold boot the emulator (do NOT use "Quick Boot")     │
│  2. Open Magisk Manager to configure modules             │
│  3. Verify root: open a terminal and run `su`            │
│                                                          │
│  ┌─────────────┐  ┌──────────────────┐                   │
│  │ 🔄 Cold Boot │  │ 🔙 Restore Stock │                   │
│  └─────────────┘  └──────────────────┘                   │
│                                                          │
│                                      [Done]              │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Fallback Mode

If the automated pipeline fails (e.g., `magiskboot` crashes, ABI mismatch, unknown ramdisk format), the wizard should:
1. Show a clear error with the failure reason
2. Offer a **"Try Manual Mode"** button that falls back to the current FAKEBOOTIMG approach
3. Provide step-by-step instructions with screenshots/diagrams

### 6.3 Root Status Badge

The AvdSwitcher pill should show root state clearly:

| State | Badge | Color |
|:---|:---|:---|
| Stock | `Stock` | `text-muted-foreground` |
| Rooted | `Rooted ✓` | `text-emerald-500` |
| Modified (backup exists, not verified) | `Modified` | `text-amber-500` |
| Unknown | `Unknown` | `text-muted-foreground` |

---

## 7. Edge Cases & Failure Modes

### 7.1 Ramdisk Format Edge Cases

| Case | Detection | Handling |
|:---|:---|:---|
| GZ-compressed ramdisk | Magic `1f8b08` | `magiskboot decompress` handles it |
| LZ4-compressed ramdisk | Magic `02214c18` | `magiskboot decompress` handles it |
| Raw CPIO (no compression) | No GZ/LZ4 magic | Direct CPIO manipulation |
| Multi-CPIO concatenated (API >= 30) | Multiple `TRAILER!!!` markers | rootAVD splits + merges; `magiskboot` handles internally |
| Already patched ramdisk | `magiskboot cpio test` = 1 | Ask user: "Already rooted. Re-root with different version?" |
| Corrupted ramdisk | Any parse failure | Abort with clear error; do not modify |

### 7.2 Package Edge Cases

| Case | Detection | Handling |
|:---|:---|:---|
| `.zip` file (renamed APK) | Extension check | Rename to `.apk` for `pm install` (current behavior) |
| Old Magisk (no `libstub.so`) | Missing file in lib/ | Use available 32-bit binaries (rootAVD: `IS64BITONLY` flow) |
| KernelSU / Kitsune Mask / Delta | Different lib structure | Try standard extraction, fall back to FAKEBOOTIMG if no `magiskinit` found |
| Corrupt/incomplete download | Unzip failure | Retry download or ask user to re-select |
| Missing ABI directory | `lib/{abi}/` doesn't exist | Try alternative ABI (x86 -> x86_64, arm -> arm64) |

### 7.3 Emulator State Edge Cases

| Case | Detection | Handling |
|:---|:---|:---|
| Emulator not running | `serial` is None | Block wizard; show "Launch emulator first" |
| Emulator booting (not fully online) | `adb shell getprop sys.boot_completed` != `1` | Poll until ready, show "Waiting for boot..." |
| Multiple emulators running | Multiple serials | Auto-select based on AVD name -> serial mapping |
| Emulator crashes during root | ADB connection lost | Abort gracefully; offer restore |
| `/data/data/com.android.shell` doesn't exist | `cd` fails | Fallback to `/data/local/tmp` (rootAVD pattern) |
| No writable-system mount | `adb root` fails | Not needed for ramdisk patching (host-side) |

### 7.4 Permission & Path Edge Cases

| Case | Detection | Handling |
|:---|:---|:---|
| System image is read-only | `fs::write` fails | Error: "System image is read-only. Run emulator with -writable-system" |
| Ramdisk path contains spaces | Path string handling | All paths wrapped in quotes / proper escaping |
| Long Windows paths (> 260 chars) | Write failure | Use `\\?\` prefix for long paths |
| System image shared between AVDs | All AVDs point to same ramdisk | Warn: "This ramdisk is shared between N AVDs. All will be affected." |

### 7.5 Android Version Edge Cases

| API | Notes | Special Handling |
|:---|:---|:---|
| 24-28 | Older format, simpler ramdisk | `RECOVERYMODE=true` for API 28 |
| 29 | Transition period | Standard flow |
| 30+ | Multi-CPIO, system-as-root | Split/merge CPIO; `KEEPVERITY=true` for system-as-root |
| 33+ | 64-bit only images | Skip `magisk32` binary |
| 34+ | Latest API | Verify `magiskboot` compatibility |

---

## 8. Backend Implementation Roadmap

### Phase 1: magiskboot Pipeline (Critical MVP)

> **New files**: `emulator/magisk_package.rs`, updates to `emulator/root.rs`

#### 8.1.1 Magisk Package Extraction (`magisk_package.rs`)

```rust
pub struct MagiskPackageContents {
    pub magiskboot_path: PathBuf,
    pub magiskinit_path: PathBuf,
    pub magisk_binary_path: PathBuf,  // magisk32 or magisk64
    pub magisk32_path: Option<PathBuf>,
    pub busybox_path: PathBuf,
    pub stub_apk_path: Option<PathBuf>,
    pub version: String,
    pub version_code: String,
    pub abi: String,
}

/// Extract critical binaries from a Magisk .apk/.zip
pub fn extract_magisk_package(
    package_path: &Path,
    target_abi: &str,
    work_dir: &Path,
) -> CmdResult<MagiskPackageContents>;
```

Key operations:
- Unzip the package to a temp directory
- Detect ABI: try `target_abi` first, fall back to alternatives
- Rename `lib*.so` -> actual binary names (`libmagiskboot.so` -> `magiskboot`)
- Parse `assets/util_functions.sh` for `MAGISK_VER` and `MAGISK_VER_CODE`
- Make all extracted binaries executable (chmod +x)

#### 8.1.2 ABI Detection from Running Emulator

```rust
pub fn detect_emulator_abi(app: &AppHandle, serial: &str) -> CmdResult<String> {
    // adb -s <serial> shell getprop ro.product.cpu.abi
}

pub fn detect_emulator_api_level(app: &AppHandle, serial: &str) -> CmdResult<u32> {
    // adb -s <serial> shell getprop ro.build.version.sdk
}
```

#### 8.1.3 ADB-Executed Root Pipeline

```rust
pub fn root_avd_automated(
    app: &AppHandle,
    avd_name: &str,
    serial: &str,
    package: &MagiskPackageContents,
    ramdisk_path: &Path,
    progress: impl Fn(RootProgress),
) -> CmdResult<RootResult>;
```

Steps (all via `run_binary_command(app, "adb", ...)`):
1. `adb push magiskboot /data/local/tmp/magisk/`
2. `adb push magiskinit /data/local/tmp/magisk/`
3. `adb push magisk64 /data/local/tmp/magisk/` (and/or magisk32)
4. `adb push busybox /data/local/tmp/magisk/`
5. `adb push ramdisk.img /data/local/tmp/magisk/`
6. `adb shell chmod 755 /data/local/tmp/magisk/*`
7. `adb shell /data/local/tmp/magisk/magiskboot decompress ramdisk.img ramdisk.cpio`
8. `adb shell /data/local/tmp/magisk/magiskboot cpio ramdisk.cpio test` -> parse exit code
9. Compress magisk binaries: `magiskboot compress=xz magisk64 magisk64.xz`
10. Patch: `magiskboot cpio ramdisk.cpio "add 0750 init magiskinit" "add 0644 overlay.d/sbin/magisk64.xz magisk64.xz" "patch" "backup ramdisk.cpio.orig" "mkdir 000 .backup" "add 000 .backup/.magisk config"`
11. If compressed: `magiskboot cpio ramdisk.cpio compress`
12. Recompress: `magiskboot compress=<method> ramdisk.cpio ramdiskpatched.img`
13. `adb pull /data/local/tmp/magisk/ramdiskpatched.img <local_temp_path>`
14. Copy patched ramdisk to system-image directory
15. `adb install -r Magisk.apk`
16. Cleanup: `adb shell rm -rf /data/local/tmp/magisk`

#### 8.1.4 Progress Events

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootProgress {
    pub step: u8,        // 1-8
    pub total_steps: u8, // 8
    pub label: String,
    pub detail: Option<String>,
}
```

Emit via `app.emit("root:progress", &progress)`.

### Phase 2: Online Magisk Download

> **New file**: `emulator/magisk_download.rs`

```rust
pub struct MagiskChannel {
    pub channel: String,     // "stable", "canary", "alpha"
    pub version: String,
    pub version_code: String,
    pub download_url: String,
}

/// Fetch available channels from GitHub
pub async fn fetch_magisk_channels() -> CmdResult<Vec<MagiskChannel>>;

/// Download a specific Magisk version to a local path
pub async fn download_magisk(channel: &MagiskChannel, target_dir: &Path) -> CmdResult<PathBuf>;
```

Sources:
- Stable/Canary: `https://raw.githubusercontent.com/topjohnwu/magisk-files/master/{channel}.json`
- Alpha: `https://raw.githubusercontent.com/vvb2060/magisk_files/alpha/alpha.json`

JSON structure:
```json
{
  "version": "28.1",
  "versionCode": 28100,
  "link": "https://github.com/topjohnwu/Magisk/releases/download/v28.1/Magisk-v28.1.apk",
  "note": "..."
}
```

### Phase 3: Post-Root Verification

After cold boot, detect root status:
```rust
pub fn verify_root_status(app: &AppHandle, serial: &str) -> CmdResult<RootVerification> {
    // 1. adb shell su -c "id" -> check uid=0
    // 2. adb shell "magisk -v" -> version
    // 3. adb shell "magisk --daemon" -> running check
    // 4. pm list packages magisk -> manager installed
}
```

### Phase 4: Fallback Mode (Keep Current FAKEBOOTIMG)

Keep the current `prepare_root()` + `finalize_root()` as a manual fallback accessible via "Advanced options" or automatically triggered when Phase 1 fails.

---

## 9. Frontend Implementation Roadmap

### 9.1 New Components

| Component | Purpose |
|:---|:---|
| `RootWizard.tsx` | 3-step wizard shell with step indicator |
| `RootSourceStep.tsx` | Source selection (download channel picker + local file picker) |
| `RootProgressStep.tsx` | Live progress stepper with cancel support |
| `RootResultStep.tsx` | Success/failure result with cold-boot and restore actions |

### 9.2 Store Changes (`emulatorManagerStore.ts`)

```typescript
interface RootWizardState {
  step: 'source' | 'progress' | 'result';
  source: { type: 'channel'; channel: string } | { type: 'local'; path: string } | null;
  progress: RootProgress | null;
  result: RootResult | null;
  error: string | null;
}
```

### 9.3 New Backend Wrappers (`backend.ts`)

```typescript
export async function FetchMagiskChannels(): Promise<MagiskChannel[]>;
export async function RootAvd(request: RootAvdRequest): Promise<RootResult>;
export async function VerifyRootStatus(serial: string): Promise<RootVerification>;
```

### 9.4 New Models (`models.ts`)

```typescript
export interface MagiskChannel {
  channel: string;
  version: string;
  versionCode: string;
  downloadUrl: string;
}

export interface RootAvdRequest {
  avdName: string;
  serial: string;
  source: { type: 'channel'; channel: string } | { type: 'local'; path: string };
}

export interface RootProgress {
  step: number;
  totalSteps: number;
  label: string;
  detail: string | null;
}

export interface RootResult {
  success: boolean;
  magiskVersion: string;
  patchedRamdiskPath: string;
  error: string | null;
}

export interface RootVerification {
  hasRoot: boolean;
  magiskVersion: string | null;
  daemonRunning: boolean;
  managerInstalled: boolean;
}
```

### 9.5 Event Listener

```typescript
// In RootProgressStep.tsx
useEffect(() => {
  const unlisten = listen<RootProgress>('root:progress', (event) => {
    setProgress(event.payload);
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Rust)

| Test | Module | What It Tests |
|:---|:---|:---|
| `extract_magisk_package_x86_64` | `magisk_package.rs` | Correct binary extraction for x86_64 ABI |
| `extract_magisk_package_fallback_abi` | `magisk_package.rs` | Falls back to x86 when x86_64 missing |
| `parse_util_functions_sh` | `magisk_package.rs` | Extracts MAGISK_VER and MAGISK_VER_CODE |
| `detect_abi_mapping` | `root.rs` | ABI -> lib directory mapping |
| `build_magisk_config` | `root.rs` | Config file content (KEEPVERITY, etc.) |
| `parse_channel_json` | `magisk_download.rs` | JSON -> MagiskChannel struct |

### 10.2 Integration Tests (Manual — Real Emulator)

| Test | Steps | Expected |
|:---|:---|:---|
| Root stock AVD (API 34, x86_64) | Select Magisk Stable -> Root -> Cold boot | Magisk Manager installed, `su` works |
| Root stock AVD (API 30, x86_64) | Same as above | Multi-CPIO handled correctly |
| Re-root already-rooted AVD | Root -> verify -> Root again | Clean re-root without corruption |
| Restore to stock | Root -> Restore -> Cold boot | `su` no longer available |
| Root with Kitsune Mask | Use Kitsune `.apk` | Fork detected, rooted successfully |
| Root with local .zip | Select downloaded `.zip` | ZIP normalized and processed |
| Offline root (no internet) | Download disabled, use local file | Works without network |
| Cancel mid-root | Start root -> Cancel at step 4 | Cleanup performed, original ramdisk intact |

### 10.3 Compatibility Matrix to Validate

| Android API | ABI | Play Store | Expected Result |
|:---|:---|:---|:---|
| 34 | x86_64 | Yes | ✅ |
| 33 | x86_64 | Yes | ✅ |
| 31 | x86_64 | Yes | ✅ |
| 30 | x86_64 | Yes | ✅ (multi-CPIO) |
| 30 | x86 | Yes | ✅ (32-bit only) |
| 29 | x86_64 | Yes | ✅ |
| 34 | arm64-v8a | Yes (M1 Mac) | ✅ (if on Mac) |

---

## Summary

### What Changes

| Current | Proposed |
|:---|:---|
| Manual 5-step FAKEBOOTIMG workflow | Automated 1-click magiskboot pipeline |
| User must navigate Magisk app UI | No user interaction inside emulator |
| Local file picker only | Online channel selection + local fallback |
| No progress feedback | Real-time 8-step progress stepper |
| No architecture awareness | Full ABI detection and binary selection |
| No patch status detection | Pre-flight checks for already-patched ramdisks |
| No post-root verification | Automated su/daemon/manager check after cold boot |
| Single flat tab UI | 3-step wizard with source → progress → result |
| FAKEBOOTIMG only | Automated pipeline + FAKEBOOTIMG fallback |

### Implementation Priority

1. **Phase 1** (Critical): `magisk_package.rs` + automated root pipeline via ADB — this alone eliminates the manual Magisk patching step
2. **Phase 2** (High): Online Magisk download + channel selection UI
3. **Phase 3** (High): Post-root verification + progress events
4. **Phase 4** (Medium): Wizard UI redesign with step indicators
5. **Phase 5** (Low): Fallback mode polish, error recovery, edge case hardening

### Risk Assessment

| Risk | Mitigation |
|:---|:---|
| `magiskboot` binary compatibility | Always extract from the user's chosen Magisk version (self-compatible) |
| ADB shell execution failures | Robust error propagation + FAKEBOOTIMG fallback |
| Ramdisk format changes in future APIs | `magiskboot` handles this; we don't parse directly |
| Fork package structures differ | Try standard extraction; fall through to FAKEBOOTIMG if `magiskinit` not found |
| System image read-only | Check writability before proceeding; suggest `emulator -writable-system` |
