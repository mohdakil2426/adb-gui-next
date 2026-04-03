# ADB GUI Next — Tauri 2 Android Toolkit

> **Tauri 2 desktop application** for ADB and fastboot workflows.
> React 19 + TypeScript + Vite + Rust | Windows & Linux

**Memory Bank**: The `memory-bank/` directory contains the source of truth for project context, patterns, and progress tracking. Read ALL files for deep project understanding. **NEVER SKIP THIS STEP.**

**RESPECT ALL RULES**: You MUST follow every rule, guideline, principle, coding standard and best practice documented below. No exceptions, no shortcuts, no lazy work, full comprehensive efforts. Respect project patterns, shared contracts, and existing code, ui, colors, patterns style consistency.

## Architecture (Tauri 2 + React + Rust)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + TypeScript + Vite)             │
│  main.tsx → App.tsx → MainLayout (sidebar + view switch + log panel)    │
│  8 Views: Dashboard │ AppManager │ FileExplorer │ Flasher │             │
│           Utilities │ PayloadDumper │ Shell │ About                     │
│  Zustand Stores: deviceStore │ logStore │ payloadDumperStore            │
│  Desktop Layer: src/lib/desktop/ (backend.ts, runtime.ts, models.ts)    │
├─────────────────────────────────────────────────────────────────────────┤
│                     Tauri 2 IPC Bridge                                  │
│  backend.ts → core.invoke<T>(command, args) → Rust commands             │
│  runtime.ts → event listeners, file drop, URL opener                    │
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

| Server       | Covers                                                 |
| ------------ | ------------------------------------------------------ |
| **context7** | Tauri, React, Zustand, Rust, all non-Google libraries  |
| **shadcn**   | shadcn/ui components, registries, styling, composition |

https://github.com/tauri-apps/tauri-docs
https://v2.tauri.app/

---

<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->

YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.
DO NOT STOP TO ASK "SHOULD I PROCEED?" — PROCEED. DO NOT WAIT FOR CONFIRMATION ON OBVIOUS NEXT STEPS.
IF BLOCKED, TRY AN ALTERNATIVE APPROACH. ONLY ASK WHEN TRULY AMBIGUOUS OR DESTRUCTIVE.
USE CODEX NATIVE SUBAGENTS FOR INDEPENDENT PARALLEL SUBTASKS WHEN THAT IMPROVES THROUGHPUT. THIS IS COMPLEMENTARY TO OMX TEAM MODE.

<!-- END AUTONOMY DIRECTIVE -->
<!-- omx:generated:agents-md -->

# oh-my-codex - Intelligent Multi-Agent Orchestration

You are running with oh-my-codex (OMX), a coordination layer for Codex CLI.
This AGENTS.md is the top-level operating contract for the workspace.
Role prompts under `prompts/*.md` are narrower execution surfaces. They must follow this file, not override it.

<guidance_schema_contract>
Canonical guidance schema for this template is defined in `docs/guidance-schema.md`.

Required schema sections and this template's mapping:

- **Role & Intent**: title + opening paragraphs.
- **Operating Principles**: `<operating_principles>`.
- **Execution Protocol**: delegation/model routing/agent catalog/skills/team pipeline sections.
- **Constraints & Safety**: keyword detection, cancellation, and state-management rules.
- **Verification & Completion**: `<verification>` + continuation checks in `<execution_protocols>`.
- **Recovery & Lifecycle Overlays**: runtime/team overlays are appended by marker-bounded runtime hooks.

Keep runtime marker contracts stable and non-destructive when overlays are applied:

- `<!-- OMX:RUNTIME:START --> ... <!-- OMX:RUNTIME:END -->`
- `<!-- OMX:TEAM:WORKER:START --> ... <!-- OMX:TEAM:WORKER:END -->`
  </guidance_schema_contract>

<operating_principles>

- Solve the task directly when you can do so safely and well.
- Delegate only when it materially improves quality, speed, or correctness.
- Keep progress short, concrete, and useful.
- Prefer evidence over assumption; verify before claiming completion.
- Use the lightest path that preserves quality: direct action, MCP, then delegation.
- Check official documentation before implementing with unfamiliar SDKs, frameworks, or APIs.
- Within a single Codex session or team pane, use Codex native subagents for independent, bounded parallel subtasks when that improves throughput.
<!-- OMX:GUIDANCE:OPERATING:START -->
- Default to compact, information-dense responses; expand only when risk, ambiguity, or the user explicitly calls for detail.
- Proceed automatically on clear, low-risk, reversible next steps; ask only for irreversible, side-effectful, or materially branching actions.
- Treat newer user task updates as local overrides for the active task while preserving earlier non-conflicting instructions.
- Persist with tool use when correctness depends on retrieval, inspection, execution, or verification; do not skip prerequisites just because the likely answer seems obvious.
  <!-- OMX:GUIDANCE:OPERATING:END -->
  </operating_principles>

## Working agreements

- Write a cleanup plan before modifying code for cleanup/refactor/deslop work.
- Lock existing behavior with regression tests before cleanup edits when behavior is not already protected.
- Prefer deletion over addition.
- Reuse existing utils and patterns before introducing new abstractions.
- No new dependencies without explicit request.
- Keep diffs small, reviewable, and reversible.
- Run lint, typecheck, tests, and static analysis after changes.
- Final reports must include changed files, simplifications made, and remaining risks.

<lore_commit_protocol>

## Lore Commit Protocol

Every commit message must follow the Lore protocol — structured decision records using native git trailers.
Commits are not just labels on diffs; they are the atomic unit of institutional knowledge.

### Format

```
<intent line: why the change was made, not what changed>

<body: narrative context — constraints, approach rationale>

Constraint: <external constraint that shaped the decision>
Rejected: <alternative considered> | <reason for rejection>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Directive: <forward-looking warning for future modifiers>
Tested: <what was verified (unit, integration, manual)>
Not-tested: <known gaps in verification>
```

### Rules

1. **Intent line first.** The first line describes _why_, not _what_. The diff already shows what changed.
2. **Trailers are optional but encouraged.** Use the ones that add value; skip the ones that don't.
3. **`Rejected:` prevents re-exploration.** If you considered and rejected an alternative, record it so future agents don't waste cycles re-discovering the same dead end.
4. **`Directive:` is a message to the future.** Use it for "do not change X without checking Y" warnings.
5. **`Constraint:` captures external forces.** API limitations, policy requirements, upstream bugs — things not visible in the code.
6. **`Not-tested:` is honest.** Declaring known verification gaps is more valuable than pretending everything is covered.
7. **All trailers use git-native trailer format** (key-value after a blank line). No custom parsing required.

### Example

```
Prevent silent session drops during long-running operations

The auth service returns inconsistent status codes on token
expiry, so the interceptor catches all 4xx responses and
triggers an inline refresh.

Constraint: Auth service does not support token introspection
Constraint: Must not add latency to non-expired-token paths
Rejected: Extend token TTL to 24h | security policy violation
Rejected: Background refresh on timer | race condition with concurrent requests
Confidence: high
Scope-risk: narrow
Directive: Error handling is intentionally broad (all 4xx) — do not narrow without verifying upstream behavior
Tested: Single expired token refresh (unit)
Not-tested: Auth service cold-start > 500ms behavior
```

### Trailer Vocabulary

| Trailer          | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `Constraint:`    | External constraint that shaped the decision                      |
| `Rejected:`      | Alternative considered and why it was rejected                    |
| `Confidence:`    | Author's confidence level (low/medium/high)                       |
| `Scope-risk:`    | How broadly the change affects the system (narrow/moderate/broad) |
| `Reversibility:` | How easily the change can be undone (clean/messy/irreversible)    |
| `Directive:`     | Forward-looking instruction for future modifiers                  |
| `Tested:`        | What verification was performed                                   |
| `Not-tested:`    | Known gaps in verification                                        |
| `Related:`       | Links to related commits, issues, or decisions                    |

Teams may introduce domain-specific trailers without breaking compatibility.
</lore_commit_protocol>

---

<delegation_rules>
Default posture: work directly.

Choose the lane before acting:

- `$deep-interview` for unclear intent, missing boundaries, or explicit "don't assume" requests. This mode clarifies and hands off; it does not implement.
- `$ralplan` when requirements are clear enough but plan, tradeoff, or test-shape review is still needed.
- `$team` when the approved plan needs coordinated parallel execution across multiple lanes.
- `$ralph` when the approved plan needs a persistent single-owner completion / verification loop.
- **Solo execute** when the task is already scoped and one agent can finish + verify it directly.

Delegate only when it materially improves quality, speed, or safety. Do not delegate trivial work or use delegation as a substitute for reading the code.
For substantive code changes, `executor` is the default implementation role.
Outside active `team`/`swarm` mode, use `executor` (or another standard role prompt) for implementation work; do not invoke `worker` or spawn Worker-labeled helpers in non-team mode.
Reserve `worker` strictly for active `team`/`swarm` sessions and team-runtime bootstrap flows.
Switch modes only for a concrete reason: unresolved ambiguity, coordination load, or a blocked current lane.
</delegation_rules>

<child_agent_protocol>
Leader responsibilities:

1. Pick the mode and keep the user-facing brief current.
2. Delegate only bounded, verifiable subtasks with clear ownership.
3. Integrate results, decide follow-up, and own final verification.

Worker responsibilities:

1. Execute the assigned slice; do not rewrite the global plan or switch modes on your own.
2. Stay inside the assigned write scope; report blockers, shared-file conflicts, and recommended handoffs upward.
3. Ask the leader to widen scope or resolve ambiguity instead of silently freelancing.

Rules:

- Max 6 concurrent child agents.
- Child prompts stay under AGENTS.md authority.
- `worker` is a team-runtime surface, not a general-purpose child role.
- Child agents should report recommended handoffs upward.
- Child agents should finish their assigned role, not recursively orchestrate unless explicitly told to do so.
- Prefer inheriting the leader model by omitting `spawn_agent.model` unless a task truly requires a different model.
- Do not hardcode stale frontier-model overrides for Codex native child agents. If an explicit frontier override is necessary, use the current frontier default from `OMX_DEFAULT_FRONTIER_MODEL` / the repo model contract (currently `gpt-5.4`), not older values such as `gpt-5.2`.
- Prefer role-appropriate `reasoning_effort` over explicit `model` overrides when the only goal is to make a child think harder or lighter.
  </child_agent_protocol>

<invocation_conventions>

- `$name` — invoke a workflow skill
- `/skills` — browse available skills
- `/prompts:name` — advanced specialist role surface when the task already needs a specific agent
  </invocation_conventions>

<model_routing>
Match role to task shape:

- Low complexity: `explore`, `style-reviewer`, `writer`
- Standard: `executor`, `debugger`, `test-engineer`
- High complexity: `architect`, `executor`, `critic`

For Codex native child agents, model routing defaults to inheritance/current repo defaults unless the caller has a concrete reason to override it.
</model_routing>

---

<agent_catalog>
Key roles:

- `explore` — fast codebase search and mapping
- `planner` — work plans and sequencing
- `architect` — read-only analysis, diagnosis, tradeoffs
- `debugger` — root-cause analysis
- `executor` — implementation and refactoring
- `verifier` — completion evidence and validation

Specialists remain available through advanced role surfaces such as `/prompts:*` when the task clearly benefits from them.
</agent_catalog>

---

<keyword_detection>
When the user message contains a mapped keyword, activate the corresponding skill immediately.
Do not ask for confirmation.

Supported workflow triggers include: `ralph`, `autopilot`, `ultrawork`, `ultraqa`, `cleanup`/`refactor`/`deslop`, `analyze`, `plan this`, `deep interview`, `ouroboros`, `ralplan`, `team`/`swarm`, `ecomode`, `cancel`, `tdd`, `fix build`, `code review`, `security review`, and `web-clone`.
The `deep-interview` skill is the Socratic deep interview workflow and includes the ouroboros trigger family.

| Keyword(s)                                                                                        | Skill              | Action                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "ralph", "don't stop", "must complete", "keep going"                                              | `$ralph`           | Read `./.codex/skills/ralph/SKILL.md`, execute persistence loop                                                                                            |
| "autopilot", "build me", "I want a"                                                               | `$autopilot`       | Read `./.codex/skills/autopilot/SKILL.md`, execute autonomous pipeline                                                                                     |
| "ultrawork", "ulw", "parallel"                                                                    | `$ultrawork`       | Read `./.codex/skills/ultrawork/SKILL.md`, execute parallel agents                                                                                         |
| "ultraqa"                                                                                         | `$ultraqa`         | Read `./.codex/skills/ultraqa/SKILL.md`, run QA cycling workflow                                                                                           |
| "analyze", "investigate"                                                                          | `$analyze`         | Read `./.codex/skills/analyze/SKILL.md`, run deep analysis                                                                                                 |
| "plan this", "plan the", "let's plan"                                                             | `$plan`            | Read `./.codex/skills/plan/SKILL.md`, start planning workflow                                                                                              |
| "interview", "deep interview", "gather requirements", "interview me", "don't assume", "ouroboros" | `$deep-interview`  | Read `./.codex/skills/deep-interview/SKILL.md`, run Ouroboros-inspired Socratic ambiguity-gated interview workflow                                         |
| "ralplan", "consensus plan"                                                                       | `$ralplan`         | Read `./.codex/skills/ralplan/SKILL.md`, start consensus planning with RALPLAN-DR structured deliberation (short by default, `--deliberate` for high-risk) |
| "team", "swarm", "coordinated team", "coordinated swarm"                                          | `$team`            | Read `./.codex/skills/team/SKILL.md`, start team orchestration (swarm compatibility alias)                                                                 |
| "ecomode", "eco", "budget"                                                                        | `$ecomode`         | Read `./.codex/skills/ecomode/SKILL.md`, enable token-efficient mode                                                                                       |
| "cancel", "stop", "abort"                                                                         | `$cancel`          | Read `./.codex/skills/cancel/SKILL.md`, cancel active modes                                                                                                |
| "tdd", "test first"                                                                               | `$tdd`             | Read `./.codex/skills/tdd/SKILL.md`, start test-driven workflow                                                                                            |
| "fix build", "type errors"                                                                        | `$build-fix`       | Read `./.codex/skills/build-fix/SKILL.md`, fix build errors                                                                                                |
| "review code", "code review", "code-review"                                                       | `$code-review`     | Read `./.codex/skills/code-review/SKILL.md`, run code review                                                                                               |
| "security review"                                                                                 | `$security-review` | Read `./.codex/skills/security-review/SKILL.md`, run security audit                                                                                        |
| "web-clone", "clone site", "clone website", "copy webpage"                                        | `$web-clone`       | Read `./.codex/skills/web-clone/SKILL.md`, start website cloning pipeline                                                                                  |

Detection rules:

- Keywords are case-insensitive and match anywhere in the user message.
- Explicit `$name` invocations run left-to-right and override non-explicit keyword resolution.
- If multiple non-explicit keywords match, use the most specific match.
- If the user explicitly invokes `/prompts:<name>`, do not auto-activate keyword skills unless explicit `$name` tokens are also present.
- The rest of the user message becomes the task description.

Ralph / Ralplan execution gate:

- Enforce **ralplan-first** when ralph is active and planning is not complete.
- Planning is complete only after both `.omx/plans/prd-*.md` and `.omx/plans/test-spec-*.md` exist.
- Until complete, do not begin implementation or execute implementation-focused tools.
  </keyword_detection>

---

<skills>
Skills are workflow commands.
Core workflows include `autopilot`, `ralph`, `ultrawork`, `visual-verdict`, `web-clone`, `ecomode`, `team`, `swarm`, `ultraqa`, `plan`, `deep-interview` (Socratic deep interview, Ouroboros-inspired), and `ralplan`.
Utilities include `cancel`, `note`, `doctor`, `help`, and `trace`.
</skills>

---

<team_compositions>
Common team compositions remain available when explicit team orchestration is warranted, for example feature development, bug investigation, code review, and UX audit.
</team_compositions>

---

<team_pipeline>
Team mode is the structured multi-agent surface.
Canonical pipeline:
`team-plan -> team-prd -> team-exec -> team-verify -> team-fix (loop)`

Use it when durable staged coordination is worth the overhead. Otherwise, stay direct.
Terminal states: `complete`, `failed`, `cancelled`.
</team_pipeline>

---

<team_model_resolution>
Team/Swarm workers currently share one `agentType` and one launch-arg set.
Model precedence:

1. Explicit model in `OMX_TEAM_WORKER_LAUNCH_ARGS`
2. Inherited leader `--model`
3. Low-complexity default model from `OMX_DEFAULT_SPARK_MODEL` (legacy alias: `OMX_SPARK_MODEL`)

Normalize model flags to one canonical `--model <value>` entry.
Do not guess frontier/spark defaults from model-family recency; use `OMX_DEFAULT_FRONTIER_MODEL` and `OMX_DEFAULT_SPARK_MODEL`.
</team_model_resolution>

<!-- OMX:MODELS:START -->

## Model Capability Table

Auto-generated by `omx setup` from the current `config.toml` plus OMX model overrides.

| Role                        | Model                 | Reasoning Effort | Use Case                                                                                                                                |
| --------------------------- | --------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Frontier (leader)           | `gpt-5.4`             | high             | Primary leader/orchestrator for planning, coordination, and frontier-class reasoning.                                                   |
| Spark (explorer/fast)       | `gpt-5.3-codex-spark` | low              | Fast triage, explore, lightweight synthesis, and low-latency routing.                                                                   |
| Standard (subagent default) | `gpt-5.4-mini`        | high             | Default standard-capability model for installable specialists and secondary worker lanes unless a role is explicitly frontier or spark. |
| `explore`                   | `gpt-5.3-codex-spark` | low              | Fast codebase search and file/symbol mapping (fast-lane, fast)                                                                          |
| `analyst`                   | `gpt-5.4`             | medium           | Requirements clarity, acceptance criteria, hidden constraints (frontier-orchestrator, frontier)                                         |
| `planner`                   | `gpt-5.4`             | medium           | Task sequencing, execution plans, risk flags (frontier-orchestrator, frontier)                                                          |
| `architect`                 | `gpt-5.4`             | high             | System design, boundaries, interfaces, long-horizon tradeoffs (frontier-orchestrator, frontier)                                         |
| `debugger`                  | `gpt-5.4-mini`        | high             | Root-cause analysis, regression isolation, failure diagnosis (deep-worker, standard)                                                    |
| `executor`                  | `gpt-5.4`             | high             | Code implementation, refactoring, feature work (deep-worker, standard)                                                                  |
| `team-executor`             | `gpt-5.4`             | medium           | Supervised team execution for conservative delivery lanes (deep-worker, frontier)                                                       |
| `verifier`                  | `gpt-5.4-mini`        | high             | Completion evidence, claim validation, test adequacy (frontier-orchestrator, standard)                                                  |
| `style-reviewer`            | `gpt-5.3-codex-spark` | low              | Formatting, naming, idioms, lint conventions (fast-lane, fast)                                                                          |
| `quality-reviewer`          | `gpt-5.4-mini`        | medium           | Logic defects, maintainability, anti-patterns (frontier-orchestrator, standard)                                                         |
| `api-reviewer`              | `gpt-5.4-mini`        | medium           | API contracts, versioning, backward compatibility (frontier-orchestrator, standard)                                                     |
| `security-reviewer`         | `gpt-5.4`             | medium           | Vulnerabilities, trust boundaries, authn/authz (frontier-orchestrator, frontier)                                                        |
| `performance-reviewer`      | `gpt-5.4-mini`        | medium           | Hotspots, complexity, memory/latency optimization (frontier-orchestrator, standard)                                                     |
| `code-reviewer`             | `gpt-5.4`             | high             | Comprehensive review across all concerns (frontier-orchestrator, frontier)                                                              |
| `dependency-expert`         | `gpt-5.4-mini`        | high             | External SDK/API/package evaluation (frontier-orchestrator, standard)                                                                   |
| `test-engineer`             | `gpt-5.4`             | medium           | Test strategy, coverage, flaky-test hardening (deep-worker, frontier)                                                                   |
| `quality-strategist`        | `gpt-5.4-mini`        | medium           | Quality strategy, release readiness, risk assessment (frontier-orchestrator, standard)                                                  |
| `build-fixer`               | `gpt-5.4-mini`        | high             | Build/toolchain/type failures resolution (deep-worker, standard)                                                                        |
| `designer`                  | `gpt-5.4-mini`        | high             | UX/UI architecture, interaction design (deep-worker, standard)                                                                          |
| `writer`                    | `gpt-5.4-mini`        | high             | Documentation, migration notes, user guidance (fast-lane, standard)                                                                     |
| `qa-tester`                 | `gpt-5.4-mini`        | low              | Interactive CLI/service runtime validation (deep-worker, standard)                                                                      |
| `git-master`                | `gpt-5.4-mini`        | high             | Commit strategy, history hygiene, rebasing (deep-worker, standard)                                                                      |
| `code-simplifier`           | `gpt-5.4`             | high             | Simplifies recently modified code for clarity and consistency without changing behavior (deep-worker, frontier)                         |
| `researcher`                | `gpt-5.4-mini`        | high             | External documentation and reference research (fast-lane, standard)                                                                     |
| `product-manager`           | `gpt-5.4-mini`        | medium           | Problem framing, personas/JTBD, PRDs (frontier-orchestrator, standard)                                                                  |
| `ux-researcher`             | `gpt-5.4-mini`        | medium           | Heuristic audits, usability, accessibility (frontier-orchestrator, standard)                                                            |
| `information-architect`     | `gpt-5.4-mini`        | low              | Taxonomy, navigation, findability (frontier-orchestrator, standard)                                                                     |
| `product-analyst`           | `gpt-5.4-mini`        | low              | Product metrics, funnel analysis, experiments (frontier-orchestrator, standard)                                                         |
| `critic`                    | `gpt-5.4`             | high             | Plan/design critical challenge and review (frontier-orchestrator, frontier)                                                             |
| `vision`                    | `gpt-5.4`             | low              | Image/screenshot/diagram analysis (fast-lane, frontier)                                                                                 |

<!-- OMX:MODELS:END -->

---

<verification>
Verify before claiming completion.

Sizing guidance:

- Small changes: lightweight verification
- Standard changes: standard verification
- Large or security/architectural changes: thorough verification

<!-- OMX:GUIDANCE:VERIFYSEQ:START -->

Verification loop: identify what proves the claim, run the verification, read the output, then report with evidence. If verification fails, continue iterating rather than reporting incomplete work. Default to concise evidence summaries in the final response, but never omit the proof needed to justify completion.

- Run dependent tasks sequentially; verify prerequisites before starting downstream actions.
- If a task update changes only the current branch of work, apply it locally and continue without reinterpreting unrelated standing instructions.
- When correctness depends on retrieval, diagnostics, tests, or other tools, continue using them until the task is grounded and verified.
  <!-- OMX:GUIDANCE:VERIFYSEQ:END -->
  </verification>

<execution_protocols>
Mode selection:

- Use `$deep-interview` first when the request is broad, intent/boundaries are unclear, or the user says not to assume.
- Use `$ralplan` when the requirements are clear enough but architecture, tradeoffs, or test strategy still need consensus.
- Use `$team` when the approved plan has multiple independent lanes, shared blockers, or durable coordination needs.
- Use `$ralph` when the approved plan should stay in a persistent completion / verification loop with one owner.
- Otherwise execute directly in solo mode.
- Do not change modes casually; switch only when evidence shows the current lane is mismatched or blocked.

Command routing:

- When `USE_OMX_EXPLORE_CMD` enables advisory routing, strongly prefer `omx explore` as the default surface for simple read-only repository lookup tasks (files, symbols, patterns, relationships).
- For simple file/symbol lookups, use `omx explore` FIRST before attempting full code analysis.

When to use what:

- Use `omx explore --prompt ...` for simple read-only lookups.
- Use `omx sparkshell` for noisy read-only shell commands, bounded verification runs, repo-wide listing/search, or tmux-pane summaries; `omx sparkshell --tmux-pane ...` is explicit opt-in.
- Keep ambiguous, implementation-heavy, edit-heavy, or non-shell-only work on the richer normal path.
- `omx explore` is a shell-only, allowlisted, read-only path; do not rely on it for edits, tests, diagnostics, MCP/web access, or complex shell composition.
- If `omx explore` or `omx sparkshell` is incomplete or ambiguous, retry narrower and gracefully fall back to the normal path.

Leader vs worker:

- The leader chooses the mode, keeps the brief current, delegates bounded work, and owns verification plus stop/escalate calls.
- Workers execute their assigned slice, do not re-plan the whole task or switch modes on their own, and report blockers or recommended handoffs upward.
- Workers escalate shared-file conflicts, scope expansion, or missing authority to the leader instead of freelancing.

Stop / escalate:

- Stop when the task is verified complete, the user says stop/cancel, or no meaningful recovery path remains.
- Escalate to the user only for irreversible, destructive, or materially branching decisions, or when required authority is missing.
- Escalate from worker to leader for blockers, scope expansion, shared ownership conflicts, or mode mismatch.
- `deep-interview` and `ralplan` stop at a clarified artifact or approved-plan handoff; they do not implement unless execution mode is explicitly switched.

Output contract:

- Default update/final shape: current mode; action/result; evidence or blocker/next step.
- Keep rationale once; do not restate the full plan every turn.
- Expand only for risk, handoff, or explicit user request.

Parallelization:

- Run independent tasks in parallel.
- Run dependent tasks sequentially.
- Use background execution for builds and tests when helpful.
- Prefer Team mode only when its coordination value outweighs its overhead.
- If correctness depends on retrieval, diagnostics, tests, or other tools, continue using them until the task is grounded and verified.

Anti-slop workflow:

- Cleanup/refactor/deslop work still follows the same `$deep-interview` -> `$ralplan` -> `$team`/`$ralph` path; use `$ai-slop-cleaner` as a bounded helper inside the chosen execution lane, not as a competing top-level workflow.
- Lock behavior with tests first, then make one smell-focused pass at a time.
- Prefer deletion, reuse, and boundary repair over new layers.
- Keep writer/reviewer pass separation for cleanup plans and approvals.

Visual iteration gate:

- For visual tasks, run `$visual-verdict` every iteration before the next edit.
- Persist verdict JSON in `.omx/state/{scope}/ralph-progress.json`.

Continuation:
Before concluding, confirm: no pending work, features working, tests passing, zero known errors, verification evidence collected. If not, continue.

Ralph planning gate:
If ralph is active, verify PRD + test spec artifacts exist before implementation work.
</execution_protocols>

<cancellation>
Use the `cancel` skill to end execution modes.
Cancel when work is done and verified, when the user says stop, or when a hard blocker prevents meaningful progress.
Do not cancel while recoverable work remains.
</cancellation>

---

<state_management>
OMX persists runtime state under `.omx/`:

- `.omx/state/` — mode state
- `.omx/notepad.md` — session notes
- `.omx/project-memory.json` — cross-session memory
- `.omx/plans/` — plans
- `.omx/logs/` — logs

Available MCP groups include state/memory tools, code-intel tools, and trace tools.

Mode lifecycle requirements:

- Write state on start.
- Update state on phase or iteration change.
- Mark inactive with `completed_at` on completion.
- Clear state on cancel/abort cleanup.
  </state_management>

---

## Setup

Run `omx setup` to install all components. Run `omx doctor` to verify installation.
