# OPS Decryption Bug Fix Report

## Root Causes Found

### 1. **CRITICAL** — `key_update` treated mbox as packed u32 arrays instead of byte-value arrays

**File:** `crypto.rs` → `key_update()`

In Python, `mbox5 = [0x60, 0x8a, 0x3f, 0x2d, ...]` is a **list of byte-sized integers**. When `key_update` does `asbox[0]`, it gets the single value `0x60` (96).

Our Rust code converted the mbox bytes into packed u32 values via `u32::from_le_bytes(asbox[i*4..])`, which turned `[0x60, 0x8a, 0x3f, 0x2d]` into `0x2D3F8A60` — completely wrong.

**Fix:** Changed asbox type from `[u8; 62]` → `[u32; 62]` where each entry holds a single byte value (0-255), exactly matching Python's list-of-integers representation.

### 2. **CRITICAL** — XML validation failed on BOM + padding

**File:** `crypto.rs` → `try_decrypt_ops_xml()`

The decrypted XML starts with UTF-8 BOM bytes (`EF BB BF`). Two issues:
- `std::str::from_utf8(&decrypted)` failed on the **entire** aligned buffer (padding bytes after actual XML are invalid UTF-8)
- The fallback `String::from_utf8(decrypted)` also failed for the same reason

**Fix:** Check only first 256 bytes for `b"xml "` pattern, return `String::from_utf8_lossy()` to handle any invalid bytes in padding.

### 3. **CRITICAL** — XML parser only handled `<File>` elements, missing `<Image>` elements

**File:** `ops_parser.rs` → `parse_manifest_xml()`

The actual firmware partition data is stored in `<Image>` elements nested inside `<program>` elements within `<Program0>`-`<Program5>` sections:

```xml
<Program0>
  <program label="boot_a">
    <Image filename="boot.img" sparse="false" FileOffsetInSrc="..." SizeInByteInSrc="100663296" Sha256="..." />
  </program>
</Program0>
```

Our parser only looked for `<File>` tags, so it only found 4 partitions (SAHARA + UFS_PROVISION). The 58 actual firmware partitions in Program sections were missed.

**Fix:** Added `parse_image_element()` function and `<Image>` tag detection. Also tracks `<program label="...">` for better section labeling.

### 4. **MINOR** — BOM not stripped before XML parsing

**File:** `ops_parser.rs` → `decrypt_xml()`

The decrypted XML string started with `\u{FEFF}` (BOM) which could cause XML parser issues.

**Fix:** Added `.trim_start_matches('\u{FEFF}')` and `.trim_end_matches('\u{FFFD}')` to the cleanup chain.

## Verification

Test with **instantnoodlep_15_I.13_200411.ops** (OnePlus 8 Pro, 5.60 GB):

| Metric | Result |
|--------|--------|
| Footer parsed | ✅ magic=0x7CEF, project=19811, xml_len=102624 |
| Decryption | ✅ mbox5 produces valid `<?xml ...>` |
| Partitions found | **62** (was 4 before fix) |
| Total size | 6,008,700,564 bytes (5.60 GB) |
| Encrypted partitions | 2 (SAHARA: prog_firehose_ddr.elf, prog_firehose_lite.elf) |
| Sparse images detected | 7 (modemdump, op2, super, metadata, userdata, oneplus_in, modem) |
| Sections | SAHARA, UFS_PROVISION, Program0-Program5 |

## Python Port Assessment

> *Is it easy to port opscrypto.py to Rust?*

**Mostly yes, but with these gotchas:**

| Aspect | Difficulty | Notes |
|--------|-----------|-------|
| S-box cipher (`key_update`, `key_custom`) | **Hard** | Python's dynamic typing (bytes ↔ integers) makes the algorithm deceptive. `asbox[i]` looks like array indexing but the semantics differ based on whether `asbox` is a list of bytes or u32 values. Operator precedence in the return statement is also tricky. |
| Footer parsing | Easy | Straightforward binary struct parsing |
| XML parsing | Easy | `quick-xml` handles it well |
| Sparse image un-sparsing | Easy | Binary format, well-documented |
| OFP-QC/MTK crypto | Medium | Standard AES-CFB, but the key derivation with `keyshuffle` and `mtk_shuffle` has nibble-swap tricks |
| File I/O (mmap) | Easy | `memmap2` is a drop-in replacement |

**Key lesson:** When porting Python crypto code, always verify that array indexing semantics match. Python lists of `int` values don't pack — `[0x60, 0x8a]` is NOT equivalent to `from_le_bytes([0x60, 0x8a, ...])`.
