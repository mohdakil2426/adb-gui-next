# OPS/OFP Support — Implementation Plan

> **Goal:** Add OnePlus `.ops` and Oppo `.ofp` firmware extraction to the **existing Payload Dumper** UI — no separate view needed.

---

## Table of Contents

1. [Format Analysis](#1-format-analysis)
2. [Architecture Design](#2-architecture-design)
3. [Rust Backend Implementation](#3-rust-backend-implementation)
4. [Frontend Integration](#4-frontend-integration)
5. [Edge Cases & Error Handling](#5-edge-cases--error-handling)
6. [Testing Strategy](#6-testing-strategy)
7. [Implementation Phases](#7-implementation-phases)
8. [Risk Assessment](#8-risk-assessment)

---

## 1. Format Analysis

### 1.1 OnePlus OPS Format

The `.ops` format is a **proprietary encrypted container** used by the MSM Download Tool for EDL-mode flashing. Based on analysis of `opscrypto.py`:

#### Binary Layout

```
+--------------------------------------------------------------+
|                    OPS File Structure                         |
+--------------------------------------------------------------+
|  [0x000 .. data_end]      Encrypted/unencrypted partition    |
|                           data blocks (sequential, sector-   |
|                           aligned at 0x200-byte boundaries)  |
+--------------------------------------------------------------+
|  [data_end .. xml_start]  Encrypted settings.xml             |
|                           (padded to 0x200 boundary)         |
+--------------------------------------------------------------+
|  [filesize - 0x200]       512-byte FOOTER / HEADER           |
|  +- [+0x00] u32 LE        unknown (=2)                      |
|  +- [+0x04] u32 LE        unknown (=1)                      |
|  +- [+0x08] u32 LE        reserved (=0)                     |
|  +- [+0x0C] u32 LE        reserved (=0)                     |
|  +- [+0x10] u32 LE        magic = 0x7CEF                    |
|  +- [+0x14] u32 LE        config_offset (sector count)      |
|  +- [+0x18] u32 LE        xml_length (bytes)                |
|  +- [+0x1C .. +0x2C]      project_id (16 bytes, NUL-padded) |
|  +- [+0x2C .. EOF]        firmware_name (NUL-padded to 0x200)|
|  +- Total: 0x200 bytes                                      |
+--------------------------------------------------------------+
```

#### Encryption

- **Algorithm:** Custom AES-like cipher (NOT standard AES-CBC/CFB/CTR)
  - Uses a custom S-box lookup table (`sbox` — 2048-byte pre-computed table)
  - Uses `key_update()` function that performs 8-10 rounds of S-box transforms
  - Uses `key_custom()` for streaming XOR-based encryption/decryption
- **Key:** Fixed 128-bit key: `d1b5e39e5eea049d671dd5abd2afcbaf` (4 x u32 LE)
- **Key schedule variants (mbox):** Three known key schedules determine the encryption mode:
  - `mbox4` — used for OnePlus 7 era (guacamolet)
  - `mbox5` — used for OnePlus 7/7T era (guacamoles) — **most common**
  - `mbox6` — used for OnePlus 8/8T era (instantnoodlev)
- **Detection:** Try all 3 mbox variants -> check if decrypted data contains `"xml "` string

#### XML Manifest (settings.xml)

The decrypted XML has this structure:

```xml
<Sahara>
  <BasicInfo Project="18801" Version="firmware_name" />
  <SAHARA>
    <File Path="xbl.elf" FileOffsetInSrc="0" SizeInSectorInSrc="1234"
          SizeInByteInSrc="632832" />
    <!-- Encrypted with key_custom -> decryptfile() -->
  </SAHARA>
  <UFS_PROVISION>
    <File Path="provision.xml" FileOffsetInSrc="..." SizeInByteInSrc="..." />
    <!-- Raw copy, no encryption -> copyfile() -->
  </UFS_PROVISION>
  <Program_0>
    <File filename="boot.img" sparse="false" FileOffsetInSrc="..."
          SizeInSectorInSrc="..." SizeInByteInSrc="..." Sha256="..." />
    <!-- Raw copy -> copyfile(), SHA-256 verified -->
  </Program_0>
</Sahara>
```

**Key observations:**
- `FileOffsetInSrc` is in **sectors** (multiply by 0x200 = 512 bytes)
- `SizeInByteInSrc` is the actual file size
- `SizeInSectorInSrc` is sector-aligned size
- **SAHARA section** files are **encrypted** -> need `decryptfile()`
- **UFS_PROVISION** files are **plain** -> raw copy
- **Program_N** files are **plain** -> raw copy + optional SHA-256 verification
- Files may be **sparse images** (`sparse="true"`) -> needs Android sparse image handling

#### Sparse Image Support

OPS files may contain Android sparse images (magic: `0xED26FF3A`). The `QCSparse` class in the reference handles:

- **Raw chunks** (`0xCAC1`) — direct data copy
- **Fill chunks** (`0xCAC2`) — 4-byte fill pattern repeated
- **Don't Care chunks** (`0xCAC3`) — zero-filled regions
- **CRC32 chunks** (`0xCAC4`) — integrity check data

### 1.2 Oppo OFP Format (Qualcomm)

Based on `ofp_qc_decrypt.py`:

#### Binary Layout

```
+--------------------------------------------------------------+
|                     OFP QC File Structure                    |
+--------------------------------------------------------------+
|  [0x000 .. data_end]      AES-CFB encrypted + raw partition  |
|                           data blocks                        |
+--------------------------------------------------------------+
|  [filesize - pagesize]    Footer (pagesize = 0x200 or 0x1000)|
|  +- [+0x10] u32 LE        magic = 0x7CEF                    |
|  +- [+0x14] u32 LE        xml_offset (in pages)             |
|  +- [+0x18] u32 LE        xml_length (bytes)                |
|  +- Total: pagesize bytes                                   |
+--------------------------------------------------------------+
```

#### Encryption

- **Algorithm:** Standard AES-128-CFB (segment_size=128), via `pycryptodome`
- **Key derivation:** 7 known key triplets -> deobfuscation via `ROL(4)` + XOR -> MD5 -> first 16 chars
- **Brute-force detection:** Try all key triplets until `<?xml` appears in decrypted data
- **Partial encryption:** Only first `0x40000` bytes (256 KiB) of each partition are encrypted; remainder is plaintext
- **Page size:** Either `0x200` (512) or `0x1000` (4096) — detected by scanning footer

#### XML Manifest

Similar to OPS but uses `<?xml ...>` format with:
- `Sahara`, `Config`, `Provision`, `ChainedTableOfDigests`, `DigestsToSign`, `Firmware`, `Program_N` sections
- Attributes: `Path`, `filename`, `sha256`, `md5`, `FileOffsetInSrc`, `SizeInByteInSrc`, `SizeInSectorInSrc`

### 1.3 Oppo OFP Format (MediaTek)

Based on `ofp_mtk_decrypt.py`:

#### Binary Layout

```
+--------------------------------------------------------------+
|                    OFP MTK File Structure                    |
+--------------------------------------------------------------+
|  [0x000 .. data_end]      AES-CFB encrypted header + raw    |
|                           partition data blocks              |
+--------------------------------------------------------------+
|  [filesize - hdr2len - 0x6C]  Entry Table (hdr2)            |
|                           (mtk_shuffle obfuscated)          |
|  Each entry: 0x60 bytes:                                    |
|  +- [32B] name                                              |
|  +- [8B] start offset                                       |
|  +- [8B] total length                                       |
|  +- [8B] encrypted length                                   |
|  +- [32B] filename                                          |
|  +- [8B] CRC                                                |
+--------------------------------------------------------------+
|  [filesize - 0x6C]        Primary header (0x6C bytes)        |
|  (mtk_shuffle obfuscated with key "geyixue")               |
|  +- [46B] project name                                      |
|  +- [8B] unknown val                                        |
|  +- [4B] reserved                                           |
|  +- [7B] CPU                                                |
|  +- [5B] flash type                                         |
|  +- [2B] hdr2 entry count                                   |
|  +- [32B] project info                                      |
|  +- [2B] CRC                                                |
+--------------------------------------------------------------+
```

#### Encryption

- **Algorithm:** AES-128-CFB + `mtk_shuffle` obfuscation
- **Key detection:** 9 known key sets -> brute-force against first 16 bytes -> check for `"MMM"` magic
- **Partial encryption:** Each partition entry has an `enclength` field — only that many bytes are AES-encrypted

### 1.4 ZIP Wrapping

Some OFP files are actually ZIP files (password-protected):
- **Detection:** First 2 bytes = `"PK"` (`0x504B`)
- **Password:** `flash@realme$50E7F7D847732396F1582CD62DD385ED7ABB0897`

---

## 2. Architecture Design

### 2.1 Module Structure (Rust)

```
src-tauri/src/payload/
+-- mod.rs              # (MODIFY) -- add `ops` module
+-- ops/                # NEW MODULE
|   +-- mod.rs          # re-exports, format detection
|   +-- detect.rs       # Magic detection (OPS vs OFP-QC vs OFP-MTK vs ZIP-OFP)
|   +-- crypto.rs       # Custom AES-like cipher for OPS, AES-CFB for OFP
|   +-- ops_parser.rs   # OPS footer parsing, XML decryption, manifest parsing
|   +-- ofp_qc.rs       # OFP Qualcomm format handler
|   +-- ofp_mtk.rs      # OFP MediaTek format handler
|   +-- extractor.rs    # Unified extraction (encrypted + copy + SHA-256)
|   +-- sparse.rs       # Android sparse image un-sparsing
+-- parser.rs           # (UNCHANGED) -- CrAU parsing
+-- extractor.rs        # (UNCHANGED) -- CrAU extraction
+-- zip.rs              # (MODIFY) -- extend to handle .ops/.ofp alongside .zip
+-- ...
```

### 2.2 Format Detection Flow

```
                         User selects file
                              |
                    +---------+-----------+
                    | detect_format()     |
                    +---------+-----------+
                              |
              +---------------+----------------+
              |               |                |
         +----+----+    +-----+-----+    +-----+-----+
         |  CrAU   |    | OPS/OFP   |    | Unknown   |
         | (magic  |    | (magic    |    | -> Error  |
         | "CrAU") |    | 0x7CEF @  |    |           |
         |         |    | footer)   |    |           |
         +----+----+    +-----+-----+    +-----------+
              |               |
     [existing flow]     +----+--------------------+
                         | detect_subtype()        |
                         | "PK" -> ZIP(OFP)        |
                         | "MMM" @ 0 -> MTK        |
                         | mbox try -> OPS         |
                         | <?xml try -> OFP-QC     |
                         +-------------------------+
```

### 2.3 Data Flow (OPS/OFP Extraction)

```
                 +-------------------------------------+
                 | OpsPayloadFile (mmap + footer)      |
                 +----------------+--------------------+
                                  |
                 +----------------+--------------------+
                 | Decrypt settings.xml / manifest     |
                 | (try mbox5 -> mbox6 -> mbox4)       |
                 +----------------+--------------------+
                                  |
                 +----------------+--------------------+
                 | Parse XML -> Vec<OpsPartition>      |
                 | {name, offset, size, encrypted,     |
                 |  sha256, sparse}                    |
                 +----------------+--------------------+
                                  |
                 +----------------+--------------------+
                 | list_ops_partitions() -> FE         |
                 | [PartitionDetail]                   |
                 +----------------+--------------------+
                                  |
                 +----------------+--------------------+
                 | extract_ops_partitions()            |
                 | Per partition (parallel):           |
                 |  +- SAHARA -> decrypt key_custom    |
                 |  +- Program -> raw copy             |
                 |  +- UFS_PROVISION -> raw copy       |
                 |  +- Sparse? -> unsparse             |
                 |  +- SHA-256 verify                  |
                 +-------------------------------------+
```

### 2.4 Unified Partition Interface

Both CrAU (payload.bin) and OPS/OFP produce the same frontend type:

```rust
// Already exists -- reused as-is
pub struct PartitionDetail {
    pub name: String,
    pub size: u64,
}
```

The frontend doesn't need to know which format it's dealing with. The backend dispatches based on detected format.

---

## 3. Rust Backend Implementation

### 3.1 New Types

```rust
// src-tauri/src/payload/ops/mod.rs

/// Detected firmware container format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FirmwareFormat {
    /// Standard Android OTA payload (CrAU header)
    PayloadBin,
    /// OnePlus .ops encrypted container
    Ops,
    /// Oppo .ofp Qualcomm variant
    OfpQualcomm,
    /// Oppo .ofp MediaTek variant
    OfpMediaTek,
    /// ZIP-wrapped OFP (password-protected)
    ZipOfp,
}

/// A partition entry parsed from OPS/OFP XML manifest.
#[derive(Debug, Clone)]
pub struct OpsPartitionEntry {
    /// Display name (used for output filename: "{name}.img")
    pub name: String,
    /// Byte offset into the container file
    pub offset: u64,
    /// Actual data size in bytes
    pub size: u64,
    /// Sector-aligned size (for reads)
    pub sector_size: u64,
    /// Whether this partition's data is encrypted (SAHARA section)
    pub encrypted: bool,
    /// Expected SHA-256 hash (empty string = no hash)
    pub sha256: String,
    /// Whether the partition contains an Android sparse image
    pub sparse: bool,
    /// Section type from XML (for logging/metadata)
    pub section: String,
}

/// OPS file footer (last 0x200 bytes of file).
#[derive(Debug)]
pub struct OpsFooter {
    pub magic: u32,            // 0x7CEF
    pub config_offset: u32,    // sector offset to encrypted XML
    pub xml_length: u32,       // byte length of XML
    pub project_id: String,    // 16-byte NUL-padded string
    pub firmware_name: String, // remaining bytes to 0x200
}

/// Metadata about an OPS/OFP file (surfaced to UI).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsMetadata {
    pub format: String,           // "ops", "ofp-qualcomm", "ofp-mediatek"
    pub project_id: Option<String>,
    pub firmware_name: Option<String>,
    pub cpu: Option<String>,        // MTK only
    pub flash_type: Option<String>, // MTK only
    pub encryption: String,         // "custom-aes(mbox5)", "aes-128-cfb", etc.
    pub total_partitions: usize,
    pub total_size: u64,
    pub sections: Vec<String>,      // e.g. ["SAHARA", "UFS_PROVISION", "Program_0"]
}
```

### 3.2 Format Detection

```rust
// src-tauri/src/payload/ops/detect.rs

/// Detect the firmware format of a file.
///
/// Strategy:
/// 1. Check CrAU magic at offset 0 -> PayloadBin
/// 2. Check "PK" magic at offset 0 -> ZipOfp (password-protected ZIP)
/// 3. Check 0x7CEF magic at footer -> OPS or OFP-QC
/// 4. Try MTK header detection -> OfpMediaTek
/// 5. Otherwise -> Error
pub fn detect_format(data: &[u8], file_size: u64) -> Result<FirmwareFormat>;
```

### 3.3 Crypto Module

```rust
// src-tauri/src/payload/ops/crypto.rs

/// OPS custom AES-like cipher (from opscrypto.py key_custom + key_update).
/// Pure Rust port -- no external crypto dependency needed for OPS.
pub struct OpsCipher {
    sbox: &'static [u8; 2048],
    mbox: [u8; 62],
    key: [u32; 4],
}

impl OpsCipher {
    pub fn new(mbox_variant: MboxVariant) -> Self;
    /// Decrypt data in-place using the custom streaming cipher.
    pub fn decrypt(&self, data: &[u8]) -> Vec<u8>;
    /// Try to decrypt the XML footer with this mbox variant.
    /// Returns Some(xml_string) if decrypted data contains "xml ".
    pub fn try_decrypt_xml(&self, data: &[u8]) -> Option<String>;
}

/// OFP AES-CFB cipher (standard AES-128-CFB-128).
/// Uses the `aes` + `cfb-mode` crates (pure Rust, no OpenSSL).
pub struct OfpCipher {
    key: [u8; 16],
    iv: [u8; 16],
}

/// The 3 known mbox key schedule variants for OPS decryption.
#[derive(Debug, Clone, Copy)]
pub enum MboxVariant {
    Mbox4, // guacamolet (OP7)
    Mbox5, // guacamoles (OP7/7T) -- most common
    Mbox6, // instantnoodlev (OP8/8T)
}

/// MTK shuffle obfuscation (nibble swap + XOR).
pub fn mtk_shuffle(key: &[u8], data: &mut [u8]);
```

### 3.4 Parser Module

```rust
// src-tauri/src/payload/ops/ops_parser.rs

/// Parse an OPS file: read footer, decrypt XML, parse manifest.
pub fn parse_ops(mmap: &[u8], file_size: u64) -> Result<(Vec<OpsPartitionEntry>, OpsMetadata)>;

/// Parse the 0x200-byte footer at the end of the file.
fn parse_footer(data: &[u8]) -> Result<OpsFooter>;

/// Try all mbox variants to decrypt the XML manifest.
fn decrypt_xml(mmap: &[u8], footer: &OpsFooter) -> Result<(String, MboxVariant)>;

/// Parse the decrypted XML into partition entries.
fn parse_manifest_xml(xml: &str) -> Result<Vec<OpsPartitionEntry>>;
```

### 3.5 OFP Handlers

```rust
// src-tauri/src/payload/ops/ofp_qc.rs

/// Parse an OFP (Qualcomm) file.
pub fn parse_ofp_qc(mmap: &[u8], file_size: u64)
    -> Result<(Vec<OpsPartitionEntry>, OpsMetadata, OfpCipher)>;

/// Detect page size (0x200 or 0x1000) by scanning for 0x7CEF magic.
fn detect_page_size(data: &[u8], file_size: u64) -> Result<u64>;

/// Try all 7 known key sets to decrypt XML.
fn try_all_keys(data: &[u8], pagesize: u64, file_size: u64)
    -> Result<(OfpCipher, String)>;
```

```rust
// src-tauri/src/payload/ops/ofp_mtk.rs

/// Parse an OFP (MediaTek) file.
pub fn parse_ofp_mtk(mmap: &[u8], file_size: u64)
    -> Result<(Vec<OpsPartitionEntry>, OpsMetadata)>;

/// Read, un-shuffle, and parse the primary footer header.
fn parse_mtk_header(data: &[u8], file_size: u64) -> Result<MtkHeader>;

/// Read, un-shuffle, and parse the entry table.
fn parse_mtk_entries(data: &[u8], file_size: u64, header: &MtkHeader)
    -> Result<Vec<OpsPartitionEntry>>;
```

### 3.6 Extractor Module

```rust
// src-tauri/src/payload/ops/extractor.rs

/// Extract selected partitions from an OPS/OFP file.
/// Reuses the same `ExtractPayloadResult` type and `payload:progress` events.
pub fn extract_ops_partitions(
    mmap: &Arc<Mmap>,
    partitions: &[OpsPartitionEntry],
    selected: &[String],
    output_dir: &Path,
    format: FirmwareFormat,
    cipher: Option<&OpsCipher>,     // OPS only
    ofp_cipher: Option<&OfpCipher>, // OFP-QC only
    app_handle: Option<tauri::AppHandle>,
    progress: impl FnMut(&str, usize, usize, bool),
) -> Result<ExtractPayloadResult>;
```

### 3.7 Sparse Image Handler

```rust
// src-tauri/src/payload/ops/sparse.rs

/// Android sparse image magic.
const SPARSE_MAGIC: u32 = 0xED26FF3A;

/// Check if data begins with sparse image magic.
pub fn is_sparse(data: &[u8]) -> bool;

/// Un-sparse an Android sparse image to a writer.
/// Handles: Raw (0xCAC1), Fill (0xCAC2), DontCare (0xCAC3), CRC32 (0xCAC4).
pub fn unsparse<R: Read, W: Write + Seek>(reader: &mut R, writer: &mut W) -> Result<u64>;
```

### 3.8 Command Dispatch Strategy

**Recommended approach: Unified dispatch.** Instead of adding new Tauri commands, extend the existing `list_payload_partitions_with_details` and `extract_payload` to auto-detect format.

```rust
// Modified flow in commands/payload.rs

pub async fn list_payload_partitions_with_details(...) -> CmdResult<Vec<PartitionDetail>> {
    let path = Path::new(&payload_path.trim());

    // 1. Try OPS/OFP detection first (by extension or magic)
    if is_ops_or_ofp(path) {
        return list_ops_partitions_internal(path).await;
    }

    // 2. Fall through to existing CrAU flow
    // ... existing code ...
}

pub async fn extract_payload(...) -> CmdResult<ExtractPayloadResult> {
    // 1. Detect format
    if is_ops_or_ofp(path) {
        return extract_ops_internal(path, output_dir, selected, app).await;
    }

    // 2. Fall through to existing flow
    // ... existing code ...
}
```

This avoids adding new Tauri commands and means the frontend needs minimal changes. The format detection is transparent — users select a file, and the backend figures out what to do.

### 3.9 New Cargo Dependencies

```toml
# src-tauri/Cargo.toml -- new deps for OPS/OFP support

[dependencies]
aes = "0.8"          # AES block cipher (for OFP AES-CFB)
cfb-mode = "0.8"     # CFB mode of operation
md-5 = "0.10"        # MD5 hashing (OFP key derivation)
quick-xml = "0.36"   # XML parsing (for OPS/OFP manifests)
```

> Note: The OPS custom cipher is NOT standard AES -- it's a custom S-box cipher ported directly to Rust. No AES crate needed for OPS. The `aes` + `cfb-mode` crates are only for OFP Qualcomm/MTK.

---

## 4. Frontend Integration

### 4.1 Strategy: Zero New Views

The core insight: **OPS/OFP files produce the same output as payload.bin** -- a list of partition names with sizes, extractable to `.img` files. The existing Payload Dumper UI already handles this perfectly:

1. **File picker** -> extend supported extensions
2. **Partition list** -> identical `PartitionDetail[]` format
3. **Extraction** -> identical `ExtractPayloadResult` format
4. **Progress** -> identical `payload:progress` events

### 4.2 Changes Required

#### `backend.ts` -- File Picker Extension

```diff
 export function SelectPayloadFile(): Promise<string> {
   return selectFile({
     filters: [
       {
         name: 'Payload files',
-        extensions: ['bin', 'zip'],
+        extensions: ['bin', 'zip', 'ops', 'ofp'],
       },
     ],
   });
 }
```

#### `PayloadSourceTabs.tsx` -- Drop Zone Extension

```diff
 // Accept .ops and .ofp files in drag-and-drop
 const isPayloadFile = (path: string) => {
   const ext = path.toLowerCase().split('.').pop();
-  return ['bin', 'zip'].includes(ext || '');
+  return ['bin', 'zip', 'ops', 'ofp'].includes(ext || '');
 };
```

#### `usePayloadActions.ts` -- No Changes Needed

If using the unified dispatch approach (recommended), the action hooks remain unchanged. `ListPayloadPartitionsWithDetails()` and `ExtractPayload()` call the same Tauri commands -- the backend dispatches internally.

#### `FileBanner.tsx` -- Format Badge

Add a format indicator badge (detected from file extension or backend metadata):

```tsx
// Show format type in the banner
<Badge variant="outline">
  {payloadPath.endsWith('.ops') ? 'OnePlus OPS' :
   payloadPath.endsWith('.ofp') ? 'Oppo OFP' :
   isRemote ? 'Remote OTA' : 'Android OTA'}
</Badge>
```

#### `payloadDumperStore.ts` -- Metadata Extension

```typescript
// Add format-specific metadata
interface PayloadDumperState {
  // ... existing ...
  firmwareFormat: 'payload-bin' | 'ops' | 'ofp-qualcomm' | 'ofp-mediatek' | null;
  opsMetadata: OpsMetadata | null;
}
```

### 4.3 View Description Update

```diff
 <p className="text-sm text-muted-foreground">
-  Extract partition images from Android OTA payload.bin files
+  Extract partition images from OTA payload.bin, OnePlus .ops, and Oppo .ofp files
 </p>
```

### 4.4 OPS/OFP Metadata Panel

If an OPS/OFP file is loaded, show a metadata section (similar to `FileBannerDetails.tsx`):

- **Format**: OnePlus OPS / Oppo OFP-QC / Oppo OFP-MTK
- **Project ID** (OPS)
- **Firmware Version** (OPS)
- **CPU/Flash Type** (OFP-MTK)
- **Encryption**: Custom AES (mbox5) / AES-128-CFB
- **Sections**: SAHARA, Program_0, UFS_PROVISION, etc.

---

## 5. Edge Cases & Error Handling

### 5.1 Encryption Key Detection Failures

| Scenario | Handling |
|----------|----------|
| OPS: None of mbox4/5/6 works | Return clear error: "Unsupported OPS encryption key. This firmware may require a newer key variant." |
| OFP-QC: None of 7 key sets works | Return: "Unsupported OFP encryption. Version not recognized." |
| OFP-MTK: None of 9 key sets works | Return: "Unknown MTK encryption key." |
| ZIP-OFP: Password doesn't match | Return: "Protected OFP ZIP -- password not recognized." |

### 5.2 Corrupt or Truncated Files

| Scenario | Handling |
|----------|----------|
| Footer magic not 0x7CEF | Bail with "Invalid OPS/OFP file: footer magic not found" |
| XML decrypted but not valid XML | Bail with "OPS decryption succeeded but manifest is corrupt" |
| Partition offset exceeds file size | Skip partition, log warning, continue extraction |
| SHA-256 mismatch on extracted file | Log warning, mark partition as "extracted with hash error" in progress event |
| Sparse image header invalid | Skip un-sparsing, output raw sparse image with warning |
| File size < 0x200 (minimum footer) | Bail immediately: "File too small to be OPS/OFP" |

### 5.3 Large File Handling

| Scenario | Handling |
|----------|----------|
| 6+ GB OPS files | Use `mmap` -- same as existing payload.bin handling |
| Many partitions (30+) | Parallel extraction via `std::thread::scope` -- same as existing |
| Slow disk during sparse un-sparsing | Streaming with 256 KiB buffer -- same pattern as CrAU |

### 5.4 Format Ambiguity

| Scenario | Handling |
|----------|----------|
| `.bin` file that's actually OPS | Check CrAU magic first; if not CrAU, check 0x7CEF footer |
| `.zip` file with OFP inside | Check for `"PK"` magic -> try as OTA ZIP first; if no `payload.bin`, try OFP ZIP password |
| `.ops` extension but actually a ZIP | Check first 2 bytes for `"PK"` -> handle accordingly |
| Random binary file | Return clear format-not-recognized error |

### 5.5 Security Considerations

| Risk | Mitigation |
|------|-----------|
| Path traversal from XML filenames | Sanitize: `Path::file_name()` only, strip `..`, `/`, `\` |
| XML billion laughs / entity expansion | Use `quick-xml` (SAX-style) or disable DTD processing |
| Memory exhaustion from large XML | XML is typically < 100 KB; set max length guard (1 MB) |
| Sparse image with overflow | Validate `total_blks * blk_sz` against available file size |
| Malicious SHA-256 in XML | SHA-256 is for verification only -- no security impact |

### 5.6 Concurrent Access

| Scenario | Handling |
|----------|----------|
| User resets while extraction running | Existing `cancelLoadingRef` pattern applies |
| Same file opened twice | `PayloadCache` mutex prevents race conditions |
| mmap held during extraction | `Arc<Mmap>` shared safely across threads |

---

## 6. Testing Strategy

### 6.1 Unit Tests

```rust
// src-tauri/src/payload/ops/tests.rs

#[test] fn detect_ops_format() { /* footer magic detection */ }
#[test] fn detect_ofp_qc_format() { /* page size + magic detection */ }
#[test] fn detect_ofp_mtk_format() { /* MTK header detection */ }
#[test] fn parse_ops_footer() { /* footer struct parsing */ }
#[test] fn ops_cipher_encrypt_decrypt_roundtrip() { /* all 3 mbox variants */ }
#[test] fn ofp_cipher_encrypt_decrypt_roundtrip() { /* AES-CFB */ }
#[test] fn mtk_shuffle_roundtrip() { /* nibble swap + XOR */ }
#[test] fn parse_ops_manifest_xml() { /* XML -> OpsPartitionEntry */ }
#[test] fn sparse_magic_detection() { /* 0xED26FF3A */ }
#[test] fn sparse_unsparse_raw_chunk() { /* 0xCAC1 */ }
#[test] fn sparse_unsparse_fill_chunk() { /* 0xCAC2 */ }
#[test] fn sparse_unsparse_dont_care_chunk() { /* 0xCAC3 */ }
#[test] fn sha256_verification() { /* correct and incorrect */ }
#[test] fn path_sanitization() { /* "../" and absolute paths stripped */ }
#[test] fn xml_max_length_guard() { /* > 1 MB XML rejected */ }
```

### 6.2 Integration Tests

Require real `.ops`/`.ofp` files:
- List partitions from OPS file
- Extract single partition
- Extract all partitions
- Verify SHA-256 on extracted files
- OFP-QC extraction with key detection
- OFP-MTK extraction
- ZIP-wrapped OFP extraction

### 6.3 Frontend Tests

Minimal -- the UI changes are mostly extension additions:
- Verify `.ops`/`.ofp` appears in file picker filter
- Verify drag-drop accepts `.ops`/`.ofp`
- Verify format badge renders correctly

---

## 7. Implementation Phases

### Phase 1: Format Detection & Infrastructure (Day 1)

- [ ] Create `src-tauri/src/payload/ops/` module structure
- [ ] Implement `detect_format()` with magic byte detection
- [ ] Add `quick-xml` dependency to `Cargo.toml`
- [ ] Create `OpsPartitionEntry`, `OpsFooter`, `OpsMetadata` types
- [ ] Update `payload/mod.rs` to export `ops` module
- [ ] Write detection unit tests
- [ ] Run `pnpm check`

### Phase 2: OPS Crypto & Parser (Day 2)

- [ ] Port the S-box table (2048 bytes) to Rust `const` array
- [ ] Port 3 mbox key schedule variants to Rust
- [ ] Implement `gsbox()`, `key_update()`, `key_custom()` in Rust
- [ ] Implement `OpsCipher::decrypt()` and `try_decrypt_xml()`
- [ ] Implement `parse_footer()` and `decrypt_xml()`
- [ ] Implement `parse_manifest_xml()` with `quick-xml`
- [ ] Write cipher roundtrip tests + XML parsing tests
- [ ] Run `pnpm check`

### Phase 3: OPS Extraction (Day 3)

- [ ] Implement `extract_ops_partitions()` with parallel extraction
- [ ] Handle encrypted (SAHARA) vs raw (Program/UFS) sections
- [ ] Add SHA-256 verification for Program partitions
- [ ] Implement path sanitization for XML filenames
- [ ] Wire into unified dispatch in `commands/payload.rs`
- [ ] Emit `payload:progress` events (same format as CrAU)
- [ ] Write extraction unit tests
- [ ] Run `pnpm check`

### Phase 4: Sparse Image Support (Day 3-4)

- [ ] Implement `is_sparse()` detection
- [ ] Implement `unsparse()` with 4 chunk types
- [ ] Post-extraction check: if extracted file is sparse -> unsparse to final img
- [ ] Write sparse unit tests (with known test vectors)
- [ ] Run `pnpm check`

### Phase 5: OFP Support (Day 4-5)

- [ ] Add `aes`, `cfb-mode`, `md-5` dependencies
- [ ] Implement OFP-QC key derivation (`deobfuscate()` + MD5)
- [ ] Implement OFP-QC format detection and extraction
- [ ] Implement OFP-MTK `mtk_shuffle()` and header parsing
- [ ] Implement OFP-MTK extraction
- [ ] Implement ZIP-OFP password detection and unwrapping
- [ ] Write OFP unit tests
- [ ] Run `pnpm check`

### Phase 6: Frontend Integration (Day 5)

- [ ] Extend `SelectPayloadFile()` to accept `.ops`/`.ofp`
- [ ] Extend drag-drop acceptance
- [ ] Add format badge to `FileBanner.tsx`
- [ ] Add OPS metadata section to `FileBannerDetails.tsx`
- [ ] Update view subtitle text
- [ ] Update store with format-specific metadata
- [ ] Run `pnpm check`

### Phase 7: Polish & Docs (Day 6)

- [ ] Update memory bank (activeContext, systemPatterns, progress, techContext)
- [ ] Run full quality gates: `pnpm format:check` -> `pnpm lint` -> `pnpm build`
- [ ] Manual testing with real OPS/OFP files
- [ ] Update AGENTS.md if command count changes
- [ ] Update docs/descriptions

---

## 8. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Custom OPS cipher bugs | Corrupt extractions | Port directly from Python; test with known test vectors; validate SHA-256 |
| New mbox variants (post-OP8T) | Can't decrypt newer OPS | Design for extensibility -- mbox array is config, not code. Log clear error. |
| Large file performance (8+ GB) | Slow extraction | mmap + parallel extraction (proven pattern from CrAU) |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `quick-xml` parsing edge cases | Manifest parse failure | Defensive parsing with `?` propagation; log unparseable elements |
| AES-CFB implementation differences | OFP decryption fails | Use well-tested `aes` + `cfb-mode` crates; validate against Python output |
| Sparse image format variants | Incomplete unsparse | Fall back to raw sparse image with warning |
| New OFP key variants | Can't decrypt newer OFP | 7+9 known keys covers most devices; design for extension |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Frontend regressions | UI breakage | Changes are additive (filter extension, badge) -- no layout changes |
| Cargo dependency conflicts | Build failure | `aes`, `cfb-mode`, `md-5` are from RustCrypto -- well-maintained, compatible |
| `cargo test` Windows crash | False negatives | Pre-existing issue -- OPS tests will use mocks, not full Tauri runtime |

---

## Appendix A: Key Constants (from opscrypto.py)

```
Fixed key:    d1b5e39e 5eea049d 671dd5ab d2afcbaf (u32 LE x 4)
Mbox5[0:16]: 608a3f2d 686bd423 510cd095 bb40e976
Mbox6[0:16]: aa69829e 5ddeb13d 30bb81a3 4665a3e1
Mbox4[0:16]: c45d0571 99ddbbee 29a16dc7 adbfa43f
S-box:        2048 bytes (see opscrypto.py line 80-143)
OPS magic:    0x7CEF
Sparse magic: 0xED26FF3A
```

## Appendix B: File Extension Decision Matrix

| Extension | Detection | Handler |
|-----------|-----------|---------|
| `.bin` | CrAU magic -> payload.bin; 0x7CEF footer -> OPS/OFP | CrAU or OPS |
| `.zip` | `payload.bin` entry -> OTA ZIP; `PK` + password -> OFP ZIP | Existing or OFP-ZIP |
| `.ops` | 0x7CEF footer -> OPS; `PK` -> ZIP-wrapped | OPS parser |
| `.ofp` | 0x7CEF + AES-CFB -> QC; `MMM` -> MTK; `PK` -> ZIP | OFP-QC, OFP-MTK, or ZIP |

---

*Last Updated: 2026-04-03*
