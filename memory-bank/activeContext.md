# Active Context

## Current State

ADB GUI Next is a working Tauri 2 desktop application on `main` branch.

## Recently Completed

### 2026-03-23 — shadcn Sidebar Migration

**Sidebar Component Overhaul**
- Replaced ~150 lines of custom inline sidebar JSX in `MainLayout.tsx` with shadcn `Sidebar` component (`collapsible="icon"` mode)
- Created `AppSidebar.tsx` — grouped navigation (Main: Dashboard/Apps/Files, Advanced: Flasher/Utilities/Payload), SidebarHeader with logo, SidebarFooter with About + ThemeToggle, SidebarRail for collapse
- Refactored `MainLayout.tsx` from 426 → ~240 lines — uses `SidebarProvider`/`SidebarInset`
- Moved toolbar buttons from floating `absolute` position to proper header bar with `SidebarTrigger`
- Simplified `ThemeToggle.tsx` — uses `SidebarMenuButton` (auto tooltips + collapse handling)
- Removed `--sidebar-width`/`--sidebar-collapsed-width` from `global.css` (shadcn manages internally)
- Installed shadcn `sidebar`, `collapsible`, `sheet` components + `use-mobile` hook
- New capabilities: `Ctrl+B` keyboard shortcut, grouped nav with labels, SidebarRail, automatic tooltips in icon mode, mobile sheet/drawer support

**Verification:** `pnpm format:check` ✅ | `pnpm lint:web` ✅ (0 errors, 3 pre-existing warnings) | `pnpm build` ✅ | `pnpm test` ✅ (21/21 Vitest)

### 2026-03-23 — Comprehensive Codebase Quality Improvement

**Dead Code Removal**
- Deleted `src/App.css` (unused Vite template leftover, conflicted with global.css)
- Deleted `src/components/ui/command.tsx` (never imported anywhere)
- Removed 2 dead lines (`refreshTimeout`, `void` suppressor) from `ViewUtilities.tsx`
- Removed commented-out JSX blocks from `WelcomeScreen.tsx`

**P0 Bug Fix — Reactivity in MainLayout**
- Fixed `useLogStore.getState().activeTab` calls in JSX (non-reactive pattern)
- Replaced with a Zustand selector (`activeTab` in destructure) so Shell/Logs toolbar buttons now correctly reflect active tab state on every render

**Hard-coded Values → Semantic Tokens**
- `ConnectedDevicesCard`: status color strings → shadcn `Badge` with `STATUS_CONFIG` map
- `ViewFileExplorer`: `text-blue-500` Folder icon → `text-primary`
- `ViewAbout`: `text-red-500 fill-red-500/20` Heart → `text-destructive fill-destructive/20`
- `ViewPayloadDumper`: all 9 `emerald-*` color classes → `var(--terminal-log-success)` token
- `ViewAppManager`: package type inline badge spans → `Badge` component
- `BottomPanel`: removed `navigator.clipboard` fallback (dead code in Tauri app)

**shadcn Components Installed & Adopted**
- Installed: `badge`, `progress`, `dialog`, `separator`, `skeleton`
- `WelcomeScreen`: manual progress bar div → `<Progress>`
- `ViewPayloadDumper`: custom `ExtractionProgressBar` → `<Progress>`
- `ViewAppManager`: raw `<input>` search → `<Input>` (accessible, themed)
- `ViewAppManager`: package type spans → `<Badge variant>`
- `ViewUtilities`: GetVar output modal rewritten from `AlertDialog` → `Dialog` (semantically correct for read-only output)
- `EditNicknameDialog`: rewritten from `AlertDialog` → `Dialog` + Enter key submit

**Shared Components Extracted**
- `LoadingButton.tsx` — replaces 20+ `{isLoading ? <Loader2> : <Icon>}` patterns
- `SectionHeader.tsx` — replaces 9 `<h4 className="text-xs font-semibold uppercase tracking-wider…">` patterns across ViewUtilities + ViewPayloadDumper
- `FileSelector.tsx` — standardised file/dir selector (label + button + path hint + trailing action)
- `SelectionSummaryBar.tsx` — replaces 2 custom selection count+clear bars in ViewAppManager
- `getFileName()` added to `utils.ts` — replaces 5+ inline `path.split(/[/\\]/).pop()` calls

**Architecture Improvements**
- `models.ts` — all 6 DTO classes migrated to plain TypeScript interfaces. Removed `source: any` constructors (Wails 2 artifact). `backend` namespace kept for backwards compatibility.

**Verification:** `pnpm format:check` ✅ | `pnpm lint:web` ✅ (0 errors, 2 pre-existing warnings) | `pnpm build` ✅ | `pnpm test` ✅ (21/21 Vitest)

> **Note:** `cargo test` fails with `STATUS_ENTRYPOINT_NOT_FOUND` (Windows DLL missing at test runtime). Confirmed pre-existing — identical failure on baseline before any changes. Unrelated to frontend work.


**Virtualized Package List**
- Removed `.slice(0, 50)` limit — all packages now rendered
- Added `@tanstack/react-virtual` for virtualized scrolling (only visible rows in DOM)
- Fixed row height 36px, 5 overscan rows, fixed container height (`h-75`)
- No lag with 200+ packages

**Package Type Classification**
- Rust backend (`apps.rs`) now runs `pm list packages -3` (user) + `pm list packages` (all)
- Each `InstalledPackage` gets a `packageType` field: `"user"` or `"system"`
- `InstalledPackage` DTO updated in `models.ts` with `packageType`

**Filter UI**
- shadcn `DropdownMenu` with `RadioGroup` for All/User/System filtering
- Filter icon button shows current selection ("All Packages", "User Apps", "System Apps")
- Colored type badges per row: blue=user, amber=system
- shadcn `dropdown-menu` component installed

**Verification:** `pnpm build` ✅ | `pnpm format:check` ✅ | `pnpm test` ✅ (21/21)

### 2026-03-23 — VS Code-Style Bottom Panel Overhaul

**Layout Change — Right Drawer → Bottom Panel**
- Replaced `TerminalLogPanel.tsx` (right-side drawer) with VS Code-style `BottomPanel.tsx` (bottom panel)
- Panel has vertical resize (drag handle at top), min 150px / max 70vh
- Two tabs: **Logs** (operation log viewer) and **Shell** (interactive ADB/fastboot terminal)
- `Ctrl+\`` keyboard shortcut to toggle panel

**New Components**
- `BottomPanel.tsx` — VS Code container with tabs, filter dropdown, search bar, follow output, maximize/minimize, copy/save/clear actions
- `LogsPanel.tsx` — Filtered log viewer with semantic color tokens, level badges (INFO/SUCCESS/ERROR/WARN), search text highlighting, auto-scroll detection
- `ShellPanel.tsx` — Full-bleed shell terminal refactored from `ViewShell.tsx`, uses `shellStore` instead of props

**Store Changes**
- `logStore.ts` overhauled: ring buffer (1000 max), ISO timestamp (`HH:MM:SS.mmm`), filter/search state, panel height/maximize/follow/activeTab state, unread count tracking
- `shellStore.ts` created — shell history + command history extracted from MainLayout props

**CSS & Theme**
- 12 terminal-specific CSS variables added to `global.css` for light/dark: `--terminal-bg`, `--terminal-fg`, `--terminal-border`, `--terminal-header-bg`, `--terminal-tab-active/inactive`, `--terminal-log-info/success/error/warning`
- Replaced all hardcoded `bg-zinc-950`, `text-zinc-100` etc. with semantic tokens

**Bug Fixes**
- Removed `'use client'` directive from `MainLayout.tsx` (Next.js artifact, invalid in Vite/Tauri)
- Replaced `navigator.clipboard.writeText()` with Tauri `writeText()` from `@tauri-apps/plugin-clipboard-manager`

**Deleted Files**
- `TerminalLogPanel.tsx` — replaced by `BottomPanel.tsx` + `LogsPanel.tsx`
- `ViewShell.tsx` — replaced by `ShellPanel.tsx` (embedded in bottom panel Shell tab)

**Layout Change in MainLayout**
- Shell view removed from sidebar navigation (7 views now instead of 8)
- Main layout changed from `flex` (horizontal: sidebar | content | logs) to `flex-col` (vertical: content / bottom-panel)
- Added Shell toggle button and Logs toggle button with unread count badge in toolbar
- Installed shadcn `Tabs` component (`@radix-ui/react-tabs`)

**Verification:** `pnpm build` ✅ | `pnpm format:check` ✅ | `pnpm lint` ✅ | `pnpm test` ✅ (21/21)

### 2026-03-23 — Vite Config Type Fix
- Installed `@types/node` and added to `tsconfig.node.json` types.
- Replaced `__dirname` with `import.meta.dirname` in `vite.config.ts` (modern Node ESM).
- Removed `@ts-expect-error` for `process` in `vite.config.ts` as it's now correctly typed.

### Previous Milestones
- Payload Dumper Overhaul: Arc\<Mmap\> + streaming ZIP + streaming decompression
- Dependency Integration: Vitest, Zod, RHF, TanStack Query, Clipboard
- Debugging & Logging Infrastructure (`tauri-plugin-log`, `errorHandler.ts`, `debug.ts`)
- Performance Optimization: sparse zero, parallel extraction, async Tauri commands
- Rust refactoring: `lib.rs` split into 8 focused files; `payload.rs` split into 4 modules
- Root-level Tauri 2 app structure, 26 backend commands, payload dumper

## Current Verification Evidence

Verified on `main` (2026-03-23) with:
- `pnpm build` ✅ — TypeScript + Vite bundle
- `pnpm format:check` ✅ — Prettier + cargo fmt clean
- `pnpm lint` ✅ — ESLint (0 errors, 1 pre-existing warning) + cargo clippy -D warnings clean
- `pnpm test` ✅ — 21/21 Vitest tests pass
- `cargo test` ✅ — 8 Rust tests pass

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend | ✅ Complete | shadcn Sidebar (grouped nav, icon collapse) + 7 views + bottom panel (Logs/Shell tabs) |
| Backend | ✅ Complete | 26 Tauri commands, payload parser |
| IPC Layer | ✅ Complete | backend.ts, runtime.ts, models.ts |
| Bottom Panel | ✅ Complete | VS Code-style with tabs, filter, search, follow, maximize |
| Testing | ✅ Complete | 21 JS/TS tests + 8 Rust tests |
| Input Validation | ✅ Complete | Zod schemas for all interactive inputs |
| Form Handling | ✅ Complete | React Hook Form on wireless ADB form |
| Device Polling | ✅ Complete | TanStack Query replaces all manual setIntervals |
| Clipboard | ✅ Complete | Tauri plugin + shared CopyButton component |
| Linting | ✅ Complete | ESLint 10 flat config + typescript-eslint |
| Formatting | ✅ Complete | Prettier (web) + cargo fmt (Rust) |

## Immediate Follow-up Candidates

- Add Vitest tests for new components (BottomPanel, LogsPanel, ShellPanel, logStore, shellStore)
- Extend React Hook Form to `ViewFlasher` (partition/file form)
- Add virtual list (react-window) for log entries when 1000+ entries
- Add CopyButton to more shell output areas
- Test bottom panel behavior with `pnpm tauri dev` (manual verification)
- Consider adding "enabled/disabled" filter for packages (`pm list packages -e` / `-d`)

## Important Notes

- **Sidebar uses shadcn `Sidebar` component** with `collapsible="icon"` mode and `SidebarRail` for collapse.
- **Shell is now in the bottom panel**, not a sidebar view. The sidebar "Terminal" nav item was removed.
- **Infinite loop pattern to avoid**: never write `useEffect(() => { setX(queryData) }, [queryData, setX])` with a `= []` default.
- Rust edition: 2024 (uses let_chains)
- All clippy warnings resolved with -D warnings