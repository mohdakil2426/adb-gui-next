# ADB GUI Next — Agent Guide

ADB GUI Next is a **desktop-only Tauri 2** Android toolkit (ADB, fastboot, file explorer, flasher, debloat, marketplace, payload dumper, emulator, scrcpy). Stack: React 19 · TypeScript · Vite · Tailwind v4 · shadcn · Zustand · TanStack Query · Rust 2024 · Bun. **Windows and Linux x64 first-class.** macOS: **code may exist, builds paused** (not first-class until unpaused). Browser/Next.js/Electron out of scope. Platform policy: `docs/project_rules.md`.

This root guide is a **router** plus durable **cross-module** rules. Frontend implementation lives in `src/AGENTS.md`. Backend implementation lives in `src-tauri/AGENTS.md`.

## Instruction model

- Follow platform, developer, and current-user instructions first.
- Read this guide, then the **closest** module `AGENTS.md` to paths you edit (`src/` or `src-tauri/`).
- Nested module guide closer to the path applies after root.
- Module guides own local implementation. `docs/project_rules.md` owns workflow, reports, verification, and hard stops. `docs/architecture.md` owns cross-module design. `DESIGN.md` owns look and feel — **only when the task is UI**.
- If a module guide and project rules conflict → **stop and ask**.

## Start every scoped task

1. Find affected paths → read the closest module `AGENTS.md` before edits.
2. Read only docs the routing table points to (plus live code).
3. Run `git status --short` before edits; preserve unrelated user changes.
4. Commits, pushes, PRs, and destructive actions need an **explicit** user request.
5. Keep changes surgical. Define success as a command or reproducible behavior.

## Routing table

| Task                                         | Required guidance                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Workflow, reports, hard stops, quality gates | `docs/project_rules.md`                                                                                              |
| Cross-module design / data flow / IPC map    | `docs/architecture.md`                                                                                               |
| Visual design, theme, type, shared UI taste  | `DESIGN.md` — **read only when changing UI** (tokens, layout, components, theme). Skip for Rust/IPC/non-visual work. |
| Entire frontend (`src/**`)                   | `src/AGENTS.md`                                                                                                      |
| Entire Rust backend (`src-tauri/**`)         | `src-tauri/AGENTS.md` (payload domain: `src-tauri/src/payload/AGENTS.md`)                                            |
| FE lint standards (Ultracite)                | `.agents/skills/utils/ultracite/SKILL.md` · `.agents/rules/ultracite.md`                                             |
| Living session context (not architecture)    | `memory-bank/` — read before non-trivial work; verify against code                                                   |

## Project map

| Path                           | Owns                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `src/`                         | Full React/Vite client (see `src/AGENTS.md`)             |
| `src/main.tsx`, `src/app/`     | Bootstrap, shell, MainLayout, view map, BottomPanel      |
| `src/desktop/`                 | Only raw Tauri invoke / events / file-drop / models      |
| `src/features/`                | Product views and feature-local state                    |
| `src/shared/`                  | Cross-feature components, stores, shadcn, shared utils   |
| `src/styles/`                  | Theme tokens (`global.css`)                              |
| `DESIGN.md`                    | UI system (taste, tokens, components) — UI tasks only    |
| `src/test/`                    | All Vitest frontend tests                                |
| `src-tauri/`                   | Rust lib, thin commands, domains, bundled platform-tools |
| `docs/architecture.md`         | Cross-module architecture reference                      |
| `docs/project_rules.md`        | Workflow, reports, hard stops                            |
| `docs/internal/reports/`       | Audits / research / validation write-ups                 |
| `package.json` / `biome.jsonc` | Scripts, lint-staged, Ultracite config                   |

## Non-negotiable cross-module boundaries

- **Desktop-only.** No Next.js, no browser-first routing, no Electron.
- **IPC only through `src/desktop/`.** Features must not call raw `core.invoke` or raw Tauri event APIs.
- **Thin Rust commands, fat domains.** Logic in `src-tauri/src/{payload,marketplace,emulator,debloat,host_setup}/` or `helpers.rs`; not bloated `commands/*` bodies.
- **No React Router.** View switching is `ViewType` + `VIEW_RENDERERS` in the shell.
- **One global device poll** in `MainLayout` (30s). Do not add per-view device polling.
- **Feature code** under `src/features/<feature>/`. **shadcn** under `src/shared/ui/`. **Theme tokens** in `src/styles/global.css` (no hard-coded colors in components).
- **IPC DTOs** live in `src/desktop/models.ts` and match Rust `camelCase` serde.
- **New production deps** only with clear user-visible payoff; prefer existing stack. **Vet frontend deps for module-eval prototype writes** — `freezePrototype: true` makes any `SomeBuiltin.prototype.x = …` at import time a `TypeError` that kills the view, and it reproduces _only_ in the webview (never in `vite build`, Vitest, or the browser preview). This is why there is no charting library.
- **Container queries, not viewport breakpoints.** Window `minWidth` is 1024, so `sm:`/`md:` can never evaluate false; content width tracks the sidebar, not the viewport. See `docs/architecture.md` §12.1.
- **React Doctor:** target **100/100**. FE correctness rules live in `src/AGENTS.md` (pure updaters, effect cleanup, LazyMotion, no height anim, no dead unused UI / suppressions). Multi-APK install stays **serial**.

Keep this list short. Implementation detail stays in module guides.

## Change and documentation safety

- If docs and code disagree, inspect source and tests before changing docs.
- Module rules stay in module guides. Root only gets durable repo-wide rules.
- New cross-module contracts update `docs/architecture.md` and every affected module guide.
- One owner per topic; duplicates become a short pointer to the owner.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun x ultracite fix` before committing to ensure compliance.
