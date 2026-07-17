# Payload Dumper — UI/UX Improvement Recommendations

> Comprehensive analysis of the current "loaded" state UI and 3 actionable improvements.

---

## Current State Analysis

Based on two screenshot states:
1. **ZIP selected, partitions loading** — spinner on button, actions visible but useless
2. **Partitions loaded** — full table with empty Progress column, actions at bottom

### Pain Points Identified

| # | Issue | Severity | Where |
|---|-------|----------|-------|
| 1 | **Empty PROGRESS column** — takes ~30% of each row's width but shows nothing until extraction starts. Looks broken. | High | Partition table |
| 2 | **No loading feedback for ZIP extraction** — small spinner embedded inside the file button is easy to miss. ZIP extraction can take 10-30s for large OTAs (~5 GB). User has no idea what's happening. | High | Loading state |
| 3 | **"Select Partitions" button text during loading** — confusing. It says "Select Partitions" while partitions are being loaded. | Medium | Actions |
| 4 | **Actions at the bottom require scrolling** — 11+ partitions push Reset/Extract below the fold. User has to scroll past everything to actually extract. | Medium | Actions |
| 5 | **No file metadata at a glance** — the user can't see the ROM name, total payload size, or partition count without scanning the entire UI. | Low | File info |
| 6 | **Reset takes 50% width** — rarely used but takes equal space as the primary Extract action. | Low | Actions |
| 7 | **Path hints are raw absolute paths** — long Windows paths like `C:\Users\akila\OneDrive\Desktop\...` are hard to scan. | Low | Path hints |

---

## Recommendation 1: Adaptive Partition Table (Hide Progress Until Needed)

### Problem
The PROGRESS column is always visible with a fixed `minmax(120px, 1fr)` grid allocation. Before extraction, every row has an empty gap between the partition name and size — it looks broken and wastes ~30% of horizontal space.

### Solution
**Show a 3-column table (checkbox + name + size) by default. Dynamically switch to 4-column (+ progress) only when extraction starts.** This makes the pre-extraction table compact and focused, then expands naturally when progress data exists.

### Before (Current)
```
+----------------------------------------------------------------+
|  [ ]  |  PARTITION    |       PROGRESS       |    SIZE          |
|-------+--------------+----------------------+------------------|
|  [x]  |  boot        |                      |       192 MB     |
|  [x]  |  system      |                      |      1.18 GB     |
|  [x]  |  vendor      |                      |      1.94 GB     |
|       |              |   <- WASTED SPACE     |                  |
+-------+--------------+----------------------+------------------+
```

### After (Proposed)
**Pre-extraction — compact 3-column:**
```
+--------------------------------------------------+
|  [ ]  |  PARTITION                      |  SIZE   |
|-------+--------------------------------+---------|
|  [x]  |  boot                          | 192 MB  |
|  [x]  |  system                        | 1.18 GB |
|  [x]  |  vendor                        | 1.94 GB |
|       |   <- full width for name       |         |
+-------+--------------------------------+---------+
```

**During extraction — expanded 4-column with progress:**
```
+----------------------------------------------------------------+
|  [ ]  |  PARTITION    |       PROGRESS       |    SIZE          |
|-------+--------------+----------------------+------------------|
|  [v]  |  boot        |  ============  100%  |       192 MB     |
|  [~]  |  system      |  ====--------   34%  |      1.18 GB     |
|  [x]  |  vendor      |       (queued)       |      1.94 GB     |
+-------+--------------+----------------------+------------------+
```

### Implementation
- Compute `isExtractionActive = status === 'extracting' || completedPartitions.size > 0`
- Toggle grid template:
  - Default: `grid-cols-[28px_1fr_80px]`
  - Active: `grid-cols-[28px_1fr_minmax(120px,1fr)_80px]`
- Conditionally render the progress column header and cell

### Effort: Low (~30 min)
### Impact: High — cleaner table, no wasted space, better visual density

---

## Recommendation 2: Loading Overlay with Stage Indicator

### Problem
When a ZIP file is selected, the backend extracts payload.bin from the ZIP before parsing partitions. This can take **10-30 seconds** for large OTA files. Currently, the only feedback is a tiny spinner icon embedded inside the file button — extremely easy to miss. The user sees actions like "Select Partitions" which are meaningless during loading.

### Solution
**Replace the content area with a centered loading overlay that shows what's happening stage-by-stage.** Show the stage name, a progress indicator, and the filename being processed. This eliminates confusion and gives the user confidence the app hasn't frozen.

### Before (Current — loading state)
```
+- Extraction Setup ------------------------------------------+
|  INPUT & OUTPUT                                              |
|  [ ~ EvolutionX-16.0-2025...  ]  [ Output (Auto)          ] |
|  Input: C:\Users\akila\OneDrive\Desktop\...                  |
|                                                              |
|  ACTIONS                                                     |
|  [ Reset ]               [ Select Partitions (???) ]         |
|                          <- user sees disabled dead buttons   |
+--------------------------------------------------------------+
```

### After (Proposed — loading state)
```
+- Extraction Setup ------------------------------------------+
|                                                              |
|              +-----------------------------------+           |
|              |                                   |           |
|              |          (spinning icon)           |           |
|              |                                   |           |
|              |    Extracting payload from ZIP     |           |
|              |                                   |           |
|              |    EvolutionX-16.0-marble.zip      |           |
|              |    ========================----    |           |
|              |                                   |           |
|              +-----------------------------------+           |
|                                                              |
+--------------------------------------------------------------+
```

### Stage Messages
| Status | Message | Icon |
|--------|---------|------|
| `loading-partitions` + `.zip` file | "Extracting payload from ZIP..." | Loader2 spinning |
| `loading-partitions` + `.bin` file | "Parsing partition manifest..." | Loader2 spinning |
| `ready` | (show normal UI) | — |

### Implementation
- Detect `status === 'loading-partitions'` AND `!partitions.length`
- Show a centered loading card inside `<CardContent>` instead of the Input/Output + Actions sections
- Display the stage message based on file extension
- Show filename below as context
- Hide Actions entirely during loading (they're useless)

### Effort: Medium (~1 hour)
### Impact: High — eliminates the biggest UX confusion point

---

## Recommendation 3: Sticky Extract Bar + File Info Banner

### Problem
Two issues combined:
1. **Actions at the bottom** — with 11+ partitions the table takes most of the viewport. The Extract button (the most important action) is pushed below the fold. Users must scroll past everything to click Extract.
2. **No quick file overview** — the user can't see at a glance what file is loaded, how many partitions exist, or the total size without reading the full UI.

### Solution
**Replace the separate "Input & Output" section and "Actions" section with a compact file info banner at the top and a sticky action bar at the bottom of the card.** This keeps the primary action always visible and gives instant context about the loaded file.

### Before (Current)
```
+- Extraction Setup ------------------------------------------+
|  INPUT & OUTPUT                             (section header) |
|  [ EvolutionX...zip ] [refresh] [ Output (Auto) ] [open]    |
|  Input: C:\Users\akila\...                                   |
|                                                              |
|  PARTITIONS                   11/11 * 6.83 GB [Deselect All] |
|  +----------------------------------------------------------+|
|  |  [x] boot ........................... 192 MB              ||
|  |  [x] system ........................ 1.18 GB              ||
|  |  [x] vendor ........................ 1.94 GB              ||
|  |  ... (8 more rows, must scroll) ...                      ||
|  +----------------------------------------------------------+|
|                                                              |
|  ACTIONS                                    (section header) |
|  [ Reset ]                    [ Extract (11) ]               |
|                         <- BELOW THE FOLD, must scroll down  |
+--------------------------------------------------------------+
```

### After (Proposed)
```
+- Extraction Setup ------------------------------------------+
|  +----------------------------------------------------------+|
|  | FILE  EvolutionX-16.0-marble-11.3-Official.zip           ||
|  | 11 partitions * 6.83 GB total  [ Output ] [refresh] [^]  ||
|  +----------------------------------------------------------+|
|                                                              |
|                         11/11 selected         [Deselect All] |
|  +----------------------------------------------------------+|
|  |  [x] boot ............................... 192 MB         ||
|  |  [x] dtbo ................................ 24 MB         ||
|  |  [x] system ............................ 1.18 GB         ||
|  |  [x] vendor ............................ 1.94 GB         ||
|  |  ... (scrollable, max-height constrained) ...            ||
|  +----------------------------------------------------------+|
|                                                              |
|  +----------------------------------------------------------+|
|  |  Reset (ghost)     [==== Extract (11) --- 6.83 GB ====]  ||
|  |                    <- sticky / always visible             ||
|  +----------------------------------------------------------+|
+--------------------------------------------------------------+
```

### Key Changes
1. **File Info Banner** (replaces "Input & Output" section):
   - Compact card/banner at top with filename, partition count, total size
   - Output/refresh/open buttons inline as icon buttons on the right
   - Removes "INPUT & OUTPUT" section header and raw path hints

2. **Constrained Partition List**:
   - `max-h-[400px] overflow-y-auto` on the partition list
   - Keeps the Extract button in view even with many partitions
   - Summary line moves to just above the table

3. **Sticky Action Footer**:
   - Extract button + Reset in a footer bar at the card bottom
   - Extract shows the count AND total size: "Extract (11) — 6.83 GB"
   - Reset becomes a small ghost/text button (not 50% width)
   - During extraction: footer becomes a progress summary bar

### Implementation
- Restructure `<CardContent>` into 3 zones: banner -> table -> footer
- The banner is a `bg-muted/30 rounded-lg p-3` section
- Footer uses `border-t pt-4` with `flex justify-between items-center`
- Add `max-h-[400px] overflow-y-auto` to partition list container
- Reset becomes `variant="ghost" size="sm"` aligned left

### Effort: Medium (~1.5 hours)
### Impact: High — most important action is always visible, cleaner info hierarchy

---

## My Recommendation

**Apply all three.** They address different layers and don't conflict:

| # | What | Addresses |
|---|------|-----------|
| 1 | Adaptive table columns | Wasted space, visual noise |
| 2 | Loading overlay | User confusion during ZIP processing |
| 3 | Sticky bar + file banner | Scrolling issue, information hierarchy |

### Suggested Implementation Order

```
Phase 1: Recommendation 1 (Adaptive columns)     -- 30 min, instant visual win
Phase 2: Recommendation 3 (Sticky bar + banner)   -- 1.5 hr, biggest UX improvement
Phase 3: Recommendation 2 (Loading overlay)        -- 1 hr, polish for edge case
```

**Phase 1** gives you the quickest visual improvement. **Phase 3** comes last because loading only happens once per session — it's important but not the first thing users will judge.

---

*Generated: 2026-03-27*
