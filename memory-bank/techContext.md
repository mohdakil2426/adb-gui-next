# Tech Context

## Stack (from package / Cargo)

### Frontend

React 19 · TypeScript 6 · Vite 8 · Tailwind v4 · shadcn/Radix · Zustand 5 · TanStack Query 5 · React Hook Form · Zod · Framer Motion · lucide · next-themes · sonner · TanStack Virtual · Tauri API 2.11 + dialog/opener/clipboard plugins · Bun 1.3.13

### Backend

Rust 2024 · Tauri 2.11 · tokio · memmap2 · rayon · prost · zip/zstd/**liblzma**/bzip2 · flate2(zlib-rs) · optional brotli · sha2 · reqwest(rustls) · aes/cfb-mode/md-5/quick-xml (OPS/OFP)

## Tooling

| Tool | Role |
| --- | --- |
| Ultracite (Biome) | FE lint + format |
| rustfmt / clippy | Rust format / lint (`-D warnings` in CI) |
| Vitest | FE tests in `src/test/` |
| Husky + lint-staged | Pre-commit staged fix only |
| GitHub Actions | quality always; package on main; publish workflow |

Commands: see `docs/project_rules.md` (source of truth for gates). Do not re-add removed script aliases (`fix`, `lint:web:fix`, `check:fast`, …).

## Layout (high level)

```text
src/
  app/          shell, MainLayout, view map
  desktop/      only invoke / events / models
  features/     product views
  shared/       ui, stores, utils
  styles/       global.css tokens
  test/         Vitest
src-tauri/
  commands/     thin IPC
  helpers.rs    binary, shell, path safety
  payload/ marketplace/ emulator/ debloat/
  resources/{windows,linux}/
  permissions/ + capabilities/
```

Full design: `docs/architecture.md`.

## Runtime facts agents forget

- Device poll: **30s** in `MainLayout` only (`STALE_TIME.ALL_DEVICES`)
- AVD poll: **5s** in Emulator view only
- App version: **0.2.5**
- Windows cargo test loader issue may block execution
- React Doctor residual cleanup is **deferred** (report: `docs/internal/reports/active/2026-07-18/`); do not re-open unless user asks

## Security (current)

- Outbound URL validation + no auto-redirect on sensitive HTTP (payload/market/Magisk pattern)
- Extract: `safe_image_file_name`; transaction deletes registered files only
- Debloat: serial-keyed cache; fail closed on unknown SDK for Disable
- Marketplace install: owned temp path + selected serial

**Last updated:** 2026-07-18
