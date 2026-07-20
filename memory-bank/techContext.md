# Tech Context

## Stack (from package / Cargo)

### Frontend

React 19 · TypeScript · Vite 8 · Tailwind v4 · shadcn/Radix · Zustand 5 · TanStack Query 5 · React Hook Form · Zod · Framer Motion · lucide · next-themes · sonner · TanStack Virtual · Tauri API 2.11 + dialog/opener/clipboard plugins · Bun **1.3.14**

### Backend

Rust 2024 · Tauri 2.11 · tokio · memmap2 · rayon · prost · zip/zstd/**liblzma**/bzip2 · flate2(zlib-rs) · optional brotli · sha2 · reqwest(rustls) · aes/cfb-mode/md-5/quick-xml (OPS/OFP) · **tauri-plugin-single-instance**

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
src/
  app/          shell, MainLayout, view map
  desktop/      only invoke / events / models
  features/     product views
  shared/       ui, stores, utils, hooks (e.g. usePersistedActiveView)
  styles/       global.css tokens
  test/         Vitest
src-tauri/
  commands/     thin IPC
  helpers.rs    binary, shell, path safety, adb serial helpers
  payload/ marketplace/ emulator/ debloat/
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

**Last updated:** 2026-07-20
