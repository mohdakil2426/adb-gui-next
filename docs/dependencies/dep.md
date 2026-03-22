## ✅ Frontend

- **@tanstack/react-query v5** — Confirmed React 19 compatible (v18+), latest v5.94.5,
  actively maintained. Ideal for wrapping Tauri invoke() calls with
  loading/error/cache states.
- **zod** — Stable, no issues with React 19. Best for input validation
  (IP address, port, custom ADB commands).
- **react-hook-form** — Confirmed works with React 19. Best paired with zod
  for form validation.

## ✅ Tauri Plugins

All confirmed active and stable on v2.x as of 2025:

- **@tauri-apps/plugin-shell** — Required for spawning ADB subprocesses from
  the frontend side.
- **@tauri-apps/plugin-notification** — Stable at v2.2.2+. Useful for notifying
  when long ADB operations complete.
- **@tauri-apps/plugin-clipboard-manager** — Stable at v2.3.2. One-click copy
  for device info and ADB commands.
- **@tauri-apps/plugin-process** — Stable at v2.3.1. Provides exit() and
  relaunch() API for app restart on settings change.

## ✅ Rust

- **tracing + tracing-subscriber** — 387M+ downloads, maintained by the Tokio
  team. Clearly superior to the log crate for async applications. 2025 standard.
- **regex** — Battle-tested. Standard choice for parsing ADB command output
  (device info, logcat filtering).
- **tokio** (full features) — Already used under Tauri internally. Explicitly
  adding it gives you direct access to async process spawning and task management.

## ⚠️ Dev Tooling

- **vitest + @testing-library/react** — ✅ Fully confirmed with React 19 +
  Vite 8. Standard testing setup in 2025.
- **@biomejs/biome** — ⚠️ Has a caveat: Biome does not have an equivalent
  for eslint-plugin-react-hooks exhaustive-deps rule. Your current ESLint
  setup provides hooks dependency warnings that would be lost if you migrate
  to Biome. Keep it optional for now, do not migrate.