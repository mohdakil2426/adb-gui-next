# Payload Dumper — Before/After Impact, Performance & Library Recommendations

**Date:** 2026-07-17  
**Status:** Active decision input for implementation  
**Sources:** Architecture plan, remote matrix, reference comparison, Cargo profile audit, subagent library research  
**Related:**

- `docs/reports/active/PAYLOAD-DUMPER-FOLDER-ARCHITECTURE-2026-07-17.md`
- `docs/reports/active/PAYLOAD-DUMPER-REMOTE-URL-SUPPORT-MATRIX-2026-07-17.md`
- `docs/reports/active/PAYLOAD-DUMPER-REFERENCE-COMPARISON-2026-07-17.md`
- `docs/superpowers/plans/2026-07-17-payload-dumper-architecture-and-upgrades.md`

---

## 1. Product / UX — Before → After (full plan)

| Area | Before | After | Impact |
|------|--------|-------|--------|
| Remote load partitions | Cancel-only bar; feels hung | In-panel stages + elapsed + “not full X GB” | Perceived reliability ↑↑ |
| Extract cancel | Can stick on long ranges | Cooperative + harder abort | User control ↑ |
| Integrity | L4 dead; remote hash risk | L2 + L4 wired; fail-hard decompress | Flash safety ↑↑ |
| Multi-extent ops | Incomplete-image risk | All extents written | Correctness ↑ |
| Remote bandwidth | Prefetch can pull whole ZIP | Span / selective ranges | Bytes ↓↓ |
| Local ZIP STORED | Temp extract | Zero-copy window | Disk I/O ↓ |
| Code layout | Flat dual engines | `crau/ remote/ zip/ verify/ io/` | Maintainability ↑↑ |
| OPS extract | Weak cancel / BufWriter | Cancel + shared write path | Vendor UX ↑ |

---

## 2. Performance — Before → After

| Workload | Before | After (expected) | Primary levers |
|----------|--------|------------------|----------------|
| Local multi-partition OTA (SSD) | ~1–2 GB/s class | Toward top Rust dumpers if speed profile + pools | `opt-level=3`, buffers, ZIP mmap, write path |
| Local STORED ZIP | Temp file tax | Faster open | `zip/stored_window` |
| Remote list multi‑GB | Network + black box | Same RTT, feels faster | load-progress events |
| Remote multi-partition | Over-download risk | Much less data | span prefetch |
| Factory selective | Already selective | Similar + cache | HTTP/ZIP cache |
| L4 verify ON | N/A | Extra full-file hash pass | Correctness tax (−5–15% possible) |

### By plan wave

| Wave | Runtime speed | Notes |
|------|---------------|--------|
| 0 Structure | ~0% | Layout only |
| 1 Correctness | 0 to −5–15% if L4 always on | Optional verify toggle recommended |
| 2 Load UX | ~0 extract | Perceived list speed ↑ |
| 3 Prefetch/mmap/pools + build profile | **Largest real wins** | Bandwidth + CPU |
| 4 Polish | ~0 | Notifications / stats |

### Critical build finding

Current `src-tauri/Cargo.toml`:

```toml
[profile.release]
opt-level = "s"  # size-optimized — can silently slow sha2 soft paths and decomp loops
```

| Profile | Effect |
|---------|--------|
| `opt-level = "s"` (today) | Smaller binary; **hurts** CPU-bound extract |
| `opt-level = 3` or `release-fast` | Peak extract speed (often **larger free win than new crates**) |

---

## 3. Rust crates

### Keep

| Crate | Role | Fit |
|-------|------|-----|
| memmap2 | Zero-copy maps | High |
| rayon | Partition parallel | High |
| xz2 → migrate **liblzma** | ReplaceXz | High |
| zstd, bzip2 | Codecs | High |
| sha2 0.11 | AOSP SHA-256 (SHA-NI) | High — **not** BLAKE3 |
| reqwest + rustls + http2 | Ranges | High |
| tokio, prost, flate2 | Stack | High |

### Add / change (ranked)

| Rank | Item | Expected win | Risk | Fit |
|:----:|------|--------------|------|-----|
| 1 | **`opt-level = 3`** / `release-fast` profile | Largest CPU win | Bigger binary | **Highest** |
| 2 | **flate2 `zlib-rs`** feature | ~1.5–2× ZIP/factory deflate | Low | High |
| 3 | **liblzma** (xz2-compatible) | Maintained XZ path | Avoid dual link | High |
| 4 | **bytes** on HTTP ranges | Less realloc on chunks | Low | High (remote) |
| 5 | **mimalloc** (measure on Windows) | 5–20% alloc-heavy parallel | Native dep | Med |
| 6 | **wiremock** (dev) | Offline remote tests | Dev only | High process |
| 7 | crossbeam-channel (optional) | Decouple progress emit | Med design | Med |

### Avoid

| Don’t | Why |
|-------|-----|
| blake3 for protocol verify | Must remain SHA-256 |
| pure Rust lzma-rs / ruzstd default | Slower / incomplete vs C |
| ureq rewrite of remote | Lose investment |
| tokio-uring as default | Linux-only |
| Random SIMD copy crates without benches | Already have AVX path |

---

## 4. Tauri v2 plugins

| Plugin | Extract GB/s? | Benefit | Recommendation |
|--------|---------------|---------|----------------|
| dialog / log / opener / clipboard | No | Already correct | **Keep** |
| **notification** | No | Done/fail after long jobs | **Add (UX)** |
| **single-instance** | No | Prevent dual extract fight | **Add (reliability)** |
| store / window-state | No | Workflow polish | Optional Med |
| **plugin-fs / plugin-http for dump I/O** | **Negative** | IPC bulk path slow | **Never for multi‑GB dump** |

**Rule:** All heavy extract stays in Rust domain; FE only small events.

---

## 5. Net summary

| Dimension | After full plan + top libs |
|-----------|----------------------------|
| Local speed | ↑↑ with speed profile + Wave 3 |
| Remote efficiency | ↑↑ bandwidth; wall time network-bound |
| Correctness | Major ↑ |
| UX | Load/cancel no longer “stuck” |
| New plugins for speed | Almost none |
| Highest free win | **`opt-level = "s"` → speed profile** |

---

## 6. Implementation ordering reminder

1. Wave 0 structure (behavior-preserving)  
2. Wave 1 correctness  
3. Wave 2 load UX  
4. Wave 3 perf (include release-fast + zlib-rs + liblzma + bytes)  
5. Wave 4 polish (notification / single-instance optional)

**Execution policy (user):** plan implementation work **must not** create git commits unless the human later requests them.
