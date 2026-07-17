# ZIP Metadata Info Panel — Design Report

> **Feature:** Display rich metadata about remote OTA ZIP payloads after partitions are loaded.
> **Date:** 2026-04-03
> **Status:** Design phase — 3 approaches proposed for review

---

## Problem Statement

When a user loads partitions from a remote OTA URL, the `FileBanner` shows only:
- A truncated URL
- Partition count and total size
- Action buttons (change payload, refresh, output folder)

**Missing information** the user would benefit from seeing:

- Full untruncated URL
- HTTP server info (e.g. whether range requests are supported, content-length)
- ZIP archive metadata (payload.bin offset, compressed vs uncompressed size, compression method)
- Payload manifest metadata (CrAU version, block size, minor version, security patch level, max timestamp, partial update flag)
- Dynamic partition groups (if any)
- Per-partition version strings
- Extraction mode (prefetch vs direct)

The user should be able to **optionally expand** this panel to see all details without cluttering the default view.

---

## Data Inventory — What Can We Show?

### Layer 1: HTTP (already available from HEAD request)

| Field | Source | Currently Shown |
|-------|--------|-----------------|
| Full URL | Frontend state (`remoteUrl`) | ✅ Truncated in FileBanner |
| Content-Length | `RemotePayloadInfo.contentLength` | ❌ Only during "Check URL" |
| Accept-Ranges | `RemotePayloadInfo.supportsRanges` | ❌ Only during "Check URL" |
| Server | HEAD response header | ❌ Not captured |
| Content-Type | HEAD response header | ❌ Not captured |
| Last-Modified | HEAD response header | ❌ Not captured |
| ETag | HEAD response header | ❌ Not captured |

### Layer 2: ZIP Structure (available after partition load)

| Field | Source | Currently Shown |
|-------|--------|-----------------|
| Is ZIP | `is_zip_url()` | ❌ |
| payload.bin offset | `ZipPayloadInfo.offset` | ❌ |
| Compressed size | `ZipPayloadInfo.compressed_size` | ❌ |
| Uncompressed size | `ZipPayloadInfo.uncompressed_size` | ❌ |
| Compression method | `ZipPayloadInfo.compression_method` | ❌ |
| ZIP entries count | EOCD `total_entries` field | ❌ Not captured |

### Layer 3: OTA Manifest (available after partition load)

| Field | Source | Currently Shown |
|-------|--------|-----------------|
| Partition count | `manifest.partitions.len()` | ✅ |
| Total partition size | Computed sum | ✅ |
| Block size | `manifest.block_size` | ❌ |
| CrAU payload version | Header byte 4..12 (always 2) | ❌ |
| Minor (delta) version | `manifest.minor_version` | ❌ |
| Security patch level | `manifest.security_patch_level` | ❌ |
| Max timestamp | `manifest.max_timestamp` | ❌ |
| Partial update | `manifest.partial_update` | ❌ |
| Dynamic partition groups | `manifest.dynamic_partition_metadata.groups` | ❌ |
| Per-partition versions | `partition.version` | ❌ |
| APEX info | `manifest.apex_info` | ❌ |

### Layer 4: User Configuration (already in state)

| Field | Source | Currently Shown |
|-------|--------|-----------------|
| Extraction mode | `prefetch` flag | ❌ |
| Output directory | `outputPath` / `outputDir` | Partial (tooltip only) |

---

## Backend Changes Required (All Approaches)

A new Rust struct `RemotePayloadMetadata` returned from an enhanced command:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePayloadMetadata {
    // HTTP layer
    pub content_length: u64,
    pub supports_ranges: bool,
    pub content_type: Option<String>,
    pub last_modified: Option<String>,
    pub server: Option<String>,
    pub etag: Option<String>,

    // ZIP layer (None if direct payload.bin)
    pub is_zip: bool,
    pub zip_payload_offset: Option<u64>,
    pub zip_compressed_size: Option<u64>,
    pub zip_uncompressed_size: Option<u64>,
    pub zip_compression_method: Option<String>,   // "Stored" | "Deflate"

    // OTA Manifest layer
    pub block_size: u32,
    pub payload_version: u32,                     // CrAU header version (2)
    pub minor_version: Option<u32>,               // 0 = full, >0 = delta
    pub security_patch_level: Option<String>,
    pub max_timestamp: Option<i64>,
    pub partial_update: Option<bool>,
    pub dynamic_groups: Vec<DynamicGroupInfo>,
    pub partition_versions: Vec<PartitionVersionInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicGroupInfo {
    pub name: String,
    pub size: Option<u64>,
    pub partitions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionVersionInfo {
    pub name: String,
    pub version: Option<String>,
}
```

This is populated during partition listing — the manifest is already parsed, we just need
to extract these extra fields and return them alongside the partition list.

---

## Approach 1: Collapsible Details Panel (Recommended)

**Concept:** Add a subtle **chevron toggle** at the bottom of the `FileBanner`. Clicking it
smoothly expands a details panel below the existing URL row, showing metadata in a clean
key-value grid.

### ASCII Wireframe — Collapsed (Default)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 https://otafsg1.h2os.com/patch/.../OnePlus8ProOxygen...   📋 🔄 📂 │
│  33 partitions • 5.44 GB total                                         │
│ ──────────────────────────────────────────────── ▼ Show Details ─────── │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — Expanded

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 https://otafsg1.h2os.com/patch/.../OnePlus8ProOxygen...   📋 🔄 📂 │
│  33 partitions • 5.44 GB total                                         │
│ ──────────────────────────────────────────────── ▲ Hide Details ─────── │
│                                                                         │
│  ┌─── HTTP ──────────────────────────────────────────────────────────┐  │
│  │  Full URL       https://otafsg1.h2os.com/patch/amazone2/GLO/...  │  │
│  │  File Size      5.44 GB                                          │  │
│  │  Content-Type   application/zip                                  │  │
│  │  Server         AmazonS3                                         │  │
│  │  Last Modified  2026-03-15 14:22:00 UTC                          │  │
│  │  Range Support  ✅ Supported                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── ZIP Archive ───────────────────────────────────────────────────┐  │
│  │  Format         ZIP (payload.bin inside)                         │  │
│  │  payload.bin    Offset: 0x1A2B • Stored (no compression)         │  │
│  │  Payload Size   5.44 GB (uncompressed)                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── OTA Manifest ─────────────────────────────────────────────────┐  │
│  │  CrAU Version   2                                                │  │
│  │  Block Size     4096                                             │  │
│  │  Update Type    Full (minor_version: 0)                          │  │
│  │  Security Patch 2026-03-01                                       │  │
│  │  Timestamp      2026-03-10 08:00:00 UTC                          │  │
│  │  Partial Update No                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── Extraction ────────────────────────────────────────────────────┐  │
│  │  Mode           Direct (HTTP range on-demand)                    │  │
│  │  Output         C:\Users\akila\Downloads\payload_output\         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pros
- **Minimal UI disruption** — default state is visually identical to current `FileBanner`
- **Progressive disclosure** — users see details only when they want to
- **Framer Motion `AnimatePresence`** — smooth open/close transition
- **Self-contained** — all changes within `FileBanner.tsx` + one new sub-component
- **Mobile-friendly** — sections stack vertically, no width concerns

### Cons
- Panel grows tall when expanded — pushes partition table down
- Requires backend enrichment to provide the metadata
- Need to pass down metadata through props chain

### Component Structure
```
FileBanner (existing)
  └── FileBannerDetails (new)     — AnimatePresence toggle
        ├── MetadataSection "HTTP"
        ├── MetadataSection "ZIP Archive"     (conditional: isZip)
        ├── MetadataSection "OTA Manifest"
        └── MetadataSection "Extraction"
```

### Effort: **Medium**
- **Backend:** ~80 lines Rust (new struct + field extraction in partition listing)
- **Frontend:** ~150 lines (FileBannerDetails component + store field)
- **Existing code changes:** Minimal — just add a chevron button to FileBanner

---

## Approach 2: Side Sheet / Drawer Panel

**Concept:** A **right-side drawer** that slides in from the edge when the user clicks
an "Info" button (ℹ️) on the `FileBanner`. Shows all metadata in a scrollable panel
that overlays (doesn't push) the main content.

### ASCII Wireframe — Trigger Button

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 https://otafsg1.h2os.com/patch/.../OnePlus8ProOxygen...  ℹ 📋 🔄 📂│
│  33 partitions • 5.44 GB total                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — Drawer Open

```
┌──────── Main Content ─────────┬──────── Info Drawer ──────────────────┐
│                               │                                       │
│  ┌─ Extraction Setup ──────┐  │  ┌─ Payload Information ────────────┐ │
│  │  🌐 ... ℹ 📋 🔄 📂       │  │  │                                │ │
│  │  33 partitions • 5.44GB │  │  │  Full URL                        │ │
│  └─────────────────────────┘  │  │  https://otafsg1.h2os.com/...    │ │
│                               │  │                                    │ │
│  ┌─ Partition Table ────────┐ │  │  ── HTTP ──────────────────────── │ │
│  │  ☐ abl         1.95 MB  │ │  │  File Size     5.44 GB            │ │
│  │  ☐ boot        96 MB    │ │  │  Content-Type  application/zip    │ │
│  │  ☐ dtbo        8 MB     │ │  │  Server        AmazonS3           │ │
│  │  ☐ logo        7.6 MB   │ │  │  Last-Modified 2026-03-15         │ │
│  │  ...                    │ │  │  ETag          "abc123"            │ │
│  └─────────────────────────┘  │  │                                   │ │
│                               │  │  ── ZIP Archive ─────────────────  │ │
│                               │  │  Compression   Stored              │ │
│                               │  │  Payload Ofs.  0x1A2B              │ │
│                               │  │                                    │ │
│                               │  │  ── OTA Manifest ────────────────  │ │
│                               │  │  Block Size    4096                │ │
│                               │  │  Update Type   Full                │ │
│                               │  │  Patch Level   2026-03-01          │ │
│                               │  │  Timestamp     1710057600          │ │
│                               │  │                                    │ │
│                               │  │  ── Extraction ──────────────────  │ │
│                               │  │  Mode          Direct              │ │
│                               │  │  Output Dir    C:\Users\...\       │ │
│                               │  └────────────────────────────────── │ │
│                               │                          [ Close ✕ ] │
└───────────────────────────────┴──────────────────────────────────────┘
```

### Pros
- **No layout disruption** — drawer overlays, doesn't push partition table
- **Can show extensive metadata** without vertical space concerns
- **Familiar UX** — drawer pattern used by VS Code, Chrome DevTools, etc.
- **Independent scroll** — metadata scrolls independently from main content

### Cons
- **Adds a new shadcn Sheet component** — needs `npx shadcn@latest add sheet`
- **Narrower reading area** on small windows — loses some space
- **Disconnected feel** — info is spatially separated from the banner it describes
- **More complex state management** — open/close state, possibly portal rendering
- **May conflict with right-edge sidebar** on some layouts

### Component Structure
```
ViewPayloadDumper
  ├── FileBanner (add ℹ️ button)
  └── Sheet (shadcn)
        └── PayloadInfoSheet (new)
              ├── MetadataSection "HTTP"
              ├── MetadataSection "ZIP Archive"
              ├── MetadataSection "OTA Manifest"
              └── MetadataSection "Extraction"
```

### Effort: **Medium-High**
- **Backend:** Same ~80 lines Rust
- **Frontend:** ~200 lines (Sheet wrapper + content + shadcn add)
- **New dependencies:** `shadcn Sheet` (Radix Dialog under the hood)

---

## Approach 3: Inline Expandable Card Sections

**Concept:** Replace the single `FileBanner` with a more structured card that has
**inline collapsible sections** using shadcn `Collapsible` directly inside the banner.
Each section (HTTP, ZIP, OTA) is a separate collapsible, so users can open/close
individual categories.

### ASCII Wireframe — All Collapsed (Default)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 https://otafsg1.h2os.com/patch/.../OnePlus8ProOxygen...   📋 🔄 📂 │
│  33 partitions • 5.44 GB total                                         │
│                                                                         │
│  ▸ HTTP Details          ▸ ZIP Archive          ▸ OTA Manifest          │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — HTTP Expanded, Others Collapsed

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 https://otafsg1.h2os.com/patch/.../OnePlus8ProOxygen...   📋 🔄 📂 │
│  33 partitions • 5.44 GB total                                         │
│                                                                         │
│  ▾ HTTP Details                                                         │
│    File Size       5.44 GB                                              │
│    Content-Type    application/zip                                      │
│    Server          AmazonS3                                             │
│    Last Modified   2026-03-15 14:22:00 UTC                              │
│    Range Support   ✅ Supported                                          │
│                                                                         │
│  ▸ ZIP Archive          ▸ OTA Manifest          ▸ Extraction            │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — All Expanded

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌐 https://otafsg1.h2os.com/patch/.../OnePlus8ProOxygen...   📋 🔄 📂 │
│  33 partitions • 5.44 GB total                                         │
│                                                                         │
│  ▾ HTTP Details                                                         │
│    Full URL        https://otafsg1.h2os.com/patch/amazone2/GLO/...      │
│    File Size       5.44 GB                                              │
│    Content-Type    application/zip                                      │
│    Server          AmazonS3                                             │
│    Last Modified   2026-03-15 14:22:00 UTC                              │
│    Range Support   ✅ Supported                                          │
│                                                                         │
│  ▾ ZIP Archive                                                          │
│    Format          ZIP (payload.bin inside)                              │
│    payload.bin     Offset: 0x1A2B • Stored                              │
│    Payload Size    5.44 GB (uncompressed)                                │
│                                                                         │
│  ▾ OTA Manifest                                                         │
│    CrAU Version    2                                                    │
│    Block Size      4096                                                 │
│    Update Type     Full (minor_version: 0)                              │
│    Security Patch  2026-03-01                                           │
│    Timestamp       2026-03-10 08:00:00 UTC                              │
│    Partial Update  No                                                   │
│                                                                         │
│  ▾ Extraction                                                           │
│    Mode            Direct (HTTP range on-demand)                        │
│    Output          C:\Users\akila\Downloads\payload_output\             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pros
- **Most granular control** — users open exactly the category they care about
- **Inline and contextual** — info stays directly in the banner
- **Uses existing shadcn `Collapsible`** — already available in the project
- **Accordion-like UX** — familiar pattern for categorized information

### Cons
- **Horizontal space wasted** — section headers ("▸ HTTP Details") take a full row each
- **Visual clutter** — 3-4 collapsible triggers visible even when collapsed adds noise
- **Partial expansion pushes table inconsistently** — each section adds different height
- **More complex per-section animation** — need AnimatePresence per Collapsible
- **Doesn't scale well** — if we add more categories later, the row of triggers overflows

### Component Structure
```
FileBanner (modified)
  ├── BannerHeader (URL + buttons — existing)
  ├── BannerStats (partition count + size — existing)
  └── BannerDetails (new row)
        ├── CollapsibleSection "HTTP"
        ├── CollapsibleSection "ZIP Archive"   (conditional: isZip)
        ├── CollapsibleSection "OTA Manifest"
        └── CollapsibleSection "Extraction"
```

### Effort: **Medium**
- **Backend:** Same ~80 lines Rust
- **Frontend:** ~200 lines (multiple Collapsible wrappers + per-section components)
- **Existing code changes:** More invasive — FileBanner structure changes significantly

---

## Comparison Matrix

| Criterion | Approach 1 (Chevron) | Approach 2 (Drawer) | Approach 3 (Inline) |
|-----------|:-------------------:|:-------------------:|:-------------------:|
| **UI Disruption** | ✅ Minimal | ✅ None (overlay) | ⚠️ Moderate |
| **Progressive Disclosure** | ✅ One toggle | ✅ One button | ⚠️ 3-4 toggles |
| **Visual Clutter (collapsed)** | ✅ Just a ▼ link | ✅ Just an ℹ️ button | ❌ 4 trigger buttons |
| **Spatial Context** | ✅ Below the banner | ⚠️ Separate drawer | ✅ Inside the banner |
| **Implementation Effort** | ✅ Low-Medium | ⚠️ Medium-High | ⚠️ Medium |
| **New Dependencies** | ✅ None | ⚠️ Sheet/Dialog | ✅ Collapsible (exists) |
| **Responsive Behavior** | ✅ Stacks naturally | ⚠️ Drawer width issues | ⚠️ Stacking + overflow |
| **Scalability** | ✅ Add sections freely | ✅ Scrollable drawer | ❌ More triggers needed |
| **Animation** | ✅ Single height animate | ✅ Slide in/out | ⚠️ Per-section animate |
| **Consistency with project** | ✅ Matches existing patterns | ⚠️ New UI pattern | ⚠️ Overcomplicated |

---

## Recommendation

> **Approach 1: Collapsible Details Panel** is recommended.

**Rationale:**
1. **Least invasive** — adds ~1 line to `FileBanner` (a chevron toggle), rest is a new sub-component
2. **Consistent with the app's existing design language** — the app uses flat cards w/ minimal chrome; a simple expand/collapse fits naturally
3. **No new shadcn dependencies** — uses Framer Motion `AnimatePresence` (already installed)
4. **Best tradeoff between info density and UX cleanliness** — users who just want to extract partitions never see the details; power users who need HTTP/ZIP/OTA metadata can expand with one click
5. **Clean implementation path** — single new Rust struct, single new React component, one prop threading change

### Implementation Sketch (if Approach 1 is chosen)

**Rust (backend):**
1. Add `RemotePayloadMetadata` struct to `commands/payload.rs`
2. Enrich `check_remote_payload` to return full metadata OR add a new `get_remote_payload_metadata` command that lazily fetches metadata after partitions load
3. Capture HTTP headers (`content-type`, `last-modified`, `server`, `etag`) from the HEAD response in `HttpPayloadReader`
4. Extract OTA manifest metadata (`block_size`, `minor_version`, `security_patch_level`, `max_timestamp`, `partial_update`, dynamic groups) during `list_remote_payload_partitions`

**Frontend (React):**
1. Add `remoteMetadata: RemotePayloadMetadata | null` to `payloadDumperStore`
2. Create `FileBannerDetails.tsx` — receives metadata, renders grouped key-value pairs with `AnimatePresence` for open/close
3. Add chevron toggle to `FileBanner.tsx` bottom row (only visible when metadata is available and `isRemote === true`)
4. Wire through `ViewPayloadDumper.tsx` and `usePayloadActions.ts`

---

*Report generated from analysis of:*
- `src-tauri/src/commands/payload.rs` — Tauri commands
- `src-tauri/src/payload/http.rs` — HTTP HEAD request + range reader
- `src-tauri/src/payload/http_zip.rs` — ZIP EOCD/CD parsing + ZipPayloadInfo
- `src-tauri/src/payload/remote.rs` — Remote extraction (prefetch + direct)
- `src-tauri/src/generated/chromeos_update_engine.rs` — DeltaArchiveManifest protobuf
- `src/components/payload-dumper/FileBanner.tsx` — Current banner UI
- `src/components/RemoteUrlPanel.tsx` — Current remote URL check UI
- `src/lib/payloadDumperStore.ts` — Zustand state management
- `src/lib/payload-dumper/usePayloadActions.ts` — Action handlers
- `src/lib/desktop/models.ts` — Frontend DTOs
