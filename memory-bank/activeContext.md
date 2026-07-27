# Active Context

## Current state

ADB GUI Next is a working Tauri 2 app, version **0.2.5**. Agent docs: root `AGENTS.md` router + `src/AGENTS.md` / `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`. Reports: `docs/internal/reports/`.

**Current focus: the "Precision Instrument" UI/UX reimagine (v2), on branch `feat/ui-ux-reimagine-v2` — not yet merged to `main`.** ~259 files touched across frontend and backend. Plan: `docs/superpowers/plans/2026-07-26-ui-ux-reimagine-v2.md`. Audit: `docs/internal/reports/active/2026-07-26/2026-07-26-full-stack-redesign-audit.md`. The plan describes intent; the docs above describe what shipped.

### Verified on 2026-07-26/27

Full build passes (entry chunk **192.87 kB** vs 565.86 kB baseline) · 226 Vitest tests pass · `cargo clippy -D warnings` clean · `cargo fmt` clean · `cargo test --no-run` links · fonts genuinely self-hosted, no Google Fonts in HTML or CSP · no sub-11px type · flash/sideload gated behind confirmation · `RestoreDebloatBackup` wired · `get_device_telemetry` batches 9 commands into 1 adb process.

## Durable decisions from the v2 redesign

| Area | Decision |
| --- | --- |
| **Design system** | "Precision Instrument": oklch neutrals tinted blue (hue 250), single electric-cyan accent (hue 210), four surface levels (`canvas`/`surface`/`surface-raised`/`surface-overlay`), status colours reserved for **device** state. All tokens in `src/styles/global.css`. |
| **Type scale** | 13px base (`text-body`); `display` 24 / `title` 17 / `label` 12 / `caption` 11 / `mono` 12 / `mono-sm` 11. Each token carries its own line-height, tracking, weight. **11px floor.** `numeric` utility for any updating value. |
| **Fonts** | Self-hosted variable Inter + JetBrains Mono in `public/fonts/` (OFL texts shipped), preloaded in `index.html`. CSP tightened to `font-src 'self'` / `style-src 'unsafe-inline' 'self'`. |
| **Code splitting** | All 9 views are `React.lazy`; `ViewContent` owns the single `<Suspense>`; `VIEW_PRELOADERS` warm chunks on sidebar hover/focus. |
| **Shell layout** | Column: Header (44px) → `ViewContent` (`flex-1 min-h-0`) → `StatusBar` (26px) → bottom-panel **dock spacer**. `BottomPanel` is still `position: fixed`; the dock replaces the old `paddingBottom` hack. `ViewContent` is fluid width — the 1280px cap is gone. |
| **Command palette** | ⌘/Ctrl+K over `shared/commands/` registry (actions · navigate · devices) + a real keyboard-shortcut reference. `command`/`cmdk` and `kbd` re-added with genuine call sites. |
| **Status bar + operations** | `operationStore` (never persisted) is the home for long-running work; `StatusBar` renders it. Wired from App Manager so far. |
| **Query defaults** | `staleTime` 30 s, `retry: false`, `refetchOnWindowFocus: false` — every query spawns a subprocess. |
| **Rust `adb/` module** | `AdbClient` is the single `adb` spawn point: path resolved once per process, one exit-marker implementation, `shell_batch` for N reads in one process. `helpers::adb_shell_checked` is now a forwarder. |
| **Device telemetry** | `get_device_telemetry` returns typed numbers (identity/battery/memory/storage/security/network/uptime) in one round-trip; formatting moved to the frontend. |
| **Release profile** | `opt-level = 3` (was `"s"`); the separate `release-fast` profile deleted. |
| **Charts** | **No charting library.** All charts hand-rolled SVG/CSS against `chart-1..5`. Recharts was added then removed — its `decimal.js-light` writes `Decimal.prototype.valueOf` at import, which throws under `freezePrototype: true` and crashed Dashboard + App Manager. |
| **Adaptivity** | Container queries (`@container` on `ViewContent`), never `sm:`/`md:` — window `minWidth` is 1024 so viewport breakpoints are permanently on, and content width tracks the sidebar. |

## Open / deferred

- **Branch not merged.** `feat/ui-ux-reimagine-v2` still needs review + merge to `main`.
- `get_device_info` is registered and permitted but has **no frontend caller** (Dashboard uses telemetry + `legacyDeviceInfo`). Decide: keep as public IPC or remove.
- `operationStore` covers App Manager only; flasher, payload extraction and AVD launch still use their own progress UI/toasts.
- `--content-max-width` token still declared in `global.css` but unused after the fluid-width change.
- OPS **stream** decrypt (full-file OPS/OFP exists)
- Delta OTA full "real work" (clearer errors only for now)
- Native Win aarch64 platform-tools (currently PE x86 + emulation)
- Windows local `cargo test` loader `0xc0000139` — use `--no-run`; Linux CI executes

## Session lessons (keep)

| Never | Do instead |
| --- | --- |
| Triple-sync version with custom verify script | package.json SoT + conf path + Cargo via `version:sync` |
| Full collect-release renamer for installers | tauri-action naming patterns |
| Ship Linux aarch64 with x86_64 bundled adb | Empty resources conf + PATH tools |
| `setState` side effects inside functional updaters | Pure updater only |
| Parallel multi-APK install on one device | Serial install/uninstall |
| Reintroduce macOS as shipped without explicit unpause | Policy in `docs/project_rules.md` |
| Ship `opt-level = "s"` for CPU-bound work (sha2, decompression, memcpy) | `opt-level = 3` in `[profile.release]`; no separate speed profile |
| Subscribe the shell root to a per-log-line counter (`logStore.unreadCount`) | Isolated leaf subscriber (`UnreadLogBadge` / `UnreadLogAnnouncer`) |
| Let a static **value** import cross a `React.lazy` boundary | `import type`, or hoist the value into `shared/` — otherwise the chunk rejoins the entry bundle |
| High-frequency writes into a `zustand/persist` store | Sibling non-persisted store (`payloadProgressStore`, `memoryHistoryStore`) |
| Re-resolve the adb binary path on every spawn / hand-roll exit markers | `adb::AdbClient` (`OnceLock` path, one marker implementation, `shell_batch`) |
| Return pre-formatted display strings from Rust | Typed numbers; format in the frontend (`shared/utils/format.ts`) |
| Fixed-duration fake splash progress | `useAppReady()` — `document.fonts.ready` + one frame, 2 s ceiling |
| Add a frontend dep that writes a built-in prototype at import (`recharts` → `decimal.js-light`) | Vet for module-eval prototype writes — `freezePrototype: true` turns them into a `TypeError` that kills the view, and it reproduces **only** in the webview |
| `sm:`/`md:` viewport breakpoints | Container queries — `minWidth` is 1024 so they can never be false, and content width tracks the sidebar, not the viewport |
| Trust `df`'s "Mounted on" column to say which path a row describes | Query one path per `df` call and label by the path *you* asked for; dedup by `(Filesystem, size)` |
| Pair unrelated panels in a CSS grid row to fill columns | Group by meaning — a grid row is always as tall as its tallest cell, so mismatched neighbours create dead space regardless of `items-start` |
| Load fonts from a CDN | Self-host in `public/fonts/`; keep CSP at `font-src 'self'` |
| `paddingBottom` compensation for the fixed bottom panel | `shrink-0` dock spacer in the flex column |

## Next steps

- Review and merge `feat/ui-ux-reimagine-v2`; watch the first CI package run afterwards
- Manual smoke: installers + portable + multi-device debloat + dashboard telemetry on real hardware
- Decide the fate of `get_device_info` and `--content-max-width`
- Extend `operationStore` to flasher / payload / emulator
- Only unpause macOS on explicit product request

**Last updated:** 2026-07-27
