# Payload Dumper — otaripper Parity + Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** `payload-dumper-fixes` (branch: `payload-dumper-audit-fixes`)
> **Testing Rule:** All testing and implementation must occur within the worktree directory `payload-dumper-fixes`. Never modify or test against files outside this isolated workspace.

**Goal:** Close all performance and feature gaps vs otaripper v2.3, achieve 2.8 GB/s throughput (AVX-512), and fix remaining correctness issues.

**Reference:** otaripper v2.3 (https://github.com/syedinsaf/otaripper) — AVX-512/AVX2/SSE2 SIMD, Rayon data-level parallelism, non-temporal stores, extent coalescing, Layer 3 SHA-256 verification.

---

## Phase 0: Correctness Fixes (No Performance Impact)

### Task 0.1: Fix SHA-256 Verification Layer

**Issue:** Verifying compressed bytes instead of decompressed output. Current code at `extractor.rs:296-304` verifies `operation.data_sha256_hash` (compressed), not the actual output.

**Fix:** Compute SHA-256 during the stream_copy decompress loop, compare against expected hash at end. Add `hasher: &mut Sha256` parameter to `stream_copy`.

**Files:**
- `src-tauri/src/payload/extractor.rs:296-304`
- `src-tauri/src/payload/copy.rs`

**Steps:**
1. Modify `stream_copy` in `copy.rs` to accept `&mut Sha256` hasher
2. Accumulate digest during copy
3. Replace compressed-byte verification with output verification
4. Ensure `anyhow::bail!` on mismatch

**Verification:** `cargo check && cargo clippy`

---

## Phase 1: Performance — Non-Temporal Stores

### Task 1.1: Replace BufWriter with Non-Temporal Write Path

**Issue:** `BufWriter` pollutes CPU cache with 1MB buffers. otaripper uses non-temporal stores for large sequential writes.

**Fix:** Create `NonTemporalWriter` wrapper that issues `mmap`-based writes bypassing CPU cache for >1MB operations.

**Files:**
- `src-tauri/src/payload/extractor.rs:175`
- `src-tauri/src/payload/write.rs` (new)

**Steps:**
1. Create `src-tauri/src/payload/write.rs` with `NonTemporalWriter`
2. Use `memmap2::MmapMut` for pre-allocation + `msync` for batched writes
3. Replace `BufWriter::with_capacity(1024 * 1024)` with `NonTemporalWriter`
4. Run `cargo check`

**Reference:** otaripper uses 1 MiB threshold for non-temporal stores

---

## Phase 2: Performance — Extent Coalescing

### Task 2.1: Add Extent Coalescing Pre-pass

**Issue:** Per-operation seek+write syscall for each extent. No merging of adjacent extents.

**Fix:** Pre-pass to merge consecutive extents within each operation before writing.

**Files:**
- `src-tauri/src/payload/extractor.rs:332-363`

**Steps:**
1. Add `coalesce_extents()` function
2. Merge adjacent extents in `destination_extents` loop
3. Replace per-extent seek with per-coalesced-block seek
4. Reduce N syscalls to N coalesced blocks

**Reference:** otaripper merges consecutive extents + uses `pwritev` vectored I/O

---

## Phase 3: Performance — Rayon Intra-Partition Parallelism

### Task 3.1: Replace thread::scope with Rayon for Partition Parallelism

**Issue:** `std::thread::scope` spawns one thread per partition. otaripper uses Rayon data-level parallelism within decompression.

**Fix:** Replace `thread::scope(|s| { s.spawn(...) })` with `par_iter()` from rayon.

**Files:**
- `src-tauri/src/payload/extractor.rs:156-235`
- `src-tauri/src/payload/remote.rs:379-430`

**Steps:**
1. Ensure `rayon = "1.12.0"` is in Cargo.toml (it is)
2. Replace `thread::scope` with `partitions.par_iter().map(...).collect()`
3. Handle `Send + Sync` requirements for closures
4. Run `cargo check`

**Note:** This was partially done in Task 8 of the previous plan — verify and complete.

---

### Task 3.2: Add Rayon Parallelism Within Operation Extents

**Issue:** Only partition-level parallelism. No parallelism within a partition's operations.

**Fix:** Use `coalesced_extents.par_iter()` for parallel extent processing within a partition.

**Files:**
- `src-tauri/src/payload/extractor.rs:330-370`

**Steps:**
1. After coalescing, use `coalesced.par_iter().map(...)` to process extents in parallel
2. Use `Mutex` for output file writes (disjoint regions)
3. Verify `Send + Sync` for progress callback

---

## Phase 4: Performance — SIMD Acceleration

### Task 4.1: Add SIMD-Accelerated Memory Copy

**Issue:** Scalar byte-by-byte `stream_copy` loop. No vectorization.

**Fix:** Use `std::simd` or `crossbeam` for SIMD-accelerated copy.

**Files:**
- `src-tauri/src/payload/copy.rs`

**Steps:**
1. Add `simd` feature to Cargo.toml: `simd = { version = "0.8", features = ["std"] }`
2. Replace scalar loop with `std::simd::StdHash` style copy or use `copy_from_slice` which LLVM auto-vectorizes
3. Benchmark before/after with `std::time::Instant`

**Reference:** otaripper uses AVX-512 / AVX2 / SSE2 via platform detection

---

### Task 4.2: Add Automatic CPU Detection for SIMD

**Issue:** No runtime CPU capability detection.

**Fix:** Detect at startup: AVX-512 → AVX2 → SSE2 → Scalar fallback.

**Files:**
- `src-tauri/src/payload/copy.rs`

**Steps:**
1. Add `cpu_features()` function using `is_x86_feature_detected!`
2. Select SIMD path at runtime
3. Add `OTARIPPER_DEBUG_CPU=1` equivalent for debugging

---

## Phase 5: Observability — Performance Stats

### Task 5.1: Add ExtractionStats Struct and Tracking

**Issue:** No `--stats` equivalent. No throughput visibility.

**Fix:** Add `ExtractionStats` to `ExtractPayloadResult` and track per-operation timing.

**Files:**
- `src-tauri/src/payload/extractor.rs`
- `src-tauri/src/payload/ops/extractor.rs`

**Steps:**
1. Create `ExtractionStats` with fields: `total_bytes_written`, `duration_ms`, `decompression_time_ms`, `operations_count`, `throughput_mbps`
2. Record `Instant` at start/end of each operation
3. Return stats in `ExtractPayloadResult`
4. Log stats at extraction completion

---

## Phase 6: Observability — Built-in Diagnostic Command

### Task 6.1: Add `diagnose_payload` Command

**Issue:** No way to inspect a payload without full extraction.

**Fix:** Add Tauri command that parses manifest and returns structure diagnostics.

**Files:**
- `src-tauri/src/commands/payload.rs`

**Steps:**
1. Add `diagnose_payload(path: String) -> Result<PayloadDiagnostics>`
2. Return: partition count, total size, compression types, hash info, any warnings
3. Wire to frontend `ViewPayloadDumper` "Diagnostics" button

---

## Phase 7: Hardening — Auto-Cleanup on Failure

### Task 7.1: Transactional Extraction Semantics

**Issue:** Partial files left behind on error. otaripper deletes all outputs on failure.

**Fix:** Wrap extraction in a transaction guard. Delete output directory on any error.

**Files:**
- `src-tauri/src/payload/extractor.rs`
- `src-tauri/src/payload/remote.rs`

**Steps:**
1. Create `TransactionGuard` that records created files
2. On `Drop` with error flag, delete all recorded files
3. Apply to both local and remote extraction paths
4. Test by inducing a failure mid-extraction

**Reference:** otaripper follows "fail-fast, cleanup always" semantics

---

## Phase 8: Remote Extraction — HTTP Pipelining

### Task 8.1: Add HTTP Range Request Pipelining

**Issue:** Sequential HTTP reads. No pipelining of range requests.

**Fix:** Use `futures::stream::buffer_unordered(4)` for concurrent range requests.

**Files:**
- `src-tauri/src/payload/http.rs`
- `src-tauri/src/payload/remote.rs`

**Steps:**
1. Add `read_ranges_parallel()` function to `HttpPayloadReader`
2. Use `Semaphore(4)` with `buffer_unordered` for 4 concurrent range requests
3. Apply to direct extraction mode
4. Benchmark improvement

---

## Phase 9: ZIP — Zero-Copy Entry Mapping

### Task 9.1: Memory-Map ZIP Entries Directly

**Issue:** Current ZIP extraction copies to temp file. otaripper memory-maps ZIP entries via offset.

**Fix:** Use `MmapOptions::new().offset(entry_offset).len(entry_size)` to map ZIP entry directly.

**Files:**
- `src-tauri/src/payload/zip.rs`
- `src-tauri/src/payload/http_zip.rs`

**Steps:**
1. Add `mmap_zip_entry(path, entry_offset, entry_size)` function
2. Replace temp-file extraction with direct mmap for STORED entries
3. Fall back to temp file for compressed entries
4. Benchmark: should eliminate temp-file I/O for STORED payloads

---

## Phase 10: Integration — Frontend Stats Display

### Task 10.1: Show Extraction Statistics in UI

**Issue:** No performance stats visible to user.

**Fix:** Display `ExtractionStats` in `ExtractionStatusCard` after completion.

**Files:**
- `src/components/payload-dumper/ExtractionStatusCard.tsx`

**Steps:**
1. Add stats display to `ExtractionStatusCard`
2. Show: duration, throughput, bytes written
3. Format as "Extracted in Xs (Y MB/s)"
4. Run `bun run lint:web && bun run test`

---

## Summary of Tasks

| Phase | Task | Priority | Effort | Gap |
|-------|------|----------|--------|-----|
| 0 | SHA-256 output verification | Critical | Low | Correctness |
| 1 | Non-temporal stores | High | Medium | Performance |
| 2 | Extent coalescing | High | Medium | Performance |
| 3 | Rayon partition parallelism | High | High | Performance |
| 3.2 | Rayon intra-partition parallelism | High | High | Performance |
| 4 | SIMD copy | Medium | High | Performance |
| 4.2 | CPU detection | Medium | Medium | Performance |
| 5 | ExtractionStats tracking | Medium | Low | Observability |
| 6 | Diagnose command | Low | Low | UX |
| 7 | Transaction cleanup | Medium | Medium | Reliability |
| 8 | HTTP pipelining | Medium | Medium | Performance |
| 9 | Zero-copy ZIP mmap | Medium | Medium | Performance |
| 10 | Stats UI display | Low | Low | UX |

---

## Verification Commands

```bash
# Rust check + clippy
cd payload-dumper-fixes && cargo check && cargo clippy

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Frontend lint
cd adb-gui-next && bun run lint:web

# Frontend tests
bun run test

# Build
bun run tauri build --debug
```

---

**End of plan.**
