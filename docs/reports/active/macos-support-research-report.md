# macOS Support for ADB GUI Next — Comprehensive Research Report

> Generated: May 18, 2026
> Scope: End-to-end analysis of what's required to add macOS support to this Tauri 2 desktop application.
> **Build strategy:** All code changes done on Windows → GitHub Actions `macos-latest` runner produces the `.dmg`.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Build Strategy: Windows Dev → GitHub Actions](#3-build-strategy-windows-dev--github-actions)
4. [Code Changes Required](#4-code-changes-required)
5. [Bundled Resources (ADB/Fastboot)](#5-bundled-resources-adbfastboot)
6. [Bundle Configuration](#6-bundle-configuration)
7. [Code Signing & Notarization](#7-code-signing--notarization)
8. [GitHub Actions CI/CD Pipeline](#8-github-actions-cicd-pipeline)
9. [Testing Strategy](#9-testing-strategy)
10. [Risk Assessment](#10-risk-assessment)
11. [Implementation Checklist](#11-implementation-checklist)
12. [Appendix: Reference URLs](#12-appendix-reference-urls)

---

## 1. Executive Summary

ADB GUI Next is **already ~85% macOS-compatible** out of the box. The Tauri 2 framework, React frontend, and most Rust backend code are cross-platform. The remaining ~15% falls into these categories:

| Category | Effort | Details |
|---|---|---|
| **Bundled platform tools** | Medium | Download macOS ADB/fastboot binaries, place in `src-tauri/resources/darwin/` |
| **Rust `cfg` additions** | Low | Add `#[cfg(target_os = "macos")]` branches in 4 files |
| **`fix-path-env-rs` crate** | Low | Add to `Cargo.toml` + initialize in `lib.rs` |
| **Tauri bundle config** | Low | Add `bundle.macOS` section to `tauri.conf.json` |
| **Entitlements plist** | Low | Create `src-tauri/Entitlements.plist` |
| **Code signing setup** | Medium | Configure signing identity + notarization credentials (optional for first release) |
| **GitHub Actions workflow** | Medium | Add macOS build job — this is how we build on Windows |

**No frontend changes are needed.** The React 19 + Vite + Tailwind stack is fully platform-agnostic.

### Why GitHub Actions?

**You cannot build macOS binaries on Windows.** Apple's toolchain (linker `ld64`, macOS SDK, code signing) only exists on macOS. There is no cross-compilation path from Windows to macOS.

The standard workflow for Tauri devs without a Mac:

```
Windows machine                    GitHub Actions (macos-latest runner)
┌──────────────────────┐           ┌──────────────────────────────────┐
│ 1. Make code changes │──push──▶ │ 2. Checkout repo                   │
│ 2. Download darwin   │           │ 3. Install Rust macOS targets      │
│    platform tools    │           │ 4. bun install                     │
│ 3. Commit + push     │           │ 5. tauri build --target universal  │
│ 4. Trigger workflow  │◀──artifact│ 6. Upload .dmg to GitHub Release   │
└──────────────────────┘           └──────────────────────────────────┘
```

- **Cost:** Free (GitHub gives 2,000 minutes/month for public repos, 500 for private)
- **Runner:** `macos-latest` = Apple Silicon M1 (native builds)
- **Trigger:** Manual (`workflow_dispatch`) or on git tag push
- **Output:** `.dmg` file on the GitHub Release page — download and test on a real Mac

---

## 2. Current State Analysis

### 2.1 What Already Works on macOS

| Component | Status | Notes |
|---|---|---|
| Tauri 2 framework | Ready | `tauri = "2.11.1"` — full macOS support |
| `tauri.conf.json` targets | Ready | `"targets": "all"` includes macOS `app` + `dmg` |
| macOS icon | Ready | `icons/icon.icns` already present |
| Frontend (React/Vite) | Ready | Zero platform-specific code |
| Most Rust dependencies | Ready | All crates are cross-platform |
| `helpers.rs` executable bit | Ready | `ensure_executable_if_needed()` handles `#[cfg(target_family = "unix")]` |
| `helpers.rs` binary naming | Ready | `binary_name()` uses `cfg!(target_os = "windows")` fallback |
| `sdk.rs` emulator binary | Ready | Uses `#[cfg(not(target_os = "windows"))]` for non-Windows |
| Payload mmap flush | Ready | Has `#[cfg(windows)]` and `#[cfg(unix)]` branches |
| AVD home resolution | Ready | Falls back to `$HOME/.android/avd` on Unix |

### 2.2 What's Missing

| Component | Gap | File(s) |
|---|---|---|
| Bundled ADB/fastboot for macOS | `resources/darwin/` directory doesn't exist | `src-tauri/resources/` |
| PATH resolution for GUI apps | macOS GUI apps don't inherit shell `$PATH` | `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` |
| `launch_device_manager()` | Windows-only (`devmgmt.msc`) | `src-tauri/src/commands/system.rs:16-26` |
| `launch_terminal()` | No macOS branch (only Windows + Linux) | `src-tauri/src/commands/system.rs:29-48` |
| `CREATE_NO_WINDOW` flag | Windows-only, macOS needs no equivalent | `src-tauri/src/helpers.rs`, `src-tauri/src/emulator/runtime.rs` |
| `resolve_binary_path()` OS dir | Maps to `"linux"` for non-Windows | `src-tauri/src/helpers.rs:158` |
| `binary_working_directory()` OS dir | Maps to `"linux"` for non-Windows | `src-tauri/src/helpers.rs:194` |
| Tauri bundle macOS config | No `bundle.macOS` section | `src-tauri/tauri.conf.json` |
| Entitlements plist | Not created | `src-tauri/Entitlements.plist` (new) |
| GitHub Actions workflow | Not created | `.github/workflows/release.yml` (new) — handles all macOS build steps |

---

## 3. Build Strategy: Windows Dev → GitHub Actions

### 3.1 Why You Can't Build macOS on Windows

Apple's toolchain is macOS-only. The macOS build requires:
- **`ld64` linker** — only ships with Xcode on macOS
- **macOS SDK headers** — only available on macOS
- **Code signing infrastructure** — macOS Keychain + `codesign` binary

Rust cannot cross-compile from Windows to macOS. There is no `osxcross` equivalent that works reliably for Tauri apps.

### 3.2 The Workflow

```
Step 1: Windows (your machine)
─────────────────────────────────
• Make all code changes (Rust cfg, Cargo.toml, tauri.conf.json, etc.)
• Download platform-tools-darwin.zip, extract to src-tauri/resources/darwin/
• Create Entitlements.plist
• Create .github/workflows/release.yml
• Commit and push to GitHub

Step 2: GitHub Actions (cloud macOS runner)
─────────────────────────────────────────────
• macos-latest runner (Apple Silicon M1) checks out your repo
• Installs Rust targets: aarch64-apple-darwin + x86_64-apple-darwin
• Runs bun install
• Runs tauri build --target universal-apple-darwin
• Uploads .dmg to GitHub Release

Step 3: Windows (your machine)
─────────────────────────────────
• Download the .dmg from GitHub Release
• Test on a real Mac (borrow, friend, cloud Mac, etc.)
```

### 3.3 Triggering the Build

**Manual trigger (recommended for development):**
1. Push your code to GitHub
2. Go to your repo → **Actions** → **Release** workflow
3. Click **"Run workflow"** → select branch → click **"Run workflow"**
4. Wait ~10-15 minutes for the build
5. Download the `.dmg` from the release artifacts

**Automatic trigger (for releases):**
- Push a git tag matching `v*` (e.g., `git tag v0.3.0 && git push origin v0.3.0`)
- The workflow runs automatically

### 3.4 GitHub Actions Runner Details

| Property | Value |
|---|---|
| Runner image | `macos-latest` (Apple Silicon M1) |
| Xcode | Pre-installed (latest stable) |
| Rust | Installed by workflow step |
| Free minutes | 2,000/month (public repo) / 500/month (private repo) |
| Estimated build time | 10-15 minutes |

### 3.5 Architecture Support

| Architecture | Target Triple | How Built |
|---|---|---|
| Apple Silicon (M1/M2/M3/M4) | `aarch64-apple-darwin` | Native on M1 runner |
| Intel (x86-64) | `x86_64-apple-darwin` | Cross-compiled from M1 (Rosetta 2 linker) |
| Universal (fat binary) | `universal-apple-darwin` | Tauri builds both + merges with `lipo` |

We use **`universal-apple-darwin`** — one `.dmg` that runs natively on both Intel and Apple Silicon Macs.

---

## 4. Code Changes Required

### 4.1 `src-tauri/Cargo.toml` — Add `fix-path-env-rs`

**Why:** macOS GUI apps launched from Finder/Dock do **not** inherit `$PATH` from shell profiles (`.zshrc`, `.bash_profile`). This means `which::which("adb")` will fail if ADB isn't in the system-wide PATH. The `fix-path-env-rs` crate patches the process environment at startup.

```toml
[dependencies]
# Add this line:
fix-path-env-rs = "0.2"
```

### 4.2 `src-tauri/src/lib.rs` — Initialize PATH fix

```rust
// Add at the top of run(), before tauri::Builder::default():
fn build_app() {
    let _ = fix_path_env::fix();  // <-- Add this line
    tauri::Builder::default()
        // ... rest of builder chain
}
```

**Exact placement:** Inside the `run()` function, before `tauri::Builder::default()`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = fix_path_env::fix();  // <-- ADD THIS
    tauri::Builder::default()
        .plugin(...)
        // ...
}
```

### 4.3 `src-tauri/src/helpers.rs` — Add `"darwin"` OS directory

**Current code (line 158):**
```rust
let os_dir = if cfg!(target_os = "windows") { "windows" } else { "linux" };
```

**Change to:**
```rust
let os_dir = if cfg!(target_os = "windows") {
    "windows"
} else if cfg!(target_os = "macos") {
    "darwin"
} else {
    "linux"
};
```

This affects two functions:
- `resolve_binary_path()` (line 158)
- `binary_working_directory()` (line 194)

Both need the same change.

### 4.4 `src-tauri/src/commands/system.rs` — Add macOS branches

#### `launch_device_manager()` (lines 16-26)

**Current:** Only has `#[cfg(target_os = "windows")]` block, does nothing on other platforms.

**Change to:**
```rust
#[tauri::command]
pub fn launch_device_manager() -> CmdResult<()> {
    info!("Launching device manager");
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/C", "start", "devmgmt.msc"])
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .args(["-a", "System Information"])
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open")
            .arg("about:")
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
```

#### `launch_terminal()` (lines 29-48)

**Current:** Has Windows and Linux branches, no macOS.

**Change to:**
```rust
#[tauri::command]
pub fn launch_terminal() -> CmdResult<()> {
    let directory = binary_working_directory(None)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    info!("Launching terminal at {:?}", directory);

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", "cd", "/d"])
            .arg(directory)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(&directory)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open")
            .arg(&directory)
            .spawn()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}
```

### 4.5 `src-tauri/src/emulator/runtime.rs` — No changes needed

The `CREATE_NO_WINDOW` flag is already gated behind `#[cfg(target_os = "windows")]` (lines 12-16, 149). macOS doesn't need an equivalent — the emulator spawns as a separate process window naturally.

### 4.6 `src-tauri/src/emulator/sdk.rs` — No changes needed

The emulator binary resolution already uses:
```rust
#[cfg(target_os = "windows")]
let binary_name = "emulator.exe";
#[cfg(not(target_os = "windows"))]
let binary_name = "emulator";
```

This correctly handles macOS.

### 4.7 `src-tauri/src/payload/write.rs` — No changes needed

Already has proper `#[cfg(windows)]` and `#[cfg(unix)]` branches for mmap flushing. macOS falls under `#[cfg(unix)]`.

---

## 5. Bundled Resources (ADB/Fastboot)

### 5.1 Current State

```
src-tauri/resources/
├── linux/          # ADB, fastboot, etc. for Linux
└── windows/        # ADB, fastboot, AdbWinApi.dll, etc. for Windows
```

### 5.2 What to Add

Create `src-tauri/resources/darwin/` with the following files from Google's platform-tools:

```
src-tauri/resources/darwin/
├── adb
├── fastboot
├── etc1tool
├── hprof-conv
├── make_f2fs
├── make_f2fs_casefold
├── mke2fs
├── mke2fs.conf
├── sqlite3
├── NOTICE.txt
└── source.properties
```

### 5.3 Download Source

```
https://dl.google.com/android/repository/platform-tools-latest-darwin.zip
```

This ZIP contains **universal binaries** (fat binaries with both `arm64` and `x86_64` slices), so a single set of binaries works on both Apple Silicon and Intel Macs.

### 5.4 Setup Steps

```bash
# Download
curl -O https://dl.google.com/android/repository/platform-tools-latest-darwin.zip

# Extract
unzip platform-tools-latest-darwin.zip

# Copy to project
mkdir -p src-tauri/resources/darwin
cp platform-tools/* src-tauri/resources/darwin/

# Ensure executables have the right permissions
chmod +x src-tauri/resources/darwin/adb
chmod +x src-tauri/resources/darwin/fastboot
chmod +x src-tauri/resources/darwin/etc1tool
chmod +x src-tauri/resources/darwin/hprof-conv
chmod +x src-tauri/resources/darwin/make_f2fs
chmod +x src-tauri/resources/darwin/make_f2fs_casefold
chmod +x src-tauri/resources/darwin/mke2fs
chmod +x src-tauri/resources/darwin/sqlite3

# Clean up
rm -rf platform-tools platform-tools-latest-darwin.zip
```

### 5.5 Important Notes

- **No DLLs needed** — macOS has no equivalent of `AdbWinApi.dll` / `AdbWinUsbApi.dll`
- **No `.exe` extensions** — native Mach-O binaries
- **USB access** — macOS uses IOKit natively, no kernel extensions or USB drivers needed
- **Gatekeeper** — Tauri's code signing covers bundled binaries, so no quarantine issues
- **Emulator NOT bundled** — per AGENTS.md, the emulator is resolved through SDK path, not bundled

### 5.6 ADB on macOS Ventura+ Gotcha

On macOS 13+ (Ventura), some users report `ADB server didn't ACK` errors. The fix is:
```bash
export ADB_LIBUSB=1
```

This is an environment variable that users may need to set. It does **not** require code changes — the bundled ADB binary from Google's latest platform-tools (r37.0.0) handles this correctly by default.

---

## 6. Bundle Configuration

### 6.1 `src-tauri/tauri.conf.json` — Add `bundle.macOS` section

Add this inside the existing `"bundle"` object:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "11.0",
      "entitlements": "./Entitlements.plist",
      "signingIdentity": "-",
      "dmg": {
        "windowSize": { "width": 660, "height": 400 }
      }
    }
  }
}
```

| Field | Value | Purpose |
|---|---|---|
| `minimumSystemVersion` | `"11.0"` | macOS Big Sur minimum (Apple Silicon native requirement) |
| `entitlements` | `"./Entitlements.plist"` | Required for WebView JIT to work after notarization |
| `signingIdentity` | `"-"` | Ad-hoc signing for development; replace with real identity for distribution |
| `dmg.windowSize` | `{660, 400}` | DMG installer window dimensions |

### 6.2 `src-tauri/Entitlements.plist` — Create new file

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

**Critical:** Without `allow-jit` and `allow-unsigned-executable-memory`, the app will **crash on launch after notarization** because the WebKit JavaScript engine requires JIT compilation.

The `disable-library-validation` entitlement is needed because the app spawns child processes (ADB, fastboot, emulator) that are bundled but not individually signed with the same identity.

### 6.3 `src-tauri/Info.plist` — Optional

Only needed if the app requires macOS privacy permissions (camera, microphone, full disk access). For ADB GUI Next's current feature set, this is **not required**. If future features need it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSCameraUsageDescription</key>
    <string>Camera access for Android device workflows</string>
    <key>NSDocumentsFolderUsageDescription</key>
    <string>Access to save and load firmware files</string>
</dict>
</plist>
```

Then reference it in `tauri.conf.json`:
```json
"macOS": {
  "infoPlist": "./Info.plist"
}
```

---

## 7. Code Signing & Notarization

### 7.1 Development (Ad-Hoc Signing)

For local testing on Apple Silicon, ad-hoc signing is sufficient:

```json
"macOS": {
  "signingIdentity": "-"
}
```

This produces a signed `.app` that runs on the local machine. Users will still need to right-click → Open or whitelist in System Settings → Privacy & Security.

### 7.2 Distribution (Developer ID Signing)

For distribution outside the Mac App Store:

1. **Enroll in Apple Developer Program** ($99/year)
2. **Create a Developer ID Application certificate** in Keychain Access
3. **Configure signing** via environment variables or `tauri.conf.json`:

```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (TEAMID)"
}
```

### 7.3 Notarization

Required for Gatekeeper to trust the app on first launch.

**Option A: Apple ID + App-Specific Password** (simpler)
| Env Var | Value |
|---|---|
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | Apple account email |
| `APPLE_PASSWORD` | App-specific password (generate at appleid.apple.com) |
| `APPLE_TEAM_ID` | 10-character Team ID from developer.apple.com |

**Option B: App Store Connect API Key** (recommended for CI)
| Env Var | Value |
|---|---|
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect |
| `APPLE_API_KEY` | Key ID |
| `APPLE_API_KEY_PATH` | Path to `.p8` private key file |

Tauri's bundler handles notarization automatically when these env vars are set during `tauri build`.

### 7.4 Mac App Store Distribution

For App Store submission:
- Use `--bundles app` (not `dmg`)
- Set `minimumSystemVersion` to `"12.0"` or higher
- Add `com.apple.security.app-sandbox` entitlement
- Requires additional sandbox entitlements for file access, network, etc.
- This is **out of scope** for the initial macOS support — focus on direct distribution first.

---

## 8. GitHub Actions CI/CD Pipeline

This is the **primary and only** build method for macOS from a Windows machine.

### 8.1 Workflow File

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:  # Manual trigger from GitHub Actions UI

jobs:
  build-macos:
    runs-on: macos-latest  # Apple Silicon M1 runner
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: bun install

      - name: Build macOS universal binary
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: 'AdbGuiNext v__VERSION__'
          releaseBody: 'See the assets to download this version.'
          releaseDraft: true
          prerelease: false
          args: '--target universal-apple-darwin'
```

### 8.2 How to Trigger

**Manual (development/testing):**
1. Push code to GitHub
2. Go to repo → **Actions** → **Release** → **Run workflow**
3. Select branch → click **Run workflow**
4. Wait ~10-15 minutes
5. Download `.dmg` from the release artifacts

**Automatic (releases):**
```bash
git tag v0.3.0 && git push origin v0.3.0
```

### 8.3 Build Output

The workflow produces these artifacts on the GitHub Release page:

```
GitHub Release: v0.3.0
├── AdbGuiNext_0.3.0_universal.dmg    ← macOS installer (Intel + Apple Silicon)
└── AdbGuiNext_0.3.0_x64.msi          ← Windows installer (from your existing workflow)
```

The `.dmg` contains `AdbGuiNext.app` — drag to `/Applications` to install.

### 8.4 Build Verification (on the runner)

These commands run on macOS to verify the build. You can add them as a step in the workflow for debugging:

```bash
# Check binary architecture (should show both x86_64 and arm64)
lipo -info target/universal-apple-darwin/release/bundle/macos/AdbGuiNext.app/Contents/MacOS/AdbGuiNext

# Check code signature (ad-hoc by default)
codesign -dv --verbose=4 target/universal-apple-darwin/release/bundle/macos/AdbGuiNext.app
```

### 8.5 Adding Code Signing + Notarization (Optional)

For Gatekeeper-trusted builds (no "unidentified developer" warning), add these GitHub secrets and uncomment the env vars in the workflow:

| Secret | Description | How to Create |
|---|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate | Export from Keychain Access → `openssl base64 -A -in cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password set during `.p12` export | Your choice during export |
| `APPLE_SIGNING_IDENTITY` | e.g., `Developer ID Application: Name (TEAMID)` | From Keychain Access certificate name |
| `APPLE_TEAM_ID` | 10-character Team ID | From developer.apple.com/account |
| `APPLE_ID` | Apple account email | Your Apple ID |
| `APPLE_PASSWORD` | App-specific password | Generate at appleid.apple.com → App-Specific Passwords |

**Requires:** Apple Developer Program enrollment ($99/year).

**Not needed for first release** — ad-hoc signed builds work, users just need to right-click → Open once.

---

## 9. Testing Strategy

### 9.1 What to Test on macOS

| Area | Test | Expected |
|---|---|---|
| App launch | Open `.app` from Finder | No crash, WebView renders |
| ADB detection | Connect Android device via USB | Device appears in dashboard |
| ADB commands | Run `adb devices` via Utilities | Output matches terminal |
| Fastboot | Boot device to fastboot mode | Device detected |
| File Explorer | Browse `/sdcard` | Files listed correctly |
| App Manager | List installed packages | Packages shown |
| Payload Dumper | Extract from `payload.bin` | Partitions extracted |
| Emulator | List AVDs, launch emulator | AVD starts (if SDK installed) |
| Wireless ADB | Pair + connect | Connection established |
| Terminal launch | Click "Open Terminal" | Terminal opens at correct directory |
| File dialog | Select payload file | Native macOS file picker |
| Dark mode | Toggle theme | Theme switches correctly |
| Resize | Resize window | Layout adapts, no overflow |

### 9.2 Known macOS Quirks to Watch For

| Issue | Cause | Mitigation |
|---|---|---|
| ADB not found | `$PATH` not inherited by GUI app | `fix-path-env-rs` resolves this |
| ADB server doesn't ACK | macOS Ventura+ USB stack change | `ADB_LIBUSB=1` env var (user-side) |
| Gatekeeper blocks app | Not notarized | Sign + notarize, or user right-clicks → Open |
| Emulator not found | No Android SDK installed | User must install Android Studio or SDK command-line tools |
| AVD not found | `ANDROID_AVD_HOME` not set | Defaults to `$HOME/.android/avd` — should work |
| File picker shows wrong location | No default path | Existing dialog code handles this |

### 9.3 Manual Testing on Apple Silicon (Intel binary)

```bash
# Run the Intel slice under Rosetta 2
arch -x86_64 open AdbGuiNext.app
```

---

## 10. Risk Assessment

### 10.1 Low Risk (Straightforward)

| Item | Risk | Notes |
|---|---|---|
| `fix-path-env-rs` addition | Low | Well-maintained Tauri ecosystem crate, single function call |
| `darwin` OS directory in helpers | Low | Simple string addition, existing pattern |
| macOS `launch_terminal()` | Low | Standard `open -a Terminal` pattern |
| `Entitlements.plist` | Low | Standard Tauri template, well-documented |
| Bundle config additions | Low | JSON addition, Tauri validates schema |
| Download platform-tools-darwin | Low | Official Google binaries, universal architecture |

### 10.2 Medium Risk (Requires Verification)

| Item | Risk | Notes |
|---|---|---|
| Code signing + notarization | Medium | Requires Apple Developer account ($99/yr), certificate management |
| CI/CD workflow | Medium | Needs proper secrets configuration, runner availability |
| Emulator on Apple Silicon | Medium | ARM64 AVD images required; x86 images won't run natively |
| ADB USB permissions | Low-Medium | macOS doesn't need drivers, but Ventura+ may need `ADB_LIBUSB=1` |

### 10.3 Platform-Specific Feature Gaps

| Feature | macOS Status | Notes |
|---|---|---|
| Device Manager launch | Different | macOS uses "System Information" instead of `devmgmt.msc` |
| Bundled emulator | Not bundled | Same as Windows/Linux — requires user SDK install |
| Payload extraction | Works | Cross-platform Rust code |
| Marketplace | Works | HTTP-based, platform-agnostic |
| Debloater | Works | ADB shell commands, platform-agnostic |
| Flasher | Works | Fastboot commands, platform-agnostic |

---

## 11. Implementation Checklist

### Phase 1: Core macOS Support (All Done on Windows)

- [ ] **1.1** Download `platform-tools-latest-darwin.zip` from Google
- [ ] **1.2** Extract binaries to `src-tauri/resources/darwin/`
- [ ] **1.3** Set executable permissions on all binaries
- [ ] **1.4** Add `fix-path-env-rs = "0.2"` to `src-tauri/Cargo.toml`
- [ ] **1.5** Add `let _ = fix_path_env::fix();` to `src-tauri/src/lib.rs`
- [ ] **1.6** Update `resolve_binary_path()` in `src-tauri/src/helpers.rs` to return `"darwin"` for macOS
- [ ] **1.7** Update `binary_working_directory()` in `src-tauri/src/helpers.rs` to return `"darwin"` for macOS
- [ ] **1.8** Add `#[cfg(target_os = "macos")]` branch to `launch_device_manager()` in `src-tauri/src/commands/system.rs`
- [ ] **1.9** Add `#[cfg(target_os = "macos")]` branch to `launch_terminal()` in `src-tauri/src/commands/system.rs`
- [ ] **1.10** Create `src-tauri/Entitlements.plist` with JIT + unsigned memory entitlements
- [ ] **1.11** Add `bundle.macOS` section to `src-tauri/tauri.conf.json`
- [ ] **1.12** Commit and push all changes to GitHub
- [ ] **1.13** Trigger GitHub Actions workflow manually (Actions → Release → Run workflow)
- [ ] **1.14** Download `.dmg` from GitHub Release
- [ ] **1.15** Test all features listed in Section 9.1 on a real Mac

### Phase 2: Signing & Distribution (Optional — Requires Apple Developer Account)

- [ ] **2.1** Enroll in Apple Developer Program ($99/yr)
- [ ] **2.2** Create Developer ID Application certificate
- [ ] **2.3** Update `signingIdentity` in `tauri.conf.json`
- [ ] **2.4** Configure notarization env vars
- [ ] **2.5** Build with signing: `APPLE_SIGNING_IDENTITY="..." APPLE_ID="..." APPLE_PASSWORD="..." bun run tauri build --target universal-apple-darwin`
- [ ] **2.6** Verify notarization: `spctl --assess --type execute --verbose AdbGuiNext.app`

### Phase 3: Documentation

- [ ] **3.1** Update `AGENTS.md` to note macOS as a supported target
- [ ] **3.2** Update README with macOS installation instructions
- [ ] **3.3** Document macOS-specific prerequisites (Xcode CLT, SDK for emulator)

---

## 12. Appendix: Reference URLs

### Tauri 2 Documentation

| Resource | URL |
|---|---|
| Prerequisites | https://v2.tauri.app/start/prerequisites/ |
| macOS Application Bundle | https://v2.tauri.app/distribute/macos-application-bundle/ |
| DMG Bundle | https://v2.tauri.app/distribute/dmg/ |
| macOS Code Signing | https://v2.tauri.app/distribute/sign/macos/ |
| Configuration Reference | https://v2.tauri.app/reference/config/ |
| CLI Reference | https://v2.tauri.app/reference/cli |
| App Store Distribution | https://v2.tauri.app/distribute/app-store/ |

### Apple Documentation

| Resource | URL |
|---|---|
| Entitlements | https://developer.apple.com/documentation/bundleresources/entitlements |
| Info.plist Keys | https://developer.apple.com/documentation/bundleresources/information_property_list |
| Code Signing Guide | https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/ |
| Notarization | https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution |

### Google / Android

| Resource | URL |
|---|---|
| Platform Tools (macOS) | https://dl.google.com/android/repository/platform-tools-latest-darwin.zip |
| Platform Tools Release Notes | https://developer.android.com/tools/releases/platform-tools |
| Command Line Tools (macOS) | https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip |

### Crates

| Crate | URL |
|---|---|
| fix-path-env-rs | https://github.com/tauri-apps/fix-path-env-rs |
| tauri-action | https://github.com/tauri-apps/tauri-action |

### Community Resources

| Resource | URL |
|---|---|
| Shipping Tauri v2 to macOS (blog) | https://dev.to/0xmassi/shipping-a-production-macos-app-with-tauri-20-code-signing-notarization-and-homebrew-mc3 |
| Code Signing Guide (blog) | https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n |

---

## Summary of File Changes

| File | Change Type | Lines Affected | Done On |
|---|---|---|---|
| `src-tauri/Cargo.toml` | Add dependency | +1 line | Windows |
| `src-tauri/src/lib.rs` | Add function call | +1 line | Windows |
| `src-tauri/src/helpers.rs` | Modify 2 functions | ~6 lines changed | Windows |
| `src-tauri/src/commands/system.rs` | Add 2 cfg branches | ~15 lines added | Windows |
| `src-tauri/tauri.conf.json` | Add macOS config | ~8 lines added | Windows |
| `src-tauri/Entitlements.plist` | New file | ~15 lines | Windows |
| `src-tauri/resources/darwin/*` | New directory | 11 binary files | Windows |
| `.github/workflows/release.yml` | New file (required) | ~50 lines | Windows |
| `AGENTS.md` | Update (optional) | ~2 lines | Windows |

**Total: ~100 lines of code + 11 binary files — all done on Windows.**
The actual macOS build happens on GitHub Actions `macos-latest` runner (Apple Silicon M1), producing a `.dmg` you download from the GitHub Release page.
