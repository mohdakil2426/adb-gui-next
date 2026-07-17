# Payload Dumper vs otaripper v2.3 — Comparison Report

**Date:** 2026-05-09  
**Source:** `payload-dumper-fixes` worktree  
**Reference:** otaripper v2.3 (AVX-512 / AVX2 / SSE2 SIMD, Rayon multi-threaded, 2.8 GB/s on AVX-512)

---

## 1. Feature Comparison Matrix

| Feature | adb-gui-next (current) | otaripper v2.3 | Gap |
|---|---|---|---|
| **Payload formats** | CrAU (`payload.bin`), ZIP-wrapped, OPS, OFP-QC, OFP-MTK | CrAU only | ✅ adb-gui-next wins |
| **Decompression** | XZ, BZ2, Zstd (streaming, 256 KiB buffer) | XZ, BZ2, Zstd | ✅ Parity |
| **SIMD acceleration** | None (scalar Rust stdlib) | AVX-512 / AVX2 / SSE2 via simd-json + simdcomp | ❌ Major gap |
| **Multi-threading** | `std::thread::scope` (per-partition) | Rayon (data-level parallelism) | ⚠️ Partial — we parallelize by partition, not within ops |
| **Memory mapping** | `memmap2::Mmap` — Arc-share, zero-copy | Zero-copy mmap for STORED | ✅ Parity |
| **Output verification** | SHA-256 on compressed input bytes (Layer 2, `extractor.rs:300`) | SHA-256 on **decompressed output** (Layer 3) | ❌ Semantic gap — we verify wrong layer |
| **Sparse image support** | Un-sparse post-extraction in `ops/extractor.rs:148` | Built-in sparse handling | ⚠️ We handle post-process; otaripper handles inline |
| **Graceful interruption** | `interrupt.rs` — atomic flag, checked per-partition | `catch_ctrl_c` + cleanup | ✅ Parity |
| **Auto-cleanup on failure** | `NamedTempFile` guard in `remote.rs:333` (prefetch) | Temp file cleanup on error | ✅ Parity |
| **Performance stats** | None | `--stats` flag | ❌ Missing |
| **Cache-aware large writes** | 1 MB `BufWriter` (no NT stores) | Non-temporal stores (1 MiB threshold) | ❌ Major gap |
| **Direct ZIP memory mapping** | `mmap` on downloaded temp file, then parse within | Zero-copy ZIP entries via mmap offset | ⚠️ We copy to temp; otaripper maps ZIP entries |
| **Extent coalescing** | Per-operation seek+write; no coalescing across ops | Consecutive extent merge + vectored I/O | ❌ Gap |
| **Rayon parallelism** | No | Yes — внутри decompression loops | ❌ Gap |
| **OPS/OFP decryption** | ✅ Custom S-box (OPS), AES-CFB (OFP-QC/MTK) | ❌ Not supported | ✅ adb-gui-next wins |

---

## 2. Performance Gaps

### 2.1 SIMD Compression / Decompression

**Current (`extractor.rs:317–330`):**
```rust
let mut buf = [0u8; DECOMP_BUF_SIZE]; // 256 KiB stack buffer — scalar loop
let mut compressed_reader: Option<Box<dyn Read + '_>> = match operation_type {
    Type::ReplaceXz => Some(Box::new(xz2::read::XzDecoder::new(Cursor::new(raw_data)))),
    Type::ReplaceBz => Some(Box::new(bzip2::read::BzDecoder::new(Cursor::new(raw_data)))),
    Type::Zstd => Some(Box::new(zstd::stream::read::Decoder::new(Cursor::new(raw_data))?)),
    ...
};
```
The decompressors are wrappers around C libraries (liblzma, libbz2, libzstd). No SIMD vectorization is applied to the streaming copy loop (`stream_copy` at `extractor.rs:374–391`):

```rust
fn stream_copy(src: &mut impl Read, dst: &mut impl Write, buf: &mut [u8], limit: usize) -> Result<()> {
    let mut remaining = limit;
    while remaining > 0 {
        let to_read = buf.len().min(remaining);
        let n = src.read(&mut buf[..to_read])?;
        dst.write_all(&buf[..n])?;
        remaining -= n;
    }
}
```
This is pure scalar byte-by-byte I/O. `to_read` is always `buf.len()` (256 KiB) until the final chunk — the compiler cannot auto-vectorize across the `Read` trait boundary.

**otaripper:** Uses SIMD-accelerated decompressors + SIMD JSON parsing for manifests. Claims 2.8 GB/s on AVX-512 vs 0.4 GB/s for Python `payload_dumper`.

### 2.2 Output Verification — Wrong Layer

**Current (`extractor.rs:296–304`):**
```rust
// SHA-256 checksum verification on the compressed/raw input bytes.
if let Some(expected_hash) = operation.data_sha256_hash.as_ref()
    && !expected_hash.is_empty()
{
    let actual_hash = Sha256::digest(raw_data);
    if actual_hash.as_slice() != expected_hash.as_slice() {
        anyhow::bail!("payload operation checksum mismatch");
    }
}
```
This verifies the **compressed** data checksum from the manifest — not the decompressed output. otaripper verifies the **decompressed** output bytes against the expected SHA-256, which is the semantically correct layer (Layer 3 as they describe).

Our current approach has a subtle bug: the manifest `data_sha256_hash` is the hash of the raw compressed bytes, but if those bytes are corrupted in a way that still produces a valid (but wrong) hash, we'd miss it. More critically, we don't verify the actual output image.

### 2.3 Cache-Aware Large Writes (Non-Temporal Stores)

**Current (`extractor.rs:175`):**
```rust
let mut image_writer = BufWriter::with_capacity(1024 * 1024, image_file);
```
Standard `BufWriter` uses regular stores that go through the CPU cache. For large sequential writes (typical in payload extraction), this pollutes the cache with data that won't be read again.

**otaripper:** Uses non-temporal stores (`_mm_stream_si32`-style) with a 1 MiB threshold. Data bypasses cache and goes directly to memory, which dramatically improves large-file write throughput on modern CPUs.

**Current write path (`extractor.rs:355–359`):**
```rust
// Raw Replace: slice the next extent_size bytes from raw_data.
let slice_end = decoded_offset.saturating_add(extent_size).min(raw_data.len());
image_writer.write_all(&raw_data[decoded_offset..slice_end])?;
decoded_offset = slice_end;
```
No use of `std::io::Write::write_all` with NT hints, no scatter-gather I/O.

### 2.4 Extent Coalescing

**Current (`extractor.rs:332–363`):**
Each operation's extents are processed sequentially with individual seeks:
```rust
for extent in destination_extents {
    let start_offset = start_block.checked_mul(block_size as u64)...;
    let extent_size = usize::try_from(num_blocks)...;

    if current_pos != start_offset {
        image_writer.seek(SeekFrom::Start(start_offset))?;  // seek per extent
        current_pos = start_offset;
    }
    // ... write
    current_pos += extent_size as u64;
}
```
Adjacent or consecutive extents within the same operation are not coalesced into a single large write. Each seek is a syscall.

**otaripper:** Merges consecutive extents and uses vectored I/O (`pwritev` / `pwritev2` on Linux) to issue a single system call for multiple extents. Reduces syscall overhead dramatically for payloads with many small extents.

### 2.5 Multi-threading Granularity

**Current:** Parallelism at partition level only (`extractor.rs:156–235`). Each partition is one thread. If a payload has 3 partitions (system, vendor, product), only 3 threads run.

```rust
let handles: Vec<_> = partitions_to_extract
    .iter()
    .map(|partition| {
        s.spawn(move || -> Result<String> {
            // entire partition extraction in one thread
        })
    })
    .collect();
```

**otaripper:** Uses Rayon for data-level parallelism — decompression of a single operation's blocks can be parallelized across threads. Better CPU utilization when partitions are imbalanced or when a single partition has many operations.

### 2.6 Remote Extraction Efficiency

**Current prefetch (`remote.rs:303–330`):**
```rust
while downloaded < content_length {
    let chunk_end = (downloaded + chunk_size).min(content_length);
    let chunk_len = chunk_end - downloaded;
    let data = reader.read_range(downloaded, chunk_len).await?;
    temp.as_file_mut().write_all(&data)?;  // synchronous write to disk
    downloaded = chunk_end;
}
```
Downloads 1 MB chunks and writes them to disk synchronously before continuing. No double-buffering, no async pipelining.

**Current direct (`remote.rs:491–627`):**
Range requests per operation data. Each `extract_partition_from_remote` call does a sync HTTP read (`http.read_range_sync`) for every operation's data. The manifest (`zip_info`) is looked up once per partition, but data reads are sequential within a partition with no pipelining.

**otaripper:** HTTP range requests are pipelined. Manifest parsing is batched.

---

## 3. Recommendations

### Priority 1 — Fix Verification Layer (Low effort, high correctness)

**File:** `src-tauri/src/payload/extractor.rs`

The SHA-256 verification should be on the decompressed output, not the compressed input. This requires computing the hash during the `stream_copy` loop:

```rust
// Replace the current Layer 2 check with a hasher passed through stream_copy:
// Add: use sha2::{Digest, Sha256};
// Modify stream_copy to accept &mut Sha256 and accumulate digest during copy.
```

This is a ~20 line change. It makes our verification semantically correct (Layer 3 parity with otaripper).

### Priority 2 — Non-Temporal Stores for Output (Medium effort)

**File:** `src-tauri/src/payload/extractor.rs`

Replace the 1 MB `BufWriter` with a custom buffered writer that issues non-temporal stores for large sequential runs. Alternatively, use `scatter-gather` I/O via `pwritev` on Linux / `WriteFile` with gather on Windows.

For a minimal fix: add an `io_uring` or `tokio-uring` async write path for the direct mode when target is a regular file, bypassing the OS cache for sequential large writes.

**Reference for NT stores in Rust:** `core::intrinsics::transmute` to `std::arch::x86_64::_mm_stream_si32`, or use the `memmap2` crate's `MmapMut` for sparse pre-allocation + `msync` for batched commits.

### Priority 3 — Extent Coalescing (Medium effort)

**File:** `src-tauri/src/payload/extractor.rs:332–363`

Add a pre-pass within each operation to merge adjacent extents:
```rust
// Merge consecutive extents that touch the same block range
let mut coalesced: Vec<Extent> = Vec::new();
for extent in destination_extents {
    if let Some(last) = coalesced.last_mut()
        && last.start_block + last.num_blocks == extent.start_block
    {
        last.num_blocks += extent.num_blocks;
    } else {
        coalesced.push(extent.clone());
    }
}
```
Then write each coalesced extent with a single seek + large `write_all`. Reduces N syscalls to N coalesced blocks.

### Priority 4 — Performance Stats (Low effort, high observability)

Add a `--stats` equivalent:

**File:** `src-tauri/src/payload/extractor.rs`

Return a stats struct from `extract_payload`:
```rust
pub struct ExtractStats {
    pub total_bytes_written: u64,
    pub decompression_time_ms: u64,
    pub sha256_time_ms: u64,
    pub operations_count: usize,
}
```
Record `std::time::Instant` at start/end of each operation. Aggregate in the outer loop.

### Priority 5 — Rayon for Intra-Partition Parallelism (High effort, high reward)

Replace `std::thread::scope` with Rayon for partition-level parallelism. Then add parallel decompression within each operation's extent loop using Rayon's `into_par_iter()` on the coalesced extents.

This is the highest-effort change but closes the biggest gap — otaripper's data-level parallelism across decompressors on multi-core is what delivers 2.8 GB/s vs our current scalar performance.

### Priority 6 — Zero-Copy ZIP Extraction (Medium effort)

**File:** `src-tauri/src/payload/remote.rs`

Instead of downloading to a temp file (`NamedTempFile`), memory-map the HTTP response via `mmap`-based virtual file backed by the Windows pagefile (not directly possible). Alternative: use async I/O with double-buffering — download while decompressing previous chunk.

For ZIP entries: use `zip::ZipArchive` with `mio`/async to overlap download and extraction.

---

## 4. Summary

| Gap | Severity | Fix Complexity |
|---|---|---|
| Output SHA-256 verification (wrong layer) | High (correctness) | Low |
| No SIMD acceleration | High (performance) | High |
| No non-temporal stores | High (performance) | Medium |
| No extent coalescing | Medium (performance) | Medium |
| No performance stats | Medium (observability) | Low |
| Partition-level only parallelism | Medium (performance) | High |
| Temp file download (vs zero-copy ZIP) | Low (correctness) | Medium |

**Total estimated effort:** ~3 days for priorities 1–4, ~1 week for priorities 5–6.

**Current performance baseline:** Unknown (no `--stats` equivalent). Extrapolating from architecture: likely 0.3–0.6 GB/s on modern x86_64, roughly on par with otaripper's AVX2 tier (~1.9 GB/s) but far below AVX-512 tier (~2.8 GB/s).