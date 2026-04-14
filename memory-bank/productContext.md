# Product Context

## Why This Project Exists

ADB and fastboot are powerful but awkward for repetitive Android workflows. This project exists to provide a local desktop toolbox that makes those workflows faster, more visual, and easier to manage without sacrificing power-user capability.

## Problems It Solves

- Reduces repetitive command-line work
- Makes destructive workflows more visible and deliberate
- Centralizes Android maintenance tasks in one desktop app
- Provides OTA payload extraction inside the app
- Provides OnePlus OPS and Oppo OFP firmware decryption and extraction
- Enables app discovery and installation from open-source and curated repositories (F-Droid, IzzyOnDroid, GitHub, Aptoide)
- Preserves advanced operations without requiring a terminal-first workflow

## User Experience Goals

- Native-feeling desktop application
- Lightweight runtime (Tauri 2 vs Electron)
- Multi-view shell with sidebar navigation
- Progress feedback and logging for long-running operations
- Practical, task-oriented feature flows
- Light/dark/system theme support
- ~95% UI consistency: semantic tokens, standardized icons, accessible clickable lists, shared components
- File management: dual-pane explorer, multi-select, inline rename, delete with confirmation
- **Pinned header bar**: always visible regardless of content height (viewport-locked layout via `h-svh` boundary)
- **Responsive layout**: all views adapt to window resize with no horizontal overflow, no phantom scrollbars

## Product Boundaries

### In Scope

- Local device management through ADB and fastboot
- Local file transfer and package management
- Local OTA payload extraction
- **OnePlus OPS and Oppo OFP firmware extraction** (encrypted containers, AES-CFB, custom ciphers)
- **Remote OTA payload extraction** (HTTP range requests — optional feature)
- Native dialogs and OS integration
- Windows and Linux desktop packaging
- Wireless ADB connectivity
- **App marketplace** — Discovery-first marketplace: zero-query browsing, grouped search results, provider-aware install flows, optional GitHub sign-in, and installs from F-Droid, IzzyOnDroid, GitHub, and Aptoide

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
- Last Updated: 2026-04-14 (Applications page now progressively shows installed-app icons while keeping package-list load fast)
