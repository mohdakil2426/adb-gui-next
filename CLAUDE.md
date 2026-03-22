# ADB GUI Next — Tauri 2 Android Toolkit

> **Tauri 2 desktop application** for ADB and fastboot workflows.
> React 19 + TypeScript + Vite + Rust | Windows & Linux

**Memory Bank**: The `memory-bank/` directory contains the source of truth for project context, patterns, and progress tracking. Read ALL files for deep project understanding. **NEVER SKIP THIS STEP.**

**RESPECT ALL RULES**: You MUST follow every rule, guideline, principle, coding standard and best practice documented below. No exceptions, no shortcuts, no lazy work, full efforts. Respect project patterns, shared contracts, and existing code style consistency.

## Architecture (Tauri 2 + React + Rust)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + TypeScript + Vite)             │
│  main.tsx → App.tsx → MainLayout (sidebar + view switch + log panel)   │
│  8 Views: Dashboard │ AppManager │ FileExplorer │ Flasher │             │
│           Utilities │ PayloadDumper │ Shell │ About                     │
│  Zustand Stores: deviceStore │ logStore │ payloadDumperStore            │
│  Desktop Layer: src/lib/desktop/ (backend.ts, runtime.ts, models.ts)   │
├─────────────────────────────────────────────────────────────────────────┤
│                     Tauri 2 IPC Bridge                                  │
│  backend.ts → core.invoke<T>(command, args) → Rust commands            │
│  runtime.ts → event listeners, file drop, URL opener                   │
├─────────────────────────────────────────────────────────────────────────┤
│                     Backend (Rust — src-tauri/)                         │
│  lib.rs (833 lines) — 26 Tauri commands + helpers                      │
│    ├─ Device: get_devices, get_device_info, get_device_mode            │
│    ├─ ADB: run_adb_host_command, run_shell_command, wireless ADB       │
│    ├─ Fastboot: flash_partition, reboot, wipe_data, set_active_slot    │
│    ├─ Files: list_files, push_file, pull_file                          │
│    ├─ Apps: install_package, uninstall_package, sideload_package       │
│    ├─ System: open_folder, launch_terminal, save_log                   │
│    └─ Payload: extract_payload, list_payload_partitions                │
│  payload.rs (645 lines) — OTA payload.bin dumper (CrAU + protobuf)     │
│  resources/ — Bundled Android platform tools (adb, fastboot, etc.)     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Desktop abstraction**: `src/lib/desktop/backend.ts` wraps every Tauri command. `runtime.ts` manages event listeners. `models.ts` defines DTOs.
- **State**: Zustand for shared state (device, log, payload). `nicknameStore` uses raw localStorage.
- **Navigation**: No router. `MainLayout` uses `useState<ViewType>` + switch statement. Manual view switching.
- **Binary resolution**: Three-tier fallback: Tauri resource dir → repo `resources/` → system PATH.
- **Hook style**: All commands are `#[tauri::command]` functions registered in `run()`. Frontend calls via `core.invoke()`.

---

## Project Structure

```text
/
├── src/                          # Frontend — React 19 + TypeScript + Vite
│   ├── components/               # UI components (MainLayout, views, shadcn primitives)
│   ├── lib/                      # Zustand stores, utils, Tauri desktop abstraction layer
│   └── styles/                   # Tailwind v4 config + shadcn theme tokens
│
├── src-tauri/                    # Rust backend — Tauri 2
│   ├── src/                      # Rust source (lib.rs, payload.rs, generated protobuf)
│   ├── capabilities/             # Tauri permission grants
│   ├── icons/                    # App icons (all platforms)
│   └── resources/                # Bundled Android platform tools (adb, fastboot, etc.)
│
├── memory-bank/                  # Project memory — 6 core files, source of truth
├── .claude/skills/               # Agent skills (read SKILL.md before coding)
├── docs/                         # Preserved legacy Go/Wails reference archive
└── CLAUDE.md                     # This file — project rules and patterns
```

**Key folders:**

- `src/components/ui/` — 11 shadcn primitives (button, card, table, dialog, etc.)
- `src/components/views/` — 8 views (Dashboard, AppManager, FileExplorer, Flasher, Utilities, PayloadDumper, Shell, About)
- `src/lib/desktop/` — Tauri abstraction layer (backend.ts, runtime.ts, models.ts)
- `src-tauri/src/` — 26 Tauri commands + OTA payload parser
- `src-tauri/resources/` — Bundled adb/fastboot binaries (~30 MB total)

---

## Critical Rules

### File & Module Boundaries

| Type                      | Correct Location                  | Wrong                                       |
| ------------------------- | --------------------------------- | ------------------------------------------- |
| Tauri commands + helpers  | `src-tauri/src/lib.rs`            | Putting command logic in `payload.rs` or FE |
| Payload extraction logic  | `src-tauri/src/payload.rs`        | Inline payload code in `lib.rs`             |
| Frontend Tauri wrappers   | `src/lib/desktop/backend.ts`      | Direct `invoke()` calls scattered in views  |
| Event system wrappers     | `src/lib/desktop/runtime.ts`      | Raw Tauri event API in components           |
| TypeScript DTOs           | `src/lib/desktop/models.ts`       | Inline type definitions in views            |
| Zustand stores            | `src/lib/*Store.ts`               | Component-local state for shared data       |
| shadcn UI primitives      | `src/components/ui/               | Custom-styled divs for UI primitives        |
| View components           | `src/components/views/`           | View logic outside views/ directory         |
| Shared feature components | `src/components/`                 | Duplicating components across views         |
| Bundled Android binaries  | `src-tauri/resources/{platform}/` | Hardcoded system paths for adb/fastboot     |
| Tailwind theme tokens     | `src/styles/global.css`           | Hardcoded color values in components        |

---

## Tech Stack

| Layer             | Stack                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Frontend**      | React 19, TypeScript 5.9, Vite 7/8                                      |
| **Styling**       | Tailwind CSS v4 (Vite plugin, CSS-first config)                         |
| **UI Components** | shadcn/ui (new-york style), Radix UI primitives, lucide-react icons     |
| **State**         | Zustand v5                                                              |
| **Animation**     | Framer Motion                                                           |
| **Theming**       | next-themes (light/dark + system)                                       |
| **Toasts**        | sonner                                                                  |
| **Backend**       | Rust, Tauri 2                                                           |
| **Protobuf**      | prost + prost-build (payload.bin manifest parsing)                      |
| **Compression**   | zip, zstd, xz2, bzip2 (OTA payload operations)                          |
| **Checksums**     | sha2 (payload operation verification)                                   |
| **IPC**           | Tauri invoke() + event system                                           |
| **Build**         | pnpm, Cargo, Tauri CLI                                                  |
| **Lint**          | ESLint v10 (flat config), typescript-eslint, react-hooks, react-refresh |
| **Format**        | Prettier (web), cargo fmt (Rust)                                        |
| **Rust Lint**     | cargo clippy (-D warnings)                                              |

---

## Commands & Quality Gates

| Command                    | What it does                                             |
| -------------------------- | -------------------------------------------------------- |
| `pnpm dev`                 | Vite dev server on port 1420 + Tauri window              |
| `pnpm build`               | tsc type-check + Vite bundle → `dist/`                   |
| `pnpm tauri build --debug` | Full Tauri build (debug — Windows MSI + NSIS)            |
| `pnpm tauri build`         | Full Tauri build (release)                               |
| `pnpm lint`                | ESLint (web) + cargo clippy (Rust, -D warnings)          |
| `pnpm lint:web`            | ESLint only                                              |
| `pnpm lint:web:fix`        | ESLint auto-fix                                          |
| `pnpm lint:rust`           | cargo clippy -D warnings                                 |
| `pnpm format`              | Prettier (web) + cargo fmt (Rust)                        |
| `pnpm format:check`        | Check-only (CI mode)                                     |
| `pnpm format:web`          | Prettier auto-fix                                        |
| `pnpm format:rust`         | cargo fmt --all                                          |
| `pnpm check`               | Full gate: lint → format:check → cargo test → pnpm build |
| `pnpm check:fast`          | Fast gate: lint → format:check (no build, no tests)      |

**Tests:** `cargo test --manifest-path src-tauri/Cargo.toml` (8 Rust tests, no JS/TS framework configured)

---

## Pre-Commit Checklist

**ZERO-TOLERANCE**: Run ALL gates in order every time you touch any source file. A single failure means the task is NOT done. Fix the root cause — never suppress or ignore.

```bash
pnpm format:check                  # Gate 1: Format
# If fails → pnpm format, then re-check

pnpm lint                          # Gate 2: Lint (ESLint + cargo clippy -D warnings)
pnpm build                         # Gate 3: Type check (tsc before vite build)
cargo test --manifest-path src-tauri/Cargo.toml  # Gate 4: Rust tests (8 tests)
pnpm tauri build --debug           # Gate 5: Full build (packaging + resource bundling)

pnpm check                         # All-in-one: runs gates 1-4
```

---

## Coding Standards — TypeScript/React

### Formatting & Style

| Setting         | Value                  |
| --------------- | ---------------------- |
| Formatter       | Prettier               |
| Print width     | 100 characters         |
| Semicolons      | Yes                    |
| Quotes          | Single                 |
| Trailing commas | All                    |
| Indent          | 2 spaces               |
| Line endings    | LF (via .editorconfig) |

### Imports

- Use `@/` alias for project imports: `@/lib/logStore`, `@/components/ui/button`
- Use relative imports for `desktop/` layer from views: `../../lib/desktop/backend`
- Type imports: use `import type` (enforced by `@typescript-eslint/consistent-type-imports`)

### Naming Conventions

| Type           | Convention                 | Example                           |
| -------------- | -------------------------- | --------------------------------- |
| Components     | PascalCase                 | `MainLayout`, `ViewDashboard`     |
| Views          | PascalCase + `View` prefix | `ViewFlasher`, `ViewShell`        |
| Hooks          | camelCase + `use` prefix   | `useDeviceStore`, `useLogStore`   |
| Zustand stores | camelCase + `use` prefix   | `useDeviceStore`                  |
| Tauri commands | PascalCase                 | `GetDevices`, `RunAdbHostCommand` |
| Functions      | camelCase                  | `refreshDevices`, `addLog`        |
| Constants      | SCREAMING_SNAKE_CASE       | `LOADING_DURATION`, `VIEWS`       |
| CSS classes    | Tailwind utility classes   | `flex gap-4 bg-background`        |

### shadcn/ui Conventions

- Use `cn()` for conditional classes (clsx + tailwind-merge)
- Use semantic tokens: `bg-background`, `text-muted-foreground` — never raw hex/rgb
- Use `gap-*` not `space-x-*`/`space-y-*`
- Use `size-*` when width and height are equal
- Full Card composition: `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`
- Toasts via sonner: `toast.success()` / `toast.error()`

---

## Coding Standards — Rust

### Formatting & Style

| Setting   | Value                    |
| --------- | ------------------------ |
| Formatter | cargo fmt (edition 2021) |
| Max width | 100 characters           |
| Indent    | 4 spaces                 |
| Style     | Default rustfmt          |

### Conventions

| Type           | Convention                           | Example                                   |
| -------------- | ------------------------------------ | ----------------------------------------- |
| Structs        | PascalCase                           | `Device`, `DeviceInfo`, `FileEntry`       |
| Functions      | snake_case                           | `get_devices`, `run_adb_host_command`     |
| Constants      | SCREAMING_SNAKE_CASE                 | `DEFAULT_ADB_PORT`, `VALUE_NOT_AVAILABLE` |
| Tauri commands | snake_case                           | `get_device_info`, `flash_partition`      |
| Error type     | `CmdResult<T> = Result<T, String>`   | All commands return this                  |
| Serialization  | `#[serde(rename_all = "camelCase")]` | All structs sent to frontend              |

### Patterns

- **Command structure**: Each `#[tauri::command]` calls a private helper, helpers call `run_binary_command()`
- **Binary resolution**: `resolve_binary_path()` — Tauri resource dir → repo resources → system PATH
- **Error handling**: `CmdResult<T>` with `.map_err(|e| e.to_string())?`
- **Process execution**: `run_binary_command()` for strict (fail-on-error), `run_binary_command_allow_output_on_failure()` for tolerant

---

## Key Patterns

| Pattern                   | Implementation                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------- |
| **View switching**        | `useState<ViewType>` + `switch` in `MainLayout.renderActiveView()` — no router          |
| **Device polling**        | `setInterval` per view (3-4s) — duplicated in Dashboard, Flasher, Utilities             |
| **Error handling (FE)**   | Every Tauri call wrapped in try/catch → `toast.error()` + `addLog()`                    |
| **Error handling (Rust)** | `CmdResult<T> = Result<T, String>` — all commands return this                           |
| **Binary execution**      | `resolve_binary_path()` → `run_binary_command()` — three-tier lookup                    |
| **Payload extraction**    | CrAU header → protobuf manifest → per-operation decompress (XZ/BZ2/Zstd/Zero) → SHA-256 |
| **Event system**          | `runtime.ts` wraps Tauri events with cleanup tracking via `Map<string, Set<...>>`       |
| **Config write path**     | UI → Zustand store → backend.ts → Tauri invoke → Rust command → process execution       |
| **State persistence**     | Zustand for in-memory, localStorage for nicknames only                                  |
| **Component reuse**       | `ConnectedDevicesCard` shared across Dashboard, Flasher, Utilities                      |

---

### Manual Verification Checklist

Before closing any task, confirm ALL of the following:

- [ ] `pnpm check` passes (lint + format + tests + build)
- [ ] No `'use client'` directives (this is Vite/Tauri, not Next.js)
- [ ] No unused imports or variables (ESLint catches these)
- [ ] Rust: all new structs have `#[derive(Serialize)]` with `#[serde(rename_all = "camelCase")]`
- [ ] Rust: all commands return `CmdResult<T>`
- [ ] FE: error handling wraps Tauri calls in try/catch with toast + log
- [ ] FE: uses `@/` alias for project imports (not relative paths for non-desktop imports)
- [ ] FE: uses `cn()` for conditional Tailwind classes (not manual template literals)
- [ ] FE: uses semantic color tokens (not hardcoded colors)
- [ ] No dead code or unused dependencies introduced
- [ ] Memory bank updated if the change affects architecture, patterns, or project state

---

### Hard Failure Rules

| Gate                   | Rule                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| **format:check fails** | Run `pnpm format`, then verify `pnpm format:check` is clean.                    |
| **lint errors**        | Fix the code. Never suppress lint warnings without a written justification.     |
| **build fails**        | Fix the build. Do not hand off a broken build under any circumstances.          |
| **type errors**        | Fix TypeScript types. Never use `any` without explicit justification.           |
| **test failures**      | Fix the failing test or the code. Never skip or delete tests to pass CI.        |
| **`lib.rs` too large** | When adding commands, consider whether they belong in `lib.rs` or a new module. |

---

## MCP Tools

> **MANDATORY — Query BEFORE writing any code, every time, no exceptions.**

| Server       | Priority | Covers                                                 |
| ------------ | -------- | ------------------------------------------------------ |
| **shadcn**   | **1st**  | shadcn/ui components, registries, styling, composition |
| **context7** | 2nd      | Tauri, React, Zustand, Rust, all non-Google libraries  |

---

## Skills

**MANDATORY: Read relevant skills BEFORE generating any code.**

Skills are located in `.claude/skills/` — read the **SKILL.md** file inside each skill folder.

### Tauri & Rust

| Skill                                | When to Use                                              | Path                                               |
| :----------------------------------- | :------------------------------------------------------- | :------------------------------------------------- |
| **integrating-tauri-rust-frontends** | Tauri v2 frontend integration, IPC, event system         | `.claude/skills/integrating-tauri-rust-frontends/` |
| **rust-refactor-helper**             | Refactoring Rust code, modularization, code smells       | `.claude/skills/rust-refactor-helper/`             |
| **m06-error-handling**               | Rust error handling patterns (Result, anyhow, thiserror) | `.claude/skills/m06-error-handling/`               |
| **m01-ownership**                    | Rust ownership, borrowing, lifetimes                     | `.claude/skills/m01-ownership/`                    |
| **m03-mutability**                   | Rust mutability, interior mutability, Mutex, RefCell     | `.claude/skills/m03-mutability/`                   |
| **m07-concurrency**                  | Rust concurrency (threads, async, channels, atomics)     | `.claude/skills/m07-concurrency/`                  |
| **unsafe-checker**                   | Auditing unsafe blocks in Rust code                      | `.claude/skills/unsafe-checker/`                   |
| **rust-code-navigator**              | Navigating and understanding Rust codebases              | `.claude/skills/rust-code-navigator/`              |

### React & Frontend

| Skill                           | When to Use                                          | Path                                          |
| :------------------------------ | :--------------------------------------------------- | :-------------------------------------------- |
| **shadcn**                      | shadcn/ui component management, styling, composition | `.claude/skills/shadcn/`                      |
| **vercel-react-best-practices** | React patterns, hooks, performance                   | `.claude/skills/vercel-react-best-practices/` |
| **vercel-composition-patterns** | React component composition, state patterns          | `.claude/skills/vercel-composition-patterns/` |
| **web-design-guidelines**       | UI/UX design principles                              | `.claude/skills/web-design-guidelines/`       |

### Design & Planning

| Skill                | When to Use                                                       | Path                               |
| :------------------- | :---------------------------------------------------------------- | :--------------------------------- |
| **mermaid-diagrams** | Creating software diagrams (class, sequence, flow, C4, ERD, Git). | `.claude/skills/mermaid-diagrams/` |

---

_Last Updated: 2026-03-21_
