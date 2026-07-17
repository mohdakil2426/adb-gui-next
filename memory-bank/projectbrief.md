# Project Brief: ADB GUI Next

## Product Summary

ADB GUI Next is a Tauri 2 desktop app for ADB, fastboot, firmware extract, debloat, marketplace, and emulator workflows. Stack: React 19 · TypeScript · Vite · Rust 2024 · Bun.

## Core Goals

- Cover ADB/fastboot power-user workflows in a native desktop GUI
- Keep a clean Tauri 2 architecture (thin IPC, domain logic in Rust)
- Bundle platform-tools for standalone Windows/Linux installs

## Primary Users

- Android enthusiasts and custom ROM users
- Repair/service technicians, QA, developers
- Power users who prefer GUI over raw CLI for repetitive tasks

## Platforms

| Platform | Status |
| --- | --- |
| Windows | First-class |
| Linux | First-class |
| macOS | Out of product scope |

## Major feature areas

Dashboard · Wireless ADB · App Manager (+ UAD debloat) · File Explorer · Flasher · Utilities · Payload Dumper · Marketplace · Emulator Manager · Bottom panel (Logs + Shell)

## Version

- **App:** 0.2.5 (`package.json` / Tauri config)
- **Rust edition:** 2024
- **Last memory-bank refresh:** 2026-07-18
