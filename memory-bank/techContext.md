# Tech Context

## Stack (from package / Cargo)

### Frontend

React 19 · TypeScript · Vite 8 · Tailwind v4 · shadcn/Radix · Zustand 5 · TanStack Query 5 · React Hook Form · Zod · Framer Motion · lucide · next-themes · sonner · TanStack Virtual · **cmdk** (⌘K palette) · **no charting library** · Tauri API 2.11 + dialog/opener/clipboard plugins · Bun **1.3.14**

**Why no charting library.** `freezePrototype: true` (`tauri.conf.json`) freezes `Object.prototype`, so any dependency that writes to a built-in prototype at module-evaluation time throws `TypeError` in strict mode and kills the whole view. Recharts was added and then removed for exactly this: its `decimal.js-light` does `Decimal.prototype.valueOf = …`. It never reproduces in `vite build`, Vitest or the browser preview — only inside the webview. **Vet every new frontend dependency for module-eval prototype writes.** All charts are hand-rolled SVG/CSS against the `chart-1..5` tokens.

**Adaptivity.** Container queries only — the window is pinned to `minWidth: 1024`, so `sm:`/`md:` can never evaluate false, and the content box tracks the sidebar (`16rem` ↔ `3rem`) rather than the viewport. See `docs/architecture.md` §12.1.

Fonts are **not** an npm runtime dep: Inter + JetBrains Mono variable woff2 are vendored into `public/fonts/` with their OFL texts, declared with `@font-face` in `global.css`, and preloaded from `index.html`.

### Backend

Rust 2024 · Tauri 2.11 · tokio · memmap2 · rayon · prost · zip/zstd/**liblzma**/bzip2 · flate2(zlib-rs) · optional brotli · sha1 · sha2 · reqwest(rustls) · aes/cfb-mode/md-5/quick-xml (OPS/OFP) · **tauri-plugin-single-instance**

`[profile.release]`: `opt-level = 3` · `lto = true` · `codegen-units = 1` · `panic = "abort"` · `strip = true`. The old `opt-level = "s"` and the separate `release-fast` profile are gone — the workload is CPU-bound, so `release` **is** the speed profile.

## Tooling

| Tool | Role |
| --- | --- |
| Ultracite (Biome) | FE lint + format |
| rustfmt / clippy | Rust format / lint (`-D warnings` in CI) |
| Vitest | FE tests in `src/test/` |
| Husky + lint-staged | Pre-commit staged fix only |
| GitHub Actions | path-filtered quality split; package on main; publish draft |
| tauri-action | Official installer build + release asset upload |
| `bun run version:sync` | Sync Cargo.toml version from package.json |

Commands: see `docs/project_rules.md` (source of truth for gates). Do not re-add removed aliases (`fix`, `lint:web:fix`, `check:fast`, `release:verify`).

## Layout (high level)

```text
public/
  fonts/        self-hosted Inter + JetBrains Mono woff2 (+ OFL texts)
src/
  app/          shell: MainLayout, viewConfig (lazy views), Header, AppSidebar,
                StatusBar, CommandPalette, BottomPanel
  desktop/      only invoke / events / models
  features/     product views (all React.lazy)
  shared/       commands/ (palette registry, VIEW_META, shortcuts), ui, components,
                stores, hooks (useAppReady, useGlobalShortcuts, usePersistedActiveView), utils
  styles/       global.css design tokens (palette, type scale, motion, z-index)
  test/         Vitest
src-tauri/
  commands/     thin IPC
  adb/          AdbClient (single adb spawn point) + telemetry + parse
  helpers.rs    binary, path safety, adb serial helpers (adb_shell_checked forwards to adb/)
  payload/ marketplace/ scrcpy/ emulator/ debloat/ utilities/ host_setup/ app_icons.rs
  resources/{windows,linux,darwin}/
  permissions/ + capabilities/
scripts/
  make-windows-portable.ps1   # only custom packaging helper for installers
  sync-cargo-version.mjs
  download-darwin-tools.ps1
  emulator-root-*.ps1
  README.md
```

Full design: `docs/architecture.md`.

## Versioning (official Tauri)

| Source | Role |
| --- | --- |
| `package.json` `version` | **App SoT** |
| `tauri.conf.json` `version` | `"../package.json"` |
| `Cargo.toml` `version` | Must match; `bun run version:sync` |

## Packaging facts agents forget

- Installers: **tauri-action** patterns `ADB-GUI-Next-v[version]-[platform]-[arch][setup][ext]`
- `[arch]` = rust triple prefix (`x86_64`, `i686`, `aarch64`)
- Portable: custom zip only (not a Tauri BundleType)
- Linux aarch64: **no** bundled platform-tools (empty resources conf)
- Win aarch64: app native; tools PE x86 + emulation
- macOS: conf/resources may exist; **builds paused**
- Code signing: **not used**
- Windows cargo test loader issue may block execution locally

## Security (current)

- Outbound URL validation + no auto-redirect on sensitive HTTP
- Extract: `safe_image_file_name`; transaction deletes registered files only
- Debloat: serial-keyed cache + explicit FE serial; fail closed on unknown SDK for Disable
- Marketplace install: owned temp path + selected serial
- Capabilities: `allow-device-read` + `allow-device-mutate` (not a single opaque allow-all in default cap)
- CSP: `font-src 'self'`, `style-src 'unsafe-inline' 'self'` — the Google Fonts allowances were removed when fonts were vendored
- Destructive flows gated by explicit confirmation dialogs (flash, sideload, wipe, uninstall, AVD backup restore); utilities wipe requires typing `WIPE`
- Scrcpy: official release assets + SHA256; no in-tree scrcpy source; outbound URL validation on GitHub hops
- Host setup: Google catalog hops re-validated; UAC for HKLM Path / `pnputil`; app ADB stays bundled

**Last updated:** 2026-08-17
