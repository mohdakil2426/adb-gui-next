# Payload Dumper — Domain Folder Architecture Design

**Date:** 2026-07-17  
**Status:** Active design freeze candidate (pre-implementation)  
**Scope:** How to restructure `src-tauri/src/payload/` (and FE hooks/UI slots) so both active product reports can be applied without God-files  
**Related reports:**

- `docs/reports/active/PAYLOAD-DUMPER-REMOTE-URL-SUPPORT-MATRIX-2026-07-17.md`
- `docs/reports/active/PAYLOAD-DUMPER-REFERENCE-COMPARISON-2026-07-17.md`
- Implementation plan: `docs/superpowers/plans/2026-07-17-payload-dumper-architecture-and-upgrades.md`

**No code changes in this document** — design only.

---

## 1. Why restructure before features

Upcoming work is large:

| Source | Themes |
|--------|--------|
| Remote matrix | Load-partitions staged UX, no-range fallback, hard cancel, span prefetch, download_size |
| Reference comparison | Unified verify (L2+L4), single CrAU engine, ReadAt sources, ZIP mmap, buffer pools, delta later |

Current `payload/` is a **flat root** with dual engines (`extractor.rs` + `remote.rs`), orphan `zip_mmap.rs`, dead L4 helpers, and one monolithic `tests.rs`. Applying both reports on that layout will re-introduce divergent hash paths and unreviewable diffs.

**Principle:** Phase 0 = structure only (behavior-preserving moves). Then features land in named folders.

---

## 2. Hard boundaries (project law)

| Layer | Path | May contain | Must not contain |
|-------|------|-------------|------------------|
| Tauri commands | `src-tauri/src/commands/payload.rs` | `invoke` adapters, token registry, error string map | Crypto, EOCD, decompress loops |
| Domain | `src-tauri/src/payload/**` | All extract/list/verify/remote/ops logic | React, Zustand, raw `invoke` |
| Desktop IPC | `src/desktop/backend.ts`, `models.ts` | Typed wrappers + DTOs | Business rules |
| Feature UI | `src/features/payload-dumper/**` | Views, hooks, store, progress cards | Format parsers |

Matches `AGENTS.md`: thin commands, domain modules own complexity.

---

## 3. Current layout problems

```text
payload/
  extractor.rs      # local CrAU + types + diagnose (too large)
  remote.rs         # list + meta + prefetch + direct (too large)
  http*.rs, factory # remote stack flat at root
  zip.rs + zip_mmap.rs  # zip_mmap orphan (not in mod.rs)
  ops/              # already healthy sub-domain
  tests.rs          # monolithic
  verify.rs / delta.rs  # stubs / dead helpers
```

| Issue | Risk when scaling |
|-------|-------------------|
| Dual extract paths | Local vs remote hash/op semantics diverge |
| Flat root | Every feature = new root file |
| Orphan modules | Dead code erodes trust |
| Monolithic tests | Parallel agents collide; weak ownership |

---

## 4. Target tree

```text
src-tauri/src/payload/
├── mod.rs                 # thin re-exports only
├── error.rs
├── types.rs               # PartitionDetail, ExtractPayloadResult, RemotePayloadMetadata, …
├── cancel.rs
├── transaction.rs
│
├── source/                # ReadAt / PayloadSource adapters
│   ├── mod.rs
│   ├── local_mmap.rs
│   ├── local_file.rs      # optional
│   └── window.rs          # base_offset + length views
│
├── zip/                   # all ZIP algorithms
│   ├── mod.rs
│   ├── eocd.rs
│   ├── central_dir.rs
│   ├── local_header.rs
│   ├── stored_window.rs   # resurrect zip_mmap
│   └── extract_entry.rs   # local payload.bin from ZIP
│
├── crau/                  # single CrAU engine
│   ├── mod.rs
│   ├── header.rs
│   ├── manifest.rs
│   ├── ops.rs             # REPLACE* / ZERO / future delta arms
│   ├── extract.rs
│   ├── progress.rs
│   └── diagnose.rs
│
├── io/
│   ├── mod.rs
│   ├── write.rs
│   ├── copy.rs
│   └── buffers.rs         # pooled / TLS buffers
│
├── verify/
│   ├── mod.rs
│   ├── op_blob.rs         # L2 compressed data_sha256_hash
│   ├── output_file.rs     # L4 new_partition_info.hash
│   └── mode.rs
│
├── remote/                # #[cfg(feature = "remote_zip")]
│   ├── mod.rs
│   ├── http.rs
│   ├── http_zip.rs
│   ├── factory.rs
│   ├── prefetch.rs
│   ├── direct.rs
│   ├── list.rs
│   ├── metadata.rs
│   └── load_progress.rs   # payload:load-progress phases
│
├── ops/                   # keep structure; rename extractor → extract if desired
│   └── …
│
├── delta/                 # real incremental later; stub OK
│   ├── mod.rs
│   └── source_copy.rs
│
└── tests/
    ├── mod.rs
    ├── crau_extract.rs
    ├── zip_eocd.rs
    ├── factory_cd.rs
    └── fixtures/          # tiny synthetic only
```

### Frontend slots (UX report §9)

```text
src/features/payload-dumper/
  ui/RemoteLoadProgressCard.tsx   # in-panel load stages
  hooks/…                         # consume payload:load-progress
  model/…                         # optional loadPhase state
```

---

## 5. Runtime flow after restructure

```text
commands/payload.rs
        │
        ▼
   format router (path/url + magic)
        │
   ┌────┼────────────┐
   ▼    ▼            ▼
 source/zip   remote/     ops/
   │    │        │
   └────┴──┬─────┘
           ▼
      crau/extract  OR  factory stream  OR  ops/extract
           │
           ▼
      io/ + verify/ + transaction/ + cancel
```

**Frozen decisions**

| Decision | Choice |
|----------|--------|
| CrAU local + remote | **One** `crau/extract`; remote only supplies `ReadAt` / ranges |
| Factory images | Separate path under `remote/factory` (not fake CrAU) |
| OPS/OFP | Stay under `ops/`; local-first |
| Cargo features | Keep `remote_zip`; add `diff_ota` only when real |

---

## 6. Feature → folder map

### From remote matrix

| Feature | Home |
|---------|------|
| Load-partitions stages + FE card | `remote/load_progress.rs` + `RemoteLoadProgressCard.tsx` |
| Span prefetch | `remote/prefetch.rs` |
| No-range fallback | `remote/http.rs` + command/UX confirm |
| Hard cancel mid-request | `cancel` + `remote/http.rs` |
| `download_size` | list DTO in `types.rs` + remote list |

### From reference comparison

| Feature | Home |
|---------|------|
| L2+L4 verify wired | `verify/` |
| ZIP mmap / zero-copy STORED | `zip/stored_window.rs` |
| Buffer pools | `io/buffers.rs` |
| Reader trait | `source/` |
| Multi-extent REPLACE* | `crau/ops.rs` |
| Fail-hard decompress | `crau/ops.rs` |
| Delta (later) | `delta/` + `crau/ops.rs` |

---

## 7. Testing architecture

### Correct practices (keep)

- Domain unit tests without Tauri UI
- Synthetic tiny CrAU fixtures in temp dirs
- `app_handle: None` for pure extract
- `src-tauri/tests/proptest.rs` for extents
- Fuzz `parse_header`

### Scale upgrades

| Do | Don’t |
|----|--------|
| Colocate pure unit tests (`#[cfg(test)]` in `zip/eocd.rs`) | One 2k-line `tests.rs` forever |
| Split E2E under `payload/tests/` | Commit multi-GB OTAs |
| Mock HTTP / offline remote tests | Default suite requires network |
| Assert bytes + hashes | Only `Ok(())` |
| Feature-gate remote tests | Flaky sleep-based cancel tests |

```text
        ╱  manual e2e GUI     ╲
       ╱  integration (cargo)  ╲
      ╱  domain unit            ╲
     ╱  proptest + fuzz            ╲
```

Windows: known Tauri-linked loader issue on `cargo test` run — compile with `--no-run`; full execution trust Linux CI.

---

## 8. Maintainability rules

1. No new root-level file under `payload/` without a subfolder home.  
2. One CrAU extract brain — no third remote copy of op loop.  
3. Public surface only via `mod.rs` re-exports.  
4. Wire or delete dead code (`zip_mmap`, unused L4).  
5. Soft size: split before ~600 LOC review-hostile files.  
6. Typed domain errors → command `String`.  
7. Progress emit helpers centralized (`crau/progress`, `remote/load_progress`).  
8. Apply order: **structure → correctness → remote UX → perf → delta**.  
9. Docs update **in the same change** as code (memory-bank + active reports status).  
10. **No git commits** unless a human explicitly requests them later.

---

## 9. Phase 0 move map (behavior-preserving)

| From (today) | To (target) |
|--------------|-------------|
| `parser.rs` (header/list) | `crau/header.rs`, `crau/manifest.rs` |
| `extractor.rs` | `crau/extract.rs`, `crau/ops.rs`, `crau/diagnose.rs`, `types.rs` |
| `copy.rs`, `write.rs` | `io/copy.rs`, `io/write.rs` |
| `verify.rs` | `verify/*` |
| `zip.rs` | `zip/extract_entry.rs` (+ shared eocd) |
| `zip_mmap.rs` | `zip/stored_window.rs` + **register in mod** |
| `http.rs`, `http_zip.rs` | `remote/http.rs`, `remote/http_zip.rs` |
| `factory_image.rs` | `remote/factory.rs` |
| `remote.rs` | `remote/{list,metadata,prefetch,direct}.rs` |
| `delta.rs` | `delta/source_copy.rs` |
| `tests.rs` | `tests/*` split |
| `ops/*` | mostly stay |

Each move PR/wave: **compile + existing tests green, no feature work**.

---

## 10. Parallelism for agents

| Wave | Parallelizable units | Must serialize after |
|------|----------------------|----------------------|
| 0a | Create empty subdirs + `mod.rs` skeletons | — |
| 0b | Move `io/` + `verify/` (low coupling) | 0a |
| 0c | Move `zip/` + `source/` | 0a |
| 0d | Move `crau/` from parser/extractor | 0b, 0c if types move |
| 0e | Move `remote/*` | 0c (zip eocd shared) |
| 0f | Split tests | after 0d–0e compile |

Feature waves similarly: verify C1–C5 before remote load UX depends on events; FE optimistic stages can parallel with Rust phases.

---

## 11. Summary

Restructure `payload/` into **source · zip · crau · io · verify · remote · ops · delta · tests** before applying remote UX and reference-driven upgrades. Keep commands thin. One CrAU engine. Tests colocated + split. No commits unless requested. Full task DAG: see implementation plan dated 2026-07-17.
