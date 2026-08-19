# Universal Android Firmware Dumper & Firmware Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement universal Android firmware container extraction (CrAU v1/v2, Delta OTAs, `liblp` dynamic partition unpacking, Samsung `.tar.md5` + LZ4, Xiaomi `dat.br`, native sparse IOCTLs) and build the live Universal Firmware Hub in the Rust backend with Google Pixel scraping, 24h disk caching, and a thin React 19 frontend.

**Architecture:** The Rust backend (`src-tauri/src/payload/` and `src-tauri/src/firmware/`) owns all domain parsing, multi-threaded Rayon/Tokio decompressions, HTML scraping, ToS cookie handling, ETag caching, and filesystem operations. The React 19 frontend (`src/features/payload-dumper/`) acts as a thin visual cockpit powered by TanStack Query, Zustand stores, and 100ms batched telemetry events.

**Tech Stack:** Rust 2024 · Tauri 2 · Rayon · Tokio · Reqwest · Scraper · Prost · Liblzma · Bzip2 · Zstd · Brotli · Lz4_flex · Tar · Bsdiff-android · Puffdiff · Memmap2 · React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query · Zustand · Bun.

**Spec:** `docs/internal/reports/active/2026-08-19/2026-08-19-payload-dumper-audit-and-enhancement-blueprint-research.md`

## Global Constraints

- **No Commits Policy**: Commits, pushes, and destructive actions must not be performed unless explicitly requested by the user.
- **Desktop-Only Tauri 2**: No Next.js, no browser-only routing, no Electron.
- **Rust Backend Heavy Lifting**: All business logic, parsing, network scraping, caching, and cryptographic hashing must live in Rust (`src-tauri/src/`); UI is purely a thin presentational layer.
- **IPC Exclusively through `src/desktop/`**: Frontend must never invoke raw `core.invoke` directly; use typed functions in `src/desktop/backend.ts` and models in `src/desktop/models.ts`.
- **Memory Safety & Zero Unbounded Buffering**: Stream large chunks via 256 KiB thread-local buffer pools and zero-copy memory maps (`Arc<memmap2::Mmap>`); never buffer whole multi-gigabyte files in RAM.
- **Dynamic Concurrency Clamping**: Clamp Rayon decompressor workers to $\min(N_{\text{physical\_cores}}, 8)$ with Semaphore memory limits.
- **Real Desktop App Testing**: Test on live Tauri desktop app and the test payload zip at `C:\Users\akila\OneDrive\Desktop\AGN-Test\payloaddumper\EvolutionX-15.0-20260415-marble-10.16-Unofficial.zip`.

---

## Task Decomposition & Execution Steps

### Task 1: Native Rust `liblp` Dynamic Partition Parser & Sub-Unpacker

**Files:**
- Create: `src-tauri/src/payload/lp/mod.rs`
- Modify: `src-tauri/src/payload/mod.rs`
- Test: `src-tauri/src/payload/lp/mod.rs` (inline test module)

**Interfaces:**
- Consumes: `std::io::{Read, Seek, Write}`, `sha2::Sha256`, `byteorder::LittleEndian`
- Produces: `LpMetadata`, `LpMetadataGeometry`, `LpMetadataHeader`, `LpMetadataPartition`, `LpMetadataExtent`, `unpack_super_image(super_path: &Path, output_dir: &Path) -> Result<Vec<(String, u64)>>`

- [ ] **Step 1: Write unit tests for `LpMetadataGeometry` and `LpMetadataHeader` parsing**
- [ ] **Step 2: Implement `LpMetadata` struct and binary parser checking magic `0x616c4467` and `0x414C5030`**
- [ ] **Step 3: Implement `extract_partition` and `extract_all` resolving linear sector extents directly to output files**
- [ ] **Step 4: Run cargo tests to verify `liblp` parser passes**

---

### Task 2: Incremental & Delta OTA Differential Engine (`delta/`)

**Files:**
- Create: `src-tauri/src/payload/delta/engine.rs`
- Create: `src-tauri/src/payload/delta/source_matcher.rs`
- Modify: `src-tauri/src/payload/delta/mod.rs`
- Modify: `src-tauri/src/payload/crau/extract.rs`
- Modify: `src-tauri/src/payload/crau/parser.rs`

**Interfaces:**
- Consumes: `bsdiff_android::patch`, `puffdiff::puffpatch`, `brotli::Decompressor`, `sha2::Sha256`
- Produces: `DeltaEngine::apply_operation`, `DeltaEngine::resolve_source_partition`, CrAU v1/v2 header support

- [ ] **Step 1: Implement `source_matcher.rs` to scan and verify base partition SHA-256 hashes against `old_partition_info.hash`**
- [ ] **Step 2: Implement `delta/engine.rs` supporting `SOURCE_COPY`, `SOURCE_BSDIFF`, `PUFFDIFF`, and `BROTLI_BSDIFF` with 512 MB safety caps**
- [ ] **Step 3: Fix `Type::BrotliBsdiff` in `src-tauri/src/payload/crau/extract.rs` to decompress Brotli patch stream before applying BSDiff**
- [ ] **Step 4: Update `src-tauri/src/payload/crau/parser.rs` to support both 20-byte (v1) and 24-byte (v2) CrAU headers**
- [ ] **Step 5: Run unit tests to verify delta operations and header parsing**

---

### Task 3: Samsung Odin `.tar.md5` Streaming Unpacker & LZ4 Frame Decompressor

**Files:**
- Create: `src-tauri/src/payload/samsung/mod.rs`
- Create: `src-tauri/src/payload/samsung/tar_md5.rs`
- Modify: `src-tauri/src/payload/mod.rs`

**Interfaces:**
- Consumes: `tar::Archive`, `lz4_flex::frame::FrameDecoder`, `md5::Md5`
- Produces: `SamsungTarMd5Extractor::unpack_stream(stream: R, output_dir: &Path) -> Result<Vec<(String, u64)>>`

- [ ] **Step 1: Implement `HashingReader` with streaming in-flight MD5 verification**
- [ ] **Step 2: Implement `SamsungTarMd5Extractor` streaming tar entries and decompressing `.lz4` files directly to output files**
- [ ] **Step 3: Write unit test validating TAR entry extraction and MD5 trailer handling**
- [ ] **Step 4: Run cargo tests to verify Samsung unpacker**

---

### Task 4: Xiaomi `system.transfer.list` & Brotli `.new.dat.br` Reconstructor

**Files:**
- Create: `src-tauri/src/payload/xiaomi/mod.rs`
- Create: `src-tauri/src/payload/xiaomi/dat_br.rs`
- Modify: `src-tauri/src/payload/mod.rs`

**Interfaces:**
- Consumes: `brotli::Decompressor`, `std::io::{BufRead, Write, Seek}`
- Produces: `TransferList::parse`, `XiaomiDatExtractor::extract`

- [ ] **Step 1: Implement `TransferList` command parser for `new`, `erase`, `zero`, `stash`, `free`**
- [ ] **Step 2: Implement `XiaomiDatExtractor` streaming Brotli decompressed blocks into sparse target extents**
- [ ] **Step 3: Write unit test for range string parsing and block assembly**
- [ ] **Step 4: Run cargo tests to verify Xiaomi extractor**

---

### Task 5: Cross-Platform Native Sparse File IOCTL Manager

**Files:**
- Create: `src-tauri/src/payload/io/sparse_ioctl.rs`
- Modify: `src-tauri/src/payload/io/mod.rs`
- Modify: `src-tauri/src/payload/crau/extract.rs`

**Interfaces:**
- Consumes: `windows_sys` (`FSCTL_SET_SPARSE`, `FSCTL_SET_ZERO_DATA`) on Windows, `libc::fallocate` on Linux, `libc::fcntl` on macOS
- Produces: `SparseFileExt::mark_sparse`, `SparseFileExt::punch_hole`

- [ ] **Step 1: Implement `SparseFileExt` trait for `std::fs::File` across Windows, Linux, and macOS**
- [ ] **Step 2: Integrate sparse hole punching into `src-tauri/src/payload/crau/extract.rs` for `Type::Zero` extents ($\ge 64\text{ KiB}$)**
- [ ] **Step 3: Write unit test verifying sparse tagging and hole punching**

---

### Task 6: Storage Pre-Flight Validation & Resilient Cross-Device Move

**Files:**
- Create: `src-tauri/src/payload/storage_check.rs`
- Modify: `src-tauri/src/payload/io/copy.rs`
- Modify: `src-tauri/src/payload/transaction.rs`

**Interfaces:**
- Consumes: `windows_sys` / `statvfs` for free disk space, `dunce::canonicalize` for `MAX_PATH`
- Produces: `validate_preflight_storage(output_dir, required_bytes) -> Result<()>`, `move_file_cross_device(src, dst) -> Result<()>`

- [ ] **Step 1: Implement quota-aware free disk space check with 5% headroom + 256 MiB metadata margin**
- [ ] **Step 2: Implement FAT32 4 GiB limit detection and rejection**
- [ ] **Step 3: Implement `move_file_cross_device` handling `EXDEV` / Windows Error 17 with 1 MiB chunked stream copy**
- [ ] **Step 4: Update `TransactionGuard` with isolated staging directory `.tmp_tx_{session_id}`**

---

### Task 7: Universal Firmware Hub Backend Models & Provider Traits

**Files:**
- Create: `src-tauri/src/firmware/mod.rs`
- Create: `src-tauri/src/firmware/types.rs`
- Create: `src-tauri/src/firmware/traits.rs`
- Create: `src-tauri/src/firmware/cache.rs`
- Create: `src-tauri/src/firmware/service.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `serde`, `reqwest`, `tokio::sync::RwLock`
- Produces: `FirmwareBrand`, `FirmwareDeviceModel`, `FirmwareBuild`, `FirmwareProvider` trait, `FirmwareHubService`

- [ ] **Step 1: Define strongly-typed structs in `types.rs` (`FirmwareBrand`, `FirmwareDeviceModel`, `FirmwareBuild`)**
- [ ] **Step 2: Define `FirmwareProvider` trait in `traits.rs`**
- [ ] **Step 3: Implement two-tier caching engine in `cache.rs` (Memory `RwLock` + 24-hour disk JSON TTL)**
- [ ] **Step 4: Implement `FirmwareHubService` coordinating providers and cache fallbacks**

---

### Task 8: Google Pixel Scraper with Terms of Service Cookie Bypass

**Files:**
- Create: `src-tauri/src/firmware/providers/mod.rs`
- Create: `src-tauri/src/firmware/providers/google.rs`
- Create: `src-tauri/src/firmware/providers/nothing.rs`
- Create: `src-tauri/src/firmware/providers/xiaomi.rs`

**Interfaces:**
- Consumes: `scraper::Html`, `scraper::Selector`, `reqwest::Client`
- Produces: `GooglePixelScraper::scrape_catalog() -> Result<Vec<FirmwareDeviceModel>>`

- [ ] **Step 1: Implement HTTP client builder setting `devsite_wall_acks=nexus-image-tos,nexus-ota-tos` cookie**
- [ ] **Step 2: Implement concurrent HTML fetch and DOM parser for Factory Images and Full OTAs**
- [ ] **Step 3: Implement hardware metadata enrichment (SoC, Release Year, Series) and `is_latest` marking**
- [ ] **Step 4: Add extensible provider stubs for Nothing OS and Xiaomi/HyperOS**
- [ ] **Step 5: Write unit tests for Google Pixel HTML table parsing**

---

### Task 9: Tauri IPC Commands & Engine Routing

**Files:**
- Create: `src-tauri/src/commands/firmware.rs`
- Modify: `src-tauri/src/commands/payload.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `FirmwareHubService`, `LpMetadata`
- Produces: `get_firmware_catalog`, `refresh_firmware_catalog`, `get_supported_firmware_brands`, `clear_firmware_cache`, `unpack_super_image`

- [ ] **Step 1: Implement `commands/firmware.rs` with IPC commands for catalog retrieval and manual refresh**
- [ ] **Step 2: Implement `unpack_super_image` command in `commands/payload.rs`**
- [ ] **Step 3: Register new commands in `src-tauri/src/lib.rs` and initialize `FirmwareHubService` state**

---

### Task 10: Universal Frontend Models & Desktop IPC Wrappers

**Files:**
- Modify: `src/features/payload-dumper/ui/marketplace/types.ts`
- Modify: `src/desktop/models.ts`
- Modify: `src/desktop/backend.ts`

**Interfaces:**
- Consumes: Tauri IPC invoke API
- Produces: TypeScript types (`FirmwareBrand`, `FirmwareDeviceModel`, `FirmwareBuild`), IPC functions (`GetFirmwareCatalog`, `RefreshFirmwareCatalog`, `GetSupportedFirmwareBrands`)

- [ ] **Step 1: Update `types.ts` with universal multi-brand types and remove Pixel-only hardcoded interfaces**
- [ ] **Step 2: Add matching backend models to `src/desktop/models.ts`**
- [ ] **Step 3: Add typed invoke functions in `src/desktop/backend.ts`**

---

### Task 11: Universal Firmware Hub UI & 1-Click Remote Extraction

**Files:**
- Create: `src/features/payload-dumper/ui/marketplace/useFirmwareCatalog.ts`
- Modify: `src/features/payload-dumper/ui/marketplace/PayloadMarketplaceTab.tsx`
- Modify: `src/features/payload-dumper/ui/marketplace/PixelModelCard.tsx` (Rename to `FirmwareDeviceCard.tsx`)
- Modify: `src/features/payload-dumper/ui/marketplace/PixelDeviceDetailView.tsx` (Rename to `FirmwareDeviceDetailView.tsx`)
- Delete: `src/features/payload-dumper/ui/marketplace/pixelCatalogData.ts`

**Interfaces:**
- Consumes: `useFirmwareCatalog`, `FirmwareDeviceModel`
- Produces: Multi-brand Firmware Hub UI, 1-click **Remote Stream Extract** bridge

- [ ] **Step 1: Implement `useFirmwareCatalog.ts` with `@tanstack/react-query` and 24h cache awareness**
- [ ] **Step 2: Refactor `PayloadMarketplaceTab.tsx` with Brand Selector chips (`All`, `Google Pixel`, `Nothing`, `Xiaomi`, `OnePlus`, `Samsung`), search bar, and loading skeletons**
- [ ] **Step 3: Refactor device card and detail view components to display universal brand badges and builds**
- [ ] **Step 4: Connect "Remote Stream Extract" button to `onSelectRemoteUrl` for 1-click transition to extraction view**
- [ ] **Step 5: Remove static `pixelCatalogData.ts` mock file**

---

### Task 12: Dynamic Partitions Sub-Unpack UI Controls

**Files:**
- Modify: `src/features/payload-dumper/PayloadDumperView.tsx`
- Modify: `src/features/payload-dumper/ui/PayloadLoadedPanel.tsx`

**Interfaces:**
- Consumes: `unpack_super_image` IPC command
- Produces: 1-click "Unpack super.img" button and progress feedback in the UI

- [ ] **Step 1: Add "Unpack super.img" button when `super.img` is present in extracted files**
- [ ] **Step 2: Connect button to `unpack_super_image` IPC invoke with toast notifications**

---

### Task 13: Full Suite Verification & Linting

**Files:**
- Entire workspace

- [ ] **Step 1: Run `cargo test --lib` to ensure all Rust backend tests pass**
- [ ] **Step 2: Run `bun test` to verify Vitest frontend test suite**
- [ ] **Step 3: Run Biome linter check (`bun run lint` / `bun run check`)**

---

### Task 14: Real ROM Zip Extraction Test (`EvolutionX-15.0-marble`)

**Files:**
- Target: `C:\Users\akila\OneDrive\Desktop\AGN-Test\payloaddumper\EvolutionX-15.0-20260415-marble-10.16-Unofficial.zip`

- [ ] **Step 1: Run backend test / standalone extraction against the real ROM zip**
- [ ] **Step 2: Verify extracted partition images (`boot.img`, `init_boot.img`, `super.img`, etc.) and SHA-256 integrity**

---

### Task 15: Desktop App Launch & Computer-Use Manual Testing

**Files:**
- Desktop runtime

- [ ] **Step 1: Launch Tauri desktop app in dev mode (`bun run tauri dev`)**
- [ ] **Step 2: Use Orca computer-use CLI to inspect the app window, verify the Firmware Hub tab loads live Pixel builds, and test 1-click extraction**
- [ ] **Step 3: Update `memory-bank/` files in real-time**
