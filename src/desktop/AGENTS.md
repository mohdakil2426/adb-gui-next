# Desktop IPC Module Guide

`src/desktop/` is the sole desktop IPC gateway for ADB GUI Next (`backend.ts`, `runtime.ts`, `models.ts`). Parent: `src/AGENTS.md`.

## Architecture & Invariants

- Strict isolation: features must never call raw `@tauri-apps/api/core` or event APIs directly.
- DTOs in `models.ts` mirror Rust backend `camelCase` serialization.

## Rules & Traps (Ponytail Ultra Format)

- **Wrong:** accessing `event.payload` when listening via `EventsOn`.
  **Right:** unpack payload directly `(payload) => ...` because `EventsOn` unboxes the Tauri event envelope automatically.
  **Id:** Desktop EventsOn payload unwrapping
- **Wrong:** passing arbitrary URI schemes or shell commands to `BrowserOpenURL`.
  **Right:** strictly enforce `http:` / `https:` validation before calling `@tauri-apps/plugin-opener`.
  **Id:** Desktop safe browser URL opening
