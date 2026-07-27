# Progress

## Overall status

Fully functional Tauri 2 desktop app on `main` (v**0.2.5**). Core features shipped: device dashboard, wireless ADB, app manager + UAD debloat, file explorer (incl. root grant), flasher, utilities, payload dumper (local/remote/OPS/OFP/factory), marketplace, emulator + Magisk root wizard, bottom logs/shell.

Packaging/CI overhaul landed and pushed: tauri-action multi-arch, official version path, portable-only custom script, multi-device debloat serial, single-instance, ACL split, view persistence.

**In flight (branch `feat/ui-ux-reimagine-v2`, not merged as of 2026-07-27):** the "Precision Instrument" UI/UX reimagine, ~259 files. See `memory-bank/activeContext.md` for the decision list.

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
- Device-list poll 30s (`MainLayout`); AVD poll 5s (Emulator view); dashboard telemetry poll 15s (Dashboard only, stops on error)
- Payload streaming/mmap, cancel, remote progress, factory ZIP remote; ZIP64 CD extra parse tested
- Debloat SDK-aware + device-keyed cache + **explicit serial** IPC; backup restore wired end-to-end (`RestoreDebloatBackup`)
- Emulator root: preflight, autopilot + FAKEBOOTIMG, `su -c id -u == 0` verify
- Bottom panel + shell history stable ids
- File Explorer: thin view + hook composition under `useFileExplorerViewModel`
- Single-instance; ACL read/mutate permissions; active view localStorage
- Packaging: Win x86_64/i686/aarch64; Linux x86_64 + aarch64 (PATH tools on arm)

### v2 redesign (branch `feat/ui-ux-reimagine-v2`)

- Design-token system in `global.css`: "Precision Instrument" oklch palette, four surface levels, 13px-base type scale (11px floor), motion + z-index tokens
- Self-hosted Inter + JetBrains Mono; Google Fonts removed from `index.html` **and** CSP
- All 9 views code-split (`React.lazy` + `VIEW_PRELOADERS`); entry chunk 192.87 kB (from 565.86 kB)
- Shell: Header (`VIEW_META` title + breadcrumb) → `ViewContent` (fluid width) → `StatusBar` → bottom-panel dock spacer; `paddingBottom` hack removed
- ⌘K command palette + `shared/commands/` registry + `SHORTCUT_HELP` keyboard reference
- `operationStore` + `StatusBar` operation surface (App Manager wired)
- Dashboard rebuilt on `get_device_telemetry`: identity / battery gauge / memory sparkline / storage / security / wireless panels
- Rust `src/adb/` — `AdbClient`, `shell_batch`, telemetry parsers; `release` profile back to `opt-level = 3`
- Confirmation gates on flash + sideload; charts hand-rolled SVG/CSS (no charting library)

## Known issues / gaps

| Item | Note |
| --- | --- |
| Windows `cargo test` | Prefer `--no-run` locally; Linux CI runs tests |
| Delta OTA | Limited incremental path; errors call out limitation |
| OPS stream decrypt | Deferred vs full-file OPS/OFP |
| Win aarch64 tools | Still PE x86 Google tools (emulation) |
| FE view-model size | Large orchestrator still allowlisted if arch-tested |
| macOS | Code/resources present; **builds paused** by product policy |
| First multi-arch CI | Confirm arm runners + tauri-action artifact name tokens in Actions UI |
| v2 branch unmerged | `feat/ui-ux-reimagine-v2` still needs review + merge to `main` |
| `get_device_info` | Registered + permitted, **no frontend caller** left; keep or remove is undecided |
| `operationStore` coverage | App Manager only; flasher / payload / emulator still on their own progress UI |
| `--content-max-width` | Token declared in `global.css`, no longer applied anywhere |

## Changelog policy

No long session diaries here. Design → `docs/architecture.md`. Investigations → `docs/internal/reports/`. Status/gaps only in this file.

**Last updated:** 2026-07-27
