# Active Context

## Current State
A full codebase review was completed and the memory bank was rewritten to reflect the current repository state instead of incremental historical notes.

## Current Product Reality
ADBKit Enhanced is currently a feature-rich Android device utility desktop app with the following implemented areas:
- Dashboard
- App Manager
- File Explorer
- Flasher
- Utilities
- Payload Dumper
- Shell command runner
- About page
- Global logs panel

## Current Architectural Focus
The project centers on a Wails bridge between:
- a Go backend responsible for command execution, payload extraction, dialogs, and OS integration
- a React/Astro frontend responsible for the application shell, feature views, and user feedback

The most specialized subsystem is the payload dumper. The most reusable backend foundation is the command execution layer in `backend/executor.go`.

## Recently Confirmed Findings
- The frontend uses manual view switching inside `MainLayout` instead of a router.
- The app shell owns sidebar navigation, theme controls, logs access, and shell history.
- Payload extraction progress is event-driven through Wails runtime events.
- Global operational logging is implemented through a Zustand store and a dedicated log panel.
- Windows embedded binary usage is implemented in runtime resolution.
- Linux support exists, but standalone binary lookup behavior should be reviewed for parity with Windows expectations.
- The shell view is a command runner for `adb`, `adb shell`, and `fastboot`, not a full PTY terminal.

## Important Current Issues / Follow-up Candidates
- Review Linux standalone packaging/runtime binary resolution alignment.
- Review minor frontend correctness issues found during analysis, including the shell view scroll effect dependency.
- Keep documentation aligned with actual supported platforms and current architecture.

## Source-of-Truth Files for Understanding the App
- `main.go`
- `backend/app.go`
- `backend/executor.go`
- `backend/adb_service.go`
- `backend/fastboot_service.go`
- `backend/payload_service.go`
- `frontend/src/components/MainLayout.tsx`
- `frontend/src/components/views/ViewPayloadDumper.tsx`
- `frontend/src/lib/payloadDumperStore.ts`

## Current Documentation Work
- Core memory bank files have been refreshed from a full-repo review.
- A PRD is being created under `docs/` to document the product at a higher level.

## Next Likely Activities
- Use the new memory bank as the baseline for future implementation and review tasks.
- Expand docs if needed with architecture notes, developer onboarding, or testing guidance.
- Triage and fix issues discovered during the full analysis if requested.