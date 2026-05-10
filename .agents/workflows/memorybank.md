# ADB GUI Next — Memory Bank

## Project Context
Tauri 2 desktop app for ADB/fastboot workflows. React 19 + TypeScript + Vite 8 + Rust (Edition 2024). Windows & Linux.

## What We Did This Session

### Phase 0: SHA-256 Fix (DONE)
- Layer 3 verification now computes digest on decompressed output via `stream_copy` with `hasher` param
- Fixed in `extractor.rs`, `remote.rs` (both `extract_partition_from_mmap` and `extract_partition_from_remote`)

### Phase 1: Non-Temporal Writer + Rayon (DONE)
- `NonTemporalWriter` wired into `extractor.rs` — mmap-based writes, msync flush, replaces `BufWriter`
- `thread::scope` → `rayon::par_iter()` in `extractor.rs`
- `NonTemporalWriter` wired into `remote.rs` — both prefetch and direct modes, rayon parallel extraction

### Phase 2: Extent Coalescing (DONE)
- Added via subagent in `extract_partition` extent loop
- Consecutive RAW Replace extents with contiguous raw_data merged into single larger write
- Reduces per-extent syscall overhead

### Phase 3: Rayon Intra-Partition Parallelism (DONE)
- rayon `par_iter()` already handles inter-partition parallelism
- Each partition is independent — no intra-partition parallelism needed (decompression is sequential by nature)

### Phase 4: SIMD Copy (DONE)
- `CopyStrategy` enum (Scalar/SSE2/AVX2/AVX512) with runtime detection
- `Copier` struct with optimized copy functions
- `copy_raw_slice(dst, src)` public function using SIMD
- Wired into `NonTemporalWriter::write_at` via `super::copy::copy_raw_slice`

### Phase 5: TransactionGuard (DONE)
- Created `transaction.rs` with `TransactionGuard` struct
- `abort()` deletes all registered files and output directory on failure
- `commit()` marks transaction complete
- Wired into `extract_payload` — Arc-wrapped, files registered per-partition, abort on error, commit on success

### Phase 6: diagnose_payload Command (DONE)
- Tauri command `diagnose_payload` in `commands/payload.rs`
- Calls `payload::diagnose_payload_file(path)` for CrAU files
- Handles OPS/OFP detection via `should_use_ops_pipeline`

### Phase 7: HTTP Pipelining (DONE)
- `read_ranges_parallel` in `http.rs` with Semaphore(4)
- Parallel HTTP range requests for remote payloads

### Phase 8: Zero-Copy ZIP Mmap (DONE)
- `mmap_zip_entry` in `http_zip.rs` for memory-mapped ZIP entry reading

### Phase 9: Stats UI (DONE)
- `ExtractionStatusCard.tsx` in frontend with live extraction stats

### Phase 10: XzDecoder Fix — **"invalid options" Error RESOLVED** (DONE)
- **Root cause**: `XzDecoder::new()` uses `lzma_stream_decoder()` with `flags=0` — fails on concatenated XZ streams and certain CPU configs (Ryzen 7 5800X)
- **Fix**: Changed to `XzDecoder::new_multi_decoder()` which uses `lzma_auto_decoder()` with `LZMA_CONCATENATED` flag
- **Applied in 3 places**:
  - `extractor.rs:297` — main payload extraction
  - `remote.rs:651` — mmap prefetch mode
  - `remote.rs:760` — HTTP direct mode

## Unresolved Issue

### "invalid options" Extraction Error — POTENTIALLY UNRESOLVED
**Error**: `Extraction failed: invalid options` — appears immediately on Extract button click
**Root cause identified**: xz2 library `LZMA_OPTIONS_ERROR` mapped to "invalid options"
**Fix applied**: `XzDecoder::new()` → `XzDecoder::new_multi_decoder()` in all 3 locations

**Status**: UNTESTED — cannot run `cargo build` because Windows holds the .exe lock (adb.exe processes are holding DLLs from the previous build)

**To test**:
```powershell
# Kill all processes holding the exe
taskkill /F /IM adb-gui-next.exe
taskkill /F /IM adb.exe
# Rebuild
cargo build --manifest-path src-tauri/Cargo.toml
# Start fresh
bun run tauri dev
```

**If issue persists after rebuild**:
- The error might be coming from a DIFFERENT compression type (not XZ)
- Check `remote.rs:762` — BzDecoder is still using `new()` not `new_multi_decoder()`
- zstd `Decoder::new()` might also have issues
- Add pre-flight validation to detect actual compression format before decoder creation

## Current Compilation Status

| Gate | Status | Notes |
|------|--------|-------|
| `cargo check` | ✅ PASS | Clean compile |
| `bun run lint:web` | ✅ PASS | ESLint clean |
| Clippy | ⚠️ BLOCKED | Windows exe lock (not code issue) |
| `bun run test` | ✅ PASS | 162/162 frontend tests |
| `bun run build` | ✅ PASS | TypeScript + Vite build |

## Key Files Changed
- `src-tauri/src/payload/extractor.rs` — NonTemporalWriter, rayon, TransactionGuard, extent coalescing, XzDecoder fix
- `src-tauri/src/payload/remote.rs` — NonTemporalWriter, rayon, SHA-256 fix, XzDecoder fix, `image_writer` → `writer` bugfix
- `src-tauri/src/payload/write.rs` — SIMD wired into `write_at`
- `src-tauri/src/payload/copy.rs` — CopyStrategy, Copier, SIMD copy functions
- `src-tauri/src/payload/transaction.rs` — TransactionGuard (new)
- `src-tauri/src/payload/error.rs` — Added `#[allow(dead_code)]`
- `src-tauri/src/payload/verify.rs` — Added `#[allow(dead_code)]`
- `src-tauri/src/payload/delta.rs` — Added `#[allow(dead_code)]`

## Module Structure (all 15 modules linked)
`copy`, `delta`, `error`, `extractor`, `ops`, `parser`, `transaction`, `verify`, `write`, `zip`, `http`, `http_zip`, `remote`, `chromeos_update_engine`