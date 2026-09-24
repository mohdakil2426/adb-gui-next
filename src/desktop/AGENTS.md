# Desktop IPC Module Guide

`src/desktop/` is the sole desktop IPC gateway for ADB GUI Next (`backend.ts`, `effect.ts`, `errors.ts`, `runtime.ts`, `models.ts`). Parent: `src/AGENTS.md`.

## Architecture & Invariants

- Strict isolation: features must never call raw `@tauri-apps/api/core` or event APIs directly.
- DTOs in `models.ts` mirror Rust backend `camelCase` serialization.
- Typed error taxonomy: `errors.ts` defines typed domain errors via `Schema.TaggedError` (`DeviceNotFoundError`, `DeviceUnauthorizedError`, `AdbCommandError`, `IpcInvokeError`, `OperationCancelledError`).
- Effect IPC execution: `effect.ts` wraps Tauri commands into composable `Effect.Effect<T, DesktopError>` programs, supporting cooperative fiber interruption and resilient retries.
## Rules & Traps (Ponytail Ultra Format)

- **Wrong:** accessing `event.payload` when listening via `EventsOn`.
  **Right:** unpack payload directly `(payload) => ...` because `EventsOn` unboxes the Tauri event envelope automatically.
  **Id:** Desktop EventsOn payload unwrapping
- **Wrong:** passing arbitrary URI schemes or shell commands to `BrowserOpenURL`.
  **Right:** strictly enforce `http:` / `https:` validation before calling `@tauri-apps/plugin-opener`.
  **Id:** Desktop safe browser URL opening
