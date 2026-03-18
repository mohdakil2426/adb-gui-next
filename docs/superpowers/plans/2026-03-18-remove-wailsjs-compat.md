# Remove WailsJS Compatibility Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all remaining `wailsjs` imports with a Tauri-native desktop API layer under `src/`, then delete the `wailsjs/` folder entirely.

**Architecture:** Create a first-class frontend desktop layer in `src/lib/desktop/` that owns command invocation, dialog/file-picker helpers, browser opening, events, and drag/drop. Update each copied view to import from that layer instead of `wailsjs`, then remove the old compatibility files and verify the app still builds and packages from `main`.

**Tech Stack:** React 19, TypeScript, Vite 7, Tauri 2, `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-opener`

---

### Task 1: Create Native Desktop Modules

**Files:**

- Create: `src/lib/desktop/backend.ts`
- Create: `src/lib/desktop/runtime.ts`
- Create: `src/lib/desktop/models.ts`

- [x] **Step 1: Mirror the currently used command surface in `backend.ts`**
- [x] **Step 2: Mirror the currently used runtime surface in `runtime.ts`**
- [x] **Step 3: Re-export shared DTO types from `models.ts` if needed by views**
- [x] **Step 4: Keep method names close to the current call sites to minimize churn**

### Task 2: Rewire Frontend Imports

**Files:**

- Modify: `src/components/views/ViewAbout.tsx`
- Modify: `src/components/views/ViewAppManager.tsx`
- Modify: `src/components/views/ViewDashboard.tsx`
- Modify: `src/components/views/ViewFileExplorer.tsx`
- Modify: `src/components/views/ViewFlasher.tsx`
- Modify: `src/components/views/ViewPayloadDumper.tsx`
- Modify: `src/components/views/ViewShell.tsx`
- Modify: `src/components/views/ViewUtilities.tsx`

- [x] **Step 1: Replace `wailsjs/go/backend/App` imports with `src/lib/desktop/backend` imports**
- [x] **Step 2: Replace `wailsjs/runtime/runtime` imports with `src/lib/desktop/runtime` imports**
- [x] **Step 3: Update any model imports that still depend on `wailsjs/go/models`**
- [x] **Step 4: Keep behavior unchanged while converting import paths**

### Task 3: Remove Compatibility Layer

**Files:**

- Delete: `wailsjs/go/backend/App.ts`
- Delete: `wailsjs/go/backend/App.d.ts`
- Delete: `wailsjs/go/models.ts`
- Delete: `wailsjs/runtime/runtime.ts`
- Delete: `wailsjs/runtime/runtime.d.ts`

- [x] **Step 1: Verify no `wailsjs` imports remain in `src/`**
- [x] **Step 2: Delete the obsolete compatibility files**
- [x] **Step 3: Remove the now-unused `wailsjs/` tree**

### Task 4: Verify And Document

**Files:**

- Modify: `memory-bank/systemPatterns.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
- Modify: `docs/TAURI_PROJECT_SUMMARY.md`

- [x] **Step 1: Run `pnpm build`**
- [x] **Step 2: Run `cargo test --manifest-path src-tauri/Cargo.toml`**
- [x] **Step 3: Run `pnpm tauri build --debug`**
- [x] **Step 4: Update project docs and memory bank to reflect the removal of `wailsjs/`**
- [ ] **Step 5: Commit the native-Tauri rewire**
