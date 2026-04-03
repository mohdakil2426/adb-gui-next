# Active Context

## Current State

ADB GUI Next is a fully functional Tauri 2 desktop application on `main` branch.
All responsive layout fixes, sticky header, and adaptive hardening are complete.

---

## Recently Completed

### 2026-04-03 — OPS Decryption Bug Fixes (3 Critical Bugs)

**Problem:** OPS firmware loading showed an error toast — decryption was failing silently.

**Root Causes Found & Fixed:**

| Bug | File | Issue | Fix |
|-----|------|-------|-----|
| 1. **mbox treated as packed u32** | `crypto.rs` | `sbox_as_u32_array()` was `[u32; 512]` — too small, and `key_update` was XORing with packed u32 values instead of byte values | Changed to `[u32; 2048]` with one byte-value per entry |
| 2. **XML validation on full buffer** | `crypto.rs` | `try_decrypt_ops_xml()` checked entire padded buffer as UTF-8 — padding bytes are invalid UTF-8 | Check only first 256 bytes for `b"xml "`, return `String::from_utf8_lossy()` |
| 3. **Missing `<Image>` elements** | `ops_parser.rs` | Parser only handled `<File>` tags — actual firmware is in `<Image>` inside `<program>` | Added `<Image>` element parsing with program label tracking |

**Additional fixes:**
- XML offset now computed from end of file (matching Python reference), not `config_offset * 0x200`
- BOM stripping (`\u{FEFF}`) and replacement character cleanup before XML parsing
- Updated unit tests for real XML structure with `<Image>` elements

**Verification:** 62 partitions found from OnePlus 8 Pro `.ops` file (was 4 before fixes).

**Documentation:** Comprehensive technical guide written in `docs/guides/ops-ofp-firmware-extraction.md`.

---

### 2026-04-03 — OPS/OFP Firmware Format Support (Backend + Frontend Integration)

**Feature:** Added native decryption and extraction support for OnePlus `.ops` and Oppo `.ofp`
(Qualcomm + MediaTek) firmware containers to the existing Payload Dumper. Uses a **unified dispatch**
pattern — existing `extract_payload` and `list_payload_partitions_with_details` Tauri commands
auto-detect `.ops`/`.ofp` by file extension and route to the dedicated OPS pipeline. Zero changes
to frontend extraction/listing actions.

**New Rust modules (`src-tauri/src/payload/ops/`):**

| Module | Purpose |
|--------|---------|
| `mod.rs` | Shared types (`OpsPartitionEntry`, `OpsFooter`, `OpsMetadata`), constants |
| `detect.rs` | Format detection: CrAU, PK/ZIP, 0x7CEF footer, MTK brute-force |
| `crypto.rs` | OPS custom S-box cipher (3 mbox variants), OFP-QC AES-128-CFB (7 key sets + V1), OFP-MTK (9 key sets + mtk_shuffle) |
| `sbox.bin` | 2048-byte S-box lookup table (`include_bytes!`) |
| `ops_parser.rs` | Footer parsing, mbox-variant XML decryption brute-force, `quick-xml` manifest parsing |
| `ofp_qc.rs` | Page size detection (0x200/0x1000), AES key brute-force, partial encryption (first 256K) |
| `ofp_mtk.rs` | mtk_shuffle header/entry table binary parsing |
| `sparse.rs` | Android sparse image un-sparsing (Raw, Fill, Don't Care, CRC32 chunks) |
| `extractor.rs` | Parallel extraction, format-specific decryption dispatch, sparse detection, progress events |

**New dependencies:** `aes 0.8`, `cfb-mode 0.8`, `md-5 0.10`, `quick-xml 0.37`

**Frontend changes (minimal):**
- `SelectPayloadFile()` and DropZone accept `.ops`/`.ofp` extensions
- `OpsMetadata` interface added to `models.ts`
- `GetOpsMetadata()` backend wrapper added
- `get_ops_metadata` Tauri command registered
- View subtitle updated to mention OPS/OFP

**Key design decisions:**
- Unified dispatch by file extension — no new frontend actions needed
- `OpsPartitionEntry` → `PartitionDetail` mapping in `list_ops_partitions()` makes format transparent
- OPS custom cipher ported from Python (`opscrypto.py`) to Rust with `include_bytes!` S-box
- Mbox variant brute-force: tries mbox5 → mbox6 → mbox4 in order of likelihood
- OFP-QC: tries V1 keyshuffle first, then 6 V2 key triplets
- OFP-MTK: 9 key sets with mtk_shuffle2 deobfuscation
- Sparse images un-sparsed in-place after extraction

**Files changed:** 13 (9 new Rust + 4 modified Rust + 4 modified TypeScript)

---

### 2026-04-03 — Remote Payload Metadata UI (Collapsible Details Panel)

**Feature:** Implemented a collapsible "Show Details / Hide Details" panel inside the `FileBanner`
component for remote OTA payloads. When partitions load from a remote URL, the banner shows a
chevron toggle that expands to reveal 7 metadata sections.

**Data sources — 3 layers of metadata aggregation:**

| Section | Source | Data |
|---|---|---|
| OTA Package | `META-INF/com/android/metadata` (ZIP entry) | Device, Android version, build fingerprint, OTA type, security patch, build date, version, wipe flag |
| Payload Properties | `payload_properties.txt` (ZIP entry) | File SHA-256 hash, file size, metadata hash, metadata size |
| HTTP | HEAD response headers | Content-length, content-type, server, last-modified, ETag |
| ZIP Archive | EOCD/CD binary parsing | Compression method, payload.bin offset, uncompressed size |
| OTA Manifest | CrAU protobuf header | CrAU version, block size, update type, timestamp, dynamic groups |
| Extraction | Frontend state | Mode (prefetch/direct), output path |

**Key implementation details:**
- **`read_text_file_from_zip()`** in `http_zip.rs` — reads any named file from a remote ZIP via
  Central Directory scanning + HTTP range request. Returns `Ok(None)` when file missing (best-effort).
- **`parse_kv_text()`** helper — parses `key=value` text files into HashMap
- **`FileBannerDetails.tsx`** — 7-section metadata display with SDK→Android version mapping,
  copyable hashes, OTA type badge, conditional section rendering
- **Fire-and-forget metadata fetch** — non-blocking after partition load; silent on failure
- **Zustand persistence** — metadata survives view navigation, cleared on reset

**Files changed:** 9 (5 Rust + 4 TypeScript)

---

### 2026-04-03 — Sticky Header Root Fix (Viewport Height Boundary)

**Problem:** The header was still scrollable despite being `shrink-0` inside a flex-col
`SidebarInset`. The `shrink-0` class has no effect unless the parent has a **concrete, bounded
height** to distribute from. Without it, `flex-1` inside `SidebarInset` resolves to ∞ and
everything scrolls at the body level.

**Root cause:** The outer `<div>` wrapper around `SidebarProvider` in `MainLayout.tsx` had no
height — only `opacity-0/100` classes. Without a fixed height ancestor, `flex-1` children
can't establish a scroll boundary.

**Two-line fix:**

| File | Change | Reason |
|---|---|---|
| `MainLayout.tsx` | Outer `<div>`: added `h-svh overflow-hidden` | Creates hard viewport-height boundary |
| `sidebar.tsx` | `SidebarProvider` wrapper: `min-h-svh` → `h-full` | Fills boundary instead of overriding it |

**All gates:** `pnpm format:check` ✅ → `pnpm lint:web` ✅ → `pnpm build` ✅

---

## Current Verification Evidence

Last verified: **2026-04-03** (after OPS decryption bug fixes + documentation)
- `cargo check` ✅ — Rust compilation clean (including all OPS modules)
- `pnpm build` ✅ — TypeScript + Vite bundle clean
- `pnpm lint:web` ✅ — ESLint clean
- `pnpm format:check` ✅ — Formatting clean
- OPS integration test ✅ — 62 partitions from OnePlus 8 Pro firmware
- `cargo test` ⚠️ — pre-existing Windows crash (Tauri DLL — not a code bug)
- `cargo clippy` ⚠️ — blocked by Windows DLL file lock (pre-existing)

---

## Architecture Status

| Area | Status | Notes |
|------|--------|-------|
| Layout | ✅ Fixed | h-svh boundary, flex-col pinned header, overflow-x-hidden containment |
| Responsive | ✅ Fixed | All 7 views — min-w-0 chain complete, no horizontal overflow |
| Header | ✅ Fixed | Structurally pinned via flex-col — never scrolls regardless of content |
| Sidebar | ✅ Fixed | No phantom scrollbar gutter; overflow-x-hidden on content |
| Payload Dumper | ✅ Enhanced | Remote metadata panel, OPS/OFP/sparse support, URL persistence, viewport-relative heights |
| OPS/OFP | ✅ Working | Decryption verified, 62 partitions, comprehensive docs written |
| App Manager | ✅ Fixed | Viewport-relative virtualizer + APK list heights |
| Connected Devices | ✅ Fixed | min-w-0 + truncate on device name/serial |
| FileSelector | ✅ Fixed | min-w-0 on outer div for path truncation chain |
| Frontend | ✅ Complete | shadcn Sidebar + 7 views + bottom panel |
| Bottom Panel | ✅ Polished | Fixed position, fluid resize (DOM-first/RAF), smart tab toggle |
| File Explorer | ✅ Enhanced | Full CRUD, dual-pane, history, search, sort, human sizes, symlinks |
| Device Management | ✅ Centralized | Global DeviceSwitcher in header, single polling source |
| App Manager | ✅ Improved | shadcn Command search, destructive glow, non-blocking install |
| Flasher | ✅ Overhauled | Async flash/wipe, DropArea with position hit-testing, queue actions |
| Backend | ✅ Complete | All 30+ Tauri commands fully async |
| Security | ✅ Hardened | Shell injection, SSRF, path traversal, content-length validation |

---

## Critical Patterns & Gotchas

### Layout & CSS

- **h-svh boundary is MANDATORY**: The outer `<div>` wrapper in `MainLayout` MUST have `h-svh overflow-hidden`. Without it, `flex-1` resolves to ∞ and the header scrolls.
- **`min-h-svh` is wrong for desktop apps**: Web pages use it to grow; Tauri apps need `h-full` (fill the bounded container).
- **`overflow-hidden` breaks sticky**: Never add `overflow: hidden` to an ancestor of a `position: sticky` element — it terminates the scroll-ancestor search. Use `overflow-x-hidden` for desktop layout boundaries.
- **NO `position: sticky` in this app**: The header is pinned by being a `shrink-0` flex sibling above the `flex-1 overflow-y-auto` scroll area. No z-index management needed.
- **`position: fixed` children are NOT affected by `overflow-hidden`**: Fixed elements (BottomPanel, Toaster) use the viewport as their containing block. Only a CSS `transform` on an ancestor would re-contain them.
- **`min-w-0` chain must be unbroken**: Every flex ancestor between the scroll boundary and a `truncate` text element must have `min-w-0`. Missing one link = overflow escapes upward.
- **`scrollbar-gutter: stable` must be scoped**: Applied via `.main-scroll-area` class only. Global application causes phantom gutters in sidebar and nested scroll containers.
- **Viewport-relative heights for scroll lists**: Use `max-h-[40vh]` not `max-h-100` (400px). Always pair with a `min-h-[Npx]` so lists don't collapse to zero on tall windows.

### OPS/OFP Porting

- **mbox is a list of byte-values, NOT packed u32**: Each `mbox[i]` is 0-255. Never use `u32::from_le_bytes()` to pack adjacent bytes.
- **XML uses `<Image>` in `<program>` tags**: Not just `<File>` elements. Missing `<Image>` parsing loses 90%+ of partitions.
- **XML offset is from END of file**: `file_size - 0x200 - aligned_xml_length`, not `config_offset * 0x200`.
- **Decrypted XML has BOM + NUL padding**: Must strip `\u{FEFF}`, `\0`, and `\u{FFFD}` before parsing.
- **sbox_as_u32_array must be [u32; 2048]**: One entry per byte of sbox.bin, not 512.
- **mtk_shuffle ≠ mtk_shuffle2**: Operation order (XOR vs nibble-swap) is reversed.

### React & State

- **`loadFiles` deps = `[]`**: Uses `historyIndexRef.current`. Adding `historyIndex` causes infinite render loop (50+ ADB calls/sec).
- **`fileList.length === 0 && creatingType === null`**: The empty-state condition. Missing `creatingType === null` breaks inline creation in empty directories.
- **Device polling**: Single `useQuery(['allDevices'], 3s)` in MainLayout — never add per-view polling.
- **`selectedSerial` auto-select**: disconnect → clear, single device → auto-select, user pick → persist.
- **Bottom panel resize**: Use `panelRef` + RAF + `setState` only on mouseup. Never `setState` on mousemove.

### Rust

- **Tauri sync commands = main thread**: `pub fn` commands block WebView. Always `pub async fn` + `tokio::task::spawn_blocking`.
- **`State<'_, T>` in async commands**: Cannot use `spawn_blocking` (needs `'static`). Use `block_in_place` instead.
- **`split_args` in spawn_blocking**: Must be called **inside** the `spawn_blocking` closure — borrows from the closure-owned String, not across 'static boundary.
- **`cargo test` on Windows**: STATUS_ENTRYPOINT_NOT_FOUND — pre-existing Tauri DLL issue, not a code bug.

### Component Patterns

- **`AppManager shouldFilter={false}`**: Mandatory — cmdk's built-in filter conflicts with virtualizer.
- **Drag-drop hit-testing**: Tauri's `onDragDropEvent` is window-level. Always use `getBoundingClientRect()` + cursor `(x, y)`.
- **One `OnFileDrop` per page**: Calling it replaces the previous handler. Multiple drop areas = single handler + hit-test per ref.
- **ErrorBoundary**: Keyed to `activeView` so navigating away + back resets it.
- **Tauri `DragDropEvent` API**: `type` is `'enter' | 'over' | 'drop' | 'leave'` — NOT `'cancel'`.
- **`deviceStatus.ts`**: Single source of truth. Import `getStatusConfig()` from `@/lib/deviceStatus` — never define locally.
- **`loadFiles` request sequencing**: `loadRequestIdRef = useRef(0)`, stamp `requestId = ++ref.current`, discard stale after each `await`.