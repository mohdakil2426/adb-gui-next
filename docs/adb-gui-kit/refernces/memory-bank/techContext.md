# Tech Context

## Core Stack
### Backend
- Go 1.23
- Wails v2
- Standard library `os/exec`, `context`, `embed`, file APIs

### Frontend
- React 19
- Astro 5
- TypeScript
- Tailwind CSS 4
- Zustand
- Radix UI primitives / shadcn-style components
- Framer Motion
- Sonner
- Lucide React
- next-themes

## Go Dependencies
Primary direct dependencies from `go.mod`:
- `github.com/wailsapp/wails/v2`
- `google.golang.org/protobuf`
- `github.com/xi2/xz`
- `github.com/klauspost/compress`
- `github.com/vbauerster/mpb/v5`
- `github.com/dustin/go-humanize`

## Frontend Dependencies
Key dependencies from `frontend/package.json`:
- `react`, `react-dom`
- `astro`, `@astrojs/react`
- `tailwindcss`, `@tailwindcss/vite`
- `zustand`
- `framer-motion`
- `sonner`
- `lucide-react`
- `next-themes`
- `@radix-ui/*`
- `cmdk`
- `path-browserify`
- `class-variance-authority`, `clsx`, `tailwind-merge`

## Build and Run Workflow
### Development
- Frontend dev server: `pnpm dev` in `frontend/`
- App dev mode: `wails dev`
- Wails expects frontend dev server at `http://localhost:4333`

### Production
- Frontend build: `pnpm build`
- Desktop build: `wails build`
- Windows installer path supported through Wails/NSIS tooling

## Runtime Integration Model
- Frontend bundle is built to static assets and embedded into the Go application.
- Wails generates JS bindings in `frontend/wailsjs/`.
- React views import generated methods from `wailsjs/go/backend/App`.
- Wails runtime helpers are used for browser open, events, and drag-and-drop.

## File/Config Landmarks
- `main.go` — Wails app entrypoint
- `wails.json` — build metadata and frontend commands
- `go.mod` — backend dependencies
- `frontend/package.json` — frontend dependencies/scripts
- `frontend/astro.config.mjs` — Astro config with React and Tailwind Vite plugin
- `frontend/src/styles/global.css` — design tokens and layout constants

## Packaging Constraints
- The app aims to support standalone distribution by bundling `adb` and `fastboot` binaries.
- Embedded binaries are present for Windows and Linux.
- Windows runtime path resolution actively uses extracted embedded binaries.
- Linux support exists in code and packaging metadata, but runtime binary lookup currently leans on PATH resolution.
- macOS is not a supported target in the current project scope.

## Desktop/OS Integration Patterns
- Native file/folder dialogs through Wails runtime.
- System file explorer launching via platform-specific helpers.
- External terminal launching via platform-specific helpers.
- Device Manager / system settings launch via platform-specific helpers.
- Drag-and-drop enabled globally via Wails app config.

## Data and State Constraints
- No server-side persistence.
- No external database.
- Nicknames persist in browser `localStorage`.
- Operational logs exist in frontend state and can be exported to local files.
- Payload temp files are stored under the OS temp directory and cleaned up on app shutdown or file switching.

## Technical Risks / Caveats
- Device status is polling-based, not event-driven.
- Payload extraction is CPU-intensive and long-running for large files.
- Shell view is command-oriented, not a real interactive terminal session.
- The project is tightly coupled to ADB/Fastboot command output formats.
- Some Wails default build docs remain in the repo even though actual support is narrower.