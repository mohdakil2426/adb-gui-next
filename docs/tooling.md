# Tooling Workflow

## Production Baseline

- `package.json` is the source of truth for repo quality commands.
- ESLint handles JavaScript and TypeScript correctness checks.
- Prettier handles frontend and repo text-file formatting.
- `cargo fmt` and `cargo clippy -D warnings` define the Rust baseline.
- `pnpm check` is the canonical full-project verification command.
- `pnpm-lock.yaml` and `src-tauri/Cargo.lock` stay tracked for reproducible app builds.

## Frontend Quality Commands

- `pnpm lint:web`
  Runs ESLint with the flat config in `eslint.config.mjs`.
  Current behavior: passes with warnings, fails on lint errors.

- `pnpm lint:web:fix`
  Runs ESLint with auto-fix where supported.

- `pnpm format:web`
  Runs Prettier write mode across the root project, excluding paths in `.prettierignore`.

- `pnpm format:web:check`
  Verifies Prettier formatting without modifying files.

## Rust Quality Commands

- `pnpm lint:rust`
  Runs `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
  Generated protobuf code is exempted with `#[allow(dead_code, clippy::all)]` in `src-tauri/src/payload.rs` so strict clippy remains focused on handwritten Rust.

- `pnpm format:rust`
  Runs `cargo fmt --manifest-path src-tauri/Cargo.toml --all`.

- `pnpm format:rust:check`
  Runs `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`.

## Combined Commands

- `pnpm check:fast`
  Runs the fast local verification used by `pre-commit`:
  1. `pnpm lint`
  2. `pnpm format:check`

- `pnpm lint`
  Runs both web and Rust lint commands.

- `pnpm format`
  Runs both web and Rust formatting commands.

- `pnpm format:check`
  Runs both web and Rust formatting verification commands.

- `pnpm check`
  Full verification command:
  1. `pnpm lint`
  2. `pnpm format:check`
  3. `cargo test --manifest-path src-tauri/Cargo.toml`
  4. `pnpm build`

## Git Hooks

- `pnpm hooks:install`
  Sets `core.hooksPath` to the tracked `.githooks` directory for this repository.

- `pnpm hooks:status`
  Prints the currently configured git hooks path.

Tracked hook behavior:

- `pre-commit`
  Runs `pnpm check:fast` so commits get a quick production-baseline sanity check.

- `pre-push`
  Runs `pnpm check` so pushes are blocked when the full project verification fails.

Windows support notes:

- `.githooks/pre-commit` and `.githooks/pre-push` are the git hook entrypoints.
- `.cmd` wrappers are included so the same checks can be executed directly from Command Prompt or PowerShell during local smoke testing.
- `.gitattributes` pins LF for shell hooks and CRLF for `.cmd` files to avoid hook breakage across environments.

## Live Development

- `pnpm dev`
  Starts the Vite frontend dev server.

- `pnpm tauri dev`
  Starts Tauri desktop development mode using:
  - `beforeDevCommand`: `pnpm dev`
  - `devUrl`: `http://localhost:1420`

## Config Files

- `.editorconfig`
  Shared indentation, line ending, and whitespace defaults.

- `.prettierrc.json`
  Prettier code style configuration.

- `.prettierignore`
  Excludes generated, preserved-reference, and local-artifact paths from Prettier.

- `eslint.config.mjs`
  ESLint flat config for React + TypeScript + Vite.

- `.gitattributes`
  Normalizes repository line endings and protects hook script line endings.

- `.githooks/`
  Tracked git hook scripts for `pre-commit` and `pre-push`.

- `rustfmt.toml`
  Rust formatting defaults.

## Current Quality Posture

- React Strict Mode is enabled in `src/main.tsx`.
- TypeScript `strict` mode is enabled in `tsconfig.json`.
- ESLint is configured with practical React/TypeScript rules plus React Hooks and React Refresh guidance.
- Prettier is the formatting source of truth for the web/frontend side.
- `cargo fmt` and `cargo clippy -D warnings` are the Rust quality baseline.
- `pnpm check` is the main command to run before claiming the repo is healthy.

## CI Contract

Any future CI workflow should call the same repository commands used locally:

- `pnpm install`
- `pnpm check`
