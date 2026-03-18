# Project Brief: ADBKit Enhanced

## Product Summary
ADBKit Enhanced is a desktop GUI for Android Debug Bridge (ADB) and Fastboot built with Wails. It wraps common Android device workflows in a modern graphical interface so users can manage devices, move files, install apps, flash images, inspect bootloader state, and extract Android OTA payloads without relying entirely on the command line.

The project is a heavily enhanced fork of the original ADBKit and now includes a broader toolset, a polished frontend shell, a global logs panel, and a built-in payload dumper.

## Core Goals
- Make common ADB and Fastboot workflows accessible from a GUI.
- Reduce repeated CLI typing for high-frequency tasks.
- Preserve power-user functionality through direct command execution where needed.
- Provide clear progress, logging, and confirmation for risky operations.
- Ship as a lightweight desktop app without Electron overhead.
- Support standalone distribution by bundling required binaries where possible.

## Primary Users
- Android enthusiasts and custom ROM users.
- Mobile repair and service technicians.
- QA engineers and developers who use ADB/Fastboot regularly.
- Power users who want a faster local interface for device operations.

## Supported Platform Scope
- Windows: first-class support.
- Linux: supported in product scope.
- macOS and other platforms: out of scope in the current codebase.

## Core Features
- Dashboard for connected devices, nicknames, and device info.
- Wireless ADB enable/connect/disconnect workflow.
- App Manager for APK and APKS install plus batch uninstall.
- File Explorer for browsing `/sdcard/`, pushing, and pulling files/folders.
- Flasher for image flashing, sideload, wipe, and bootloader workflows.
- Utilities for reboot actions, ADB server control, slot switching, and getvar output.
- Shell view for running `adb`, `adb shell`, and `fastboot` commands.
- Payload Dumper for `payload.bin` and OTA ZIP extraction with partition selection.
- Global logs panel with copy and save/export support.
- Light and dark theme support.

## Product Boundaries
### In Scope
- Local desktop management of Android devices over ADB and Fastboot.
- Local payload extraction and file operations.
- Native desktop dialogs and OS integrations.
- Safety confirmations for destructive UI actions.

### Out of Scope
- Cloud sync or remote fleet management.
- Browser-based deployment.
- Multi-user collaboration features.
- Device farm orchestration.
- macOS support in the current implementation.
- Full PTY-style terminal emulation.

## Current Product Positioning
ADBKit Enhanced should be treated as a local Android device toolbox: fast, practical, visual, and capable enough for advanced workflows while remaining approachable for users who do not want to memorize every adb/fastboot command.