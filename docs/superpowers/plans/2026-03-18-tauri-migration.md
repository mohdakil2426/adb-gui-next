# Tauri Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a root-level Tauri 2 + Rust + Vite/React app that preserves the legacy frontend and ports the Wails runtime/backend behavior without deleting or harming `docs/` or `TAURI_MIGRATION_PLAN.md`.

**Architecture:** The repository root becomes the product. The legacy Wails app remains permanently under `docs/adb-gui-kit/refernces` as read-only reference. We copy the legacy frontend into the root app with minimal structural change, add a thin `src/desktop` compatibility layer for Tauri APIs, and port backend behavior into `src-tauri` service/command modules in vertical slices.

**Tech Stack:** Tauri 2, Rust, Vite, React 19, TypeScript, Tailwind CSS 4, Zustand, Radix UI, pnpm

---

### Task 1: Scaffold The Root Tauri App

**Files:**

- Create: root Tauri/Vite scaffold files
- Preserve: `docs/`, `TAURI_MIGRATION_PLAN.md`
- Reference: `docs/adb-gui-kit/refernces/build/*`

- [ ] **Step 1: Scaffold the app from the latest official Tauri React template**

Run: `pnpm create tauri-app@latest . --template react-ts --manager pnpm --yes`
Expected: root `package.json`, `vite.config.ts`, `index.html`, `src/`, and `src-tauri/` are created.

- [ ] **Step 2: Update scaffold metadata for project constraints**

Set app/product naming, enable Windows/Linux target intent, and keep docs/reference paths untouched.

- [ ] **Step 3: Install and sync latest dependencies**

Run: `pnpm install`
Run: `cargo fetch --manifest-path src-tauri/Cargo.toml`
Expected: dependency lockfiles are present and install completes.

- [ ] **Step 4: Verify the baseline scaffold boots**

Run: `pnpm tauri build --debug`
Expected: scaffold compiles before frontend copy begins.

- [ ] **Step 5: Commit**

Run: `git add .`
Run: `git commit -m "chore: scaffold root tauri app"`

### Task 2: Copy The Legacy Frontend Intact

**Files:**

- Copy from: `docs/adb-gui-kit/refernces/frontend/src/*`
- Copy from: `docs/adb-gui-kit/refernces/frontend/public/*`
- Create: root `src/desktop/*`
- Modify: root `src/main.tsx`, root `src/App.tsx`, root `tsconfig.json`, root `package.json`

- [ ] **Step 1: Copy the legacy frontend source tree into root `src/`**

Copy `components/`, `lib/`, and `styles/` first with no content edits.

- [ ] **Step 2: Copy legacy public assets into root `public/`**

Copy `favicon.svg` and `logo.png` without modification.

- [ ] **Step 3: Replace only the Astro host**

Create a Vite React `App.tsx` and `main.tsx` that render `MainLayout`, preserving the legacy app shell.

- [ ] **Step 4: Align root TS/Vite config with legacy frontend expectations**

Preserve the `@/*` path alias, React JSX mode, and Tailwind integration needs.

- [ ] **Step 5: Commit**

Run: `git add src public package.json tsconfig.json vite.config.ts index.html`
Run: `git commit -m "feat: copy legacy frontend into root app"`

### Task 3: Build The Frontend Compatibility Layer

**Files:**

- Create: `src/desktop/commands/*.ts`
- Create: `src/desktop/events/*.ts`
- Create: `src/desktop/dialogs/*.ts`
- Create: `src/desktop/dnd/*.ts`
- Modify: copied frontend view files only where Wails imports must change

- [ ] **Step 1: Inventory current Wails imports and event usage**

Map every `wailsjs/go/backend/App` and `wailsjs/runtime/runtime` import to the target adapter module.

- [ ] **Step 2: Create typed command wrappers around Tauri `invoke()`**

Keep method names and argument ordering close to the current frontend contract.

- [ ] **Step 3: Create runtime adapters for browser open, dialogs, event subscriptions, and drag/drop**

Preserve `payload:progress` event naming and subscription semantics as closely as practical.

- [ ] **Step 4: Replace frontend Wails imports incrementally**

Limit edits to import paths and compatibility call sites wherever possible.

- [ ] **Step 5: Verify the copied frontend renders under Vite**

Run: `pnpm vite build`
Expected: TypeScript and Vite compile with the copied shell and adapters.

- [ ] **Step 6: Commit**

Run: `git add src`
Run: `git commit -m "feat: add tauri desktop compatibility layer"`

### Task 4: Port The Rust Foundation

**Files:**

- Create: `src-tauri/src/error.rs`
- Create: `src-tauri/src/state.rs`
- Create: `src-tauri/src/models/*`
- Create: `src-tauri/src/commands/*`
- Create: `src-tauri/src/services/executor.rs`
- Create: `src-tauri/src/services/binary_locator.rs`
- Create: `src-tauri/src/platform/*`
- Copy resources from: `docs/adb-gui-kit/refernces/backend/bin/*` into `src-tauri/resources/*`

- [ ] **Step 1: Create shared error/state/model modules**

Keep DTO names and serialized field shapes close to the Wails frontend expectations.

- [ ] **Step 2: Port the executor behavior**

Preserve timeout handling, combined output behavior, and contextual error mapping.

- [ ] **Step 3: Port bundled binary location and packaging**

Prefer packaged resources for Windows/Linux, with dev-path fallback and `PATH` last.

- [ ] **Step 4: Port basic system/log/open-folder commands first**

These unblock the shell, about page, main layout actions, and log panel.

- [ ] **Step 5: Verify foundation commands via Tauri**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Run: `pnpm tauri build --debug`

- [ ] **Step 6: Commit**

Run: `git add src-tauri`
Run: `git commit -m "feat: add tauri rust foundation"`

### Task 5: Port Core Feature Commands In Vertical Slices

**Files:**

- Modify/Create: `src-tauri/src/commands/adb.rs`
- Modify/Create: `src-tauri/src/commands/fastboot.rs`
- Modify/Create: `src-tauri/src/commands/files.rs`
- Modify/Create: `src-tauri/src/commands/system.rs`
- Modify/Create: `src-tauri/src/services/adb_service.rs`
- Modify/Create: `src-tauri/src/services/fastboot_service.rs`
- Modify/Create: `src-tauri/src/services/file_service.rs`

- [ ] **Step 1: Port dashboard/device info/wireless ADB flows**
- [ ] **Step 2: Port app manager install/list/uninstall flows**
- [ ] **Step 3: Port file explorer list/push/pull flows**
- [ ] **Step 4: Port flasher/utilities/shell command runner flows**
- [ ] **Step 5: Run targeted app smoke checks after each slice**
- [ ] **Step 6: Commit each completed slice with focused commit messages**

### Task 6: Port The Payload Dumper As A Dedicated Milestone

**Files:**

- Create: `src-tauri/src/services/payload/*`
- Modify/Create: `src-tauri/src/commands/payload.rs`
- Modify: `src/desktop/events/payload.ts`
- Modify: `src/components/views/ViewPayloadDumper.tsx` only where runtime differences require it

- [ ] **Step 1: Port ZIP-aware payload detection and cached extraction behavior**
- [ ] **Step 2: Port partition listing with details**
- [ ] **Step 3: Port extraction with progress emission**
- [ ] **Step 4: Recreate cleanup on file switch and app shutdown**
- [ ] **Step 5: Recreate drag-and-drop behavior in the Tauri shell**
- [ ] **Step 6: Verify payload flow end-to-end and commit**

### Task 7: Validate Packaging And Parity

**Files:**

- Modify as needed: `src-tauri/tauri.conf.json`, capabilities, resources, icons
- Preserve: `docs/adb-gui-kit/refernces` for side-by-side reference

- [ ] **Step 1: Run frontend and Rust test/build verification**

Run: `pnpm build`
Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Run: `pnpm tauri build --debug`

- [ ] **Step 2: Validate Windows standalone behavior with bundled binaries**
- [ ] **Step 3: Validate Linux standalone packaging behavior as far as current environment allows**
- [ ] **Step 4: Compare core workflows against the legacy app parity matrix**
- [ ] **Step 5: Commit final migration progress**
