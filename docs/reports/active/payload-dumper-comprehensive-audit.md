# Payload Dumper Comprehensive Audit Report

**Date:** May 9, 2026  
**Author:** Agent Task Force (6 Agents)  
**Scope:** Full-stack audit of Payload Dumper feature (frontend, backend, domain logic, external tools)  
**Version:** 1.0

---

## Executive Summary

The Payload Dumper feature is a mature, well-structured Android OTA extraction system with support for CrAU payload.bin files, OnePlus OPS, Oppo OFP formats, and remote URL extraction. The codebase demonstrates strong patterns for memory-efficient extraction using memory-mapped files and streaming decompression. This audit identifies critical issues, medium-priority improvements, and feature enhancement opportunities.

| Category | Total Issues | Critical | Medium | Low/Priority |
|----------|--------------|----------|--------|--------------|
| Frontend | 8 | 1 | 4 | 3 |
| Backend Commands | 4 | 0 | 2 | 2 |
| Domain Logic | 9 | 2 | 5 | 2 |
| External Tools | 12 | - | - | 12 |
| **Total** | **33** | **3** | **11** | **19** |

---

## Part 1: Frontend Audit

### 1.1 Component Architecture

```
src/components/payload-dumper/     (10 files)
├── index.ts                      # Barrel exports
├── PayloadSourceTabs.tsx         # Source selection (local/remote)
├── LoadingState.tsx               # Loading indicator
├── FileBanner.tsx                # File info + actions (memoized)
├── FileBannerDetails.tsx          # Metadata details panel (348 lines)
├── PartitionTable.tsx              # Partition list container
├── PartitionRow.tsx               # Single partition row (memoized)
├── ExtractionProgressBar.tsx     # Progress indicator
├── ActionFooter.tsx              # Extract/Reset buttons
└── ExtractionStatusCard.tsx      # Success/Error display

src/lib/payload-dumper/            (3 files)
├── index.ts                       # Barrel exports
├── usePayloadEvents.ts            # Event subscription (30 lines)
└── usePayloadActions.ts          # Action handlers (406 lines)

src/lib/payloadDumperStore.ts      # Zustand store (267 lines)
```

### 1.2 State Management Analysis

**Persistence Configuration:**
```typescript
// Lines 258-265 in payloadDumperStore.ts
{
  name: 'payload-dumper-storage',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    activeMode: state.activeMode,
    remoteUrl: state.remoteUrl,
    outputPath: state.outputPath,
  }),
}
```

**Issue #1 (Critical): Set Serialization in Zustand**
- **Location:** `payloadDumperStore.ts:92-93, 166-167`
- **Problem:** `Set<string>` is used directly in state for `extractingPartitions` and `completedPartitions`. While Zustand persist works due to array serialization, this is fragile.
- **Impact:** Potential serialization issues on edge cases or during localStorage quota limits.
- **Recommendation:** Convert Sets to arrays before persistence, convert back on hydration.

**Issue #2 (Medium): Race Condition in handlePayloadDrop**
- **Location:** `usePayloadActions.ts:212-226`
- **Problem:** The callback checks `status` at function creation time, not execution time:
```typescript
const handlePayloadDrop = useCallback(
  async (paths: string[]) => {
    if (status === 'extracting' || status === 'loading-partitions') return;
    // ...
  },
  [status, setPayloadPath, loadPartitions],
);
```
- **Impact:** Stale closure could allow double-extraction.
- **Recommendation:** Move status check inside async callback or use refs.

**Issue #3 (Medium): Missing Dependency Array**
- **Location:** `usePayloadActions.ts:204`
- **Problem:** `setRemoteMetadata` is missing from `loadRemotePartitions` dependency array.
- **Recommendation:** Add to dependency array.

**Issue #4 (Low): Inefficient Partition Filtering**
- **Location:** `PartitionTable.tsx:37-42`
- **Problem:** `toExtractCount` and `toExtractSize` iterate partitions twice:
```typescript
const toExtractCount = partitions.filter(
  (p) => p.selected && !completedPartitions.has(p.name),
).length;
const toExtractSize = partitions
  .filter((p) => p.selected && !completedPartitions.has(p.name))
  .reduce((acc, p) => acc + p.size, 0);
```
- **Recommendation:** Combine into single pass.

**Issue #5 (Medium): No URL Check Debouncing**
- **Location:** `usePayloadActions.ts:119-145`
- **Problem:** Users can spam the "Check URL" button without rate limiting.
- **Recommendation:** Add debounce (500ms) or disable button during check.

**Issue #6 (Medium): Fire-and-Forget Metadata**
- **Location:** `usePayloadActions.ts:178-187`
- **Problem:** `GetRemotePayloadMetadata` is called without loading state or error feedback:
```typescript
GetRemotePayloadMetadata(remoteUrl.trim())
  .then((metadata) => { ... })
  .catch((err: unknown) => { ... }); // Silent failure
```
- **Recommendation:** Show loading indicator or add toast on failure.

**Issue #7 (Low): Magic String Array**
- **Location:** `PayloadSourceTabs.tsx:69`
- **Problem:** Accept extensions `['.bin', '.zip', '.ops', '.ofp']` not properly validated.
- **Recommendation:** Use constant, add validation helper.

**Issue #8 (Low): Null Return Edge Case**
- **Location:** `ExtractionStatusCard.tsx:27`
- **Problem:** Returns `null` when `extractedFiles.length === 0` but extraction may have partially succeeded.
- **Recommendation:** Add partial extraction support.

---

## Part 2: Backend Commands Audit

### 2.1 Command Summary

| Command | Location | Feature Flag | Description |
|---------|----------|-------------|-------------|
| `cleanup_payload_cache` | payload.rs:29 | None | Cleans temp files |
| `extract_payload` | payload.rs:54 | None | Extracts local/remote |
| `list_payload_partitions` | payload.rs:134 | None | Lists partition names |
| `list_payload_partitions_with_details` | payload.rs:145 | None | Lists with sizes |
| `get_ops_metadata` | payload.rs:169 | None | OPS/OFP metadata |
| `check_remote_payload` | payload.rs:197 | remote_zip | Verifies HTTP range |
| `get_remote_payload_metadata` | payload.rs:221 | remote_zip | Full remote metadata |
| `list_remote_payload_partitions` | payload.rs:252 | remote_zip | Remote partition list |

### 2.2 Issue #9 (Medium): Code Duplication
- **Location:** `extractor.rs` vs `remote.rs`
- **Problem:** `extract_partition()` logic duplicated in both files. `stream_copy()` appears in both.
- **Recommendation:** Create shared extraction trait/struct.

**Issue #10 (Medium): Feature Flag Isolation**
- **Location:** `remote_zip` feature gates
- **Problem:** Creates divergent code paths, harder testing, user confusion.
- **Recommendation:** Merge remote_zip into default, use runtime flags instead.

**Issue #11 (Low): Error Type Inconsistency**
- **Location:** Commands return `String`, internal uses `anyhow::Result`
- **Problem:** No structured error types for frontend. All errors become generic strings.
- **Recommendation:** Define enum `PayloadError` with variants.

**Issue #12 (Low): Command Documentation**
- **Location:** All command functions
- **Problem:** No doc comments on Tauri commands. Frontend can't discover usage.
- **Recommendation:** Add `#[doc = "..."]` attributes.

---

## Part 3: Domain Logic Audit

### 3.1 Module Architecture

```
src-tauri/src/payload/
├── mod.rs              # Exports + chromeos_update_engine protobuf
├── parser.rs           # CrAU header parsing + protobuf decode
├── extractor.rs        # Streaming decompression + SHA-256
├── zip.rs              # Streaming ZIP extraction + caching
├── http.rs             # HTTP range requests
├── http_zip.rs         # HTTP ZIP EOCD parsing
├── remote.rs           # Remote payload (prefetch + direct)
└── ops/                # OPS/OFP support (9 modules)
    ├── mod.rs          # Shared types
    ├── detect.rs       # Format detection
    ├── crypto.rs      # Encryption (OPS S-box, OFP AES, MTK shuffle)
    ├── ops_parser.rs   # OPS XML parsing
    ├── ofp_qc.rs      # OFP Qualcomm parser
    ├── ofp_mtk.rs     # OFP MediaTek parser
    ├── sparse.rs       # Android sparse un-sparse
    └── extractor.rs    # Unified OPS/OFP extraction
```

### 3.2 Critical Issues

**Issue #13 (Critical): SHA-256 Verification Not Enforced**
- **Location:** `ops/extractor.rs:280-289`
- **Problem:** SHA-256 is computed and logged but never compared:
```rust
if digest != expected {
    tracing::warn!(
        target: "payload",
        "partition {}: verification requested but hash mismatch",
        partition_name
    );
} else {
    tracing::info!(
        target: "payload",
        "partition {}: verification successful",
        partition_name
    );
}
    // ^ No early exit on mismatch!
```
- **Impact:** Partition integrity not verified. Corrupt extractions go undetected.
- **Recommendation:** Add early exit on hash mismatch:
```rust
if digest != expected {
    anyhow::bail!("partition {}: SHA-256 mismatch (expected {}, got {})",
        partition_name, expected, hex::encode(digest));
}
```

**Issue #14 (Critical): ZIP Large File Memory Spike**
- **Location:** `remote.rs:346-353`
- **Problem:** `mmap` of entire ZIP (including non-payload data):
```rust
let zip_data = Mmap::map(&file)?;
let payload_offset = find_payload_in_zip(&zip_data)?;
// mmap of entire file, not just payload region
```
- **Impact:** Multi-GB ZIP causes memory spike.
- **Recommendation:** Only mmap payload region, not full ZIP.

### 3.3 Medium Issues

**Issue #15 (Medium): OPS Decrypt Error Message**
- **Location:** `ops_parser.rs:107-110`
- **Problem:** Generic error doesn't help diagnose:
```rust
"None of the known mbox key variants produced valid XML"
```
- **User Impact:** Can't tell which variant failed or why.
- **Recommendation:** Log each variant attempt and results before final failure.

**Issue #16 (Medium): set_len Silent Failure**
- **Location:** `extractor.rs:186`
- **Problem:** `set_len()` failure ignored:
```rust
let _ = file.set_len(total_size); // Silent ignore
```
- **Impact:** Pre-allocation fails silently, writes may behave incorrectly.
- **Recommendation:** Handle error or log warning.

**Issue #17 (Medium): No Retry on HTTP 206 Partial**
- **Location:** `http.rs:218-231`
- **Problem:** Non-206 status fails hard:
```rust
if status != StatusCode::PARTIAL_CONTENT {
    anyhow::bail!("Server returned {}", status);
}
```
- **Impact:** Single failed range causes full extraction failure.
- **Recommendation:** Retry once or fallback to full download.

**Issue #18 (Medium): Missing Concurrent Download Limit**
- **Location:** `remote.rs:302-324`
- **Problem:** Downloads 1MB chunks without concurrency limit.
- **Impact:** Could saturate bandwidth on high-latency connections.
- **Recommendation:** Add max concurrent requests (e.g., 4).

**Issue #19 (Medium): Thread Pool Efficiency**
- **Location:** `extractor.rs:156-162`
- **Problem:** `thread::scope` spawns unbounded threads:
```rust
thread::scope(|s| {
    for partition in &partitions {
        s.spawn(|| extract_partition(...));
    }
});
```
- **Impact:** On 100+ partition OTA, could spawn 100 threads.
- **Recommendation:** Use thread pool with bounded parallelism (e.g., `rayon`).

### 3.4 Edge Cases Not Handled

| Edge Case | Location | Current Behavior | Recommendation |
|----------|----------|----------------|----------------|
| Corrupted sparse chunks | sparse.rs:94-99 | Logs warning, skips | Add error or separate output |
| XML > 1MB | ops_parser.rs:62 | Fails hard | Stream parse or warn |
| Non-contiguous ZIP | http_zip.rs:152-153 | Assumes contiguous | Add ZIP64 support |
| Redirect URLs | http.rs:92-94 | No max redirects | Add limit (e.g., 5) |
| Password ZIP | detect.rs:52-55 | Not supported | Add error or detect |
| Delta OTA (SOURCE_COPY) | extractor.rs | Not implemented | Add source handling |

---

## Part 4: External Tools Feature Comparison

### 4.1 Feature Matrix

| Feature | Our Impl | payload-dumper-rust | otaripper | payload-dumper-go |
|---------|---------|-------------------|-----------|---------------|
| Parallel extraction | ✅ | ✅ | ✅ | ✅ |
| Selective partition | ✅ | ✅ | ✅ | ✅ |
| ZIP support | ✅ | ✅ | ✅ | ✅ |
| Remote URL | ✅ | ✅ | ❌ | ❌ |
| Delta OTA | ❌ | Exp. | ❌ | ✅ |
| SHA input verification | ❌ | ❌ | ✅ | ❌ |
| SHA output verification | ⚠️ | ✅ | ✅ | ✅ |
| Output plausibility | ❌ | ❌ | ✅ | ❌ |
| Input validation | ❌ | ❌ | ✅ | ❌ |
| Memory-mapped I/O | ✅ | ❌ | ✅ | ❌ |
| Progress stats | ❌ | ❌ | ✅ | ❌ |
| Metadata export | ❌ | ✅ | ❌ | ❌ |

### 4.2 Enhancement Proposals

#### Proposal 1: Output Verification System
- **Reference:** otaripper
- **Implementation:**
  1. After extraction, verify each partition SHA-256 matches manifest
  2. Plausibility check: detect all-zero or repeat patterns
  3. Auto-cleanup on failure
- **Benefit:** Ensure extraction integrity, detect corrupt sources
- **Complexity:** Medium

#### Proposal 2: Input Validation
- **Reference:** otaripper
- **Implementation:**
  1. Validate payload magic before parsing
  2. Check manifest SHA matches header
  3. Verify expected sizes match operations
- **Benefit:** Fail fast on corrupt files
- **Complexity:** Low

#### Proposal 3: Delta OTA Support
- **Reference:** ota-tool
- **Implementation:**
  1. Add SOURCE_COPY operation handling
  2. Add SOURCE_BSDIFF operation handling
  3. Accept source partition images as input
- **Benefit:** Extract incremental OTAs
- **Complexity:** High

#### Proposal 4: Real-time Statistics
- **Reference:** otaripper
- **Implementation:**
  1. Track per-partition time/throughput
  2. Show ETA based on rate
  3. Log extraction stats at end
- **Benefit:** User confidence, debugging
- **Complexity:** Low

#### Proposal 5: Memory Optimization (Extent Coalescing)
- **Reference:** otaripper
- **Implementation:**
  1. Coalesce adjacent operations
  2. Batch read operations
  3. Reduce syscalls
- **Benefit:** Faster extraction
- **Complexity:** Medium

#### Proposal 6: Graceful Interruption
- **Reference:** otaripper
- **Implementation:**
  1. Handle Ctrl+C at extraction points
  2. Clean up partial files on exit
  3. Resume capability
- **Benefit:** Better UX
- **Complexity:** Medium

---

## Part 5: Issue Summary and Prioritization

### 5.1 Critical (Fix Now)

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| 13 | SHA-256 verification not enforced | ops/extractor.rs:280 | Add early exit on mismatch |
| 14 | ZIP large file memory spike | remote.rs:346 | Mmap only payload region |

### 5.2 High Priority (Next Sprint)

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| 1 | Set serialization fragility | payloadDumperStore.ts | Convert to arrays |
| 2 | Race condition in handlePayloadDrop | usePayloadActions.ts | Move check inside callback |
| 15 | Generic decrypt error | ops_parser.rs:107 | Log variants |
| 16 | set_len silent failure | extractor.rs:186 | Handle error |
| 9 | Code duplication | extractor.rs/remote.rs | Create shared trait |

### 5.3 Medium (Backlog)

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| 3 | Missing dependency array | usePayloadActions.ts:204 | Add setRemoteMetadata |
| 5 | No URL debounce | usePayloadActions.ts | Add debounce |
| 6 | Silent metadata failure | usePayloadActions.ts | Show loading/better error |
| 10 | Feature flag isolation | remote_zip | Merge to default |
| 11 | Error type inconsistency | commands/ | Define PayloadError enum |
| 17 | No HTTP 206 retry | http.rs:218 | Add retry |
| 18 | No concurrency limit | remote.rs:302 | Add limit |
| 19 | Unbounded threads | extractor.rs:156 | Use rayon pool |

### 5.4 Low (Nice to Have)

| ID | Issue | Fix |
|----|------|------|
| 4 | Inefficient partition filtering |
| 7 | Magic string array |
| 8 | Null return edge case |
| 12 | Command documentation |
| Edge Cases | Various edge cases |

---

## Part 6: Before/After Comparison Tables

### 6.1 SHA-256 Verification

| Metric | Before | After |
|--------|--------|-------|
| Hash computation | ✅ Computed | ✅ Computed |
| Hash comparison | ❌ Silent warning | ✅ Early exit on mismatch |
| Corruption detection | ❌ No | ✅ Yes |

### 6.2 Memory Usage (Remote ZIP)

| Metric | Before | After |
|--------|--------|-------|
| ZIP mapping | Full file | Payload region only |
| 4GB ZIP RAM | ~4GB spike | Minimal |
| GC pressure | High | Low |

### 6.3 Extraction Performance

| Metric | Before | After |
|--------|--------|-------|
| Threads | Unbounded | Bounded pool |
| HTTP concurrent | Unlimited | Max 4 |
| Buffer coalescing | No | Yes (extent coalescing) |

---

## Part 7: Pros/Cons Analysis

### 7.1 Current Implementation Strengths

| Feature | Benefit |
|---------|---------|
| Memory-mapped files | Zero-copy, O(1) Arc clones |
| Streaming decompression | 256 KiB buffer, no RAM spikes |
| Parallel extraction | thread::scope utilization |
| Format auto-detection | CrAU, OPS, OFP-QC, OFP-MTK |
| Remote URL support | HTTP range on-demand |
| Sparse support | Android sparse un-sparse |
| Real-time progress | Tauri events per operation |

### 7.2 Current Weaknesses

| Feature | Issue |
|---------|------|
| SHA verification | Not enforced (OPS) |
| Input validation | Minimal |
| Output plausibility | No checks |
| Error messages | Generic, not diagnostic |
| Thread management | Unbounded |
| HTTP handling | No concurrency limit |

---

## Part 8: References and Resources

### 8.1 Documentation Links

| Resource | URL |
|----------|-----|
| payload-dumper-rust | https://github.com/rhythmcache/payload-dumper-rust |
| otaripper | https://github.com/syedinsaf/otaripper |
| AOSP update_engine | https://chromium.googlesource.com/aosp/platform/system/update_engine |
| OFP Decrypt | https://github.com/bkerler/oppo_decrypt |
| sdat2img | https://github.com/xpirt/sdat2img |
| dumpyara | https://github.com/SebaUbuntu/dumpyara |

### 8.2 Internal Documentation

| Document | Location |
|----------|----------|
| OPS/OFP Guide | docs/guides/ops-ofp-firmware-extraction.md |
| Dumper Audit | docs/reports&audits/payload-dumper-optimization-audit.md |
| Memory-bank | memory-bank/progress.md (lines 142-177) |

### 8.3 Key Dependencies

| Crate | Version | Purpose |
|--------|---------|---------|
| prost | 0.14 | Protobuf parsing |
| memmap2 | 0.9 | Memory mapping |
| rayon | 1.10 | Parallelism |
| zip | 8.3.1 | ZIP handling |
| zstd | 0.13 | Zstd decompression |
| xz2 | 0.1 | XZ decompression |
| bzip2 | 0.6 | BZ2 decompression |
| sha2 | 0.10 | SHA-256 |
| aes | 0.8 | AES block cipher |
| cfb-mode | 0.8 | CFB stream mode |
| md-5 | 0.10 | MD5 digest |
| quick-xml | 0.37 | XML parsing |

---

## Appendix A: File Index

### Frontend Files

| File | Lines | Purpose |
|------|-------|---------|
| ViewPayloadDumper.tsx | 191 | Main container |
| payloadDumperStore.ts | 267 | Zustand store |
| usePayloadActions.ts | 406 | Action handlers |
| usePayloadEvents.ts | 30 | Event subscription |
| PayloadSourceTabs.tsx | 108 | Source selection |
| LoadingState.tsx | 42 | Loading display |
| FileBanner.tsx | 208 | File info banner |
| FileBannerDetails.tsx | 348 | Metadata panel |
| PartitionTable.tsx | 107 | Partition list |
| PartitionRow.tsx | 119 | Single row |
| ExtractionProgressBar.tsx | 38 | Progress bar |
| ActionFooter.tsx | 75 | Action buttons |
| ExtractionStatusCard.tsx | 113 | Result display |

### Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| commands/payload.rs | 300 | Tauri commands |
| payload/mod.rs | 50 | Module exports |
| payload/parser.rs | 200 | CrAU parsing |
| payload/extractor.rs | 400 | Extraction logic |
| payload/zip.rs | 150 | ZIP handling |
| payload/http.rs | 250 | HTTP client |
| payload/http_zip.rs | 200 | ZIP parsing |
| payload/remote.rs | 700 | Remote extraction |
| payload/ops/mod.rs | 50 | OPS types |
| payload/ops/detect.rs | 100 | Format detection |
| payload/ops/crypto.rs | 550 | Encryption |
| payload/ops/ops_parser.rs | 150 | OPS parsing |
| payload/ops/ofp_qc.rs | 150 | OFP-QC parsing |
| payload/ops/ofp_mtk.rs | 150 | OFP-MTK parsing |
| payload/ops/sparse.rs | 120 | Sparse handling |
| payload/ops/extractor.rs | 300 | OPS extraction |

---

## Appendix B: Test Coverage

### Existing Tests

| Module | Tests | Coverage |
|--------|-------|---------|
| payload/tests.rs | 13 | Local + HTTP ZIP |
| ops/crypto.rs | Unit | Cipher primitives |
| ops/test_ops_decrypt.rs | Unit | OPS decryption |

### Gaps

| Module | Missing Tests |
|--------|-------------|
| Remote extraction | Integration tests |
| OPS/OFP parsing | Integration tests |
| Error handling paths | Tests for edge cases |

---

## Appendix C: Action Items

### Immediate (This Sprint)

- [ ] Fix Critical #13: Add SHA-256 enforcement
- [ ] Fix Critical #14: Limit ZIP memory mapping

### Next Sprint

- [ ] Fix Issue #1: Set serialization
- [ ] Fix Issue #2: Race condition
- [ ] Fix Issue #15: Decrypt error message

### Backlog

- [ ] Implement Proposal 1: Output verification
- [ ] Implement Proposal 2: Input validation
- [ ] Implement Proposal 4: Real-time statistics

---

**End of Report**

*Generated by 6-agent task force for comprehensive payload dumper audit*