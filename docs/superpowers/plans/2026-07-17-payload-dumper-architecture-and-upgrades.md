# Payload Dumper Architecture + Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Parallel execution:** Tasks marked `parallel-group: W#G#` may run concurrently if they share no file writes. Respect **Depends-on**. Orchestrator dispatches one subagent per task (or one per parallel group with isolated file sets).

**Goal:** Restructure `payload/` into a scalable domain layout, then apply remote-URL UX + reference-backed correctness/performance upgrades so adb-gui-next remains the broadest desktop dumper while matching best-of-breed verify, remote architecture, and maintainability.

**Architecture:** Thin `commands/payload.rs` → domain router → `source`/`zip`/`crau`/`remote`/`ops` → shared `io` + `verify` + `cancel` + `transaction`. One CrAU extract engine; remote supplies ReadAt/ranges only; factory stays a separate ZIP-image path. Frontend only consumes events (load stages + extract progress).

**Tech Stack:** Rust 2024, Tauri 2, rayon, memmap2, reqwest, sha2, xz2→liblzma, bzip2, zstd, flate2(+zlib-rs), bytes, optional mimalloc; prost; React 19, TypeScript, Zustand, Vite 8, Bun.

**Baseline already on branch (pre–Wave 0):** remote factory images, async factory extract, cancellable HTTP ranges, cancel UX + partial files, smart remote auto-select, related tests. Do not re-implement those in Wave 0.

---

## Global agent rules (non-negotiable)

| Rule | Detail |
|------|--------|
| **NO COMMITS during plan execution** | Implementers and reviewers must **not** run `git commit`, `git push`, or amend. Human commits baseline separately. Plan work stays uncommitted until human asks. |
| **Docs in realtime** | Every completed task that changes behavior or layout **must** update the relevant doc in the same work unit (see Doc sync checklist). |
| **Surgical** | No drive-by refactors outside the task file list. |
| **Verify** | Run the task’s verify commands; report outcomes to orchestrator. |
| **Windows cargo test** | Prefer `cargo test --manifest-path src-tauri/Cargo.toml --no-run` after Rust changes; full run may hit known `STATUS_ENTRYPOINT_NOT_FOUND`. Use isolated `CARGO_TARGET_DIR` if DLL locks. |
| **TDD where stated** | Write/adjust tests before or with behavior; never delete coverage without replacement. |
| **Parallel safety** | Do not edit the same path as another running parallel agent. Prefer exclusive file ownership per group. |
| **Subagent-driven-dev override** | Ignore any template step that says “Commit”. Self-review + leave working tree dirty. |

### Doc sync checklist (realtime)

| When you change… | Update… |
|------------------|---------|
| `payload/` module tree | `docs/reports/active/PAYLOAD-DUMPER-FOLDER-ARCHITECTURE-2026-07-17.md` status notes; `memory-bank/systemPatterns.md` payload section if present |
| Remote list/extract/UX | `docs/reports/active/PAYLOAD-DUMPER-REMOTE-URL-SUPPORT-MATRIX-2026-07-17.md` (mark implemented items) |
| Verify/perf/readers | `docs/reports/active/PAYLOAD-DUMPER-REFERENCE-COMPARISON-2026-07-17.md` (check off proposals landed) |
| Perf/libs decisions | `docs/reports/active/PAYLOAD-DUMPER-BEFORE-AFTER-PERF-LIBS-2026-07-17.md` |
| User-visible feature done | `memory-bank/activeContext.md` + `memory-bank/progress.md` short bullet |
| This plan progress | Check boxes `- [x]` in **this file** |

### Spec sources (read before coding)

1. `docs/reports/active/PAYLOAD-DUMPER-FOLDER-ARCHITECTURE-2026-07-17.md`  
2. `docs/reports/active/PAYLOAD-DUMPER-REMOTE-URL-SUPPORT-MATRIX-2026-07-17.md`  
3. `docs/reports/active/PAYLOAD-DUMPER-REFERENCE-COMPARISON-2026-07-17.md`  
4. `docs/reports/active/PAYLOAD-DUMPER-BEFORE-AFTER-PERF-LIBS-2026-07-17.md`  
5. `AGENTS.md` (commands thin, domain in `payload/`)  
6. Current code under `src-tauri/src/payload/`, `commands/payload.rs`, `src/features/payload-dumper/`

---

## Target file map (end state)

```text
src-tauri/src/payload/
  mod.rs, error.rs, types.rs, cancel.rs, transaction.rs
  source/{mod,local_mmap,window}.rs
  zip/{mod,eocd,central_dir,local_header,stored_window,extract_entry}.rs
  crau/{mod,header,manifest,ops,extract,progress,diagnose}.rs
  io/{mod,write,copy,buffers}.rs
  verify/{mod,op_blob,output_file,mode}.rs
  remote/{mod,http,http_zip,factory,prefetch,direct,list,metadata,load_progress}.rs  # feature remote_zip
  ops/… (existing; optional extract rename)
  delta/{mod,source_copy}.rs
  tests/{mod,crau_extract,zip_eocd,factory_cd}.rs

src/features/payload-dumper/ui/RemoteLoadProgressCard.tsx
src/features/payload-dumper/hooks/* (load phase state)
src/desktop/models.ts + backend.ts (new fields/events as needed)
```

---

## Execution DAG (subagent waves)

```text
Wave 0 — Structure only (behavior-preserving)
  W0G1: scaffolding + types extract          [serial start]
  W0G2: io/ move          ─┐
  W0G3: verify/ shell     ─┼─ parallel after W0G1 types stable
  W0G4: zip/ + source/    ─┘
  W0G5: crau/ split            depends W0G2+W0G4
  W0G6: remote/ split          depends W0G4
  W0G7: tests split + mod glue depends W0G5+W0G6
  W0G8: docs architecture ✅   can parallel late Wave 0

Wave 1 — Correctness (P0)
  W1G1: L2/L4 verify unify + wire          serial recommended first
  W1G2: multi-extent + fail-hard decomp    after/with W1G1
  W1G3: remote hash = local compressed     after W1G1
  W1G4: tests for verify + extents         parallel with W1G2/W1G3 if files disjoint

Wave 2 — Remote UX + load progress
  W2G1: Rust payload:load-progress emits   parallel
  W2G2: FE RemoteLoadProgressCard          parallel with W2G1 (contract first)
  W2G3: download_size on list DTO          parallel
  W2G4: wire FE events + cancel load UX    depends W2G1+W2G2

Wave 3 — Remote architecture / perf (+ build/libs)
  W3G0: release-fast profile (opt-level=3) + keep size profile   [early, high ROI]
  W3G1: shared HTTP + cached ZIP offsets
  W3G2: span prefetch (not whole ZIP)
  W3G3: ZIP stored_window for local        parallel with W3G2
  W3G4: buffer pools + flate2 zlib-rs + bytes remote             parallel
  W3G5: OPS cancel + better writer         parallel
  W3G6: no-range fallback + hard cancel    after W3G1
  W3G7: liblzma migrate from xz2 (measure) after W3G0
  W3G8: mimalloc optional (measure Win/Lin) optional

Wave 4 — Polish / optional
  W4G1: partition status enum FE
  W4G2: extraction stats event
  W4G3: delta real work ONLY if product green-lights (default SKIP)
  W4G4: tauri-plugin-notification + single-instance (UX/reliability, not GB/s)
  W4G5: final memory-bank + report checkoffs
```

---

## Wave 0 — Structure (behavior-preserving)

### Task 0.1: Scaffold folders + thin `mod.rs` plan

**parallel-group:** W0G1  
**Depends-on:** none  
**Files:**
- Create: `src-tauri/src/payload/{source,zip,crau,io,verify,remote,delta,tests}/mod.rs` (empty `// scaffold` modules as needed)
- Modify: `src-tauri/src/payload/mod.rs` (wire modules gradually; keep old paths exporting until moves complete)

- [ ] **Step 1:** Create subdirectories listed in target map with `mod.rs` files that compile (`pub mod x;` stubs OK).  
- [ ] **Step 2:** Ensure `cargo check --manifest-path src-tauri/Cargo.toml` succeeds (isolated `CARGO_TARGET_DIR` if needed).  
- [ ] **Step 3:** Doc: note “Wave 0 started” in architecture report § status if present, or add a one-line “Implementation status: Wave 0 in progress” at top of architecture report.  
- [ ] **Step 4:** **NO COMMIT.**

**Verify:** `cargo check --manifest-path src-tauri/Cargo.toml`  
**Expected:** success

---

### Task 0.2: Extract shared types into `types.rs`

**parallel-group:** W0G1  
**Depends-on:** Task 0.1  
**Files:**
- Create: `src-tauri/src/payload/types.rs`
- Modify: `src-tauri/src/payload/extractor.rs` (move `PartitionDetail`, `ExtractPayloadResult`, `RemotePayloadMetadata`, `DynamicGroupInfo`, `PayloadDiagnostics` if defined there)
- Modify: `src-tauri/src/payload/mod.rs` re-exports

- [ ] **Step 1:** Move public DTO structs with identical serde attributes (`rename_all = "camelCase"`) into `types.rs`.  
- [ ] **Step 2:** Re-export from `mod.rs` so `commands/payload.rs` and FE contracts need **zero** path changes if possible (`pub use types::…`).  
- [ ] **Step 3:** `cargo check` + existing payload unit tests compile.  
- [ ] **Step 4:** **NO COMMIT.**

**Verify:** TypeScript still builds if IPC shapes unchanged: `bun run build` only if serde field names changed (should not).

---

### Task 0.3: Move I/O stack → `io/`

**parallel-group:** W0G2  
**Depends-on:** Task 0.1  
**Files:**
- Move: `copy.rs` → `io/copy.rs`, `write.rs` → `io/write.rs`
- Create: `io/mod.rs`, stub `io/buffers.rs` (empty re-export or `// later Wave 3`)
- Modify: all `use super::copy` / `write` paths

- [ ] **Step 1:** `git mv` or move files; fix module paths.  
- [ ] **Step 2:** Keep public API: `pub use io::{…}` from root if previously public.  
- [ ] **Step 3:** `cargo check` + `cargo test --manifest-path src-tauri/Cargo.toml --lib --no-run`.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 0.4: Move verify shell → `verify/`

**parallel-group:** W0G3  
**Depends-on:** Task 0.1  
**Files:**
- Move: `verify.rs` → `verify/mode.rs` + `verify/op_blob.rs` + `verify/output_file.rs` (split by function; behavior unchanged; dead code may stay dead until Wave 1)
- Create: `verify/mod.rs`

- [ ] **Step 1:** Split without wiring L4 yet.  
- [ ] **Step 2:** Re-export `VerifyMode`, `VerificationResult`.  
- [ ] **Step 3:** compile.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 0.5: Move ZIP + introduce `source/`

**parallel-group:** W0G4  
**Depends-on:** Task 0.1  
**Files:**
- Move: `zip.rs` → `zip/extract_entry.rs`
- Move: `zip_mmap.rs` → `zip/stored_window.rs` and **register** it in `zip/mod.rs` (even if only used by tests initially)
- Extract shared EOCD helpers from `http_zip.rs` / `factory_image.rs` into `zip/eocd.rs` **only if** identical code can move without behavior change; otherwise leave duplication for Wave 3 and document TODO in `zip/mod.rs`
- Create: `source/mod.rs`, `source/local_mmap.rs` (wrap `open_mmap` from parser)

- [ ] **Step 1:** Moves + compile.  
- [ ] **Step 2:** Document any remaining EOCD duplication in architecture report.  
- [ ] **Step 3:** **NO COMMIT.**

---

### Task 0.6: Split CrAU into `crau/`

**parallel-group:** W0G5  
**Depends-on:** Task 0.2, 0.3, 0.5  
**Files:**
- Split: `parser.rs` → `crau/header.rs`, `crau/manifest.rs`
- Split: `extractor.rs` → `crau/extract.rs`, `crau/ops.rs`, `crau/progress.rs`, `crau/diagnose.rs`
- Create: `crau/mod.rs`
- Modify: root `mod.rs` re-exports so commands still work

- [ ] **Step 1:** Behavior-preserving move; **do not** change op semantics.  
- [ ] **Step 2:** Ensure `extract_payload`, list, diagnose symbols re-exported.  
- [ ] **Step 3:** Run payload-related unit tests (`--no-run` then run if possible).  
- [ ] **Step 4:** Update architecture report move map checkmarks.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 0.7: Split remote into `remote/`

**parallel-group:** W0G6  
**Depends-on:** Task 0.5  
**Files:**
- Move: `http.rs` → `remote/http.rs`
- Move: `http_zip.rs` → `remote/http_zip.rs`
- Move: `factory_image.rs` → `remote/factory.rs`
- Split: `remote.rs` → `remote/{list,metadata,prefetch,direct}.rs`
- Create: `remote/mod.rs` with feature cfg
- Stub: `remote/load_progress.rs` (`// Wave 2`)

- [ ] **Step 1:** Preserve public functions: `extract_remote_*`, `list_remote_*`, `get_remote_payload_metadata`, `HttpPayloadReader`, factory APIs.  
- [ ] **Step 2:** Feature `remote_zip` still gates module.  
- [ ] **Step 3:** `cargo check` with default features.  
- [ ] **Step 4:** Doc: remote matrix “module path updated”.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 0.8: Tests split + delta folder + root cleanup

**parallel-group:** W0G7  
**Depends-on:** Task 0.6, 0.7  
**Files:**
- Move: `tests.rs` → `tests/mod.rs` + split modules (`crau_extract.rs`, `zip`/`factory` tests)
- Move: `delta.rs` → `delta/source_copy.rs`
- Remove empty old root files
- Fix: `ops/test_ops_decrypt.rs` → prefer `#[cfg(test)]` module or keep but document

- [ ] **Step 1:** All former tests still registered under `#[cfg(test)] mod tests`.  
- [ ] **Step 2:** Compile tests.  
- [ ] **Step 3:** Architecture report: Wave 0 complete.  
- [ ] **Step 4:** **NO COMMIT.**

**Wave 0 exit criteria:** Default `cargo check` green; FE `bun run build` if only re-exports; no intentional behavior change.

---

## Wave 1 — Correctness (P0 from reference comparison)

### Task 1.1: Unify verification (L2 compressed + L4 file hash)

**parallel-group:** W1G1  
**Depends-on:** Wave 0 complete  
**Files:**
- Modify: `verify/op_blob.rs`, `verify/output_file.rs`, `verify/mode.rs`
- Modify: `crau/ops.rs` / `crau/extract.rs` (call sites)
- Test: `payload/tests/` or colocated verify tests

- [ ] **Step 1:** Write failing tests:
  - Compressed blob hash mismatch fails extract.
  - When `new_partition_info.hash` present and `layer4_enabled`, wrong output file fails after write.
- [ ] **Step 2:** Implement: hash **raw op bytes** before decompress (AOSP / existing local fix).  
- [ ] **Step 3:** After successful partition write, optional parallel file SHA-256 vs manifest hash.  
- [ ] **Step 4:** Remove `#[allow(dead_code)]` from wired helpers.  
- [ ] **Step 5:** Doc: check off C1/C2 in reference comparison report.  
- [ ] **Step 6:** **NO COMMIT.**

**Verify:** unit tests pass (or `--no-run` + Linux CI note).

---

### Task 1.2: Multi-extent REPLACE* + fail-hard decompress

**parallel-group:** W1G2  
**Depends-on:** Task 1.1 preferred  
**Files:**
- Modify: `crau/ops.rs`
- Test: synthetic multi-extent payload if feasible; else unit test extent loop with mock writer

- [ ] **Step 1:** Ensure all `dst_extents` written at correct `start_block * block_size` (not only `[0]`).  
- [ ] **Step 2:** Decompress/decode errors return `Err` (no soft Ok after warn).  
- [ ] **Step 3:** Transaction/delete partial `.img` on failure (use existing `transaction`).  
- [ ] **Step 4:** Doc: C4/C5 checkoff.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 1.3: Remote op-hash path matches local

**parallel-group:** W1G3  
**Depends-on:** Task 1.1  
**Files:**
- Modify: `remote/direct.rs`, `remote/prefetch.rs` (and any stream_copy hash usage)

- [ ] **Step 1:** Grep remote path for `Sha256` / hasher-in-stream_copy; fix to compressed-blob semantics.  
- [ ] **Step 2:** Add regression unit test if remote logic can be exercised offline with fixed bytes.  
- [ ] **Step 3:** Doc: C3 checkoff.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 1.4: Wave 1 verification suite

**parallel-group:** W1G4  
**Depends-on:** Task 1.1–1.3  
**Files:** tests only + this plan checkboxes

- [ ] **Step 1:** Run `bun run lint:web` only if FE untouched; else skip.  
- [ ] **Step 2:** `cargo check` + payload tests.  
- [ ] **Step 3:** Update `memory-bank/progress.md` with Wave 1 correctness bullets.  
- [ ] **Step 4:** **NO COMMIT.**

---

## Wave 2 — Remote load UX (remote matrix §9)

### Contract (freeze before parallel FE/Rust)

Event name: `payload:load-progress`  

```json
{
  "phase": "verifyConnection" | "locateIndex" | "detectFormat" | "readPartitions" | "done" | "error",
  "message": "string",
  "detail": "string | null",
  "step": 1,
  "totalSteps": 4
}
```

DTO optional: `PartitionDetail` gains `downloadSize?: number` (camelCase serde).

---

### Task 2.1: Emit load-progress from remote list

**parallel-group:** W2G1  
**Depends-on:** Wave 1 recommended; Wave 0 required  
**Files:**
- Modify: `remote/list.rs`, `remote/load_progress.rs`, `remote/factory.rs`, `remote/http_zip.rs` (emit at phase boundaries)
- Modify: `commands/payload.rs` if AppHandle needed for list command

- [ ] **Step 1:** Implement `emit_load_progress(app, phase, …)` helper.  
- [ ] **Step 2:** Call at: start (verifyConnection), after EOCD/CD, after format detect (payload vs factory), before return partitions, on error.  
- [ ] **Step 3:** List command remains returning `Vec<PartitionDetail>`.  
- [ ] **Step 4:** Doc: remote matrix §9.9 Phase 3 marked in progress/done.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 2.2: Frontend `RemoteLoadProgressCard`

**parallel-group:** W2G2  
**Depends-on:** Contract above (can start without Rust if using optimistic stages)  
**Files:**
- Create: `src/features/payload-dumper/ui/RemoteLoadProgressCard.tsx`
- Modify: `PayloadSourceTabs.tsx` or `PayloadDumperView.tsx` — replace Cancel-only bar during `loading-partitions` when remote
- Modify: store/hooks for `loadPhase` optional state

- [ ] **Step 1:** Implement in-panel card per architecture/remote matrix ASCII (steps 1–4, indeterminate bar, elapsed timer, “not full {size}” copy, Cancel).  
- [ ] **Step 2:** Show while `status === 'loading-partitions'` and remote mode **even if `payloadPath` empty** (fix branch bug).  
- [ ] **Step 3:** Unit/smoke: store/status if existing tests; otherwise component renders with props.  
- [ ] **Step 4:** `bun run lint:web` / format.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 2.3: `downloadSize` on remote partition list

**parallel-group:** W2G3  
**Depends-on:** Wave 0 types  
**Files:**
- Modify: `types.rs` / `PartitionDetail`
- Modify: remote list mapping
- Modify: `src/desktop/models.ts`
- Optional: partition table column or tooltip later (minimal: field available)

- [ ] **Step 1:** For CrAU remote, sum op `data_length` per partition when building details (or approximate).  
- [ ] **Step 2:** Factory: use compressed or uncompressed size already known.  
- [ ] **Step 3:** Keep `size` as image size; `downloadSize` network estimate.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 2.4: Wire FE to `payload:load-progress`

**parallel-group:** W2G4  
**Depends-on:** Task 2.1, 2.2  
**Files:**
- Modify: `usePayloadEvents.ts` or new `usePayloadLoadEvents.ts`
- Modify: `runtime.ts` only if needed for event name typing
- Modify: load card to prefer real phases over optimistic timer

- [ ] **Step 1:** Subscribe to `payload:load-progress`.  
- [ ] **Step 2:** Fallback optimistic stages if no events for 500ms (slow IPC).  
- [ ] **Step 3:** `bun run test` focused + `bun run build`.  
- [ ] **Step 4:** Doc: remote matrix §9 implemented flags.  
- [ ] **Step 5:** memory-bank activeContext bullet.  
- [ ] **Step 6:** **NO COMMIT.**

---

## Wave 3 — Remote architecture + performance

### Task 3.0: Release-fast Cargo profile

**parallel-group:** W3G0  
**Depends-on:** Wave 0  
**Files:** `src-tauri/Cargo.toml`, optional note in `AGENTS.md` / perf report

- [ ] **Step 1:** Keep existing `[profile.release]` with `opt-level = "s"` for size builds if desired.  
- [ ] **Step 2:** Add `[profile.release-fast]` with `opt-level = 3`, `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true` (or package-level override for extract-critical crates).  
- [ ] **Step 3:** Document how to build: `cargo build --release --profile release-fast` (or project script).  
- [ ] **Step 4:** Update BEFORE-AFTER perf report “implemented” note.  
- [ ] **Step 5:** **NO COMMIT.**

**Why first in Wave 3:** `opt-level = "s"` is a known silent killer for `sha2` soft paths and decomp loops; often larger win than new crates.

---

### Task 3.1: Shared HTTP client + cached ZIP offsets

**parallel-group:** W3G1  
**Depends-on:** Wave 0 remote split  
**Files:** `remote/http.rs`, `remote/list.rs`, `remote/metadata.rs`, extract entrypoints

- [ ] **Step 1:** Avoid triple HEAD + ZIP CD parse on list→meta→extract when URL unchanged (session struct or cache with content-length/etag key).  
- [ ] **Step 2:** Tests for cache hit logic with mock if possible.  
- [ ] **Step 3:** Doc R1 checkoff.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 3.2: Span-based prefetch

**parallel-group:** W3G2  
**Depends-on:** Task 3.1 helpful  
**Files:** `remote/prefetch.rs`

- [ ] **Step 1:** For OTA remote, download min–max byte span covering selected partitions’ ops, not always full `Content-Length` when ZIP is huge.  
- [ ] **Step 2:** Keep factory path selective (already); ensure prefetch doesn’t re-download whole factory ZIP.  
- [ ] **Step 3:** Doc S2 checkoff.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 3.3: Local STORED ZIP via `stored_window`

**parallel-group:** W3G3  
**Depends-on:** Wave 0 zip  
**Files:** `zip/stored_window.rs`, `zip/extract_entry.rs`, `crau/extract` load path

- [ ] **Step 1:** When local ZIP entry is STORED, map window instead of always temp extract.  
- [ ] **Step 2:** Deflate-compressed payload.bin keeps temp path.  
- [ ] **Step 3:** Tests: STORED zip synthetic.  
- [ ] **Step 4:** Doc S1 checkoff.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 3.4: Buffer pools + flate2 zlib-rs + bytes on remote

**parallel-group:** W3G4  
**Depends-on:** Wave 0 io  
**Files:** `io/buffers.rs`, `crau/ops.rs`, `src-tauri/Cargo.toml`, `remote/http.rs`

- [ ] **Step 1:** Reuse 256–512 KiB buffers per worker thread (`io/buffers.rs`).  
- [ ] **Step 2:** Enable **flate2 `zlib-rs`** (and zip deflate path if feature-gated) for faster factory/ZIP inflate.  
- [ ] **Step 3:** Use **`bytes`** (`Bytes`/`BytesMut`) for HTTP range bodies to cut realloc churn.  
- [ ] **Step 4:** Doc S3 + perf report libs section checkoff.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 3.5: OPS cancel + NonTemporalWriter path

**parallel-group:** W3G5  
**Depends-on:** Wave 0  
**Files:** `ops/extractor.rs` (or `ops/extract.rs`), cancel plumbing from commands

- [ ] **Step 1:** Pass `CancellationToken` into OPS extract; check between partitions/files.  
- [ ] **Step 2:** Prefer `io::NonTemporalWriter` for large images when size known.  
- [ ] **Step 3:** Doc S6.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 3.6: No-range fallback + harder cancel

**parallel-group:** W3G6  
**Depends-on:** Task 3.1  
**Files:** `remote/http.rs`, commands, FE confirm dialog optional

- [ ] **Step 1:** If HEAD lacks Accept-Ranges, return structured error code; optional full GET to temp then local extract behind explicit flag/UX confirm.  
- [ ] **Step 2:** On cancel, drop/abort in-flight request where reqwest allows; shorten wait.  
- [ ] **Step 3:** Doc R3/R4.  
- [ ] **Step 4:** **NO COMMIT.**

---

### Task 3.7: Migrate xz2 → liblzma (API-compatible)

**parallel-group:** W3G7  
**Depends-on:** Task 3.0 helpful  
**Files:** `src-tauri/Cargo.toml`, `crau/ops.rs` and any `xz2::` imports

- [ ] **Step 1:** Replace `xz2` with `liblzma` per crates.io migration notes (compatible API).  
- [ ] **Step 2:** Ensure single native lzma link (no dual xz2+liblzma).  
- [ ] **Step 3:** `cargo check` + payload extract smoke if possible.  
- [ ] **Step 4:** Doc perf report.  
- [ ] **Step 5:** **NO COMMIT.**

---

### Task 3.8: Optional mimalloc (measure first)

**parallel-group:** W3G8  
**Depends-on:** Task 3.0  
**Files:** `src-tauri/src/main.rs` or `lib.rs`, `Cargo.toml`

- [ ] **Step 1:** Add feature-gated `mimalloc` global allocator **only if** quick bench vs default shows win on Win+Lin.  
- [ ] **Step 2:** If no clear win on Windows, document skip in perf report — do not force.  
- [ ] **Step 3:** **NO COMMIT.**

---

## Wave 4 — Polish

### Task 4.1: Partition extract status enum (FE)

**parallel-group:** W4G1  
**Depends-on:** Wave 2+  
**Files:** store + `PartitionRow`  
- [ ] Map pending/running/completed/failed/verifying from events.  
- [ ] **NO COMMIT.**

### Task 4.2: Extraction stats event

**parallel-group:** W4G2  
**Depends-on:** Wave 1  
**Files:** `crau/extract.rs`, models, status card  
- [ ] Emit durationMs, totalBytes, throughputMbps on success (fill `ExtractPayloadResult.stats` if missing in Rust).  
- [ ] **NO COMMIT.**

### Task 4.3: Delta OTA (OPTIONAL — default SKIP)

**parallel-group:** W4G3  
**Depends-on:** product approval  
**Files:** `delta/*`, `crau/ops.rs`  
- [ ] Only if human explicitly enables this task. Wire `source_dir`, SOURCE_COPY first, then bsdiff if crates approved.  
- [ ] **NO COMMIT.**

### Task 4.4: Tauri notification + single-instance

**parallel-group:** W4G4  
**Depends-on:** Wave 2+ for extract complete signals  
**Files:** `src-tauri/Cargo.toml`, `lib.rs`, capabilities, FE toast/OS notify hook

- [ ] **Step 1:** Add `tauri-plugin-notification` — fire on extract success/fail when useful.  
- [ ] **Step 2:** Add `tauri-plugin-single-instance` to prevent dual dumps fighting disk.  
- [ ] **Step 3:** Capabilities/ACL per Tauri v2.  
- [ ] **Step 4:** Doc: plugins do **not** speed extract; UX/reliability only.  
- [ ] **Step 5:** **NO COMMIT.**

### Task 4.5: Final documentation pass

**parallel-group:** W4G5  
**Depends-on:** all completed waves  
**Files:** memory-bank/*, active reports, this plan checkboxes  

- [ ] Mark implemented vs deferred in product reports + BEFORE-AFTER perf report.  
- [ ] `activeContext.md` summary of architecture + upgrades.  
- [ ] `progress.md` version note.  
- [ ] Confirm **no plan-execution commits** made by agents.  
- [ ] Run: `bun run format:check`, `bun run lint:web`, `bun run test` (note flakes), `bun run build`, isolated `cargo check` / `lint:rust` if available.  

---

## Subagent dispatch template

Orchestrator prompt per task:

```text
You are implementing Task <ID> from:
docs/superpowers/plans/2026-07-17-payload-dumper-architecture-and-upgrades.md

Rules:
- NO git commits or pushes
- Update docs listed in the task (realtime)
- Only touch Files: section for this task
- Run Verify commands
- Mark steps done in the plan file with [x]
- Report: summary, files changed, verify output, blockers

Depends-on: <must be complete>
parallel-group: <do not edit files owned by other concurrent groups>
```

### Suggested parallel batches

| Batch | Tasks | Notes |
|-------|-------|-------|
| B0a | 0.1 → 0.2 | serial |
| B0b | 0.3, 0.4, 0.5 | parallel |
| B0c | 0.6 | after B0b |
| B0d | 0.7 | after 0.5 |
| B0e | 0.8 | after 0.6+0.7 |
| B1 | 1.1 then 1.2∥1.3 then 1.4 | |
| B2 | 2.1∥2.2∥2.3 then 2.4 | agree event contract first |
| B3a | 3.0 first | opt-level profile |
| B3b | 3.1 then 3.2∥3.3∥3.4∥3.5; 3.6 after 3.1; 3.7; 3.8 optional | |
| B4 | 4.1∥4.2; 4.3 skip; 4.4 plugins; 4.5 docs last | |

---

## Verification matrix (definition of done)

| Wave | Rust | FE | Docs |
|------|------|----|------|
| 0 | `cargo check` green; tests compile | build if IPC stable | architecture report updated |
| 1 | verify + extent tests | — | comparison C1–C5 |
| 2 | load-progress emits | card + no stuck Cancel-only | remote matrix §9 |
| 3 | check + targeted tests | optional | S/R proposals |
| 4 | full lint/check subset | `bun run test` + build | memory-bank + all reports |

---

## Out of scope (YAGNI this plan)

- Samsung/Xiaomi OEM formats  
- Porting Kotlin UI  
- Torrents / magnet  
- Committing to git  
- macOS-only work  
- Replacing Tauri with CLI  

---

## Self-review (writing-plans checklist)

| Check | Result |
|-------|--------|
| Spec coverage: architecture report | Wave 0 + target tree |
| Spec coverage: remote matrix | Wave 2 + 3.6 + download_size |
| Spec coverage: reference comparison P0–P2 | Wave 1 + 3 |
| Placeholders | Avoided TBD; optional delta explicit SKIP |
| No-commit rule | Global + every task |
| Docs realtime | Global checklist + per-task steps |
| Parallel subagents | DAG + parallel-groups + file ownership |

---

## Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-07-17-payload-dumper-architecture-and-upgrades.md`.

**Architecture report saved to** `docs/reports/active/PAYLOAD-DUMPER-FOLDER-ARCHITECTURE-2026-07-17.md`.

**Execution options when you want implementation:**

1. **Subagent-Driven (recommended)** — orchestrator runs batches B0a→B4; one agent per task; no commits; docs updated each task.  
2. **Inline Execution** — same plan, single session waves.

**Do not start Wave 1 until Wave 0 exit criteria pass.**
