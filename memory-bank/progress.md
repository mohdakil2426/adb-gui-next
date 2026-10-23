# Progress

## Overall status

Fully functional Tauri 2 desktop app on **local `main`** (v**0.2.5**). Core features: device dashboard, wireless ADB, app manager + UAD debloat + APK icons, file explorer (root grant, hidden listing, open-in-editor), flasher, utilities (stacked Host/Device/Inspect/Danger + Windows Google host setup), **scrcpy** (official binaries, native window), payload dumper (local/remote/OPS/OFP/factory), marketplace (search-first + GitHub releases/README) with **GitHub APK/APKS filter + trending explore (Komi Store port)**, emulator + Magisk root wizard, bottom logs/shell.

**2026-10-24 — Latest Dependency Bumps & Quality Gates:**

- **Dependencies:** All frontend and backend dependencies updated to latest releases (`bun outdated` clean; Tauri 2.12.5 backend / 2.12.4 CLI & API).
- **File Explorer Root Mode:** Fixed root transfer staging permissions (`0777`) and single-quoted `su -c` execution preventing unprivileged splitting by Android shell.
- **UI & A11y:** Restored clean centered border UI for file creation/renaming; resolved a11y label semantics across scrcpy and field primitives.
- **Validation:** Oxlint (0 errors, 476 files clean), `tsc` (0 errors), Vitest (53/53 files, 350/350 tests), Cargo check (0 errors).

| Item         | State                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------- |
| Scripts      | lint:web / format:web / lint:rust / format:rust / format:check / lint / check / version:sync |
| Pre-commit   | Husky → lint-staged (Ultracite + rustfmt staged only)                                        |
| CI detect    | dorny/paths-filter → web / rust / packaging                                                  |
| CI quality   | Split quality-web + quality-rust (path-gated; PRs always relevant side)                      |
| CI package   | main + packaging-path changes; multi-arch Win/Linux; tauri-action + portable zip             |
| Publish      | Manual draft via tauri-action; notes file required; SHA256SUMS finalize                      |
| React Doctor | 100/100 (bunx react-doctor@latest)                                                           |
| ShadScan     | 79/100 (bunx @shadscan/cli)                                                                  |
| Code signing | Not used                                                                                     |

**Last updated:** 2026-10-24
