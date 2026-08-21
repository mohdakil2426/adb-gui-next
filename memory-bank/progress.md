# Progress

## Overall status

Fully functional Tauri 2 desktop app on **local `main`** (v**0.2.5**). Core features: device dashboard, wireless ADB, app manager + UAD debloat + APK icons, file explorer (root grant, hidden listing, open-in-editor), flasher, utilities (stacked Host/Device/Inspect/Danger + Windows Google host setup), **scrcpy** (official binaries, native window), payload dumper (local/remote/OPS/OFP/factory), marketplace (search-first + GitHub releases/README) with **GitHub APK/APKS filter + trending explore (Komi Store port)**, emulator + Magisk root wizard, bottom logs/shell.

**2026-08-21 — Dashboard Vitals Equal-Height Alignment & Full Consistency:**
- **PanelCard Architecture:** Fixed `PanelCard` `<m.div className="flex h-full flex-col">` and `<Card className="flex h-full flex-1 flex-col justify-between...">` with `CardContent` `flex flex-1 flex-col justify-between` to ensure 100% height fill across CSS Grid items.
- **Top Section Balance (~110-120px):** Battery 120px radial gauge, Memory usage bar + compact `h-9` sparkline waveform, Storage 2 streamlined volume rows.
- **Bottom 2x2 Micro-Metrics Alignment:** Battery (`TEMP`, `VOLTAGE`, `STATUS`, `HEALTH`), Memory (`USED`, `AVAILABLE`, `FREE`, `TOTAL`), Storage (`CAPACITY`, `USED`, `FREE`, `VOLUMES`) anchored to the exact same baseline with identical borders and spacing.
- **Validation:** Ultracite (466 files, 0 errors), TypeScript (`tsc` 0 errors), Vite Build (clean in 2.92s), Vitest (48/48 files passed, 285/285 tests passed), Cargo check (0 errors). Zero commits made per instruction.

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | lint:web / format:web / lint:rust / format:rust / format:check / lint / check / version:sync |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt staged only) |
| CI detect | dorny/paths-filter → web / rust / packaging |
| CI quality | Split quality-web + quality-rust (path-gated; PRs always relevant side) |
| CI package | main + packaging-path changes; multi-arch Win/Linux; tauri-action + portable zip |
| Publish | Manual draft via tauri-action; notes file required; SHA256SUMS finalize |
| React Doctor | 100/100 (bunx react-doctor@latest) |
| ShadScan | 79/100 (bunx @shadscan/cli) |
| Code signing | Not used |

**Last updated:** 2026-08-21
