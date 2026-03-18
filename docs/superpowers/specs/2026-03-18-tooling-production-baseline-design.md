# Production Tooling Baseline Design

## Summary

ADB GUI Next should use a practical production-ready tooling baseline that is strict enough to protect `main` without making day-to-day work fragile. The repo already uses the right core stack for this direction: Tauri 2, Vite, React 19, TypeScript, ESLint flat config, Prettier, Cargo, and Rustfmt/Clippy. The goal of this change is to standardize how those tools are enforced, close git hygiene gaps, and make the setup reproducible for both local development and future CI.

## Goals

- Keep the current Tauri 2 + Vite script model aligned with official docs.
- Use one canonical verification contract for the whole repository.
- Enforce fast local checks before commits and stronger checks before pushes.
- Keep formatting and linting responsibilities separate and predictable.
- Track lockfiles for reproducible builds.
- Improve contributor onboarding with clear workflow documentation.

## Non-Goals

- Adding a CI workflow in this pass.
- Enforcing commit message conventions.
- Rewriting the current frontend architecture.
- Turning every existing lint warning into a hard failure if that creates avoidable migration churn.

## Current State

The repository already contains:

- `package.json` scripts for frontend and Rust verification
- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `.editorconfig`
- `rustfmt.toml`
- `docs/tooling.md`

The main gaps are:

- No repository-managed git hooks are active
- `.gitignore` ignores `pnpm-lock.yaml` and `src-tauri/Cargo.lock`
- The production workflow is documented, but not fully enforced end-to-end

## Official Guidance Used

- ESLint v9 flat config should use `defineConfig`, recommended config composition, and a dedicated ignore block.
- Prettier should use a root configuration file plus `.prettierignore`, and should remain the formatting authority instead of overlapping with stylistic lint rules.
- Tauri 2 projects should keep standard frontend scripts such as `dev`, `build`, `preview`, and `tauri`, with Tauri config delegating frontend lifecycle through `beforeDevCommand` and `beforeBuildCommand`.

## Recommended Approach

Use a recommended production baseline:

1. Keep the current official Tauri-style script structure intact.
2. Treat `package.json` commands as the only source of truth for verification.
3. Fix `.gitignore` so build outputs stay ignored while lockfiles remain tracked.
4. Add repository-managed git hooks for `pre-commit` and `pre-push`.
5. Keep the hook commands thin so they call package scripts rather than duplicating logic.
6. Document a CI-ready contract so a future pipeline can reuse the same commands unchanged.

## Tooling Design

### 1. Canonical Commands

The repository should expose clear command layers:

- Local development:
  - `pnpm dev`
  - `pnpm tauri dev`
- Fast local quality:
  - `pnpm lint`
  - `pnpm format:check`
- Full verification:
  - `pnpm check`

`pnpm check` should remain the canonical full-project validation command. Any future CI job should call this command or a small number of commands that directly compose it.

### 2. Linting

ESLint should remain in flat config mode and stay focused on correctness and maintainability concerns for the web frontend. It should continue to:

- Ignore generated output, bundled references, and build directories
- Use recommended JavaScript and TypeScript rules
- Use React Hooks and React Refresh guidance
- Avoid duplicating formatting concerns that Prettier already owns

The config should stay practical rather than dogmatic. Existing warnings that represent real cleanup work may remain warnings initially if promoting them to errors would block normal development without a targeted cleanup pass.

### 3. Formatting

Prettier should be the formatting authority for frontend and repo text files, backed by:

- `.prettierrc.json`
- `.prettierignore`
- `.editorconfig`

Rust formatting should remain owned by `cargo fmt` and `rustfmt.toml`.

This split keeps each ecosystem using its native formatter while still presenting a single repo-wide workflow.

### 4. Git Hooks

The repository should manage hooks through a tracked hooks directory and a simple setup command. The design should work well on Windows because this repository is Windows-first.

Recommended hook behavior:

- `pre-commit`
  - Run lightweight checks only
  - Prefer fast validation so the hook remains usable
  - Keep scope narrow enough that small commits stay fast
- `pre-push`
  - Run full repository verification
  - Fail the push if the production baseline is not healthy

The hook scripts should not embed business logic. They should call existing package scripts so local behavior and future CI behavior stay aligned.

### 5. Git Hygiene

`.gitignore` should ignore:

- `node_modules/`
- `dist/`
- `src-tauri/target/`
- local logs and temporary files
- editor-specific directories
- machine-local files such as `.mcp.json`

`.gitignore` should not ignore:

- `pnpm-lock.yaml`
- `src-tauri/Cargo.lock`

This project is an application, not a general-purpose library, so tracked lockfiles improve reproducibility and release safety.

### 6. Documentation

`docs/tooling.md` should explain:

- which commands contributors should run
- what each command is for
- which hook runs when
- which files define formatting and linting behavior
- what “production ready” means for this repo

The README does not need a full rewrite in this pass if `docs/tooling.md` already serves as the workflow source of truth.

## File Plan

Expected touched files:

- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `docs/tooling.md`
- Modify if needed: `eslint.config.mjs`
- Create: repo-managed hook files
- Create or modify: hook setup documentation

Expected untouched unless needed by verification:

- `src/` application code
- `src-tauri/src/` backend implementation
- Tauri config files already aligned with official script delegation

## Validation Plan

The final implementation should be validated with:

- hook installation/setup command
- `pnpm lint`
- `pnpm format:check`
- `pnpm check`
- a dry-run style check that the git hook path points to the tracked hooks directory

## Risks

- Making hooks too slow will encourage bypassing them
- Turning all current warnings into errors too early may create friction unrelated to this tooling pass
- Hook setup must be explicit and documented so contributors do not assume hooks are active when they are not

## Recommendation

Implement the recommended production baseline:

- strict enough to guard the app
- simple enough to maintain
- aligned with official ESLint, Prettier, and Tauri guidance
- ready for future CI without forcing CI wiring in the same change
