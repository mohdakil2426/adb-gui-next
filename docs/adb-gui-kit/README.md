# ADBKit Enhanced 🚀

> **A powerful, modern GUI for ADB and Fastboot** — Enhanced with Payload Dumper, Standalone Builds, and more!

[![GitHub Release](https://img.shields.io/github/v/release/mohdakil2426/adb-gui-kit-enhanced?style=for-the-badge&logo=github)](https://github.com/mohdakil2426/adb-gui-kit-enhanced/releases)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-brightgreen?style=for-the-badge)]()

<p align="center">
  <img src="screenshots/dashboard.png" alt="ADBKit Dashboard" width="800"/>
</p>

---

## ✨ What's New in Enhanced Edition

This is a **heavily enhanced fork** of [ADBKit by Drenzzz](https://github.com/Drenzzz/adb-gui-kit), featuring major new capabilities and improvements:

### 🆕 Major New Features

| Feature | Description |
|---------|-------------|
| **🎛️ Payload Dumper** | Extract Android OTA `payload.bin` files with real-time progress, drag & drop support, and partition selection |
| **⚡ Standalone Executable** | Fully standalone `.exe` — No external `bin/` folder needed! ADB & Fastboot are embedded |
| **📋 Global Log Panel** | Resizable, exportable terminal log panel integrated across all views |
| **🖥️ Device Manager Launch** | One-click access to Windows Device Manager / Linux settings |
| **💻 External Terminal** | Open terminal directly in ADB tools directory |
| **📦 Multi-APK Install** | Install multiple APKs at once |
| **🗑️ Batch Uninstall** | Multi-select packages for bulk uninstallation |

### 🔧 Under-the-Hood Improvements

- **Go Best Practices**: Sentinel errors, interfaces, constants, GoDoc comments
- **Performance Optimizations**: CSS transitions for smoother animations
- **Responsive UI**: Adaptive layouts for all window sizes
- **Platform-Specific Code**: Proper Go build tags for Windows/Linux

---

## 🎯 Features

### Dashboard
- Unified connected-device list with **editable nicknames** (stored locally)
- Rich device info card (model, Android version, root status, storage)
- **Wireless ADB** — connect/disconnect via IP/port
- Quick status refresh

### Payload Dumper ⭐ NEW
- Extract `payload.bin` from Android OTA updates
- Supports direct `.bin` files or `.zip` archives
- Real-time extraction progress with percentage
- Select specific partitions to extract
- **Drag & drop** file support
- Open output folder directly

### App Manager
- **Install APKs** from your computer (single or multiple)
- **Uninstall packages** with multi-select support
- Search and filter installed apps
- Safe confirmation dialogs

### File Explorer
- Browse device `/sdcard/` directory
- **Import**: Upload files from PC to device
- **Export**: Download files/folders from device to PC
- Loading and empty-folder states

### Flasher
- Flash `.img` files to specific partitions (boot, recovery, etc.)
- **Wipe Data** (factory reset) with safety confirmation
- Flash ZIP packages through `adb sideload` in recovery mode
- A/B slot selection support

### Terminal Shell
- Run `adb`, `adb shell`, or `fastboot` commands
- Command history
- Interactive shell experience

### Utilities
- One-click reboot actions (System, Recovery, Bootloader, Fastboot)
- Automatic ADB/Fastboot mode detection
- Get bootloader variables (`fastboot getvar all`)
- ADB server restart/kill
- Launch external terminal

### Global Features
- 🌗 **Light/Dark theme** toggle
- 📋 **Terminal Log Panel** — resizable, with save/export
- 🔔 **Toast notifications** for all operations
- 💾 **Persistent nicknames** for devices

---

## 📥 Installation

### Option 1: Download Release (Recommended)

1. Go to the **[Releases](https://github.com/mohdakil2426/adb-gui-kit-enhanced/releases)** page
2. Download the appropriate file for your OS:
   - **Windows**: `ADBKit-windows-standalone.zip` or `ADBKit-*-installer.exe`
   - **Linux**: `ADBKit-linux-standalone.tar.gz`, `.deb`, `.rpm`, or `.AppImage`
3. Extract/Install and run!

> ✅ **No additional setup required!** ADB & Fastboot binaries are embedded in the executable.

### Option 2: Build from Source

See [Building from Source](#-building-from-source) below.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Wails v2](https://wails.io/) |
| **Backend** | Go 1.23+ |
| **Frontend** | React 19, TypeScript, Astro |
| **UI** | shadcn/ui, Tailwind CSS 4.x, Radix UI |
| **State** | Zustand |
| **Animations** | Framer Motion, CSS Transitions |

---

## 🔨 Building from Source

### Prerequisites
- Go 1.23+
- Node.js 22+
- pnpm 10+
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/mohdakil2426/adb-gui-kit-enhanced.git
   cd adb-gui-kit-enhanced
   ```

2. **Verify Wails dependencies**
   ```bash
   wails doctor
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   pnpm install
   cd ..
   ```

4. **Run in development mode**
   ```bash
   wails dev
   ```

5. **Build for production**
   ```bash
   wails build
   ```
   
   For Windows with installer:
   ```bash
   wails build -nsis
   ```

---

## 📸 Screenshots

See [screenshots/README.md](screenshots/README.md) for more images.

---

## 🙏 Credits

### Original Project
- **[ADBKit](https://github.com/Drenzzz/adb-gui-kit)** by [Drenzzz](https://github.com/Drenzzz)

### Enhanced Edition
- **Enhanced & Maintained by [AKIL](https://github.com/mohdakil2426)**
- Telegram: [@I_AM_AKIL](https://t.me/I_AM_AKIL)

### Technologies
- [Wails](https://wails.io/) — Desktop app framework
- [shadcn/ui](https://ui.shadcn.com/) — UI components
- [Tailwind CSS](https://tailwindcss.com/) — Styling

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/mohdakil2426">AKIL</a>
</p>
