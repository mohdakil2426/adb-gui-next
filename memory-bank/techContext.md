# Tech Context

## Core Stack

### Frontend

| Package | Version | Notes |
|---------|---------|-------|
| React | ^19.2.4 | Latest |
| TypeScript | ~5.9.3 | Latest |
| Vite | ^8.0.1 | Latest |
| Tailwind CSS | ^4.2.2 | CSS-first config (v4) |
| Zustand | ^5.0.12 | State management |
| TanStack Query | ^5.94.5 | Server state + device polling |
| React Hook Form | ^7.72.0 | Form state management |
| Zod | ^4.3.6 | Schema validation |
| Framer Motion | ^12.38.0 | Animations |
| Radix UI | Various | shadcn primitives (incl. tabs) |
| lucide-react | ^0.577.0 | Icons |
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
| tokio | 1.x | Async runtime (block_in_place for extraction) |
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
| anyhow | 1.x | Error handling |

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

| Tool | Purpose |
|------|---------|
| pnpm | Package manager |
| Cargo | Rust build |
| Tauri CLI | Desktop build |

## Important Files

```text
├── package.json                  # Frontend deps + scripts
├── vite.config.ts                # Vite config with Tailwind plugin
├── tsconfig.json                 # TypeScript config (strict mode)
├── eslint.config.mjs             # ESLint flat config
├── .prettierrc.json              # Prettier config
├── components.json               # shadcn/ui config
├── rustfmt.toml                  # Rust formatting (edition 2024)
├── src/
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component
│   ├── components/               # UI components
│   │   ├── MainLayout.tsx        # App shell (sidebar + views + bottom panel)
│   │   ├── BottomPanel.tsx       # VS Code-style bottom panel container
│   │   ├── LogsPanel.tsx         # Filtered log viewer
│   │   ├── ShellPanel.tsx        # Interactive ADB/fastboot terminal
│   │   ├── ui/                   # 12 shadcn primitives (incl. tabs)
│   │   └── views/                # 7 feature views
│   ├── lib/
│   │   ├── utils.ts              # cn() helper
│   │   ├── logStore.ts           # Log panel state (ring buffer, filter, search)
│   │   ├── shellStore.ts         # Shell history state
│   │   ├── deviceStore.ts        # Device state
│   │   ├── payloadDumperStore.ts # Payload dumper state
│   │   └── desktop/              # Tauri abstraction layer
│   └── styles/
│       └── global.css            # Tailwind v4 config + theme + terminal tokens
└── src-tauri/
    ├── Cargo.toml                # Rust deps (edition 2024)
    ├── src/
    │   ├── lib.rs                # Thin orchestrator (52 lines)
    │   ├── helpers.rs            # Shared utilities
    │   ├── commands/             # 7 command modules
    │   │   ├── mod.rs
    │   │   ├── device.rs
    │   │   ├── adb.rs
    │   │   ├── fastboot.rs
    │   │   ├── files.rs
    │   │   ├── apps.rs
    │   │   ├── system.rs
    │   │   └── payload.rs
    │   ├── payload/              # OTA payload parser (4 modules)
    │   │   ├── mod.rs
    │   │   ├── parser.rs
    │   │   ├── extractor.rs
    │   │   ├── zip.rs
    │   │   └── tests.rs
    │   └── generated/            # Protobuf types
    ├── build.rs                  # prost-build + tauri-build
    ├── tauri.conf.json           # Main Tauri config
    ├── tauri.windows.conf.json   # Windows-specific config
    ├── tauri.linux.conf.json     # Linux-specific config
    ├── capabilities/             # Tauri permission grants
    ├── icons/                    # App icons (all platforms)
    └── resources/
        ├── windows/              # 14 files (~14 MB)
        └── linux/                # 9 files (~16 MB)
```

## Quality Commands

| Command | What It Does |
|---------|--------------|
| `pnpm dev` | Vite dev server + Tauri window |
| `pnpm build` | tsc type-check + Vite bundle |
| `pnpm lint` | ESLint (web) + cargo clippy (Rust) |
| `pnpm lint:web` | ESLint only |
| `pnpm lint:rust` | cargo clippy -D warnings |
| `pnpm format` | Prettier (web) + cargo fmt (Rust) |
| `pnpm format:check` | Check-only (CI mode) |
| `pnpm check` | Full gate: lint → format:check → cargo test → pnpm build |
| `pnpm check:fast` | Fast gate: lint → format:check (no build) |
| `pnpm tauri build --debug` | Full Tauri build (debug) |
| `pnpm tauri build` | Full Tauri build (release) |

## Edition

- **Rust Edition**: 2024 (updated from 2021 on 2026-03-22)
- **TypeScript**: 5.9.3 (strict mode)
- **Last Updated**: 2026-03-23 (VS Code-style bottom panel overhaul)