# Ultimate Payload Dumper — High-Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the world's best Android OTA payload extractor by combining the best features, architectures, and patterns from otaripper (speed), payload-dumper-rust (format breadth), Go tools (verification paranoia), and our unique OPS/OFP/GUI capabilities.

**Architecture:** 4-layer verification engine (input + compressed + decompressed + output), pluggable extraction backends (sync rayon / async Tokio), SIMD-accelerated I/O, zero-copy mmap throughout, unified frontend with per-byte progress and cancellation.

**Tech Stack:** Rust 2024 (Tauri 2), React 19 + TypeScript, Vite 8, rayon, tokio, memmap2, sha2, xz2, bzip2, zstd, brotli, prost, cfb-mode, quick_xml

---

## Reference Reports (Read Before Implementation)

This plan is derived from deep multi-agent research. All reference documents live in `docs/reports/active/`:

| Report | Purpose | Size |
|--------|---------|------|
| **`PAYLOAD_RESEARCH_REPORT.md`** | Deep-dive analysis of 4 implementations (otaripper, payload-dumper-rust, Go tools, ours). Bugs, edge cases, architecture comparisons, performance benchmarks, security audit. | ~47 KB |
| **`ULTIMATE_DUMPER_ROADMAP.md`** | Side-by-side feature matrix, architecture blueprint, code patterns (current vs target), summary of what makes "the best" dumper. | ~29 KB |
| **`payload-dumper-comprehensive-audit.md`** | Prior audit of our payload dumper with findings and recommendations. | ~21 KB |
| **`payload-dumper-otaripper-comparison.md`** | Focused otaripper vs our implementation comparison. | ~12 KB |

**Key findings from research:**
- **Critical bug fixed**: SHA-256 was hashing decompressed bytes instead of raw compressed bytes (AOSP standard)
- **8 bugs discovered**: 3 HIGH, 4 MEDIUM, 1 LOW (detailed in PAYLOAD_RESEARCH_REPORT.md §5)
- **20+ missing features identified** (detailed in PAYLOAD_RESEARCH_REPORT.md §7)
- **Performance gap**: otaripper hits 2.8 GB/s with AVX-512; we achieve ~1-2 GB/s
- **Verification gap**: Go tools do double-hash; otaripper does 3-layer; we only do 2-layer

---

## File Structure (New & Modified)

### Backend (Rust — src-tauri/src/)

| File | Responsibility | Status |
|------|---------------|--------|
| `payload/parser.rs` | CrAU header parsing, manifest bounds validation | **Modify** |
| `payload/extractor.rs` | Core extraction engine, 4-layer verification, delta ops | **Modify** |
| `payload/copy.rs` | SIMD copy engine (SSE2/AVX2/AVX-512) | **Modify** |
| `payload/write.rs` | NonTemporalWriter, true sparse output, non-temporal stores | **Modify** |
| `payload/verify.rs` | 4-layer verification engine (currently dead code) | **Modify** |
| `payload/transaction.rs` | TransactionGuard (unchanged, keep as-is) | Read-only |
| `payload/delta.rs` | Delta OTA applicator (currently unused) | **Modify** |
| `payload/remote.rs` | Remote HTTP, ZIP streaming, zero-copy ZIP mmap | **Modify** |
| `payload/http_zip.rs` | ZIP64 support, EOCD parser | **Modify** |
| `payload/ops/extractor.rs` | OPS/OFP extraction, streaming unsparse, disk hash verify | **Modify** |
| `payload/ops/sparse.rs` | Sparse image expansion (streaming) | **Modify** |
| `payload/ops/crypto.rs` | AES/S-box ciphers (unchanged) | Read-only |
| `payload/ops/detect.rs` | Format detection (unchanged) | Read-only |
| `payload/ops/ops_parser.rs` | XML parsing with entity limit | **Modify** |
| `payload/ops/ofp_qc.rs` | OFP-QC parser (unchanged) | Read-only |
| `payload/ops/ofp_mtk.rs` | OFP-MTK parser with overflow checks | **Modify** |
| `commands/payload.rs` | Tauri commands: extract, list, diagnose, delta | **Modify** |
| `lib.rs` | Module registration, feature flags | **Modify** |
| `Cargo.toml` | New deps: `brotli`, `mimalloc`, `ctrlc`, `tokio` (optional) | **Modify** |

### Frontend (React + TypeScript — src/)

| File | Responsibility | Status |
|------|---------------|--------|
| `components/views/ViewPayloadDumper.tsx` | Root orchestrator, cancel integration | **Modify** |
| `components/payload-dumper/ActionFooter.tsx` | Extract + Cancel buttons | **Modify** |
| `components/payload-dumper/PartitionTable.tsx` | Search/filter, dynamic groups | **Modify** |
| `components/payload-dumper/PartitionRow.tsx` | Per-byte progress, type badges | **Modify** |
| `components/payload-dumper/ExtractionProgressBar.tsx` | MB/s, ETA, bytes display | **Modify** |
| `components/payload-dumper/ExtractionStatusCard.tsx` | Stats, hash reporting | **Modify** |
| `lib/payloadDumperStore.ts` | Zustand: history, per-byte progress, cancel state | **Modify** |
| `lib/desktop/backend.ts` | New commands: cancel, verify mode, stats | **Modify** |
| `lib/desktop/models.ts` | New DTOs: ExtractionStats, VerifyMode, CancelToken | **Modify** |
| `hooks/usePayloadEvents.ts` | Handle new event types: bytes, stats, cancelled | **Modify** |

### Tests

| File | Responsibility | Status |
|------|---------------|--------|
| `src-tauri/src/payload/tests.rs` | Existing tests + new edge cases | **Modify** |
| `src-tauri/tests/fixtures/` | Real payload fixtures (add .bin/.ops files) | **Create** |
| `src-tauri/tests/proptest.rs` | Property-based tests for manifests/extents | **Create** |
| `src-tauri/benches/` | Criterion benchmarks for SIMD/buffer sizes | **Create** |
| `src-tauri/fuzz/` | cargo-fuzz target for malformed payloads | **Create** |

---

## Research Sources (Analyzed)

| Repository | Language | Stars | Key Strengths |
|-----------|----------|-------|--------------|
| [otaripper](https://github.com/syedinsaf/otaripper) | Rust | 200+ | 2.8 GB/s AVX-512, 3-layer verification, zero-copy ZIP mmap |
| [payload-dumper-rust](https://github.com/rhythmcache/payload-dumper-rust) | Rust | 60+ | All 15 AOSP ops, Tokio async, feature flags, Bubble Tea TUI |
| [payload-dumper-go](https://github.com/ssut/payload-dumper-go) | Go | 3000+ | Double-hash verification, goroutine parallelism, Android support |

---

## 7 Implementation Phases

### Phase 1: Foundation — Bug Fixes & Security (Week 1-2)
**Goal:** Zero known bugs, zero security issues.

---

#### Task 1.1: Manifest Size Cap (DOS Protection)

**Files:**
- Modify: `src-tauri/src/payload/parser.rs`
- Test: `src-tauri/src/payload/tests.rs`

**Context:** Currently, a malicious payload can declare a 10 GB manifest length, causing memory exhaustion before the bounds check fires.

- [ ] **Step 1: Write failing test**

```rust
#[test]
fn test_manifest_size_cap_rejects_huge_manifest() {
    let mut header = vec![b'C', b'r', b'A', b'U'];
    header.extend_from_slice(&2u64.to_be_bytes()); // version 2
    header.extend_from_slice(&(10_000_000_000u64).to_be_bytes()); // 10 GB manifest
    header.extend_from_slice(&0u32.to_be_bytes()); // metadata sig length
    
    let result = parse_header(&header);
    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(err.contains("manifest size exceeds maximum"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml test_manifest_size_cap`
Expected: FAIL — no size cap exists

- [ ] **Step 3: Add size cap to parser**

In `src-tauri/src/payload/parser.rs`, add before line 47:

```rust
const MAX_MANIFEST_SIZE: usize = 100_000_000; // 100 MB

// After reading manifest_len:
if manifest_len > MAX_MANIFEST_SIZE {
    anyhow::bail!(
        "manifest size ({}) exceeds maximum allowed ({}). \
        This may be a malformed or malicious payload.",
        manifest_len,
        MAX_MANIFEST_SIZE
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml test_manifest_size_cap`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/parser.rs src-tauri/src/payload/tests.rs
git commit -m "fix(parser): add 100MB manifest size cap for DOS protection"
```

---

#### Task 1.2: Fix OPS Hash Verification (Disk vs Memory)

**Files:**
- Modify: `src-tauri/src/payload/ops/extractor.rs`
- Test: `src-tauri/src/payload/ops/test_ops_decrypt.rs` (or new test file)

**Context:** OPS extractor hashes in-memory buffer before writing. If write fails partially, hash mismatch won't be detected.

- [ ] **Step 1: Write failing test**

```rust
#[test]
fn test_ops_hash_verified_from_disk() {
    // Create a mock OPS partition with known hash
    // Extract it
    // Corrupt the written file (simulate partial write)
    // Verify that re-reading from disk catches the mismatch
}
```

- [ ] **Step 2: Implement disk-based verification**

In `ops/extractor.rs`, after `writer.flush()`:

```rust
// After writing, verify hash from DISK, not memory
if !partition.sha256.is_empty() {
    let file_hash = compute_file_sha256(&output_path)?;
    let expected = hex_to_bytes(&partition.sha256)?;
    if file_hash != expected {
        anyhow::bail!(
            "Partition '{}' SHA-256 mismatch: expected {}, got {:02x?}",
            partition.name,
            partition.sha256,
            file_hash
        );
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml ops::`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/ops/extractor.rs
git commit -m "fix(ops): verify SHA-256 from disk after flush, not memory"
```

---

#### Task 1.3: Fix `try_unsparse` Memory Exhaustion

**Files:**
- Modify: `src-tauri/src/payload/ops/extractor.rs`
- Test: `src-tauri/src/payload/ops/tests.rs`

**Context:** `try_unsparse` calls `std::fs::read(path)` which loads entire partition into RAM. A 4GB `super.img` = 4GB RAM usage.

- [ ] **Step 1: Replace `fs::read` with streaming**

Current code:
```rust
let data = std::fs::read(path)?; // BAD: loads entire file
```

Replace with:
```rust
// Stream from input file, write to output file
let input_file = std::fs::File::open(path)?;
let mut output_file = std::fs::File::create(&unsparse_path)?;
sparse::unsparse_streaming(&input_file, &mut output_file)?;
```

- [ ] **Step 2: Add `unsparse_streaming` to sparse.rs**

```rust
pub fn unsparse_streaming<R: Read, W: Write>(
    input: &mut R,
    output: &mut W,
) -> Result<()> {
    // Read header
    // Process chunks one at a time
    // Use fixed-size buffer (256KB) for Raw chunks
    // Seek for DontCare chunks
    // Never load entire file
}
```

- [ ] **Step 3: Test with large sparse file**

Create synthetic sparse file (1GB expanded, but only 1MB actual data). Verify memory usage stays under 10MB.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/ops/extractor.rs src-tauri/src/payload/ops/sparse.rs
git commit -m "fix(sparse): streaming unsparse to avoid RAM exhaustion"
```

---

#### Task 1.4: Add Integer Overflow Checks to MTK Parser

**Files:**
- Modify: `src-tauri/src/payload/ops/ofp_mtk.rs`

**Context:** `start_offset` and `total_length` read as `u64` without overflow checks before use.

- [ ] **Step 1: Add checked arithmetic**

```rust
let start_offset = entry.start_offset.checked_mul(SECTOR_SIZE)
    .ok_or_else(|| anyhow!("MTK entry start_offset overflow"))?;
let total_length = entry.total_length
    .ok_or_else(|| anyhow!("MTK entry missing total_length"))?;
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/payload/ops/ofp_mtk.rs
git commit -m "fix(ofp-mtk): add checked_mul overflow protection"
```

---

#### Task 1.5: XML Entity Expansion Limit

**Files:**
- Modify: `src-tauri/src/payload/ops/ops_parser.rs`

- [ ] **Step 1: Configure quick_xml reader**

```rust
use quick_xml::events::Event;
use quick_xml::Reader;

let mut reader = Reader::from_str(xml);
reader.trim_text(true);
// quick_xml does not expand entities by default (safe)
// But we should add a size limit
const MAX_XML_SIZE: usize = 1_000_000; // 1MB already exists
// Ensure this is enforced before parsing
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/payload/ops/ops_parser.rs
git commit -m "fix(ops-parser): enforce XML entity limits"
```

---

### Phase 2: 4-Layer Verification Engine (Week 2-3)
**Goal:** Most correct verifier in existence.

---

#### Task 2.1: Design Verification Engine

**Files:**
- Modify: `src-tauri/src/payload/verify.rs`
- Modify: `src-tauri/src/payload/extractor.rs`

**Architecture:**
```rust
pub enum VerifyMode {
    NoVerify,      // Layer 1 only (input validation)
    OpsOnly,       // Layer 1 + 2 (compressed blob)
    Standard,      // Layer 1 + 2 + 3 (compressed + decompressed)
    Strict,        // All 4 layers (compressed + decompressed + output file + partition hash)
}

pub struct VerificationResult {
    pub layer1_passed: bool,  // Input validation
    pub layer2_passed: bool,  // Compressed blob hash
    pub layer3_passed: bool,  // Decompressed stream hash
    pub layer4_passed: bool,  // Output file hash
    pub actual_hashes: HashMap<String, Vec<u8>>,
    pub expected_hashes: HashMap<String, Vec<u8>>,
}
```

- [ ] **Step 1: Implement `VerifyMode` enum**

- [ ] **Step 2: Wire into `extract_payload` signature**

```rust
pub fn extract_payload(
    payload: &LoadedPayload,
    output_dir: &Path,
    selected_partitions: &[String],
    verify_mode: VerifyMode,
    cancel_token: Option<&CancellationToken>,
    progress: impl FnMut(&str, usize, usize, bool),
) -> Result<ExtractPayloadResult>
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/verify.rs src-tauri/src/payload/extractor.rs
git commit -m "feat(verify): add 4-layer verification engine with VerifyMode"
```

---

#### Task 2.2: Layer 3 — Decompressed Stream Hash

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs`
- Modify: `src-tauri/src/payload/copy.rs`

**Context:** Currently `stream_copy` has a `hasher` parameter that's never used. Wire it up for decompressed stream hashing.

- [ ] **Step 1: Wire hasher in compressed ops**

For compressed operations (XZ/BZ2/Zstd), when `verify_mode >= Standard`:
```rust
let mut decompressed_hasher = Sha256::new();
stream_copy(
    dec,
    writer,
    &mut buf,
    extent_size,
    Some(&mut decompressed_hasher),
)?;
// After all extents, optionally verify decompressed hash
// Note: manifest doesn't have decompressed hash field, so this is for
// post-extraction diagnostics only
```

- [ ] **Step 2: Add decompressed hash to results**

Include `decompressed_sha256` in per-operation metadata for diagnostics.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/copy.rs
git commit -m "feat(verify): add Layer 3 decompressed stream hashing"
```

---

#### Task 2.3: Layer 4 — Output File Hash

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs`
- Modify: `src-tauri/src/payload/verify.rs`

- [ ] **Step 1: Compute file hash after extraction**

After `extract_partition` returns successfully:
```rust
if verify_mode >= Strict {
    let file_hash = compute_file_sha256(&output_path)?;
    if let Some(expected) = partition.new_partition_info.as_ref().and_then(|i| i.hash.as_ref()) {
        if file_hash.as_slice() != expected.as_slice() {
            anyhow::bail!(
                "Partition '{}' output hash mismatch: expected {:02x?}, got {:02x?}",
                partition.partition_name,
                expected,
                file_hash
            );
        }
    }
}
```

- [ ] **Step 2: Add `compute_file_sha256` helper**

```rust
fn compute_file_sha256(path: &Path) -> Result<Vec<u8>> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024]; // 64KB buffer
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(hasher.finalize().to_vec())
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/verify.rs
git commit -m "feat(verify): add Layer 4 output file hash verification"
```

---

### Phase 3: Performance — AVX-512 & Zero-Copy (Week 3-4)
**Goal:** Match otaripper's 2.8 GB/s.

---

#### Task 3.1: AVX-512 Copy Path

**Files:**
- Modify: `src-tauri/src/payload/copy.rs`
- Test: `src-tauri/src/payload/tests.rs`

- [ ] **Step 1: Implement `copy_avx512`**

```rust
#[cfg(target_arch = "x86_64")]
fn copy_avx512(dst: &mut [u8], src: &[u8]) {
    let len = dst.len().min(src.len());
    let mut i = 0usize;
    while i + 64 <= len {
        unsafe {
            let data = _mm512_loadu_si512(src.as_ptr().add(i) as *const __m512i);
            _mm512_storeu_si512(dst.as_mut_ptr().add(i) as *mut __m512i, data);
        }
        i += 64;
    }
    // Fall back to AVX2 for remainder
    copy_avx2(&mut dst[i..], &src[i..]);
}
```

- [ ] **Step 2: Wire into `detect_copy_strategy`**

```rust
pub fn detect_copy_strategy() -> CopyStrategy {
    if is_x86_feature_detected!("avx512f") { CopyStrategy::Avx512 }
    else if is_x86_feature_detected!("avx2") { CopyStrategy::Avx2 }
    else if is_x86_feature_detected!("sse2") { CopyStrategy::Sse2 }
    else { CopyStrategy::Scalar }
}
```

- [ ] **Step 3: Add test for AVX-512 correctness**

```rust
#[test]
#[cfg(target_arch = "x86_64")]
fn test_copy_avx512_correctness() {
    if !is_x86_feature_detected!("avx512f") {
        return; // Skip on non-AVX-512 hardware
    }
    let src: Vec<u8> = (0..1024).map(|i| (i % 256) as u8).collect();
    let mut dst = vec![0u8; 1024];
    copy_avx512(&mut dst, &src);
    assert_eq!(dst, src);
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/copy.rs src-tauri/src/payload/tests.rs
git commit -m "perf(copy): implement AVX-512 64-byte SIMD copy path"
```

---

#### Task 3.2: Non-Temporal SIMD Stores

**Files:**
- Modify: `src-tauri/src/payload/write.rs`

- [ ] **Step 1: Add non-temporal write path**

For large sequential writes (>1MB), bypass CPU cache:

```rust
#[cfg(target_arch = "x86_64")]
fn write_non_temporal_avx2(dst: &mut [u8], src: &[u8]) {
    let len = dst.len().min(src.len());
    let mut i = 0;
    while i + 32 <= len {
        unsafe {
            let data = _mm256_loadu_si256(src.as_ptr().add(i) as *const __m256i);
            _mm256_stream_si256(dst.as_mut_ptr().add(i) as *mut __m256i, data);
        }
        i += 32;
    }
    // Remainder with normal copy
    if i < len {
        dst[i..len].copy_from_slice(&src[i..len]);
    }
    // Memory fence to ensure stores are globally visible
    unsafe { _mm_sfence(); }
}
```

- [ ] **Step 2: Integrate into `NonTemporalWriter`**

Use non-temporal path when write size > 1MB and strategy is Avx2/Avx512.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/write.rs
git commit -m "perf(write): add non-temporal AVX2 stores for large writes"
```

---

#### Task 3.3: Zero-Copy ZIP mmap

**Files:**
- Create: `src-tauri/src/payload/zip_mmap.rs`
- Modify: `src-tauri/src/payload/remote.rs`

- [ ] **Step 1: Implement zero-copy ZIP mmap**

```rust
pub fn mmap_zip_payload(zip_path: &Path) -> Result<Arc<Mmap>> {
    let file = File::open(zip_path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    
    // Find payload.bin entry in ZIP central directory
    let eocd = find_eocd(&mmap)?;
    let cd_offset = eocd.central_directory_offset as usize;
    
    // Scan central directory for payload.bin
    let entry = find_entry(&mmap[cd_offset..], "payload.bin")?;
    
    if entry.compression_method == 0 { // STORED
        // Direct slice into mmap
        let payload_offset = entry.local_header_offset + 30 + entry.name_len;
        let payload_end = payload_offset + entry.compressed_size;
        // Return a sub-slice... but Mmap doesn't support sub-slicing easily
        // Instead, return full mmap + offset info
        Ok(Arc::new(mmap))
    } else {
        anyhow::bail!("ZIP entry is compressed, zero-copy not possible");
    }
}
```

- [ ] **Step 2: Add `ZipPayloadMmap` wrapper**

```rust
pub struct ZipPayloadMmap {
    mmap: Arc<Mmap>,
    offset: usize,
    len: usize,
}

impl std::ops::Deref for ZipPayloadMmap {
    type Target = [u8];
    fn deref(&self) -> &[u8] {
        &self.mmap[self.offset..self.offset + self.len]
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/zip_mmap.rs src-tauri/src/payload/remote.rs
git commit -m "perf(zip): zero-copy mmap for STORED ZIP entries"
```

---

### Phase 4: Delta OTA & Full Op Support (Week 4-6)
**Goal:** Support 100% of AOSP operation types.

---

#### Task 4.1: Implement `Type::Move`

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs`

**Context:** Move copies data from source extent to destination extent within the same partition. No payload data involved.

- [ ] **Step 1: Add Move handler**

```rust
Type::Move => {
    let src_extents = operation.src_extents.as_slice();
    let dst_extents = operation.dst_extents.as_slice();
    
    // Read from source extents, write to destination extents
    for (src, dst) in src_extents.iter().zip(dst_extents.iter()) {
        let src_offset = src.start_block.unwrap_or_default() * block_size as u64;
        let dst_offset = dst.start_block.unwrap_or_default() * block_size as u64;
        let len = dst.num_blocks.unwrap_or_default() as usize * block_size as usize;
        
        // Read from already-written portion of output
        // This requires the output to be seekable
        let mut buf = vec![0u8; len.min(256 * 1024)];
        let mut remaining = len;
        let mut src_pos = src_offset;
        let mut dst_pos = dst_offset;
        
        while remaining > 0 {
            let to_copy = buf.len().min(remaining);
            // Read from source position
            writer.seek(SeekFrom::Start(src_pos))?;
            // We need a Read implementation for the writer's backing file
            // This is tricky with MmapMut — we may need a separate Read handle
        }
    }
}
```

**Note:** Move requires reading from the output file while writing. With `MmapMut`, we can read directly from the mmap. But we need to be careful about partial writes.

Alternative: Use a separate `File` handle for reading.

- [ ] **Step 2: Add `read_at` to `NonTemporalWriter`**

```rust
impl NonTemporalWriter {
    pub fn read_at(&self, offset: u64, buf: &mut [u8]) -> Result<usize> {
        let offset_usize = offset as usize;
        if offset_usize + buf.len() > self.mmap.len() {
            return Ok(0); // EOF
        }
        buf.copy_from_slice(&self.mmap[offset_usize..offset_usize + buf.len()]);
        Ok(buf.len())
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/write.rs
git commit -m "feat(extractor): implement Move operation type"
```

---

#### Task 4.2: Implement Delta OTA (`SourceCopy`)

**Files:**
- Modify: `src-tauri/src/payload/delta.rs`
- Modify: `src-tauri/src/payload/extractor.rs`
- Modify: `src-tauri/src/commands/payload.rs`

- [ ] **Step 1: Wire up `source_dir` parameter**

In `commands/payload.rs`:
```rust
#[tauri::command]
async fn extract_delta_payload(
    payload_path: String,
    source_dir: String, // This was ignored!
    output_dir: String,
    selected_partitions: Vec<String>,
) -> Result<ExtractPayloadResult, String> {
    let source_dir = PathBuf::from(source_dir);
    let output_dir = PathBuf::from(output_dir);
    
    let payload = load_payload(&payload_path)?;
    let result = extract_payload_with_source(
        &payload,
        &output_dir,
        &selected_partitions,
        &source_dir, // Pass source directory
        progress_callback,
    )?;
    Ok(result)
}
```

- [ ] **Step 2: Implement `extract_payload_with_source`**

```rust
pub fn extract_payload_with_source(
    payload: &LoadedPayload,
    output_dir: &Path,
    selected_partitions: &[String],
    source_dir: &Path,
    progress: impl FnMut(&str, usize, usize, bool),
) -> Result<ExtractPayloadResult> {
    // Same as extract_payload but with source awareness
    // For each SourceCopy operation:
    //   1. Read from source partition file in source_dir
    //   2. Write to destination extents
}
```

- [ ] **Step 3: Implement `apply_source_copy`**

```rust
fn apply_source_copy(
    operation: &InstallOperation,
    source_file: &mut File,
    writer: &mut NonTemporalWriter,
    block_size: u64,
) -> Result<()> {
    let src_extents = operation.src_extents.as_slice();
    let dst_extents = operation.dst_extents.as_slice();
    
    for (src, dst) in src_extents.iter().zip(dst_extents.iter()) {
        let src_offset = src.start_block.unwrap_or_default() * block_size;
        let dst_offset = dst.start_block.unwrap_or_default() * block_size;
        let len = dst.num_blocks.unwrap_or_default() as usize * block_size as usize;
        
        source_file.seek(SeekFrom::Start(src_offset))?;
        writer.seek(SeekFrom::Start(dst_offset))?;
        
        let mut buf = [0u8; 256 * 1024];
        let mut remaining = len;
        while remaining > 0 {
            let to_read = buf.len().min(remaining);
            let n = source_file.read(&mut buf[..to_read])?;
            if n == 0 { break; }
            writer.write_all(&buf[..n])?;
            remaining -= n;
        }
    }
    Ok(())
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/delta.rs src-tauri/src/payload/extractor.rs src-tauri/src/commands/payload.rs
git commit -m "feat(delta): implement SourceCopy delta operation"
```

---

#### Task 4.3: Add Brotli Decompression

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add brotli crate**

```toml
brotli = { version = "6", optional = true }
```

- [ ] **Step 2: Add Brotli handler**

```rust
#[cfg(feature = "brotli")]
Type::BrotliBsdiff => {
    // Brotli-compressed bsdiff patch
    let mut decoder = brotli::Decompressor::new(Cursor::new(raw_data), 4096);
    // Apply bsdiff to source data
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/Cargo.toml
git commit -m "feat(compression): add Brotli decompression support"
```

---

### Phase 5: Async & Cancellation (Week 6-7)
**Goal:** Non-blocking extraction, cancellable at any point.

---

#### Task 5.1: Cancellation Token

**Files:**
- Create: `src-tauri/src/payload/cancel.rs`
- Modify: `src-tauri/src/payload/extractor.rs`

- [ ] **Step 1: Implement `CancellationToken`**

```rust
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self { cancelled: Arc::new(AtomicBool::new(false)) }
    }
    
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }
    
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }
    
    pub fn check(&self) -> Result<()> {
        if self.is_cancelled() {
            anyhow::bail!("extraction cancelled by user");
        }
        Ok(())
    }
}
```

- [ ] **Step 2: Check token at boundaries**

In `extract_partition`, before each operation:
```rust
for (index, operation) in partition.operations.iter().enumerate() {
    if let Some(token) = cancel_token {
        token.check()?; // Returns Err if cancelled
    }
    // ... process operation
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/cancel.rs src-tauri/src/payload/extractor.rs
git commit -m "feat(cancel): add CancellationToken for graceful abort"
```

---

#### Task 5.2: Frontend Cancel Button

**Files:**
- Modify: `src/components/payload-dumper/ActionFooter.tsx`
- Modify: `src/lib/payloadDumperStore.ts`
- Modify: `src/lib/desktop/backend.ts`

- [ ] **Step 1: Add cancel command**

```rust
#[tauri::command]
fn cancel_extraction(token_id: String) {
    // Look up token in global registry and cancel it
}
```

- [ ] **Step 2: Add cancel button to frontend**

```tsx
// ActionFooter.tsx
{status === 'extracting' && (
  <Button variant="destructive" onClick={handleCancel}>
    <StopCircle className="mr-2 size-4" />
    Cancel
  </Button>
)}
```

- [ ] **Step 3: Handle cancelled state**

```ts
// payloadDumperStore.ts
cancelExtraction: () => {
  set({ status: 'cancelling' });
  invoke('cancel_extraction', { tokenId: get().cancelTokenId });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/payload-dumper/ActionFooter.tsx src/lib/payloadDumperStore.ts src/lib/desktop/backend.ts src-tauri/src/commands/payload.rs
git commit -m "feat(ui): add cancel button and cancellation support"
```

---

### Phase 6: Frontend Improvements (Week 7-8)
**Goal:** Best-in-class UX.

---

#### Task 6.1: Per-Byte Progress Events

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs`
- Modify: `src-tauri/src/payload/copy.rs`
- Modify: `src/lib/desktop/models.ts`
- Modify: `src/hooks/usePayloadEvents.ts`
- Modify: `src/components/payload-dumper/ExtractionProgressBar.tsx`

- [ ] **Step 1: Extend progress schema**

```rust
#[derive(Serialize)]
pub struct ProgressEvent {
    pub partition_name: String,
    pub operation_index: usize,
    pub total_operations: usize,
    pub bytes_written: u64,
    pub total_bytes: u64,
    pub throughput_mbps: f64,
    pub eta_seconds: u64,
    pub completed: bool,
}
```

- [ ] **Step 2: Emit per-byte events from stream_copy**

```rust
pub fn stream_copy(
    src: &mut impl Read,
    dst: &mut impl Write,
    buf: &mut [u8],
    limit: usize,
    mut progress: Option<&mut dyn FnMut(usize)>, // bytes written so far
) -> io::Result<()> {
    let mut remaining = limit;
    let mut written = 0;
    while remaining > 0 {
        let n = src.read(&mut buf[..to_read])?;
        dst.write_all(&buf[..n])?;
        remaining -= n;
        written += n;
        if let Some(ref mut p) = progress {
            p(written);
        }
    }
    Ok(())
}
```

- [ ] **Step 3: Calculate throughput and ETA**

```rust
let elapsed = start_time.elapsed().as_secs_f64();
let throughput = bytes_written as f64 / elapsed / 1_000_000.0; // MB/s
let eta = if throughput > 0.0 {
    ((total_bytes - bytes_written) as f64 / throughput) as u64
} else { 0 };
```

- [ ] **Step 4: Update frontend progress bar**

```tsx
// ExtractionProgressBar.tsx
<div className="flex flex-col gap-1">
  <Progress value={percentage} />
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>{formatBytes(bytesWritten)} / {formatBytes(totalBytes)}</span>
    <span>{throughput.toFixed(1)} MB/s · ETA {formatDuration(eta)}</span>
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/copy.rs src/lib/desktop/models.ts src/hooks/usePayloadEvents.ts src/components/payload-dumper/ExtractionProgressBar.tsx
git commit -m "feat(progress): per-byte progress with throughput and ETA"
```

---

#### Task 6.2: Extraction History

**Files:**
- Modify: `src/lib/payloadDumperStore.ts`
- Modify: `src/components/views/ViewPayloadDumper.tsx`
- Create: `src/components/payload-dumper/ExtractionHistory.tsx`

- [ ] **Step 1: Add history to Zustand store**

```typescript
interface ExtractionRecord {
  id: string;
  timestamp: number;
  payloadPath: string;
  outputDir: string;
  partitions: string[];
  duration: number;
  totalBytes: number;
  status: 'success' | 'error' | 'cancelled';
  error?: string;
}

interface PayloadDumperStore {
  // ... existing fields
  history: ExtractionRecord[];
  addToHistory: (record: ExtractionRecord) => void;
  clearHistory: () => void;
}

// Persist history in localStorage
export const usePayloadDumperStore = create<PayloadDumperStore>()(
  persist(
    (set, get) => ({
      // ...
      history: [],
      addToHistory: (record) => set({ history: [record, ...get().history].slice(0, 50) }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'payload-dumper-storage',
      partialize: (state) => ({
        activeMode: state.activeMode,
        remoteUrl: state.remoteUrl,
        outputPath: state.outputPath,
        history: state.history,
      }),
    }
  )
);
```

- [ ] **Step 2: Create history component**

```tsx
// ExtractionHistory.tsx
export function ExtractionHistory() {
  const { history, clearHistory } = usePayloadDumperStore();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extraction History</CardTitle>
      </CardHeader>
      <CardContent>
        {history.map((record) => (
          <div key={record.id} className="flex items-center gap-2 py-2">
            <StatusIcon status={record.status} />
            <div className="flex-1">
              <div className="text-sm font-medium">{record.payloadPath}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(record.timestamp)} · {record.partitions.length} partitions
                · {formatDuration(record.duration)} · {formatBytes(record.totalBytes)}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/payloadDumperStore.ts src/components/payload-dumper/ExtractionHistory.tsx src/components/views/ViewPayloadDumper.tsx
git commit -m "feat(ui): add extraction history with localStorage persistence"
```

---

#### Task 6.3: Partition Search/Filter

**Files:**
- Modify: `src/components/payload-dumper/PartitionTable.tsx`
- Modify: `src/components/payload-dumper/PartitionRow.tsx`

- [ ] **Step 1: Add search input**

```tsx
// PartitionTable.tsx
const [searchQuery, setSearchQuery] = useState('');

const filteredPartitions = partitions.filter(p =>
  p.name.toLowerCase().includes(searchQuery.toLowerCase())
);

return (
  <div>
    <Input
      placeholder="Search partitions..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="mb-4"
    />
    {/* ... render filteredPartitions */}
  </div>
);
```

- [ ] **Step 2: Add partition type badges**

```tsx
// PartitionRow.tsx
<Badge variant="secondary">
  {partition.isSparse ? 'Sparse' : 'Raw'}
</Badge>
<Badge variant="outline">
  {formatBytes(partition.size)}
</Badge>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/PartitionTable.tsx src/components/payload-dumper/PartitionRow.tsx
git commit -m "feat(ui): partition search/filter and type badges"
```

---

### Phase 7: Testing & Hardening (Week 8-10)
**Goal:** Unbreakable, measurable, documented.

---

#### Task 7.1: Property-Based Tests

**Files:**
- Create: `src-tauri/tests/proptest.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add proptest dependency**

```toml
[dev-dependencies]
proptest = "1"
```

- [ ] **Step 2: Write property tests**

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_extent_arithmetic_never_overflows(
        start_block in 0u64..u64::MAX / 2,
        num_blocks in 0u64..u64::MAX / 2,
        block_size in 1u64..65536u64,
    ) {
        let start_offset = start_block.checked_mul(block_size);
        let extent_size = num_blocks.checked_mul(block_size);
        
        // Either both succeed or we get None (handled gracefully)
        if start_offset.is_some() && extent_size.is_some() {
            let end = start_offset.unwrap().checked_add(extent_size.unwrap());
            prop_assert!(end.is_some());
        }
    }
    
    #[test]
    fn test_coalescing_maintains_total_size(
        extents in prop::collection::vec(
            (0u64..1000u64, 1u64..100u64),
            1..20
        ),
        block_size in 4096u64..8192u64,
    ) {
        let total_size: u64 = extents.iter()
            .map(|(_, num)| num * block_size)
            .sum();
        
        // After coalescing, total size should be preserved
        let coalesced = coalesce_extents(&extents, block_size);
        let coalesced_size: u64 = coalesced.iter()
            .map(|(_, num)| num * block_size)
            .sum();
        
        prop_assert_eq!(total_size, coalesced_size);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/proptest.rs src-tauri/Cargo.toml
git commit -m "test(proptest): add property-based tests for extents and arithmetic"
```

---

#### Task 7.2: Fuzzing Target

**Files:**
- Create: `src-tauri/fuzz/Cargo.toml`
- Create: `src-tauri/fuzz/fuzz_targets/parse_header.rs`

- [ ] **Step 1: Setup cargo-fuzz**

```bash
cargo install cargo-fuzz
cargo fuzz init
```

- [ ] **Step 2: Write fuzz target**

```rust
// fuzz/fuzz_targets/parse_header.rs
#![no_main]
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    let _ = payload::parser::parse_header(data);
});
```

- [ ] **Step 3: Run fuzzer**

```bash
cargo fuzz run parse_header --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/fuzz/
git commit -m "test(fuzz): add cargo-fuzz target for header parsing"
```

---

#### Task 7.3: Criterion Benchmarks

**Files:**
- Create: `src-tauri/benches/copy_benchmark.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add criterion dependency**

```toml
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }

[[bench]]
name = "copy_benchmark"
harness = false
```

- [ ] **Step 2: Write benchmark**

```rust
// benches/copy_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use payload::copy::{detect_copy_strategy, copy_raw_slice};

fn bench_copy_strategies(c: &mut Criterion) {
    let sizes = [1_024, 65_536, 1_048_576, 16_777_216];
    let strategy = detect_copy_strategy();
    
    let mut group = c.benchmark_group("copy");
    for size in sizes {
        let src = vec![0u8; size];
        let mut dst = vec![0u8; size];
        
        group.bench_with_input(
            BenchmarkId::new(format!("{:?}", strategy), size),
            &size,
            |b, _| b.iter(|| copy_raw_slice(black_box(&mut dst), black_box(&src))),
        );
    }
    group.finish();
}

criterion_group!(benches, bench_copy_strategies);
criterion_main!(benches);
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/benches/copy_benchmark.rs src-tauri/Cargo.toml
git commit -m "test(bench): add Criterion benchmark for SIMD copy strategies"
```

---

## Execution Options

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration. Use `superpowers:subagent-driven-development` skill.

**2. Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**

---

## Summary Table

| Phase | Tasks | Duration | Parallelizable |
|-------|-------|----------|----------------|
| 1: Foundation | 5 tasks | 2 weeks | Yes (independent bug fixes) |
| 2: Verification | 3 tasks | 1.5 weeks | Partially |
| 3: Performance | 3 tasks | 2 weeks | Yes (SIMD, ZIP, non-temp) |
| 4: Delta Ops | 3 tasks | 2 weeks | Yes (each op type) |
| 5: Async/Cancel | 2 tasks | 1 week | Yes (backend + frontend) |
| 6: Frontend | 3 tasks | 1 week | Yes (independent UI features) |
| 7: Testing | 3 tasks | 2 weeks | Yes (proptest, fuzz, bench) |

**Total: 11.5 weeks** (solo, sequential)
**Total: 6-8 weeks** (with parallel execution)

---

## Critical Path

Phase 1 (bugs) → Phase 2 (verification) → Phase 3 (performance) → Phase 4 (delta)

**Fastest wins (do first):**
1. Manifest size cap — 2 hours, prevents DOS
2. Output hash verification — 1 day, critical correctness
3. AVX-512 copy — 1 day, 2x performance boost
4. Cancellation token — 1 day, essential UX
5. Per-byte progress — 1 day, visible improvement

*End of Plan*
