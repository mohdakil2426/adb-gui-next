# Product Context

## Why This Project Exists

ADB and fastboot are powerful but awkward for repetitive Android workflows. This project exists to provide a local desktop toolbox that makes those workflows faster, more visual, and easier to manage without sacrificing power-user capability.

## Problems It Solves

- Reduces repetitive command-line work
- Makes destructive workflows more visible and deliberate
- Centralizes Android maintenance tasks in one desktop app
- Provides OTA payload extraction inside the app
- Preserves advanced operations without requiring a terminal-first workflow

## User Experience Goals

- Native-feeling desktop application
- Lightweight runtime (Tauri 2 vs Electron)
- Multi-view shell with sidebar navigation
- Progress feedback and logging for long-running operations
- Practical, task-oriented feature flows
- Light/dark/system theme support
- ~95% UI consistency: semantic tokens, standardized icons, accessible clickable lists, shared components

## Product Boundaries

### In Scope

- Local device management through ADB and fastboot
- Local file transfer and package management
- Local OTA payload extraction
- Native dialogs and OS integration
- Windows and Linux desktop packaging
- Wireless ADB connectivity

### Out of Scope

- Cloud features
- Browser deployment
- Multi-user collaboration
- Device farm orchestration
- macOS parity (current implementation)

## Target Platforms

| Platform | Support Level |
|----------|---------------|
| Windows  | First-class   |
| Linux    | First-class   |
| macOS    | Not planned   |

## Version

- Current: 0.1.0
- Tauri: 2.x
- Last Updated: 2026-03-23 (UI consistency audit & fixes)