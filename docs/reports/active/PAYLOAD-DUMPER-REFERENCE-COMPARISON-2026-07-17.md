# Payload Dumper — Reference Projects Deep Comparison

**Date:** 2026-07-17  
**Status:** Analysis only — **no code changes**  
**Goal:** Steal the **best core** ideas from vendored references + web research to make **adb-gui-next** super-fast (Rust), robust, and architecturally clean.  
**UI policy:** Core / engine only. Kotlin UI ignored. Third-party CLI/TUI patterns translated to architecture (progress traits, status machines), not Compose/React cloning.

---

## 0. Scope & sources

### Vendored under `docs/references/github-projects/payload-dumpers/`

| Project | Upstream (typical) | Language | Role |
|---------|-------------------|----------|------|
| `payload-dumper-rust` | rhythmcache/payload-dumper-rust | Rust | Async CrAU + remote ZIP ranges + prefetch + experimental delta |
| `payload-dumper-go` | ssut/payload-dumper-go | Go | Fast parallel full OTA; CGO xz |
| `payload-dumper` | 5ec1cff online fork of Python dumper | Python | HTTP Range + ZIP EOCD + op-level threads |
| `Payload-Dumper-Android` | rajmani7584 + native `payload-dumper-android-rs` | Rust core + Kotlin shell | Mobile JNI CrAU; **core only** analyzed |
| `oppo_decrypt-master` | B.Kerler oppo_decrypt | Python | OPS / OFP-QC / OFP-MTK crypto oracle |

### External (not vendored; web + prior in-repo research)

| Project | Notes |
|---------|--------|
| [syedinsaf/otaripper](https://github.com/syedinsaf/otaripper) | Peak local throughput claims (~2.8 GB/s AVX-512); multi-layer verify; zero-copy ZIP mmap |
| [ssut/payload-dumper-go](https://github.com/ssut/payload-dumper-go) | README: pure Go xz ~6× slower than CGO liblzma |
| [raw.pm OTA tool review](https://blog.raw.pm/en/android-OTA-payload-dumping/) | Historical speed ranking among Python/Go tools |
| AOSP update_engine / `update_metadata.proto` | Wire format: `CrAU`, `data_sha256_hash` = **compressed** blob |
| Prior repo docs | `PAYLOAD_RESEARCH_REPORT.md`, `ULTIMATE_DUMPER_ROADMAP.md`, `payload-dumper-otaripper-comparison.md`, active remote matrix 2026-07-17 |

### Our tree (ground truth)

`src-tauri/src/payload/` + `commands/payload.rs` + feature `payload-dumper` UI (architecture only).

---

## 1. Executive summary

**adb-gui-next is already the broadest desktop dumper in this set:** CrAU + remote OTA ranges + **Pixel factory ZIP** + **OPS/OFP** + Tauri GUI + cancel/SSRF. No reference project combines all of that.

**Where others still win:**

| Dimension | Leader | Why |
|-----------|--------|-----|
| Peak local GB/s | otaripper | AVX-512 / NT-style write narrative, buffer pools, ZIP mmap |
| Remote reader abstraction | rhythmcache | `AsyncPayloadRead` + `read_range` + shared `ZipIO` |
| Prefetch strategy quality | rhythmcache | Per-partition contiguous span (not always whole ZIP) |
| Op-level remote parallel | Python online fork | Thread pool per install op + positioned I/O |
| Native XZ lesson | ssut Go | CGO liblzma >> pure-language xz |
| Mobile progress IPC | Android-rs | Status enum + cancel-at-op-boundary (core idea only) |
| OPS/OFP oracle | oppo_decrypt | Cipher tables / footers (we already ported most) |

**Strategic goal:** keep format breadth + GUI, close the **performance / verification / remote abstraction** gap with otaripper + rhythmcache patterns — without soft-failing decompress (rhythmcache pitfall) or full-op RAM buffers (Android-rs pitfall).

---

## 2. Feature matrix (core)

Legend: **Y** = yes · **P** = partial · **N** = no · **—** = N/A

| Capability | Ours | rhythmcache | Go ssut | Python online | Android-rs core | oppo_decrypt | otaripper* |
|------------|:----:|:-----------:|:-------:|:-------------:|:---------------:|:------------:|:----------:|
| Local `payload.bin` | Y | Y | Y | Y | Y | N | Y |
| Local ZIP → payload | Y | Y (STORED) | Y (full temp) | Y (STORED range) | Y (STORED) | N | Y |
| Remote URL ranges | Y | Y | N | Y | Y | N | N |
| Prefetch mode | Y | Y (smarter spans) | N | N | N | N | N |
| Factory ZIP remote | **Y** | N | N | N | N | N | N |
| Parallel partitions | Y (rayon) | Y (tokio+sem) | Y (workers) | P (ops) | Y (sem) | N | Y |
| Parallel ops | N | N | N | **Y** | N | N | P |
| Op `data_sha256` | Y (local) | N (post-file only) | Y | Y | Y | N | Y |
| Partition file hash | P (dead helpers) | **Y** | N | N | Y optional | OPS SHA | **Y** |
| Delta / incremental | **Stub** | P experimental | N | P (bsdiff) | N | N | N |
| Brotli / puffdiff ops | P / N | Y / P | N | P | N | N | N |
| OPS / OFP | **Y** | N | N | N | N | **Y** | N |
| Sparse unsparse | Y (OPS) | sparse ZERO | N | N | N | helper | Y |
| Cancel | Y | trait hook | N | hard kill | op boundary | N | AbortHandle |
| SSRF / private IP | **Y** | N | N | N | N | N | N |
| mmap read | **Y** | N | N | optional off | N | OPS mmap | Y |
| SIMD copy path | **Y** | N | N | N | N | N | **Y** |
| Desktop GUI | **Y** | CLI/TUI | CLI | CLI | Android UI† | CLI | CLI |

\*otaripper from public docs + prior in-repo research (not in this folder).  
†UI excluded from recommendations.

---

## 3. Per-project core takeaways

### 3.1 rhythmcache `payload-dumper-rust`

**Steal**

1. **`AsyncPayloadRead` / `PayloadReader::read_range`** — one dump loop for local, ZIP, remote.  
2. **Shared `ZipIO` + pure ZIP parser** — one EOCD/ZIP64 path for disk and HTTP.  
3. **Partition semaphore + isolated failures** — one partition fail ≠ kill all.  
4. **Prefetch = contiguous op span**, not always entire factory ZIP.  
5. **Sparse ZERO** via seek + `set_len` (avoid multi-GB zero fill).  
6. **Post-extract parallel partition SHA-256** (`new_partition_info.hash`).  
7. **UI-free `ProgressReporter`** — Tauri events as adapter only.  
8. **Feature flags** (`local_zip`, `remote_zip`, `diff_ota`, `prefetch`).  
9. **Magic detect over extension** (`PK` / `CrAU`).  
10. **HTTP pooling** (idle connections, long timeouts, UA/cookies).

**Avoid**

- Soft-fail on decompress (“warn + Ok”) → incomplete `.img` looks successful.  
- Multi-extent only using `dst_extents[0]`.  
- Redundant HEAD/ZIP parse on every load.  
- Cancel trait defaulting to false with CLI unwired.

**Evidence:** `payload_dumper.rs` traits; `zip/core_parser.rs`; `prefetch.rs`; `cli/verification/verify.rs`; README remote/`--prefetch`/`--no-verify`.

---

### 3.2 ssut `payload-dumper-go`

**Steal**

1. **Partition worker pool** + shared file `ReadAt` / `SectionReader` — proven model.  
2. **Stream ops** — never `readDataBlob` whole multi-GB op (dead API in their tree shows the anti-pattern).  
3. **Native/liblzma-class xz** — pure Go xz ~6× slower (README benchmark). Rust: keep **xz2 / liblzma**, never pure-Rust xz for hot path.  
4. **Op hash via TeeReader** on source blob while streaming.  
5. **SSD I/O reality** — document that HDD kills throughput.

**Avoid**

- `ZERO` → `make([]byte, huge)` OOM.  
- Full ZIP → temp payload.bin always.  
- Silent OpenFile errors; multi-extent ignore; ignore manifest `block_size`.  
- No remote, no delta, no final partition hash.

**Evidence:** `payload.go` Extract/workers; `README.md` Performance; XDA/community notes on OOM for huge partitions.

---

### 3.3 Python `payload-dumper` (online fork)

**Steal**

1. **`ReadAt` / MTIO mindset** — remote is positioned file, not download stream.  
2. **ZIP EOCD→CD→LFH without full download** (same as our `http_zip`).  
3. **Require HTTP 206 + Accept-Ranges** (same industry rule as rhythmcache).  
4. **Op-level parallelism** for remote: many small ranges can beat one partition thread when network-bound (with caps).  
5. **Optional custom headers** for gated mirrors.  
6. **Interruptible wait** on Windows (cancel-friendly executor).

**Avoid**

- Materialize whole op `length` in RAM.  
- Timeout-only retries.  
- No SSRF.  
- Windows seek lock serializing all IO.  
- STORED-only ZIP without clear error for deflated payload.

**Evidence:** `http_file.py`, `ziputil.py`, `dumper.py`, `mtio/`.

---

### 3.4 Payload-Dumper-Android **Rust core only**

**Steal (core ideas)**

1. **`download_size`** on remote partition list (sum of op `data_length` or better: span).  
2. **Partition status machine:** PENDING → RUNNING → VERIFYING → COMPLETED | FAILED.  
3. **Semaphore concurrency** opened with payload session.  
4. **Cancel only between ops / before range** (cooperative), not fake abort.  
5. **Thin frontend DTO** (hex hashes, incremental flag) — we already use serde DTOs; align fields.

**Avoid**

- Dropping `start_block` / sequential-only write (incorrect for real payloads).  
- Full op `Vec` load.  
- Fragile ZIP64 CD placement assumption.  
- Global JNI session singleton.  
- Weaker than our mmap/streaming path.

**Evidence:** `lib/.../reader/`, `payload/dump.rs`, `part_manifest.proto`; Kotlin bridge skimmed for API only.

---

### 3.5 `oppo_decrypt`

**Steal (oracle / fidelity — largely already in our `ops/`)**

1. Content detect: `CrAU` | `PK` | footer `0x7CEF` | MTK `"MMM"`.  
2. OPS custom S-box + mbox trial order 5→6→4 — **never “simplify” to AES**.  
3. OFP-QC partial encrypt (default 0x40000 head); Sahara full decrypt.  
4. OFP-MTK shuffle + trailing table layout.  
5. SHA-256 pad-to-0x1000 on OPS; soft hash on sparse.  
6. ZIP-OFP password path as **separate** product path.

**Avoid**

- Sequential-only forever if multi-file decrypt can parallelize after XML parse.  
- Claiming remote streaming for OPS without full-file or careful sector ranges.

**Evidence:** `opscrypto.py`, `ofp_qc_decrypt.py`, `ofp_mtk_decrypt.py`; our ports in `src-tauri/src/payload/ops/`.

---

### 3.6 otaripper (external, prior research + public README)

**Steal**

1. **Multi-layer verification** including **output image** hash.  
2. **Zero-copy ZIP mmap** for STORED members (skip temp copy).  
3. **True non-temporal / cache-bypassing write** path for large sequential dumps.  
4. **Thread-local buffer pools** (cut alloc churn).  
5. **`--stats`** throughput reporting.  
6. **Abort + delete incomplete outputs** (transaction discipline).  
7. Documented SIMD ladder AVX-512 → AVX2 → SSE2.

**Avoid overclaiming:** otaripper is **local CrAU specialist** — no OPS/OFP, no HTTP factory. Breadth still ours.

**Evidence:** otaripper GitHub feature table; in-repo `payload-dumper-otaripper-comparison.md`, `ULTIMATE_DUMPER_ROADMAP.md`.

---

## 4. Our position (code truth, 2026-07)

### Strengths

- Format breadth: CrAU + OPS + OFP-QC/MTK + remote OTA + **factory remote**.  
- Local hot path: `Arc<Mmap>` + rayon + streaming 256 KiB decomp + SIMD copy into mmap writer.  
- Remote: range + SSRF + cancel + dual mode + factory nested ZIP/ZIP64.  
- Product: Tauri GUI, selective partitions, progress events, diagnose.  
- Crypto fidelity for vendor formats (oppo_decrypt lineage).

### Gaps vs best-of-breed

| Gap | Severity | Best reference |
|-----|----------|----------------|
| `source_dir` / delta ops stub | High (if incremental OTAs matter) | rhythmcache `diff.rs`, Python bsdiff |
| L4 output file SHA unused (`verify.rs` dead) | High correctness | otaripper, rhythmcache post-verify |
| Remote hash may differ from local compressed-blob semantics | High | AOSP + Go TeeReader discipline |
| Prefetch may download whole URL Content-Length | Medium perf/bandwidth | rhythmcache span prefetch |
| `zip_mmap.rs` orphan / local ZIP always temp | Medium perf | otaripper ZIP mmap |
| Soft multi-extent / some op types incomplete | Medium | rhythmcache + Go pitfalls to fix |
| OPS: no cancel, BufWriter not NT path | Medium | our CrAU path as template |
| No-Range fallback | Medium UX | Python/rhythmcache fail messaging + full GET option |
| Load-partitions staged UX | Medium UX | design already in remote matrix §9 |
| Op-level parallel for remote | Medium | Python |
| True `_mm_stream_*` NT stores | Low–Medium speed | otaripper |
| Within-partition parallel | Low–Medium | careful design (seek conflicts) |

**Do not trust** memory-bank “ultimate dumper complete” as inventory — code contradicts delta/L4/ZIP mmap completeness.

---

## 5. Ranked proposals (fully actionable, no code in this pass)

### P0 — Correctness & trust (ship before more formats)

| ID | Proposal | Backing | Expected impact |
|----|----------|---------|-----------------|
| **C1** | **Unify verification policy:** always SHA-256 **compressed** `data_sha256_hash` before decompress (AOSP); optional second pass on decompressed stream; **always** optional/post **file hash** vs `new_partition_info.hash` | AOSP update_engine; Go TeeReader; rhythmcache post-verify; otaripper multi-layer | No silent corrupt `.img` |
| **C2** | Wire `VerifyMode.layer4` + `verify_sha256` into extract success path (parallel like rhythmcache) | `verify.rs` already exists | Production integrity |
| **C3** | Fix remote path hasher to match local compressed-blob semantics | PAYLOAD_RESEARCH_REPORT history | Remote ≠ local bug class |
| **C4** | Fail hard on decompress error; delete partial file (transaction) | Anti-pattern in rhythmcache soft-fail | Robustness |
| **C5** | Multi-extent write for all REPLACE* ops (not only first extent) | Go/Android-rs bugs we must not share | Correct images |

### P1 — Performance (Rust advantage)

| ID | Proposal | Backing | Expected impact |
|----|----------|---------|-----------------|
| **S1** | **Zero-copy local ZIP:** integrate orphan `zip_mmap` or otaripper-style STORED window — skip temp extract when method=0 | otaripper; our unused `zip_mmap.rs` | Less disk I/O, faster open |
| **S2** | **Prefetch by partition span** (min–max op offsets), not whole factory ZIP | rhythmcache `calculate_partition_range` | Huge remote bandwidth win |
| **S3** | Thread-local / pooled decomp buffers (256–512 KiB) reused per worker | otaripper buffer pools; rhythmcache COPY_BUFFER 512 KiB | Less alloc, higher GB/s |
| **S4** | True non-temporal stores for large Replace copies (feature-gated x86_64) | otaripper NT narrative; our name oversells | Cache less polluted |
| **S5** | Keep native xz/zstd; never pure-Rust xz | Go README 6× gap | Sustained throughput |
| **S6** | OPS extract: cancel + NonTemporalWriter + transaction | Parity with CrAU path | Faster vendor dumps + UX |
| **S7** | Optional op-level rayon for **local** huge single partitions (careful seeks) | Python op parallel; Go limitation | Faster `system` alone |
| **S8** | Cap concurrent remote partitions (semaphore 2–4) + optional coalesced ranges | Android-rs + rhythmcache + CDN reality | Stable multi-select remote |

### P2 — Remote robustness & architecture

| ID | Proposal | Backing | Expected impact |
|----|----------|---------|-----------------|
| **R1** | Single shared `HttpPayloadReader` + cached ZIP offsets across list/meta/extract | rhythmcache waste noted | Faster list + extract |
| **R2** | `payload:load-progress` phases for Load Partitions | Our remote matrix §9; rhythmcache ProgressReporter | UX not stuck |
| **R3** | No-Range fallback: confirm → full download → local pipeline | Python/rhythmcache docs | More mirrors work |
| **R4** | Hard cancel: abort in-flight request / drop client | otaripper AbortHandle | Cancel SLA |
| **R5** | `download_size` + network ETA on remote partitions | Android-rs part_manifest | Honest remote UX |
| **R6** | Custom UA / optional headers / cookies | rhythmcache CLI | Gated CDNs |
| **R7** | Reader trait unification (`ReadAt` for local mmap slice + HTTP + ZIP window) | Python MTIO; rhythmcache traits | Less dual-path bugs |

### P3 — Format completeness (selective)

| ID | Proposal | Backing | Notes |
|----|----------|---------|-------|
| **F1** | Real delta: SOURCE_COPY / BSDIFF / puffdiff with `source_dir` | rhythmcache `diff_ota`; Python | Experimental flag first |
| **F2** | Fix or rename BrotliBsdiff (current Brotli-only is wrong if true BSDIFF) | rhythmcache | Correctness |
| **F3** | ZipOfp password path | oppo_decrypt ofp_qc | Local only |
| **F4** | Local factory list/extract parity with remote factory | our remote factory | Consistency |
| **F5** | Do **not** prioritize Samsung/Xiaomi without fixtures | scope control | Avoid sludge |

### P4 — Architecture / quality (ongoing)

| ID | Proposal | Backing |
|----|----------|---------|
| **Q1** | Keep Tauri commands thin; dump core UI-free (ProgressReporter adapter) | rhythmcache; Agents.md |
| **Q2** | Property tests + fixtures for CrAU header, ZIP EOCD, OPS mbox trial | proptest already; oppo_decrypt vectors |
| **Q3** | Fuzz EOCD/CD and CrAU header | security |
| **Q4** | Extraction stats event (duration, MB/s, bytes) | otaripper `--stats` |
| **Q5** | Partition status enum for multi-extract UI | Android-rs (core idea) |
| **Q6** | Honest docs: deprecate “ultimate complete” claims until C1–C5/S1–S2 land | code audit |

---

## 6. Target architecture (conceptual)

```text
                    ┌─────────────────────────────┐
                    │  Tauri commands (thin)      │
                    │  ProgressReporter adapter   │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │  Format router              │
                    │  CrAU | Factory | OPS/OFP   │
                    └─────────────┬───────────────┘
           ┌──────────────────────┼──────────────────────┐
           ▼                      ▼                      ▼
    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │ ReadAt src   │      │ Factory ZIP  │      │ OPS/OFP      │
    │ mmap|zip|http│      │ range .img   │      │ crypto+xml   │
    └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                 ▼
                    ┌─────────────────────────────┐
                    │  Extract engine             │
                    │  rayon/sem workers          │
                    │  stream decomp + SIMD write │
                    │  cancel token               │
                    └─────────────┬───────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │  Verify pipeline            │
                    │  L2 op blob → L4 file hash  │
                    │  Transaction commit/abort   │
                    └─────────────────────────────┘
```

---

## 7. Performance target (honest)

| Workload | Realistic target | How |
|----------|------------------|-----|
| Local SSD, full OTA, many partitions | Approach otaripper-class (multi-GB/s on high-end x86) | S1–S5, keep native codecs |
| Local single huge partition | Better than partition-only parallel | S7 careful op parallel |
| Remote few small partitions | Near-instant list + extract | R1, S2, ranges |
| Remote factory multi-GB select | Only selected ranges | S2, never whole ZIP |
| OPS multi-GB local | Disk-bound + AES | S6 |

**Do not promise** 2.8 GB/s on HDD or remote HTTP — Go/otaripper both stress local SSD + CPU.

---

## 8. What we should **not** copy

| Anti-pattern | Source |
|--------------|--------|
| Soft-fail incomplete partitions | rhythmcache |
| Full op buffer to RAM | Android-rs dump.rs |
| Drop start_block / multi-extent | Android-rs, Go |
| ZERO dense allocation | Go |
| Full ZIP inflate always | Go |
| “Simplify” OPS to AES | would break vs oppo_decrypt |
| Port Kotlin UI / JNI session | out of scope |
| OEM soup without test vectors | scope control |

---

## 9. Suggested discussion priority (not a sprint plan)

1. **C1–C5** correctness (verification + multi-extent + hard fail)  
2. **S1–S2** ZIP mmap + smart prefetch (biggest free wins)  
3. **R1–R2** remote architecture + load progress UX  
4. **S3–S6** buffer pools / NT / OPS parity  
5. **F1** delta only if product needs incremental OTAs  
6. Optional: R3–R6 remote polish  

---

## 10. One-line strategy

**Stay the most complete desktop dumper (CrAU + factory remote + OPS/OFP + GUI), absorb rhythmcache’s reader/prefetch architecture and otaripper’s verify + zero-copy + SIMD write discipline, keep oppo_decrypt crypto fidelity, and reject soft-fail / full-buffer / extent-stripping patterns from lighter mobile/Go tools.**

---

## 11. Appendix — key paths

### References
- `docs/references/github-projects/payload-dumpers/payload-dumper-rust/`
- `docs/references/github-projects/payload-dumpers/payload-dumper-go/`
- `docs/references/github-projects/payload-dumpers/payload-dumper/`
- `docs/references/github-projects/payload-dumpers/Payload-Dumper-Android/lib/payload-dumper-android-rs/`
- `docs/references/github-projects/payload-dumpers/oppo_decrypt-master/`

### Ours
- `src-tauri/src/payload/{extractor,parser,copy,write,verify,remote,http,http_zip,factory_image,ops}/`
- `docs/reports/closed/{PAYLOAD_RESEARCH_REPORT,ULTIMATE_DUMPER_ROADMAP,payload-dumper-otaripper-comparison}.md`
- `docs/reports/active/PAYLOAD-DUMPER-REMOTE-URL-SUPPORT-MATRIX-2026-07-17.md`

### Web
- https://github.com/ssut/payload-dumper-go  
- https://github.com/rhythmcache/payload-dumper-rust  
- https://github.com/syedinsaf/otaripper  
- https://blog.raw.pm/en/android-OTA-payload-dumping/  
- https://crates.io/crates/payload_dumper  
- Android update_engine / update_metadata.proto (AOSP)

---

**No repository source code was modified for this report.**
