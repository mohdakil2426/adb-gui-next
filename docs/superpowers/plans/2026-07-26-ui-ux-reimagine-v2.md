# Implementation Plan — ADB GUI Next v2: "Precision Instrument"

> **Date:** 2026-07-26 · **Branch:** `feat/ui-ux-reimagine-v2` · **Baseline:** `9494527`
> **Evidence base:** `docs/internal/reports/closed/2026-07-26/2026-07-26-full-stack-redesign-audit.md`
> **Direction:** Precision Instrument — cool slate neutrals, one electric-cyan accent, dense desktop rhythm.
> **Depth:** Foundation + showcase. Design system, shell, Dashboard, all critical safety/perf fixes land production-quality; remaining views migrate as far as time allows.

---

## 1. Design system

### 1.1 Principle

The current theme is stock shadcn neutral: every base colour is `oklch(L 0 0)` — chroma exactly zero. It is indistinguishable from every other shadcn starter. The replacement is built on three ideas:

1. **Chroma-tinted neutrals.** Every grey carries a trace of blue (`chroma 0.008–0.016`, `hue 250`). This is what separates a designed dark UI from a default one — pure grey reads as cheap, tinted grey reads as intentional. The tint is small enough that nothing looks "blue" and large enough that the whole surface feels cohesive.
2. **One accent, used sparingly.** Electric cyan (`hue 210`) marks exactly one thing per screen: the primary action or the active state. Status colours (success/warning/danger) are a separate, orthogonal vocabulary — they describe device state, never UI emphasis.
3. **Numbers are first-class.** This is a telemetry tool. Tabular numerics, a real monospace face, and consistent unit formatting are load-bearing, not decoration.

### 1.2 Colour tokens

Dark is the primary theme (a device-flashing tool is used in dark rooms and next to terminals). Light is a full, equally-considered counterpart — not an afterthought.

```
                    DARK (primary)              LIGHT
canvas              oklch(0.145 0.012 250)      oklch(0.985 0.003 250)
surface             oklch(0.185 0.014 250)      oklch(1     0     0  )
surface-raised      oklch(0.215 0.015 250)      oklch(0.975 0.004 250)
surface-overlay     oklch(0.235 0.016 250)      oklch(1     0     0  )
border              oklch(0.285 0.014 250)      oklch(0.905 0.006 250)
border-strong       oklch(0.365 0.016 250)      oklch(0.845 0.008 250)

text                oklch(0.965 0.004 250)      oklch(0.205 0.014 250)
text-muted          oklch(0.715 0.012 250)      oklch(0.505 0.014 250)
text-subtle         oklch(0.565 0.012 250)      oklch(0.625 0.012 250)

accent              oklch(0.72 0.155 210)       oklch(0.55 0.165 210)
accent-hover        oklch(0.78 0.150 210)       oklch(0.48 0.170 210)
accent-fg           oklch(0.145 0.02  250)      oklch(0.99 0.005 210)
accent-muted        color-mix(accent 14%, transparent)

success             oklch(0.72 0.17  155)       oklch(0.52 0.155 155)
warning             oklch(0.80 0.15   75)       oklch(0.62 0.145  70)
danger              oklch(0.65 0.22   22)       oklch(0.55 0.215  25)
info                oklch(0.70 0.14  240)       oklch(0.52 0.155 250)
```

**Rationale for the lightness ladder.** Four surface levels (`canvas → surface → raised → overlay`) at roughly `+0.03 L` each. That step is large enough to read as separation without borders, small enough that a four-level stack (canvas → card → nested panel → popover) never approaches mid-grey. The current theme has only two levels and compensates with borders everywhere.

**Chart ramp** — the existing `--chart-1..5` tokens are defined and never used. They get real values, chosen to be distinguishable in both themes and for the two most common colour-vision deficiencies (deutan/protan), by varying **lightness as well as hue** rather than hue alone:

```
chart-1  oklch(0.72 0.155 210)   cyan     (accent — the "primary series")
chart-2  oklch(0.68 0.170 155)   green
chart-3  oklch(0.78 0.150  75)   amber
chart-4  oklch(0.65 0.190 300)   violet
chart-5  oklch(0.70 0.180  25)   coral
```

**Device-status tokens** keep their existing bg/fg/border triple architecture (it is genuinely good) with two fixes: `recovery` gets its own hue (currently identical to `adb`, so the two states are indistinguishable), and every triple is re-derived from the new ramp.

```
adb           success  · connected, ready
recovery      info     · recovery mode          ← was identical to adb
fastboot      warning  · bootloader/fastboot
unauthorized  danger   · needs USB-debug approval
offline       subtle   · seen but not reachable
```

### 1.3 Typography

**Self-hosted.** Google Fonts is removed entirely — `index.html:10-15` plus the `font-src`/`style-src` CSP allowances. A desktop tool that flashes phones cannot depend on a network round-trip to render text, and it should not phone home to Google on every launch.

| Role | Face | Why |
| --- | --- | --- |
| UI | **Inter Variable** | Designed for UI at small sizes; excellent `tabular-nums`; variable = one file, all weights |
| Numeric / code | **JetBrains Mono Variable** | Serials, paths, package names, hashes, logs, shell. Distinct `0/O` and `1/l/I` — this matters when reading a device serial aloud |

Both ship as `woff2` in `public/fonts/`, declared with `font-display: swap` and `<link rel="preload">`. Onest is dropped.

**Type scale** — replaces the current two-size ramp (320 of 367 declarations are `text-xs`/`text-sm`) and eliminates all 47 arbitrary `text-[Npx]` values. Base is **13px**, the desktop-dense standard (VS Code 13, Linear 13, Xcode 13) rather than the web's 16.

```
display   24px / 1.2  / -0.02em  600   view titles
title     17px / 1.3  / -0.01em  600   card headers, dialog titles
body      13px / 1.5  /  0       400   default
label     12px / 1.4  /  0       500   form labels, table headers
caption   11px / 1.4  /  0.01em  500   metadata, timestamps, badges
mono      12px / 1.5  /  0       400   serials, paths, logs, shell
mono-sm   11px / 1.5  /  0       400   dense log gutters
```

**Floor is 11px.** The current `text-[9px]` — used for the header unread badge and debloater safety-tier chips, i.e. the two places where misreading has real consequences — is gone.

`font-variant-numeric: tabular-nums` is applied to every numeric context: table columns, progress percentages, byte counts, chart axes, device telemetry. Numbers must not jitter as they update.

### 1.4 Space, radius, elevation

**4px base grid.** Density targets a technician scanning a table, not a marketing page.

```
radius   sm 4px · md 6px · lg 8px · xl 12px · full 9999px      (base 6px)
control  xs 22px · sm 26px · md 30px · lg 36px                 (was 5 sizes: 24/28/32/36/44)
row      compact 28px · default 32px · relaxed 40px
sidebar  collapsed 48px · expanded 224px
header   44px          status bar 26px          panel min 160px
```

**Elevation is borders + surface steps, not shadows.** Dark UIs cannot use shadow for separation — shadow on near-black is invisible. Depth comes from the four-level surface ladder plus a hairline border. Shadows appear only on genuinely floating layers (popover, dialog, dropdown).

**The glow buttons are deleted.** `button-variants.ts:9` currently emits `shadow-[0_0_15px_color-mix(in_oklch,var(--primary)_50%,transparent)]` — and since `--primary` is black in light mode, every primary CTA renders a **black halo on white**. Replaced with a solid accent fill, a 1px inset top highlight for tactility, and a real `focus-visible` ring.

### 1.5 Motion

Interruptible, compositor-only, and honest about duration.

```
instant  90ms   cubic-bezier(0.2, 0, 0, 1)   hover, press, checkbox
fast    140ms   cubic-bezier(0.2, 0, 0, 1)   dropdown, tooltip, tab
base    200ms   cubic-bezier(0.2, 0, 0, 1)   dialog, sheet, panel
slow    320ms   cubic-bezier(0.2, 0, 0, 1)   view transition
```

Only `transform` and `opacity` animate — never `height`, never `transition: all`. `prefers-reduced-motion` collapses everything to 0.01ms (already correct at `global.css:377-386`; kept).

---

## 2. Shell redesign

### 2.1 Current vs new

The current shell has **no visible page title anywhere in the application** — every `<h1>` is `sr-only` and the header shows only a device pill and five icons. There is no global search, no persistent operation feedback, and the bottom panel overlays content with a `paddingBottom` hack.

```
╔═ CURRENT ══════════════════════════════════════════════════════════════════╗
║ ┌────────┬──────────────────────────────────────────────────────────────┐  ║
║ │ [logo] │ [☰] │ [Pixel 7 ·adb ▾]          [Cpu][Term][🌙] │ [>_][Logs] │  ║ 48px
║ │ inert  ├──────────────────────────────────────────────────────────────┤  ║
║ │        │                                                              │  ║
║ │ Main   │   ← no title, no breadcrumb, no context whatsoever            │  ║
║ │ ▸Dash  │                                                              │  ║
║ │  Apps  │   content (max-w 1280px, centred on a desktop app)            │  ║
║ │  Files │                                                              │  ║
║ │ Advncd │                                                              │  ║
║ │  Flash │                                                              │  ║
║ └────────┴──────────────────────────────────────────────────────────────┘  ║
║ ┌ BottomPanel — OVERLAYS content, compensated by paddingBottom hack ────┐  ║
║ │ Logs │ Shell                                              [_][□][×]   │  ║
║ └───────────────────────────────────────────────────────────────────────┘  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

```
╔═ NEW ══════════════════════════════════════════════════════════════════════╗
║ ┌──────────┬───────────────────────────────────────────────────────────┐   ║
║ │ ▰ ADB    │  Dashboard                    ⌘K Search…    ◐  ⋯          │   ║ 44px
║ │   GUI    │  ────────────                 ──────────                  │   ║
║ ├──────────┼───────────────────────────────────────────────────────────┤   ║
║ │ ┌──────┐ │                                                           │   ║
║ │ │Pixel7│ │   ← real title + optional breadcrumb                      │   ║
║ │ │●adb  │ │                                                           │   ║
║ │ │A15·34│ │   content — fluid width, no artificial 1280px cap         │   ║
║ │ └──────┘ │                                                           │   ║
║ │ DEVICE   │                                                           │   ║
║ │ ▸Dashbrd │                                                           │   ║
║ │  Apps  ⁴ │   ← badge: 4 updates available                            │   ║
║ │  Files   │                                                           │   ║
║ │  Store   │                                                           │   ║
║ │ FIRMWARE │                                                           │   ║
║ │  Flasher⚠│   ← risk marker on destructive section                    │   ║
║ │  Dumper  │                                                           │   ║
║ │ TOOLS    │                                                           │   ║
║ │  Utils   │                                                           │   ║
║ │  Emulatr │                                                           │   ║
║ ├──────────┼───────────────────────────────────────────────────────────┤   ║
║ │ ⚙  ⓘ     │ ● adb 35.0.2 · Pixel 7 · ⣾ Extracting system.img  62% ⏹  │   ║ 26px
║ └──────────┴───────────────────────────────────────────────────────────┘   ║
╚════════════════════════════════════════════════════════════════════════════╝
                                                   ↑ status bar — persistent
                                                     operation feedback, always
                                                     visible, cancellable
```

### 2.2 What changes and why

| Change | Reason |
| --- | --- |
| **Visible page title** in the header | The app currently has zero wayfinding beyond a sidebar highlight |
| **Device card in the sidebar** (name, status dot, Android/API) | Device identity is the app's most important global state; a 120px-truncated pill in the header under-serves it |
| **⌘K command palette** | 60+ actions across 9 views with no global search. `cmdk` was previously removed as dead code — it returns with a real call site |
| **Status bar** (26px) | Long operations currently live in transient toasts that vanish. Flash, push/pull, extract, debloat need a persistent, cancellable home |
| **Sidebar groups → Device / Firmware / Tools** | Current "Main / Advanced" puts the device-bricking Flasher in the same bucket as the Emulator. Grouping now reflects risk and intent |
| **Risk marker on Firmware group** | Destructive sections should look destructive before you click |
| **Nav badges** | The sidebar currently never communicates that anything is happening |
| **Bottom panel joins the flex column** | Removes the `paddingBottom` overlay hack; views get honest height |
| **Drop `max-w-1280px`** | It's a desktop app; users run it maximised on 27" displays |

### 2.3 Command palette (⌘K / Ctrl+K)

```
        ╔══════════════════════════════════════════════════════╗
        ║  ⌕  reb|                                             ║
        ╟──────────────────────────────────────────────────────╢
        ║  ACTIONS                                             ║
        ║  ⏻  Reboot to System                      Pixel 7   ║
        ║  ⚡  Reboot to Bootloader                  Pixel 7   ║
        ║  ↻  Reboot to Recovery                    Pixel 7   ║
        ║  ⏻  Reboot to Fastbootd                   Pixel 7   ║
        ║  NAVIGATE                                            ║
        ║  ▸  Flasher                                    ⌥3   ║
        ║  DEVICES                                             ║
        ║  ●  Pixel 7            1A2B3C4D           active    ║
        ╟──────────────────────────────────────────────────────╢
        ║  ↑↓ navigate   ↵ run   esc close                    ║
        ╚══════════════════════════════════════════════════════╝
```

Registry-driven: each action declares `id`, `label`, `group`, `icon`, `keywords`, `run()`, and a `available(ctx)` predicate. Actions unavailable in the current device state are **shown disabled with the reason** — never hidden. That is the "smart gate, not a dead end" pattern already used well by the AVD root wizard, generalised.

---

## 3. Dashboard redesign

### 3.1 The blocker: the backend returns display strings

`GetDeviceInfo` returns `batteryLevel: "87%"`, `storageInfo: "12G used of 64G"`, `ramTotal: "5.6 GB"` — pre-formatted strings. **The frontend cannot chart them without parsing display text.** This is why the `--chart-1..5` tokens have sat unused since they were defined.

So the dashboard redesign *requires* a backend contract change, and that change also fixes the 12-spawn latency problem. One change, two wins.

```rust
// NEW — structured, chartable, one shell round-trip
pub struct DeviceTelemetry {
    pub identity:  DeviceIdentity,   // brand, model, codename, serial, android, sdk, build, arch
    pub battery:   BatteryInfo,      // level_pct: u8, status, health, temperature_c, voltage_mv
    pub memory:    MemoryInfo,       // total_bytes, available_bytes, used_bytes  (u64)
    pub storage:   Vec<StorageVolume>, // mount, total_bytes, used_bytes, free_bytes
    pub security:  SecurityInfo,     // rooted, bootloader_unlocked, verified_boot, encryption, selinux, patch
    pub network:   NetworkInfo,      // ip, wifi_ssid, mac
    pub uptime_seconds: u64,
}
```

Numbers as numbers. Formatting is a frontend concern.

### 3.2 Layout

```
╔════════════════════════════════════════════════════════════════════════════╗
║  Dashboard                                    ⌘K Search…      ◐   ⋯        ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  ┌──────────────────────────────────────┬─────────────────────────────┐   ║
║  │  ╭────╮  Pixel 7                     │  BATTERY                    │   ║
║  │  │ ▰▰ │  Google · panther            │      ╭─────────╮            │   ║
║  │  │ ▰▰ │  ● Connected · adb           │      │   87%   │  ▲ charging │   ║
║  │  ╰────╯  1A2B3C4D          [copy]    │      │  ▓▓▓▓░  │            │   ║
║  │                                      │      ╰─────────╯            │   ║
║  │  Android 15  ·  API 34  ·  arm64-v8a │   32.4°C · 4102 mV · Good   │   ║
║  │  Build UQ1A.240205.004               │                             │   ║
║  ├──────────────────────────────────────┼─────────────────────────────┤   ║
║  │  STORAGE                             │  MEMORY                     │   ║
║  │                                      │                             │   ║
║  │  /data      ▓▓▓▓▓▓▓▓▓▓▓▓░░░░  74%   │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░  71%  │   ║
║  │             47.2 GB of 64.0 GB       │   5.7 GB of 8.0 GB used     │   ║
║  │  /sdcard    ▓▓▓▓▓▓▓▓░░░░░░░░  52%   │                             │   ║
║  │             33.1 GB of 64.0 GB       │   ▁▂▃▅▃▂▄▆▅▃▂▃▄▃▂  live     │   ║
║  └──────────────────────────────────────┴─────────────────────────────┘   ║
║                                                                            ║
║  ┌─ SECURITY & BOOT ──────────────────┬─ QUICK ACTIONS ────────────────┐  ║
║  │  Root access        ✕  Not rooted  │  ⏻ Reboot      ⚡ Bootloader    │  ║
║  │  Bootloader         ⚠  Unlocked    │  ↻ Recovery    ⌨ Shell         │  ║
║  │  Verified boot      ✓  Green       │  ⇄ Wireless    📁 Files        │  ║
║  │  Encryption         ✓  File-based  │                                │  ║
║  │  SELinux            ✓  Enforcing   │  WIRELESS ADB                  │  ║
║  │  Security patch     ✓  2026-06-05  │  ○ Not connected               │  ║
║  │                        3 wks ago   │  [ 192.168.1.14 ] [ 5555 ] [→] │  ║
║  └────────────────────────────────────┴────────────────────────────────┘  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

**No device connected** — replaces the current "silently disabled everything":

```
╔════════════════════════════════════════════════════════════════════════════╗
║                              ╭──────────╮                                  ║
║                              │    ▰▰    │   (subtle pulse)                 ║
║                              ╰──────────╯                                  ║
║                       No device connected                                  ║
║          Connect an Android device over USB, or pair wirelessly.           ║
║                                                                            ║
║   ┌── 1 ──────────┐  ┌── 2 ──────────┐  ┌── 3 ──────────┐                 ║
║   │ Enable        │  │ Enable USB    │  │ Accept the    │                 ║
║   │ Developer     │  │ debugging in  │  │ RSA prompt    │                 ║
║   │ options       │  │ Developer     │  │ on your phone │                 ║
║   │ (tap Build    │  │ options       │  │               │                 ║
║   │  number ×7)   │  │               │  │               │                 ║
║   └───────────────┘  └───────────────┘  └───────────────┘                 ║
║                                                                            ║
║        [ ⇄ Connect Wirelessly ]   [ ⟳ Scan Again ]   [ Troubleshoot ]     ║
║                                                                            ║
║        ⣾ Watching for devices…                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

This is the app's true first-run screen and it currently does not exist. Zero onboarding is finding #12 in the audit.

### 3.3 Charts

shadcn `Chart` (wraps Recharts) — the project-endorsed path per `.agents/skills/frontend/shadcn/SKILL.md`, themed by the `--chart-*` CSS variables that already exist. Used only where a chart genuinely beats a number:

| Visual | Data | Why not just text |
| --- | --- | --- |
| Radial gauge | Battery % | Instantly readable at a glance; colour-codes low battery |
| Stacked bar | Storage per volume | Shows used/free proportion, which "12G used of 64G" does not |
| Sparkline | RAM over session | Reveals trend and pressure; a single number cannot |
| Donut | Package composition (system/user/disabled) | App Manager — makes debloat progress legible |
| Horizontal bars | Partition sizes | Payload Dumper — shows what dominates an extraction |

Charts are lazy-loaded so Recharts never enters the initial bundle.

---

## 4. Backend work

### 4.1 Correctness & safety (must land)

| ID | Change | File |
| --- | --- | --- |
| C1/C2 | `checked_add` + `mmap.get(start..end)` on all untrusted manifest offsets | `remote/mod.rs:951-957`, `crau/extract.rs:265-271` |
| M14 | Error instead of silently truncating short REPLACE data | `remote/mod.rs:1015`, `crau/extract.rs:397` |
| C5 | `NonTemporalWriter` fallback for `size == 0` and 32-bit targets | `io/write.rs:40-66` |
| M1 | `impl Drop for PayloadCache` + use managed state in `extract_delta_payload` | `commands/payload.rs:408` |
| M2 | `TransactionGuard` on both remote extract paths | `remote/mod.rs:704,870` |
| M8 | Refuse to cache under `"unknown"` device id | `debloat/sync.rs:41-45` |
| H11 | `error_for_status()` + preserve the cache/bundled fallback chain; call `load_uad_lists` once | `debloat/lists.rs:65-84`, `commands/debloat.rs:95,106` |
| H12 | Verify the Magisk `sha256`; validate redirects | `magisk_download.rs:131,202-227` |
| — | Validate package names `^[A-Za-z0-9._]+$` before `adb shell pm` | `debloat/actions.rs:150` |

### 4.2 Performance

| ID | Change | Expected |
| --- | --- | --- |
| H7 | `[profile.release] opt-level = 3`; adopt in CI; delete `release-fast` | 20–40% on extraction |
| H2 | Delete the SIMD copy module → `copy_from_slice` | 10–30× on ARM; −90 lines `unsafe` |
| H1 | Remove `payload.manifest.clone()` from the rayon loop | −0.2–2 GB alloc per extraction |
| H3 | Throttle progress emission to ~4/s via a shared `AtomicU64` | 2,000–16,000 events → ~40 |
| H6 | Hash the writer's own mmap instead of a second read pass | −8 GiB reads per extraction |
| H8 | `get_device_info` → one batched shell call | 12 spawns → 1–2 |
| M5 | `OnceLock` binary path resolution | −4–8 syscalls × 112 sites |
| H4 | `spawn_blocking` the remote extract paths | frees a pinned Tokio worker |

### 4.3 New: `AdbClient`

The structural change that unlocks the rest. 112 spawn sites currently have no abstraction, and three separate copies of exit-marker parsing exist.

```rust
pub struct AdbClient { serial: Option<String>, exe: &'static Path }

impl AdbClient {
    fn shell(&self, cmd: &str) -> Result<String>;
    /// One process, N commands, per-command exit codes via delimiter markers.
    fn shell_batch(&self, cmds: &[&str]) -> Result<Vec<CmdOutput>>;
}
```

First three consumers: `get_device_info` (12→1), debloat restore (400+→4), `detect_package_states` (3→1).

---

## 5. Frontend architecture

| # | Change | Effect |
| --- | --- | --- |
| 1 | `React.lazy` all 9 views + `Suspense` | 566 kB → ~150–250 kB initial |
| 2 | Un-subscribe `MainLayout` from `unreadCount`; extract `<UnreadBadge/>`; hoist `renderContent`; memo `ViewContent` | Kills a full-app re-render per log line |
| 3 | Global query defaults `staleTime: 30s`, `refetchOnWindowFocus: false`; AVD `staleTime` | Stops subprocess spawns on alt-tab |
| 4 | Split payload progress into a **non-persisted** store + rAF throttle | Removes a blocking `localStorage` write per progress event |
| 5 | Virtualise `LogsPanel`; memo `LogRow`; hoist the regex; pass `logCount` not `logs` | 1,000 rows → ~30 |
| 6 | `nicknameStore` → real in-memory Zustand | Removes sync `localStorage`+`JSON.parse` from render |
| 7 | Delete the 750 ms artificial splash; gate on real readiness | −750 ms cold start |
| 8 | Self-host fonts; tighten CSP | Removes a network round-trip before first paint |
| 9 | Stabilise selection callbacks → memo `FileExplorerRow`; pass `isSelected` not the `Set` | Search typing: ~30 row re-renders → ~1 |
| 10 | Fix defeated memos (marketplace closures, `DropZone` deps) | Makes existing `memo`s work |

---

## 6. Safety UX (the inverted risk model)

```
╔═ FLASH CONFIRMATION — currently does not exist at all ══════════════════════╗
║  ⚠  Flash boot partition?                                                  ║
║  ────────────────────────────────────────────────────────────────────────  ║
║   Target      Pixel 7 · 1A2B3C4D · fastboot                                ║
║   Partition   boot                          (slot a — active)              ║
║   Image       boot-magisk.img                                              ║
║               64.0 MB · modified 2 minutes ago                             ║
║                                                                            ║
║   ⚠ Flashing the wrong image can prevent your device from booting.         ║
║     Make sure this image is built for Pixel 7 (panther).                   ║
║                                                                            ║
║                              [ Cancel ]   [ Flash boot ]                   ║
╚════════════════════════════════════════════════════════════════════════════╝
```

- Confirmation for **flash, sideload, slot switch, kill-server, reboot→bootloader/recovery, AVD restore** — matching the existing wipe/uninstall/delete standard.
- Higher-risk partitions (`userdata`, `super`, `bootloader`, `radio`, `modem`) require typing the partition name to confirm.
- **Remove the queued auto-flash-on-connect behaviour** entirely (`useFlasherActions.ts:102-129`). Replace with "connect a device, then flash" — no destructive operation should fire on cable insertion.
- **Wire `RestoreDebloatBackup`** — add the `backend.ts` wrapper and a real restore UI. The app currently creates backups it cannot restore.
- Clear persisted flash paths on app start.

---

## 7. Execution order

Each phase is independently verifiable. Verification: `bun run lint:web`, `bun run test`, `bun run build`; Rust `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test --no-run` (Windows loader caveat per project rules).

| Phase | Work | Verify |
| --- | --- | --- |
| **0** | Zero-risk perf: `opt-level`, SIMD deletion, `manifest.clone()`, query defaults, `chunkSizeWarningLimit` | clippy + build |
| **1** | Design system: tokens, self-hosted fonts, type scale, CSS reset, primitive restyle | build + visual |
| **2** | Rust: `AdbClient`, `DeviceTelemetry`, IPC + models + permissions | clippy + FE types |
| **3** | Shell: sidebar, header, status bar, ⌘K palette, layout flex fix | lint + test + build |
| **4** | Dashboard: telemetry cards, charts, no-device onboarding | build |
| **5** | Safety: flash/slot/reboot confirmations, debloat restore, drop queued-flash | test |
| **6** | FE perf: lazy views, log re-render, non-persisted progress, virtualised logs | build + test |
| **7** | Rust correctness: overflow guards, transaction guards, cache/digest fixes | clippy + test |
| **8** | Remaining views migrated to the new system, as depth allows | full gate |

**Final gate:** `bun run check` once, after every phase completes — per `docs/project_rules.md`, never mid-implementation.

---

## 8. Out of scope

- macOS builds stay paused (`docs/project_rules.md` hard stop).
- No commits or pushes — user instruction.
- Typed `AppError` enum (§3.5 of the audit) is designed but deferred; it is a 2–3 day cross-cutting change and would destabilise every phase above.
- ZIP64 parser unification and parallel range downloads are specified in the audit and deferred to a follow-up unless time allows.
- OPS/OFP binary parsers were not exhaustively audited and are not touched.

---

*Success is measured, not asserted: initial bundle size, cold-start time, `get_device_info` spawn count, and progress-event count are all recorded before and after.*
