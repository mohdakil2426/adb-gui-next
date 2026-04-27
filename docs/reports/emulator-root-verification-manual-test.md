# Emulator Root Verification Manual Test Report

Date:
Tester:
Build:

## Scope

Verify that the Emulator Manager root workflow distinguishes "patch installed" from "root verified" and only reports verified root after `su -c id -u` returns `0` after cold boot.

## Test Matrix

| AVD | API | ABI | Image Type | Magisk Version | Expected | Result | Notes |
|---|---:|---|---|---|---|---|---|
| Pixel API 29 | 29 | x86/x86_64 | google_apis_playstore | latest stable | Root verified after cold boot | Not run | |
| Pixel API 30/31 | 30/31 | x86_64 | google_apis_playstore | latest stable | Auto pipeline blocks multi-CPIO or verifies root | Not run | |
| Pixel API 34+ | 34+ | x86_64 | google_apis_playstore | Magisk 26+ | Patch installed, verify after cold boot | Not run | |

## Procedure

1. Launch AVD with Cold Boot and no snapshot save.
2. Run root preflight and confirm all blocking checks pass.
3. Start automated root.
4. Confirm result page says "Patch Installed", not "Root Successful".
5. Click Cold Boot Emulator.
6. Wait for home screen and `sys.boot_completed=1`.
7. Click Verify Root.
8. Confirm verified success only if `adb shell su -c id -u` returns `0`.
9. Open Magisk Manager and complete Additional Setup if prompted.
10. Reboot and verify root again.

## Raw Commands

```bash
adb devices
adb -s <serial> shell getprop sys.boot_completed
adb -s <serial> shell pm list packages | grep -i magisk
adb -s <serial> shell su -c id -u
```

## Results

### API 29

- Status:
- `su -c id -u` output:
- Magisk package:
- Notes:

### API 30/31

- Status:
- `su -c id -u` output:
- Magisk package:
- Notes:

### API 34+

- Status:
- `su -c id -u` output:
- Magisk package:
- Notes:
