# Payload Dumper — Remote URL Support Matrix & Expansion Discussion

**Date:** 2026-07-17  
**Status:** Active product report — Waves 0–4 plan items for remote UX/arch **implemented**; optional Phase 4 skeleton rows still open  
**Scope:** What remote URL supports today, format matrix (local vs remote), realistic expansion candidates  
**Related:** Recent factory-image remote fix (async ranges, cancel UX, smart partition auto-select); earlier payload research under `docs/reports/closed/` and `docs/superpowers/plans/`

---

## 1. Purpose

This report freezes a shared picture of **Payload Dumper remote URL** capability so product/engineering can discuss direction before writing an implementation plan.

**In scope**

- Current local vs remote format support
- Remote-only features (modes, safety, UX)
- What can still be added (formats, protocol, product)
- Rough priority for discussion — **not** a sprint plan

**Out of scope (for now)**

- Task breakdown, estimates in days, PR sequencing  
- Full code design for each candidate  
- Committing to ship any of the expansion items

When discussion settles, turn chosen items into a plan under `docs/superpowers/plans/`.

---

## 2. Architecture snapshot (remote path)

```text
UI Remote tab
  → check_remote_payload (HEAD via session cache: size + Accept-Ranges)
  → list_remote_payload_partitions
       ├─ .zip heuristic → find payload.bin (EOCD/CD ranges; CD cached)
       │     └─ miss → factory_image discover (.img + nested image-*.zip)
       └─ else → direct payload.bin header (~1 MB)
  → get_remote_payload_metadata (session reuse; remote_kind payload | factoryImage)
  → extract_payload(https://…)
       ├─ prefetch → span of payload.bin for selected ops (or factory selective)
       └─ direct   → HTTP ranges per op / per image
```

**Hard constraint (industry standard, e.g. rhythmcache payload-dumper):**  
Efficient remote extract needs **HTTP Range** (`Accept-Ranges: bytes` / 206). Without ranges, open fails with structured `REMOTE_NO_RANGE:` (Task 3.6); full GET fallback is not enabled by default.

**Implemented (Wave 3 remote arch, 2026-07-17):** shared session (R1), span prefetch (S2), `REMOTE_NO_RANGE` + hard async cancel (R3 partial / R4).

**Code anchors**

| Layer | Path |
|-------|------|
| Commands | `src-tauri/src/commands/payload.rs` |
| Remote OTA | `src-tauri/src/payload/remote.rs`, `http.rs`, `http_zip.rs` |
| Factory remote | `src-tauri/src/payload/factory_image.rs` |
| Local CrAU | `src-tauri/src/payload/{parser,extractor,zip}.rs` |
| Local OPS/OFP | `src-tauri/src/payload/ops/` |
| Frontend | `src/features/payload-dumper/` |

---

## 3. Format matrix — Local vs Remote

| Format | Local | Remote URL | Notes |
|--------|:-----:|:----------:|-------|
| CrAU `payload.bin` | Yes | Yes | Direct URL to payload |
| OTA ZIP containing `payload.bin` | Yes | Yes | Range locate EOCD/CD; stream payload region |
| Pixel-style **factory** ZIP (outer `.img` + nested STORED `image-*.zip`) | Partial (local ZIP path) | Yes | Dedicated factory path; `remote_kind: factoryImage` |
| OnePlus **OPS** | Yes | **No** | Crypto/container; full file preferred |
| Oppo **OFP** (Qualcomm) | Yes | **No** | Same |
| Oppo **OFP** (MediaTek) | Yes | **No** | Same |
| Delta / incremental OTA | Partial | **No** | Local delta command limited; remote not wired |
| Android sparse expand (post-extract) | Yes | Yes where path produces sparse | OPS and some images |
| Nested factory ZIP **deflated** (not STORED) | N/A | **No** | Defeats range-into-nested-zip model |
| Servers **without** Range | N/A | **No** (fail today) | Candidate: full-download fallback |

**Remote URL today = three real input kinds**

1. Direct `payload.bin` URL  
2. OTA ZIP URL with `payload.bin`  
3. Factory ZIP URL (Pixel/AOSP factory layout)

---

## 4. Remote feature matrix (what works today)

| Capability | Status | Notes |
|------------|:------:|-------|
| HTTP / HTTPS | Yes | SSRF: private IP / localhost blocked |
| HEAD probe (size + range support) | Yes | `check_remote_payload` |
| List partitions without full download | Yes | Manifest or factory CD via ranges |
| Selective partition extract | Yes | User multi-select |
| Direct mode (on-demand ranges) | Yes | Best for fast links / few partitions |
| Prefetch mode | Yes | Download then extract; factory skips blind full-ZIP prefetch when no `payload.bin` |
| Progress events (`payload:progress`) | Yes | Session complete still = invoke return |
| Cancel (cooperative token) | Yes | Improved: async factory I/O, shorter range timeout, cancel between retries |
| Remote metadata panel | Yes | HTTP + ZIP + OTA package fields; factory labels via `remoteKind` |
| Auto-select all partitions | Softened | Large remote packages: auto-select only small images (≤64 MiB) unless package is small overall |
| Resume interrupted download | No | |
| Auth / cookies / custom headers | No | |
| Parallel range workers | No | Sequential factory; OTA uses Rayon on ops with sync ranges on worker threads |
| Hard socket abort on cancel | No | Current request can still run until timeout (~90 s per range after fix) |

---

## 5. Product features (whole dumper — not remote-only)

| Feature | Status |
|---------|:------:|
| Local / Remote source tabs | Yes |
| Partition table, search, multi-select | Yes |
| Output directory, open folder | Yes |
| Local drag-drop | Yes |
| Per-partition progress UI | Yes |
| Cancel + Reset recovery | Yes (Reset allowed while cancelling) |
| CrAU op SHA verification | Yes (local / OTA paths) |
| Parallel local/OTA extract | Yes |
| Diagnose command | Yes |
| OPS/OFP decrypt + unsparse | Yes (local only) |
| Extraction history in store | Yes |

---

## 6. Expansion candidates (discussion)

### 6.1 Protocol / reliability (high leverage)

| ID | Candidate | Value | Difficulty | Discussion notes |
|----|-----------|-------|:----------:|------------------|
| R1 | **No-Range fallback** (full GET → temp → existing local pipeline) | Unlocks many mirrors | Medium | Matches CLI “download first if no ranges” |
| R2 | **Hard cancel** (abort in-flight request) | Cancel feels instant | Medium | reqwest cancel / task abort |
| R3 | **Resume / checkpoint** | Multi‑GB factory reliability | Medium–Hard | Per-partition temp + completed set already partially helps |
| R4 | **Capped concurrent ranges** (2–4) | Faster factory on good CDNs | Medium | Avoid CDN ban / connection storms |
| R5 | **Redirect pin + per-hop SSRF** | Safer `dl.google.com`-class CDNs | Low–Medium | Follow limited redirects; re-validate host |
| R6 | **Custom headers / cookies / UA** | Private mirrors, signed URLs | Medium | Power-user panel |

### 6.2 Format expansion

| ID | Candidate | True streaming remote? | Difficulty | Notes |
|----|-----------|:----------------------:|:----------:|-------|
| F1 | Lineage / AOSP-style OTA ZIP | Already if `payload.bin` | Low | Mostly detection/UX |
| F2 | Direct bare `.img` URL | Trivial “download” | Low | Barely a dumper feature |
| F3 | OPS/OFP over URL | **No** (full download then local) | Hard | Parity feature, not range magic |
| F4 | Delta OTA URL + base images | Partial | Hard | Needs source tree + apply logic |
| F5 | Nested factory ZIP if **deflated** | Weak | Hard | Requires full nested member download |
| F6 | Samsung / Xiaomi / other OEM packs | Case-by-case | Hard | Crypto + layout research per vendor |
| F7 | Split / multi-volume ZIP | Weak | Hard | Rare; poor fit for ranges |

**Principle for discussion:**  
Prefer formats with **index at a known place (ZIP EOCD, CrAU header)** and **compressible selective byte ranges**. Encrypted full-file containers should be framed as “remote download + local extract,” not false streaming.

### 6.3 Product / UX

| ID | Candidate | Difficulty | Notes |
|----|-----------|:----------:|-------|
| U1 | Smart defaults (boot / dtbo / init_boot only) | Low | Safer than size-only auto-select |
| U2 | Explicit multi‑GB extract confirmation | Low | Prevent accidental system.img dump |
| U3 | Remote MB/s + ETA | Medium | Wire richer progress fields already present on local path |
| U4 | Last-N remote URL history | Low | localStorage |
| U5 | Clipboard URL detect on Remote tab focus | Low | |
| U6 | Optional hash check vs published factory SHA | Medium | External metadata source |

---

## 7. Discussion priority bands (not a plan)

Use these bands only to structure conversation. **No commitment until a plan doc is written.**

| Band | Items | Why discuss first |
|------|-------|-------------------|
| **P0 — correctness / completeness** | R1 No-Range fallback, R2 hard cancel | Unblocks “broken URL” class and cancel UX class |
| **P1 — factory / large file UX** | R3 resume, R4 concurrent ranges, U1–U2 smart select + warnings | Matches real Google factory workflows |
| **P2 — power users** | R5–R6 redirects/auth, U3–U5 telemetry/history/clipboard | Differentiation without new formats |
| **P3 — format parity** | F3 OPS/OFP download-then-local, F4 delta remote | Expensive; clarify if product wants “all formats remote” branding |
| **Later / skip** | F6 broad OEM, F7 split ZIP, torrents | Scope explosion |

---

## 8. Open questions for discussion

1. **Product goal:** Best-in-class *streaming OTA/factory* remote dumper, or *any firmware URL → files* (including full-download OPS/OFP)?  
2. **Default selection policy:** Size threshold only (current), name-based (boot family), or select-none until user chooses?  
3. **No-Range behavior:** Hard fail (current), auto full download with clear progress, or user confirmation before multi‑GB GET?  
4. **Cancel SLA:** Is “stop after current 8 MiB chunk” enough, or must mid-request abort ship?  
5. **Concurrency:** Accept CDN risk for faster factory extract? Cap?  
6. **Security:** Allow user-supplied headers (cookie theft / SSRF via open redirect)?  
7. **Scope freeze:** Ship remote polish only through v0.x, defer new OEM formats?  
8. **Load-partitions UX:** Ship §9 preferred in-panel progress card as part of remote polish (independent of format expansion)?

---

## 9. Remote “Load Partitions” UX design (preferred)

**Status:** Design accepted for discussion / future plan — **not implemented yet.**  
**Preference:** Option A — **in-panel progress card**, keep Remote tab context (URL + range status visible).

### 9.1 Problem (current UX)

Observed when user clicks **Load Partitions from URL** after a successful Check URL (e.g. multi‑GB OnePlus/Google ZIP, range supported, size shown):

| What user sees | What’s wrong |
|----------------|--------------|
| Green “Range requests supported · Estimated download: X GB” | Good — but easy to misread as “downloading X GB now” |
| Full-width red **Cancel Loading…** only | No spinner, no step, no elapsed time |
| Empty space below | Feels frozen / hung for 10–60s+ |

**Code path mismatch**

```text
Load Partitions from URL
  → status = loading-partitions
  → payloadPath still EMPTY until list succeeds
  → View: payloadPath ? … : PayloadSourceTabs
  → Only UI change: button label → "Cancel Loading…"

LoadingState (spinner + message) only mounts when
  payloadPath is set AND status === loading-partitions
  → remote first load never shows LoadingState
```

Backend meanwhile does multi-step range work (EOCD, central directory, format detect, factory nested ZIP or CrAU header) inside a single `ListRemotePayloadPartitions` invoke — UI has no phases.

### 9.2 Design goals

| Goal | Detail |
|------|--------|
| Always visible activity | Spinner / active step + indeterminate progress |
| Named stages | User knows *what* is slow |
| Soft time signal | Elapsed timer + “large ZIP can take up to a minute” |
| Keep context | Stay on Remote tab; URL + size + range badge remain |
| Honest bandwidth copy | Explicit: **not** downloading full package size |
| Clear cancel | Cancel inside progress card, not a lone red bar |

### 9.3 Preferred layout — in-panel progress card

Keep **Local / Remote** tabs and the URL + Check URL + Prefetch + range status card.  
Under the range card, replace the bare Cancel button with a **Loading partitions** card:

```text
┌─ Extraction Setup ──────────────────────────────────────────┐
│  [ Local File ]  [ Remote URL ● ]                           │
│                                                              │
│  Payload or factory image URL                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ https://…/package.zip                             [✓]  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Prefetch mode  ○  off                                       │
│                                                              │
│  ┌─ Range requests supported ─────────────────────────────┐  │
│  │  ✓  Estimated size: 3.52 GB                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Loading partitions ───────────────────────────────────┐  │
│  │                                                        │  │
│  │   ✓ 1  Verify connection          done                 │  │
│  │   ● 2  Locate ZIP index           working              │  │
│  │   ○ 3  Detect format              waiting              │  │
│  │   ○ 4  Read partition list        waiting              │  │
│  │                                                        │  │
│  │   ═══════════════════════════════  (indeterminate)     │  │
│  │   Step 2 of 4 · Elapsed 0:18                           │  │
│  │   Only reading index — not downloading full 3.52 GB    │  │
│  │                                                        │  │
│  │   [            Cancel loading            ]             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Why this over a full-page spinner**

- User does not lose the URL they pasted or the range proof.  
- Cancel stays next to the work description.  
- Matches desktop “task in context” patterns (not a route change).

### 9.4 Compact variant (if vertical space is tight)

```text
┌─ Loading partitions from remote ────────────────────────────┐
│  [spin]  Locating ZIP central directory…                    │
│          oneplus…OxygenOS_….zip                             │
│  ════════════════════════════════  indeterminate            │
│  0:24 elapsed · only reading index, not full 3.52 GB        │
│  [ Cancel ]                                                 │
└─────────────────────────────────────────────────────────────┘
```

Prefer **§9.3 full step list** when height allows; fall back to compact under ~640px content height if needed.

### 9.5 Stage model (user-facing ↔ backend)

| Step | Label | Backend (approx) |
|:----:|-------|------------------|
| 1 | Verify connection | Reuse Check URL result if `connectionStatus === ready`; else HEAD |
| 2 | Locate package index | Range: tail EOCD + Central Directory |
| 3 | Detect format | `payload.bin` in ZIP? → OTA/CrAU; else factory image path |
| 4 | Read partition list | CrAU manifest header **or** factory `.img` entry list |
| — | Ready | Partition table + toast |

```text
  idle ──Load──► loading
                   │
         ┌─────────┼─────────┬──────────┐
         ▼         ▼         ▼          ▼
      stage1    stage2    stage3     stage4
         │         │         │          │
         └─────────┴────┬────┴──────────┘
                        ▼
              success → ready (FileBanner + PartitionTable)
              cancel  → idle / remote form
              error   → error inside card + Retry
```

### 9.6 Microcopy

| Moment | Copy |
|--------|------|
| Card title | Loading partitions |
| Stage 2 | Locating ZIP index (range request)… |
| Stage 3 OTA | Found payload.bin — parsing manifest… |
| Stage 3 factory | No payload.bin — scanning factory images… |
| Stage 4 | Building partition list… |
| Reassurance | Only reading index — not downloading full {size}. |
| Slow (>15s) | Still working — large packages can take up to a minute. |
| Slow (>45s) | Taking longer than usual. Check network or Cancel and retry. |
| Cancel | Stopped loading partitions. |
| Error | Couldn’t read remote index. + short reason + Retry |

### 9.7 Interaction rules

```text
 BEFORE load
   URL editable · [ Check URL ] · [ Load Partitions from URL ]

 DURING load
   · Disable URL edit, Check URL, Prefetch (or: edit → auto-cancel)
   · Show in-panel progress card (§9.3)
   · Primary destructive: Cancel loading
   · Keep range/status card visible

 AFTER success
   · Transition to FileBanner + PartitionTable (existing)
   · Toast: Found N partitions

 AFTER error
   · Stay on Remote tab
   · Error line inside progress card
   · [ Retry ] [ Edit URL ]
```

### 9.8 Before vs after

```text
 BEFORE
 ┌────────────────────────────┐
 │ Range OK · 3.52 GB         │
 │ [==== Cancel Loading… ===] │
 │                            │  ← void; feels hung
 └────────────────────────────┘

 AFTER (preferred)
 ┌────────────────────────────┐
 │ Range OK · 3.52 GB         │
 │ ┌ Loading partitions ────┐ │
 │ │ ● Locate ZIP index     │ │
 │ │ ████ indeterminate     │ │
 │ │ 0:18 · not full 3.52GB │ │
 │ │ [ Cancel loading ]     │ │
 │ └────────────────────────┘ │
 └────────────────────────────┘
```

### 9.9 Implementation notes (for future plan only)

| Phase | Scope | Effort (rough) | Status |
|:-----:|-------|----------------|--------|
| **1** | FE-only: while `loading-partitions` on remote form, show spinner + elapsed + “not full {size}” + Cancel (fix branch so remote load is not a blank Cancel bar) | Small | **Done (FE Wave 2)** |
| **2** | FE step list with optimistic/timer stage advances + microcopy | Small–Med | **Done (FE Wave 2)** |
| **3** | Rust `payload:load-progress` events (contract: `verifyConnection` / `locateIndex` / `detectFormat` / `readPartitions` / `done` / `error`) for truthful steps | Medium | **Done (Rust Wave 2.1)** |
| **4** | Optional skeleton rows / OTA vs factory badge | Polish | Not started |

**Rust load-progress (Phase 3 — Wave 2.1)**

- Helper: `src-tauri/src/payload/remote/load_progress.rs` → `emit_load_progress`
- Wired: `list_remote_payload_partitions` + `list_remote_factory_image_partitions`; command passes `AppHandle`
- Phases: `verifyConnection` → `locateIndex` → `detectFormat` → `readPartitions` → `done` | `error`
- DTO: `PartitionDetail.downloadSize` (CrAU: sum op `data_length`; factory: compressed size)

**FE anchors (Wave 2)**

- `RemoteLoadProgressCard.tsx` — in-panel steps 1–4, indeterminate bar, elapsed, “not full {size}”, Cancel  
- `PayloadSourceTabs.tsx` — shows load card during remote `loading-partitions` even when `payloadPath` empty  
- `usePayloadLoadEvents.ts` — listens for `payload:load-progress`; optimistic stages after 500ms if no event  
- Store: `loadPhase` / `loadStep` / `loadStartedAt` / `beginLoadProgress` / `clearLoadProgress`  

**Event shape (frozen contract — shipped Rust + FE)**

```json
{
  "phase": "verifyConnection | locateIndex | detectFormat | readPartitions | done | error",
  "message": "string",
  "detail": "string | null",
  "step": 1,
  "totalSteps": 4
}
```

### 9.10 Decision log

| Decision | Choice |
|----------|--------|
| Layout | **A — in-panel progress card** (keep Remote tab) |
| Full-page takeover spinner | Rejected as primary |
| Leave Cancel-only bar | Rejected |
| Plan / tasks | Wave 2 load-progress + downloadSize done; Wave 3 session/span/cancel done; Wave 4.2 extract `stats` filled on remote success paths |

---

## 10. Recent context (2026-07)

User report on Google factory URL:

- List OK, small image appeared on disk, UI stayed extracting, Cancel stuck.

Findings / fixes (not restated in full here):

- Select-all on large factory packages felt “stuck” while later multi‑GB images continued  
- Blocking HTTP on async worker hurt cancel/invoke completion  
- Cancel UX had no recovery path  

**Additional UX observation (same period):**  
Remote **Load Partitions** with only **Cancel Loading…** and no progress (see §9) — separate from extract stuck; same “am I hung?” class of feedback failure.

Document extract fixes separately if needed; this report remains capability matrix + expansion discussion + **load-partitions UX design**.

---

## 11. Next step (when ready)

1. Agree answers to §8 open questions (including load-partitions UX).  
2. Pick a short list from §7 bands (e.g. P0 + subset of P1) **and/or** §9 Phases 1–2 as remote polish.  
3. Author `docs/superpowers/plans/YYYY-MM-DD-payload-remote-url-expansion.md` (and/or a focused load-progress plan) with goals, non-goals, tasks, and verification.  
4. Implement only after plan review.

**This document intentionally does not include a full phased engineering plan** beyond the light §9.9 notes for the accepted UX direction.

---

## 12. Summary one-liner

**Today:** remote URL is strong for **payload.bin / OTA ZIP / Pixel factory ZIP** with Range streaming; **Load Partitions** feedback is weak (Cancel-only).  
**Tomorrow (discussable):** no-range fallback, harder cancel, resume, parallel ranges, format parity wrappers; **plus** preferred **in-panel load-progress card** (§9) so large remote lists never feel stuck; OPS/OFP/delta “remote” mostly means download-then-local, not true selective streaming.
