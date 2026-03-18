# Product Requirements Document

## Product Name
ADBKit Enhanced

## 1. Overview
ADBKit Enhanced is a desktop application for managing Android devices through ADB and Fastboot. It provides a graphical interface for common device workflows such as connection management, package installation, file transfer, flashing, rebooting, bootloader inspection, and Android OTA payload extraction.

The product is designed as a local-first utility for developers, enthusiasts, and technicians who need faster access to Android device operations without depending entirely on command-line usage.

## 2. Problem Statement
ADB and Fastboot are powerful but not approachable for every workflow. Even experienced users often repeat the same commands for installation, transfer, flashing, and reboot operations. Payload extraction is typically handled with separate scripts or tools, which adds friction.

Users need a lightweight desktop tool that:
- centralizes common Android device workflows
- improves visibility into device state and operation progress
- reduces CLI overhead without removing advanced capabilities
- supports risky workflows with better UX and clearer feedback

## 3. Goals
### Primary Goals
- Provide a polished desktop GUI for common ADB/Fastboot workflows.
- Improve speed and discoverability for frequent Android maintenance tasks.
- Support both standard and advanced users.
- Offer strong feedback loops for long-running operations.
- Support standalone desktop distribution where practical.

### Secondary Goals
- Maintain a modern visual design with dark/light mode.
- Make payload extraction a first-class built-in feature.
- Centralize operational logs for easier troubleshooting.

## 4. Non-Goals
- Web deployment or browser-first usage.
- Cloud sync, remote device orchestration, or fleet management.
- Multi-user collaboration.
- Full interactive terminal emulation.
- macOS support in the current scope.

## 5. Target Users
### Primary Users
- Android enthusiasts and modders
- ROM flashers and bootloader users
- Mobile service technicians
- QA engineers and developers using physical Android devices

### Secondary Users
- Power users who want a faster UI for device commands
- Users who understand Android tooling but prefer guided flows for risky actions

## 6. Platform Scope
### Supported
- Windows
- Linux

### Not Supported
- macOS
- Browser runtime

## 7. Core Product Requirements

### 7.1 Dashboard
The product must provide a dashboard that:
- lists connected devices
- shows device serial and connection status
- fetches device details such as model, Android version, IP address, root status, RAM, storage, and battery level
- allows locally persisted nicknames per device
- supports refreshing current device state

### 7.2 Wireless ADB
The product must support wireless ADB workflows that:
- enable TCP/IP mode on a USB-connected device
- connect to a device by IP and port
- disconnect from a wireless device
- provide clear success/error feedback for each action

### 7.3 App Manager
The product must support app-management workflows that:
- select one or more `.apk` files for installation
- support `.apks` split package installation
- display selected files before install
- install packages sequentially with visible progress feedback
- load installed packages from the device
- search installed packages
- support multi-select uninstall with confirmation

### 7.4 File Explorer
The product must provide a file explorer that:
- browses device files under accessible user storage paths such as `/sdcard/`
- displays file metadata in a list/table
- supports importing files from desktop to device
- supports importing folders from desktop to device
- supports exporting a selected file or folder from device to desktop
- uses native dialogs for selecting local paths

### 7.5 Flasher
The product must support flashing and recovery workflows that:
- detect devices in fastboot and related modes
- allow image file selection
- flash an image to a user-specified partition
- sideload ZIP packages in supported recovery/sideload flows
- wipe user data with explicit confirmation
- surface success or failure clearly

### 7.6 Utilities
The product must provide utility actions that:
- detect current device connection mode
- reboot to system, recovery, bootloader, or fastboot as appropriate
- restart or kill the ADB server
- fetch fastboot getvar output
- allow saving or copying bootloader variable output
- set active slot on A/B devices
- provide confirmation for destructive actions

### 7.7 Shell
The product must provide a command shell that:
- accepts `adb`, `adb shell`, and `fastboot` prefixed commands
- shows command history
- shows command output and errors inline
- supports keyboard navigation through previous commands

### 7.8 Payload Dumper
The product must provide a payload dumper that:
- accepts both `payload.bin` and OTA ZIP files as input
- lists available partitions in the payload
- shows partition size information
- allows selecting specific partitions or extracting all
- displays extraction progress in real time
- supports drag-and-drop file selection
- supports output directory selection
- supports opening the final output folder from the UI

### 7.9 Global Logging
The product must provide a global logging capability that:
- collects key user-facing operational events across views
- displays logs in a dedicated panel
- supports copying logs
- supports saving logs to a local file
- remains available across navigation changes

### 7.10 Theming and UI
The product must provide:
- dark and light themes
- responsive layouts for common desktop sizes
- consistent component styling
- loading states and feedback during async actions
- clear confirmation dialogs for risky operations

## 8. Functional Requirements

### Backend Requirements
- The backend must expose exported methods through Wails bindings.
- The backend must execute ADB/Fastboot commands with timeout/cancellation support.
- The backend must support platform-specific OS integration for dialogs and external tools.
- The backend must save exported logs to a local directory.
- The backend must clean up temporary payload extraction files on shutdown and context changes.

### Frontend Requirements
- The frontend must provide a single application shell with persistent navigation and logs access.
- Each feature area must be represented by a dedicated view.
- Global client state must be used only where cross-view persistence is needed.
- Long-running operations must show progress, loaders, or status messaging.

## 9. Non-Functional Requirements
- The app should feel lightweight and responsive on modern desktop hardware.
- The UI should make frequent workflows possible in a few clicks.
- Errors should be contextual and human-readable.
- Risky operations should not be triggered accidentally.
- The app should remain usable without internet access for core local functions.
- The app should not require a separate web server runtime.

## 10. Constraints
- The app depends on ADB and Fastboot command behavior and output formats.
- The project uses Wails, so frontend/backend communication follows Wails binding patterns.
- Payload extraction can be CPU intensive, especially for large files.
- Linux standalone packaging expectations should stay aligned with actual runtime binary lookup behavior.

## 11. Key User Flows
### Flow A: Connect device and inspect info
1. User opens the app.
2. Dashboard shows connected devices.
3. User selects or views current device info.
4. User optionally edits nickname or enables wireless ADB.

### Flow B: Install apps
1. User opens App Manager.
2. User selects `.apk` or `.apks` files.
3. User reviews selected files.
4. User starts installation.
5. App shows progress and final result.

### Flow C: Extract OTA payload
1. User opens Payload Dumper.
2. User selects a payload or drags one into the app.
3. App loads partitions.
4. User selects output directory and target partitions.
5. User starts extraction.
6. App shows per-partition progress.
7. User opens output folder.

### Flow D: Flash a partition
1. User opens Flasher.
2. App detects available device mode.
3. User selects image file and enters partition.
4. User starts flash.
5. App shows completion or failure.

## 12. Success Criteria
A release should be considered successful when:
- users can complete the main Android device workflows from the GUI without manual CLI usage for standard tasks
- payload extraction is reliable and visible through progress updates
- logs and feedback are sufficient for troubleshooting common failures
- Windows and Linux users can run supported workflows without platform-specific confusion

## 13. Current Known Gaps
- Linux embedded-binary runtime behavior should be reviewed for parity with Windows packaging expectations.
- The shell is command-based rather than a full interactive terminal.
- Some repository documentation still reflects generic Wails defaults instead of narrowed platform support.
- Automated test coverage is not a visible strength of the current codebase.

## 14. Future Opportunities
- Better Linux packaging/runtime parity improvements
- More robust developer documentation
- Expanded automated test coverage
- Additional payload extraction detail or progress granularity
- Improved terminal capabilities if interactive shell support becomes a requirement

## 15. Release Positioning
ADBKit Enhanced should be positioned as a lightweight, modern Android device toolbox for desktop users who want the power of ADB and Fastboot with a faster and more understandable interface.