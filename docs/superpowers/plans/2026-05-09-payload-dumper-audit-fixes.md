# Payload Dumper Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 33 issues and implement all 6 enhancement proposals from the Payload Dumper Comprehensive Audit (dated May 9, 2026).

**Architecture:** 7-phase priority-first approach. Each phase is independently shippable. Critical bugs (SHA-256 stub, mmap spike) are fixed first, then high-priority bugs, then cross-cutting foundation work (error types, thread pool), then medium/low bugs, then enhancements, then Delta OTA.

**Tech Stack:** Rust (Tauri 2), TypeScript/React 19, Zustand 5, TanStack Query 5.

---

## Phase 1: Critical Fixes

### Task 1: Implement SHA-256 Verification in OPS Extractor

**Files:**
- Modify: `src-tauri/src/payload/ops/extractor.rs:280-290`

- [ ] **Step 1: Read the current SHA-256 stub code**

```rust
// Current code at ops/extractor.rs:280-290 (stub - never computes hash):
// SHA-256 verification (if hash provided)
if !partition.sha256.is_empty() {
    writer.flush()?;
    // Re-read what we just wrote for verification
    // (In production, we'd compute the hash during writing)
    log::info!(
        "Partition '{}': SHA-256 verification requested (hash: {}...)",
        partition.name,
        &partition.sha256[..8.min(partition.sha256.len())]
    );
}
```

- [ ] **Step 2: Replace the stub with actual hash computation**

Replace lines 280-290 with:

```rust
// SHA-256 verification (if hash provided)
if !partition.sha256.is_empty() {
    writer.flush()?;
    let mut hasher = Sha256::new();
    let mut file = std::fs::File::open(&output_path)?;
    std::io::copy(&mut file, &mut hasher)?;
    let digest = hasher.finalize();
    let expected = &partition.sha256[..];
    if digest.as_slice() != expected {
        log::error!(
            target: "payload",
            "partition '{}': SHA-256 MISMATCH — expected {}, got {}",
            partition.name,
            hex::encode(expected),
            hex::encode(&digest)
        );
        anyhow::bail!(
            "partition '{}': SHA-256 mismatch (expected {}, got {})",
            partition.name,
            hex::encode(expected),
            hex::encode(&digest)
        );
    }
    log::info!(
        target: "payload",
        "partition '{}': SHA-256 verification successful",
        partition.name
    );
}
```

- [ ] **Step 3: Add required imports**

Verify `use sha2::{Digest, Sha256};` and `use hex;` are present at the top of `ops/extractor.rs`. The `sha2` crate is already imported (line 18 of `extractor.rs`). Add `hex` to Cargo.toml if not present.

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors related to SHA-256 code

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/ops/extractor.rs
git commit -m "fix(payload): enforce SHA-256 verification in OPS extractor

Before: Hash was computed but never compared - stub only logged.
After: Bail with descriptive error on mismatch. Closes Issue #13."
```

---

### Task 2: Fix ZIP Memory Spike — Mmap Only Payload Region

**Files:**
- Modify: `src-tauri/src/payload/remote.rs:340-353`
- Modify: `src-tauri/src/payload/http_zip.rs` (if needed for `find_payload_in_zip`)

- [ ] **Step 1: Read the current mmap code**

```rust
// remote.rs:340-353 — currently maps entire ZIP:
let file = File::open(&temp_path)?;
let mmap = unsafe { Mmap::map(&file)? };
let mmap = Arc::new(mmap);

// For ZIP files, we need to find payload.bin within the mmap
let (manifest_bytes, data_offset) = if is_zip {
    let zip_info = find_payload_in_zip(&reader).await?;
    let payload_start = zip_info.offset as usize;
    let payload_slice = &mmap[payload_start..];
    parse_header(payload_slice)?
} else {
    parse_header(&mmap)?
};
```

- [ ] **Step 2: Replace with payload-region-only mmap**

Replace the mmap block (lines 340-353) with:

```rust
// For ZIP files, find payload offset BEFORE mapping
let payload_offset = if is_zip {
    let zip_info = find_payload_in_zip(&reader).await?;
    zip_info.offset as usize
} else {
    0
};

// Mmap the file (or payload region only for ZIP)
let file = File::open(&temp_path)?;
let file_size = file.metadata()?.len();

// For ZIP: map only from payload_offset to end of file (avoids OOM on 4GB+ ZIPs)
// For direct payload.bin: map entire file (expected < 2GB typically)
let mmap = if payload_offset > 0 {
    // Mmap from payload_offset to end of file
    unsafe {
        let mmap_options = memmap2::MmapOptions::new()
            .offset(payload_offset as u64)
            .len((file_size - payload_offset as u64) as usize)
            .map(&file)?;
        Arc::new(mmap_options)
    }
} else {
    Arc::new(unsafe { Mmap::map(&file)? })
};

let (manifest_bytes, data_offset) = parse_header(&mmap)?;
```

- [ ] **Step 3: Add memmap2 import if needed**

Verify `use memmap2::MmapOptions;` is present. The existing `memmap2::Mmap` import covers `Mmap::map` but `MmapOptions::new()` requires the explicit import.

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/remote.rs
git commit -m "fix(payload): mmap only payload region in ZIP, not entire file

Before: Mmap::map(&file) mapped entire ZIP (could be 4GB+, causing OOM).
After: MmapOptions::new().offset(payload_offset).len(...).map() maps only
the payload region. Closes Issue #14."
```

---

## Phase 2: High-Priority Bugs

### Task 3: Fix Race Condition in handlePayloadDrop and handleExtract

**Files:**
- Modify: `src/lib/payload-dumper/usePayloadActions.ts:212-226, 285-356`

- [ ] **Step 1: Read current handlePayloadDrop and handleExtract code**

```typescript
// usePayloadActions.ts:212-226 — stale closure risk:
const handlePayloadDrop = useCallback(
  async (paths: string[]) => {
    if (status === 'extracting' || status === 'loading-partitions') return;
    // ...
  },
  [status, setPayloadPath, loadPartitions],
);

// usePayloadActions.ts:285-356 — handleExtract has no status guard:
const handleExtract = useCallback(async () => {
  if (!payloadPath) { ... }
  // NO check for status === 'extracting'
  setStatus('extracting');
  // ...
}, [...]);
```

- [ ] **Step 2: Fix handlePayloadDrop — use ref for status check**

Add a ref at the top of `usePayloadActions` (near line 1):

```typescript
const statusRef = useRef(status);
statusRef.current = status;
```

Add `statusRef` to the dependency array of `handlePayloadDrop` (line 225):

```typescript
}, [statusRef, setPayloadPath, loadPartitions]),
```

Update the guard inside `handlePayloadDrop` to use the ref:

```typescript
const handlePayloadDrop = useCallback(
  async (paths: string[]) => {
    if (statusRef.current === 'extracting' || statusRef.current === 'loading-partitions') return;
    // ...
  },
  [statusRef, setPayloadPath, loadPartitions],
);
```

- [ ] **Step 3: Fix handleExtract — add status guard at start**

Add at line 285:

```typescript
const handleExtract = useCallback(async () => {
  if (statusRef.current === 'extracting') {
    toast.error('Extraction already in progress');
    return;
  }
  if (!payloadPath) {
    toast.error('Please select a payload file');
    return;
  }
  // ... rest of existing guard (partitionsToExtract check)
```

- [ ] **Step 4: Verify ESLint passes**

Run: `bun run lint:web 2>&1 | grep -E "(usePayloadActions|error)"`
Expected: No errors related to these changes

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload-dumper/usePayloadActions.ts
git commit -m "fix(frontend): prevent race condition in payload extraction

- Add statusRef to avoid stale closure in handlePayloadDrop
- Add status guard at start of handleExtract
Closes Issue #2."
```

---

### Task 4: Improve OPS Decrypt Error Message

**Files:**
- Modify: `src-tauri/src/payload/ops/ops_parser.rs:90-111`

- [ ] **Step 1: Read current decrypt error code**

```rust
// ops_parser.rs:90-110:
for variant in MboxVariant::ALL {
    if let Some(xml) = try_decrypt_ops_xml(encrypted_xml, variant) {
        // ... success
        return Ok((cleaned, variant));
    }
}

bail!(
    "Failed to decrypt OPS XML manifest. None of the known mbox key variants (mbox4/5/6) \
     produced valid XML. This firmware may use an unsupported key variant."
)
```

- [ ] **Step 2: Log each variant attempt before failing**

Replace the loop and bail with:

```rust
let mut last_error = None;
for variant in MboxVariant::ALL {
    match try_decrypt_ops_xml(encrypted_xml, variant) {
        Some(xml) => {
            let trimmed = if xml.len() > xml_len { &xml[..xml_len] } else { &xml };
            let cleaned = trimmed
                .trim_start_matches('\u{FEFF}')
                .trim_end_matches('\0')
                .trim_end_matches('\u{FFFD}')
                .trim()
                .to_string();
            return Ok((cleaned, variant));
        }
        None => {
            log::debug!(
                target: "payload",
                "mbox variant {:?} did not produce valid XML, trying next",
                variant
            );
            last_error = Some(format!("mbox variant {:?} failed", variant));
        }
    }
}

 anyhow::bail!(
    "Failed to decrypt OPS XML manifest. Tried all mbox key variants (mbox4/5/6); \
     none produced valid XML. Last attempt: {}. This firmware may use an unsupported key variant.",
    last_error.unwrap_or_else(|| "unknown".to_string())
)
```

- [ ] **Step 3: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/ops/ops_parser.rs
git commit -m "fix(payload): log each mbox variant attempt in OPS decrypt

Before: Generic error 'none of the known mbox key variants produced valid XML'.
After: Logs debug message per variant failure, includes last error in bail message.
Closes Issue #15."
```

---

### Task 5: Handle set_len Errors Properly

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs:186`
- Modify: `src-tauri/src/payload/remote.rs:395`

- [ ] **Step 1: Read current set_len calls**

```rust
// extractor.rs:186:
image_writer.get_ref().set_len(info).unwrap_or(()); // Non-fatal: falls back to normal writes

// remote.rs:395:
image_writer.get_ref().set_len(info).unwrap_or(());
```

- [ ] **Step 2: Replace with proper error handling**

Replace `extractor.rs:186` with:

```rust
if let Err(e) = image_writer.get_ref().set_len(info) {
    log::warn!(
        target: "payload",
        "partition {}: set_len({}) failed ({}); file will grow organically during writes",
        partition.partition_name,
        info,
        e
    );
}
```

Replace `remote.rs:395` with the same pattern (partition name comes from `partition_name` variable in scope).

- [ ] **Step 3: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/remote.rs
git commit -m "fix(payload): log warning instead of silently ignoring set_len failures

Before: set_len errors were swallowed with unwrap_or(()).
After: Log warn with partition name and size on failure.
Closes Issue #16."
```

---

### Task 6: Deduplicate stream_copy and extract_partition

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs`
- Modify: `src-tauri/src/payload/remote.rs`

- [ ] **Step 1: Identify duplicated code**

Both `extractor.rs` and `remote.rs` have:
- `stream_copy` function (or equivalent copy loop)
- `extract_partition` logic (data offset computation, operation handling, sparse handling)

- [ ] **Step 2: Extract shared `stream_copy` to a common module**

Create `src-tauri/src/payload/copy.rs`:

```rust
//! Shared I/O utilities for payload extraction.

use std::io::{Read, Write};

/// Copy `len` bytes from `reader` to `writer`, returning bytes written.
pub fn stream_copy<R: Read, W: Write>(reader: &mut R, writer: &mut W, len: usize) -> std::io::Result<u64> {
    let mut remaining = len;
    let mut buf = [0u8; 8192];
    while remaining > 0 {
        let to_read = remaining.min(buf.len());
        let n = reader.read(&mut buf[..to_read])?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n])?;
        remaining -= n;
    }
    Ok((len - remaining) as u64)
}
```

- [ ] **Step 3: Update mod.rs to export the new module**

Add to `src-tauri/src/payload/mod.rs`:

```rust
pub mod copy;
```

- [ ] **Step 4: Update extractor.rs to use the shared module**

Replace local `stream_copy` usage with `super::copy::stream_copy`. If no local `stream_copy` exists in `extractor.rs`, skip this step.

- [ ] **Step 5: Update remote.rs to use the shared module**

Replace any local copy loop with `use super::copy::stream_copy;` and call it.

- [ ] **Step 6: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/payload/copy.rs src-tauri/src/payload/mod.rs
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/remote.rs
git commit -m "refactor(payload): extract shared stream_copy to common module

New file: src-tauri/src/payload/copy.rs
Both extractor.rs and remote.rs now use the shared implementation.
Closes Issue #9."
```

---

## Phase 3: Foundation

### Task 7: Define PayloadError Enum

**Files:**
- Create: `src-tauri/src/payload/error.rs`
- Modify: `src-tauri/src/payload/mod.rs`
- Modify: `src-tauri/src/commands/payload.rs` (update command returns)

- [ ] **Step 1: Create the error enum**

Create `src-tauri/src/payload/error.rs`:

```rust
//! Structured error types for the payload domain.

use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PayloadError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error("Decompression error: {0}")]
    Decompression(String),

    #[error("Hash mismatch: expected {expected}, got {actual}")]
    HashMismatch { expected: String, actual: String },

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("{0}")]
    Other(String),
}

impl From<anyhow::Error> for PayloadError {
    fn from(e: anyhow::Error) -> Self {
        PayloadError::Other(e.to_string())
    }
}
```

- [ ] **Step 2: Add thiserror to Cargo.toml**

Add to `src-tauri/Cargo.toml` dependencies:

```toml
thiserror = "2"
```

- [ ] **Step 3: Export from mod.rs**

Add to `src-tauri/src/payload/mod.rs`:

```rust
pub mod error;
pub use error::PayloadError;
```

- [ ] **Step 4: Update command return types**

In `src-tauri/src/commands/payload.rs`, change `CmdResult<T>` error type from `String` to `PayloadError` for commands that can return structured errors. Note: This requires updating the `CmdResult` type or wrapping `PayloadError` into `String` at the command boundary.

- [ ] **Step 5: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/payload/error.rs src-tauri/src/payload/mod.rs src-tauri/Cargo.toml
git add src-tauri/src/commands/payload.rs
git commit -m "feat(payload): add PayloadError enum with structured variants

New file: src-tauri/src/payload/error.rs
Provides Io, Decompression, HashMismatch, Http, Parse, Crypto variants.
Closes Issue #11."
```

---

### Task 8: Replace thread::scope with rayon

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs:151-226`
- Modify: `src-tauri/src/payload/remote.rs:379-430`

- [ ] **Step 1: Read current thread::scope usage in extractor.rs**

```rust
// extractor.rs:155-226:
let results: Vec<_> = thread::scope(|s| {
    let handles: Vec<_> = partitions_to_extract
        .iter()
        .map(|partition| {
            // ...
            s.spawn(move || -> Result<String> {
                // extraction logic
            })
        })
        .collect();
    handles
        .into_iter()
        .map(|h| h.join().map_err(|e| ...))
        .collect::<Vec<_>>()
});
```

- [ ] **Step 2: Replace with rayon parallel iterator**

Replace the `thread::scope` block with:

```rust
use rayon::prelude::*;

let results: Vec<Result<String>> = partitions_to_extract
    .par_iter()
    .map(|partition| {
        let file_name = format!("{}.img", partition.partition_name);
        let image_path = output_dir.join(&file_name);
        let image_file = std::fs::File::create(&image_path)?;
        let mut image_writer = BufWriter::with_capacity(1024 * 1024, image_file);

        if let Some(info) = partition.new_partition_info.as_ref().and_then(|i| i.size) {
            if let Err(e) = image_writer.get_ref().set_len(info) {
                log::warn!(
                    "partition {}: set_len({}) failed ({})",
                    partition.partition_name,
                    info,
                    e
                );
            }
        }

        let payload_ref = super::parser::LoadedPayload {
            mmap: Arc::clone(&payload.mmap),
            manifest: payload.manifest.clone(),
            data_offset: payload.data_offset,
        };

        extract_partition(
            &payload_ref,
            partition,
            &mut image_writer,
            block_size,
            &mut |name, current, total, completed| {
                if let Some(ref handle) = app {
                    let _ = handle.emit(
                        "payload:progress",
                        serde_json::json!({
                            "partitionName": name,
                            "current": current,
                            "total": total,
                            "completed": completed,
                        }),
                    );
                }
            },
        )?;

        image_writer.flush()?;
        Ok(file_name)
    })
    .collect();
```

- [ ] **Step 3: Remove `thread` import if no longer used**

After the change, `thread` may no longer be needed in `extractor.rs`. Check and remove `use std::thread;` if unused.

- [ ] **Step 4: Apply same pattern to remote.rs**

Replace the `thread::scope` block in `remote.rs` with the same `par_iter()` pattern.

- [ ] **Step 5: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/remote.rs
git commit -m "refactor(payload): use rayon par_iter instead of thread::scope

Before: Unbounded thread::scope spawning one OS thread per partition.
After: rayon::prelude::par_iter with bounded work-stealing pool.
Closes Issue #19."
```

---

### Task 9: Add HTTP Concurrency Limit

**Files:**
- Modify: `src-tauri/src/payload/remote.rs:302-324` (download chunks)
- Modify: `src-tauri/src/payload/http.rs:210-248` (range requests)

- [ ] **Step 1: Read current download loop**

The download loop in `remote.rs:302-324` downloads 1MB chunks without concurrency control.

- [ ] **Step 2: Add Semaphore to limit concurrent requests**

In `remote.rs`, add:

```rust
use tokio::sync::Semaphore;

const MAX_CONCURRENT_DOWNLOADS: usize = 4;
let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_DOWNLOADS));
```

In the download task:

```rust
let _permit = semaphore.acquire().await.expect("semaphore closed");
```

- [ ] **Step 3: Update read_range_sync for retry on non-206**

In `http.rs:218-220`, change:

```rust
if !response.status().is_success() && response.status().as_u16() != 206 {
    return Err(anyhow!("Range request failed: {}", response.status()));
}
```

to:

```rust
if response.status().as_u16() == 416 {
    // Range not satisfiable — file may have changed, retry once without range
    let bytes = response.bytes().map_err(|e| anyhow!("Failed to read response: {}", e))?;
    if bytes.len() as u64 == length {
        return Ok(bytes.to_vec());
    }
}
if response.status().as_u16() != 206 && response.status().is_success() {
    // Server returned 200 instead of 206 — fall back to full read
    let bytes = response.bytes().map_err(|e| anyhow!("Failed to read response: {}", e))?;
    if bytes.len() as u64 >= length {
        return Ok(bytes[..length as usize].to_vec());
    }
}
if response.status().as_u16() != 206 {
    return Err(anyhow!("Range request failed: {}", response.status()));
}
```

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/remote.rs src-tauri/src/payload/http.rs
git commit -m "feat(payload): add concurrency limit and HTTP retry logic

- Add Semaphore(4) to limit concurrent downloads
- Add retry/fallback for non-206 responses (416, 200 fallback)
Closes Issues #17 and #18."
```

---

### Task 10: Merge remote_zip Feature Flag

**Files:**
- Modify: `src-tauri/Cargo.toml` (features section)
- Modify: `src-tauri/src/payload/mod.rs` (remove `#[cfg(feature)]` gates)
- Modify: `src-tauri/src/commands/payload.rs` (remove `#[cfg(feature)]` gates)
- Modify: `src-tauri/capabilities/default.json` (update permissions)

- [ ] **Step 1: Remove remote_zip feature gate from Cargo.toml**

Change `Cargo.toml` features from:

```toml
[features]
default = ["local_zip", "remote_zip"]
local_zip = []
remote_zip = ["dep:futures-util", "dep:flate2"]
```

To:

```toml
[features]
default = ["local_zip"]
local_zip = []
# remote_zip is now always enabled (futures-util and flate2 are always deps)
```

Update `[dependencies]` section to include `futures-util` and `flate2` as regular (non-optional) dependencies.

- [ ] **Step 2: Remove #[cfg(feature = "remote_zip")] from mod.rs**

Remove all `#[cfg(feature = "remote_zip")]` attributes from `src-tauri/src/payload/mod.rs`. The modules should always be compiled.

- [ ] **Step 3: Remove #[cfg(feature = "remote_zip")] from commands/payload.rs**

Remove `#[cfg(feature = "remote_zip")]` from `RemotePayloadInfo` struct and any gated commands. All commands should be always available.

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -50`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/payload/mod.rs src-tauri/src/commands/payload.rs
git commit -m "refactor(payload): merge remote_zip feature into default

Before: remote_zip was a feature flag creating divergent code paths.
After: All remote ZIP code is always compiled. Runtime flags instead of compile-time.
Closes Issue #10."
```

---

## Phase 4: Medium Bugs

### Task 11: Add 500ms Debounce to URL Check Button

**Files:**
- Modify: `src/components/payload-dumper/PayloadSourceTabs.tsx`

- [ ] **Step 1: Read current URL check code**

The URL input has a "Check URL" button at `PayloadSourceTabs.tsx:119-145` with no debounce.

- [ ] **Step 2: Add debounced URL check**

Add a `useCallback` with debounce or use `useDeferredValue` from React. Using `useCallback` + `setTimeout`:

```typescript
const checkUrlRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleCheckUrl = useCallback(() => {
  if (checkUrlRef.current) clearTimeout(checkUrlRef.current);
  checkUrlRef.current = setTimeout(async () => {
    // existing check URL logic
  }, 500);
}, [remoteUrl, setStatus, setRemoteMetadata, addLog]);
```

- [ ] **Step 3: Clean up timeout on unmount**

```typescript
useEffect(() => {
  return () => {
    if (checkUrlRef.current) clearTimeout(checkUrlRef.current);
  };
}, []);
```

- [ ] **Step 4: Run lint**

Run: `bun run lint:web 2>&1 | grep -E "(PayloadSourceTabs|error)"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/payload-dumper/PayloadSourceTabs.tsx
git commit -m "fix(frontend): add 500ms debounce to URL check button

Before: Users could spam Check URL without rate limiting.
After: Debounced setTimeout clears previous request on rapid clicks.
Closes Issue #5."
```

---

### Task 12: Show Loading/Error for Silent Metadata Failure

**Files:**
- Modify: `src/lib/payload-dumper/usePayloadActions.ts:178-187`

- [ ] **Step 1: Read current fire-and-forget metadata call**

```typescript
// usePayloadActions.ts:178-187:
GetRemotePayloadMetadata(remoteUrl.trim())
  .then((metadata) => { ... })
  .catch((err: unknown) => { ... }); // Silent failure
```

- [ ] **Step 2: Add loading indicator and toast on failure**

Wrap the `.catch` to show error:

```typescript
.catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(`Failed to load remote metadata: ${msg}`);
  useLogStore.getState().addLog(`Remote metadata load failed: ${msg}`, 'error');
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/payload-dumper/usePayloadActions.ts
git commit -m "fix(frontend): show toast error on GetRemotePayloadMetadata failure

Before: Silent .catch — user had no feedback on metadata load failure.
After: toast.error() with message on failure.
Closes Issue #6."
```

---

### Task 13: Fix Missing Dependency Array

**Files:**
- Modify: `src/lib/payload-dumper/usePayloadActions.ts:204`

- [ ] **Step 1: Read current dependency array**

```typescript
// usePayloadActions.ts:204:
}, [remoteUrl, setPartitions, setPayloadPath, setStatus, setErrorMessage, setRemoteMetadata]);
```

The dependency array already includes `setRemoteMetadata`. This issue may already be fixed. Verify with:

Run: `bun run lint:web 2>&1 | grep -E "react-hooks"`
Expected: No missing dependency warnings for `loadRemotePartitions`

- [ ] **Step 2: If ESLint still warns, add the missing dependency**

If ESLint reports `setRemoteMetadata` is missing from `loadRemotePartitions` deps, verify it's already in the array (line 204 shows it's present). No change needed if lint passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/payload-dumper/usePayloadActions.ts
git commit -m "fix(frontend): verify setRemoteMetadata in loadRemotePartitions deps

Checked — setRemoteMetadata is already in the dependency array (line 204).
Confirmed Issue #3 is not present or already fixed."
```

---

## Phase 5: Low Polish

### Task 14: Convert Sets to Arrays Defensively

**Files:**
- Modify: `src/lib/payloadDumperStore.ts:92-94, 166-172, 175-195`

- [ ] **Step 1: Read current Set usage**

```typescript
// Initial state:
extractingPartitions: new Set<string>(),
completedPartitions: new Set<string>(),
partitionProgress: new Map<string, PartitionProgress>(),
```

- [ ] **Step 2: Add hydration converters**

In the persist middleware, add `onRehydrateStorage`:

```typescript
{
  name: 'payload-dumper-storage',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    activeMode: state.activeMode,
    remoteUrl: state.remoteUrl,
    outputPath: state.outputPath,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      // Defensive: ensure Sets are always Set instances
      if (!state.extractingPartitions || !(state.extractingPartitions instanceof Set)) {
        state.extractingPartitions = new Set<string>();
      }
      if (!state.completedPartitions || !(state.completedPartitions instanceof Set)) {
        state.completedPartitions = new Set<string>();
      }
      if (!state.partitionProgress || !(state.partitionProgress instanceof Map)) {
        state.partitionProgress = new Map<string, PartitionProgress>();
      }
    }
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/payloadDumperStore.ts
git commit -m "fix(frontend): add defensive Set hydration in payloadDumperStore

Even though Sets are excluded from persistence, add onRehydrateStorage guard
to ensure Set/Map instances are always correct type after hydration.
Closes Issue #1 (downgraded to Low per audit review)."
```

---

### Task 15: Combine Partition Filtering into Single Pass

**Files:**
- Modify: `src/components/payload-dumper/PartitionTable.tsx:37-42`

- [ ] **Step 1: Read current double-iteration code**

```typescript
// PartitionTable.tsx:37-42:
const toExtractCount = partitions.filter(
  (p) => p.selected && !completedPartitions.has(p.name),
).length;
const toExtractSize = partitions
  .filter((p) => p.selected && !completedPartitions.has(p.name))
  .reduce((acc, p) => acc + p.size, 0);
```

- [ ] **Step 2: Replace with single pass using useMemo**

```typescript
const { toExtractCount, toExtractSize } = useMemo(() => {
  let count = 0;
  let size = 0n; // Use bigint for potentially large sums
  for (const p of partitions) {
    if (p.selected && !completedPartitions.has(p.name)) {
      count++;
      size += BigInt(p.size);
    }
  }
  return { toExtractCount: count, toExtractSize: Number(size) };
}, [partitions, completedPartitions]);
```

Or keep number sum if `p.size` fits in number:

```typescript
const { toExtractCount, toExtractSize } = useMemo(() => {
  return partitions.reduce(
    (acc, p) => {
      if (p.selected && !completedPartitions.has(p.name)) {
        return { count: acc.count + 1, size: acc.size + p.size };
      }
      return acc;
    },
    { count: 0, size: 0 }
  );
}, [partitions, completedPartitions]);
```

- [ ] **Step 3: Run lint**

Run: `bun run lint:web 2>&1 | grep -E "(PartitionTable|error)"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/payload-dumper/PartitionTable.tsx
git commit -m "fix(frontend): single-pass partition filtering in PartitionTable

Before: Iterated partitions twice for count and size.
After: Single reduce pass.
Closes Issue #4."
```

---

### Task 16: Extract Magic String Array to Constant

**Files:**
- Modify: `src/components/payload-dumper/PayloadSourceTabs.tsx:69`

- [ ] **Step 1: Read current magic string**

```typescript
// PayloadSourceTabs.tsx:69:
accept: ['.bin', '.zip', '.ops', '.ofp']
```

- [ ] **Step 2: Define constant and use it**

Add at top of file:

```typescript
const ACCEPTED_PAYLOAD_EXTENSIONS = ['.bin', '.zip', '.ops', '.ofp'] as const;
type AcceptedExtension = (typeof ACCEPTED_PAYLOAD_EXTENSIONS)[number];
```

Replace the inline array with the constant.

- [ ] **Step 3: Add validation helper**

```typescript
function isAcceptedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return (ACCEPTED_PAYLOAD_EXTENSIONS as readonly string[]).includes(ext);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/payload-dumper/PayloadSourceTabs.tsx
git commit -m "fix(frontend): extract accepted extensions to named constant

Before: Magic array ['.bin', '.zip', '.ops', '.ofp'] inline.
After: ACCEPTED_PAYLOAD_EXTENSIONS constant with type safety.
Closes Issue #7."
```

---

### Task 17: Handle Partial Extraction in ExtractionStatusCard

**Files:**
- Modify: `src/components/payload-dumper/ExtractionStatusCard.tsx:27`

- [ ] **Step 1: Read current null return**

```typescript
// ExtractionStatusCard.tsx:27:
if (extractedFiles.length === 0) return null;
```

- [ ] **Step 2: Show partial extraction state**

Replace the early return with a render of the partial state:

```typescript
if (extractedFiles.length === 0 && status !== 'success') {
  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">
          No files extracted yet. Select partitions and click Extract.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/ExtractionStatusCard.tsx
git commit -m "fix(frontend): show message for empty extraction state

Before: Returned null when no files, hiding UI even during partial success.
After: Shows informational card.
Closes Issue #8."
```

---

### Task 18: Add Doc Comments to Tauri Commands

**Files:**
- Modify: `src-tauri/src/commands/payload.rs` (all 8 commands)

- [ ] **Step 1: Add #[doc = "..."] to each command**

Example for `extract_payload`:

```rust
#[tauri::command]
#[doc = "Extract selected partitions from a local or remote payload.bin file.\n\
         Returns ExtractPayloadResult with success status, output directory, and list of extracted files.\n\
         # Arguments\n\
         - payload_path: Path to the payload.bin, OPS, or OFP file\n\
         - output_dir: Directory to write extracted partition images\n\
         - selected_partitions: List of partition names to extract (empty = all)\n\
         - prefetch: For remote URLs, whether to download fully before extracting"]
pub async fn extract_payload(...) -> CmdResult<ExtractPayloadResult> { ... }
```

Apply the same pattern to all 8 commands.

- [ ] **Step 2: Run cargo doc**

Run: `cd src-tauri && cargo doc 2>&1 | grep -E "warning|error" | head -20`
Expected: No warnings on command docs

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/payload.rs
git commit -m "docs(payload): add #[doc] attributes to all Tauri commands

Added descriptive doc comments to all 8 payload commands covering:
- What the command does
- Return type description
- Argument descriptions
Closes Issue #12."
```

---

## Phase 6: Enhancement Proposals

### Task 19: Implement Output Verification System

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs` (add post-extraction verify)
- Modify: `src-tauri/src/payload/ops/extractor.rs` (add post-extraction verify)
- New: `src-tauri/src/payload/verify.rs` (shared verification logic)

- [ ] **Step 1: Create verify.rs with SHA-256 and plausibility checks**

Create `src-tauri/src/payload/verify.rs`:

```rust
//! Post-extraction output verification.

use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

/// Verify a partition image against its expected SHA-256 hash.
pub fn verify_sha256(path: &Path, expected: &[u8]) -> Result<bool> {
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(1024 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let digest = hasher.finalize();
    Ok(digest.as_slice() == expected)
}

/// Check if a file is plausibly a valid partition image.
/// Returns false if the file is all zeros or has obvious corruption patterns.
pub fn plausibility_check(path: &Path) -> Result<bool> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut buf = [0u8; 8192];
    let mut first_chunk = true;
    let mut all_zero = true;

    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 { break; }
        if first_chunk {
            all_zero = buf[..n].iter().all(|&b| b == 0);
            first_chunk = false;
        }
        // Check for repeating patterns that suggest corruption
        if n >= 4 {
            for window in buf[..n].windows(4) {
                if window.iter().all(|&b| b == window[0]) && window[0] != 0 {
                    // Repeating non-zero byte pattern — possible corruption
                    return Ok(false);
                }
            }
        }
    }
    Ok(!all_zero)
}
```

- [ ] **Step 2: Export from mod.rs**

Add to `src-tauri/src/payload/mod.rs`:

```rust
pub mod verify;
pub use verify::{verify_sha256, plausibility_check};
```

- [ ] **Step 3: Wire verification into extraction result processing**

After `extract_payload` returns, iterate `extracted_files` and verify each against manifest hashes. If any verification fails, log error and return partial success with warning.

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/verify.rs src-tauri/src/payload/mod.rs
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/ops/extractor.rs
git commit -m "feat(payload): add post-extraction output verification

New file: src-tauri/src/payload/verify.rs
- verify_sha256: Checks partition hash against manifest
- plausibility_check: Detects all-zero or repeating-pattern corruption
Closes Proposal #1."
```

---

### Task 20: Implement Input Validation

**Files:**
- Modify: `src-tauri/src/payload/parser.rs` (add magic validation)
- Modify: `src-tauri/src/payload/ops/detect.rs` (add password ZIP detection)

- [ ] **Step 1: Add payload.bin magic validation**

In `parser.rs`, add at the start of `parse_header`:

```rust
const PAYLOAD_MAGIC: &[u8; 16] = b"CrAU\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";

if data.len() < 16 {
    anyhow::bail!("File too small to be a valid payload ({} bytes)", data.len());
}
if &data[..16] != PAYLOAD_MAGIC {
    anyhow::bail!(
        "Invalid payload magic. Expected CrAU header, got {:02x?}",
        &data[..16]
    );
}
```

- [ ] **Step 2: Add password ZIP detection**

In `detect.rs`, add detection for password-protected ZIPs:

```rust
// In the ZIP detection section:
if let Some(password) = &zip_info.encrypted {
    log::warn!(
        target: "payload",
        "ZIP file '{}' is password-protected (encryption: {:?})",
        path.display(),
        password
    );
    anyhow::bail!("Password-protected ZIP files are not supported. Found encryption indicator in ZIP.");
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/payload/parser.rs src-tauri/src/payload/ops/detect.rs
git commit -m "feat(payload): add input validation at parse time

- Validate CrAU magic bytes before parsing payload header
- Detect and reject password-protected ZIPs
Closes Proposal #2."
```

---

### Task 21: Implement Real-time Statistics

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs` (add timing/progress tracking)
- Modify: `src/lib/payload-dumper/usePayloadEvents.ts` (log stats on complete)

- [ ] **Step 1: Add timing to extraction results**

In `ExtractPayloadResult`, add:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractPayloadResult {
    pub success: bool,
    pub output_dir: String,
    pub extracted_files: Vec<String>,
    pub error: Option<String>,
    pub stats: Option<ExtractionStats>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionStats {
    pub total_bytes: u64,
    pub duration_ms: u64,
    pub partitions_extracted: usize,
    pub throughput_mbps: f64,
}
```

- [ ] **Step 2: Track timing in extractor**

Use `std::time::Instant` at extraction start and end, compute stats on completion.

- [ ] **Step 3: Log stats at end of extraction**

```rust
if let Some(stats) = &result.stats {
    log::info!(
        target: "payload",
        "Extraction complete: {} partitions, {} bytes, {:.2} MB/s, {}ms",
        stats.partitions_extracted,
        stats.total_bytes,
        stats.throughput_mbps,
        stats.duration_ms
    );
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/payload/extractor.rs
git commit -m "feat(payload): add real-time extraction statistics

Added ExtractionStats to ExtractPayloadResult:
- total_bytes, duration_ms, partitions_extracted, throughput_mbps
- Logged at end of extraction
Closes Proposal #4."
```

---

### Task 22: Implement Graceful Interruption

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs` (add interrupt flag)
- Modify: `src-tauri/src/payload/remote.rs` (add interrupt flag)
- New: `src-tauri/src/payload/interrupt.rs` (shared interrupt handling)

- [ ] **Step 1: Create interrupt.rs with atomic flag**

Create `src-tauri/src/payload/interrupt.rs`:

```rust
use std::sync::atomic::{AtomicBool, Ordering};

pub static INTERRUPT_FLAG: AtomicBool = AtomicBool::new(false);

pub fn interrupt() {
    INTERRUPT_FLAG.store(true, Ordering::SeqCst);
}

pub fn is_interrupted() -> bool {
    INTERRUPT_FLAG.load(Ordering::SeqCst)
}

pub fn reset() {
    INTERRUPT_FLAG.store(false, Ordering::SeqCst);
}
```

- [ ] **Step 2: Check interrupt flag in extraction loops**

In the main extraction loop (after each partition), check:

```rust
if is_interrupted() {
    log::warn!("Extraction interrupted by user");
    return Err(anyhow::anyhow!("Extraction cancelled by user"));
}
```

- [ ] **Step 3: Wire up Ctrl+C handler**

In the Tauri command handler (`commands/payload.rs`), register a Ctrl+C handler that calls `interrupt::interrupt()`.

- [ ] **Step 4: Clean up partial files on interrupt**

On interrupt, delete any partially-written `.img` files in the output directory.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/payload/interrupt.rs src-tauri/src/payload/mod.rs
git add src-tauri/src/payload/extractor.rs src-tauri/src/payload/remote.rs
git add src-tauri/src/commands/payload.rs
git commit -m "feat(payload): add graceful interruption support

New file: src-tauri/src/payload/interrupt.rs
- AtomicBool flag checked after each partition extraction
- Ctrl+C handler calls interrupt()
- Partial files cleaned up on cancellation
Closes Proposal #6."
```

---

## Phase 7: Delta OTA Support

### Task 23: Implement Delta OTA Support (SOURCE_COPY + SOURCE_BSDIFF)

**Files:**
- Modify: `src-tauri/src/payload/extractor.rs` (add delta operations)
- Modify: `src-tauri/src/payload/ops/extractor.rs` (add delta operations)
- Create: `src-tauri/src/payload/delta.rs` (new delta operations module)
- Modify: `src-tauri/src/commands/payload.rs` (add `extract_delta_payload` command)
- Modify: `src/lib/desktop/backend.ts` (add `ExtractDeltaPayload` wrapper)
- Modify: `src/lib/desktop/models.ts` (add DeltaPayloadOptions DTO)
- Modify: `src/components/payload-dumper/` (add source image input UI)

- [ ] **Step 1: Add bsdiff dependency**

Add to `src-tauri/Cargo.toml`:

```toml
bsdiff = "0.1"
```

- [ ] **Step 2: Create delta.rs with SOURCE_COPY and SOURCE_BSDIFF**

Create `src-tauri/src/payload/delta.rs`:

```rust
//! Delta OTA operation handlers for SOURCE_COPY and SOURCE_BSDIFF.

use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use anyhow::{Context, Result};

/// Handle a SOURCE_COPY operation — copy bytes from a source partition image.
pub fn source_copy(source_path: &Path, dest_path: &Path, offset: u64, length: u64) -> Result<u64> {
    let mut source = BufReader::new(File::open(source_path)?);
    source.seek(std::io::SeekFrom::Start(offset))?;

    let mut dest = BufWriter::new(File::create(dest_path)?);
    let mut remaining = length;
    let mut buf = [0u8; 65536];

    while remaining > 0 {
        let to_read = (remaining as usize).min(buf.len());
        let n = source.read(&mut buf[..to_read]).context("Failed to read source")?;
        if n == 0 { break; }
        dest.write_all(&buf[..n]).context("Failed to write dest")?;
        remaining -= n as u64;
    }

    dest.flush()?;
    Ok(length - remaining)
}

/// Handle a SOURCE_BSDIFF operation — apply a binary diff patch.
/// Requires the bsdiff crate.
pub fn source_bsdiff(patch_path: &Path, source_path: &Path, dest_path: &Path) -> Result<u64> {
    let patch_data = std::fs::read(patch_path)?;
    let source_data = std::fs::read(source_path)?;

    let mut patch_reader = std::io::Cursor::new(&patch_data);
    let mut output = Vec::new();

    bsdiff::patch(&source_data, &mut patch_reader, &mut output)
        .context("bsdiff patch failed")?;

    std::fs::write(dest_path, &output)?;
    Ok(output.len() as u64)
}
```

- [ ] **Step 3: Export from mod.rs**

Add to `src-tauri/src/payload/mod.rs`:

```rust
pub mod delta;
pub use delta::{source_copy, source_bsdiff};
```

- [ ] **Step 4: Integrate delta operations into extractor**

In `extractor.rs`, find where `install_operations` are processed. Add cases for:

```rust
install_operations::OperationOneof::SourceCopy(op) => {
    // offset and length from op
    let source_image = source_dir.join(format!("{}.img", op.source_partition_id));
    let bytes = delta::source_copy(&source_image, &image_path, op.offset, op.length)?;
    log::info!("SOURCE_COPY: {} bytes from {}", bytes, op.source_partition_id);
}
install_operations::OperationOneof::SourceBsdiff(op) => {
    let patch_data = // read from payload at op.src_offset, op.src_length
    let source_image = source_dir.join(format!("{}.img", op.source_partition_id));
    let bytes = delta::source_bsdiff_from_patch_data(&patch_data, &source_image, &image_path)?;
    log::info!("SOURCE_BSDIFF: {} bytes", bytes);
}
```

- [ ] **Step 5: Add ExtractDeltaPayload Tauri command**

In `src-tauri/src/commands/payload.rs`:

```rust
#[tauri::command]
#[doc = "Extract a delta OTA using source partition images.\n\
         # Arguments\n\
         - payload_path: Path to delta payload.bin\n\
         - output_dir: Directory for extracted images\n\
         - source_dir: Directory containing source partition images\n\
         - selected_partitions: Partitions to extract"]
pub async fn extract_delta_payload(
    app: AppHandle,
    payload_cache: State<'_, PayloadCache>,
    payload_path: String,
    output_dir: String,
    source_dir: String,
    selected_partitions: Vec<String>,
) -> CmdResult<ExtractPayloadResult> {
    // Implementation: load payload, verify it's a delta OTA,
    // use source images from source_dir for SOURCE_COPY/SOURCE_BSDIFF operations
}
```

- [ ] **Step 6: Add TypeScript wrapper and DTOs**

In `src/lib/desktop/backend.ts`:

```typescript
export async function ExtractDeltaPayload(
  payloadPath: string,
  outputDir: string,
  sourceDir: string,
  selectedPartitions: string[],
): Promise<ExtractPayloadResult> {
  return core.invoke('extract_delta_payload', {
    payloadPath,
    outputDir,
    sourceDir,
    selectedPartitions,
  });
}
```

In `src/lib/desktop/models.ts`, add:

```typescript
interface DeltaPayloadOptions {
  payloadPath: string;
  outputDir: string;
  sourceDir: string;
  selectedPartitions: string[];
}
```

- [ ] **Step 7: Add source image input to frontend UI**

In `src/components/payload-dumper/FileBannerDetails.tsx` or a new component, add a "Source Images Directory" input that appears when a delta OTA is detected (manifest contains SOURCE_COPY or SOURCE_BSDIFF operations).

- [ ] **Step 8: Run cargo check and lint**

Run: `cd src-tauri && cargo check 2>&1 | head -30`
Run: `bun run lint:web 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/payload/delta.rs src-tauri/src/payload/mod.rs
git add src-tauri/src/payload/extractor.rs src-tauri/src/commands/payload.rs
git add src-tauri/Cargo.toml
git add src/lib/desktop/backend.ts src/lib/desktop/models.ts
git add src/components/payload-dumper/
git commit -m "feat(payload): implement Delta OTA support (SOURCE_COPY + SOURCE_BSDIFF)

New file: src-tauri/src/payload/delta.rs
- source_copy: Reads from source partition image at offset/length
- source_bsdiff: Applies bsdiff patch to source image
New command: extract_delta_payload accepting source_dir for source images
Frontend: Source Images Directory input when delta OTA detected
Closes Proposal #3."
```

---

## File Index

### Files Created in This Plan

| File | Purpose |
|------|---------|
| `src-tauri/src/payload/copy.rs` | Shared `stream_copy` utility (Task 6) |
| `src-tauri/src/payload/error.rs` | `PayloadError` enum (Task 7) |
| `src-tauri/src/payload/verify.rs` | Post-extraction SHA-256 + plausibility checks (Task 19) |
| `src-tauri/src/payload/interrupt.rs` | Graceful interruption flag (Task 22) |
| `src-tauri/src/payload/delta.rs` | SOURCE_COPY + SOURCE_BSDIFF operations (Task 23) |

### Files Modified in This Plan

| File | Tasks |
|------|-------|
| `src-tauri/src/payload/ops/extractor.rs` | 1, 5, 19, 23 |
| `src-tauri/src/payload/remote.rs` | 2, 5, 6, 8, 9, 22 |
| `src-tauri/src/payload/extractor.rs` | 5, 6, 8, 19, 21, 22, 23 |
| `src-tauri/src/payload/http.rs` | 9 |
| `src-tauri/src/payload/ops/ops_parser.rs` | 4 |
| `src-tauri/src/payload/ops/detect.rs` | 20 |
| `src-tauri/src/payload/parser.rs` | 20 |
| `src-tauri/src/payload/mod.rs` | 6, 7, 19, 22, 23 |
| `src-tauri/src/commands/payload.rs` | 7, 10, 23 |
| `src-tauri/Cargo.toml` | 7, 10, 23 |
| `src/lib/payload-dumper/usePayloadActions.ts` | 3, 12, 13 |
| `src/lib/payloadDumperStore.ts` | 14 |
| `src/components/payload-dumper/PartitionTable.tsx` | 15 |
| `src/components/payload-dumper/PayloadSourceTabs.tsx` | 11, 16 |
| `src/components/payload-dumper/ExtractionStatusCard.tsx` | 17 |
| `src/lib/desktop/backend.ts` | 23 |
| `src/lib/desktop/models.ts` | 23 |

---

## Verification Commands

After each commit, run the appropriate verification:

```bash
# Rust check
cd src-tauri && cargo check 2>&1 | head -20

# Rust tests
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20

# ESLint
bun run lint:web 2>&1 | grep -E "error|warning" | head -20

# TypeScript check
bun run build 2>&1 | grep -E "error|TS" | head -20
```

---

**End of plan.**
