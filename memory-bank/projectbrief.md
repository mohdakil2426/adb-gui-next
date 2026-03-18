# Project Brief: ADB GUI Next

## Product Summary

ADB GUI Next is a Tauri 2 desktop application for Android Debug Bridge and fastboot workflows. It is the current product codebase, built with Rust, React, and Vite, while preserving the legacy implementation as reference-only material outside the live app build and runtime flow.

## Core Goals

- Preserve the app’s practical Android workflow coverage and UX direction.
- Keep the copied frontend as intact as practical.
- Maintain a clean Tauri-native desktop architecture.
- Bundle required Android tools for standalone Windows and Linux usage.
- Preserve `docs/`, the historical plan archive, and the legacy reference app without harming them.

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
