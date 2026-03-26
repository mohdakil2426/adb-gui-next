<div align="center">

# ADB GUI Next

**A modern desktop toolkit for Android Debug Bridge & Fastboot workflows**

Built with [Tauri 2](https://v2.tauri.app) · React 19 · TypeScript · Rust

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ Features

| Feature            | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| **Dashboard**      | Real-time device info — model, battery, storage, IP, root status             |
| **App Manager**    | Install, uninstall, sideload APK/APKS packages with user/system filter       |
| **File Explorer**  | Browse, push, and pull files to/from connected devices                       |
| **Flasher**        | Flash partitions, reboot modes, wipe data, manage A/B slots                  |
| **Utilities**      | Wireless ADB, bootloader variables, device manager, terminal launcher        |
| **Payload Dumper** | Extract partitions from OTA `payload.bin` / ZIP files with progress tracking |
| **Shell**          | Interactive ADB & Fastboot command terminal                                  |
| **Logs Panel**     | Filterable, searchable log viewer with auto-scroll                           |

### Highlights

- 🎨 Light/Dark/System theme with premium UI
- ⚡ ~30 MB installer — Tauri 2 (no Electron bloat)
- 🔒 Hardened CSP, least-privilege capabilities, `freezePrototype`
- 📦 Bundled ADB & Fastboot — no system install required
- 🖥️ Windows & Linux first-class support

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

> **Tip**: The app auto-detects ADB and Fastboot devices every 3–4 seconds. No manual refresh needed.

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

Manage applications on your connected device:

- **Install APK**:
  1. Click **Select App Files** to choose one or more `.apk` or `.apks` files
  2. Review the selection list (remove unwanted files with the trash icon)
  3. Click **Install** — progress is shown for batch installs
  4. `.apks` files (split APK bundles) are automatically extracted and installed via `install-multiple`

- **Uninstall Packages**:
  1. Click the refresh button to load all installed packages
  2. Use the **Filter** dropdown to show All / User / System apps
  3. **Search** packages by name
  4. **Select** one or more packages using checkboxes
  5. Click **Uninstall** and confirm the dialog

> **Warning**: Uninstalling system packages can cause instability or bootloops. Only remove packages you're confident are safe.

#### 📂 File Explorer

Browse and transfer files between your computer and device:

- **Navigation**: Double-click folders to open them. Use the **↑** button or breadcrumb path to go up
- **Import File**: Push a single file from your computer to the current device directory
- **Import Folder**: Push an entire folder to the current device directory
- **Export Selected**: Select a file or folder (single click), then click **Export** to pull it to your computer
- Default starting directory: `/sdcard/`

#### ⚡ Flasher

Flash firmware images and sideload OTA updates:

- **Flash Partition** (requires Fastboot mode):
  1. Enter the partition name (e.g., `boot`, `recovery`, `vendor_boot`, `dtbo`)
  2. Click **Select File** to choose an `.img` file
  3. Click **Flash Partition** — the device must show as `fastboot` in the device list

- **Recovery Sideload** (requires Recovery mode):
  1. Boot your device into Recovery and select "Apply update from ADB"
  2. Back in the app, click **Select ZIP** to choose a flashable `.zip`
  3. Click **Sideload Package**

- **Wipe Data** (requires Fastboot mode):
  - Performs `fastboot -w` — **permanently erases all user data**
  - Requires confirmation dialog

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

1. Click **Select File** to choose a `payload.bin` or an OTA `.zip` file
2. The app parses the payload manifest and lists all available partitions with sizes
3. **Select partitions** to extract (or select all)
4. Optionally choose an **output directory** (defaults to a temp folder)
5. Click **Extract** — progress is shown per partition with parallel extraction
6. When complete, click **Open Output Folder** to view extracted `.img` files

> **Tip**: Extraction uses multi-threaded decompression (XZ, BZ2, Zstd) with SHA-256 verification for data integrity.

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

## 📋 Prerequisites

| Requirement                                             | Version                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| [Node.js](https://nodejs.org/)                          | LTS (20+)                                |
| [pnpm](https://pnpm.io/)                                | 9+                                       |
| [Rust](https://rustup.rs/)                              | Stable (1.85+)                           |
| [Tauri CLI](https://v2.tauri.app/start/create-project/) | `pnpm add -D @tauri-apps/cli` (included) |

**Linux only** — install system dependencies:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

---

## 🚀 Building from Source

```bash
# Clone the repository
git clone https://github.com/akila/adb-gui-next.git
cd adb-gui-next

# Install dependencies
pnpm install

# Run in development mode (opens desktop window)
pnpm tauri dev

# Build production installer
pnpm tauri build
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Frontend (React 19 + TypeScript + Vite)         │
│  MainLayout → 7 Views + Bottom Panel (Logs + Shell tabs)     │
│  State: Zustand + TanStack Query (device polling)            │
│  UI: shadcn/ui + Tailwind CSS v4 + Framer Motion             │
├──────────────────────────────────────────────────────────────┤
│              Tauri 2 IPC Bridge                              │
│  backend.ts → invoke<T>() → Rust commands                    │
│  runtime.ts → events, file drop, opener                      │
├──────────────────────────────────────────────────────────────┤
│              Backend (Rust)                                  │
│  28 Tauri commands across 7 modules                          │
│  Payload parser: CrAU + protobuf + parallel extraction       │
│  Binary resolution: resource dir → repo → system PATH        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Development

| Command                    | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `pnpm tauri dev`           | Dev server + Tauri window                       |
| `pnpm build`               | TypeScript + Vite bundle                        |
| `pnpm lint`                | ESLint (frontend) + cargo clippy (Rust)         |
| `pnpm format`              | Prettier (frontend) + cargo fmt (Rust)          |
| `pnpm check`               | Full quality gate: lint → format → test → build |
| `pnpm tauri build --debug` | Debug build with installer                      |
| `pnpm tauri build`         | Release build                                   |

---

## 📂 Project Structure

```
├── src/                    # React 19 + TypeScript frontend
│   ├── components/         # UI components (views, layout, shared)
│   ├── lib/                # Stores, utils, Tauri abstraction layer
│   └── styles/             # Tailwind v4 CSS + theme tokens
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # App entry + plugin setup
│   │   ├── helpers.rs      # Binary resolution, command execution
│   │   ├── commands/       # 7 command modules
│   │   └── payload/        # OTA payload parser (4 modules)
│   ├── resources/          # Bundled ADB/Fastboot binaries
│   └── capabilities/       # Tauri permission grants
└── .github/workflows/      # CI + Release pipelines
```

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
4. Run quality gates: `pnpm check`
5. Commit and push
6. Open a Pull Request

### Quality Gates (must pass before PR)

```bash
pnpm format:check          # Prettier + cargo fmt
pnpm lint                  # ESLint + cargo clippy -D warnings
pnpm build                 # TypeScript type-check + Vite bundle
cargo test --manifest-path src-tauri/Cargo.toml  # Rust tests
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
