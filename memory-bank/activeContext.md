# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-23 — GitHub Readiness Audit & Fixes

- **CSP fix**: Added `font-src: 'self' https://fonts.gstatic.com` and updated `style-src` to allow `https://fonts.googleapis.com` (Google Fonts loaded in `index.html` were blocked by CSP in bundled builds).
- **`freezePrototype: true`**: Added to `tauri.conf.json` `security` section per Tauri 2 best practices — prevents prototype pollution XSS attacks.
- **`README.md`**: Created comprehensive project README with features, architecture, prerequisites, getting started, development commands, project structure, platform support, and contributing guide.
- **`LICENSE`**: MIT license added.
- **`.github/workflows/publish.yml`**: Release CI/CD pipeline using official `tauri-apps/tauri-action@v0` — builds Windows + Linux, creates GitHub release with installer artifacts.
- **`.github/workflows/ci.yml`**: Pull request CI — runs lint (ESLint + clippy), format check (Prettier + cargo fmt), and TypeScript + Vite build on both Windows and Linux.
- **`.gitattributes`**: Added for LF line ending normalization and Git LFS tracking of bundled ADB/fastboot binaries (~30 MB).
- **`.gitignore`**: Added `.agents/`, `.agent/`, `.claude/`, `.gemini/`, `memory-bank/`, `AGENTS.md`, `CLAUDE.md` — all local AI agent directories and config files.
- **Verification**: `pnpm format:check` ✅ | `pnpm lint` ✅ | `pnpm build` ✅



### 2026-03-23 — App Icons and Branding Update (Final)

- Source icon: `docs/original_icons.png` — 1024×1024px RGBA, 3D glassmorphic terminal prompt (`>_`) with rainbow RGB border and "ADB GUI Next" label.
- Ran `pnpm tauri icon docs/original_icons.png` to regenerate all 17 platform icons.
- Synced `public/logo.png` from `src-tauri/icons/icon.png` (512×512 — used in WelcomeScreen, ViewAbout, AppSidebar header).
- Created `public/favicon.png` from `src-tauri/icons/icon.png`; updated `index.html` to reference it (replaced default Vite `favicon.svg`).
- Removed `android/` and `ios/` icon subdirectories (out of project scope).
- ICO compliance confirmed: 6 layers (32/16/24/48/64/256px), all 32bpp, 32px first.
- Added `.setup()` hook in `lib.rs` — calls `window.set_icon(app.default_window_icon())` at startup to fix small taskbar icon in dev mode (Tauri 2 has no JSON `icon` field in `WindowConfig`; the correct API is Rust `window.set_icon()`).
- `bundle.icon` list includes `icon.png` (512px Linux) in addition to the Tauri docs canonical set.

### 2026-03-23 — UI Consistency Audit & Fixes (Estimated score: ~72% → 95%)

A comprehensive UI consistency audit was performed and all issues resolved:

**P1 — Critical Fixes**
- `ViewPayloadDumper`: 12 occurrences of raw `text/bg/border-[var(--terminal-log-success)]` → semantic `text-success` / `bg-success` / `border-success` tokens
- All CardTitle icons standardized to `className="h-5 w-5"` (Dashboard, Flasher, AppManager had unsized icons or the `size={N}` prop)
- All InfoItem list icons standardized to `className="h-4 w-4"` (Dashboard was using `size={18}`)
- Raw `<label className="text-sm font-medium">` → shadcn `<Label>` (Flasher × 3, AppManager × 1)
- Accessibility: `role="listbox"` + `role="option"` + `aria-selected` + `tabIndex` + `onKeyDown` on AppManager package list
- Accessibility: `role="checkbox"` + `aria-checked` + `aria-disabled` + `tabIndex` + `onKeyDown` on PayloadDumper partition rows

**P2 — Moderate Fixes**
- Created `src/components/CheckboxItem.tsx` — shared checkbox indicator adopted in AppManager + PayloadDumper (replaced two independent hand-rolled SVG checkbox impls)
- Created `src/components/EmptyState.tsx` — reusable empty-state component adopted in AppManager package list
- `shrink-0` added to all in-button icons (Flasher, AppManager, Utilities) to prevent compression in narrow layouts
- `buttonVariants({ variant: 'destructive' })` used uniformly in all `AlertDialogAction` destructive buttons (Flasher + Utilities)
- `BottomPanel`: manual `<div w-px h-4>` divider → `<Separator orientation="vertical">` (added Separator import)
- `ViewPayloadDumper`: merged double `@/lib/utils` import + fixed relative `../../lib/desktop/*` imports → `@/lib/desktop/*` alias
- Removed unused `Check` import in PayloadDumper (CheckboxItem handles its own icon)

**P3 — Polish Fixes**
- `ViewAbout`: removed Tailwind `animate-in fade-in slide-in-from-bottom-4 duration-500` — view is already animated by the `motion.div` wrapper in MainLayout (prevented double-animation)
- `ViewAbout`: `<a href="..." onClick={openLink}>` → `<button onClick={openLink}>` (prevented double browser-open on Tauri)
- `MainLayout`: removed dead `cn()` conditional branch where both sides were identical `'p-4 sm:p-6'`
- `ViewFileExplorer`: `w-12.5` → `w-12` (non-standard Tailwind value)

**Sidebar Fast Refresh Fix**
- Created `src/components/ui/sidebar-context.ts` — extracted non-component exports (constants `SIDEBAR_WIDTH`, `SIDEBAR_COOKIE_NAME`, etc.; `SidebarContextProps` type; `SidebarContext`; `useSidebar` hook) from `sidebar.tsx`
- `sidebar.tsx` now exports only React components (fixes Vite Fast Refresh warning)

**Verification:** `pnpm format:web` ✅ | `pnpm lint:web` ✅ (0 errors, 3 pre-existing warnings) | `pnpm lint:rust` ✅ (cargo clippy clean) | `pnpm build` ✅ (TypeScript + Vite clean)

> **Known:** `cargo test` crashes at runtime on Windows (pre-existing — Tauri DLL not available in bare `cargo test` process). Zero Rust files were touched in this session.

### 2026-03-23 — shadcn Sidebar Migration

**Sidebar Component Overhaul**
- Replaced ~150 lines of custom inline sidebar JSX in `MainLayout.tsx` with shadcn `Sidebar` component (`collapsible="icon"` mode)
- Created `AppSidebar.tsx` — grouped navigation (Main: Dashboard/Apps/Files, Advanced: Flasher/Utilities/Payload), SidebarHeader with logo, SidebarFooter with About + ThemeToggle, SidebarRail for collapse
- Refactored `MainLayout.tsx` from 426 → ~240 lines — uses `SidebarProvider`/`SidebarInset`
- Moved toolbar buttons from floating `absolute` position to proper header bar with `SidebarTrigger`
- Simplified `ThemeToggle.tsx` — uses `SidebarMenuButton` (auto tooltips + collapse handling)
- New capabilities: `Ctrl+B` keyboard shortcut, grouped nav with labels, SidebarRail, automatic tooltips in icon mode, mobile sheet/drawer support

### 2026-03-23 — Comprehensive Codebase Quality Improvement

- Dead code removal, P0 reactivity bug fix, shadcn component adoption (badge/progress/dialog/separator/skeleton)
- Shared components extracted: `LoadingButton`, `SectionHeader`, `FileSelector`, `SelectionSummaryBar`
- `models.ts` DTOs migrated from Wails-2 classes to plain TypeScript interfaces
- Semantic token fixes across multiple views

### 2026-03-23 — VS Code-Style Bottom Panel Overhaul

- Replaced right-side drawer with `BottomPanel.tsx` + `LogsPanel.tsx` + `ShellPanel.tsx`
- `logStore.ts` + `shellStore.ts` created
- 12 terminal CSS variables in `global.css` for light/dark
- Shell is now in the bottom panel (not a sidebar view)

### Previous Milestones
- App Manager: virtualized package list (TanStack Virtual) + user/system filter
- Payload Dumper: Arc<Mmap> + streaming ZIP + streaming decompression
- Dependency Integration: Vitest, Zod, RHF, TanStack Query, Clipboard
- Rust refactoring: `lib.rs` split into 8 focused files; `payload.rs` split into 4 modules

## Current Verification Evidence

Verified on `main` (2026-03-23):
- `pnpm build` ✅ — TypeScript + Vite bundle
- `pnpm format:check` ✅ — Prettier + cargo fmt clean
- `pnpm lint:web` ✅ — ESLint (0 errors, 3 pre-existing warnings)
- `pnpm lint:rust` ✅ — cargo clippy -D warnings clean (setup hook uses Rust 2024 let-chains)
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL not available in bare test runtime)
- Icons: ✅ Complete — `original_icons.png` source, 17 icon files, favicon.png, logo.png, setup hook, taskbar fix

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | shadcn Sidebar (grouped nav, icon collapse) + 7 views + bottom panel (Logs/Shell tabs) |
| UI Consistency | ✅ Complete | ~95% consistency — semantic tokens, icon sizes, Label, aria roles, shared CheckboxItem/EmptyState |
| Accessibility | ✅ Improved | role/aria/tabIndex/onKeyDown on all clickable div lists |
| Backend | ✅ Complete | 26 Tauri commands, payload parser |
| IPC Layer | ✅ Complete | backend.ts, runtime.ts, models.ts |
| Bottom Panel | ✅ Complete | VS Code-style with tabs, filter, search, follow, maximize |
| Device Polling | ✅ Complete | TanStack Query replaces all manual setIntervals |
| Clipboard | ✅ Complete | Tauri plugin + shared CopyButton component |
| Linting | ✅ Complete | ESLint 10 flat config + typescript-eslint |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |

## Important Notes

- **Sidebar uses shadcn `Sidebar` component** with `collapsible="icon"` mode and `SidebarRail` for collapse.
- **`sidebar-context.ts`** holds all non-component sidebar exports (context, hook, constants) — `sidebar.tsx` exports only React components.
- **Shell is now in the bottom panel**, not a sidebar view. The sidebar "Terminal" nav item was removed.
- **Icon pattern**: always use `className="h-5 w-5"` (CardTitle), `className="h-4 w-4"` (inline/list). Never use the `size={N}` prop.
- **Form labels**: always use shadcn `<Label>` — never raw `<label className="...">`.
- **`buttonVariants({ variant: 'destructive' })`** used in all AlertDialogAction buttons (never inline className).
- **`shrink-0`**: required on all icons inside flex buttons.
- **`@/` alias**: all internal imports must use `@/` alias except `../../lib/desktop/` (views can use relative).
- **Infinite loop pattern to avoid**: never write `useEffect(() => { setX(queryData) }, [queryData, setX])` with a `= []` default.
- Rust edition: 2024 (uses let_chains)
- All clippy warnings resolved with -D warnings