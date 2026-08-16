# Progress

## Overall status

Fully functional Tauri 2 desktop app on **local `main`** (v**0.2.5**). Core features: device dashboard, wireless ADB, app manager + UAD debloat + APK icons, file explorer (root grant, hidden listing, open-in-editor), flasher, utilities (stacked Host/Device/Inspect/Danger + Windows Google host setup), **scrcpy** (official binaries, native window), payload dumper (local/remote/OPS/OFP/factory), marketplace (search-first + GitHub releases/README), emulator + Magisk root wizard, bottom logs/shell.

Packaging/CI: tauri-action multi-arch, official version path, portable-only custom script, multi-device debloat serial, single-instance, ACL split, view persistence, `persist-credentials: false` on checkout.

**Overhaul is merged into local `main`** (`5a6d3d5` + `540d152`). Same SHA as `feat/scrcpy-and-ui-overhaul`. **Not pushed.** v2 “Precision Instrument” UI later retinted to Neutral black/white is also on this HEAD (PR #1).

## Quality / CI (current)

| Item | State |
| --- | --- |
| Scripts | `lint:web` / `format:web` / `lint:rust` / `format:rust` / `format:check` / `lint` / `check` / `version:sync` |
| Pre-commit | Husky → lint-staged (Ultracite + rustfmt staged only) |
| CI detect | `dorny/paths-filter` → web / rust / packaging |
| CI quality | Split **quality-web** + **quality-rust** (path-gated; PRs always relevant side) |
| CI package | **main** + packaging-path changes; multi-arch Win/Linux; `tauri-action` + portable zip |
| Publish | Manual draft via tauri-action; notes file required; SHA256SUMS finalize |
| React Doctor | Target **100/100** (`npx react-doctor@latest .`) |
| Code signing | **Not used** |

## Major capabilities (done)

- FE layout: `src/app`, `src/desktop`, `src/features/*`, `src/shared`, `src/test`
- **11 views** code-split (`React.lazy` + `VIEW_PRELOADERS`), including Scrcpy
- Device-list poll 30s (`MainLayout`); AVD poll 5s (Emulator view); dashboard telemetry poll 15s (Dashboard only, stops on error)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote; ZIP64 CD extra parse tested
- Debloat SDK-aware + device-keyed cache + **explicit serial** IPC; backup restore wired (`RestoreDebloatBackup`)
- App icons: Rust `get_app_icons` + disk/memory cache; Installed apps tab via `useAppIcons`
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel + shell history stable ids
- File Explorer: thin view + hook composition; open allowlisted text in host editor; `ls -lA`
- Scrcpy: download/install/update/launch native process; CLI options only
- Utilities: typed host ADB restart/kill/versions; logcat snapshot; PNG screenshot; wipe phrase `WIPE`
- Windows host setup: official Google platform-tools + USB driver (separate UAC); `C:\Android\platform-tools`; HKLM system Path; `pnputil`; status from registry + driver enum
- Marketplace: Rust search/install; GitHub all-releases + README; browse toolbar filters
- Single-instance; ACL read/mutate permissions; active view localStorage
- Packaging: Win x86_64/i686/aarch64; Linux x86_64 + aarch64 (PATH tools on arm)

### v2 redesign (already on `main`)

- Design-token system in `global.css`: Neutral black/white (not chroma-tinted), four surface levels, 13px-base type scale (11px floor), motion + z-index tokens
- Self-hosted Inter + JetBrains Mono; Google Fonts removed from `index.html` **and** CSP
- Shell: Header (`VIEW_META` title + breadcrumb) → `ViewContent` (fluid width) → `StatusBar` → bottom-panel dock spacer
- ⌘K command palette + `shared/commands/` registry + `SHORTCUT_HELP`
- `operationStore` + `StatusBar` (App Manager wired)
- Dashboard on `get_device_telemetry`: identity / battery gauge / memory sparkline / storage / security / wireless
- Rust `src/adb/` — `AdbClient`, `shell_batch`, telemetry parsers; `release` profile `opt-level = 3`
- Confirmation gates on flash + sideload; charts hand-rolled SVG/CSS (no charting library)

## Known issues / gaps

| Item | Note |
| --- | --- |
| Windows `cargo test` | Prefer `--no-run` locally; Linux CI runs tests |
| Delta OTA | Limited incremental path; errors call out limitation |
| OPS stream decrypt | Deferred vs full-file OPS/OFP |
| Win aarch64 tools | Still PE x86 Google tools (emulation) |
| Scrcpy ARM | No official Genymobile ARM zip; PATH fallback |
| FE view-model size | Large orchestrator still allowlisted if arch-tested |
| macOS | Code/resources present; **builds paused** by product policy |
| `get_device_info` | Registered + permitted, **no frontend caller** left; keep or remove is undecided |
| `operationStore` coverage | App Manager only; flasher / payload / emulator / scrcpy use their own progress |
| `--content-max-width` | Token declared in `global.css`, no longer applied anywhere |
| Overhaul not on origin | Local `main` ahead of `origin/main` until push |
| GUI smoke | Overhaul not run inside the Tauri webview in that session |
| Marketplace catalog | Search-first; no F-Droid “home” browse without a query |
| Logcat | Snapshot only, not a live stream |
| Flasher wipe | Own confirm UI; does not send utilities `WIPE` phrase |
| Host setup smoke | Needs a rebuilt Windows app + UAC: Path in a new terminal, USB row vs Device Manager |
| Cargo.toml `[lints]` squiggle | Editor schema bug; `taplo.toml` disables Cargo.toml JSON schema |

## Changelog policy

No long session diaries here. Design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Status/gaps only in this file.

**Last updated:** 2026-08-17
