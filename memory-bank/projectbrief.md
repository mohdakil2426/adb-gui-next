# Project Brief: ADB GUI Next

## Product Summary

ADB GUI Next is a Tauri 2 desktop application for Android Debug Bridge and fastboot workflows. It is a migration of the legacy Wails-based ADBKit Enhanced app into a root-level Tauri + Rust + React codebase while preserving the legacy implementation under `docs/adb-gui-kit/refernces/` as permanent reference material.

## Core Goals

- Preserve the legacy app’s user-facing feature set and UX direction.
- Keep the copied frontend as intact as practical.
- Replace Wails-specific runtime/backend behavior with Tauri-compatible implementations.
- Bundle required Android tools for standalone Windows and Linux usage.
- Preserve `docs/`, `TAURI_MIGRATION_PLAN.md`, and the legacy reference app without harming them.

## Primary Users

- Android enthusiasts and custom ROM users
- Repair and service technicians
- QA engineers and Android developers
- Power users who want GUI-driven ADB/fastboot workflows

## Supported Platforms

- Windows: first-class target
- Linux: intended target
- macOS: out of current scope

## Major Feature Areas

- Dashboard and device info
- Wireless ADB
- App Manager
- File Explorer
- Flasher
- Utilities
- Shell command runner
- Payload Dumper
- Global logs panel

