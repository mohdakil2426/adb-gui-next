# Product Context

## Why this project exists
ADB and Fastboot are powerful but inconvenient for many real-world users. The tools are command-line first, easy to misuse, and inefficient for repetitive workflows such as app installation, file transfer, flashing, rebooting into specific modes, or inspecting device state.

ADBKit Enhanced exists to turn those workflows into a focused desktop experience with native dialogs, visual status, progress feedback, and lower friction for frequent actions.

## Problems it solves
- **CLI complexity:** users do not need to remember every command or argument.
- **Workflow fragmentation:** common Android maintenance tasks are gathered into one app.
- **Poor visibility:** device state, extraction progress, and operation history are easier to inspect visually.
- **Repetitive operations:** repeated tasks like installing, uninstalling, flashing, or exporting logs become faster.
- **Payload extraction friction:** Android OTA `payload.bin` extraction can be done inside the app instead of relying on separate tooling.

## User Experience Goals
- **Modern desktop feel:** polished UI, responsive layout, dark/light support, clean visual hierarchy.
- **Fast local workflows:** minimal setup, lightweight runtime, no Electron overhead.
- **Action clarity:** buttons, dialogs, and status should clearly communicate what is happening.
- **Safe enough for risky actions:** destructive operations should be intentional and visible.
- **Power-user friendly:** raw ADB/Fastboot command execution should remain available.
- **Persistent convenience:** remembered nicknames, durable view state where useful, and a global log panel.

## Key Product Principles
- Prefer direct, task-oriented workflows over generic abstractions.
- Keep the app local-first and utility-focused.
- Show useful progress and results for long-running work.
- Make common operations discoverable from navigation instead of hidden in menus.
- Preserve advanced capability without making the primary UI feel intimidating.

## Main User Journeys
1. **Connect device and inspect status**
   - Open dashboard.
   - Detect connected devices.
   - View device properties, nickname, battery, storage, and wireless ADB info.

2. **Install or remove apps**
   - Open App Manager.
   - Select one or more `.apk` or `.apks` files and install them.
   - Load installed packages, filter them, select multiple packages, and uninstall.

3. **Browse and transfer files**
   - Open File Explorer.
   - Navigate `/sdcard/`.
   - Import files/folders from the desktop or export selected device content.

4. **Flash or recover devices**
   - Open Flasher or Utilities.
   - Detect device mode.
   - Flash images, sideload ZIPs, wipe data, reboot, inspect getvar output, or change active slot.

5. **Extract Android OTA payloads**
   - Open Payload Dumper.
   - Select `payload.bin` or an OTA ZIP.
   - Load partitions, choose targets, track real-time progress, and open the output folder.

6. **Run ad hoc commands**
   - Open Shell.
   - Execute `adb`, `adb shell`, or `fastboot` commands with history.

## Product Risks from a UX Perspective
- Many actions are inherently high impact, especially flashing and wiping.
- Device connection state changes frequently, so polling and status transitions must feel stable.
- Some workflows are long-running, especially payload extraction and large transfers, so progress and logs are important.
- Linux packaging and standalone expectations should stay aligned with actual binary resolution behavior.