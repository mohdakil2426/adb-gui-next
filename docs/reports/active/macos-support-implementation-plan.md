# Implementation Plan: Adding First-Class macOS Support to ADB GUI Next

This report outlines the end-to-end implementation plan for porting **ADB GUI Next** to macOS. It is designed to serve as a complete reference for compiling, signing, notarizing, and distributing the app for both Intel (x86_64) and Apple Silicon (arm64) architectures.

Because developer environment constraints mandate developing on a **Windows host**, all macOS compilation, binary bundling, and package distribution will be handled via a **GitHub Actions CI/CD pipeline** leveraging `macos-latest` M1 runners.

---

## 1. Context & Objectives

**ADB GUI Next** is a Tauri 2 desktop Android toolkit written in React 19 + TypeScript on the frontend and Rust on the backend. The core architecture is cross-platform, but several low-level desktop features currently restrict it to Windows and Linux. To run natively on macOS, we need to address:

1. **Path Resolution inside GUI Contexts**: GUI applications launched from the Finder or Dock on macOS do not inherit interactive shell environment variables (specifically `$PATH`). This causes Rust commands using `which` or standard path resolvers to fail to locate tools like `adb` or `fastboot`.
2. **Bundled Binaries (`resources/darwin/`)**: ADB, fastboot, and associated platform-tools must be compiled as fat (universal) binaries containing both `x86_64` (Intel) and `arm64` (Apple Silicon) slices and stored in a new platform folder.
3. **OS-Specific Commands**: Refactoring device manager and terminal launchers to use macOS equivalents (`open -a "System Information"` and `open -a Terminal`).
4. **App Entitlements**: WebKit WebViews on macOS require explicit code signing entitlements (specifically JIT and unsigned executable memory allocation) to prevent instant crashes after notarization.
5. **CI/CD Integration**: A release workflow that manages compiling universal binaries (`universal-apple-darwin`), signing with Apple Developer IDs, notarizing with Apple, and bundling into a high-quality `.dmg` installer.

---

## 2. Technical Architectural Breakdown

The architectural integration involves five layers, which are visualised below:

```text
┌────────────────────────────────────────────────────────┐
│                        Frontend                        │
│               React 19 + Tailwind CSS v4               │
│               (No changes - OS Agnostic)               │
└───────────────────────────┬────────────────────────────┘
                            │ (Tauri IPC Bridge)
┌───────────────────────────▼────────────────────────────┐
│                    Rust Backend Shell                  │
│                     src-tauri/src/                     │
│  • Cargo.toml: Added fix-path-env-rs dependency        │
│  • lib.rs: Initialized fix-path-env at start           │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│       Helpers & Commands     │ │     Tauri Bundle Config      │
│  • helpers.rs: "darwin" OS   │ │  • tauri.conf.json: Add     │
│    directory mappings        │ │    bundle.macOS settings     │
│  • system.rs: macOS terminal │ │  • Entitlements.plist: JIT   │
│    & system info launches    │ │    + unsigned memory permissions │
└───────────┬──────────────────┘ └───────────┬──────────────────┘
            │                                │
            └───────────────┬────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  GitHub Actions Workflow               │
│           • macos-latest runner (M1 Silicon)           │
│           • universal-apple-darwin target              │
│           • Creates fat binaries & signs with certs   │
│           • Outputs notarized universal .dmg package   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Implementation Changes

### 3.1 Dependencies & Bootstrapping

#### `src-tauri/Cargo.toml`
To resolve the environment path inheritance issue common in macOS GUI apps, we add `fix-path-env-rs` to our crate dependencies:

```toml
[dependencies]
# GUI PATH inheritance utility for macOS/Linux
fix-path-env-rs = "0.2"
```

#### `src-tauri/src/lib.rs`
The library entry point must execute this environment patch before Tauri initializes the webview engine:

```rust
// Modify run() to invoke fix_path_env at the absolute beginning
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Patches the environment path for GUI app context on macOS
    let _ = fix_path_env::fix();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets(build_log_targets())
                .build(),
        )
        // ... rest of the builder chain
```

---

### 3.2 Platform-Specific Helper Updates

#### `src-tauri/src/helpers.rs`
We must instruct our binary path resolvers to search in `resources/darwin/` when compiled for macOS:

```rust
pub fn resolve_binary_path(app: &AppHandle, name: &str) -> CmdResult<PathBuf> {
    debug!("Resolving binary path for: {}", name);
    let file_name = binary_name(name);
    
    // Map non-Windows Unix targets specifically to "darwin" if macos, otherwise "linux"
    let os_dir = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join(os_dir).join(&file_name),
            resource_dir.join("resources").join(os_dir).join(&file_name),
        ];
        // ... candidate matching loops ...
```

In addition, the working directory resolver `binary_working_directory()` must follow the identical architecture mapping:

```rust
pub fn binary_working_directory(app: Option<&AppHandle>) -> Option<PathBuf> {
    let os_dir = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    if let Some(app) = app
        && let Ok(resource_dir) = app.path().resource_dir()
    {
        for candidate in [resource_dir.join(os_dir), resource_dir.join("resources").join(os_dir)] {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    std::env::current_dir().ok().and_then(|repo_root| {
        let candidate = repo_resource_directory(&repo_root, os_dir);
        candidate.exists().then_some(candidate)
    })
}
```

---

### 3.3 System Commands Realignment

#### `src-tauri/src/commands/system.rs`
System launchers are OS-dependent. Device Manager and native interactive terminal wrappers must be created for macOS target configurations:

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
        // Launches Apple's native System Information profile utility
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
        // Spawns macOS Terminal application pointing directly to our binaries folder
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

---

### 3.4 Tauri Configuration and Plist Entitlements

#### `src-tauri/Entitlements.plist`
To enable standard WebKit JIT compiler functionality and allow execution of unsigned executable memory (critical for compiled code integrity and child processes after codesigning), a new `Entitlements.plist` file must be created inside `src-tauri/`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Essential JIT WebView permissions -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    
    <!-- Child execution environments -->
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

#### `src-tauri/tauri.conf.json`
We modify the `"bundle"` field to define minimum target versions, reference the newly created JIT entitlements file, establish ad-hoc signing identities (`"-"` is standard for development/unsigned CI, replaced via environment variables dynamically in the build step), and set custom installer properties:

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
        "windowSize": { "width": 660, "height": 400 },
        "appPosition": { "x": 180, "y": 170 },
        "applicationFolderPosition": { "x": 480, "y": 170 }
      }
    }
  }
}
```

---

## 4. Platform-Tools (ADB & Fastboot) Bundling

Google distributes platform-tools for macOS containing universal binaries compiled natively with fat header formats (fat slices for both Intel `x86_64` and Silicon `arm64`).

### 4.1 Folder Layout
Create a dedicated `darwin` resources directory:

```text
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

### 4.2 Local Download & Verification Steps (Simulated on Windows Host)
To prepare these resources inside the repository on Windows before committing:

1. **Download source**: Use the official URL:
   `https://dl.google.com/android/repository/platform-tools-latest-darwin.zip`
2. **Extract on Windows**: Unzip into `src-tauri/resources/darwin/`.
3. **Permissions flag preservation**: Since the files are committed from a Windows filesystem (which does not represent standard Unix execute bits `chmod +x` natively), the release pipeline runner will enforce correct file permissions automatically inside the GitHub workflow.

### 4.3 Universal Slice Verification
Once running on the macOS runner, we verify the binary headers explicitly to confirm native multi-architecture support:

```bash
# Executing this on the runner checks that the compiled binary has both slices
lipo -info src-tauri/resources/darwin/adb
# Output MUST state: 
# Architectures in the fat file: adb are: x86_64 arm64
```

---

## 5. GitHub Actions Release CI/CD Pipeline

To compile universal fat binaries and package `.dmg` binaries from Windows commits, we construct `.github/workflows/release.yml`. This pipeline supports **ad-hoc unsigned/local builds** by default, but is pre-engineered for complete **Apple notarization and signing** when provided with Developer Program credentials.

```yaml
name: Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-macos:
    runs-on: macos-latest # Utilizes Apple Silicon M1 hardware natively
    permissions:
      contents: write

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Bun Environment
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install Rust Toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin, x86_64-apple-darwin

      - name: Configure Rust Cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Restore Web Dependencies
        run: bun install

      # Decodes and imports the Apple certificate if available.
      # If no signing variables are present in GitHub Secrets,
      # Tauri will fall back to standard Ad-Hoc (-) signing.
      - name: Setup Apple Certificate
        if: ${{ secrets.APPLE_CERTIFICATE != '' }}
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security set-keychain-settings -t 3600 -u build.keychain
          security import certificate.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain
          
          # Extract and export identity dynamically to Github Env
          CERT_INFO=$(security find-identity -v -p codesigning build.keychain | grep "Apple Development" | head -n 1)
          CERT_ID=$(echo "$CERT_INFO" | awk -F'"' '{print $2}')
          echo "APPLE_SIGNING_IDENTITY=$CERT_ID" >> $GITHUB_ENV

      - name: Setup Bundled Permissions
        run: |
          chmod +x src-tauri/resources/darwin/adb
          chmod +x src-tauri/resources/darwin/fastboot
          chmod +x src-tauri/resources/darwin/etc1tool
          chmod +x src-tauri/resources/darwin/hprof-conv
          chmod +x src-tauri/resources/darwin/make_f2fs
          chmod +x src-tauri/resources/darwin/make_f2fs_casefold
          chmod +x src-tauri/resources/darwin/mke2fs
          chmod +x src-tauri/resources/darwin/sqlite3

      - name: Build macOS Universal DMG
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # dynamic codesigning credentials
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ env.APPLE_SIGNING_IDENTITY || '-' }}
        with:
          tagName: v__VERSION__
          releaseName: 'AdbGuiNext v__VERSION__'
          releaseBody: 'Official release build featuring comprehensive platform support.'
          releaseDraft: true
          prerelease: false
          # Directs Tauri to build fat slices for both architectures and assemble DMG
          args: '--target universal-apple-darwin --bundles dmg'
```

---

## 6. Verification & Quality Assurance Plan

### 6.1 Automated Verification (GitHub Actions Run)
To verify correct target architecture structures on the compiler container before completing the release artifacts:

```bash
# 1. Verify Fat Binary slices of the main executable
lipo -info target/universal-apple-darwin/release/bundle/macos/AdbGuiNext.app/Contents/MacOS/AdbGuiNext
# Expected result: Architectures in the fat file: AdbGuiNext are: x86_64 arm64

# 2. Check applied signature properties
codesign -dv --verbose=4 target/universal-apple-darwin/release/bundle/macos/AdbGuiNext.app
```

### 6.2 Manual Verification (On physical macOS Client)
For verifying application behaviors on a local test Mac:

| Target Case | Step Description | Expected Pass Result |
|---|---|---|
| **App Startup** | Double-click the compiled `.app` inside the mounted `.dmg`. | The application opens, the frontend renders fully, and no WebKit thread crashes occur (proves JIT plist config is valid). |
| **Path Fix** | Launch from Applications folder directly (GUI mode). | Environment variables are successfully read; internal utilities locate `adb` and `fastboot` successfully. |
| **USB Link** | Connect an Android target device via USB and unlock it. | ADB discovers the node, serial number mounts, and active status updates in the dashboard. |
| **Terminal Launch** | Click the "Open Terminal" button. | macOS Terminal launches with active directory focused inside `resources/darwin/`. |
| **System Profile** | Click the "Device Manager" option. | The native System Information profile application opens. |
| **Payload Extraction**| Run payload dumper on a standard firmware zip. | The streaming extraction works, using macOS native unix disk buffers without memory leaks. |
| **Rosetta Fallback** | Execute the app enforcing Intel emulation: `arch -x86_64 open AdbGuiNext.app`. | Emulation runs flawlessly under Rosetta 2 (proves x86_64 slice compliance). |

---

## 7. Strategic Risks & Mitigations

### 7.1 Gatekeeper Restrictions
* **Risk**: Unnotarized builds will be blocked by default with the "app is damaged and cannot be opened" or "unidentified developer" prompt.
* **Mitigation**: Standardize distribution as a `.dmg`. For ad-hoc unsigned distributions, provide simple installation documentation detailing `Right-Click -> Open` or `xattr -cr /Applications/AdbGuiNext.app` terminal command bypasses.

### 7.2 WebKit JIT Crash Patterns
* **Risk**: High-security OS profiles (macOS Sonoma and Sequoia) enforce absolute sandbox safety. If entitlements are missing or corrupted, the WebView engine terminates the executable instantly with code signature errors.
* **Mitigation**: The `Entitlements.plist` explicitly requests `allow-jit` and `allow-unsigned-executable-memory`. Additionally, dynamic library validation is bypassed using `disable-library-validation` so that child executables (like ADB) do not require identical code-signing certificate footprints.

### 7.3 Binary Execution Permission Resets
* **Risk**: Committing binaries from Windows ignores the POSIX executable file modes, causing ADB commands to crash with "permission denied" on run.
* **Mitigation**: The GitHub Actions runner includes automated shell command scripts (`chmod +x`) directly inside the packaging step, guaranteeing that the target `.dmg` has correct Unix permissions.

---

## 8. Summary of File Modification Surface

| Target File | Scope of Change | Role in macOS Integration |
|---|---|---|
| [`src-tauri/Cargo.toml`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/Cargo.toml) | Added dependency | Imports `fix-path-env-rs` for environment variable loading. |
| [`src-tauri/src/lib.rs`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/lib.rs) | Injected initialization call | Triggers environmental path patch on app startup. |
| [`src-tauri/src/helpers.rs`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/helpers.rs) | Added OS directory branches | Directs resolvers to look in the `"darwin"` resources directory. |
| [`src-tauri/src/commands/system.rs`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/commands/system.rs) | Added cfg targets | Implements macOS native terminal and device profiling launchers. |
| [`src-tauri/tauri.conf.json`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/tauri.conf.json) | Appended macOS schema object | Integrates minimum versions, bundle properties, and Plist references. |
| [`src-tauri/Entitlements.plist`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/Entitlements.plist) | **NEW FILE** | Defines code signing sandbox & WebKit JIT entitlements. |
| [`.github/workflows/release.yml`](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.github/workflows/release.yml) | **NEW FILE** | Release pipeline building universal `.dmg` binaries. |

---

### Conclusion
This plan provides a fully engineered, robust, and low-friction path to achieve production-grade macOS support for **ADB GUI Next** entirely from a Windows development machine. The changes are surgical, preserve all existing Windows/Linux workflows, and implement the highest standard of macOS application delivery guidelines.
