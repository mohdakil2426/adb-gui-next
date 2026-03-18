# AGENTS.md

## Code Quality Principles

MANDATORY RULE: Never violate, forget, or skip these rules.

### 1. Readability First

- Code is read more than written
- Prefer clear variable and function names
- Prefer self-documenting code over comments
- Keep formatting consistent

### 2. KISS

- Choose the simplest solution that works
- Avoid over-engineering
- Do not optimize prematurely
- Easy to understand beats clever

### 3. DRY

- Extract repeated logic into functions
- Create reusable components when it helps
- Share utilities across modules
- Avoid copy-paste programming

### 4. YAGNI

- Do not build features before they are needed
- Avoid speculative generality
- Add complexity only when it is required
- Start simple and refactor when there is a clear need

## Memory Bank

This project uses a Memory Bank because session memory is not assumed to persist. Every task must begin by reading all core memory-bank files before planning or editing code.

### Required Files

Read all of these at the start of every task:

1. `memory-bank/projectbrief.md`
2. `memory-bank/productContext.md`
3. `memory-bank/activeContext.md`
4. `memory-bank/systemPatterns.md`
5. `memory-bank/techContext.md`
6. `memory-bank/progress.md`

### Purpose Of The Memory Bank

- `projectbrief.md`: project scope and goals
- `productContext.md`: why the project exists and UX goals
- `activeContext.md`: current focus, recent changes, next steps
- `systemPatterns.md`: architecture and design patterns
- `techContext.md`: stack, tooling, and constraints
- `progress.md`: what works, what remains, and known risks

### Memory Bank Update Rules

Update the Memory Bank when:

1. You discover new project patterns
2. You finish significant changes
3. The user explicitly says `update memory bank`
4. Existing context is unclear or outdated

When the user says `update memory bank`, review every memory-bank file even if only some files need edits.

## Project Notes

- This is a Tauri 2 desktop app with React, TypeScript, Vite, and Rust.
- `package.json` is the source of truth for repo verification commands.
- Use official documentation when changing tooling or framework setup.
- Prefer tracked lockfiles for reproducible application builds.
- The legacy archive under `docs/` is reference-only and ignored by Git. Do not rely on it as tracked project history or as a live app dependency.

## Tooling Baseline

Primary commands:

- `pnpm lint`
- `pnpm format:check`
- `pnpm check`

Before claiming work is complete, run the appropriate fresh verification command and confirm the actual output.

## Git And Safety Rules

- Never revert user changes unless explicitly asked
- Avoid destructive git commands
- Keep changes scoped to the task
- If the repo is dirty, work with existing changes carefully instead of resetting them
- If a path is ignored intentionally, do not reintroduce it to tracking without user approval

## Documentation Rules

- Keep instructions practical and current
- Update project docs when workflows or tool contracts change
- Prefer concise, high-signal documentation over long narrative text
