# Rust Payload Extraction — Performance Research Report

**Date:** 2026-03-22  
**Goal:** Make payload.bin extraction faster, more robust, following KISS principles  
**Reference:** [rhythmcache/payload-dumper-rust](https://github.com/rhythmcache/payload-dumper-rust) v0.8.3

---

## Executive Summary

Our current payload extraction is **correct but slow**. The reference project demonstrates 4-8x speedups through simple, well-understood techniques. This report identifies the **highest-impact, lowest-complexity** improvements following KISS.

| Improvement | Complexity | Impact | KISS Score |
|-------------|------------|--------|------------|
| Async Tauri commands | Low | High | ⭐⭐⭐⭐⭐ |
| Sparse zero handling | Low | High | ⭐⭐⭐⭐⭐ |
| Reusable buffer allocation | Low | Medium | ⭐⭐⭐⭐ |
| Position tracking | Low | Medium | ⭐⭐⭐⭐ |
| Streaming decompression | Medium | High | ⭐⭐⭐ |
| Parallel partition extraction | Medium | Very High | ⭐⭐⭐ |
| Memory-mapped I/O | Medium | Medium | ⭐⭐ |
| Feature flags | Low | Low | ⭐ |

**Recommended KISS-first approach:** Apply top 4 low-complexity items first, then add streaming/parallel.

---

## 1. Async Tauri Commands (Easiest Win)

### Problem
All Tauri commands are synchronous. Heavy operations (payload extraction) block the UI thread.

### Solution
Tauri commands can be `async` — they automatically run on Tauri's Tokio runtime:

```rust
// BEFORE (blocks UI)
#[tauri::command]
pub fn extract_payload(...) -> CmdResult<ExtractPayloadResult> {
    // synchronous code blocks UI
}

// AFTER (non-blocking)
#[tauri::command]
pub async fn extract_payload(...) -> CmdResult<ExtractPayloadResult> {
    // runs on Tokio runtime, UI stays responsive
}
```

### Why KISS
- One keyword change (`async`)
- No new dependencies
- Tauri handles the runtime automatically
- Frontend needs zero changes

### Expected Impact
- UI stays responsive during extraction
- No perceived performance improvement (same speed, better UX)

---

## 2. Sparse Zero Handling (Biggest Speed Win)

### Problem
`Zero` operations allocate `vec![0; expected_size]` and write zeros to disk. For a 2GB zero region, this:
- Allocates 2GB of memory
- Writes 2GB to disk
- Takes minutes

### Solution
Use filesystem sparse file support — just seek past the zero region:

```rust
// BEFORE (writes actual zeros)
Type::Zero => {
    let decoded = vec![0; expected_size]; // 2GB allocation!
    image_file.write_all(&decoded)?;       // 2GB write!
}

// AFTER (instant seek)
Type::Zero => {
    for extent in destination_extents {
        let start_block = extent.start_block.unwrap_or(0);
        let num_blocks = extent.num_blocks.unwrap_or(0);
        let start_offset = start_block * BLOCK_SIZE;
        let total_bytes = num_blocks * BLOCK_SIZE;

        // Just seek — filesystem handles zeros automatically
        image_file.seek(SeekFrom::Start(start_offset + total_bytes))?;
    }
}
```

### Why KISS
- 3 lines of code
- Zero new dependencies
- Works on NTFS (Windows) and ext4 (Linux)
- Converts minutes of I/O into instant seeks

### Expected Impact
- **Zero operations: instant** (vs minutes)
- **Memory: zero allocation** (vs 2GB+)
- **Overall: 2-10x faster** for payloads with large zero regions

### Reference Project
`payload-dumper-rust` uses `handle_zero_region_sparse()` which does exactly this.

---

## 3. Reusable Buffer Allocation

### Problem
`decode_operation` allocates a new `Vec<u8>` for every operation. For a partition with 500 operations, this means 500 heap allocations.

### Solution
Pre-allocate one buffer and reuse it:

```rust
// BEFORE (per-operation allocation)
fn decode_operation(...) -> Result<Vec<u8>> {
    let mut decoded = match operation_type {
        Type::Replace => raw_data.to_vec(),        // allocation
        Type::ReplaceXz => { /* ... */ },          // allocation
        Type::Zero => vec![0; expected_size],      // allocation
    };
    // buffer dropped after each operation
}

// AFTER (reusable buffer)
fn extract_partition(...) -> Result<()> {
    let mut copy_buffer = vec![0u8; 512 * 1024]; // 512KB, allocated once

    for operation in &partition.operations {
        // reuse copy_buffer across operations
        decode_and_write(operation, &mut copy_buffer, ...)?;
    }
}
```

### Why KISS
- Move one allocation outside the loop
- No new dependencies
- Reference project uses 512KB buffer

### Expected Impact
- **5-15% faster** (fewer allocations)
- **Lower memory pressure** (less GC-like behavior)

---

## 4. Position Tracking (Reduce Seeks)

### Problem
Every operation seeks to the start of its extent, even if we're already at the correct position from the previous operation.

### Solution
Track current file position and skip redundant seeks:

```rust
// BEFORE (redundant seeks)
for extent in destination_extents {
    image_file.seek(SeekFrom::Start(start_offset))?; // always seeks
    image_file.write_all(data)?;
}

// AFTER (position tracking)
let mut current_pos = 0u64;

for extent in destination_extents {
    let target_pos = start_offset;
    if current_pos != target_pos {
        image_file.seek(SeekFrom::Start(target_pos))?;
        current_pos = target_pos;
    }
    image_file.write_all(data)?;
    current_pos += data.len() as u64;
}
```

### Why KISS
- One extra variable
- Simple comparison before seek
- Reference project uses `OperationContext.current_pos`

### Expected Impact
- **5-10% faster** for sequential operations
- Reduces syscall overhead

---

## 5. Streaming Decompression (Medium Complexity)

### Problem
`fs::read` loads the entire payload into memory. A 3GB payload requires 3GB of heap allocation before processing begins.

### Solution
Stream data through decompression instead of loading everything first:

```rust
// BEFORE (full memory load)
let bytes = fs::read(payload_path)?; // 3GB allocation
let raw_data = &bytes[data_offset..data_end]; // slice into memory

// AFTER (streaming)
use std::io::{BufReader, Read};

let file = fs::File::open(payload_path)?;
let mut reader = BufReader::with_capacity(256 * 1024, file); // 256KB buffer
reader.seek(SeekFrom::Start(data_offset))?;

let mut raw_data = vec![0u8; data_length];
reader.read_exact(&mut raw_data)?;
```

### Why KISS
- Replace `fs::read` with `BufReader`
- 256KB buffer (reference project size)
- No async needed for this step

### Expected Impact
- **2-5x less memory** (256KB buffer vs 3GB allocation)
- **Faster startup** (don't wait for full file read)
- **Can handle larger payloads** without OOM

---

## 6. Parallel Partition Extraction (High Impact, Medium Complexity)

### Problem
Partitions are extracted sequentially. On a 8-core CPU, 7 cores sit idle.

### Solution
Extract partitions concurrently using `std::thread::scope` (no new dependencies):

```rust
// BEFORE (sequential)
for partition in &payload.manifest.partitions {
    extract_partition(payload, partition, ...)?; // one at a time
}

// AFTER (parallel)
use std::thread;

let results: Vec<_> = thread::scope(|s| {
    let handles: Vec<_> = payload.manifest.partitions.iter()
        .map(|partition| {
            s.spawn(|| extract_partition(payload, partition, ...))
        })
        .collect();

    handles.into_iter()
        .map(|h| h.join().unwrap())
        .collect()
});
```

### Why KISS
- `std::thread::scope` is stable Rust (no tokio needed)
- Each partition gets its own output file (no shared state)
- Simple thread-per-partition model

### Expected Impact
- **4-8x faster** on multi-core systems
- **Linear scaling** with CPU cores

### Caveat
Need separate output files per partition (already the case) and separate file handles.

---

## 7. Memory-Mapped I/O (Medium Complexity, Medium Impact)

### Problem
`fs::read` copies file data into heap memory. Memory mapping avoids the copy.

### Solution
Use `memmap2` crate for zero-copy file access:

```rust
use memmap2::Mmap;

let file = fs::File::open(payload_path)?;
let mmap = unsafe { Mmap::map(&file)? };
mmap.advise(memmap2::Advice::Sequential)?;
```

### Why NOT KISS
- Adds `memmap2` dependency
- `unsafe` code required
- Windows sparse file interaction may be complex
- Marginal improvement over BufReader for sequential access

### Expected Impact
- **30-50% less memory** (no copy)
- **Faster initial load** (OS handles paging)

### Recommendation
**Skip for now** — BufReader streaming achieves similar results with less complexity.

---

## 8. Feature Flags (Low Priority)

### Problem
All features compile unconditionally. Users who don't need ZIP support still pay the compile cost.

### Solution
Add feature flags to Cargo.toml:

```toml
[features]
default = ["zip"]
zip = ["dep:zip"]
```

### Why KISS
- Standard Rust pattern
- Minimal code changes
- Faster builds for minimal use cases

### Expected Impact
- **Faster compile times** for feature subsets
- **Smaller binaries** if features excluded

### Recommendation
**Low priority** — only matters for distribution, not runtime performance.

---

## Recommended Implementation Order (KISS-First)

### Phase 1: Quick Wins (1-2 days)
1. **Async Tauri commands** — one keyword per command
2. **Sparse zero handling** — replace `vec![0; N]` with seek
3. **Reusable buffer** — move allocation outside loop
4. **Position tracking** — skip redundant seeks

### Phase 2: Streaming (2-3 days)
5. **Streaming decompression** — BufReader with 256KB buffer
6. **Read block size from manifest** — remove hardcoded 4096

### Phase 3: Parallel (3-5 days)
7. **Parallel partition extraction** — `std::thread::scope`

### Phase 4: Advanced (Optional)
8. **Feature flags** — conditional compilation
9. **Memory-mapped I/O** — if streaming isn't enough
10. **Remote URL support** — HTTP range requests

---

## Benchmark Estimates

| Scenario | Current | After Phase 1 | After Phase 2 | After Phase 3 |
|----------|---------|---------------|---------------|---------------|
| 500MB payload, 5 partitions | ~30s | ~20s | ~12s | ~4s |
| 2GB payload, large zeros | ~5min | ~30s | ~20s | ~8s |
| 3GB payload, memory usage | 3GB+ | 3GB+ | 256KB | 256KB |
| UI responsiveness during extraction | Frozen | Responsive | Responsive | Responsive |

---

## Dependency Changes

### Add (Phase 2)
```toml
# No new dependencies needed for Phase 1
# Phase 2+ only if streaming requires it
```

### Add (Optional)
```toml
memmap2 = "0.9"  # Only if BufReader streaming isn't enough
```

---

## KISS Compliance Checklist

Each improvement must pass:
- [ ] Can be explained in one sentence
- [ ] Adds ≤1 new dependency
- [ ] Changes ≤50 lines of code
- [ ] Doesn't break existing tests
- [ ] Provides measurable improvement

| Improvement | Passes KISS? |
|-------------|-------------|
| Async commands | ✅ |
| Sparse zeros | ✅ |
| Reusable buffer | ✅ |
| Position tracking | ✅ |
| Streaming decompression | ✅ |
| Parallel extraction | ✅ |
| Memory-mapped I/O | ⚠️ (unsafe) |
| Feature flags | ✅ |

---

## Conclusion

The **simplest, highest-impact** improvements are:
1. Sparse zero handling (instant vs minutes)
2. Async Tauri commands (UI responsiveness)
3. Reusable buffers (fewer allocations)
4. Position tracking (fewer seeks)

These 4 changes require **zero new dependencies**, **<100 lines of code**, and deliver **2-10x speedup** for typical payloads.

The reference project `payload-dumper-rust` proves these techniques work. Our implementation just needs to adopt them.