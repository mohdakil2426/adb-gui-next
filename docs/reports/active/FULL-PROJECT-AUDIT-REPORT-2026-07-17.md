# ADB GUI Next — Full Project Audit Report

| Field | Value |
| --- | --- |
| **Date** | 2026-07-17 |
| **Scope** | Entire project: frontend, Rust backend, Tauri config, IPC, tests, deps/CI |
| **Mode** | Read-only (no code changes, no commits) |
| **Branch** | `main` (ahead of origin by 34 commits at audit start) |
| **App version** | 0.2.5 |
| **Stack** | Tauri 2.11.x · React 19 · TypeScript 6 · Vite 8 · Rust 2024 · Bun 1.3.13 · Zustand 5 · TanStack Query 5 |

---

## 1. Executive summary

This audit used **15 parallel explore subagents**, project skills (`/rust-skills`, `/rust-patterns`, `/rust-testing`, React/shadcn/Tailwind/a11y/vitest skills), and **Context7 official Tauri 2 + React 19 docs**. Orchestrator re-verified high-severity claims against source before inclusion.

### Overall posture

| Layer | Grade | One-line verdict |
| --- | --- | --- |
| Architecture layout | **Strong** | Feature modules, desktop IPC boundary, domain Rust split largely match AGENTS.md |
| Tauri security baseline | **Good** | CSP + freezePrototype + command ACL; residual risk is high-privilege intentional toolkit surface |
| Payload domain | **Mixed** | Strong streaming/mmap design; serious path, SSRF-redirect, memory, and transaction gaps |
| Debloat / multi-device | **Weak** | Cache not device-keyed; SDK=0 → uninstall; FE ignores selected serial |
| Emulator root | **Mixed** | Verification model correct; Magisk “latest” is hardcoded v25.2; cancel is UI-only |
| Frontend shell/UI | **Good** | shadcn + tokens + layout rules mostly held; real a11y + perf bugs remain |
| Testing | **Uneven** | Strong islands (CrAU, path validation, RootWizard UI); security pure helpers under-tested |
| Tooling/CI | **Mature Win/Linux** | Version parity + quality gates; macOS resource config and release profile gaps |

### Finding counts (verified only)

| Severity | Count | Theme |
| --- | ---: | --- |
| **Critical** | 2 | Path traversal on extract; transaction wipes user dirs |
| **High** | 16 | SSRF redirect gap, multi-device safety, Magisk pin, shell false-success, IPC DTO bug, destructive SDK fallback, etc. |
| **Medium** | 28 | Perf, a11y, ACL least-privilege, memory, cancel gaps, testing holes |
| **Low / Info** | 20+ | Style, dead code, docs drift, dual Radix, missing wrappers |

**False positives intentionally excluded** (see §10): OPS/OFP public crypto tables are not secrets; `allow-all` is a command allowlist not OS shell; PAT is session-only (verified); macOS “out of scope” product note is retained where findings only apply if shipping macOS.

---

## 2. Audit methodology

### 2.1 Parallel subagents (15)

| # | Subagent focus | ID (short) |
| ---: | --- | --- |
| 1 | Tauri config / ACL / CSP / plugins | `…0ab4ba` |
| 2 | Rust helpers + all command modules | `…08ca5a` |
| 3 | Payload domain (CrAU/remote/OPS/zip) | `…b602397033` |
| 4 | Marketplace + emulator + debloat | `…c8eb98725e` |
| 5 | IPC FE↔BE contracts + events | `…d17a329ecd` |
| 6 | Frontend architecture & shell | `…ed14dc91f5` |
| 7 | All feature views | `…f55d486c57` |
| 8 | shadcn / Tailwind v4 / theme tokens | `…801d40d8f16` |
| 9 | React performance + accessibility | `…810f6bd61eb` |
| 10 | Frontend tests & coverage | `…829dc724a0a` |
| 11 | Rust testing quality | `…20c50d29612a` |
| 12 | Security + hardcoding | `…6d0-be0f` |
| 13 | Dependencies / CI / tooling | `…b0572893c883` |
| 14 | File Explorer deep dive | `…c4d1f327df39` |
| 15 | Cross-cutting error handling | `…c55ed7792194` |

Orchestrator independently re-read source for every Critical/High claim in this document.

### 2.2 Project skills applied

| Skill | Application |
| --- | --- |
| `rust-skills` / `rust-patterns` | `err-no-unwrap-prod`, `async-spawn-blocking`, path sanitization, ownership |
| `rust-testing` | Unit/integration/proptest/fuzz inventory & weak-test detection |
| React best practices / composition | Effects, store selectors, re-render hot paths |
| shadcn / tailwind-v4-shadcn | Theme tokens, primitives, components.json |
| accessibility | Icon labels, nested interactives, landmarks |
| vitest | FE test pyramid, mock quality |
| AGENTS.md / memory-bank | Architecture boundaries, feature gotchas, verification policy |

### 2.3 Official docs (Context7)

| Library | Context7 ID | Topics used |
| --- | --- | --- |
| Tauri 2 | `/websites/v2_tauri_app` | ACL/capabilities replacing allowlist; permissions + scopes; async commands + `Result`; plugin permissions |
| React 19 | `/reactjs/react.dev` | Effect cleanup / stale fetches; avoid redundant Effects; ref cleanup |

Key Tauri 2 facts used in judgments:

- Permissions are **on/off for commands**; scopes validate params; capabilities attach to windows.
- Async commands should return `Result`; blocking work should not starve the runtime (`spawn_blocking` / `block_in_place` per AGENTS).
- Least privilege is the design center of the ACL system — monolithic “allow everything custom” is valid but coarse.

---

## 3. Critical findings

### C1 — Path traversal via unsanitized partition names (CrAU + remote)

| Field | Detail |
| --- | --- |
| **Severity** | Critical |
| **Confidence** | High |
| **Locations** | `src-tauri/src/payload/crau/extract.rs:112-113`; `src-tauri/src/payload/remote/mod.rs` (~671, ~835) |
| **Evidence** | `let file_name = format!("{}.img", partition_name); let image_path = output_dir.join(&file_name);` with **no** `sanitize_filename` |
| **Contrast** | Factory path correctly uses `helpers::sanitize_filename` |
| **Impact** | Malicious OTA/manifest names (`../../evil`, absolute paths) can write outside the user-chosen output directory |
| **Rules** | AGENTS.md sanitize before join; rust-patterns “parse don’t trust untrusted input” |
| **Fix** | Shared `safe_image_file_name(partition_name)` → `sanitize_filename` + reject empty/`.`/`..`; after join, assert path stays under canonical `output_dir` |

### C2 — `TransactionGuard` deletes entire user output directory

| Field | Detail |
| --- | --- |
| **Severity** | Critical |
| **Confidence** | High |
| **Location** | `src-tauri/src/payload/transaction.rs:36-48`, `65-77` |
| **Evidence** | On abort/drop: remove registered files **and** `remove_dir_all(&self.dir)` |
| **Impact** | Cancelled/failed extract can wipe **pre-existing unrelated files** in a user-selected folder |
| **Fix** | Only delete registered extract artifacts; never `remove_dir_all` on user-provided paths. Prefer extract into an owned subdirectory |

---

## 4. High findings

### H1 — Remote payload SSRF: redirects not revalidated

| Field | Detail |
| --- | --- |
| **Location** | `src-tauri/src/payload/remote/http.rs:173-179` |
| **Evidence** | `validate_outbound_url` once, then default `reqwest` client **follows redirects** (no `Policy::none()`) |
| **Contrast** | Marketplace download revalidates each hop |
| **Impact** | Public URL can redirect to `127.0.0.1` / LAN / metadata services |
| **Fix** | Mirror marketplace: disable auto-redirects; re-run `validate_outbound_url` per hop; reject IPv4-mapped IPv6 |

### H2 — Debloat: `sdk == 0` turns Disable into Uninstall

| Field | Detail |
| --- | --- |
| **Location** | `src-tauri/src/debloat/sync.rs:11-16` returns `0` on failure; `actions.rs:64-88` Disable → Uninstall when `sdk < 23` |
| **Impact** | Offline/failed getprop → irreversible uninstall path for “Disable” |
| **Fix** | Hard-error if SDK read fails before any destructive action; never map disable→uninstall without confirmed API level |

### H3 — Debloat cache not keyed by device + FE load only on mount

| Field | Detail |
| --- | --- |
| **Backend** | `DebloatCache` single slot; `get_debloat_data` returns cache without serial check |
| **Frontend** | `DebloaterTab.tsx` loads on mount only; `GetDebloatData()` takes no serial |
| **Impact** | Multi-device: show previous device packages/settings; act against wrong ADB default |
| **Fix** | Key cache by serial; pass `-s serial` end-to-end; reload on `selectedSerial` change |

### H4 — Debloat backup path traversal via `file_name`

| Field | Detail |
| --- | --- |
| **Location** | `src-tauri/src/debloat/backup.rs:114-117` `backup_dir(...).join(file_name)` |
| **Impact** | IPC-controlled `file_name` with `..` can escape backup root |
| **Fix** | `sanitize_filename` / basename-only; canonicalize + `starts_with(backup_dir)` |

### H5 — Magisk “latest stable” is hardcoded v25.2

| Field | Detail |
| --- | --- |
| **Location** | `src-tauri/src/emulator/magisk_download.rs:6-40` |
| **Evidence** | Docs claim GitHub `/releases/latest`; production always returns fixed v25.2 URL/local zip; live JSON parse is `#[cfg(test)]` only |
| **Impact** | Automated root installs outdated Magisk; false “latest” UX |
| **Fix** | Implement live fetch + SHA256; surface real tag in UI |

### H6 — File mutations succeed without shell exit verification

| Field | Detail |
| --- | --- |
| **Location** | `commands/files.rs` `run_shell_for_mode` + delete/rename/create |
| **Evidence** | ADB host status only; AGENTS requires `adb_shell_checked` (only exists in emulator root) |
| **Impact** | Failed `rm`/`mv`/`touch` can toast success |
| **Fix** | Promote shared `adb_shell_checked` to helpers; use for mutations |

### H7 — `list_files` treats most shell errors as empty directory

| Field | Detail |
| --- | --- |
| **Location** | `commands/files.rs:102-109` |
| **Evidence** | Only English “permission denied” elevated; other errors parse as empty listings |
| **Impact** | UI shows “empty” instead of load error |
| **Fix** | Detect `No such file`, `Not a directory`, non-zero exit markers |

### H8 — IPC DTO bug: `listStatus` vs `list_status`

| Field | Detail |
| --- | --- |
| **Rust** | `DebloatData` + `rename_all = "camelCase"` → JSON `listStatus` |
| **FE** | `backend.ts` `DebloatData.list_status`; `DebloaterTab` reads `data.list_status` |
| **Impact** | UAD list status wrong/undefined after `GetDebloatData` |
| **Fix** | Align to `listStatus` in `models.ts` + consumer |

### H9 — Marketplace install ignores selected device

| Field | Detail |
| --- | --- |
| **FE** | `install.ts` → `MarketplaceInstallApk(path)` only |
| **Rust** | `adb install -r` with **no `-s` serial** |
| **Impact** | Installs on ADB default device, not UI selection |
| **Fix** | Thread `selectedSerial` through download/install IPC |

### H10 — File Explorer history desyncs on mutations

| Field | Detail |
| --- | --- |
| **Location** | `useFileExplorerMutations` → `loadFiles(path)` default `pushToHistory=true`; loader always advances index |
| **Impact** | Extra Back clicks after create/rename/delete |
| **Fix** | Mutations use `loadFiles(path, false)`; only advance index when stack grows |

### H11 — Nested button-in-button in DeviceSwitcher (a11y)

| Field | Detail |
| --- | --- |
| **Location** | `src/shared/components/DeviceSwitcher.tsx:134-179` |
| **Impact** | Invalid HTML; broken AT/focus semantics |
| **Fix** | Row container non-button; sibling select + edit controls |

### H12 — BottomPanel resize desyncs main content padding

| Field | Detail |
| --- | --- |
| **Location** | Panel height DOM-only during drag; `MainLayout` padding from store until mouseup |
| **Impact** | Content covered/gapped during resize |
| **Fix** | Update main padding via same DOM owner during drag |

### H13 — Device poll errors invisible

| Field | Detail |
| --- | --- |
| **Location** | `MainLayout` `useQuery` + `fetchAllDevices` — no toast/log |
| **Impact** | Platform-tools failure looks like “No Device” |
| **Fix** | Throttled `handleError` / banner; prefer `allSettled` for adb vs fastboot |

### H14 — Installation package reload loop risk

| Field | Detail |
| --- | --- |
| **Location** | `InstallationTab.tsx:66-71` — reloads when `packages.length === 0` or serial mismatch |
| **Impact** | Empty legit list or load failure can re-fetch in a loop |
| **Fix** | Set `loadedSerial` on failure too; reload only on serial change / explicit refresh |

### H15 — Deflated remote ZIP direct mode / large in-memory inflate

| Field | Detail |
| --- | --- |
| **Location** | `payload/remote/mod.rs` direct extract assumes STORED ranges; prefetch can `Vec` full deflated members |
| **Impact** | Corrupt extract or multi-GB OOM (violates streaming rule) |
| **Fix** | Refuse direct mode for method ≠ 0; stream inflate to temp + mmap |

### H16 — OPS full-partition decrypt / unsparse in RAM

| Field | Detail |
| --- | --- |
| **Location** | `ops/extractor.rs`, crypto paths allocate full slices; unsparse `fs::read` |
| **Impact** | Multi-GB OOM on OPS/OFP |
| **Fix** | Block-stream decrypt + sparse expand |

---

## 5. Medium findings (selected, verified)

### Security / backend

| ID | Summary | Primary path |
| --- | --- | --- |
| M1 | Monolithic app permission `allow-all` (all custom commands one blob) | `permissions/autogenerated.toml`, `capabilities/default.json` |
| M2 | `opener:default` allows any http(s) URL; FE only filters scheme | capabilities + `runtime.ts` |
| M3 | `open_folder` accepts any existing host directory | `commands/system.rs` |
| M4 | Freeform `run_adb_host_command` / `run_fastboot_host_command` (power-user by design) | `commands/adb.rs`, `fastboot.rs` |
| M5 | SSRF IPv4-mapped IPv6 not blocked; DNS rebinding TOCTOU residual | `payload/remote/http.rs` |
| M6 | Remote HTTP allowed (`require_https: false`) | same |
| M7 | OPS `sanitize_output_name` allows `..` | `ops/extractor.rs` |
| M8 | Delta extract incomplete; ignores source_dir; token registry leak | `commands/payload.rs`, `crau/extract.rs` |
| M9 | Silent skip of OPS SHA when hex invalid | `ops/extractor.rs` |
| M10 | Magisk download: no hash; corrupt cache sticky | `magisk_download.rs` |
| M11 | Marketplace APK: unbounded body, no APK magic | `commands/marketplace.rs` |
| M12 | Aptoide detail omits TRUSTED malware filter used in search | `marketplace/aptoide.rs` |
| M13 | ZIP64 missing for OTA `payload.bin` path (factory has it) | `remote/http_zip.rs` |
| M14 | Cancel token invalid → extract uncancellable silently | `commands/payload.rs` |
| M15 | Debloat settings save discards I/O error but updates cache | `commands/debloat.rs:259-268` |
| M16 | macOS entitlements very permissive (if shipping) | `Entitlements.plist` |
| M17 | No single-instance plugin | `lib.rs` / Cargo.toml |
| M18 | CSP remote fonts + `style-src 'unsafe-inline'`; marketplace icons vs `img-src` without `https:` | `tauri.conf.json` |
| M19 | Orphan permission `marketplace_get_trending` | ACL only, no handler |
| M20 | Unpinned git dep `fix-path-env` | `Cargo.toml` |
| M21 | No `tauri.macos.conf.json` resource bundle for darwin tools | publish/CI |
| M22 | Default release `opt-level = "s"`; `release-fast` not used by CI | `Cargo.toml` |

### Frontend / UX / a11y / perf

| ID | Summary | Primary path |
| --- | --- | --- |
| M23 | Shared `DropZone` / Flasher: hover hit-tests, **drop does not** | `DropZone.tsx`, `useFlasherDropTargets.ts` |
| M24 | Root grant stays hot across device switch until verify completes | `useFileExplorerRootAccess.ts` |
| M25 | Transfer/delete serial snapshotted after dialogs (wrong device risk) | FE transfer/mutations hooks |
| M26 | RootWizard raw `listen()` (bypasses `runtime.ts`) | `RootWizard.tsx` |
| M27 | Root Cancel UI-only (backend continues) | `RootWizard.tsx` |
| M28 | Cold boot swallows `LaunchAvd` errors | `RootWizard.tsx` |
| M29 | `ProgressEvent` model ≠ real `payload:progress` payload | `models.ts` vs emit/hooks |
| M30 | Shell history unbounded; logs not virtualized (≤1000) | `shellStore`, `LogsPanel` |
| M31 | `unreadCount` re-renders entire MainLayout per log when panel closed | `MainLayout` + `logStore` |
| M32 | Whole-store Zustand in InstallationTab / RootWizard / RootManualStep | feature stores |
| M33 | Device poll always dirties `devices` + `lastUpdated` | `deviceStore` |
| M34 | Docs claim 3s poll; code is **30s** | `queries.ts` vs AGENTS.md |
| M35 | Nested main landmarks (`SidebarInset` main + `role="main"`) | `sidebar.tsx`, `ViewContent` |
| M36 | ConnectedDevicesCard edit: no `aria-label`; hover-only | `ConnectedDevicesCard.tsx` |
| M37 | `bg-success-light` used but not registered in `@theme` | `deviceStatus.ts` / `global.css` |
| M38 | `components.json` aliases point at removed `@/lib`, `@/components` | `components.json` |
| M39 | `'use client'` leftovers in Vite app (policy) | shared UI / theme |
| M40 | Double toast: ad-hoc toast + `handleError` | Dashboard, FE transfers, remote check |
| M41 | File Explorer Enter/Space does not open directories | `FileExplorerRow.tsx` |
| M42 | Dead `PanelHeader.tsx` / `useBottomPanelResize.ts` (logic inlined) | shell BottomPanel |

---

## 6. Low / informational findings

- Linux `launch_terminal` uses `xdg-open` on a directory (file manager, not terminal) — `system.rs`.
- `@tauri-apps/api`/`cli` **2.11.0** vs Rust `tauri` **2.11.5**.
- Dual Radix: `radix-ui` + leftover `@radix-ui/*`; unused `canvas-confetti`, `@radix-ui/react-switch`.
- 10 registered commands without FE wrappers (delta extract, diagnose, OPS metadata, marketplace versions, debloat restore/refresh, etc.).
- Clipboard plugin used outside desktop layer (`CopyButton`, BottomPanel) — minor architecture drift vs invoke boundary (invoke itself is clean).
- Release log targets still include Webview.
- Husky pre-commit only runs web lint.
- Publish workflow skips clippy/Rust tests (depends on prior CI).
- AGENTS.md / memory-bank still mention `app_icons.rs` and 3s poll; techContext still mentions ESLint/Prettier/xz2 in places.
- OPS real-file tests skip silently when fixture missing.
- proptest arithmetic tests do not call production coalescing APIs.
- Windows: known `cargo test` loader `STATUS_ENTRYPOINT_NOT_FOUND` — CI uses Linux for execution / Windows `--no-run`.

---

## 7. Positive practices (credit where due)

1. **Desktop IPC boundary**: production `core.invoke` only in `backend.ts`; architecture test enforces it.
2. **Tauri CSP**: tight `connect-src` (IPC-only), `script-src 'self'`, `freezePrototype: true`.
3. **No plugin-shell / no frontend fs plugin** — host power goes through audited custom commands.
4. **Clipboard least privilege** (text only).
5. **Marketplace download**: HTTPS + redirect revalidation + private IP DNS checks.
6. **Device path guards**: `validate_safe_device_path`, `validate_path_components`, tests for traversal.
7. **Root completion semantics**: automated root returns patch-installed; success requires `verify_avd_root` uid 0.
8. **Debloat disable on modern SDK**: `disable-user`, not bare `pm disable` (when SDK known).
9. **GitHub PAT / OAuth access token**: memory-only; test asserts no localStorage PAT.
10. **Payload local CrAU**: mmap/streaming, L3/L4 hashes, cooperative cancel on async ranges, factory ZIP64 + basename sanitize.
11. **Emulator AVD discovery**: `~/.android/avd/*.ini` (not `emulator -list-avds`).
12. **Frontend layout**: `h-svh overflow-hidden`, single device poll owner, BottomPanel DOM-first resize pattern, ErrorBoundaries around views.
13. **UI tokens**: almost no raw hex/rgb in features; gap-* compliance (only avatar `-space-x-2` exception).
14. **No `forwardRef`** — React 19 ref-as-prop style.
15. **CI**: format + lint + FE tests + Rust tests (Linux) + Tauri packages; version verify script.
16. **Release profile**: LTO, strip, panic=abort; optional `release-fast` documented.
17. **reqwest rustls** — avoids OpenSSL linking.
18. **Virtualization** on File Explorer / debloat / installed packages lists.

---

## 8. Domain deep-dives

### 8.1 Tauri configuration & ACL

- Capability: single window `"main"`; permissions: `core:default`, `opener:default`, `dialog:default`, `log:default`, clipboard text r/w, app `allow-all`.
- `allow-all` enumerates ~74 command names (one orphan: `marketplace_get_trending`).
- Plugins: log, dialog, opener, clipboard — no shell/http/updater/single-instance.
- CSP object form present; remote fonts from Google; img-src lacks generic `https:` (marketplace remote icons may break under strict enforcement).

**Official basis:** Tauri 2 ACL (permissions + capabilities) replaces v1 allowlist — least privilege is recommended for multi-window/isolation growth.

### 8.2 IPC contract

| Metric | Value |
| --- | ---: |
| Registered commands | 73 |
| FE wrappers | 63 |
| Permission orphan | 1 |
| Critical DTO mismatch | 1 (`listStatus`) |
| Event architecture violation | 1 (`RootWizard` raw listen) |

### 8.3 Frontend architecture

- No router; `ViewType` + `VIEW_RENDERERS` intact.
- Single all-devices poll in MainLayout (**30s**, not 3s).
- Feature gotchas mostly honored for File Explorer empty state / loadFiles stability.
- Gaps: multi-device serial discipline, drop hit-test on drop, error surface for poll, a11y nested buttons.

### 8.4 Testing

| Surface | Assessment |
| --- | --- |
| FE stores / RootWizard / payload cancel *state* | Decent |
| FE cancel IPC actually called | Weak/missing |
| IPC parity test | Partial (2 commands only in `tauriPermissions`) |
| Rust SSRF pure functions | **No unit tests** |
| Rust `sanitize_filename` helpers | **No unit tests** |
| Rust shell metachar validation | **No unit tests** |
| OPS/OFP crypto vectors | Weak / skip-if-missing |
| Debloat `build_commands` SDK matrix | **No tests** |
| Windows local `cargo test` | Known loader issue |

---

## 9. Prioritized remediation roadmap

### P0 — Safety (do first)

1. Sanitize **all** extract basenames (C1) + stop `remove_dir_all` on user dirs (C2).
2. Remote HTTP: redirect revalidation + IPv4-mapped IPv6 (H1, M5).
3. Debloat: fail closed on SDK=0; device-keyed cache; sanitize backup `file_name` (H2–H4).
4. File shell: `adb_shell_checked` for mutations; fail `list_files` on error output (H6–H7).

### P1 — Multi-device correctness

5. Pass `selectedSerial` through marketplace install (H9).
6. Debloat FE reload on serial change + backend `-s` (H3).
7. FE transfer/delete/root-grant serial snapshots (M24–M25).
8. Fix `listStatus` DTO (H8).

### P2 — Product honesty & root

9. Real Magisk latest fetch + integrity (H5, M10).
10. RootWizard: `EventsOn`, real cancel or honest UX, cold-boot errors (M26–M28).
11. Delta command: implement or reject explicitly; TokenGuard (M8).

### P3 — UX / a11y / perf

12. DeviceSwitcher nested buttons; ConnectedDevices aria-label (H11, M36).
13. Resize padding sync (H12); drop hit-test (M23).
14. Device poll errors (H13); InstallationTab loop (H14).
15. Store selectors / log virtualization / unreadCount isolation (M30–M33).
16. Register `success-light` theme token (M37).

### P4 — Hardening & tooling

17. Split `allow-all` by feature; narrow opener; bound `open_folder` (M1–M3).
18. Single-instance plugin; pin `fix-path-env` rev (M17, M20).
19. Self-host fonts / fix img CSP vs marketplace icons (M18).
20. Permission↔handler↔backend.ts parity test; expand SSRF/sanitize unit tests.
21. macOS `tauri.macos.conf.json` resources if shipping; align release profile with extract perf claims (M21–M22).
22. Unify Radix; drop dead deps; fix `components.json` aliases; strip `'use client'`.

---

## 10. Explicit non-findings / false-positive filters

| Claim | Why not a finding |
| --- | --- |
| OPS/OFP AES key tables in source | Public format constants (opscrypto / community OFP tools), not app secrets |
| GitHub PAT in repo | Not present; session-only in-memory with test |
| `allow-all` = unrestricted OS | Named command allowlist; not plugin-shell |
| Production `.unwrap()` in command modules | None found (tests/bootstrap only) |
| File Explorer historyIndex request loop | Correctly avoided via refs |
| PAT localStorage persistence | Correctly not persisted |
| Emulator root proven only by su uid 0 | Holds for `verify_avd_root` |
| Debloat uses bare `pm disable` on modern SDK | Uses `disable-user` when sdk ≥ 23 (broken only when sdk=0) |

---

## 11. Resources used

### Project

- `AGENTS.md`, `memory-bank/*`, `docs/ultracite-standards.md`
- Skills: `.agents/skills/backend/rust-skills`, `rust-patterns`, `rust-testing`; frontend shadcn/tailwind/react/a11y/vitest skills
- Source trees: `src/**`, `src-tauri/src/**`, `src-tauri/capabilities`, `permissions`, `tauri*.conf.json`, `.github/workflows/*`

### Official / external (via Context7)

- Tauri 2: ACL, capabilities, permissions, async commands, `Result` error handling — https://v2.tauri.app
- React 19: Effects, stale async cleanup, ref cleanup — https://react.dev

### Skill rule IDs cited most often

- `err-no-unwrap-prod`, `err-result-over-panic`
- `async-spawn-blocking`, `async-no-lock-await`
- AGENTS: `sanitize_filename`, `adb_shell_checked`, `CmdResult`, desktop IPC layer, semantic tokens, a11y icon labels

---

## 12. How to use this report

1. Treat **Critical + High** as a fix queue for the next hardening sprint.
2. Do **not** “drive-by refactor” while fixing — surgical patches only (AGENTS).
3. For each fix: add a focused unit/Vitest test that would have failed before (especially SSRF, sanitize, SDK=0, listStatus, serial-targeted install).
4. Re-run verification per AGENTS layer policy (`lint:web` / `lint:rust` / `test` / `cargo test` on Linux CI).

---

## 13. Appendix — Subagent coverage matrix

| Area | Subagents | Status |
| --- | --- | --- |
| Tauri ACL/CSP | 1 | Complete |
| Commands/helpers | 2, 12, 15 | Complete |
| Payload | 3, 12 | Complete |
| Marketplace/emulator/debloat | 4, 12 | Complete |
| IPC contracts | 5 | Complete |
| Shell / architecture | 6, 15 | Complete |
| Features | 7, 14 | Complete |
| UI/theme | 8 | Complete |
| Perf/a11y | 9 | Complete |
| FE tests | 10 | Complete |
| Rust tests | 11 | Complete |
| Deps/CI | 13 | Complete |

---

---

## 14. Remediation status (2026-07-17)

Plan: `docs/superpowers/plans/2026-07-17-audit-remediation.md`

| Bucket | Status |
| --- | --- |
| C1–C2 extract path + transaction wipe | **Fixed** |
| H1 remote SSRF redirects + IPv4-mapped IPv6 | **Fixed** |
| H2–H4 debloat SDK / cache / backup path | **Fixed** |
| H5 Magisk live fetch | **Fixed** (GitHub latest + v25.2 fallback) |
| H6–H7 file shell exit checks + list_files errors | **Fixed** |
| H8 listStatus IPC | **Fixed** |
| H9 marketplace install serial | **Fixed** |
| H10–H14 FE history / a11y / poll / install loop | **Fixed** |
| H15–H16 large OPS/remote memory / deflated direct | **Deferred** (documented) |
| Selected Medium (drop hit-test, EventsOn, cancel tokens, theme token, ACL orphan) | **Fixed** |
| ACL split / single-instance / dual Radix / log virtualization | **Deferred** |

**Verification after remediation:** `bun run lint:web` ✅ · `bun run lint:rust` ✅ · `bun run test` ✅ 191/191 · `bun run build` ✅ · `cargo check` ✅

*Original audit body above remains the finding baseline; this section is the post-fix ledger.*
