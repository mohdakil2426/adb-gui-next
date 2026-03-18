# Tech Context

## Core Stack

### Frontend

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- Zustand
- Radix UI
- next-themes
- Sonner
- Framer Motion

### Backend

- Rust
- Tauri 2
- `prost` / `prost-build` for payload protobufs
- `zip`, `zstd`, `xz2`, `bzip2`
- `sha2` for payload checksum verification
- `which` for binary lookup fallback

## Tooling

- `pnpm`
- Cargo
- Tauri CLI

## Important Files

- `package.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/src/payload.rs`
- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.windows.conf.json`
- `src-tauri/tauri.linux.conf.json`
- `wailsjs/go/backend/App.ts`
- `wailsjs/runtime/runtime.ts`

## Packaging Notes

- Windows and Linux resources are bundled separately via platform-specific Tauri config files.
- Windows debug bundle generation has been verified from `main`.
- The app currently uses bundled resources rather than Tauri sidecars for Android tools.

