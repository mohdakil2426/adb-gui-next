# Project Brief: ADB GUI Next

## Product Summary

ADB GUI Next is a Tauri 2 desktop application for Android Debug Bridge and fastboot workflows. Built with React 19 + TypeScript + Vite + Rust, it provides a modern, native-feeling desktop experience for Android device management.

## Core Goals

- Provide comprehensive ADB and fastboot workflow coverage
- Maintain a clean Tauri 2 native desktop architecture
- Bundle required Android tools for standalone Windows and Linux usage
- Preserve the legacy Go/Wails reference archive for documentation only

## Primary Users

- Android enthusiasts and custom ROM users
- Repair and service technicians
- QA engineers and Android developers
- Power users who want GUI-driven ADB/fastboot workflows

## Supported Platforms

- **Windows**: First-class target
- **Linux**: First-class target
- **macOS**: Out of current scope

## Major Feature Areas

1. **Dashboard** — Device info, battery, storage, IP address
2. **Wireless ADB** — Connect/disconnect, TCP/IP enable
3. **App Manager** — Install, uninstall, sideload, list packages
4. **File Explorer** — List, push, pull files
5. **Flasher** — Fastboot flash, reboot, wipe, slot management
6. **Utilities** — Reboot modes, bootloader variables, device manager
7. **Shell** — Run shell commands on device
8. **Payload Dumper** — Extract OTA payload.bin partitions
9. **Global Logs Panel** — Timestamped operation logs

## Current Version

- Version: 0.1.0
- Rust Edition: 2024
- Last Updated: 2026-03-22