# Project Brief: ADB GUI Next

## Product Summary

ADB GUI Next is a Tauri 2 desktop app for ADB, fastboot, firmware extract, debloat, marketplace, and emulator workflows. Stack: React 19 · TypeScript · Vite · Rust 2024 · Bun.

## Core Goals

- Cover ADB/fastboot power-user workflows in a native desktop GUI
- Keep a clean Tauri 2 architecture (thin IPC, domain logic in Rust)
- Bundle platform-tools for standalone Windows/Linux installs where arch matches

## Primary Users

- Android enthusiasts and custom ROM users
- Repair/service technicians, QA, developers
- Power users who prefer GUI over raw CLI for repetitive tasks

## Platforms

| Platform | Status |
| --- | --- |
| Windows x86_64 / i686 / aarch64 | First-class / shipped (see project_rules for tools notes) |
| Linux x86_64 / aarch64 | First-class / shipped (arm uses PATH tools) |
| macOS | Code may exist; **builds paused** (not first-class) |

## Major feature areas

Dashboard · Wireless ADB · App Manager (+ UAD debloat + APK icons) · File Explorer · Flasher · Utilities (including Windows Google host setup) · **Scrcpy** (official binaries, native window) · Payload Dumper · Marketplace · Emulator Manager · Bottom panel (Logs + Shell)

## Version

- **App SoT:** `package.json` **0.2.5**
- **Tauri:** `"version": "../package.json"`
- **Cargo:** must match (`bun run version:sync`)
- **Rust edition:** 2024
- **Last memory-bank refresh:** 2026-08-17
