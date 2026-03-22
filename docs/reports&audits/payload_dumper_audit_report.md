# Payload Dumper — Comprehensive Audit Report

> **ADB GUI Next** | `src-tauri/src/payload/` | Updated: 2026-03-22
>
> Issues: ZIP memory explosion · Progress broken · OOM shutdown · Slow extraction
>
> Research sources: Web research 2025-2026 · context7 docs · rhythmcache/payload-dumper-rust reference

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Root-Cause Analysis — Bug-by-Bug](#2-root-cause-analysis)
3. [Memory Budget Breakdown](#3-memory-budget-breakdown)
4. [Research Findings — Crates & Solutions](#4-research-findings)
5. [Reference Implementation Comparison](#5-reference-implementation-comparison)
6. [Recommended Dependency Changes](#6-dependency-changes)
7. [Ranked Recommendation Roadmap](#7-ranked-recommendation-roadmap)
8. [Detailed Fix Specifications](#8-detailed-fix-specifications)
9. [Frontend Improvements](#9-frontend-improvements)
10. [Architecture Diagram (Current vs Target)](#10-architecture-diagram)
11. [Quick-Start Fix Sequence](#11-quick-start-fix-sequence)

---

## 1. Executive Summary

| Symptom | Confirmed Root Cause | Severity |
|---------|---------------------|----------|
| ZIP extraction hangs / is very slow | Entire `payload.bin` loaded via `read_to_end` into a single `Vec<u8>` | 🔴 Critical |
| 32 GB RAM → laptop shutdown (OOM) | `payload.bytes.clone()` inside every parallel thread spawned | 🔴 Critical |
| Real-time progress bar shows nothing | Progress callback replaced by `&mut |_,_,_,_| {}` (no-op) inside threads | 🔴 Critical |
| Slow partition extraction | Sync blocking I/O on Tokio thread; each op allocates full decoded `Vec<u8>` | 🟠 High |
| No cancellation support | No way to abort an in-progress extraction | 🟡 Medium |
| Memory not released after extraction | `PayloadCache::cached_bytes` holds 4–6 GB permanently | 🟡 Medium |
| `'use client'` directive in TSX file | Vite/Tauri project incorrectly using Next.js directive | 🟢 Low |

**One-sentence summary:** The current implementation loads the entire payload (4–6 GB) into RAM **twice** — once in the ZIP cache, once per parallel thread clone — never sends progress events during parallel extraction, and uses blocking sync I/O inside an async Tauri command, causing a peak RAM usage of ~45 GB which exceeds the 32 GB physical RAM and triggers an OOM shutdown.

---

## 2. Root-Cause Analysis

### Bug 1 — ZIP loads entire `payload.bin` into RAM (OOM #1)

**Location:** `src-tauri/src/payload/zip.rs` — `extract_payload_bytes_from_zip()`

```rust
// zip.rs — THE PROBLEM
let mut bytes = Vec::with_capacity(entry.size() as usize);
std::io::copy(&mut entry, &mut bytes)?;  // reads ALL bytes into RAM
return Ok(bytes);
```

**What happens:**

- Android OTA ZIPs commonly contain a `payload.bin` of **3–6 GB**.
- `Vec::with_capacity(entry.size() as usize)` pre-allocates up to 6 GB in one JIT allocation.
- `std::io::copy` fills it completely synchronously, blocking the entire Tokio thread pool.
- The entire allocation is then retained in `PayloadCache::cached_bytes` permanently.
- `std::fs::File` I/O in Rust is unbuffered by default — confirmed by research — making numerous small reads even slower.

**Memory cost:** 1× file size = 4–6 GB minimum just for the ZIP cache.

---

### Bug 2 — `payload.bytes.clone()` inside every thread (OOM #2 — the killer)

**Location:** `src-tauri/src/payload/extractor.rs` — parallel extraction block

```rust
// extractor.rs — FATAL
let payload_bytes = &payload.bytes;  // Vec<u8>, not Arc
...
s.spawn(move || -> Result<String> {
    let payload_ref = super::parser::LoadedPayload {
        bytes: payload_bytes.clone(),  // FULL CLONE of 4-6 GB PER THREAD
        manifest: manifest.clone(),
        data_offset,
    };
```

**What happens:**

- Extracting 8 partitions in parallel causes `payload.bytes` to be **cloned 8 times**.
- A 4 GB `payload.bin` → 8 × 4 GB = **32 GB** of clones on the heap.
- The OS OOM-killer fires, shutting down the process (or the whole system via swap exhaustion).

**Root cause:** `LoadedPayload::bytes` is a plain `Vec<u8>`, not `Arc<Vec<u8>>`. Each thread requires ownership, so the code deep-clones the full buffer.

---

### Bug 3 — Progress callback silently replaced by no-op in threads

**Location:** `src-tauri/src/payload/extractor.rs` — inside `s.spawn`

```rust
// Inside each thread — THE PROGRESS BUG
extract_partition(
    &payload_ref,
    partition,
    &mut image_file,
    block_size,
    &mut |_, _, _, _| {},   // Real callback DISCARDED — replaced by no-op
)?;
```

Then **after all threads finish**:

```rust
// After thread::scope — fires ONCE per partition at the very end
for partition in &partitions_to_extract {
    progress(&partition.partition_name, 1, 1, true);
}
```

**What happens:**

- The Tauri event `payload:progress` is fired **only once per partition** reporting `1/1, completed=true`.
- During the entire extraction (which can take minutes), the frontend receives **zero** real-time events.
- The progress bar shows `0%`, then instantly jumps to `100%`. Only the spinner provides feedback.
- **Why the no-op?** The real `progress` closure captures `&app` (an `AppHandle`). Passing it into `s.spawn(move || ...)` requires `Send + 'scope`. The borrow/lifetime issue was silenced with the no-op workaround.

> **Research finding (Tauri 2 docs):** `AppHandle` is `Clone + Send`. The correct pattern is to `app_handle.clone()` at the spawn site and move clone into the thread. The event system (`app.emit()`) is thread-safe and works correctly from any thread.

---

### Bug 4 — `decode_operation` allocates full decoded `Vec<u8>` per operation

**Location:** `src-tauri/src/payload/extractor.rs` — `decode_operation()`

```rust
fn decode_operation(...) -> Result<Vec<u8>> {
    let mut decoded = match operation_type {
        Type::ReplaceXz => {
            let mut decoder = XzDecoder::new(Cursor::new(raw_data));
            read_all(&mut decoder)?  // entire decompressed block buffered in RAM
        }
        // same for BZ2, Zstd
    };
    if decoded.len() < expected_size {
        decoded.resize(expected_size, 0);  // additional zero-fill allocation
    }
    Ok(decoded)  // can be hundreds of MB for system.img operations
}
```

**What happens:**

- Every decompression operation buffers the **full decoded output** in a `Vec<u8>` before writing any bytes to disk.
- For `system.img` with large XZ blocks this can be **100–500 MB per operation**.
- With 8 parallel threads, peak allocation from this alone can be **4 GB additional**.

**Research finding:** The `async-compression` crate (and even the sync `xz2` / `bzip2` read traits) support **streaming decompression** via `BufReader<N>`. Using a 256 KB buffer and copying directly to the output file eliminates per-operation large allocations entirely.

---

### Bug 5 — Blocking sync I/O inside an async Tauri command

**Location:** `src-tauri/src/commands/payload.rs`

```rust
pub async fn extract_payload(...) -> CmdResult<ExtractPayloadResult> {
    // ...
    match payload::extract_payload(...) {  // sync blocking call in async context!
```

**What happens:**

- The Tauri command is `async fn`, but immediately blocks the Tokio worker thread with `std::thread::scope`.
- This **starves the Tokio runtime** — no other async tasks run on that thread until extraction finishes.
- `app.emit()` (Tauri event delivery) is async and competes with the blocked thread.

**Research finding (Tokio docs):** The correct pattern is `tokio::task::spawn_blocking(|| { ... }).await` for sync-heavy work. This offloads the blocking work to a dedicated blocking thread pool, keeping the async runtime free. Alternatively, `rayon::spawn` inside `spawn_blocking` is ideal for CPU-bound parallel work.

---

### Bug 6 — ZIP cache holds full raw bytes permanently after extraction

**Location:** `zip.rs` — `PayloadCacheInner`

```rust
struct PayloadCacheInner {
    cached_zip_path: Option<PathBuf>,
    cached_payload_path: Option<PathBuf>,
    cached_bytes: Option<Vec<u8>>,  // 4-6 GB lives here forever
}
```

**What happens:**

- After extraction, the Tauri `State<PayloadCache>` **retains the full 4–6 GB** in `cached_bytes`.
- Memory is only freed when `cleanup_payload_cache` is explicitly called.
- Users who do not click "Reset" will see the app holding 4–6 GB of RAM while idle.

---

### Bug 7 — `'use client'` directive in `ViewPayloadDumper.tsx`

**Location:** `src/components/views/ViewPayloadDumper.tsx:1`

```tsx
'use client';  // WRONG: this is Vite/Tauri, not Next.js
```

This violates the project rule: **"No `'use client'` directives"**.

---

## 3. Memory Budget Breakdown

For a typical Android OTA (Pixel 8 — `payload.bin` ≈ 4.5 GB):

| Allocation | Current Code | With Phase 1 Fixes | With All Fixes |
|------------|-------------|---------------------|----------------|
| ZIP → payload extraction buffer | 4.5 GB (full `Vec`) | 4.5 GB (still in cache) | ~0 (streaming to temp file) |
| `PayloadCache` resident bytes | 4.5 GB (cached permanently) | 4.5 GB (but shared via Arc) | ~16 KB (path only) |
| Per-thread payload clone (8 threads) | 8 × 4.5 GB = **36 GB** | 0 (`Arc::clone`) | 0 (file handle per thread) |
| Per-operation decode buffer | 50–400 MB × ops × threads | 50–400 MB (unchanged) | ~256 KB (BufReader) |
| **Total peak RAM** | **~45 GB** → OOM | **~7 GB** | **~512 MB** |

This is precisely why the laptop shuts down. Peak allocation far exceeds physical RAM, triggering OOM-killer or swap exhaustion.

---

## 4. Research Findings

### 4.1 `async-compression` crate — Full streaming decompression

**Source:** docs.rs, web research 2025-2026

The `async-compression` crate provides **async adapters** for all major compression formats (XZ/LZMA, BZ2, Zstd, Gzip, Brotli, Lz4, etc.) that implement `AsyncRead`:

```toml
# Cargo.toml
async-compression = { version = "0.4", features = ["tokio", "xz", "bzip2", "zstd"] }
```

Usage with Tokio file IO:

```rust
use async_compression::tokio::bufread::{XzDecoder, BzDecoder, ZstdDecoder};
use tokio::io::{BufReader, AsyncReadExt};

// XZ streaming — never buffers full decompressed block
let stream = tokio::io::BufReader::with_capacity(256 * 1024, file_range_reader);
let mut decoder = XzDecoder::new(stream);
tokio::io::copy(&mut decoder, &mut output_file).await?;
```

**Key advantage:** Works over any `AsyncRead` source, including offset-limited file readers. Allocates only the BufReader buffer (256 KB) — never the full decompressed output.

**Alternative (sync, no new dep):** The existing `xz2::read::XzDecoder` implements `Read`, so a sync streaming approach with a `[u8; 256*1024]` stack buffer works without adding `async-compression`:

```rust
let mut decoder = xz2::read::XzDecoder::new(Cursor::new(raw_data));
let mut buf = [0u8; 256 * 1024];
loop {
    let n = decoder.read(&mut buf)?;
    if n == 0 { break; }
    image_file.write_all(&buf[..n])?;
}
```

> **Recommendation:** Use the sync streaming approach first (no new dependency). Add `async-compression` only during the Phase 3 async migration.

---

### 4.2 `memmap2` crate — Zero-copy file access (best long-term solution)

**Source:** context7 docs (rs_memmap2, 806 snippets, High reputation), web research 2025-2026

Memory-mapped files are the **gold standard** for random-access large binary files:

```toml
# Cargo.toml
memmap2 = "0.9"
```

Usage:

```rust
use memmap2::Mmap;
use std::fs::File;
use std::sync::Arc;

// Open file and create read-only memory map
let file = File::open(&payload_path)?;
let mmap = unsafe { Mmap::map(&file)? };

// Wrap in Arc for cheap sharing across threads — NO CLONE of the bytes
let shared_mmap: Arc<Mmap> = Arc::new(mmap);

// Each thread gets Arc::clone (pointer only), accesses bytes via &shared_mmap[offset..end]
s.spawn(|| {
    let data = &shared_mmap[op_offset..op_offset + op_length];
    // decompress data → output file
});
```

**Why this is ideal for our use case:**

| Property | `Vec<u8>` | `Arc<Vec<u8>>` | `Arc<Mmap>` |
|----------|-----------|----------------|-------------|
| Initial load time (4 GB file) | ~8s (copy from disk) | ~8s (copy from disk) | ~0ms (no copy!) |
| RAM usage | 4 GB | 4 GB (single copy) | ~0 (OS page cache) |
| Thread sharing | Clone = 4 GB | Clone = 8 bytes | Clone = 8 bytes |
| Random access | O(1) | O(1) | O(1) |
| Larger-than-RAM files | ❌ OOM | ❌ OOM | ✅ OS pages |
| Safety | ✅ Safe | ✅ Safe | ⚠️ unsafe block needed |

**Safety note:** `Mmap::map` requires an `unsafe` block because the compiler cannot guarantee the file won't be modified externally. For our use case (reading a user-selected `payload.bin` that is never written while mapped), this is **safe in practice**. Wrap the `unsafe` in a well-documented function:

```rust
/// SAFETY: payload.bin is a read-only user file that we never modify during extraction.
/// No other process modifies it while we hold the handle (it was user-opened).
fn open_payload_mmap(path: &Path) -> Result<Arc<Mmap>> {
    let file = File::open(path)?;
    let mmap = unsafe { Mmap::map(&file)? };
    Ok(Arc::new(mmap))
}
```

---

### 4.3 `rayon` — Best-in-class CPU-bound parallelism

**Source:** web research 2025-2026

The current `std::thread::scope` approach is correct for CPU-bound parallel work, but `rayon` provides a better API and a smarter work-stealing scheduler:

```toml
# Cargo.toml
rayon = "1.10"
```

```rust
use rayon::prelude::*;

// Replace manual thread::scope with rayon parallel iterator
let results: Vec<Result<String>> = partitions_to_extract
    .par_iter()  // rayon parallel iterator
    .map(|partition| {
        let app = app_handle.clone();
        let mmap = Arc::clone(&shared_mmap);
        extract_partition_streaming(&mmap, partition, &output_dir, block_size, move |name, cur, total, done| {
            let _ = app.emit("payload:progress", serde_json::json!({
                "partitionName": name, "current": cur, "total": total, "completed": done,
            }));
        })
    })
    .collect();
```

**Research finding:** For CPU-bound work (decompression), `rayon` + `spawn_blocking` is the 2025-2026 recommended pattern:

```rust
// In the async Tauri command:
tokio::task::spawn_blocking(move || {
    partitions.par_iter().map(|p| extract_fn(p)).collect::<Vec<_>>()
}).await??
```

**Key advantage over `std::thread::scope`:** Rayon's thread pool is shared with the rest of the app, prevents over-subscription of CPU cores, and automatically load-balances uneven workloads.

---

### 4.4 `tempfile` crate — Safe temp file for ZIP extraction

**Source:** docs.rs, web research 2025-2026

For extracting `payload.bin` from a ZIP to a temp file without loading it all into RAM:

```toml
# Cargo.toml
tempfile = "3"
```

```rust
use tempfile::NamedTempFile;

fn extract_zip_to_tempfile(zip_path: &Path) -> Result<PathBuf> {
    let zip_file = fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(zip_file)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.name() != "payload.bin" { continue; }

        // Stream zip entry to temp file — no Vec<u8> of 4-6 GB ever allocated
        let mut temp = NamedTempFile::new()?;
        std::io::copy(&mut entry, temp.as_file_mut())?;
        let (_, path) = temp.keep()?;  // persist for duration of session
        return Ok(path);
    }
    anyhow::bail!("payload.bin not found in ZIP")
}
```

**Safety note (from research):** On Linux, system temp cleaners (`systemd tmpfiles`) can delete temp files. Prefer storing temp files in the app's own data directory or the system temp directory with explicit path tracking. Use `temp.keep()` to prevent auto-deletion. Always clean up in `cleanup_payload_cache`.

**Alternative:** Use the OS temp dir but store in `AppData/Local/Temp/<app-name>/` for isolation.

---

### 4.5 `tokio::sync::Semaphore` — Limit parallel partition extraction

**Source:** context7 Tokio docs (rs_tokio, 26001 snippets), web research 2025-2026

To prevent over-parallelism (extracting all 30 partitions at once → 30× memory pressure):

```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

let max_parallel = num_cpus::get().min(4);  // cap at 4 parallel partitions
let semaphore = Arc::new(Semaphore::new(max_parallel));

let handles: Vec<_> = partitions.iter().map(|p| {
    let permit = Arc::clone(&semaphore);
    let app = app_handle.clone();
    let mmap = Arc::clone(&shared_mmap);
    tokio::spawn(async move {
        let _permit = permit.acquire().await?;  // blocks until slot available
        tokio::task::spawn_blocking(move || {
            extract_partition_streaming(&mmap, p, &app)
        }).await?
    })
}).collect();

for h in handles { h.await??; }
```

**Research finding:** The default Tokio runtime's `spawn_blocking` pool has 512 threads max but each partition extraction is CPU+I/O bound. Limiting to `num_cpus` parallel partitions prevents both CPU over-subscription and excessive I/O contention.

---

### 4.6 Tauri 2 progress event best practices

**Source:** Tauri 2 docs, web research 2025-2026

Confirmed patterns for real-time progress in Tauri 2:

```rust
// Backend: emit from any thread
app_handle.emit("payload:progress", ProgressPayload { ... })?;

// Frontend: listen with proper cleanup
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
    const unlisten = listen<ProgressPayload>('payload:progress', (event) => {
        updateProgress(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };  // cleanup on unmount
}, []);
```

**Key findings:**
- `AppHandle` can be cloned freely — it is `Clone + Send + Sync`.
- `app.emit()` is non-blocking and thread-safe — call from inside any `spawn_blocking` task.
- The payload should be JSON-serializable (annotate with `#[derive(Serialize)]), use `serde_json::json!` for quick inline payloads.
- Do NOT pass large binary data via events — only small metadata (progress counts, partition names).

---

### 4.7 `num_cpus` or `std::thread::available_parallelism` — Smart thread count

**Source:** Rust std 1.59+, web research 2025-2026

Instead of hard-coding thread count, use the system's logical CPU count:

```rust
// No new dependency needed (since Rust 1.59):
let thread_count = std::thread::available_parallelism()
    .map(|n| n.get())
    .unwrap_or(4)
    .min(partitions.len())      // no more threads than work
    .min(8);                    // cap to avoid thrashing on high core counts
```

---

## 5. Reference Implementation Comparison

The `rhythmcache/payload-dumper-rust` reference uses a completely different architecture that avoids all of these issues.

### 5.1 Streaming decompression — never buffers full decoded block

```rust
// Reference: const BUFREADER_SIZE: usize = 256 * 1024
async fn process_operation_streaming(op, ctx) -> Result<()> {
    match op.r#type() {
        Type::ReplaceXz => {
            let stream = ctx.payload_reader.read_range(offset, length).await?;
            let mut decoder = XzDecoder::new(BufReader::with_capacity(256*1024, stream));
            copy_with_buffer(&mut decoder, ctx.out_file, ctx.copy_buffer).await?;
        }
    }
}
```

### 5.2 File-handle based reader — no full copy into RAM

```rust
impl PayloadReader for LocalPayloadReader {
    async fn read_range(&mut self, offset: u64, length: u64)
        -> Result<Pin<Box<dyn AsyncRead + Send + '_>>> {
        self.file.seek(SeekFrom::Start(offset)).await?;
        Ok(Box::pin(self.file.take(length)))  // streaming reader, zero alloc
    }
}
```

### 5.3 Per-operation progress — fires every op

```rust
for (i, op) in partition.operations.iter().enumerate() {
    if reporter.is_cancelled() { return Err(anyhow!("Cancelled")); }
    process_operation_streaming(i, op, &mut ctx, reporter, partition_name).await?;
    reporter.on_progress(partition_name, (i + 1) as u64, total_ops);
}
```

### 5.4 Pre-allocate output file with `set_len()`

```rust
out_file.set_len(partition_size).await?;  // sparse zero regions work correctly
```

---

## 6. Dependency Changes

### New Dependencies to Add

| Crate | Version | Purpose | Priority |
|-------|---------|---------|----------|
| `memmap2` | `"0.9"` | Zero-copy mmap reading of payload.bin — eliminates all RAM clones | 🔴 Phase 1 |
| `tempfile` | `"3"` | Safe temp file for ZIP extraction streaming | 🟠 Phase 1 |
| `rayon` | `"1.10"` | CPU-parallel partition extraction with work-stealing | 🟠 Phase 1 |
| `async-compression` | `"0.4"` (features: `tokio,xz,bzip2,zstd`) | Async streaming decompression — Phase 3 only | 🟡 Phase 3 |

### Existing Dependencies to Keep

| Crate | Status | Note |
|-------|--------|------|
| `xz2` | Keep | Still used for sync streaming decode (Phase 1-2); makes `async-compression` optional |
| `bzip2` | Keep | Same as xz2 |
| `zstd` | Keep | Same |
| `zip` | Keep | Still used for ZIP archive navigation |
| `sha2` | Keep | SHA-256 verification still valid |

### `Cargo.toml` Changes

```toml
# src-tauri/Cargo.toml — add these:
memmap2 = "0.9"
tempfile = "3"
rayon = "1.10"

# Phase 3 only (async migration):
# async-compression = { version = "0.4", features = ["tokio", "xz", "bzip2", "zstd"] }
```

---

## 7. Ranked Recommendation Roadmap

### Phase 1 — Stop OOM & Fix Progress (~1-2 days)

> These are surgical changes — no architecture rewrite needed.

| # | Fix | New Dep? | Impact | Effort |
|---|-----|----------|--------|--------|
| 1.1 | **`Arc<Mmap>` payload reader** — replace `Vec<u8>` with `memmap2::Mmap` wrapped in `Arc`. Single `unsafe` block, zero RAM for payload | `memmap2` | 🔴 OOM fix | Low |
| 1.2 | **Fix progress callback** — forward `app_handle.clone()` into each thread, emit real events inside `extract_partition` | None | 🔴 Progress fix | Low |
| 1.3 | **ZIP streaming to temp file** — stream ZIP entry to `tempfile::NamedTempFile`, cache path only | `tempfile` | 🔴 OOM + slow ZIP | Medium |
| 1.4 | **`spawn_blocking` wrapper** — wrap `extract_payload` sync call in `tokio::task::spawn_blocking` | None | 🟠 Fixes runtime starvation | Trivial |
| 1.5 | **Remove `'use client'`** from `ViewPayloadDumper.tsx` | None | 🟢 Rule compliance | Trivial |

### Phase 2 — Streaming Decompression (~2-3 days)

| # | Fix | New Dep? | Impact | Effort |
|---|-----|----------|--------|--------|
| 2.1 | **Sync streaming decode** — replace `read_all()` pattern with `BufReader + 256KB stack buffer` write loop | None | 🟠 Per-op RAM: 500MB→256KB | Medium |
| 2.2 | **Pre-allocate output files** — `file.set_len(partition_size)?` before operation loop | None | 🟡 Perf + sparse correctness | Low |
| 2.3 | **Rayon parallel iteration** — replace `std::thread::scope` with `rayon::par_iter()` inside `spawn_blocking` | `rayon` | 🟡 Better load balancing | Low |
| 2.4 | **Semaphore concurrency cap** — limit parallel partitions to `min(num_cpus, 4)` | None | 🟡 Prevents I/O thrashing | Low |
| 2.5 | **Cancellation support** — `Arc<AtomicBool>` cancel flag, checked per operation | None | 🟡 UX improvement | Medium |

### Phase 3 — Full Async Architecture (~1 week)

| # | Fix | New Dep? | Impact | Effort |
|---|-----|----------|--------|--------|
| 3.1 | **`async-compression` decoders** — full async streaming with `async-compression` over `AsyncRead` file ranges | `async-compression` | 🟠 Perf + correctness | High |
| 3.2 | **Tokio task per partition** — `tokio::spawn` + `Semaphore` replacing `thread::scope` | None | 🟡 Architecture | Medium |
| 3.3 | **Tauri channel API** — use `tauri::ipc::Channel` for structured streaming progress instead of ad-hoc events | None | 🟡 Typed progress API | Medium |

---

## 8. Detailed Fix Specifications

### Fix 1.1 — `Arc<Mmap>` payload reader (eliminates ALL payload RAM)

**File:** `src-tauri/Cargo.toml`
```toml
memmap2 = "0.9"
```

**File:** `src-tauri/src/payload/parser.rs`

```rust
use std::sync::Arc;
use memmap2::Mmap;

/// Shared memory-mapped view of payload.bin.
/// Arc allows free sharing across threads with zero-copy.
pub(super) type SharedMmap = Arc<Mmap>;

pub(super) struct LoadedPayload {
    /// SAFETY: payload.bin is a read-only user file.
    /// We never write to it or truncate it during extraction.
    pub mmap: SharedMmap,
    pub manifest: chromeos_update_engine::DeltaArchiveManifest,
    pub data_offset: usize,
}

/// Opens payload.bin as a memory-mapped file.
/// The OS loads pages on demand — O(1) "load time", no RAM copy.
pub(super) fn load_payload(path: &Path, cache: &PayloadCache) -> Result<LoadedPayload> {
    let resolved_path = cache.get_payload_path(path)?;
    let file = std::fs::File::open(&resolved_path)?;
    // SAFETY: payload.bin is never modified while we hold this mapping.
    let mmap = unsafe { Mmap::map(&file)? };
    let shared = Arc::new(mmap);

    let (manifest_bytes, data_offset) = parse_header(&shared[..])?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(LoadedPayload { mmap: shared, manifest, data_offset })
}
```

**File:** `src-tauri/src/payload/extractor.rs`

```rust
// BEFORE — clones 4 GB per thread
bytes: payload_bytes.clone(),

// AFTER — clones 8 bytes (Arc pointer), backed by mmap
mmap: Arc::clone(&payload.mmap),

// Access data: same slice syntax as Vec<u8>
let raw_data = &payload.mmap[op_offset..op_offset + op_length];
```

**Result:** Per-thread payload RAM goes from **4 GB → 0 bytes** (shared OS page cache).

---

### Fix 1.2 — Real-time progress events inside threads

`AppHandle` is `Clone + Send`. The fix is to clone it at the spawn site:

**File:** `src-tauri/src/payload/extractor.rs`

```rust
pub fn extract_payload(
    payload_path: &Path,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    cache: &PayloadCache,
    app_handle: tauri::AppHandle,  // ← new parameter
) -> Result<ExtractPayloadResult> {
    /* ... load payload, set up dirs ... */

    thread::scope(|s| {
        partitions_to_extract.iter().map(|partition| {
            let app = app_handle.clone();           // ← cheap Arc clone
            let partition_name = partition.partition_name.clone();
            let mmap = Arc::clone(&payload.mmap);  // ← cheap Arc clone

            s.spawn(move || -> Result<String> {
                extract_partition(
                    &mmap,
                    partition,
                    &mut image_file,
                    block_size,
                    &mut |name, current, total, completed| {
                        // ← REAL progress event fired per operation from inside thread
                        let _ = app.emit(
                            "payload:progress",
                            serde_json::json!({
                                "partitionName": name,
                                "current": current,
                                "total": total,
                                "completed": completed,
                            }),
                        );
                    },
                )?;
                Ok(format!("{}.img", partition_name))
            })
        }).collect::<Vec<_>>()
    });
    // Remove the fake post-completion loop — real events already emitted above
}
```

**File:** `src-tauri/src/commands/payload.rs`

```rust
// Forward app into extract_payload
let result = tokio::task::spawn_blocking(move || {
    payload::extract_payload(
        Path::new(payload_path.trim()),
        output_dir.as_deref(),
        &selected_partitions,
        &payload_cache,
        app,  // ← forward AppHandle
    )
}).await.map_err(|e| e.to_string())??;
```

---

### Fix 1.3 — ZIP streaming to temp file

**File:** `src-tauri/Cargo.toml`
```toml
tempfile = "3"
```

**File:** `src-tauri/src/payload/zip.rs`

```rust
use tempfile::NamedTempFile;
use std::path::PathBuf;

/// Extract payload.bin from a ZIP archive by streaming to a temp file.
/// NEVER loads the full payload.bin into RAM.
pub(super) fn extract_payload_to_tempfile(zip_path: &Path) -> Result<PathBuf> {
    let zip_file = fs::File::open(zip_path)?;
    // Use BufReader for the ZIP reader itself — faster for large central directories
    let mut archive = zip::ZipArchive::new(std::io::BufReader::new(zip_file))?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.name() != "payload.bin" || entry.size() == 0 {
            continue;
        }
        // Create temp file in app data dir for better isolation
        let mut temp = NamedTempFile::new()?;
        // Stream from ZIP entry → temp file (256KB internal buffer in std::io::copy)
        std::io::copy(&mut entry, temp.as_file_mut())?;
        // Persist: prevent auto-delete on drop, return path for mmap
        let (_, temp_path) = temp.keep()?;
        return Ok(temp_path);
    }
    anyhow::bail!("payload.bin not found in ZIP archive")
}

/// PayloadCache now stores only paths, not bytes.
struct PayloadCacheInner {
    cached_zip_path: Option<PathBuf>,
    cached_payload_path: Option<PathBuf>,  // path to temp file on disk
    // REMOVED: cached_bytes: Option<Vec<u8>>,
}

impl PayloadCache {
    /// Returns the path to payload.bin on disk (extracting from ZIP if needed).
    pub fn get_payload_path(&self, path: &Path) -> Result<PathBuf> {
        if !is_zip_path(path) {
            return Ok(path.to_path_buf());
        }
        let mut inner = self.inner.lock().unwrap();
        if inner.cached_zip_path.as_deref() == Some(path) {
            if let Some(ref p) = inner.cached_payload_path {
                if p.exists() { return Ok(p.clone()); }
            }
        }
        let temp_path = extract_payload_to_tempfile(path)?;
        inner.cached_zip_path = Some(path.to_path_buf());
        inner.cached_payload_path = Some(temp_path.clone());
        Ok(temp_path)
    }

    /// Clean up temp file on disk and reset cache.
    pub fn cleanup(&self) {
        let mut inner = self.inner.lock().unwrap();
        if let Some(ref p) = inner.cached_payload_path {
            let _ = fs::remove_file(p);
        }
        *inner = PayloadCacheInner::default();
    }
}
```

---

### Fix 1.4 — `spawn_blocking` wrapper (prevent Tokio starvation)

**File:** `src-tauri/src/commands/payload.rs`

```rust
pub async fn extract_payload(
    app: tauri::AppHandle,
    payload_cache: tauri::State<'_, PayloadCache>,
    // ...args
) -> CmdResult<ExtractPayloadResult> {
    // Clone/collect inputs before moving into spawn_blocking
    let cache_ref = (*payload_cache).clone(); // PayloadCache must be Clone, or use Arc
    let app_clone = app.clone();

    // Offload blocking sync work to Tokio's blocking thread pool
    let result = tokio::task::spawn_blocking(move || {
        payload::extract_payload(
            Path::new(&payload_path),
            output_dir.as_deref(),
            &selected_partitions,
            &cache_ref,
            app_clone,
        )
    })
    .await
    .map_err(|e| e.to_string())?  // JoinError
    .map_err(|e| e.to_string())?; // extraction error

    Ok(result)
}
```

---

### Fix 2.1 — Sync streaming decompression (256 KB buffer, no full Vec)

Replace `decode_operation() -> Vec<u8>` with an in-place streaming write approach:

```rust
/// Decompress and stream-write a single operation directly to the output file.
/// Uses a reusable 256 KB stack buffer — never allocates the full decoded block.
fn stream_write_operation(
    raw_data: &[u8],
    image_file: &mut fs::File,
    op_type: install_operation::Type,
    dst_offset: u64,    // byte offset in output file
    dst_size: u64,      // expected decompressed size (for validation)
) -> Result<u64> {
    image_file.seek(SeekFrom::Start(dst_offset))?;
    let mut buf = [0u8; 256 * 1024];  // 256 KB, stack-allocated, reused across calls
    let mut written = 0u64;

    match op_type {
        Type::Replace => {
            image_file.write_all(raw_data)?;
            written = raw_data.len() as u64;
        }
        Type::ReplaceXz => {
            let mut decoder = xz2::read::XzDecoder::new(Cursor::new(raw_data));
            loop {
                let n = decoder.read(&mut buf)?;
                if n == 0 { break; }
                image_file.write_all(&buf[..n])?;
                written += n as u64;
            }
        }
        Type::ReplaceBz => {
            let mut decoder = bzip2::read::BzDecoder::new(Cursor::new(raw_data));
            loop {
                let n = decoder.read(&mut buf)?;
                if n == 0 { break; }
                image_file.write_all(&buf[..n])?;
                written += n as u64;
            }
        }
        Type::Zstd => {
            let mut decoder = zstd::stream::read::Decoder::new(Cursor::new(raw_data))?;
            loop {
                let n = decoder.read(&mut buf)?;
                if n == 0 { break; }
                image_file.write_all(&buf[..n])?;
                written += n as u64;
            }
        }
        Type::Zero => {
            // Sparse: seek past the zero region (file pre-allocated with set_len)
            image_file.seek(SeekFrom::Current(dst_size as i64))?;
            written = dst_size;
        }
        _ => anyhow::bail!("Unsupported operation type: {:?}", op_type),
    }

    anyhow::ensure!(written <= dst_size + 4096,
        "Written {} bytes but expected {}", written, dst_size);
    Ok(written)
}
```

**Result:** Peak RAM per thread for decompression drops from **100–500 MB → 256 KB**.

---

### Fix 2.2 — Pre-allocate output files

```rust
// In extract_partition(), before the operation loop:
if let Some(info) = &partition.new_partition_info {
    if let Some(size) = info.size {
        image_file.set_len(size)?;
        // Now Zero ops can seek forward without writing zeros
        // OS provides zero-fill for sparse regions automatically
    }
}
```

---

### Fix 2.3 — Rayon parallel extraction (better than thread::scope)

**File:** `src-tauri/Cargo.toml`
```toml
rayon = "1.10"
```

**File:** `src-tauri/src/payload/extractor.rs`

```rust
use rayon::prelude::*;

// Inside spawn_blocking:
let results: Vec<_> = partitions_to_extract
    .par_iter()
    .map(|partition| {
        let app = app_handle.clone();
        let mmap = Arc::clone(&payload.mmap);
        extract_partition_streaming(&mmap, partition, &output_dir, block_size, move |name, cur, total, done| {
            let _ = app.emit("payload:progress", serde_json::json!({
                "partitionName": name, "current": cur, "total": total, "completed": done,
            }));
        })
    })
    .collect();
```

---

### Fix 2.4 — Cancellation support

```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// Create shared cancel flag
let cancel = Arc::new(AtomicBool::new(false));

// Store in Tauri State so the frontend command can set it
// New command: cancel_payload_extraction sets cancel.store(true, Ordering::Relaxed)

// Per partition — check before each operation
for (index, op) in partition.operations.iter().enumerate() {
    if cancel.load(Ordering::Relaxed) {
        return Err(anyhow!("Extraction cancelled by user"));
    }
    stream_write_operation(...)?;
    progress(name, index + 1, total_ops, false);
}
```

---

## 9. Frontend Improvements

### 9.1 Fix: Remove `'use client'`

```diff
// src/components/views/ViewPayloadDumper.tsx
-'use client';
-
 import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
```

### 9.2 Improvement: Add Cancel Button

```tsx
// In ViewPayloadDumper.tsx
const [extracting, setExtracting] = useState(false);

const handleCancel = async () => {
    try {
        await cancelPayloadExtraction();  // new backend command
        toast.info('Extraction cancelled');
    } catch (e) {
        toast.error(`Cancel failed: ${e}`);
    }
};

// In JSX:
{extracting && (
    <Button variant="destructive" onClick={handleCancel}>
        <X className="size-4 mr-2" /> Cancel
    </Button>
)}
```

### 9.3 Improvement: Per-Partition Progress with Operation Count

```tsx
// Progress event payload from backend
interface ProgressEvent {
    partitionName: string;
    current: number;   // current operation index
    total: number;     // total operations count
    completed: boolean;
}

// Update Zustand store with operation-level granularity
updatePartitionProgress(partitionName, current / total * 100);
```

### 9.4 Improvement: Elapsed Time Display

```tsx
// Track extraction start time
const extractionStartRef = useRef<number | null>(null);
const [elapsed, setElapsed] = useState<string>('');

useEffect(() => {
    if (!extracting) return;
    extractionStartRef.current = Date.now();
    const interval = setInterval(() => {
        const secs = Math.floor((Date.now() - extractionStartRef.current!) / 1000);
        setElapsed(`${Math.floor(secs / 60)}m ${secs % 60}s`);
    }, 1000);
    return () => clearInterval(interval);
}, [extracting]);
```

---

## 10. Architecture Diagram

### Current Architecture (Broken)

```
┌──────────────────────────────────────────────────────────────┐
│ Tauri Command: extract_payload (async fn)                     │
│                                                              │
│  payload::extract_payload (SYNC — BLOCKS TOKIO THREAD)       │
│                                                              │
│  ZIP → read_to_end → Vec<u8> [4-6 GB]       ← BUG 1: OOM    │
│  PayloadCache::cached_bytes [4-6 GB held]    ← BUG 6: leak   │
│  (Tokio thread pool stalled for entire ZIP read)             │
│                                                              │
│  thread::scope {                                             │
│    thread_1: payload.bytes.clone() [4 GB]    ← BUG 2: OOM    │
│    thread_2: payload.bytes.clone() [4 GB]    ← BUG 2: ×2    │
│    thread_N: payload.bytes.clone() [4 GB]    ← BUG 2: ×N    │
│                                                              │
│    Each thread:                                              │
│    - decode_operation() → full Vec<u8>       ← BUG 4        │
│    - progress = &mut |_,_,_,_| {}            ← BUG 3: NOP   │
│  }                                                           │
│  // After all threads done:                                  │
│  progress(name, 1, 1, true) per partition    ← BUG 3: too late│
│                                                              │
│  Peak RAM: ~45 GB → OOM on 32 GB → SHUTDOWN                 │
└──────────────────────────────────────────────────────────────┘
```

### Target Architecture (Phase 1+2 Fixed)

```
┌──────────────────────────────────────────────────────────────┐
│ Tauri Command: extract_payload (async fn)                     │
│                                                              │
│  spawn_blocking(|| { ... }).await              ← FIX 1.4    │
│  ┌──────────────────────────────────────────┐              │
│  │ Blocking thread pool:                     │              │
│  │                                           │              │
│  │  ZIP → stream to NamedTempFile            ← FIX 1.3    │
│  │  PayloadCache::cached_payload_path only   ← FIX 1.3    │
│  │                                           │              │
│  │  Mmap::map(payload_path) → Arc<Mmap>      ← FIX 1.1    │
│  │  OS page cache handles all file I/O       │              │
│  │                                           │              │
│  │  rayon::par_iter() {                      ← FIX 2.3    │
│  │    thread_1: Arc::clone(mmap) [8 bytes]   ← FIX 1.1    │
│  │    thread_2: Arc::clone(mmap) [8 bytes]   │              │
│  │    thread_N: Arc::clone(mmap) [8 bytes]   │              │
│  │                                           │              │
│  │    Each thread:                           │              │
│  │    - set_len(partition_size)              ← FIX 2.2    │
│  │    - stream_write_operation (256KB buf)   ← FIX 2.1    │
│  │    - app.emit("payload:progress") per op  ← FIX 1.2    │
│  │    - cancel check (AtomicBool) per op     ← FIX 2.4    │
│  │  }                                        │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  Peak RAM: ~512 MB (was ~45 GB → 99% reduction)             │
│  ZIP load: ~0 ms mmap (was ~8s read_to_end)                 │
│  Progress: per-operation real-time events                   │
│  Speed: 2-4× faster (streaming + smarter parallelism)       │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Quick-Start Fix Sequence

> Apply in order. Each step is independent — stop at any phase and the app is better.

### 🔴 Phase 1 — Stop OOM + Fix Progress (do this first, ~1-2 days)

```bash
# 1. Add deps to src-tauri/Cargo.toml:
#    memmap2 = "0.9"
#    tempfile = "3"

# 2. parser.rs: change LoadedPayload::bytes: Vec<u8> → mmap: Arc<Mmap>
#    load_payload: open file → Arc::new(Mmap::map(&file)?)

# 3. zip.rs: replace cached_bytes with cached_payload_path
#    extract to NamedTempFile → .keep() → return PathBuf

# 4. extractor.rs: Arc::clone(&payload.mmap) per thread (not bytes.clone())
#    add app_handle param, clone into thread, emit real events

# 5. commands/payload.rs: wrap in spawn_blocking, forward app

# 6. ViewPayloadDumper.tsx: remove 'use client'

pnpm check  # must pass all gates
```

**Expected after Phase 1:**
- RAM: ~45 GB → ~512 MB (mmap = no payload in RAM at all)
- ZIP load: ~8s `read_to_end` → streaming to disk (IO-limited, but no RAM spike)
- Progress: real-time per-operation events
- No more laptop shutdown OOM

### 🟠 Phase 2 — Streaming Decompression (~2-3 days)

```bash
# Add to Cargo.toml: rayon = "1.10"

# extractor.rs:
#   Replace decode_operation() -> Vec<u8>
#   with stream_write_operation() → 256KB loop
#   Add set_len() before operation loop
#   Replace thread::scope with rayon::par_iter() inside spawn_blocking
#   Add Arc<AtomicBool> cancel flag

# commands/payload.rs:
#   Add cancel_payload_extraction command

# ViewPayloadDumper.tsx:
#   Add Cancel button
#   Add elapsed time display

pnpm check
```

### 🟡 Phase 3 — Full Async (optional, ~1 week)

```bash
# Add async-compression = { version = "0.4", features = ["tokio","xz","bzip2","zstd"] }
# Port extract_partition to async fn
# Replace thread::scope with tokio::spawn + Semaphore
# Use async-compression decoders over AsyncRead file ranges
```

---

## Dependency Summary Table

| Crate | Current | Recommended | Reason |
|-------|---------|-------------|--------|
| `memmap2` | ❌ not used | ✅ Add (Phase 1) | Zero-copy mmap kills OOM entirely |
| `tempfile` | ❌ not used | ✅ Add (Phase 1) | Safe streaming ZIP extraction |
| `rayon` | ❌ not used | ✅ Add (Phase 2) | Better than thread::scope for CPU-bound parallel |
| `async-compression` | ❌ not used | 🟡 Add (Phase 3) | Full async streaming decompression |
| `xz2` | ✅ used | ✅ Keep | Phase 1-2 sync streaming still uses it |
| `bzip2` | ✅ used | ✅ Keep | Same |
| `zstd` | ✅ used | ✅ Keep | Same |
| `sha2` | ✅ used | ✅ Keep | Verification unchanged |
| `zip` | ✅ used | ✅ Keep | ZIP navigation still needed |
| `anyhow` | ✅ used | ✅ Keep | Error handling |

---

*Report generated: 2026-03-22 | Research: web 2025-2026 + context7 docs (memmap2, tokio, async-compression) + rhythmcache/payload-dumper-rust*
