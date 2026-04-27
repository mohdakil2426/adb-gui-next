# Emulator Root Diagnostics

- Timestamp: 20260428-014552
- Serial: emulator-5554
- AVD: Medium_Phone
- ADB: C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe

## AVD Ramdisk

- Path: `C:\Users\akila\AppData\Local\Android\Sdk\system-images\android-33\google_apis_playstore\x86_64\ramdisk.img`
- Size: 1623093 bytes
- Modified: 04/28/2026 01:29:44
- Backup: `C:\Users\akila\AppData\Local\Android\Sdk\system-images\android-33\google_apis_playstore\x86_64\ramdisk.img.backup`
- Backup size: 1516994 bytes
- Backup modified: 04/28/2026 01:22:09

## ADB Devices

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe devices -l`

Exit code: `0`

```text
List of devices attached
```

## Build And Boot Props

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell getprop ...`

Exit code: `1`

```text
adb.exe: device 'emulator-5554' not found
```

## Magisk Packages

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell pm list packages | grep -i magisk`

Exit code: `1`

```text
adb.exe: device 'emulator-5554' not found
```

## su Probe

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell su -c id -u`

Exit code: `1`

```text
adb.exe: device 'emulator-5554' not found
```

## Workdir Probe

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell ls -la /data/local/tmp/adb-gui-root`

Exit code: `1`

```text
adb.exe: device 'emulator-5554' not found
```

## Download Folder Root Artifacts

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell ls -la /sdcard/Download`

Exit code: `1`

```text
adb.exe: device 'emulator-5554' not found
```

