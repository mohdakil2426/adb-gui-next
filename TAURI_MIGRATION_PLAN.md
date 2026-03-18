# Tauri Migration Plan

## Objective

Migrate the current Wails desktop app in `docs/adb-gui-kit` into a root-level Tauri 2 + Rust + Vite/React desktop app at:

- `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next`

This migration must preserve the existing UI, feature set, and Windows/Linux product scope while replacing:

- Wails with Tauri
- Go backend services with Rust
- Astro host files with a Vite React host

This should be treated as a runtime/backend migration with heavy frontend reuse, not a redesign or frontend rebuild.

---

## Non-Negotiable Constraints

- The new Tauri app must live at the repository root.
- Do **not** build the primary app under `apps/` or another nested parallel app folder.
- Copy the current UI over first; do **not** rebuild it from scratch.
- Keep the React shell, views, stores, styles, and assets as close to the current app as practical.
- Preserve the current feature set.
- Keep Windows and Linux in scope.
- Keep macOS out of scope.
- Preserve bundled `adb` / `fastboot` support for standalone distribution.
- Preserve dialogs, drag-and-drop, payload progress events, folder opening, log export, shell command execution, and external OS actions.
- Minimize UI drift.

---

## Executive Summary

The existing app is already structured in a migration-friendly way:

- the real UI is React, not Astro-heavy
- Astro is only a thin host layer
- Wails is mostly acting as the desktop bridge
- backend responsibilities are already separated into service-like domains
- payload extraction progress is already event-driven

That means the correct migration strategy is:

1. promote the repository root into the new Tauri app
2. keep `docs/adb-gui-kit` as the legacy/reference implementation during migration
3. copy the current frontend into the new root app
4. replace only the host/runtime integration points first
5. port backend behavior carefully from Go to Rust
6. preserve frontend-facing contracts wherever practical

This is **not** a greenfield frontend rewrite.

---

## Current Source of Truth

### Legacy app to migrate from

- `docs/adb-gui-kit/`

### Current architecture

- **Backend:** Go + Wails
- **Frontend:** Astro-hosted React app
- **Bridge:** Wails-generated bindings and runtime events

### Major implemented feature areas

- Dashboard
- App Manager
- File Explorer
- Flasher
- Utilities
- Payload Dumper
- Shell command runner
- About page
- Global logs panel

### Important current implementation traits

- navigation is manual inside `MainLayout`, not router-based
- payload progress is event-driven
- logs are frontend-managed via Zustand and export through backend actions
- Windows bundled binaries are more deterministic than Linux today
- Linux support exists, but packaged runtime parity needs stronger validation

---

## Correct Repository Strategy

## Root becomes the new app

The new Tauri app should be built directly in:

- `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next`

## Legacy app remains as reference during migration

The existing Wails app remains in:

- `C:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/adb-gui-kit`

Purpose of keeping it:

- source for copied frontend files
- behavioral parity reference
- side-by-side validation baseline

It should be treated as a migration reference implementation until parity is complete.

---

## Recommended Target Layout

```text
adb-gui-next/
├── src/                       # copied/adapted React app from legacy frontend/src
│   ├── components/
│   ├── lib/
│   ├── styles/
│   ├── desktop/               # thin Tauri adapter layer
│   │   ├── commands/
│   │   │   ├── adb.ts
│   │   │   ├── fastboot.ts
│   │   │   ├── files.ts
│   │   │   ├── payload.ts
│   │   │   ├── system.ts
│   │   │   ├── logs.ts
│   │   │   └── index.ts
│   │   ├── events/
│   │   │   ├── payload.ts
│   │   │   └── index.ts
│   │   ├── dialogs/
│   │   │   ├── files.ts
│   │   │   └── index.ts
│   │   ├── dnd/
│   │   │   ├── windowDrop.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── public/                    # copied public assets
├── src-tauri/
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json
│   ├── capabilities/
│   ├── icons/
│   ├── resources/
│   │   ├── windows/
│   │   └── linux/
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── state.rs
│       ├── error.rs
│       ├── models/
│       ├── commands/
│       │   ├── adb.rs
│       │   ├── fastboot.rs
│       │   ├── files.rs
│       │   ├── payload.rs
│       │   ├── logs.rs
│       │   ├── system.rs
│       │   └── dialogs.rs
│       ├── services/
│       │   ├── executor.rs
│       │   ├── binary_locator.rs
│       │   ├── adb_service.rs
│       │   ├── fastboot_service.rs
│       │   ├── file_service.rs
│       │   ├── log_service.rs
│       │   └── payload/
│       └── platform/
│           ├── windows.rs
│           ├── linux.rs
│           └── mod.rs
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── index.html
├── TAURI_MIGRATION_PLAN.md
└── docs/
    └── adb-gui-kit/           # legacy Wails app kept as reference during migration
```

---

## Core Migration Principles

1. **Root is the product.**
   - The new Tauri app lives at repo root.
   - `docs/adb-gui-kit` is legacy/reference only during migration.

2. **Copy first, then adapt.**
   - Move the current UI into the root app before making broad architectural changes.
   - Avoid “clean slate” frontend work.

3. **Preserve the UI, replace the runtime.**
   - Keep React components, stores, styling, assets, and shell structure as intact as possible.
   - Replace Wails/Astro-specific layers only where required.

4. **Replace the bridge, not the UX.**
   - Wails-generated bindings become local Tauri adapters.
   - Keep frontend-facing command names and payloads close to the existing shape where practical.

5. **Backend parity comes before polish.**
   - First reproduce behavior in Rust.
   - Refactor or simplify only after parity is established.

6. **No router rewrite.**
   - Keep `MainLayout`-style manual view switching unless a clear migration blocker appears.

7. **Bundled binaries are first-class.**
   - Packaged app behavior must work without requiring global `adb` / `fastboot` installs.
   - `PATH` is only a fallback, not the primary runtime strategy.

8. **Payload migration is a dedicated milestone.**
   - Treat it as the highest-risk subsystem.
   - Do not hide it inside general backend porting.

9. **Windows/Linux only.**
   - Tauri configuration, packaging, and testing should explicitly target those platforms.

10. **Minimize frontend churn.**

- If a view can be migrated by changing imports only, do that.
- Do not refactor components or state unnecessarily during migration.

---

## Key Architecture Decisions to Lock Before Implementation

### 1. Root-level app ownership

Decision:

- root is the real app
- `docs/adb-gui-kit` is a migration source/reference only

### 2. Astro is removed only as host

Decision:

- do not keep Astro in the target app
- replace Astro with a standard Vite + React host
- keep the React application body

### 3. Frontend/backend contract preservation

Decision:

- keep frontend-facing command names, arguments, and return shapes as close as practical in the first pass
- adapter layer absorbs runtime differences where needed

### 4. Binary packaging strategy

Decision:

- bundled resources/sidecars are the primary runtime model
- development path fallback is allowed
- `PATH` fallback is last resort only

### 5. Payload event contract preservation

Decision:

- keep the payload progress event name and payload shape close to current expectations
- keep the frontend store contract stable where possible

### 6. Desktop APIs are isolated behind adapters

Decision:

- views should not directly import raw Tauri APIs
- all desktop interactions should flow through `src/desktop/*`

### 7. Linux support expectations must be explicit

Decision:

- define packaged behavior, binary execution expectations, folder opening, and external terminal behavior up front

---

## Wails to Tauri Mapping

| Current Wails Concern            | Tauri Replacement                                     | Notes                                             |
| -------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Generated Wails backend bindings | `invoke()` wrapped by local frontend adapters         | Keep Tauri APIs out of view files                 |
| Wails runtime events             | Tauri emit/listen                                     | Preserve payload progress contract                |
| `payload:progress` event         | same event name if practical                          | Minimizes frontend changes                        |
| Wails dialogs                    | Tauri Dialog plugin and/or Rust command wrappers      | Centralize behind frontend dialog adapters        |
| Browser open / folder open       | Tauri opener plugin or explicit Rust platform helpers | Platform-specific behavior remains isolated       |
| Go `exec.CommandContext` wrapper | Rust executor service                                 | Centralize timeout, output capture, error mapping |
| Embedded binaries                | Tauri packaged resources / sidecars                   | Normalize Windows/Linux behavior                  |
| Wails drag-and-drop runtime      | Tauri window/file-drop events                         | Preserve payload-dumper UX                        |
| `wails.json`                     | `tauri.conf.json` + capabilities                      | Scope permissions explicitly                      |
| Wails app lifecycle hooks        | Tauri setup + lifecycle handling                      | Needed for cleanup and temp resource handling     |

---

## Frontend Migration Strategy

## Goal

Copy the current UI into the root app and make the smallest possible changes necessary to replace Astro and Wails.

## Source frontend

- `docs/adb-gui-kit/frontend/`

## Target frontend

- root `src/`
- root `public/`

## Copy-first migration map

### Copy with minimal structural change

Copy these directories first:

- `docs/adb-gui-kit/frontend/src/components/`
- `docs/adb-gui-kit/frontend/src/lib/`
- `docs/adb-gui-kit/frontend/src/styles/`
- `docs/adb-gui-kit/frontend/public/`

### Replace the host layer

Do not preserve Astro host files as runtime entrypoints:

- `frontend/src/pages/index.astro`
- Astro layout/host files
- `frontend/astro.config.mjs`

Replace with:

- root `index.html`
- root `src/main.tsx`
- root `src/App.tsx`
- root `vite.config.ts`

## Minimal-change frontend rules

1. Keep existing file names unless a host/runtime issue forces change.
2. Keep component tree and view boundaries.
3. Keep Zustand stores unless a tiny adapter-facing change is required.
4. Keep current CSS variables, styling tokens, and Tailwind usage.
5. Do not add a router.
6. Do not redesign `MainLayout` navigation.
7. Do not refactor views for cleanup during migration.
8. Replace Wails imports with local adapter imports only.
9. Keep event payload shapes stable where possible.
10. Prefer compatibility wrappers over invasive component edits.

## Adapter layer responsibilities

Create a root-level frontend bridge at:

- `src/desktop/`

Responsibilities:

- `commands/*` — typed wrappers around Tauri `invoke()`
- `events/*` — subscriptions for payload progress and future backend events
- `dialogs/*` — file/folder/save dialog wrappers
- `dnd/*` — drag-and-drop helpers

## Import replacement rule

Current imports from:

- `wailsjs/go/backend/App`
- `wailsjs/runtime/runtime`

should be replaced with imports from:

- `src/desktop/commands/*`
- `src/desktop/events/*`
- `src/desktop/dialogs/*`
- `src/desktop/dnd/*`

## Frontend areas to preserve with extra care

These are especially important because they encode desktop behavior and current app flow:

- `frontend/src/components/MainLayout.tsx`
- `frontend/src/components/views/ViewPayloadDumper.tsx`
- `frontend/src/components/views/ViewShell.tsx`
- `frontend/src/lib/payloadDumperStore.ts`
- `frontend/src/lib/logStore.ts`
- `frontend/src/lib/deviceStore.ts`

---

## Backend Rust Module Plan

## Design goal

Mirror the current backend responsibilities instead of inventing a brand-new backend architecture during migration.

## Root Rust files

### `src-tauri/src/main.rs`

Responsibilities:

- bootstrap Tauri
- register plugins
- register commands
- set up shared state
- hook startup/shutdown behavior as needed

### `src-tauri/src/lib.rs`

Responsibilities:

- central module wiring
- keep `main.rs` thin if helpful

### `src-tauri/src/error.rs`

Responsibilities:

- application error enum
- error conversion helpers
- frontend-safe error messages
- contextual internal error wrapping

### `src-tauri/src/state.rs`

Responsibilities:

- shared service state
- mutex/arc-managed long-running task state
- payload subsystem state if needed

### `src-tauri/src/models/`

Responsibilities:

- define DTOs close to frontend expectations for:
  - devices
  - device info
  - file entries
  - package entries
  - payload partition details
  - extraction results
  - progress payloads

## Core services

### `services/executor.rs`

Port equivalent of the current executor behavior.
Responsibilities:

- run processes safely
- apply timeout policy
- capture stdout/stderr
- combine output when useful
- normalize command errors
- structure for future cancellation support

### `services/binary_locator.rs`

Responsibilities:

- resolve packaged resource/sidecar paths
- resolve dev-mode paths
- normalize Windows/Linux behavior
- handle Linux executable permissions where needed
- use `PATH` only as fallback

### `services/adb_service.rs`

Responsibilities:

- list devices
- device info aggregation
- wireless ADB flows
- reboot/mode actions
- APK/APKS install
- package uninstall
- file-related ADB workflows
- raw `adb` and `adb shell` execution

### `services/fastboot_service.rs`

Responsibilities:

- list fastboot devices
- flash partitions/images
- sideload
- wipe actions
- getvar
- slot switching
- raw fastboot execution

### `services/file_service.rs`

Responsibilities:

- device file listing
- push/pull orchestration
- remote/local path validation
- folder/file transfer logic

### `services/log_service.rs`

Responsibilities:

- save/export logs
- generate stable filenames
- create directories safely
- manage user-friendly file targets

### `services/payload/`

This remains a dedicated subsystem.
Recommended submodules:

- `mod.rs`
- `reader.rs`
- `zip.rs`
- `manifest.rs`
- `extractor.rs`
- `progress.rs`
- `temp.rs`

Responsibilities:

- accept `payload.bin` and OTA ZIP inputs
- discover/extract `payload.bin` from ZIPs
- enumerate partitions with details
- extract selected partitions or all partitions
- emit progress updates
- manage temp/cache cleanup
- return stable frontend-facing result shapes

## Platform modules

### `platform/windows.rs`

Responsibilities:

- open folder in Explorer
- launch terminal
- launch Device Manager
- handle Windows-specific process behavior
- handle companion files for bundled binaries

### `platform/linux.rs`

Responsibilities:

- open folder in file manager
- launch terminal
- provide Linux equivalents or graceful fallbacks for system actions
- handle permission normalization if needed

## Command modules

### `commands/*.rs`

These should stay thin.
Responsibilities:

- validate inputs
- call services
- map errors
- return frontend-friendly DTOs

Do not place business logic directly in Tauri command functions.

---

## Bundled Binary Strategy

## Recommendation

Use packaged resources or sidecars as the primary runtime strategy for `adb` and `fastboot`, with a centralized binary locator that resolves the correct executable path by platform.

For this project, the key requirement is deterministic packaged behavior, not reliance on host-installed Android tools.

## Current source paths

Existing bundled binaries currently live under the legacy backend structure, including Windows/Linux binary directories.

## Target packaged paths

Recommended target resource organization:

- `src-tauri/resources/windows/`
- `src-tauri/resources/linux/`

## Resolution order

1. packaged resource/sidecar path for current OS
2. development resource path in repo
3. explicit override path if ever added later
4. system `PATH` fallback only as last resort

## Rules

- packaged mode must work without global Android platform-tools installed
- Linux packaged binaries must be executable at runtime
- Windows companion DLLs must remain adjacent where required
- binary resolution must be tested separately from feature workflows

## Packaging expectations

### Windows

- packaged build must include bundled tools
- core flows should work without system-installed Android tools
- folder open and external terminal behavior must remain user-friendly

### Linux

- packaged build must include bundled tools
- executable permissions must be validated
- open-folder and terminal-launch behavior should be tested in realistic desktop environments where practical

---

## Contract Preservation Strategy

## Why this matters

The easiest way to avoid frontend churn is to keep the frontend-facing contract stable during the first migration pass.

## Preserve where practical

- command names
- argument shapes
- result shapes
- payload progress event name
- payload progress payload structure

## Adapter role

When exact backend behavior differs between Wails and Tauri, the local adapter layer should absorb the difference before view code is changed.

## Contract inventory to create during implementation

Before porting large feature areas, build an inventory of:

- current exported backend methods
- arguments used by the frontend
- return payloads consumed by each view/store
- runtime event names and payload shapes

That inventory should become the compatibility baseline for the migration.

---

## Phased Implementation Plan

## Phase 0 — Plan Lock and Repo-Root Decision

- rewrite this migration plan around a root-level Tauri app
- explicitly mark `docs/adb-gui-kit` as reference/legacy during migration
- lock Windows/Linux-only scope
- lock copy-first frontend strategy
- lock bundled-binary-first runtime strategy

### Deliverables

- corrected migration plan
- explicit target layout
- explicit migration principles

## Phase 1 — Root Tauri Scaffolding

- scaffold Tauri 2 + Vite React directly at repo root
- set up root `package.json`, `tsconfig`, `vite.config`, and `index.html`
- set up `src-tauri/Cargo.toml`, `tauri.conf.json`, capabilities, icons, and build metadata

### Goal

Get the final target structure in place immediately instead of creating a temporary nested app.

## Phase 2 — Frontend Copy-First Port

- copy legacy frontend source tree into root `src/`
- copy legacy public assets into root `public/`
- replace Astro host with Vite React entry files only
- render the app shell using stubbed desktop adapters if needed

### Goal

Prove that the current UI can render at root with minimal structural change.

## Phase 3 — Frontend Desktop Adapter Layer

- create `src/desktop/commands/*`
- create `src/desktop/events/*`
- create `src/desktop/dialogs/*`
- create `src/desktop/dnd/*`
- replace Wails imports view by view with adapter imports
- preserve current event names and payload shapes where practical

### Goal

Isolate Tauri integration in a thin compatibility layer and keep views reusable.

## Phase 4 — Rust Foundation

- implement `error.rs`, `state.rs`, and shared models
- implement `executor.rs`
- implement `binary_locator.rs`
- implement basic system/log commands first
- prove packaged binary lookup in dev and packaged contexts early

### Goal

Validate process execution, permissions, and binary resolution before broad feature porting.

## Phase 5 — Core Feature Port

- port ADB workflows
- port Fastboot workflows
- port file explorer flows
- port shell command runner
- wire dashboard, app manager, file explorer, flasher, utilities, and shell views to Rust commands

### Goal

Reproduce the main operational surface of the app before tackling the most specialized subsystem.

## Phase 6 — Payload Subsystem Port

- port partition listing
- port extraction engine
- port ZIP-aware `payload.bin` handling
- recreate real-time progress updates
- preserve current store/UI behavior as much as possible
- recreate drag-and-drop integration
- recreate cleanup/temp handling

### Goal

Preserve the current payload dumper UX with minimal frontend change.

## Phase 7 — Packaging and Parity Validation

- package Windows build with bundled binaries/resources
- package Linux build with bundled binaries/resources
- validate standalone packaged behavior without global Android tools installed
- run side-by-side feature parity checks against the Wails app

### Goal

Confirm that the Tauri build is truly a replacement, not just a development-mode demo.

## Phase 8 — Legacy Transition Cleanup

- mark the Wails app as archived/reference only after parity is confirmed
- update developer documentation accordingly
- remove obsolete migration-only notes once the cutover is complete

---

## Payload Dumper Migration Strategy

This is the highest-risk subsystem and should be treated as its own milestone.

## UX preservation goals

Keep these behaviors as close to current as practical:

- same input selection flow
- same partition loading flow
- same partition selection flow
- same per-partition progress model
- same output-folder behavior
- same drag-and-drop workflow

## Migration rule

Keep the payload progress event payload shape close enough that:

- `ViewPayloadDumper`
- `payloadDumperStore`

require minimal changes.

## Subsystem concerns that need explicit handling

- OTA ZIP handling
- temp file ownership
- extracted `payload.bin` cache lifecycle
- progress event emission frequency
- cleanup on app shutdown or file switching
- long-running extraction safety

---

## Testing and Parity Strategy

## Core principle

Migration is only complete when the root-level Tauri app behaves like the current Wails app for key user-visible workflows.

## Testing layers

### 1. Rust unit tests

Focus areas:

- binary resolution
- executor behavior
- output normalization
- file/path helpers
- payload ZIP handling
- payload parsing/extraction helpers
- temp cleanup behavior

### 2. Rust integration tests

Focus areas:

- command/service integration
- packaged-resource resolution in dev mode
- payload progress emission contract
- frontend-facing DTO shape behavior where practical

### 3. Frontend adapter tests

Focus areas:

- invoke wrappers
- dialog wrappers
- event subscribe/unsubscribe behavior
- drag-and-drop helper behavior

### 4. Frontend smoke tests

Focus areas:

- app boot
- shell render
- view switching
- payload progress/store update wiring

### 5. Manual parity matrix

Validate the following against both the Wails and Tauri builds:

1. device listing
2. device info retrieval
3. wireless ADB enable/connect/disconnect
4. APK install
5. APKS install
6. package list/search/select/uninstall
7. file listing for `/sdcard/`
8. push/pull files and folders
9. flasher workflows
10. utilities actions
11. shell raw commands
12. payload partition listing
13. payload extraction with progress
14. folder open
15. log save/export
16. payload drag-and-drop flow

### 6. Packaged validation

Must explicitly test:

- Windows packaged app with bundled binaries and no global Android tools installed
- Linux packaged app with bundled binaries and no global Android tools installed

## Parity gates

Do not mark migration complete until:

- root Tauri app renders the same core shell/navigation pattern
- key views are preserved
- Windows packaged standalone behavior is verified
- Linux packaged standalone behavior is verified
- payload progress behavior is preserved
- UI drift is minimal and justified

---

## Risk Register

### Risk 1 — Wrong repo structure creates long-term churn

If the app is built in `apps/` or another nested folder, it conflicts with the intended product structure.

**Mitigation:**

- enforce root-only scaffold from the start
- keep legacy app under `docs/adb-gui-kit` only as reference

### Risk 2 — Frontend rewrite creep

Migration work could turn into unnecessary refactoring of views, navigation, or state.

**Mitigation:**

- copy-first rule
- no router rewrite
- no structural redesign during parity phase

### Risk 3 — Linux bundled binary behavior remains inconsistent

Linux is already the known weaker point for deterministic bundled-tool behavior.

**Mitigation:**

- validate binary resolution early
- test packaged Linux behavior before broad completion claims

### Risk 4 — Payload subsystem complexity

Payload extraction is specialized and operationally different from normal command workflows.

**Mitigation:**

- isolate as a dedicated phase
- preserve event contract
- test cache/temp behavior independently

### Risk 5 — Tauri capabilities/plugin misconfiguration

Desktop permissions can fail late if not locked down and tested early.

**Mitigation:**

- define required plugins/capabilities during scaffolding
- validate simple end-to-end commands first

### Risk 6 — DTO mismatches force widespread frontend edits

If Rust command results diverge too far from current frontend expectations, view churn expands quickly.

**Mitigation:**

- preserve response shapes where practical
- use adapters for normalization

### Risk 7 — Drag-and-drop parity differs across runtimes

Wails and Tauri drag/drop behavior is not identical.

**Mitigation:**

- isolate DnD behind adapters
- validate payload-dumper UX early

### Risk 8 — Log and temp path behavior changes in packaged mode

Working-directory assumptions can break after moving to Tauri packaging.

**Mitigation:**

- define path ownership explicitly
- test dev and packaged flows separately

### Risk 9 — Windows-only helper actions lack exact Linux equivalents

Some platform actions have no one-to-one Linux match.

**Mitigation:**

- keep platform helpers explicit
- provide best-effort or graceful unsupported behavior on Linux

---

## First Task Backlog

### Planning/documentation tasks

1. finalize this migration plan as the canonical migration document
2. create an inventory of current Wails-exported backend methods
3. create an inventory of current Wails runtime usages in the frontend
4. create a parity matrix for major user journeys

### Root scaffolding tasks

5. scaffold Tauri 2 + Vite React at repo root
6. define required Tauri plugins and capabilities
7. define resource vs sidecar packaging details for bundled tools

### Frontend migration tasks

8. copy frontend source and public assets into root app
9. replace Astro host with root Vite entry files
10. add `src/desktop/*` adapters
11. replace Wails imports incrementally with adapter imports

### Rust foundation tasks

12. implement shared error/state/models
13. implement executor service
14. implement binary locator service
15. implement basic system/log commands

### Feature port tasks

16. port ADB commands and workflows
17. port Fastboot commands and workflows
18. port file explorer operations
19. port shell command runner
20. port payload subsystem last as its own milestone

### Validation tasks

21. validate Windows packaged standalone behavior
22. validate Linux packaged standalone behavior
23. run feature parity matrix against the Wails app

---

## Success Criteria

- The Tauri app is built at the repository root.
- The current UI is copied and reused, not rebuilt from scratch.
- Astro is removed only as the host layer.
- React views, stores, styles, and assets are largely preserved.
- Wails-specific imports are replaced with a thin local Tauri adapter layer.
- Rust backend mirrors current service domains with centralized executor and binary lookup.
- Windows packaged builds work with bundled binaries and no global Android tools installed.
- Linux packaged builds work with bundled binaries and no global Android tools installed.
- Payload extraction works with partition listing and real-time progress.
- Drag-and-drop, dialogs, open-folder, log export, and shell command execution remain available.
- UI drift is minimal and limited to unavoidable runtime differences.
- The legacy Wails app can be retired only after parity is verified.

---

## Out of Scope for This Migration

- macOS support
- major UI redesign
- replacing manual view switching with routing
- introducing a new state management system
- rethinking product scope or feature set
- unrelated backend cleanup or speculative abstraction work

---

## Final Direction

This migration should be approached as:

**keep the UI, replace the runtime, port the backend carefully, validate packaged parity on Windows and Linux, and use the current Wails app as the reference until the root-level Tauri app is complete.**
