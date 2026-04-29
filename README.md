<div align="center">

# ADB GUI Next

**A modern desktop toolkit for Android Debug Bridge & Fastboot workflows**

Built with [Tauri 2](https://v2.tauri.app) · React 19 · TypeScript · Rust

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/mohdakil2426/adb-gui-next/actions/workflows/ci.yml/badge.svg)](https://github.com/mohdakil2426/adb-gui-next/actions/workflows/ci.yml)

</div>

---

## ✨ Features

| Feature              | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Dashboard**        | Real-time device info — model, battery, storage, IP, root status, wireless ADB     |
| **App Manager**      | Install/uninstall APK/APKS packages with user/system filter and batch operations   |
| **Debloater**        | Universal Android Debloater (UAD) integration — remove bloatware with safety tiers |
| **File Explorer**    | Browse, push, pull, rename, delete files with breadcrumb navigation and drag-drop  |
| **Flasher**          | Flash partitions, recovery sideload, wipe data, manage A/B slots with action queue |
| **Utilities**        | ADB/Fastboot power menus, server control, bootloader variables, terminal launcher  |
| **Payload Dumper**   | Extract partitions from OTA `payload.bin`, ZIP, OPS, and OFP files with progress   |
| **Marketplace**      | Discover and install Android apps from F-Droid, GitHub, and Aptoide                |
| **Emulator Manager** | List, launch, stop AVDs with one-click Magisk rooting wizard and pre-flight checks |
| **Shell**            | Interactive ADB & Fastboot command terminal with history                           |
| **Logs Panel**       | Filterable, searchable log viewer with auto-scroll and export                      |

### Highlights

- 🎨 Light / Dark / System theme with premium UI (OKLCH color system, Framer Motion animations)
- ⚡ ~30 MB installer — Tauri 2 (no Electron bloat)
- 🔒 Hardened CSP, least-privilege capabilities, `freezePrototype`
- 📦 Bundled ADB & Fastboot — no system install required
- 🖥️ Windows & Linux first-class support
- 🔧 70+ Rust-powered backend commands across 10 modules

---

## 📖 Usage Guide

### Installation (End Users)

1. Go to the [Releases](../../releases) page
2. Download the installer for your platform:
   - **Windows**: `.msi` (recommended) or `.exe` (NSIS)
   - **Linux**: `.deb` (Debian/Ubuntu) or `.AppImage`
3. Run the installer — ADB and Fastboot are **bundled**, no extra setup needed

### Quick Start

1. **Connect your Android device** via USB cable
2. **Enable USB Debugging** on your device:
   - Go to `Settings > About Phone` → tap **Build Number** 7 times
   - Go to `Settings > Developer Options` → enable **USB Debugging**
3. **Launch ADB GUI Next** — your device should appear in the Dashboard automatically
4. **Authorize** the USB debugging prompt on your device when prompted

> **Tip**: The app auto-detects ADB and Fastboot devices every 3 seconds. No manual refresh needed.

---

### Feature Walkthroughs

#### 🏠 Dashboard

The Dashboard is your home screen. It shows:

- **Connected Devices** — lists all ADB-connected devices with serial number, status, and editable nicknames
- **Device Info** — click **Refresh Info** to view model, brand, Android version, battery, RAM, storage, IP address, root status, and more. All values are copyable.
- **Wireless ADB** — connect to devices over WiFi in two steps:
  1. **Step 1**: With the device connected via USB, click **Enable Wireless Mode** (runs `adb tcpip 5555`)
  2. **Step 2**: Disconnect the USB cable, enter the device IP (auto-filled if available), and click **Connect**

#### 📦 App Manager

Manage applications on your connected device across two tabs:

**Installation Tab:**

- Click **Select App Files** to choose one or more `.apk` or `.apks` files
- Review the selection list (remove unwanted files with the trash icon)
- Click **Install** — progress is shown for batch installs
- `.apks` files (split APK bundles) are automatically extracted and installed via `install-multiple`

**Uninstall:**

- Click the refresh button to load all installed packages
- Use the **Filter** dropdown to show All / User / System apps
- **Search** packages by name
- **Select** one or more packages using checkboxes
- Click **Uninstall** and confirm the dialog

> **Warning**: Uninstalling system packages can cause instability or bootloops. Only remove packages you're confident are safe.

#### 🗑️ Debloater

Integrated Universal Android Debloater (UAD) for safe bloatware removal:

- Loads curated package lists with safety tiers: **Recommended**, **Advanced**, **Expert**, **Unsafe**
- Filter by list type (AOSP, Carrier, Google, OEM, Misc)
- Actions: **Uninstall**, **Disable**, or **Restore** packages
- Create and restore backups before making changes
- Per-device settings for expert mode, disable mode, and multi-user support

#### 📂 File Explorer

Browse and transfer files between your computer and device:

- **Navigation**: Double-click folders to open them. Use the **↑** button or breadcrumb path to go up
- **Import File**: Push a single file from your computer to the current device directory
- **Import Folder**: Push an entire folder to the current device directory
- **Export Selected**: Select a file or folder (single click), then click **Export** to pull it to your computer
- **Create**: Create new files and directories on the device
- **Rename / Delete**: Right-click context menu for file operations
- Default starting directory: `/sdcard/`

#### ⚡ Flasher

Flash firmware images and sideload OTA updates:

- **Flash Partition** (requires Fastboot mode):
  1. Enter the partition name (e.g., `boot`, `recovery`, `vendor_boot`, `dtbo`)
  2. Click **Select File** or drag-and-drop an `.img` file
  3. Click **Flash Partition** — the device must show as `fastboot` in the device list

- **Recovery Sideload** (requires Recovery mode):
  1. Boot your device into Recovery and select "Apply update from ADB"
  2. Back in the app, click **Select ZIP** to choose a flashable `.zip`
  3. Click **Sideload Package**

- **Wipe Data** (requires Fastboot mode):
  - Performs `fastboot -w` — **permanently erases all user data**
  - Requires confirmation dialog

- **A/B Slot Management**: Switch active slot between **Slot A** and **Slot B**

> **Caution**: Flashing incorrect images can brick your device. Always verify partition names and image compatibility.

#### 🛠️ Utilities

Power controls and device management tools:

- **ADB Power Menu**: Reboot to System, Recovery, Bootloader, or Fastbootd
- **Fastboot Power Menu**: Reboot to System, Bootloader, or Recovery from Fastboot mode
- **Server Control**:
  - **Restart ADB Server** — kills and restarts the ADB daemon (fixes connection issues)
  - **Kill ADB Server** — stops the ADB daemon completely
- **Slot Management** (A/B devices): Switch active slot between **Slot A** and **Slot B**
- **Get Device Variables**: Runs `fastboot getvar all` and displays variables in a copyable/saveable dialog
- **Wipe User Data**: Factory reset via Fastboot (with confirmation)

#### 🧩 Payload Dumper

Extract partition images from OTA update files:

1. Click **Select File** to choose a `payload.bin`, OTA `.zip`, `.ops`, or `.ofp` file
2. Or enter a **Remote URL** — the app downloads partition data via HTTP range requests (no full download needed)
3. The app parses the payload manifest and lists all available partitions with sizes
4. **Select partitions** to extract (or select all)
5. Optionally choose an **output directory** (defaults to a temp folder)
6. Click **Extract** — progress is shown per partition with parallel extraction
7. When complete, click **Open Output Folder** to view extracted `.img` files

> **Tip**: Extraction uses multi-threaded decompression (XZ, BZ2, Zstd) with SHA-256 verification for data integrity.

Supported formats:

- `payload.bin` — Standard Android OTA payload
- `.zip` — OTA ZIP files (payload.bin auto-detected inside)
- `.ops` — OnePlus firmware packages (AES-CFB decryption)
- `.ofp` — Oppo firmware packages (AES decryption)
- **Remote URLs** — HTTP/HTTPS with range request support

#### 🏪 Marketplace

Discover and install Android apps directly from your desktop:

- **Search** across three providers: F-Droid, GitHub, and Aptoide
- **Filter** by provider, sort by relevance, name, downloads, or recently updated
- **App Details**: View description, screenshots, version history, repo stats
- **Download & Install**: Download APKs and install directly to connected device via ADB
- **GitHub Authentication**: Optional device-flow OAuth for higher API rate limits and private repos

#### 🤖 Emulator Manager

Manage Android Virtual Devices (AVDs):

- **List AVDs**: Auto-discovers all installed emulators with API level, ABI, boot mode, and root status
- **Launch**: Start emulators with configurable options (cold boot, no-snapshot, writable system, no boot animation)
- **Stop**: Gracefully shut down running emulators
- **Root with Magisk**: One-click automated rooting wizard:
  1. **Preflight**: Automated readiness scan (ramdisk, boot mode, SDK compatibility)
  2. **Source**: Choose latest stable Magisk (auto-download) or a local APK/ZIP
  3. **Progress**: Real-time step-by-step progress with ramdisk patching and Magisk injection
  4. **Result**: Verification with cold-boot recommendation to prevent snapshot-based reversion
- **Restore**: Undo rooting by restoring original ramdisk backups

#### 💻 Shell (Bottom Panel)

The bottom panel has two tabs:

- **Logs Tab**: All app operations are logged here with timestamps, severity levels (info/success/error/warning), and filtering. Click **Save Log** to export.
- **Shell Tab**: Run raw ADB or Fastboot commands:
  - Type a command (e.g., `devices`, `shell getprop ro.build.display.id`)
  - Select **ADB** or **Fastboot** mode
  - Press Enter or click **Run** — output appears inline

---

### Theme

Click the theme toggle in the sidebar to switch between:

- ☀️ **Light** mode
- 🌙 **Dark** mode
- 💻 **System** (follows OS preference)

---

### Troubleshooting

| Issue                          | Solution                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| Device not detected            | Ensure USB Debugging is enabled and the device is authorized     |
| "Unauthorized" status          | Check the device screen for a USB debugging authorization prompt |
| ADB commands failing           | Try **Restart ADB Server** in Utilities                          |
| Wireless ADB won't connect     | Ensure device and PC are on the same WiFi network                |
| Fastboot operations grayed out | Device must be in bootloader/fastboot mode (not ADB mode)        |
| Flash/Wipe buttons disabled    | No fastboot device detected — reboot to bootloader first         |
| Emulator not listed            | Ensure Android SDK is installed and `ANDROID_HOME` is set        |

---

## 📋 Prerequisites

| Requirement                                             | Version                                 |
| ------------------------------------------------------- | --------------------------------------- |
| [Node.js](https://nodejs.org/)                          | LTS (20+)                               |
| [Bun](https://bun.sh/)                                  | 1+                                      |
| [Rust](https://rustup.rs/)                              | Stable (1.85+)                          |
| [Tauri CLI](https://v2.tauri.app/start/create-project/) | `bun add -D @tauri-apps/cli` (included) |

**Linux only** — install system dependencies:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

---

## 🚀 Building from Source

```bash
# Clone the repository
git clone https://github.com/mohdakil2426/adb-gui-next.git
cd adb-gui-next

# Install dependencies
bun install

# Run in development mode (opens desktop window)
bun run tauri dev

# Build production installer
bun run tauri build
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              Frontend (React 19 + TypeScript + Vite 8)           │
│  MainLayout → 9 Views + Bottom Panel (Logs + Shell tabs)         │
│  State: Zustand 5 + TanStack Query 5 (centralized device poll)   │
│  UI: shadcn/ui (40 primitives) + Tailwind CSS v4 + Framer Motion │
├──────────────────────────────────────────────────────────────────┤
│              Tauri 2 IPC Bridge                                  │
│  backend.ts → invoke<T>() → Rust commands                        │
│  runtime.ts → events, file drop, opener                          │
│  models.ts → 380+ lines of TypeScript DTOs                       │
├──────────────────────────────────────────────────────────────────┤
│              Backend (Rust — Edition 2024)                       │
│  71 Tauri commands across 10 command modules                     │
│  4 domain modules: payload, emulator, debloat, marketplace       │
│  Binary resolution: resource dir → repo → system PATH            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
├── src/                    # React 19 + TypeScript frontend
│   ├── components/         # UI components (views, layout, shared)
│   │   ├── ui/             # 40 shadcn/ui primitives
│   │   ├── views/          # 9 view components + debloater sub-views
│   │   ├── emulator-manager/  # Rooting wizard sub-components
│   │   ├── marketplace/    # App discovery sub-components
│   │   └── payload-dumper/ # Payload extraction sub-components
│   ├── lib/                # Stores, utils, Tauri abstraction layer
│   │   ├── desktop/        # backend.ts, runtime.ts, models.ts
│   │   └── *Store.ts       # 7 Zustand stores
│   └── styles/             # Tailwind v4 CSS + theme tokens
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # App entry + plugin setup (122 lines)
│   │   ├── helpers.rs      # Binary resolution, command execution
│   │   ├── commands/       # 10 command modules
│   │   ├── payload/        # OTA payload parser (8+ modules)
│   │   ├── emulator/       # AVD management + rooting (9 modules)
│   │   ├── debloat/        # UAD integration (5 modules)
│   │   └── marketplace/    # App discovery (9 modules)
│   ├── resources/          # Bundled ADB/Fastboot binaries
│   ├── capabilities/       # Tauri permission grants
│   └── permissions/        # TOML-based command ACL
└── .github/workflows/      # CI + Release pipelines
```

---

## 🛠️ Development

| Command                       | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `bun run tauri dev`           | Dev server + Tauri window                       |
| `bun run build`               | TypeScript + Vite bundle                        |
| `bun run test`                | Run frontend tests (Vitest)                     |
| `bun run lint`                | ESLint (frontend) + cargo clippy (Rust)         |
| `bun run format`              | Prettier (frontend) + cargo fmt (Rust)          |
| `bun run check`               | Full quality gate: lint → format → test → build |
| `bun run tauri build --debug` | Debug build with installer                      |
| `bun run tauri build`         | Release build                                   |

---

## 🖥️ Platform Support

| Platform | Status         | Installer       |
| -------- | -------------- | --------------- |
| Windows  | ✅ First-class | MSI + NSIS      |
| Linux    | ✅ First-class | .deb + AppImage |
| macOS    | ❌ Not planned | —               |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Make your changes
4. Run quality gates: `bun run check`
5. Commit and push
6. Open a Pull Request

### Quality Gates (must pass before PR)

```bash
bun run format:check       # Prettier + cargo fmt
bun run lint               # ESLint + cargo clippy -D warnings
bun run test               # Vitest (frontend) + cargo test (Rust)
bun run build              # TypeScript type-check + Vite bundle
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
