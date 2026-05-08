# Emulator Root Diagnostics

- Timestamp: 20260428-020406
- Serial: emulator-5554
- AVD: Medium_Phone
- ADB: C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe

## AVD Ramdisk

- Path: `C:\Users\akila\AppData\Local\Android\Sdk\system-images\android-33\google_apis_playstore\x86_64\ramdisk.img`
- Size: 1923273 bytes
- Modified: 04/28/2026 02:03:11
- Backup: `C:\Users\akila\AppData\Local\Android\Sdk\system-images\android-33\google_apis_playstore\x86_64\ramdisk.img.backup`
- Backup size: 1516994 bytes
- Backup modified: 04/28/2026 01:22:09

## ADB Devices

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe devices -l`

Exit code: `0`

```text
List of devices attached
emulator-5554          device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64x transport_id:15
```

## Build And Boot Props

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell getprop ...`

Exit code: `0`

```text
sdk=33
abi=x86_64
boot_completed=1
snapshot_loaded=
verified_boot=
selinux=Enforcing
```

## Magisk Packages

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell pm list packages | grep -i magisk`

Exit code: `0`

```text
<empty>
```

## su Probe

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell su -c id -u`

Exit code: `0`

```text
0
```

## Workdir Probe

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell ls -la /data/local/tmp/adb-gui-root`

Exit code: `0`

```text
<empty>
```

## Download Folder Root Artifacts

Command: `C:\Users\akila\OneDrive\Desktop\OSS\WindowsApps\adb-gui-next\src-tauri\resources\windows\adb.exe -s emulator-5554 shell ls -la /sdcard/Download`

Exit code: `0`

```text
<empty>
```

