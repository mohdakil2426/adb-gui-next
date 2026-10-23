# Active Context

## Current Focus

**2026-10-24 — Dependency bumps to latest versions, Root transfer permission fix, and A11y polish:**

- **Dependencies Upgrade:**
  - Upgraded frontend dependencies to latest versions (`@tauri-apps/api` 2.12.4, `@tauri-apps/cli` 2.12.4, `@biomejs/biome` 2.6.2, `@hookform/resolvers` 6.0.0, `framer-motion` / `motion` 14.6.0, `effect` 4.0.6, `lucide-react` 1.61.0, etc.).
  - Upgraded Rust backend dependencies (`tauri` 2.12.5, `tauri-build` 2.7.4, `comrak` 0.57.0, `scraper` 0.29.0, `proptest` 1.12.0, plus 55 transitive lock updates).
  - Cleaned all outdated dependencies (`bun outdated` is 100% clean).
- **Root Transfer Staging & Argument Quoting:**
  - Resolved `Operation not permitted` in root mode transfers caused by ADB unquoted argument splitting in `/system/bin/sh`.
  - Wrapped root commands in `su -c '<cmd>'` in `AdbClient::shell_checked` so multi-statement pipelines execute strictly as root UID 0.
  - Ensured root transfer staging uses `0777` permissions and in-place `cat` writes to preserve ownership and SELinux contexts.
- **A11y & Lint Standards:**
  - Fixed `prefer-string-replace-all` in `logs-panel.tsx`.
  - Replaced non-form header `<Label>` elements with semantic `<span>` in `target-device-selector.tsx` and `scrcpy-audio-tab.tsx`.
  - Refactored `FieldLabel` in `src/shared/ui/field.tsx` to `<LabelPrimitive.Root>` to eliminate linter false-positives without config suppressions.
- **Quality Gates Status:**
  - **Ultracite (Oxlint + Oxfmt):** 0 errors, all 476 files formatted and clean.
  - **TypeScript (`tsc --noEmit`):** 0 errors.
  - **Vitest:** 53 / 53 test files passed (350 / 350 tests).
  - **Rust Backend (`cargo check` & `cargo test --lib --no-run`):** Compiles and links cleanly.

**Last updated:** 2026-10-24
