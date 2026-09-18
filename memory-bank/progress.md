# Progress

## Overall status

Fully functional Tauri 2 desktop app on **local `main`** (v**0.2.5**). Core features: device dashboard, wireless ADB, app manager + UAD debloat + APK icons, file explorer (root grant, hidden listing, open-in-editor), flasher, utilities (stacked Host/Device/Inspect/Danger + Windows Google host setup), **scrcpy** (official binaries, native window), payload dumper (local/remote/OPS/OFP/factory), marketplace (search-first + GitHub releases/README) with **GitHub APK/APKS filter + trending explore (Komi Store port)**, emulator + Magisk root wizard, bottom logs/shell.

**2026-09-18 — Ultracite Oxlint + Oxfmt Migration & Curated Tools Removal:**

- **Marketplace:** Removed Curated Open-Source Android Power Tools grid, backend Tauri command, service logic, test, and permissions entries.
- **Linter & Formatter:** Replaced Biome with Ultracite Oxlint + Oxfmt (`printWidth: 100`, ignoring docs, .agents, .github, memory-bank, src-tauri).
- **Code Quality:** Resolved all TypeScript strict null / property types / no-implicit-returns, empty functions, and Vitest async expect rules without rule suppression.
- **Validation:** Full verification passed — Oxlint (0 errors), Ultracite check (0 issues), tsc (0 errors), Vitest (48/48 files passed, 324/324 tests), Vite build (clean), Cargo check (0 errors).
## Quality / CI (current)

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

**Last updated:** 2026-08-21
