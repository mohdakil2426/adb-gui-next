# OPS/OFP Firmware Extraction — Technical Guide

> Native decryption and extraction of OnePlus `.ops` and Oppo `.ofp` firmware containers.

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Formats](#supported-formats)
3. [Architecture](#architecture)
4. [Format Detection](#format-detection)
5. [OPS Format (OnePlus)](#ops-format-oneplus)
6. [OFP-QC Format (Oppo Qualcomm)](#ofp-qc-format-oppo-qualcomm)
7. [OFP-MTK Format (Oppo MediaTek)](#ofp-mtk-format-oppo-mediatek)
8. [Android Sparse Image Un-Sparsing](#android-sparse-image-un-sparsing)
9. [Extraction Pipeline](#extraction-pipeline)
10. [Frontend Integration](#frontend-integration)
11. [Testing](#testing)
12. [Common Pitfalls & What NOT To Do](#common-pitfalls--what-not-to-do)
13. [Debugging Checklist](#debugging-checklist)
14. [Reference Materials](#reference-materials)

---

## Overview

ADB GUI Next natively decrypts and extracts firmware partitions from three proprietary
firmware container formats used by OnePlus and Oppo devices. All three formats produce the
same `PartitionDetail` output type as standard Android OTA `payload.bin` files, making them
fully transparent to the existing Payload Dumper UI.

### Key Design Principles

- **Unified dispatch** — The existing `extract_payload` and `list_payload_partitions_with_details`
  Tauri commands auto-detect `.ops`/`.ofp` by file extension and route to the dedicated pipeline.
  Zero changes to frontend extraction/listing actions.
- **Transparent output** — `OpsPartitionEntry` maps to `PartitionDetail` (same type as CrAU),
  so the frontend partition table, selection, and extraction UI work unchanged.
- **Memory-mapped I/O** — All parsing uses `memmap2::Mmap` for zero-copy access to multi-GB files.
- **Parallel extraction** — `std::thread::scope` with `Arc<Mmap>` shares the memory map across
  threads (8 bytes per Arc clone, not 4–6 GB Vec copies).
- **Post-extraction sparse handling** — After extracting each partition, checks for Android sparse
  magic (`0xED26FF3A`) and un-sparses in-place.

---

## Supported Formats

| Format | Extension | Encryption | Manufacturer | Era |
|--------|-----------|------------|--------------|-----|
| **OPS** | `.ops` | Custom S-box cipher (NOT AES) | OnePlus | OnePlus 7/7T/8/8T/9 |
| **OFP-QC** | `.ofp` | AES-128-CFB | Oppo (Qualcomm) | Find X, Reno, A-series |
| **OFP-MTK** | `.ofp` | AES-128-CFB + mtk_shuffle | Oppo (MediaTek) | A-series (MediaTek SoC) |

---

## Architecture

### Module Map

```text
src-tauri/src/payload/ops/
├── mod.rs           # Shared types (OpsPartitionEntry, OpsFooter, OpsMetadata), constants
├── detect.rs        # Format detection: CrAU, ZIP, 0x7CEF footer, MTK brute-force
├── crypto.rs        # OPS custom S-box cipher, OFP AES-128-CFB, MTK shuffle
├── sbox.bin         # 2048-byte S-box lookup table (included via include_bytes!)
├── ops_parser.rs    # OPS footer parsing, XML decryption brute-force, manifest parsing
├── ofp_qc.rs        # OFP Qualcomm page size detection, AES key brute-force, partial encryption
├── ofp_mtk.rs       # OFP MediaTek header/entry binary parsing
├── sparse.rs        # Android sparse image un-sparsing (4 chunk types)
├── extractor.rs     # Unified extraction: parallel dispatch, decrypt/copy, sparse post-process
└── test_ops_decrypt.rs  # Integration test (real .ops file, standalone binary)
```

### Dependency Chain

```text
extractor.rs
  → detect.rs          (format detection)
  → ops_parser.rs      (OPS parsing)
  → ofp_qc.rs          (OFP-QC parsing)
  → ofp_mtk.rs         (OFP-MTK parsing)
  → crypto.rs          (all decryption)
  → sparse.rs          (post-extraction un-sparsing)
```

### External Crates

| Crate | Version | Purpose |
|-------|---------|---------|
| `aes` | 0.8 | AES-128 block cipher (OFP decryption) |
| `cfb-mode` | 0.8 | CFB stream cipher mode |
| `md-5` | 0.10 | MD5 digest (OFP key derivation) |
| `quick-xml` | 0.37 | XML parsing (OPS/OFP-QC manifests) |
| `memmap2` | 0.9 | Memory-mapped file I/O |
| `sha2` | 0.10 | SHA-256 verification |

---

## Format Detection

Detection is handled by `detect.rs::detect_format()` using ordered checks:

```text
1. Bytes [0..4] == b"CrAU"         → PayloadBin (standard OTA)
2. Bytes [0..2] == b"PK"           → ZipOfp (password-protected ZIP wrapper)
3. Footer at filesize-0x200+0x10   → 0x7CEF? → Ops
4. Footer at filesize-0x1000+0x10  → 0x7CEF? → OfpQualcomm
5. AES-CFB brute-force first 16B   → decrypts to "MMM"? → OfpMediaTek
6. None match                      → Error
```

### Routing Decision

The routing from `commands/payload.rs` uses **file extension** as the first gate:

```rust
if ops::extractor::should_use_ops_pipeline(local_path) {
    // Route to OPS/OFP pipeline
}
```

`should_use_ops_pipeline()` checks for `.ops` or `.ofp` extension. Inside the pipeline,
`detect_format()` determines the specific sub-format.

> **IMPORTANT**: Extension check comes BEFORE content-based detection. A `.bin` file with
> OPS footer magic would NOT be routed to the OPS pipeline — it would fall through to the
> standard CrAU extractor. This is intentional: the standard extractor handles `payload.bin`.

---

## OPS Format (OnePlus)

### File Structure

```text
┌────────────────────────────────────────────────┐
│ SAHARA files (encrypted, ~0.7 MB each)         │
│   prog_firehose_ddr.elf                        │
│   prog_firehose_lite.elf                       │
├────────────────────────────────────────────────┤
│ UFS_PROVISION files (plaintext, ~2.7 KB each)  │
│   provision_samsung.xml                        │
│   provision_toshiba.xml                        │
├────────────────────────────────────────────────┤
│ Program0..Program5 images (plaintext)          │
│   persist.img, boot.img, super.img, ...        │
│   Some are Android sparse images               │
├────────────────────────────────────────────────┤
│ Encrypted XML manifest (~100 KB)               │
│   Contains partition table for all sections     │
├────────────────────────────────────────────────┤
│ Footer (last 0x200 bytes)                      │
│   +0x00: config_offset (u32, LE, in sectors)   │
│   +0x04: xml_length (u32, LE, in bytes)        │
│   +0x08: project_id (null-terminated string)   │
│   +0x10: magic (u32, LE → 0x7CEF)             │
└────────────────────────────────────────────────┘
```

### Footer Parsing

The footer is the last `0x200` bytes of the file:

```rust
let footer_start = file_size - 0x200;
let config_offset = u32::from_le_bytes(data[footer_start..][0..4]);  // sectors
let xml_length    = u32::from_le_bytes(data[footer_start..][4..8]);  // bytes
let project_id    = null_terminated_string(data[footer_start+8..]);
let magic         = u32::from_le_bytes(data[footer_start+0x10..][0..4]); // 0x7CEF
```

### XML Manifest Location

The XML region is computed from the **end of the file**, NOT from `config_offset`:

```python
# Python reference (opscrypto.py):
xmloffset = filesize - 0x200 - (xmllength + xmlpad)
# where xmlpad = 0x200 - (xmllength % 0x200) if xmllength % 0x200 != 0 else 0
```

```rust
// Rust equivalent:
let padding = if xml_length % 0x200 != 0 { 0x200 - (xml_length % 0x200) } else { 0 };
let aligned_length = xml_length + padding;
let xml_start = file_size - 0x200 - aligned_length as usize;
let xml_end = xml_start + aligned_length as usize;
```

> **⚠️ DO NOT** compute the XML offset as `config_offset * 0x200`. While `config_offset`
> represents the sector number, the correct approach (matching the Python reference) is to
> compute from the end of the file. Using `config_offset` directly can produce off-by-one
> errors in certain firmware versions.

### Encryption: Custom S-Box Cipher

The OPS cipher is **NOT** standard AES. It is a custom block cipher based on:

1. A **fixed 128-bit key**: `d1b5e39e5eea049d671dd5abd2afcbaf`
2. A **2048-byte S-box** lookup table (`sbox.bin`)
3. A **16-byte mbox prefix** that acts as a key schedule variant
4. A `key_update()` function that evolves the key using S-box lookups

#### Mbox Variants

There are 3 known mbox key schedules:

| Variant | Label | Prefix (first 4 bytes) | Device Era |
|---------|-------|------------------------|------------|
| `Mbox5` | `mbox5` | `60 8a 3f 2d` | OnePlus 7/7T — most common |
| `Mbox6` | `mbox6` | `AA 69 82 9E` | OnePlus 8/8T |
| `Mbox4` | `mbox4` | `C4 5D 05 71` | OnePlus 7 (older) |

The parser **brute-forces** all 3 variants (in order: mbox5 → mbox6 → mbox4) and picks the
one that produces valid XML:

```rust
for variant in MboxVariant::ALL {
    if let Some(xml) = try_decrypt_ops_xml(&encrypted, variant) {
        return Ok((xml, variant));
    }
}
```

#### How `key_update()` Works

The `key_update()` function takes a 4×u32 key (`iv1`) and the mbox array, then:

1. XORs each key word with the corresponding mbox byte value
2. Performs 4 rounds of S-box substitution using `gsbox()` (reads 4 bytes from sbox as LE u32)
3. Runs `rounds - 2` middle rounds (where `rounds = mbox[60]`, typically 10)
4. Final round uses byte masking (`& 0xFF`, `& 0xFF00`, etc.)
5. Returns new 4×u32 key

#### How `ops_decrypt()` (key_custom) Works

```text
For each 16-byte block:
  1. rkey = key_update(rkey, mbox)
  2. XOR each 4-byte word of input with rkey[0..4]
  3. In decrypt mode: update rkey[j] = input word (NOT decrypted word)

For residual bytes (< 16):
  1. rkey = key_update(rkey, sbox)     ← NOTE: uses sbox, not mbox
  2. XOR remaining bytes with rkey words
```

#### Critical Implementation Detail: Byte-Value Integers

In Python, the mbox array is a **list of integers** where each entry is a single byte value:

```python
mbox5 = [0x60, 0x8a, 0x3f, 0x2d, ...]  # list of ints (0-255)
```

When `key_update` does `iv1[0] ^ asbox[0]`, it XORs a u32 with a byte-sized integer (0-255).

In Rust, the mbox is represented as `[u32; 62]` where each entry holds a single byte:

```rust
fn mbox_array(variant: MboxVariant) -> [u32; 62] {
    let mut buf = [0u32; 62];
    for (i, &b) in prefix.iter().enumerate() {
        buf[i] = b as u32;  // ← byte value, NOT packed u32
    }
    buf
}
```

> **⚠️ DO NOT** use `u32::from_le_bytes()` to pack 4 bytes into a single u32. This is the
> single most common porting bug. Python's `[0x60, 0x8a, 0x3f, 0x2d]` is 4 separate integers,
> not one packed `0x2D3F8A60`.

### XML Manifest Structure

After decryption, the XML looks like:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<Setting>
    <BasicInfo Project="19811" Version="Unknown Version"
               MemoryName="ufs" TargetName="SM8250"
               GrowLastPartToFillDisk="true" />
    <SAHARA>
        <File Path="prog_firehose_ddr.elf"
              FileOffsetInSrc="0" SizeInSectorInSrc="1415"
              SizeInByteInSrc="724544" />
    </SAHARA>
    <UFS_PROVISION>
        <File Name="samsung" Path="provision_samsung.xml"
              FileOffsetInSrc="2842" SizeInSectorInSrc="6"
              SizeInByteInSrc="2759" />
    </UFS_PROVISION>
    <Program0>
        <program label="boot_a">
            <Image filename="boot.img" sparse="false" ID="0"
                   FileOffsetInSrc="563203" SizeInSectorInSrc="196608"
                   SizeInByteInSrc="100663296"
                   Sha256="abcdef..." />
        </program>
        <program label="ssd">
            <!-- Empty partition — must be skipped -->
            <Image filename="" sparse="false" ID="0"
                   FileOffsetInSrc="0" SizeInSectorInSrc="0"
                   SizeInByteInSrc="0" Sha256="0" />
        </program>
    </Program0>
</Setting>
```

Key parsing rules:

1. **SAHARA section** → `<File>` elements, always **encrypted** with the OPS cipher
2. **UFS_PROVISION section** → `<File>` elements, **not encrypted**
3. **Program0..Program5 sections** → `<program>` → `<Image>` elements, **not encrypted**
4. Empty partitions (`filename=""` or `SizeInByteInSrc="0"`) are **skipped**
5. Section label format: `"Program0/boot_a"` (section name + program label)

> **⚠️ DO NOT** only parse `<File>` elements. The actual firmware partitions (boot.img,
> super.img, recovery.img, etc.) are in `<Image>` elements nested inside `<program>` tags.
> Missing this was a critical bug that caused only 4 of 62 partitions to be found.

### XML Cleanup

The decrypted XML may contain encoding artifacts:

- **UTF-8 BOM** (`EF BB BF` / `\u{FEFF}`) at the start
- **NUL bytes** in the sector-aligned padding after the actual XML
- **Replacement characters** (`\u{FFFD}`) from lossy UTF-8 conversion

The parser strips all of these before passing to `quick-xml`:

```rust
xml_str
    .trim_start_matches('\u{FEFF}')  // BOM
    .trim_end_matches('\0')          // NUL padding
    .trim_end_matches('\u{FFFD}')    // replacement chars
    .trim()
```

---

## OFP-QC Format (Oppo Qualcomm)

### File Structure

Similar to OPS but with AES-128-CFB encryption instead of the custom S-box cipher.

- **Footer**: Same 0x7CEF magic, but may have page size 0x200 or 0x1000
- **XML manifest**: Encrypted with AES-128-CFB
- **Partitions**: First 256 KB of each partition is AES-encrypted, rest is plaintext

### Key Derivation

OFP-QC uses two key derivation methods:

#### V1 (keyshuffle method)

```text
1. Start with 3 hardcoded hex keys: key1, key2, key3
2. keyshuffle: for each byte, XOR with key3 then swap nibbles
3. Take MD5 hex of shuffled key2 → first 16 chars → AES key
4. Take MD5 hex of shuffled key1 → first 16 chars → AES IV
```

#### V2 (deobfuscate method)

```text
1. Each key triplet has: [mask, encrypted_key, encrypted_iv]
2. deobfuscate: for each byte, XOR with mask then ROL(4, 8)
3. Take MD5 hex of deobfuscated key → first 16 chars → AES key
4. Take MD5 hex of deobfuscated IV → first 16 chars → AES IV
```

There are **6 known V2 key sets** covering various OFP versions (V1.4.x through V2.0.x).

### Brute-Force Strategy

```text
1. Try V1 keyshuffle cipher
2. Try each of 6 V2 key sets
3. Decrypt first ~64 bytes of the XML region
4. Check if result starts with "<?xml"
5. First match wins → use that cipher for all partitions
```

### Partial Encryption

Unlike OPS (where only SAHARA is encrypted), OFP-QC encrypts the **first 0x40000 bytes
(256 KB)** of each partition. The extractor handles this:

```rust
// Decrypt first encrypted_length bytes
let decrypted = cipher.decrypt(&mmap[start..start + enc_len]);
writer.write_all(&decrypted)?;
// Copy remaining bytes as plaintext
writer.write_all(&mmap[start + enc_len..byte_end])?;
```

---

## OFP-MTK Format (Oppo MediaTek)

### Key Differences

- **No XML manifest** — uses a binary header/entry table
- **`MMM` magic** at the start of decrypted data (detection marker)
- **mtk_shuffle**: nibble-swap obfuscation before/after AES

### Key Derivation

```text
1. 9 known key sets: 7 with [mask, key, iv] + 2 with [key, iv] directly
2. For 3-element sets: mtk_shuffle2(mask, key) and mtk_shuffle2(mask, iv)
3. MD5 hex of shuffled values → first 16 chars → AES key/IV
4. For 2-element sets: key strings used directly as ASCII bytes
```

### mtk_shuffle vs mtk_shuffle2

```rust
// mtk_shuffle: swap nibbles, THEN XOR with key
fn mtk_shuffle(key: &[u8], data: &mut [u8]) {
    data[i] = key[i] ^ swap_nibble(data[i]);
}

// mtk_shuffle2: XOR with key, THEN swap nibbles
fn mtk_shuffle2(key: &[u8], data: &mut [u8]) {
    data[i] = swap_nibble(key[i] ^ data[i]);
}
```

> **⚠️ DO NOT** confuse `mtk_shuffle` and `mtk_shuffle2`. The order of XOR and nibble-swap
> is reversed. Using the wrong one produces garbage keys.

---

## Android Sparse Image Un-Sparsing

Some firmware partitions (e.g., `super.img`, `userdata.img`, `modemdump.img`) are stored as
Android sparse images. After extraction, the post-processing step detects and converts them.

### Sparse Image Format

```text
Header (28 bytes):
  magic: 0xED26FF3A
  major_version: u16
  minor_version: u16
  file_hdr_sz: u16
  chunk_hdr_sz: u16
  blk_sz: u32        (typically 4096)
  total_blks: u32
  total_chunks: u32
  image_checksum: u32

Chunk (12+ bytes each):
  chunk_type: u16
  reserved: u16
  chunk_sz: u32       (in blocks)
  total_sz: u32       (header + data bytes)
  [data]
```

### Chunk Types

| Type | Value | Data | Action |
|------|-------|------|--------|
| Raw | `0xCAC1` | `chunk_sz × blk_sz` bytes | Copy directly |
| Fill | `0xCAC2` | 4-byte pattern | Write pattern repeated `chunk_sz × blk_sz` times |
| Don't Care | `0xCAC3` | None | Seek past (leave zeros) |
| CRC32 | `0xCAC4` | 4-byte CRC | Skip (not verified) |

### Un-Sparse Flow

```text
1. Extract partition to temp file
2. Read first 4 bytes — check for sparse magic (0xED26FF3A)
3. If sparse: read sparse file → write raw file → replace original
4. If not sparse: no action needed
```

> **⚠️ DO NOT** try to un-sparse during extraction. The sparse format must be fully written
> first, then read back and converted. In-place streaming conversion would require back-seeking
> which conflicts with the write pipeline.

---

## Extraction Pipeline

### Full Flow

```text
User selects .ops/.ofp file
  → commands/payload.rs: should_use_ops_pipeline(path)
  → detect_format(mmap): Ops | OfpQualcomm | OfpMediaTek
  → parse_ops() / parse_ofp_qc() / parse_ofp_mtk()
    → Returns: Vec<OpsPartitionEntry>, OpsMetadata, cipher_state
  → filter by selected partitions
  → parallel extraction (std::thread::scope)
    → For each partition:
      → Format-specific decrypt/copy (extract_single_partition)
      → flush to disk
      → if sparse: try_unsparse()
  → map to PartitionDetail (name + size)
  → emit payload:progress events
  → return ExtractPayloadResult
```

### Partition Processing by Type

| Format + Section | Processing |
|------------------|------------|
| OPS + SAHARA | Full decrypt with `ops_decrypt(data, variant)` |
| OPS + Program/UFS | Raw copy (no encryption) |
| OFP-QC + encrypted | Decrypt first `encrypted_length` bytes with AES-CFB, copy rest |
| OFP-MTK + encrypted | Decrypt first `encrypted_length` bytes with AES-CFB, copy rest |
| Any + sparse flag | Post-extract un-sparse |

### Memory Model

```text
                    ┌─────────────┐
                    │  OS Kernel   │
                    │  File Cache  │
                    └──────┬──────┘
                           │ mmap
                    ┌──────┴──────┐
                    │   Mmap      │  ← single mapping, 4-6 GB file
                    │  (zero-copy) │
                    └──────┬──────┘
                           │ Arc::clone (8 bytes each)
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐  ┌───┴────┐  ┌───┴────┐
         │ Thread 1 │  │ Thread 2│  │Thread N│
         │ boot.img │  │super.img│  │tz.mbn  │
         └─────────┘  └────────┘  └────────┘
```

Each extraction thread gets an 8-byte `Arc<Mmap>` clone — not a multi-GB data copy.

---

## Frontend Integration

### File Selection

The file picker and drop zone accept `.ops` and `.ofp` extensions:

```typescript
// In PayloadDumper view
const filters = [
  { name: 'Firmware', extensions: ['bin', 'zip', 'ops', 'ofp'] },
];
```

### Partition Listing (Automatic)

The existing `ListPayloadPartitionsWithDetails` call routes automatically:

```typescript
// backend.ts — no changes needed
export async function ListPayloadPartitionsWithDetails(
  path: string
): Promise<PartitionDetail[]> {
  return core.invoke('list_payload_partitions_with_details', {
    payloadPath: path,
  });
}
```

On the Rust side, `commands/payload.rs` checks:
```rust
if ops::extractor::should_use_ops_pipeline(file_path) {
    return ops::list_ops_partitions(file_path);
}
```

### Extraction (Automatic)

Same pattern — `extract_payload` routes based on extension:

```rust
if ops::extractor::should_use_ops_pipeline(local_path) {
    return ops::extract_ops_partitions(local_path, output_dir, &selected, Some(app), |_, _, _, _| {});
}
```

### OPS Metadata (Optional)

A dedicated `get_ops_metadata` command surfaces format-specific metadata:

```typescript
export async function GetOpsMetadata(path: string): Promise<OpsMetadata> {
  return core.invoke('get_ops_metadata', { path });
}

interface OpsMetadata {
  format: string;        // "ops", "ofp-qc", "ofp-mtk"
  projectId?: string;    // e.g. "19811"
  firmwareName?: string; // e.g. "instantnoodlep_15_I.13_200411"
  cpu?: string;          // e.g. "SM8250"
  flashType?: string;    // e.g. "ufs"
  encryption: string;    // e.g. "custom-aes(mbox5)"
  totalPartitions: number;
  totalSize: number;
  sections: string[];    // e.g. ["SAHARA", "Program0/boot_a", ...]
}
```

---

## Testing

### Integration Test (Standalone Binary)

Due to Windows DLL issues with `cargo test` (pre-existing Tauri DLL entrypoint problem),
OPS testing uses a standalone example binary:

```bash
# Run the integration test
cargo run --example test_ops_decrypt --manifest-path src-tauri/Cargo.toml
```

The test binary (`src-tauri/examples/test_ops_decrypt.rs`):
1. Opens a real `.ops` file from `docs/refrences/oppo_decrypt-master/`
2. Parses the footer and validates magic
3. Tries all 3 mbox variants for XML decryption
4. Runs `parse_ops()` and validates partition count
5. Prints all 62 partitions with offset, size, section, encryption status

### Unit Tests

```bash
# Run unit tests (may fail on Windows due to DLL issue)
cargo test --manifest-path src-tauri/Cargo.toml
```

Unit tests cover:
- `crypto.rs`: mbox array construction, gsbox lookup, OPS key constant verification
- `ops_parser.rs`: filename sanitization, XML parsing for `<File>` and `<Image>` elements
- `sparse.rs`: sparse magic detection
- `detect.rs`: (tested via integration test)

### Verified Test Results

Tested with `instantnoodlep_15_I.13_200411.ops` (OnePlus 8 Pro, 5.60 GB):

| Metric | Result |
|--------|--------|
| Footer magic | ✅ 0x7CEF |
| Project ID | ✅ 19811 |
| XML decryption | ✅ mbox5 variant |
| Total partitions | ✅ 62 |
| SAHARA (encrypted) | ✅ 2 partitions |
| UFS_PROVISION | ✅ 2 partitions |
| Program sections | ✅ 58 partitions across Program0-Program5 |
| Sparse detection | ✅ 7 sparse images (modemdump, op2, super, metadata, userdata, oneplus_in, modem) |
| Total size | ✅ 6,008,700,564 bytes (5.60 GB) |

---

## Common Pitfalls & What NOT To Do

### 1. Treating mbox as packed u32 arrays

**WRONG:**
```rust
// This packs 4 bytes into one u32 — completely wrong!
let asbox_val = u32::from_le_bytes([0x60, 0x8a, 0x3f, 0x2d]); // = 0x2D3F8A60
```

**CORRECT:**
```rust
// Each entry is a single byte value (0-255)
let mbox: [u32; 62] = ...;
mbox[0] = 0x60_u32;  // just the byte value, not packed
mbox[1] = 0x8a_u32;
```

**Why:** Python lists of integers don't pack. `[0x60, 0x8a]` is two integers, not one `u16`.
When `key_update` does `iv1[0] ^ asbox[0]`, it XORs a `u32` with the byte value `0x60`, not
with `0x2D3F8A60`.

### 2. Only parsing `<File>` elements

**WRONG:**
```rust
// This only finds SAHARA + UFS_PROVISION entries (~4 partitions)
if tag == "File" { parse_file_element(...) }
```

**CORRECT:**
```rust
// Must also handle <Image> elements inside <program> tags
if tag == "File" { parse_file_element(...) }
else if tag == "Image" { parse_image_element(...) }
else if tag == "program" { current_program_label = get_label(...) }
```

**Why:** The actual firmware images (boot, super, recovery, etc.) are stored in `<Image>`
elements inside `<program>` tags in the `Program0`-`Program5` sections. Missing these
means you only find 4 of 62 partitions.

### 3. Computing XML offset from config_offset

**WRONG:**
```rust
let xml_start = footer.config_offset as usize * 0x200;
```

**CORRECT:**
```rust
let padding = if xml_length % 0x200 != 0 { 0x200 - (xml_length % 0x200) } else { 0 };
let aligned = xml_length + padding;
let xml_start = file_size - 0x200 - aligned as usize;
```

**Why:** The Python reference computes from the end of the file. Using `config_offset`
directly can produce wrong offsets for certain firmware versions.

### 4. Validating entire decrypted buffer as UTF-8

**WRONG:**
```rust
// Fails because sector-aligned padding contains invalid UTF-8 bytes
let xml = std::str::from_utf8(&decrypted)?;
```

**CORRECT:**
```rust
// Check only the header for XML marker, return lossy conversion
let header = &decrypted[..256.min(decrypted.len())];
if header.windows(4).any(|w| w == b"xml ") {
    return Some(String::from_utf8_lossy(&decrypted).into_owned());
}
```

**Why:** The encrypted XML region is sector-aligned (0x200). After the actual XML content,
the remaining padding bytes are encrypted garbage that doesn't decode as valid UTF-8.

### 5. Confusing mtk_shuffle and mtk_shuffle2

**WRONG:**
```rust
// These are NOT interchangeable
mtk_shuffle(key, data);   // swap_nibble THEN XOR
mtk_shuffle2(key, data);  // XOR THEN swap_nibble
```

**Why:** Key derivation uses `mtk_shuffle2` for deobfuscation. Using `mtk_shuffle` instead
produces wrong keys, and decryption fails silently (no crash, just wrong output).

### 6. Missing the sbox residual fallback

**WRONG:**
```rust
// Only using mbox for key_update in residual processing
rkey = key_update(rkey, &mbox);
```

**CORRECT:**
```rust
// Residual bytes use the FULL sbox array (2048 entries), not mbox
let sbox_arr = sbox_as_u32_array();  // [u32; 2048]
rkey = key_update(rkey, &sbox_arr);
```

**Why:** The Python code explicitly uses `key_update(rkey, sbox)` for residual bytes
(where `sbox` is the full 2048-byte lookup table), while the main loop uses `mbox`.

### 7. Using wrong sbox array size

**WRONG:**
```rust
fn sbox_as_u32_array() -> [u32; 512] {  // Too small!
```

**CORRECT:**
```rust
fn sbox_as_u32_array() -> [u32; 2048] {  // One u32 per byte of sbox.bin
```

**Why:** `sbox.bin` is 2048 bytes. The `key_update` function accesses indices via
`asbox[0x3c]` (index 60) for the rounds count. If the array is too small, you get
panics or wrong round counts.

### 8. Trying to stream-convert sparse images

**WRONG:**
```rust
// Cannot convert sparse during extraction — needs random access
while let Some(chunk) = read_next_chunk() {
    match chunk.type {
        DontCare => writer.seek(chunk.blocks * block_size), // FAILS: writer is append-only
```

**CORRECT:**
```rust
// Write sparse file first, then convert in a separate pass
writer.write_all(&data)?;
writer.flush()?;
drop(writer);
if partition.sparse { try_unsparse(&output_path)?; }
```

**Why:** Sparse images contain "Don't Care" chunks that require seeking past regions in
the output. The extraction writer is a `BufWriter` used in append mode. Un-sparsing must
happen as a post-processing step with a seekable file.

---

## Debugging Checklist

If OPS decryption isn't working:

1. **Check footer magic** — Should be `0x7CEF` at `file_size - 0x200 + 0x10`
2. **Check XML length** — `footer.xml_length` should be < 1 MB and > 100 bytes
3. **Check first 32 decrypted bytes** — Should start with `EF BB BF 3C 3F 78 6D 6C`
   (UTF-8 BOM + `<?xml`)
4. **Try all 3 mbox variants** — If mbox5 fails, try mbox6 and mbox4
5. **Verify sbox.bin** — Should be exactly 2048 bytes
6. **Print the mbox array** — Each entry should be 0-255, NOT packed u32 values
7. **Check XML element types** — Parse both `<File>` and `<Image>` elements
8. **Verify section tracking** — Current section name updates on `<Program0>`, `<SAHARA>`, etc.

If extraction produces wrong output:

1. **Check offset calculation** — `FileOffsetInSrc * SECTOR_SIZE` (sectors, not bytes)
2. **Check encryption flag** — Only SAHARA should be encrypted in OPS
3. **Check sparse flag** — Some images need un-sparsing after extraction
4. **Verify OFP partial encryption** — Only first `encrypted_length` bytes are AES-encrypted

---

## Reference Materials

### Source Code References

- **Python reference**: `docs/refrences/oppo_decrypt-master/opscrypto.py` — Original OPS
  cipher implementation by Bjoern Kerler
- **S-box data**: `src-tauri/src/payload/ops/sbox.bin` — 2048-byte lookup table extracted
  from `opscrypto.py`
- **Test firmware**: `docs/refrences/oppo_decrypt-master/instantnoodlep_*.ops` — OnePlus 8 Pro
  firmware used for verification

### External References

- [oppo_decrypt](https://github.com/niccholas4e/oppo_decrypt) — Python reference implementation
- [payload-dumper-go](https://github.com/niccholas4e/payload-dumper-go) — Go reference for CrAU
- [Android Sparse Image Format](https://android.googlesource.com/platform/system/core/+/refs/heads/main/libsparse/sparse_format.h) — Sparse header specification

---

*Last Updated: 2026-04-03*
