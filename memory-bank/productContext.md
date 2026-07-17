# Product Context

## Why it exists

ADB/fastboot are powerful but awkward for repetitive work. This app is a local desktop toolbox: visual, faster, still power-user capable.

## Problems it solves

- Less repetitive CLI for device ops
- Clearer feedback for long/destructive workflows
- One place for package, file, flash, firmware, debloat, marketplace, emulator tasks
- OTA / OPS / OFP extract without a separate terminal toolchain

## UX goals

- Native-feeling Tauri desktop shell (sidebar views, no web router)
- Light / dark / system theme; semantic tokens; shared shadcn components
- Logs + shell in a VS Code–style bottom panel
- Viewport-locked layout (`h-svh`); pinned header; responsive, no horizontal overflow

## Boundaries

**In scope:** local ADB/fastboot, file transfer, packages, wireless ADB, payload/OPS/OFP (local + remote where implemented), marketplace installs, emulator AVD tools, Win/Linux packaging.

**Out of scope:** cloud multi-user, browser/Next.js deployment, device farms, macOS as a first-class product target.

## Version

0.2.5 — see `projectbrief.md`.
