# Tech Context

## Core Stack

### Frontend

| Package | Version | Notes |
|---------|---------|-------|
| React | ^19.2.4 | Latest |
| TypeScript | ^6.0.2 | Latest stable |
| Vite | ^8.0.1 | Latest |
| Tailwind CSS | ^4.2.2 | CSS-first config (v4) |
| Zustand | ^5.0.12 | State management |
| TanStack Query | ^5.94.5 | Server state + device polling |
| React Hook Form | ^7.72.0 | Form state management |
| Zod | ^4.3.6 | Schema validation |
| Framer Motion | ^12.38.0 | Animations |
| Radix UI | Various | shadcn primitives (incl. tabs) |
| lucide-react | ^1.7.0 | Icons |
| next-themes | ^0.4.6 | Light/dark/system theme |
| sonner | ^2.0.7 | Toast notifications |
| @tauri-apps/api | ^2.10.1 | Tauri frontend API |
| @tanstack/react-virtual | ^3.13.23 | Virtualized list rendering |
| @tauri-apps/plugin-dialog | ^2.6.0 | Native dialogs |
| @tauri-apps/plugin-opener | ^2.5.3 | URL/file opener |
| @tauri-apps/plugin-clipboard-manager | ^2.3.2 | Clipboard read/write |

### Backend

| Package | Version | Notes |
|---------|---------|-------|
| Tauri | 2.x | Desktop framework |
| tauri-plugin-log | 2.x | Structured logging |
| tauri-plugin-dialog | 2.6.0 | Native dialogs |
| tauri-plugin-opener | 2.5.3 | URL/file opener |
| tauri-plugin-clipboard-manager | 2.3.2 | Clipboard read/write |
| tokio | 1.x | Async runtime (block_in_place for extraction, macros for join!) |
| log | 0.4 | Logging facade |
| Prost | 0.14 | Protobuf (payload manifest) |
| memmap2 | 0.9 | Zero-copy memory-mapped payload reading |
| rayon | 1.10 | CPU-parallel partition extraction |
| zip | 8.3.1 | ZIP archive handling |
| zstd | 0.13 | Zstandard decompression |
| xz2 | 0.1 | XZ decompression |
| bzip2 | 0.6 | Bzip2 decompression |
| sha2 | 0.10 | SHA-256 checksums |
| serde | 1.x | Serialization |
| serde_json | 1.x | JSON handling |
| which | 8.x | Binary lookup |
| tempfile | 3.x | Streaming ZIP extraction to temp files |
| urlencoding | 2.x | URL/form encoding for marketplace API queries + GitHub device-flow requests |
| url | 2.x | URL parsing + SSRF prevention (private IP blocklist) |
| anyhow | 1.x | Error handling |
| reqwest | 0.13 | HTTP client with `rustls`, `stream`, `http2`, `blocking`, `json` features (default feature: remote_zip) |
| futures-util | 0.3 | Async utilities (default feature: remote_zip) |
| aes | 0.8 | AES-128 block cipher (OFP firmware decryption) |
| cfb-mode | 0.8 | CFB stream cipher mode (OFP-QC/MTK AES decryption) |
| md-5 | 0.10 | MD5 digest (OFP key derivation) |
| quick-xml | 0.37 | XML parsing (OPS manifest parsing) |
| apk-info-axml | 1.0.11 | Android AXML + `resources.arsc` parsing for installed-app icon extraction |
| base64 | 0.22 | Encodes extracted raster app icons as frontend data URLs |
| sanitize-filename | 0.6 | Sanitizes user-provided filenames to prevent path traversal and reserved name conflicts |

## Tooling

### Frontend

| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | ^10.0.3 | Linting (flat config) |
| Prettier | ^3.8.1 | Formatting |
| @vitejs/plugin-react | ^6.0.1 | React support |
| @tailwindcss/vite | ^4.2.2 | Tailwind v4 plugin |
| @eslint/js | ^10.1.0 | ESLint core |
| @types/node | ^25.5.0 | TypeScript definitions for Node.js |
| typescript-eslint | ^8.57.1 | TypeScript linting |
| eslint-config-prettier | ^10.1.8 | ESLint/Prettier integration |
| eslint-plugin-react-hooks | ^7.0.1 | React hooks linting |
| eslint-plugin-react-refresh | ^0.5.2 | React refresh linting |
| tw-animate-css | ^1.4.0 | Tailwind animations |

### Backend

| Tool | Version | Purpose |
|------|---------|---------|
| cargo clippy | 0.1.94 | Rust linting |
| cargo fmt | 1.8.0-stable | Rust formatting |
| prost-build | 0.14 | Protobuf compilation |
| tauri-build | 2.x | Tauri build |
| protoc-bin-vendored | 3.x | Protobuf compiler |

### Build

| Tool      | Purpose         |
|-----------|-----------------|
| Bun       | Package manager |
| Cargo     | Rust build      |
| Tauri CLI | Desktop build   |

## Important Files

```text
├── package.json                  # Frontend deps + scripts
├── vite.config.ts                # Vite config with Tailwind plugin
├── tsconfig.json                 # TypeScript config (strict mode, `paths` alias without `baseUrl`)
├── eslint.config.mjs             # ESLint flat config
├── .prettierrc.json              # Prettier config
├── components.json               # shadcn/ui config (aliases primitives to src/shared/ui)
├── rustfmt.toml                  # Rust formatting (edition 2024)
├── src/
│   ├── main.tsx                  # Vite/Tauri bootstrap only
│   ├── app/                      # App root and no-router shell
│   ├── desktop/                  # Tauri backend/runtime/models boundary
│   ├── shared/                   # Cross-feature UI, components, stores, hooks, utils
│   │   ├── ui/                   # 35+ shadcn primitives
│   │   ├── components/           # Reusable app components
│   │   ├── stores/               # Cross-feature Zustand stores
│   │   └── utils/                # cn, formatting, error/device helpers
│   ├── features/                 # Product feature modules
│   │   ├── dashboard/
│   │   ├── app-manager/
│   │   ├── file-explorer/
│   │   ├── flasher/
│   │   ├── utilities/
│   │   ├── payload-dumper/
│   │   ├── marketplace/
│   │   ├── emulator/
│   │   └── about/
│   └── styles/
│       └── global.css            # Tailwind v4 config + theme + terminal tokens
└── src-tauri/
    ├── Cargo.toml                # Rust deps (edition 2024)
    ├── src/
    │   ├── lib.rs                # Thin orchestrator (~95 lines)
    │   ├── app_icons.rs          # Installed APK icon extraction helpers (AXML/ARSC + raster fallback)
    │   ├── helpers.rs            # Shared utilities
    │   ├── commands/             # 9 command modules
    │   │   ├── mod.rs
    │   │   ├── device.rs
    │   │   ├── adb.rs
    │   │   ├── fastboot.rs
    │   │   ├── files.rs
    │   │   ├── apps.rs
    │   │   ├── system.rs
    │   │   ├── payload.rs
    │   │   └── marketplace.rs    # App marketplace command wrappers (search, detail, download, install, trending, versions)
    │   ├── marketplace/       # 4 provider modules + shared types
    │   │   ├── mod.rs, types.rs  # Shared DTOs, HTTP client
    │   │   ├── fdroid.rs, izzy.rs  # F-Droid + IzzyOnDroid providers
    │   │   ├── github.rs        # GitHub-Store model (search + releases + APK filter)
    │   │   └── aptoide.rs       # Aptoide ws75 API (TRUSTED-only, OBB skip)
    │   ├── payload/              # OTA payload parser + OPS/OFP firmware
    │   │   ├── mod.rs
    │   │   ├── parser.rs
    │   │   ├── extractor.rs
    │   │   ├── zip.rs
    │   │   ├── http.rs
    │   │   ├── http_zip.rs
    │   │   ├── remote.rs
    │   │   ├── tests.rs
    │   │   └── ops/             # OPS/OFP firmware support (9 files)
    │   │       ├── mod.rs, detect.rs, crypto.rs, sbox.bin
    │   │       ├── ops_parser.rs, ofp_qc.rs, ofp_mtk.rs
    │   │       ├── sparse.rs, extractor.rs
    │   └── generated/            # Protobuf types
    ├── build.rs                  # prost-build + tauri-build
    ├── tauri.conf.json           # Main Tauri config
    ├── tauri.windows.conf.json   # Windows-specific config
    ├── tauri.linux.conf.json     # Linux-specific config
    ├── capabilities/             # Tauri 2 capability files (.json)
    ├── permissions/              # Tauri 2 permission whitelists (.toml)
    ├── icons/                    # App icons (all platforms)
    └── resources/
        ├── windows/              # 14 files (~14 MB)
        └── linux/                # 9 files (~16 MB)
```

## Quality Commands

| Command | What It Does |
|---------|--------------|
| `bun run dev` | Vite dev server + Tauri window |
| `bun run build` | tsc type-check + Vite bundle |
| `bun run lint` | ESLint (web) + cargo clippy (Rust) |
| `bun run lint:web` | ESLint only |
| `bun run lint:rust` | cargo clippy -D warnings |
| `bun run format` | Prettier (web) + cargo fmt (Rust) |
| `bun run format:check` | Check-only (CI mode) |
| `bun run check` | Full gate: lint → format:check → cargo test → bun build |
| `bun run check:fast` | Fast gate: lint → format:check (no build) |
| `bun run tauri build --debug` | Full Tauri build (debug) |
| `bun run tauri build` | Full Tauri build (release) |

## Edition

- **Rust Edition**: 2024 (updated from 2021 on 2026-03-22)
- **TypeScript**: 6.0.2 (strict mode)
- **Last Updated**: 2026-04-24 (shadcn frontend audit implementation complete; Bun toolchain current; ESLint ignores generated Cargo `src-tauri/target-*/**`; lint verification uses `CARGO_TARGET_DIR=src-tauri/target-codex-lint` and debug packaging can use `CARGO_TARGET_DIR=src-tauri/target-codex-tauri` when the default target is locked)
