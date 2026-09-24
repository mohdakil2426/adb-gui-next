---
name: self-evolve-v2
description: Universal continuous learning & documentation self-improvement engine. Use whenever completing any bug fix, code modification, proven working CLI command, or architectural decision to capture verified learnings and record durable rules in the nearest project document. Trigger on user prompts like "learn", "learning", "self-evolve", "self-improve", "update docs", "update rules", "teach the repo", "lessons learned", "capture this", or before completing non-trivial tasks. Selects the nearest existing AGENTS.md (or creates a dedicated module AGENTS.md), DESIGN.md, CODING_STANDARD.md, ARCHITECTURE.md, or PROJECT_RULES.md.
---

# Self-Evolve

Continuous repository learning: capture verified lessons, proven commands, and architectural invariants permanently into project documentation so future developers and agents never repeat solved failures.

---

## 1. When to Capture Learnings (Real Signals)

Trigger learning capture immediately when any of these 4 concrete signals occur:

1. **Verified Fix:** A compile, lint, test, or runtime bug was resolved and verified green.
2. **Proven Working Command:** A multi-flag build, CLI, or test command was discovered after trial-and-error.
3. **Durable Invariant Established:** A security, memory, or architectural constraint was established (e.g. silent honeypots, zero-logcat, non-throwing IPC, range clamping).
4. **Outdated Rule Corrected:** An existing rule or command in project documentation was found to be stale, broken, or wrong.

**Skip:** One-off typos, transient network blips, or unverified guesses.

---

## 2. Inviolable Guardrails (Anti-Wipe & Anti-Bloat)

1. **NEVER Full-File Rewrite:**
   - Complete rewrites of any documentation file are strictly prohibited.
   - Surgical updates only: Add 1 new bullet or update 1 existing bullet in place. Wiping existing context is a critical failure.
2. **Zero Duplication (One Fact = One Owner):**
   - Never copy-paste the same rule across multiple documentation files.
   - If a learning belongs in `AGENTS.md`, do not duplicate it in `ARCHITECTURE.md`.
3. **High Density ($\le 3$ Lines per Bullet):**
   - Maximum 3 lines per rule: What failed, the exact working solution, and the reason in one short clause.
4. **In-Place Update Over Addition:**
   - If a rule with the same `Id` or topic exists, update it in place. Never create duplicate entries for the same topic.

---

## 3. Documentation Routing Matrix

Walk upward from the edited file to find the single best owner:

| Finding Type | Single Target File | What Belongs Here | What is Strictly Banned |
|:---|:---|:---|:---|
| **Subtree Rules, Local Traps, Proven CLI Commands** | **Nearest `AGENTS.md`** *(leaf or module)* | Directory-local rules, working CLI commands, component gotchas, local invariants. | Cross-module topology diagrams, compiler syntax tables, repo-wide gates. |
| **Visual Tokens, Design System, UI Layout, A11y** | **`DESIGN.md`** *(next to UI tree; else closest UI `AGENTS.md`)* | Design tokens (color, type, spacing), theme rules, responsive layout, component catalogs, visual a11y (contrast, touch targets). | Backend business logic, state management, database queries, build scripts. |
| **Language, Compiler, Linter, Dependency Deltas** | **`docs/CODING_STANDARD.md`** | Compiler error fixes, linter gotchas, dependency version idioms (`Wrong` vs `Right` with `Id:`). | Architecture diagrams, multi-module contracts, CLI workflow policies. |
| **Cross-Module Boundaries & Contracts** | **`ARCHITECTURE.md`** | Data flow between 2+ modules, public interface boundaries, component responsibilities. | Directory-local commands, subagent instructions, single-module code trivia. |
| **Workflow, Gates, Evidence, Commit Policies** | **`PROJECT_RULES.md`** | Testing bars, evidence standards, commit discipline, environment safety rules. | Source code snippets, local directory trivia, language version deltas. |
| **Repo-Wide Inviolable Boundaries Only** | **Root `AGENTS.md`** | Global routing map, project-wide hard stops (e.g. "never commit without permission"). | Subtree/module trivia, specific tool commands, local directory gotchas. |

*Rule:* Never pollute root `AGENTS.md` with local module commands or subtree trivia.

### Managing DESIGN.md (Design System vs Gotchas):
A `DESIGN.md` file is a living design system, not a generic rules dump. When recording UI learnings:
1. **Separation Boundary:**
   - User-facing visual/UX decisions, tokens, touch targets, and visual a11y $\to$ `DESIGN.md` (or fallback to the closest UI-owning `AGENTS.md` if no `DESIGN.md` exists).
   - Code implementation, reactive state management, viewmodels, and performance $\to$ closest UI-owning `AGENTS.md`.
2. **Contextual In-Place Placement:**
   - **Token or Component Table Change:** Apply a surgical 1-row table update within the matching section (e.g. `## Controls`, `## Spacing`).
   - **Visual / Layout / A11y Gotcha:** Place the 3-line bullet (`Wrong`, `Right`, `Id`) under the **matching heading** (e.g. `## Layout`, `## Colour`, `## Accessibility`). Never dump bullets at the file top, and NEVER wipe existing token tables.

---

## 4. AGENTS.md Update Resolution & Tree Hierarchy

When a verified learning, command, or invariant belongs in an `AGENTS.md` file, use this target resolution:

### Hierarchy for Learning Updates:
- **Leaf `AGENTS.md` (Level 2):** Concrete execution rules, working CLI commands, and local directory invariants ($\le 3$ lines). Contains zero routing tables.
- **Module `AGENTS.md` (Level 1):** Cross-subtree composite architecture, shared module contracts, and the subtree ownership table (`## Ownership map`).
- **Root `AGENTS.md` (Level 0):** Global `## Map` table pointing to module guides, plus inviolable repo-wide hard stops only. Local module trivia is strictly banned.

### Target Selection & Guide Creation:
1. **Target the Closest Existing `AGENTS.md`:** Always record the learning into the nearest `AGENTS.md` of the edited file (leaf first). Never bubble local folder trivia up to root.
2. **Dedicated Guide Creation Gate:** If a distinct sub-package (multiple files, dedicated domain, or recurring local rules) lacks an `AGENTS.md`, create a minimal leaf `AGENTS.md` (under 25 lines) in that directory so parent guides stay clean.
3. **Immediate Parent Registration (No Orphan Guides):** When creating a new leaf `AGENTS.md`, immediately add a 1-line link to it in its direct parent's `AGENTS.md` ownership table. Every guide must be discoverable from its parent.
4. **Root `AGENTS.md` Reservation:** Write to root `AGENTS.md` ONLY if the rule is an inviolable project-wide hard stop that applies to every single directory.

### Standard AGENTS.md File Anatomy (For New Guides):
When creating a new leaf or module `AGENTS.md` under the Creation Gate, adhere to this 4-part anatomy:
1. `# <Directory Name> Guide`
   One concise paragraph defining the directory's exact role, key files, and direct parent guide.
2. `## Architecture & Invariants`
   Concrete technical facts: data models, state flows, threading/dispatchers, memory models, Binder IPC, and security constraints. Provides real technical context before rules.
3. `## Rules & Traps (Ponytail Ultra Format)`
   Direct, actionable constraints in the 3-line format:
   - **Wrong:** <what failed or broke>
     **Right:** <exact working pattern + reason in 1 short clause>
     **Id:** <Domain / Component / Rule Identifier>
4. `## Ownership Map`
   (Only if sub-directories exist): A markdown table routing to child `AGENTS.md` guides.

### Existing AGENTS.md Update Protocol:
1. **Never Reformat for Aesthetics:** Do not rewrite an existing `AGENTS.md` solely to apply the 4-part anatomy. Existing documentation context must be strictly preserved.
2. **Contextual In-Place Insertion:**
   - New architectural facts belong under `## Architecture & Invariants`.
   - New traps and bug learnings belong under `## Rules & Traps`.
   - Newly created child guides must be appended to `## Ownership Map`.
3. **Graceful Section Evolution:** If an existing file lacks explicit sections, append the appropriate heading (`## Architecture & Invariants` or `## Rules & Traps`) surgically without disturbing existing lines.

---

## 5. Standard Writing Format (Ponytail Ultra)

Every entry in `AGENTS.md` or `CODING_STANDARD.md` MUST adhere to this exact 3-line format:

```markdown
- **Wrong:** <what failed, leaked, or wasted rounds>
  **Right:** <exact working command, invariant, or pattern + reason in 1 short clause>
  **Id:** <Domain / Tool / Rule Identifier>
```

### Universal Examples:

```markdown
- **Wrong:** guessing dependency lockfile arguments on version bumps.
  **Right:** `./gradlew --write-locks --write-verification-metadata sha256,sha512 tasks` to sync locks and checksums atomically.
  **Id:** Toolchain lockfile sync

- **Wrong:** calling exit(0) on tamper detection, exposing checks to debugger breakpoints.
  **Right:** silently poison spoofed data (corrupt Luhn check, multicast MAC) to waste cracker time.
  **Id:** Anti-tamper honeypot

- **Wrong:** running full test suite after a single-file edit.
  **Right:** run scoped test `cargo test -p <crate> --lib <module>`; run full workspace gate only at final milestone.
  **Id:** Scoped verification

- **Wrong:** inspecting Binder transactions with data.enforceInterface(), throwing 2,000+ exceptions/sec on non-target IPC.
  **Right:** inspect interface descriptor non-throwingly via strict-mode header int + readString().
  **Id:** Binder IPC non-throwing check
```

---

## 6. Pre-Yield Checkpoint (The Continuous Learning Reflex)

Before completing non-trivial work or yielding turn to the user, run this 5-second self-audit:

1. **Learning Signal Evaluation:** Did this turn resolve a non-obvious bug, prove an exact working command, or establish a durable invariant?
   - If **NO** $\to$ Yield immediately. Do not add noise.
   - If **YES** $\to$ Proceed to step 2.
2. **Target Selection:** Identify the single authoritative target file using Section 3 & 4.
3. **In-Place Check:** Does a bullet with this `Id` or topic already exist?
   - If **YES** $\to$ `UPDATE` that bullet in place.
   - If **NO** $\to$ `ADD` exactly 1 new bullet ($\le 3$ lines) in the appropriate section.
4. **Safety Check:** Confirm zero file wipes, zero duplicate rules across files, and zero code mutations.
