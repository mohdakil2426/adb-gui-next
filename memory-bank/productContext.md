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
- Light / dark / system theme; **shadcn Neutral** (white canvas / true-black canvas); semantic tokens; shared shadcn components
- Logs + shell in a VS Code–style bottom panel
- Viewport-locked layout (`h-svh`); pinned header; **container-query** adaptivity (window `minWidth` 1024 — never `sm:`/`md:`)
- Active view remembered across reloads (localStorage, not URL routing)
- Single app instance (second launch focuses existing window)
- Native-feeling Tauri desktop shell (sidebar views, no web router)
- Light / dark / system theme; **shadcn Neutral** (white canvas / true-black canvas); semantic tokens; shared shadcn components
- Logs + shell in a VS Code–style bottom panel
- Viewport-locked layout (`h-svh`); pinned header; **container-query** adaptivity (window `minWidth` 1024 — never `sm:`/`md:`)
- Active view remembered across reloads (localStorage, not URL routing)
- Single app instance (second launch focuses existing window)
- Device screen mirror via **official scrcpy**, launched as its own native process
- Windows host can install official Google platform-tools and the USB driver without wrapping third-party setup EXEs

## Boundaries

**In scope:** local ADB/fastboot, file transfer, packages, wireless ADB, payload/OPS/OFP (local + remote where implemented), marketplace installs, official scrcpy host (download/launch, no fork of scrcpy source), emulator AVD tools, Win/Linux multi-arch packaging (unsigned).

**Out of scope:** cloud multi-user, browser/Next.js deployment, device farms. **macOS:** implementation may exist; product **builds paused** until explicitly unpaused. **Code signing:** not used.

## Version

0.2.5 — SoT `package.json` (see `projectbrief.md` / `docs/project_rules.md`).

**Last updated:** 2026-08-17
