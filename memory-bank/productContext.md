# Product Context

## Why this project exists

ADB and fastboot are powerful but awkward for many repetitive Android workflows. This project exists to provide a local desktop toolbox that makes those workflows faster, more visual, and easier to manage without giving up power-user capability.

## Problems it solves

- Reduces repetitive command-line work
- Makes destructive workflows more visible and deliberate
- Centralizes Android maintenance tasks in one desktop app
- Provides payload extraction inside the app
- Preserves advanced operations without requiring a terminal-first workflow

## User Experience Goals

- Native-feeling desktop application
- Lightweight runtime compared with Electron
- Preserve the existing multi-view shell from the legacy app
- Keep progress feedback and logging visible for long-running operations
- Maintain practical, task-oriented feature flows

## Product Boundaries

### In scope

- Local device management through ADB and fastboot
- Local file transfer and package management
- Local OTA payload extraction
- Native dialogs and OS integration
- Windows and Linux desktop packaging

### Out of scope

- Cloud features
- Browser deployment
- Multi-user collaboration
- Device farm orchestration
- macOS parity in the current implementation
