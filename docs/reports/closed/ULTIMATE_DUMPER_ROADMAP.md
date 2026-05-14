# Ultimate Payload Dumper — Implementation Roadmap

> A practical blueprint to build the best Android OTA payload extractor by cherry-picking the finest features, architectures, and patterns from otaripper, payload-dumper-rust, Payload-Dumper-Go, and our own adb-gui-next codebase.

**Date**: 2026-05-10  
**Based on**: Deep analysis of 4 implementations via 10 parallel research agents  

---

## 1. Vision: What "The Best" Dumper Looks Like

| Dimension | Target State |
|-----------|-------------|
| **Speed** | 3+ GB/s sustained (AVX-512 + zero-copy + async I/O) |
| **Correctness** | 4-layer verification (compressed blob + decompressed stream + output file + partition hash) |
| **Format Support** | ALL AOSP operation types (including delta) + OPS/OFP-QC/OFP-MTK + ZIP streaming |
| **UX** | Desktop GUI + CLI + TUI — real-time per-byte progress, cancel anytime, extraction history |
| **Robustness** | Survives truncated payloads, malformed manifests, power loss mid-extraction |
| **Security** | Fuzz-tested, DOS-resistant, path-traversal-safe, integer-overflow-free |
| **Portability** | Windows/Linux/macOS/ARM64 — single binary, zero system dependencies |
| **Memory** | O(1) per thread regardless of payload size — true streaming |

---

## 2. Side-by-Side: What to Steal from Each Project

### 2.1 Feature Matrix: Current vs Ultimate Target

| Feature | otaripper | payload-dumper-rust | Go tools | Our Current | **Our Target (Ultimate)** | Source to Steal From |
|---------|-----------|---------------------|----------|-------------|--------------------------|---------------------|
| **XZ decompression** | `liblzma` (fast) | `xz2` | CGO `liblzma` (fastest) or pure Go (slow) | `xz2::read::XzDecoder::new_multi_decoder` | `xz2` with multi-decoder + optional `liblzma` feature | Ours + otaripper |
| **BZ2 decompression** | `bzip2` | `bzip2` | Pure Go | `bzip2::read::BzDecoder` | Same | Ours |
| **Zstd decompression** | `zip` + `zstd` | `zstd` | `klauspost/compress` | `zstd::stream::read::Decoder` | Same + async variant | Ours |
| **Brotli support** | No | Yes (feature flag) | No | No | **Yes** | payload-dumper-rust |
| **Puffdiff support** | No | Yes | No | No | **Yes** | payload-dumper-rust |
| **Zucchini support** | No | Yes | No | No | **Yes** | payload-dumper-rust |
| **Lz4diff support** | No | Yes | No | No | **Yes** | payload-dumper-rust |
| **Delta/Incremental OTA** | No | Yes (experimental) | Yes (fork) | Broken (ignored `source_dir`) | **Full delta support** | payload-dumper-rust + Go fork |
| **Move operation** | No | Yes | Yes | No (bails) | **Yes** | payload-dumper-rust |
| **Discard operation** | Yes | Yes | Partial | No (treated as Zero) | **Yes** | otaripper |
| **OPS format** | No | No | No | Yes (S-box cipher) | Yes | Ours |
| **OFP-QC format** | No | No | No | Yes (AES-128-CFB) | Yes | Ours |
| **OFP-MTK format** | No | No | No | Yes (AES-128-CFB + mtk_shuffle) | Yes | Ours |
| **Sparse image output** | Yes | No | No | Yes (unsparse post-extraction) | **True sparse files** | otaripper + Ours |
| **SHA-256 compressed blob** | Yes (Layer 2) | Yes | Yes (Layer 1) | Yes (recently fixed) | Yes | All |
| **SHA-256 decompressed stream** | Yes (Layer 2) | No | Yes (Layer 2) | No | **Yes** | Go tools |
| **SHA-256 output file** | Yes (Layer 3) | No | No | No (`verify.rs` unused) | **Yes** | otaripper |
| **SHA-256 partition manifest hash** | No | No | No | No | **Yes** | New feature |
| **Zero-copy ZIP mmap** | Yes (v2.3) | No | No | No (temp file) | **Yes** | otaripper |
| **Remote HTTP extraction** | No | No | No | Yes (ranges + prefetch) | Yes + async streaming | Ours |
| **Remote ZIP streaming** | No | No | No | Yes | Yes | Ours |
| **SIMD copy (SSE2)** | Yes | No | No | Yes | Yes | Ours + otaripper |
| **SIMD copy (AVX2)** | Yes | No | No | Yes | Yes | Ours + otaripper |
| **SIMD copy (AVX-512)** | Yes | No | No | Detected but falls back to AVX2 | **Full AVX-512** | otaripper |
| **Non-temporal writes** | Yes | No | No | Yes (`msync`) | Yes + `_mm_stream_*` | otaripper |
| **Memory-mapped I/O** | Yes (read + write) | No (buffered) | No (buffered) | Yes (read + write) | Yes | otaripper + Ours |
| **Async I/O runtime** | No | Yes (Tokio) | No (sync) | No (sync) | **Optional Tokio for remote** | payload-dumper-rust |
| **Parallelism level** | Partition | Operation (async) | Operation (goroutine) | Partition | **Partition + within-partition** | All |
| **Cancellation** | `AbortHandle` | Tokio `select!` | Context | None | **CancellationToken** | payload-dumper-rust |
| **Ctrl+C handling** | Yes | Yes | Yes | No | **Yes** | otaripper |
| **Transaction rollback** | Yes | Yes | Yes | Yes | Yes | All |
| **Auto-cleanup on failure** | Yes | Yes | Yes | Yes | Yes | All |
| **Extent coalescing** | Yes | Yes | Yes | Yes | Yes | All |
| **Progress granularity** | Per-operation | Per-operation | Per-operation | Per-partition only | **Per-byte** | Go tools |
| **Partition filtering** | Yes | Yes | Yes | Yes | Yes + search | All |
| **Extraction history** | No | No | No | No | **Yes** | New feature |
| **Performance stats** | Yes (`--stats`) | No | No | No | **Yes** | otaripper |
| **TUI mode** | No | Yes (Bubble Tea) | No | No | **Add CLI/TUI** | payload-dumper-rust |
| **GUI mode** | No | No | No | Yes (Tauri/React) | Yes | Ours |
| **Diagnostic mode** | No | Yes | No | Yes | Yes | Ours + payload-dumper-rust |
| **Dry-run / list only** | Yes | Yes | Yes | Yes | Yes | All |
| **True sparse file output** | Yes | No | No | No (pre-allocated dense) | **Yes** | otaripper |
| **Property-based tests** | No | No | No | No | **Yes** | New (proptest) |
| **Fuzzing** | No | No | No | No | **Yes** | New (cargo-fuzz) |
| **Real payload fixtures** | No | No | No | No | **Yes** | New |
| **On-device (Android)** | No | No | Yes (Payload-Dumper-Android) | No | **Future** | Go tools |

---

### 2.2 Architecture Pattern: What to Steal from Each

| Pattern | Source | Why Steal It | Where to Apply |
|---------|--------|-------------|----------------|
| **Zero-copy ZIP mmap** | otaripper v2.3 | 2x reduction in SSD writes, no temp file | `remote.rs` prefetch path |
| **3-layer verification** | otaripper | Input + ops + output = maximum correctness | `extractor.rs` + new `verify.rs` pipeline |
| **Thread-local buffer pools** | otaripper v2.2 | 60-80% copy op reduction, no alloc per thread | `extractor.rs` worker threads |
| **AVX-512 copy path** | otaripper | 2x throughput vs AVX2 for large copies | `copy.rs` |
| **Non-temporal SIMD stores** | otaripper | Bypass CPU cache for large sequential writes | `write.rs` |
| **`madvise(MADV_SEQUENTIAL)`** | otaripper + Ours | Hint kernel for sequential access | `write.rs` flush |
| **Feature flags (modular build)** | payload-dumper-rust | Compile only what you need, smaller binaries | `Cargo.toml` |
| **Tokio async for remote** | payload-dumper-rust | Pipeline HTTP + decompression without blocking | `remote.rs` |
| **All operation types** | payload-dumper-rust | Future-proof against new AOSP payloads | `extractor.rs` match arms |
| **Delta OTA diff support** | payload-dumper-rust + Go | ~30% of official OTAs are incremental | `delta.rs` |
| **Double-hash verification** | Go tools | Compressed blob + decompressed output = safest | `extractor.rs` hasher strategy |
| **Per-byte progress** | Go tools | Best UX for large partitions | `extractor.rs` events |
| **Goroutine-style parallelism** | Go tools | Fine-grained operation-level concurrency | `rayon::join` or Tokio tasks |
| **CGO XZ performance** | Go tools | If we ever need a C backend, 6x speedup | Optional feature flag |
| **Arc+Mmap zero-copy** | Ours | Zero heap allocation for payload data | Keep as-is |
| **NonTemporalWriter remap** | Ours | Safe dynamic growth with placeholder pattern | Keep as-is |
| **TransactionGuard Drop** | Ours | Automatic cleanup on panic/error | Keep as-is |
| **SIMD detection + fallback** | Ours | Runtime CPU feature detection | Keep + extend AVX512 |
| **Tauri event progress** | Ours | Native desktop integration | Keep as-is |
| **OPS/OFP crypto** | Ours | Unique proprietary format support | Keep as-is |
| **Remote ZIP streaming** | Ours | No full download needed | Keep + optimize |

---

## 3. Ultimate Dumper Architecture Blueprint

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ULTIMATE DUMPER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND LAYER (3 modes)                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │   GUI       │  │    TUI      │  │   CLI                               │  │
│  │ (Tauri/React)│  │ (Bubble Tea) │  │ (clap)                             │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┬───────────────────────┘  │
│         └─────────────────┴───────────────────────┘                            │
│                              ↓                                               │
│  SHARED STATE (Zustand / CLI args)                                           │
│                              ↓                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  RUST CORE LIBRARY (lib.rs)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  PARSER MODULE                                                      │     │
│  │  ├── CrAU header parser (version 2 + future v3)                     │     │
│  │  ├── Protobuf manifest decoder (prost)                              │     │
│  │  ├── ZIP footer parser (with ZIP64 support)                         │     │
│  │  ├── OPS footer + XML decryptor (S-box cipher)                      │     │
│  │  ├── OFP-QC footer + AES-128-CFB decryptor                          │     │
│  │  └── OFP-MTK header + AES-128-CFB + mtk_shuffle                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  EXTRACTION ENGINE (pluggable backends)                             │     │
│  │                                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │     │
│  │  │  LOCAL SYNC  │  │  LOCAL ASYNC │  │      REMOTE ASYNC        │  │     │
│  │  │  (rayon)     │  │  (Tokio)     │  │  (reqwest + tokio)       │  │     │
│  │  │              │  │              │  │                          │  │     │
│  │  │  Best for:   │  │  Best for:   │  │  Best for:               │  │     │
│  │  │  - Desktop   │  │  - CLI       │  │  - HTTP URLs             │  │     │
│  │  │  - Large     │  │  - Piped I/O │  │  - ZIP streaming         │  │     │
│  │  │    local     │  │  - Servers   │  │  - Range requests        │  │     │
│  │  │    files     │  │              │  │                          │  │     │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │     │
│  │                                                                     │     │
│  │  SHARED COMPONENTS (all backends):                                  │     │
│  │  ├── Operation dispatcher (all 15 AOSP types)                       │     │
│  │  ├── Compression registry (XZ/BZ2/Zstd/Brotli/Lz4/Puffdiff)        │     │
│  │  ├── Delta applicator (SourceCopy/SourceBsdiff/Bsdiff)             │     │
│  │  ├── Extent coalescer + overlap detector                          │     │
│  │  ├── SIMD copy engine (Scalar/SSE2/AVX2/AVX-512)                  │     │
│  │  ├── NonTemporalWriter (mmap + msync + remap)                     │     │
│  │  ├── Sparse image expander (in-place streaming)                   │     │
│  │  └── TransactionGuard (atomic commit/rollback)                    │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  VERIFICATION ENGINE (4-layer)                                      │     │
│  │                                                                     │     │
│  │  Layer 1: Input validation                                          │     │
│  │    ├── Magic number check                                           │     │
│  │    ├── Manifest size bounds (≤100MB)                                │     │
│  │    ├── Extent overlap detection                                     │     │
│  │    └── Version compatibility                                        │     │
│  │                                                                     │     │
│  │  Layer 2: Compressed blob hash                                      │     │
│  │    ├── SHA-256(raw_data) for each operation                         │     │
│  │    └── Compared against data_sha256_hash                            │     │
│  │                                                                     │     │
│  │  Layer 3: Decompressed stream hash (optional)                       │     │
│  │    ├── SHA-256(decompressed bytes)                                  │     │
│  │    └── Catches decompression bugs                                   │     │
│  │                                                                     │     │
│  │  Layer 4: Output file hash                                          │     │
│  │    ├── SHA-256(written .img file on disk)                           │     │
│  │    └── Compared against partition hash from manifest                │     │
│  │                                                                     │     │
│  │  Modes: --no-verify | --verify-ops | --strict (all 4 layers)       │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  I/O SUBSYSTEM                                                      │     │
│  │  ├── Zero-copy mmap reader (Arc<Mmap>)                              │     │
│  │  ├── Zero-copy ZIP mmap (for STORED entries)                        │     │
│  │  ├── Async HTTP range reader (reqwest)                              │     │
│  │  ├── Memory-mapped writer (MmapMut)                                 │     │
│  │  ├── True sparse file writer (FALLOC_FL_PUNCH_HOLE)                │     │
│  │  └── Streaming sparse expander (256KB buffer)                       │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                              ↓                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  EVENT / PROGRESS SYSTEM                                            │     │
│  │  ├── Per-byte progress (bytes_written / total_bytes)                │     │
│  │  ├── Per-operation progress (op_index / total_ops)                  │     │
│  │  ├── Per-partition progress (partition completion)                  │     │
│  │  ├── Throughput stats (MB/s, ETA)                                   │     │
│  │  ├── CancellationToken checked at boundaries                        │     │
│  │  └── Tauri events / CLI progress bars / TUI widgets                 │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────────────────┤
│  TESTING & QUALITY                                                           │
│  ├── Unit tests (existing 15 modules)                                       │
│  ├── Integration tests (real payload fixtures)                              │
│  ├── Property-based tests (proptest: random manifests, extents)            │
│  ├── Fuzzing (cargo-fuzz: malformed headers, corrupt protobuf)             │
│  ├── Benchmarks (criterion: throughput vs buffer size vs SIMD)             │
│  └── CI gates (clippy -D warnings + fmt + test + build)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Week 1-2) — Correctness & Safety

| # | Task | Files | Priority |
|---|------|-------|----------|
| 1 | Add manifest size cap (100MB DOS protection) | `parser.rs` | CRITICAL |
| 2 | Fix OPS hash to verify from disk, not memory | `ops/extractor.rs` | CRITICAL |
| 3 | Add post-extraction output hash verification | `extractor.rs` + `verify.rs` | CRITICAL |
| 4 | Add `checked_mul`/`checked_add` to MTK parser | `ops/ofp_mtk.rs` | HIGH |
| 5 | Validate sparse image chunk sizes | `ops/sparse.rs` | HIGH |
| 6 | Fix `try_unsparse` to stream instead of `fs::read` | `ops/extractor.rs` | HIGH |
| 7 | Add extent overlap detection | `extractor.rs` | MEDIUM |
| 8 | Add XML entity expansion limit | `ops/ops_parser.rs` | MEDIUM |

**Goal**: Zero known bugs, zero security issues.

---

### Phase 2: Verification Engine (Week 3-4) — The "otaripper Layer"

| # | Task | Files | Priority |
|---|------|-------|----------|
| 9 | Implement 4-layer verification engine | `verify.rs` (new) | CRITICAL |
| 10 | Add `--no-verify`, `--verify-ops`, `--strict` modes | `commands/payload.rs` | HIGH |
| 11 | Add decompressed stream hashing (optional layer 3) | `extractor.rs` + `copy.rs` | HIGH |
| 12 | Add partition-level output hash (layer 4) | `extractor.rs` | HIGH |
| 13 | Wire `verify_sha256` into extraction pipeline | `extractor.rs` | HIGH |
| 14 | Add hash mismatch detailed error messages | `extractor.rs` | MEDIUM |

**Goal**: Most correct verifier in existence — catches corruption at any stage.

---

### Phase 3: Performance (Week 5-7) — The "otaripper Speed"

| # | Task | Files | Priority |
|---|------|-------|----------|
| 15 | Implement AVX-512 copy path (64-byte lanes) | `copy.rs` | HIGH |
| 16 | Add non-temporal SIMD stores (`_mm_stream_si256`) | `write.rs` | HIGH |
| 17 | Implement zero-copy ZIP mmap (STORED entries) | `remote.rs` + new module | HIGH |
| 18 | Add thread-local 1MB buffer pools | `extractor.rs` | MEDIUM |
| 19 | Auto-tune `DECOMP_BUF_SIZE` via benchmark | `extractor.rs` + bench | LOW |
| 20 | Add `mimalloc` global allocator | `Cargo.toml` | LOW |

**Goal**: Match otaripper's 2.8 GB/s, exceed it on AVX-512 systems.

---

### Phase 4: Delta & Full Op Support (Week 8-10) — The "payload-dumper-rust Breadth"

| # | Task | Files | Priority |
|---|------|-------|----------|
| 21 | Implement `Type::Move` operation | `extractor.rs` | HIGH |
| 22 | Implement `Type::Discard` operation | `extractor.rs` | HIGH |
| 23 | Wire up `extract_delta_payload` with `source_dir` | `commands/payload.rs` + `delta.rs` | CRITICAL |
| 24 | Implement `SourceCopy` delta operation | `delta.rs` | HIGH |
| 25 | Implement `SourceBsdiff` delta operation | `delta.rs` + `bsdiff` crate | MEDIUM |
| 26 | Add Brotli decompression support | `extractor.rs` + `brotli` crate | MEDIUM |
| 27 | Add Puffdiff/Zucchini/Lz4diff stubs | `extractor.rs` | LOW |
| 28 | Add feature flags for delta + brotli | `Cargo.toml` | MEDIUM |

**Goal**: Support 100% of AOSP operation types.

---

### Phase 5: Async & Remote (Week 11-12) — The "payload-dumper-rust Async"

| # | Task | Files | Priority |
|---|------|-------|----------|
| 29 | Add Tokio async extraction backend | `async_extractor.rs` (new) | MEDIUM |
| 30 | Convert remote HTTP to true async streaming | `remote.rs` | MEDIUM |
| 31 | Add async decompression (`async_compression` crate) | new module | MEDIUM |
| 32 | Add `CancellationToken` for graceful abort | `extractor.rs` + frontend | HIGH |
| 33 | Add cancel button to frontend | `ActionFooter.tsx` | HIGH |

**Goal**: Non-blocking extraction, cancellable at any point.

---

### Phase 6: UX & Polish (Week 13-14) — The "Desktop App Advantage"

| # | Task | Files | Priority |
|---|------|-------|----------|
| 34 | Add per-byte progress events | `extractor.rs` + frontend | HIGH |
| 35 | Add extraction stats (MB/s, ETA, duration) | `extractor.rs` + `payloadDumperStore.ts` | MEDIUM |
| 36 | Add partition search/filter in UI | `PartitionTable.tsx` | LOW |
| 37 | Add extraction history (localStorage) | `payloadDumperStore.ts` | LOW |
| 38 | Add dynamic partition group display | `PartitionTable.tsx` | LOW |
| 39 | Add true sparse file output (platform APIs) | `write.rs` | MEDIUM |
| 40 | Add Ctrl+C handler with graceful abort | `extractor.rs` | MEDIUM |

**Goal**: Best-in-class user experience.

---

### Phase 7: Testing & Hardening (Week 15-16) — The "Production Grade"

| # | Task | Files | Priority |
|---|------|-------|----------|
| 41 | Add real payload test fixtures | `tests/fixtures/` | CRITICAL |
| 42 | Add property-based tests (proptest) | `tests/proptest.rs` | HIGH |
| 43 | Add fuzzing target (cargo-fuzz) | `fuzz/` | MEDIUM |
| 44 | Add Criterion benchmarks | `benches/` | MEDIUM |
| 45 | Add CI performance regression checks | `.github/workflows/` | LOW |
| 46 | Write comprehensive documentation | `docs/` | MEDIUM |

**Goal**: Unbreakable, measurable, documented.

---

## 5. Side-by-Side: Current Code vs Target Code

### 5.1 Verification: Current (2-layer) vs Target (4-layer)

**Current (2-layer)**:
```rust
// Layer 1: Input validation (parser.rs)
// Layer 2: Compressed blob hash (extractor.rs, recently fixed)
// MISSING: Layer 3 (decompressed stream hash)
// MISSING: Layer 4 (output file hash)
```

**Target (4-layer)**:
```rust
// Layer 1: Input validation
parse_header(payload_bytes)?;  // magic, version, bounds
validate_manifest(&manifest)?; // size cap, overlap detection

// Layer 2: Compressed blob hash (existing, keep)
let compressed_hash = sha256(raw_data);
assert_eq!(compressed_hash, op.data_sha256_hash)?;

// Layer 3: Decompressed stream hash (NEW)
let mut decompressed_hasher = Sha256::new();
stream_copy(dec, writer, buf, limit, Some(&mut decompressed_hasher))?;
// Optional: compare against expected_decompressed_hash if manifest has it

// Layer 4: Output file hash (NEW)
let output_hash = sha256_file(&output_path)?;
assert_eq!(output_hash, partition.new_partition_info.hash)?;
```

---

### 5.2 Parallelism: Current (partition-only) vs Target (hybrid)

**Current (partition-only)**:
```rust
partitions.par_iter().map(|partition| {
    // Sequential ops within partition
    for op in &partition.operations { ... }
}).collect();
```

**Target (partition + within-partition)**:
```rust
partitions.par_iter().map(|partition| {
    if partition.operations.len() > 10 && partition.size > 1_000_000_000 {
        // Split large partitions into chunks
        let chunks = partition.operations.chunks(10);
        chunks.par_iter().map(|chunk| {
            for op in chunk { ... }
        }).collect::<Result<()>>()?;
    } else {
        // Small partitions: sequential (existing behavior)
        for op in &partition.operations { ... }
    }
}).collect();
```

---

### 5.3 Progress: Current (per-partition) vs Target (per-byte)

**Current (per-partition)**:
```rust
progress(&partition.partition_name, index + 1, total_operations, completed);
// Frontend sees: "system: 5/50 operations"
```

**Target (per-byte)**:
```rust
// In stream_copy loop:
let bytes_written = limit - remaining;
if bytes_written % (1 << 20) == 0 {  // Every 1 MB
    progress_bytes(
        &partition.partition_name,
        index,
        total_operations,
        bytes_written,
        total_operation_bytes,
        completed,
    );
}
// Frontend sees: "system: 1.2 GB / 4.0 GB @ 180 MB/s"
```

---

### 5.4 ZIP Handling: Current (temp file) vs Target (zero-copy mmap)

**Current (temp file)**:
```rust
// remote.rs
let mut temp = NamedTempFile::new()?;
std::io::copy(&mut response, &mut temp)?;  // Full download to disk
let mmap = unsafe { Mmap::map(&temp)? };  // Then mmap the temp file
```

**Target (zero-copy mmap)**:
```rust
// zip_mmap.rs (NEW)
if zip_entry.compression_method == STORED {
    // Direct mmap of the .zip file
    let zip_mmap = Mmap::map(&zip_file)?;
    // Slice view at exact payload.bin offset
    let payload_view = &zip_mmap[entry.offset..entry.offset + entry.size];
    return Ok(Arc::new(payload_view.into()));
} else {
    // Fall back to temp file for deflated entries
    fallback_temp_extract(zip_file, entry)
}
```

---

## 6. Summary: What Makes It "The Best"

| Category | Winner Today | Our Target |
|----------|-------------|------------|
| **Speed** | otaripper (2.8 GB/s) | **3+ GB/s** (AVX-512 + zero-copy ZIP) |
| **Correctness** | Go tools (double hash) | **4-layer verification** (input + compressed + decompressed + output) |
| **Format Support** | payload-dumper-rust (all ops) | **All ops + OPS/OFP + delta** |
| **UX** | adb-gui-next (GUI) | **GUI + TUI + CLI + per-byte progress + history** |
| **Robustness** | otaripper (clean-up always) | **+ cancellation + fuzz-tested** |
| **Security** | — | **DOS-resistant + overflow-free + fuzzed** |
| **Portability** | Go tools (Android) | **Win/Linux/macOS/ARM64** |
| **Memory** | otaripper (zero-copy) | **O(1) per thread + true sparse output** |

**Bottom line**: Take otaripper's speed, payload-dumper-rust's format breadth, Go's verification paranoia, and our unique OPS/OFP + GUI + remote capabilities. Combine them into one tool with zero compromises.

---

*End of Roadmap*
