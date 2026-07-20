# Agent Project Rules

Owns **workflow**, report layout, quality gates, and **hard stops**. Module implementation rules belong in module `AGENTS.md` files. Cross-module design belongs in `docs/architecture.md`.

## Scope

- Read root `AGENTS.md`, this file, `docs/architecture.md` when design crosses modules, and the closest module guide before work.
- Keep changes scoped to the user request. No drive-by refactors or unrelated formatting.
- Preserve unrelated user changes (`git status --short` before edits).
- If docs and code disagree, inspect source and tests before changing docs.
- Commits, pushes, PRs, and destructive shared-state actions only on **explicit** user request.

## Platforms & packaging (product policy)

| Platform | Product status | Notes |
| --- | --- | --- |
| **Windows x86_64** | First-class | NSIS, MSI, portable; Google tools PE **x86** (WOW64 OK) |
| **Windows i686** | Shipped (CI) | NSIS, MSI, portable; tools PE x86 |
| **Windows aarch64** | Shipped (CI, NSIS) | App aarch64; **bundled tools still PE x86** — needs x86/WOW64 emulation |
| **Linux x86_64** | First-class | deb, rpm, AppImage + bundled ELF x86_64 tools |
| **Linux aarch64** | Shipped (CI) | deb/rpm/AppImage; **no bundled platform-tools** (empty resources) — uses system PATH adb/fastboot |
| **macOS** | **Code present, builds paused** | See below |
| Browser / Next.js / Electron | Out of scope | Never reintroduce |

**Win ARM tools strategy:** keep shipping Google’s Windows platform-tools (x86) until an official aarch64 tree is vendored. Document emulation requirement; do not ship mismatched ELF/PE silently.

Full build matrix + portable RCA: `docs/internal/reports/active/2026-07-18/2026-07-18-ci-release-artifact-packaging-audit.md`.

### App naming (canonical)

| Role | Value |
| --- | --- |
| Display / product / window / HTML | **ADB GUI Next** |
| Artifact / download prefix | **`ADB-GUI-Next`** (no spaces) |
| Cargo / npm / binary stem | **`adb-gui-next`** (no spaces; Linux-safe) |
| Bundle identifier | **`com.astrixforge.adbguinext`** |
| Publisher | **Astrixforge** |

Do not reintroduce mixed styles (`AdbGuiNext` / `Adb Gui Next`) in new user-facing strings or release assets.

### Code signing

- **Not used.** Do not add Authenticode / notarization / signed-release requirements unless the user explicitly asks.
- Document SmartScreen / Gatekeeper warnings as expected for unsigned builds.

### Packaging / release tooling

| Piece | Role |
| --- | --- |
| **`tauri-apps/tauri-action@v1`** | Official build + (on publish) draft release asset upload + per-bundle workflow artifacts |
| **`scripts/make-windows-portable.ps1`** | Custom only: Windows portable zip (not a Tauri BundleType) |

Do **not** reintroduce a full `collect-release-assets.ps1` renamer for installers — use tauri-action naming patterns instead.  
Do **not** reintroduce `verify-release-version.mjs` — version is official Tauri path-to-package.json (see below).

### App versioning (official Tauri)

| Source | Role |
| --- | --- |
| **`package.json` `version`** | **Source of truth** for the app / installers |
| **`src-tauri/tauri.conf.json` `version`** | Must be **`"../package.json"`** (Tauri reads version from package.json) |
| **`src-tauri/Cargo.toml` `version`** | Required by Cargo; **keep equal** to `package.json` on every release |

Ref: [Tauri config `version`](https://v2.tauri.app/reference/config/#version) — string, path to package.json, or omit (falls back to Cargo.toml).

**Release bump:** update `package.json` + `Cargo.toml` to the same semver; add `.github/release-notes/v{version}.md`. Do not duplicate a third literal version in `tauri.conf.json`.

### Re-publish policy

- Publish creates a **draft** GitHub release for `v{version}` via **tauri-action**.
- **Do not** overwrite an existing tag/release of the same version. Preflight fails if `v{version}` already exists.
- To re-ship: bump `package.json` + `Cargo.toml`, add notes under `.github/release-notes/v{version}.md`, then run publish — or delete the draft/tag only with explicit user approval.

### macOS: implemented code, paused builds

- **Code may exist** (e.g. `resources/darwin/`, `tauri.macos.conf.json`, optional paths in `publish.yml`). That is **prep / partial support**, not a promise that macOS is shipped.
- **Builds and shipping are paused.** Do **not** treat macOS as a first-class release target until the user explicitly unpauses it.
- **Agents must not:** enable/advertise macOS as supported, unpause CI/publish macOS jobs, claim bundled macOS installers work, or “finish macOS packaging” unless the user **explicitly** asks.
- **Agents may:** leave existing macOS-related files alone when editing unrelated code; fix compile breakage only if the same change is required for Windows/Linux.
- When unpaused later (user request only): expect full packaging smoke (signing optional per policy, docs, real device) — do not half-enable.
- User-facing docs (README platform table, release notes) must not call macOS first-class while builds are paused. Prefer: *code prepared / builds paused*.

## Documentation ownership

| Topic | Owner |
| --- | --- |
| Architecture / contracts | `docs/architecture.md` |
| Workflow, reports, hard stops, quality gates | `docs/project_rules.md` |
| Module rules | Closest module `AGENTS.md` |
| Investigations / audits | `docs/internal/reports/` |
| FE Ultracite standards | `.agents/skills/utils/ultracite/SKILL.md` · `.agents/rules/ultracite.md` |

One owner per topic; duplicates become pointers.

Living session notes (optional, not architecture): `memory-bank/` — do not duplicate permanent rules there.

## Report layout

**New reports** go here:

```text
docs/internal/reports/<active|closed>/YYYY-MM-DD/YYYY-MM-DD-short-topic-<category>.md
```

| Field | Rule |
| --- | --- |
| `active` | Open / still useful |
| `closed` | Decided, done, or historical |
| Category | `audit` \| `research` \| `summary` \| `validation` only |
| Filename | Lowercase kebab-case; date prefix; category suffix; no spaces |
| Moves | `active` ↔ `closed` without renaming unless category is wrong |

Do not put reports in the repo root or ad-hoc folders.

### Superpowers plans & specs (naming)

Follow superpowers conventions (writing-plans / brainstorming):

| Kind | Path pattern |
| --- | --- |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` |
| Design spec | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |

Rules: lowercase kebab-case slug; date prefix required; no underscores or SCREAMING names; plans stay under `plans/`, design docs under `specs/`.

Audit/research/validation write-ups go to `docs/internal/reports/` (not superpowers). Optional index: `docs/internal/reports/index.md`.

## Quality commands

| Intent | Command |
| --- | --- |
| FE check | `bun run lint:web` (`ultracite check`) |
| FE fix | `bun run format:web` (`ultracite fix`) |
| Rust lint | `bun run lint:rust` (clippy `-D warnings`) |
| Rust format | `bun run format:rust` / `format:rust:check` |
| Combined lint | `bun run lint` |
| Combined format | `bun run format` |
| CI-style format check | `bun run format:check` |
| FE tests | `bun run test` |
| Full gate | `bun run check` (format:check → clippy → vitest → cargo test → build) |
| Dev | `bun run dev` / `bun run tauri dev` |
| Build | `bun run build` / `bun run tauri build --debug` |

Do **not** reintroduce alias scripts (`fix`, `lint:fix`, `lint:web:fix`, `format:web:check`, `check:fast`).

Pre-commit (Husky): `bun x lint-staged` — staged Ultracite fix + staged rustfmt only. Not clippy/tests.

### Verification policy

- **Full gate (`bun run check`) only after every task in the request is done** — never mid-task or between partial steps.
- Frontend-only: `bun run lint:web`, `bun run test`, `bun run build`.
- Rust-only: `bun run format:rust:check`, `bun run lint:rust`, targeted `cargo test --manifest-path src-tauri/Cargo.toml` when practical.
- IPC contract change: also verify `src/desktop/backend.ts`, `src/desktop/models.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/permissions/autogenerated.toml`.
- Packaging-sensitive: `bun run tauri build --debug` or state the blocker.
- Docs-only: skip heavy gates unless Ultracite includes the path.
- Never claim success without command output or a clear manual verification note.

**Windows:** bare `cargo test` can fail with Tauri-linked loader `0xc0000139` / `STATUS_ENTRYPOINT_NOT_FOUND`. Prefer:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --no-run
```

Full execution is owned by **Linux CI** (`quality-rust` job). Do not treat local Windows test-runner failures as product regressions without Linux CI evidence.

## Hard stops

Stop and ask before:

- Resolving a conflict between module rules and this file.
- Destructive shared-state actions without explicit user approval (force-push, `rm -rf`, dropping data, rewriting published history).
- Inventing empty or placeholder “proof” evidence.
- Migrating the app to Next.js, Electron, or browser-first routing.
- Adding production dependencies without a concrete user-visible need.
- Changing Tauri capability/permission model without explicit product request.
- **Unpausing or shipping macOS builds** (CI/publish jobs, release assets, “macOS supported” claims) without an **explicit** user request. Code may already exist; builds stay paused per [Platforms & packaging](#platforms--packaging-product-policy).
- Mass-deleting `docs/internal/reports/**` without an explicit user request.

## Review bar

Call out: bogus abstraction, random churn, enterprise sludge, special-case insanity, voodoo sleeps/retries, hack-on-hack, rats-nest logic.

A change is done when: scoped to the request, IPC/types clear, user behavior preserved unless break requested, verification honest, unrelated issues not silently “fixed.”
