# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status (2026-07-17):** Tasks 1–15 implemented in working tree. **No commits.**
>
> **Verification:** `bun run lint:web` ✅ · `bun run lint:rust` ✅ · `bun run test` ✅ (191/191) · `bun run build` ✅ · `cargo check` ✅
>
> **Docs refresh (same day):** memory-bank, AGENTS.md, README.md, and audit report §14 updated to match post-remediation behavior.

**Goal:** Remediate all Critical and High findings from `docs/reports/active/FULL-PROJECT-AUDIT-REPORT-2026-07-17.md`, plus high-value Medium items (multi-device safety, a11y, drop hit-test, IPC/DTO, theme token, error visibility), without commits.

**Architecture:** Surgical fixes only. Shared helpers in `helpers.rs` / `payload` for sanitize and SSRF; thin command wrappers stay thin; FE multi-device serial threaded through IPC; no drive-by refactors.

**Tech Stack:** Rust 2024 + Tauri 2 · React 19 · TypeScript · Vitest · Bun

**Constraints:**
- **No git commits**
- Match existing style; AGENTS.md boundaries
- Prefer tests for security pure functions
- Windows: prefer `cargo test --no-run` or targeted lib tests; FE `bun run test`

**Spec source:** `docs/reports/active/FULL-PROJECT-AUDIT-REPORT-2026-07-17.md` (C1–C2, H1–H16, selected M*)

---

## File ownership map

| Wave | Domain | Primary files |
| --- | --- | --- |
| A | Payload path/SSRF/transaction | `helpers.rs`, `payload/transaction.rs`, `payload/crau/extract.rs`, `payload/remote/mod.rs`, `payload/remote/http.rs`, `payload/ops/extractor.rs` |
| B | Debloat safety | `debloat/sync.rs`, `debloat/actions.rs`, `debloat/backup.rs`, `debloat/cache.rs`, `commands/debloat.rs` |
| C | File shell | `helpers.rs` (adb_shell_checked), `commands/files.rs` |
| D | Magisk + marketplace install serial | `emulator/magisk_download.rs`, `commands/marketplace.rs`, `backend.ts`, `install.ts` |
| E | FE multi-device + IPC + FE bugs | DebloaterTab, InstallationTab, FE history, DropZone, RootWizard, listStatus |
| F | Shell a11y/perf/error | DeviceSwitcher, ConnectedDevicesCard, MainLayout, deviceStore, theme |
| G | Config polish | permissions orphan, success-light theme, components.json aliases optional |

---

### Task 1: Shared basename sanitize + CrAU/remote/OPS path safety (C1, M7)

**Files:**
- Modify: `src-tauri/src/helpers.rs` (export/strengthen `sanitize_filename` or add `safe_image_file_name`)
- Modify: `src-tauri/src/payload/crau/extract.rs`
- Modify: `src-tauri/src/payload/remote/mod.rs` (all `format!("{}.img", partition_name)` joins)
- Modify: `src-tauri/src/payload/ops/extractor.rs` (`sanitize_output_name`)
- Test: helpers unit tests for sanitize

- [ ] Add/ensure `safe_image_file_name(name: &str) -> String` using `sanitize_filename`, reject empty/`.`/`..`, ensure ends with `.img` when needed
- [ ] Use it for all CrAU/remote extract output basenames
- [ ] OPS extractor: use same helper; never allow `..`
- [ ] Unit tests: `../../evil`, empty, `..`, normal `system`

---

### Task 2: TransactionGuard must not wipe user directories (C2)

**Files:**
- Modify: `src-tauri/src/payload/transaction.rs`
- Test: add unit test if feasible

- [ ] On abort/drop: delete **only** registered files; **remove** `remove_dir_all(&self.dir)`
- [ ] Document that incomplete parent dirs may remain empty (acceptable)

---

### Task 3: Remote HTTP SSRF redirect revalidation (H1, M5, M6 partial)

**Files:**
- Modify: `src-tauri/src/payload/remote/http.rs`
- Test: unit tests for `is_blocked_ip` IPv4-mapped, `is_private_url`

- [ ] Build client with `redirect(Policy::none())` (async + blocking)
- [ ] Manual redirect follow with hop limit; `validate_outbound_url` each hop
- [ ] Block IPv4-mapped IPv6 via convert-to-v4 + `is_blocked_ip`
- [ ] Prefer HTTPS for remote payload when easy without breaking product: keep http allowed but document; optionally require https for non-localhost only if already product-ok — **keep http allowed** if product needs lab mirrors, but fix redirects/IPs
- [ ] Table tests for blocked IPs including `::ffff:127.0.0.1`

---

### Task 4: Debloat destructive safety (H2, H3, H4, M15)

**Files:**
- Modify: `src-tauri/src/debloat/sync.rs`, `actions.rs` (or call sites), `backup.rs`, `cache.rs`
- Modify: `src-tauri/src/commands/debloat.rs`
- Modify: FE `DebloaterTab.tsx` for serial reload

- [ ] `get_android_sdk` failure: surface as `Err` for destructive paths OR `try_get_android_sdk() -> Result<u32, String>` and refuse actions when 0/unknown
- [ ] Disable must not map to Uninstall when SDK unknown
- [ ] Cache key by `device_id`; miss on serial change
- [ ] `load_backup`: sanitize basename, canonicalize under backup_dir
- [ ] `save_debloat_device_settings`: propagate save errors (`??`)
- [ ] FE: reload debloat data when `selectedSerial` changes; pass serial if backend supports

---

### Task 5: File shell exit checking + list_files errors (H6, H7)

**Files:**
- Modify: `src-tauri/src/helpers.rs` — promote `adb_shell_checked` from emulator or shared helper
- Modify: `src-tauri/src/commands/files.rs`
- Reference: `src-tauri/src/emulator/root.rs` pattern

- [ ] Shared `adb_shell_checked` for critical shell ops
- [ ] delete/rename/create use checked shell
- [ ] `list_files`: treat common error substrings as Err (no such file, not a directory, permission denied, etc.)

---

### Task 6: Magisk live fetch (H5, M10 partial)

**Files:**
- Modify: `src-tauri/src/emulator/magisk_download.rs`

- [ ] Production path: fetch GitHub releases/latest (or releases API) with HTTPS
- [ ] Parse APK asset; keep local rootAVD zip as optional override only if product still wants it — prefer API first, local fallback second with clear log
- [ ] If cache exists without integrity, re-download when size=0 or missing; basic size check after download
- [ ] Validate download URL with `validate_outbound_url(..., true)` when fetching

---

### Task 7: Marketplace install serial + install path (H9, M11 partial)

**Files:**
- Modify: `src-tauri/src/commands/marketplace.rs`
- Modify: `src/desktop/backend.ts`
- Modify: `src/features/marketplace/utils/install.ts` + callers
- Modify: models if needed

- [ ] `marketplace_install_apk(app, apk_path, serial: Option<String>)` with `adb -s` when serial present
- [ ] Prefer require owned download path for install (or keep allow any with serial — at minimum add serial)
- [ ] FE passes `selectedSerial` from device store

---

### Task 8: IPC listStatus + ProgressEvent model (H8, M29)

**Files:**
- Modify: `src/desktop/backend.ts` DebloatData
- Modify: `src/features/app-manager/debloater/ui/DebloaterTab.tsx`
- Prefer: move DebloatData to `models.ts`
- Modify: `src/desktop/models.ts` ProgressEvent to match emit (`current`/`total`)

- [ ] `listStatus` camelCase end-to-end
- [ ] ProgressEvent fields match Rust emits

---

### Task 9: File Explorer history + serial snapshots + root grant (H10, M24, M25)

**Files:**
- Modify: `useFileExplorerMutations.ts`, `useFileExplorerLoader.ts`, `useFileExplorerTransfers.ts`, `useFileExplorerRootAccess.ts`

- [ ] Mutations call `loadFiles(path, false)`
- [ ] History only advances index when stack actually grows
- [ ] Snapshot serial/path at transfer/delete start
- [ ] On serial change: clear root grant immediately before re-verify

---

### Task 10: Drop hit-test on drop (M23)

**Files:**
- Modify: `src/shared/components/DropZone.tsx`
- Modify: `src/features/flasher/hooks/useFlasherDropTargets.ts`

- [ ] On drop, hit-test x,y against container before accepting paths

---

### Task 11: RootWizard EventsOn + cold boot errors (M26, M28; cancel note)

**Files:**
- Modify: `src/features/emulator/ui/RootWizard.tsx`

- [ ] Use `EventsOn` from `@/desktop/runtime` for `root:progress`
- [ ] Cold boot: handle LaunchAvd errors with toast/log
- [ ] Cancel: keep UI cancel but toast that backend may continue if no token (honest UX) OR leave as documented soft cancel

---

### Task 12: InstallationTab loop + device poll errors + store thrash (H13, H14, M33)

**Files:**
- Modify: `InstallationTab.tsx`, `MainLayout.tsx`, `deviceStore.ts`, `queries.ts` optional

- [ ] Installation: set loadedSerial even on error; don't loop on empty list
- [ ] Device poll: surface error via handleError throttled or toast once
- [ ] setDevices: skip update if serial/status list unchanged (shallow compare)

---

### Task 13: A11y DeviceSwitcher + ConnectedDevices + theme (H11, M36, M37)

**Files:**
- Modify: `DeviceSwitcher.tsx`, `ConnectedDevicesCard.tsx`, `global.css`, `deviceStatus.ts` if needed

- [ ] Fix nested button structure
- [ ] aria-label + focus-visible on edit buttons
- [ ] Register `--color-success-light` in `@theme` OR change badge to `bg-success/15`

---

### Task 14: Config cleanup (M19, M34 docs optional, orphan permission)

**Files:**
- Modify: `src-tauri/permissions/autogenerated.toml` remove `marketplace_get_trending` if unused
- Modify: `AGENTS.md` poll 3s → 30s (docs only if editing)

- [ ] Remove dead ACL entry
- [ ] Align AGENTS device poll text to 30s

---

### Task 15: Delta TokenGuard + invalid cancel token (M8 partial, M14)

**Files:**
- Modify: `src-tauri/src/commands/payload.rs`

- [ ] TokenGuard on delta extract like extract_payload
- [ ] If cancel_token_id is Some but invalid, return Err instead of running uncancellable

---

### Task 16: Verification

- [ ] `bun run format:web:check` or fix on touched FE
- [ ] `bun run lint:web`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run lint:rust` when practical
- [ ] Targeted cargo tests where possible

---

### Deferred (document, do not block)

- Full OPS streaming decrypt (large rewrite)
- ZIP64 http_zip full parity
- Split allow-all into multiple capabilities
- Single-instance plugin
- Dual Radix cleanup / canvas-confetti removal
- Full Magisk SHA256 of GitHub assets when digest unavailable
- Virtualize logs / payload progress parent isolation (perf polish)

---

## Execution order

1. Tasks 1–3 (payload safety) parallel with 4–5 (debloat + files) if careful on helpers.rs  
2. Tasks 6–8 backend/IPC  
3. Tasks 9–13 FE  
4. Tasks 14–15 polish  
5. Task 16 verify  

**No commits at any step.**
