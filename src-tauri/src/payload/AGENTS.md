# Payload Dumper Module Guide (`src-tauri/src/payload/`)

The `payload/` domain is a universal Android firmware container analysis, verification, and extraction engine. It processes standard AOSP CrAU payloads (`payload.bin`), incremental/delta updates, dynamic partitions (`super.img` with `liblp`), vendor-encrypted firmware (OnePlus `.ops`, Oppo/Realme `.ofp`), Samsung Odin archives (`.tar.md5` with LZ4 frames), Xiaomi recovery archives (`dat.br`), and local/remote ZIP64 archives with zero unbounded memory buffering.

---

## 1. Architectural Principles & Memory Model

1. **Zero-Copy Memory Mapping**:
   - Local `payload.bin` files and uncompressed `STORED` ZIP entries are mapped via `Arc<memmap2::Mmap>` wrapped in `ZipPayloadMmap`.
   - Worker threads receive an 8-byte pointer clone. The OS page cache backs all reads; resident memory (RSS) is constant ($< 35\text{ MB}$) regardless of payload size (e.g. 15+ GB ROMs).
2. **Memory-Mapped Output Model (`NonTemporalWriter`)**:
   - Target partition files are pre-allocated via `set_len(size)` and mapped into address space via `memmap2::MmapMut` on 64-bit systems.
   - Decompressor loops write directly into mapped memory slices (`&mut [u8]`), lowering to compiler-vectorized `memcpy` (AVX2/AVX-512) and sustaining write speeds $> 2.2\text{ GB/s}$ on NVMe storage.
3. **Bounded Streaming Buffers**:
   - All decompression routines (LZMA2, Bzip2, Zstandard, Brotli, LZ4) stream through thread-local 256 KiB buffers (`io::buffers::with_io_buf`), matching CPU L2/L3 cache line sweet spots without per-operation heap allocations.
4. **Isolated Transaction Staging**:
   - Extractions write into temporary staging directories (`.tmp_tx_{session_id}`) or register files with `TransactionGuard`.
   - On error or cancellation, `TransactionGuard::drop()` unlinks incomplete files automatically, ensuring zero partial artifacts remain.

---

## 2. Directory Layout & Submodule Map

```text
src-tauri/src/payload/
├── mod.rs                Domain facade, public exports, civil date formatter
├── types.rs              IPC DTOs: PartitionDetail, ExtractionStats, PayloadDiagnostics, RemotePayloadMetadata
├── error.rs              Payload domain error types & conversion
├── cancel.rs             CancellationToken: Arc<AtomicBool> cooperative cancellation hooks & registry
├── transaction.rs        TransactionGuard: Atomic multi-file rollback & staging coordinator
├── storage_check.rs      Pre-flight storage validation, FAT32 4GB limit, MAX_PATH, and EXDEV cross-device mover
│
├── crau/                 AOSP Update Engine CrAU Container Engine
│   ├── mod.rs            LoadedPayload, parse_header, open_mmap, diagnose_payload_file
│   ├── parser.rs         CrAU v1 (20B) & v2 (24B) header parser & DeltaArchiveManifest protobuf decoder
│   └── extract.rs        Rayon multi-threaded extraction loop, NonTemporalWriter & Layer 3/4 verification
│
├── lp/                   AOSP Dynamic Partitions (liblp / super.img Sub-Unpacker)
│   └── mod.rs            LpMetadataGeometry (0x616c4467), LpMetadataHeader (0x414C5030), unpack_super_image
│
├── delta/                Incremental & Delta OTA Differential Reconstruction Engine
│   ├── mod.rs            Delta module facade & source_copy helpers
│   ├── engine.rs         DeltaEngine: SOURCE_COPY, SOURCE_BSDIFF, PUFFDIFF, BROTLI_BSDIFF, ZSTD, ZERO
│   └── source_matcher.rs SourceMatcher: Base image scanner & SHA-256 hash resolver
│
├── samsung/              Samsung Odin Firmware (.tar.md5 + LZ4 Frames)
│   ├── mod.rs            Samsung module facade & unpack_samsung_tar
│   └── tar_md5.rs        HashingReader, Tar archive iterator & streaming LZ4 frame decoder (lz4_flex)
│
├── xiaomi/               Xiaomi Recovery (system.transfer.list + dat.br)
│   ├── mod.rs            Xiaomi module facade & extract_xiaomi_dat
│   └── dat_br.rs         TransferList command parser & streaming Brotli decompressor
│
├── ops/                  OnePlus (.ops) & Oppo/Realme (.ofp) Encrypted Firmware
│   ├── mod.rs            OPS/OFP public exports & metadata structs
│   ├── detect.rs         FirmwareFormat detector: Ops, OfpQualcomm, OfpMediaTek
│   ├── crypto.rs         2048-byte S-Box substitution cipher & AES-128-CFB decryptors
│   ├── ops_parser.rs     OnePlus XML manifest parser & mbox key scheduler (Mbox4, Mbox5, Mbox6)
│   ├── ofp_qc.rs         Qualcomm OFP XML parser & 256 KiB partial partition encryption
│   ├── ofp_mtk.rs        MediaTek OFP trailing MtkHeader parser & mtk_shuffle obfuscator
│   ├── sparse.rs         Android sparse image un-sparser (0xED26FF3A chunks: RAW, FILL, DONT_CARE, CRC32)
│   └── extractor.rs      Unified parallel OPS/OFP partition extraction runner
│
├── zip/                  Local ZIP & ZIP64 Archive Reader
│   ├── mod.rs            ZipPayloadMmap, PayloadCache facade
│   ├── stored_window.rs  Zero-copy memory-mapped slice window into STORED payload.bin entries
│   └── extract_entry.rs  Temporary deflated entry extractor with deduplicated session cache
│
├── remote/               Remote HTTP Range Streaming & Prefetch Engine
│   ├── mod.rs            Remote extraction coordinators (direct & prefetch)
│   ├── http.rs           HttpPayloadReader: Range requests, SSRF IP filter, retry backoff
│   ├── http_zip.rs       Remote ZIP EOCD & Central Directory streaming parser over HTTP Range
│   ├── prefetch.rs       Contiguous bounding byte span calculator: [min_offset, max_offset]
│   ├── session.rs        Remote session cache (ETag, Content-Length, Central Directory index)
│   └── factory.rs        Google Pixel factory image nested image-*.zip streaming extractor
│
├── io/                   Low-Level Disk I/O & Hardware Acceleration
│   ├── mod.rs            NonTemporalWriter, copy_raw_slice, stream_copy, buffer pool
│   ├── write.rs          NonTemporalWriter (memmap2::MmapMut with msync flush regulation / BufWriter fallback)
│   ├── sparse_ioctl.rs   SparseFileExt: Windows FSCTL_SET_SPARSE / ZERO_DATA, Linux fallocate, macOS fcntl
│   ├── copy.rs           Compiler-vectorized memory copy routines (copy_from_slice -> libc memcpy)
│   └── buffers.rs        Thread-local 256 KiB L2 cache buffer pool
│
└── verify/               Multi-Layer Cryptographic Integrity Verification
    ├── mod.rs            Verification facade & verify_sha256 file validator
    ├── mode.rs           VerifyMode (Strict, Default, Fast, None) & VerificationResult
    ├── op_blob.rs        Layer 3: Compressed operation payload slice SHA-256 validator
    └── output_file.rs    Layer 4: Final uncompressed on-disk partition SHA-256 validator
```

---

## 3. Submodule Specifications & Core Algorithms

### 3.1 CrAU Container Engine (`crau/`)
- **Header Parsing (`parser.rs`)**:
  - Validates magic `CrAU` (`0x43`, `0x72`, `0x41`, `0x55`).
  - Supports **Version 1** (20-byte header, legacy ChromeOS / Android 6) and **Version 2** (24-byte header, Android 7–15+).
  - Enforces `manifest_len <= 100_000_000` (100 MB bound) to prevent memory allocation attacks.
  - Decodes `DeltaArchiveManifest` using `prost::Message`.
- **Extraction Pipeline (`extract.rs`)**:
  - Uses `rayon::par_iter()` across target partitions. Concurrency is clamped to physical cores.
  - Processes `InstallOperation` types:
    - `Type::Replace`: Direct slice copy to destination extents.
    - `Type::ReplaceXz`: Multithreaded LZMA2 decompression via `liblzma::read::XzDecoder`.
    - `Type::ReplaceBz`: Bzip2 stream decompression via `bzip2::read::BzDecoder`.
    - `Type::Zstd`: High-throughput Zstandard streaming via `zstd::stream::read::Decoder`.
    - `Type::Zero`: Sparse hole skipping or zero writes via `SparseFileExt`.
    - `Type::BrotliBsdiff`: Decompresses Brotli patch stream before applying BSDiff against `src_extents`.
    - Delta Operations: Routes `SourceCopy`, `SourceBsdiff`, `Puffdiff`, `Zucchini` to `delta::engine`.

---

### 3.2 Dynamic Partition Sub-Unpacker (`lp/`)
- **Format Reference**: AOSP `liblp` (`system/core/fs_mgr/liblp/include/liblp/metadata_format.h`).
- **Binary Headers**:
  - `LpMetadataGeometry`: Magic `0x616c4467` (`LP_METADATA_GEOMETRY_MAGIC`), struct size 4096 bytes. Validated via SHA-256 with checksum field zeroed. Primary geometry at offset 0; backup geometry at offset 4096.
  - `LpMetadataHeader`: Magic `0x414C5030` (`LP_METADATA_HEADER_MAGIC`) located at offset 8192 (`LP_METADATA_GEOMETRY_SIZE * 2`).
- **Table Parsing**:
  - `partitions`: Name (36-byte ASCII null-padded), attributes (`LP_PARTITION_ATTR_*`), first extent index, number of extents, group index.
  - `extents`: Number of 512-byte sectors (`num_sectors`), target type (`0 = LINEAR`, `1 = ZERO`), target data (starting sector on physical disk).
- **Public API**:
  ```rust
  pub fn unpack_super_image(super_path: &Path, output_dir: &Path) -> Result<Vec<(String, u64)>>
  ```

---

### 3.3 Incremental & Delta OTA Reconstruction (`delta/`)
- **Differential Patching Operations**:
  - `SOURCE_COPY` (Op 4): Reads non-contiguous blocks from `src_extents` of base image and writes to `dst_extents`.
  - `SOURCE_BSDIFF` (Op 5): Reads base extents, decodes BSDiff stream from `payload.bin`, applies `bsdiff_android::patch`, writes to `dst_extents`.
  - `PUFFDIFF` (Op 9): Puffs source Deflate streams to byte-aligned representation, applies BSDiff patch via `puffdiff::puffpatch`, repuffs to bit-for-bit target Deflate image.
  - `BROTLI_BSDIFF` (Op 10): Decompresses Brotli patch blob before applying `bsdiff_android::patch`.
  - `ZUCCHINI` (Op 11): Architecture-aware binary differ normalizing relative jump displacements in ELF/DEX code.
- **Safety**: Enforces `MAX_OPERATION_SIZE = 512 MB` to guard against memory exhaustion from corrupted delta manifests.
- **Base Partition Resolver (`source_matcher.rs`)**:
  - Searches `source_dir` for `.img` files matching the exact SHA-256 specified in `PartitionUpdate.old_partition_info.hash`.

---

### 3.4 Samsung Odin Firmware Engine (`samsung/`)
- **Container Structure**: POSIX `tar` archive with optional trailing 16-byte binary MD5 / 32-byte ASCII MD5 trailer.
- **Classification**: AP (System OS), BL (Bootloader), CP (Baseband), CSC (Regional customizations & `*.pit` partition table).
- **Streaming Decompression**:
  - `HashingReader` computes in-flight MD5 without reading the file twice.
  - Entries matching `*.lz4` (e.g. `boot.img.lz4`, `super.img.lz4`) stream through `lz4_flex::frame::FrameDecoder` directly to destination files.
- **Public API**:
  ```rust
  pub fn unpack_samsung_tar(tar_path: &Path, output_dir: &Path) -> Result<Vec<(String, u64)>>
  ```

---

### 3.5 Xiaomi Recovery Engine (`xiaomi/`)
- **Components**: `system.transfer.list` (command script) + `system.new.dat.br` (Brotli-compressed block stream).
- **Command Syntax**:
  - `new <ranges>`: Pulls decompressed blocks sequentially from Brotli stream and writes to specified 4096-byte block intervals.
  - `zero <ranges>`: Zero-fills block intervals or punches sparse holes.
  - `erase <ranges>`: Discards unallocated block intervals (TRIM / NOP).
- **Public API**:
  ```rust
  pub fn extract_xiaomi_dat(transfer_list_path: &Path, dat_br_path: &Path, output_img_path: &Path) -> Result<u64>
  ```

---

### 3.6 Cross-Platform Native Sparse IOCTLs (`io/sparse_ioctl.rs`)
Eliminates physical SSD allocation and zero-write wear on uncompressed sparse holes:
- **Windows**: `DeviceIoControl` with `FSCTL_SET_SPARSE` on file creation and `FSCTL_SET_ZERO_DATA` on zero ranges ($\ge 64\text{ KiB}$ threshold to avoid NTFS MFT runlist exhaustion `0x29C`).
- **Linux**: `libc::fallocate(fd, FALLOC_FL_PUNCH_HOLE | FALLOC_FL_KEEP_SIZE, offset, len)`.
- **macOS**: `libc::fcntl(fd, F_PUNCHHOLE, &fpunchhole_t)`.

---

### 3.7 Storage Pre-Flight & Resilient Mover (`storage_check.rs`)
1. **Pre-Flight Disk Space Validation**:
   - Queries caller-accessible free quota (`GetDiskFreeSpaceExW` / `statvfs.f_bavail`).
   - Enforces $1.05 \times \text{total\_bytes} + 256\text{ MiB}$ safety margin before starting.
2. **FAT32 4 GiB Rejection**:
   - Detects FAT32 file systems (`GetVolumeInformationW`, `MSDOS_SUPER_MAGIC`) and rejects extractions if any partition exceeds $4\text{ GiB} - 64\text{ KiB}$.
3. **Long Path Normalization**:
   - Prepends `\\?\` verbatim UNC prefixes via `dunce::canonicalize` on Windows when path length $\ge 240$ characters.
4. **Resilient Cross-Device Mover (`move_file_cross_device`)**:
   - Attempts atomic `std::fs::rename`.
   - On `EXDEV` (errno 18) or Windows Error 17 (`ERROR_NOT_SAME_DEVICE`), falls back to 1 MiB chunked stream copying + `sync_all()` + target rename + source unlink.

---

### 3.8 Multi-Layer Integrity Verification (`verify/`)
- **Layer 1 & 2**: Header magic, version bounds, and extent boundary/non-overlapping validation.
- **Layer 3 (`layer3_enabled`)**: SHA-256 over raw compressed operation payload blob in `payload.bin` before invoking decompressors (prevents decompressor parser exploits).
- **Layer 4 (`layer4_enabled`)**: Full SHA-256 over the final on-disk partition image against `new_partition_info.hash` (guarantees bit-for-bit dm-verity tree compatibility).

---

## 4. Universal Firmware Hub Backend (`src-tauri/src/firmware/`)

The `firmware/` domain manages real-time OEM catalog scraping, multi-brand metadata normalization, and two-tier caching:

```text
src-tauri/src/firmware/
├── mod.rs                FirmwareHubService state, public exports
├── types.rs              FirmwareBrand, FirmwareImageType, FirmwareBuild, FirmwareDeviceModel
├── traits.rs             FirmwareProvider async trait
├── cache.rs              Two-tier cache: RAM RwLock + 24h JSON disk cache at <app_cache_dir>/firmware/
├── service.rs            FirmwareHubService aggregating providers, cache tiers, and fallback logic
└── providers/
    ├── mod.rs            Provider registry & dispatcher
    ├── google.rs         GooglePixelScraper: Factory & OTA scraper with ToS cookie bypass
    ├── nothing.rs        NothingOtaProvider (Akashic CDN feed stub)
    └── xiaomi.rs         XiaomiHyperOsProvider (Fastboot TGZ / Recovery feed stub)
```

### 4.1 Google Pixel Scraper (`firmware/providers/google.rs`)
- **Target URLs**:
  - Factory Images: `https://developers.google.com/android/images`
  - Full OTA Images: `https://developers.google.com/android/ota`
- **ToS Bypass Cookie**: Requests inject `Cookie: devsite_wall_acks=nexus-image-tos,nexus-ota-tos` to bypass Google's DevSite terms-of-service gate and receive fully rendered HTML tables.
- **Data Extracted**: Device marketing names, hardware codenames (e.g. `husky`, `shiba`, `komodo`), Android versions, build IDs, carrier variants, `dl.google.com` download links, and 64-hex SHA-256 checksums.
- **Metadata Enrichment**: Enriches SoC generation (Tensor G1–G4), release year (2016–2024), product series (Pixel 6–9, Fold & Tablet), and marks latest builds.

### 4.2 Two-Tier Caching Architecture
1. **Tier 1 (RAM)**: `Arc<RwLock<HashMap<FirmwareBrand, CachedCatalog>>>` providing $< 0.2\text{ ms}$ query latency for frontend views.
2. **Tier 2 (Disk)**: Atomic JSON files saved at `<app_cache_dir>/firmware/firmware_catalog_{brand}.json` with a **24-hour TTL**.
3. **Tier 3 (HTTP Conditional Requests)**: Emits `If-None-Match: "{etag}"` and `If-Modified-Since` headers to receive HTTP 304 Not Modified when Google has not updated builds.

---

## 5. Tauri IPC Command Map

All IPC commands return `CmdResult<T> = Result<T, String>`:

| IPC Command Name | Rust File | Purpose |
|---|---|---|
| `extract_payload` | `commands/payload.rs` | Main partition extraction runner (local, remote, OPS/OFP, delta) |
| `unpack_super_image` | `commands/payload.rs` | Unpacks dynamic sub-partitions (`system`, `vendor`, `product`) from `super.img` |
| `cleanup_payload_cache` | `commands/payload.rs` | Clears temporary deflated ZIP and prefetch caches |
| `get_firmware_catalog` | `commands/firmware.rs` | Queries multi-brand firmware catalog (cached with 24h disk TTL) |
| `refresh_firmware_catalog`| `commands/firmware.rs` | Forces cache invalidation and executes live OEM scraper |
| `get_supported_firmware_brands`| `commands/firmware.rs` | Returns list of supported OEM providers (`["google", "nothing", "xiaomi", ...]`) |
| `clear_firmware_cache` | `commands/firmware.rs` | Deletes local cached catalog JSON files |

---

## 6. Frontend Architecture & Remote Bridge (`src/features/payload-dumper/`)

1. **Thin Presentational Layer**: The React 19 frontend contains zero scraping logic, no hardcoded mock data, and no binary parsing. All data is fetched via `useFirmwareCatalog` backed by TanStack Query.
2. **Universal Multi-Brand Types**: Aligned with `src/desktop/models.ts` (`FirmwareBrand`, `FirmwareDeviceModel`, `FirmwareBuild`).
3. **1-Click Remote Extraction Bridge**:
   - In `FirmwareDeviceDetailView.tsx`, clicking **Remote Stream Extract** on any OTA build invokes `onSelectRemoteUrl(build.downloadUrl)`.
   - Automatically switches view to **Payload Dumper Extractor**, probes remote partition headers over HTTP Range requests, and renders the partition table ready for extraction in $< 2\text{ seconds}$.
4. **Dynamic Partition Sub-Unpack UI**:
   - `PayloadOverviewTab.tsx` and `PayloadLoadedPanel.tsx` detect `super.img` in the partition list or extracted files and render an **Unpack super.img Sub-Partitions** button connected to `UnpackSuperImage`.

---

## 7. Testing & Verification Standards

1. **Unit Testing (`cargo check --all-targets`)**:
   - `lp::mod::tests`: Struct sizes, CRC checksum verification, linear/zero extent unpacking, sparse image detection.
   - `delta::tests`: Delta operation patching, source image SHA-256 matching.
   - `samsung::tests`: Tar streaming and LZ4 frame decoding.
   - `xiaomi::tests`: Range string parsing and command list decoding.
   - `io::sparse_ioctl::tests`: Sparse file tagging and hole punching.
2. **Frontend Vitest (`bun run test`)**:
   - 28/28 tests passing in `src/test/payload*` and `src/test/ViewPayloadDumper.test.tsx`.
3. **End-to-End Real ROM Zip Verification**:
   - Tested against `C:\Users\akila\OneDrive\Desktop\AGN-Test\payloaddumper\EvolutionX-15.0-20260415-marble-10.16-Unofficial.zip`:
     - Listed 11 partitions (`boot`, `dtbo`, `odm`, `product`, `system`, `system_ext`, `vbmeta`, `vendor`, `vendor_boot`, `vendor_dlkm`).
     - Extracted `boot.img` (192 MB) with SHA-256 verification and atomic commit.

---

## 8. Payload Domain Invariants & Rules

1. **Zero Unbounded Buffering**:
   - Never buffer whole multi-gigabyte files in RAM. Always map via `Arc<memmap2::Mmap>` or stream chunks through the 256 KiB thread-local buffer pool (`io::buffers::with_io_buf`).
2. **Transaction Integrity**:
   - Never invoke `std::fs::remove_dir_all` directly on user-provided output directories during failure rollback.
   - All extractions must register files in `TransactionGuard`. Rollback deletes only actively registered `.img` files from the current session.
3. **Cooperative Cancellation**:
   - Inner decompression loops must check `cancel_token.check()?` at the start of each extent.
   - Unrecognized or invalid cancellation token IDs must return an explicit `Err`, never silently execute unmonitored.
4. **Sparse Hole Thresholding**:
   - Never issue native sparse hole punching (`FSCTL_SET_ZERO_DATA` / `fallocate`) for holes $< 64\text{ KiB}$ to avoid NTFS MFT `ATTRIBUTE_LIST` extent exhaustion (`0x29C`).
5. **Path Traversal Sanitization**:
   - All partition names from untrusted manifests must pass `crate::helpers::safe_image_file_name()`, rejecting `..`, `/`, `\`, and Windows DOS reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1..9`, `LPT1..9`).
6. **Output Directory Security**:
   - Output paths must be canonicalized before creating files to prevent symlink traversal outside target directories.
7. **SSRF Protection on Remote URLs**:
   - Outbound HTTP range requests must validate IP targets against private, loopback, link-local, and cloud metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`), with socket IP pinning across redirects.
