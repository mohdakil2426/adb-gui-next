# Production Tooling Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the repository with a production-ready tooling baseline covering linting, formatting, git hygiene, and repo-managed git hooks while staying aligned with official ESLint, Prettier, and Tauri guidance.

**Architecture:** Keep `package.json` as the single source of truth for repo quality commands, with git hooks delegating to those scripts rather than duplicating logic. Use lightweight pre-commit checks, full pre-push verification, and tracked lockfiles for deterministic application builds.

**Tech Stack:** pnpm, Vite, React 19, TypeScript, ESLint v9 flat config, Prettier 3, Tauri 2, Rust, cargo fmt, cargo clippy

---

### Task 1: Audit And Harden The Command Contract

**Files:**

- Modify: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/package.json`
- Modify if needed: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/tooling.md`

- [ ] **Step 1: Review current package scripts and identify the canonical command set**

Confirm the final command contract stays small and explicit:

```json
{
  "scripts": {
    "lint": "pnpm lint:web && pnpm lint:rust",
    "format:check": "pnpm format:web:check && pnpm format:rust:check",
    "check": "pnpm lint && pnpm format:check && cargo test --manifest-path src-tauri/Cargo.toml && pnpm build"
  }
}
```

- [ ] **Step 2: Add any missing helper scripts for hook-safe execution**

If needed, add explicit scripts such as:

```json
{
  "scripts": {
    "check:fast": "pnpm lint && pnpm format:check",
    "check:full": "pnpm check"
  }
}
```

Only keep helper scripts if they reduce duplication between hooks and docs.

- [ ] **Step 3: Run package script verification**

Run: `pnpm lint`
Expected: lint command completes without fatal errors

Run: `pnpm format:check`
Expected: formatting verification completes without fatal errors

- [ ] **Step 4: Commit**

```bash
git add package.json docs/tooling.md
git commit -m "build: harden quality command contract"
```

### Task 2: Fix Git Ignore And Reproducibility Rules

**Files:**

- Modify: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.gitignore`

- [ ] **Step 1: Remove lockfiles from ignore rules**

Update `.gitignore` so it keeps machine-local and build output files ignored without ignoring application lockfiles.

Desired pattern shape:

```gitignore
.worktrees/
node_modules/
dist/
src-tauri/target/
__tauri_template_tmp/
.mcp.json
dev-tauri.log
*.log
*.tmp
*.temp
.env
.env.local
.env.*.local
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db
Desktop.ini
```

- [ ] **Step 2: Verify lockfiles are tracked candidates instead of ignored**

Run: `git check-ignore -v pnpm-lock.yaml src-tauri/Cargo.lock`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "build: track application lockfiles"
```

### Task 3: Add Repository-Managed Git Hooks

**Files:**

- Create: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-commit`
- Create: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-push`
- Create: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-commit.cmd`
- Create: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-push.cmd`
- Modify: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/package.json`
- Modify: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/tooling.md`

- [ ] **Step 1: Create portable hook entrypoints**

Use a simple shell-based hook plus Windows `.cmd` wrapper when needed so the repository remains usable in Git Bash and Windows-first environments.

Example `pre-commit`:

```sh
#!/bin/sh
pnpm check:fast
```

Example `pre-push`:

```sh
#!/bin/sh
pnpm check
```

Example `pre-commit.cmd`:

```bat
@echo off
pnpm check:fast
if errorlevel 1 exit /b 1
```

- [ ] **Step 2: Add a hook installation script**

Add a package script that points git at the tracked hook directory:

```json
{
  "scripts": {
    "hooks:install": "git config core.hooksPath .githooks"
  }
}
```

If needed on Windows, add a verification script:

```json
{
  "scripts": {
    "hooks:status": "git config --get core.hooksPath"
  }
}
```

- [ ] **Step 3: Install and verify hooks locally**

Run: `pnpm hooks:install`
Expected: git config updates successfully

Run: `git config --get core.hooksPath`
Expected: `.githooks`

- [ ] **Step 4: Smoke test hook commands directly**

Run: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-commit.cmd`
Expected: fast checks run and succeed

Run: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-push.cmd`
Expected: full verification runs and succeeds

- [ ] **Step 5: Commit**

```bash
git add .githooks package.json docs/tooling.md
git commit -m "build: add repository git hooks"
```

### Task 4: Tighten And Verify Linting Configuration

**Files:**

- Modify if needed: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/eslint.config.mjs`
- Modify if needed: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/package.json`
- Modify if needed: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/tooling.md`

- [ ] **Step 1: Confirm flat config follows official composition patterns**

Target shape:

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
]);
```

Retain TypeScript, React Hooks, and React Refresh integration if already working.

- [ ] **Step 2: Keep Prettier conflict resolution at the config boundary**

Verify the ESLint config ends with `eslint-config-prettier` or the flat-config equivalent already in use so stylistic rule overlap does not reappear.

- [ ] **Step 3: Run lint verification**

Run: `pnpm lint:web`
Expected: config loads successfully and lint completes

Run: `pnpm lint`
Expected: web and Rust lint both complete

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs package.json docs/tooling.md
git commit -m "build: align lint config with production baseline"
```

### Task 5: Refresh Tooling Documentation

**Files:**

- Modify: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/tooling.md`

- [ ] **Step 1: Document the final workflow clearly**

Cover:

- what `pnpm lint` does
- what `pnpm format:check` does
- what `pnpm check` does
- what the pre-commit hook runs
- what the pre-push hook runs
- how to install hooks
- why lockfiles are tracked

- [ ] **Step 2: Add CI-ready guidance without adding CI implementation**

Include a short section like:

```md
## CI Contract

Any future CI workflow should call the same repository commands used locally:

- `pnpm install`
- `pnpm check`
```

- [ ] **Step 3: Review the doc for accuracy against the actual scripts**

Run: `Get-Content docs/tooling.md`
Expected: command descriptions match current implementation exactly

- [ ] **Step 4: Commit**

```bash
git add docs/tooling.md
git commit -m "docs: document production tooling workflow"
```

### Task 6: Final Verification

**Files:**

- Verify only: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/package.json`
- Verify only: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.gitignore`
- Verify only: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/eslint.config.mjs`
- Verify only: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/tooling.md`
- Verify only: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-commit`
- Verify only: `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/.githooks/pre-push`

- [ ] **Step 1: Run the full repository verification**

Run: `pnpm check`
Expected: lint, format verification, Rust tests, and frontend build all pass

- [ ] **Step 2: Verify hook installation state**

Run: `git config --get core.hooksPath`
Expected: `.githooks`

- [ ] **Step 3: Capture final repo status**

Run: `git status --short`
Expected: only intended tooling changes remain

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json eslint.config.mjs docs/tooling.md .githooks
git commit -m "build: finalize production tooling baseline"
```
