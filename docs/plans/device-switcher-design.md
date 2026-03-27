# Global Device Switcher — Design Document

> **Date**: 2026-03-27
> **Status**: Draft — awaiting feedback
> **Scope**: Move device connection status into sticky header + add multi-device switcher

---

## Problem Statement

The `ConnectedDevicesCard` component is duplicated across **3 views** (Dashboard, Flasher, Utilities), each with its own TanStack Query polling loop. This creates:

1. **Wasted vertical space** — the same card takes ~80px on every page
2. **No global awareness** — switch to File Explorer or App Manager and you lose device status
3. **No device switching** — multi-device users can't easily pick which device to target
4. **Duplicated polling** — 3 independent `useQuery({ refetchInterval })` calls for the same data

---

## Current State Audit

### ConnectedDevicesCard Usage

| View | Query Key | Fetch Function | Interval | What It Shows |
|------|-----------|----------------|----------|---------------|
| Dashboard | `['devices']` | `fetchDevices` (ADB only) | 3s | ADB devices |
| Flasher | `['allDevices']` | `fetchAllDevices` (ADB + fastboot) | 4s | ADB + fastboot |
| Utilities | `['allDevices']` | `fetchAllDevices` (ADB + fastboot) | 3s | ADB + fastboot (derived mode) |

### Device Store (`deviceStore.ts`)

```ts
interface DeviceState {
  devices: Device[];       // currently unused by views (they use useQuery)
  deviceInfo: DeviceInfo;  // used only by Dashboard
  lastUpdated: number;
  // ⚠️ NO selectedDevice concept exists
}
```

### Backend Limitation

All Rust commands use the **default ADB/fastboot device** — there is NO `-s <serial>` routing yet. Adding `selectedDevice` to the store is architectural prep for future multi-device support.

---

## Goal

- **Keep** `ConnectedDevicesCard` in Dashboard only (rich detail view with nicknames, editing)
- **Remove** `ConnectedDevicesCard` from Flasher and Utilities
- **Add** a compact device indicator to the **sticky header** visible on all screens
- **Add** a dropdown/popover for multi-device switching
- **Centralize** device polling into one global query (avoid 3 duplicate polls)

---

## Approach A — Header Pill + Popover (⭐ RECOMMENDED)

A compact pill/badge in the header showing the active device. Clicking it opens a shadcn `Popover` with all connected devices and a switch action.

### Wireframe — Header (device connected)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] │ Dashboard          [🟢 emulator-5554 ▾]    [⚙] [▢] [>_] [📋]   │
└──────────────────────────────────────────────────────────────────────────┘
       ↑ sidebar            ↑ device pill              ↑ existing toolbar
       trigger              (click to open popover)
```

### Wireframe — Header (no device)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] │ Dashboard          [⚫ No Device ▾]         [⚙] [▢] [>_] [📋]   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Wireframe — Popover (expanded, 2 devices)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] │ Flasher            [🟢 My Pixel ▾]         [⚙] [▢] [>_] [📋]   │
└──────────────────────────────────────────────────────────┬───────────────┘
                                                           │
                          ┌────────────────────────────────┐
                          │  Connected Devices         [↻] │
                          │ ─────────────────────────────── │
                          │  ● My Pixel              [adb] │
                          │    emulator-5554                │
                          │ ─────────────────────────────── │
                          │  ○ POCO F3              [adb]  │
                          │    192.168.1.42:5555            │
                          │ ─────────────────────────────── │
                          │  ○ Device #3        [fastboot]  │
                          │    ABC123DEF                    │
                          └────────────────────────────────┘
                              ●/○ = selected/unselected
```

### New Component: `DeviceSwitcher.tsx`

```
src/components/DeviceSwitcher.tsx
├── Popover trigger: compact pill button
│   └── Shows: status dot + device name/serial + ChevronDown
├── Popover content:
│   ├── Title: "Connected Devices" + refresh button
│   └── Device list: radio-style selection (click to switch)
│       └── Each row: nickname/serial + Badge(status) + edit icon
└── Reads from: global useQuery (centralized, always-on polling)
```

### Trade-offs

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Complexity** | 🟢 Low | 1 new component, 1 store field, remove 2 card usages |
| **Extensibility** | 🟢 High | Easy to add edit nickname, device info tooltip later |
| **Risk** | 🟢 Low | Popover is isolated; existing views barely change |
| **Maintenance** | 🟢 Low | Single polling source, no per-view duplication |
| **Visual footprint** | 🟢 Minimal | ~32px pill in header, doesn't eat view space |

---

## Approach B — Header Dropdown Select

A shadcn `Select` component (native dropdown) in the header, similar to a branch picker in VS Code.

### Wireframe — Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] │ Dashboard      ┌─────────────────────┐     [⚙] [▢] [>_] [📋]   │
│     │                │ emulator-5554  [adb] │▾                         │
│     │                └─────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Wireframe — Dropdown open

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡] │ Flasher        ┌─────────────────────┐     [⚙] [▢] [>_] [📋]   │
│     │                │ emulator-5554  [adb] │▾                         │
│     │                ├─────────────────────┤                           │
│     │                │ emulator-5554  [adb] │ ← selected (check)      │
│     │                │ 192.168.1.42  [adb]  │                          │
│     │                │ ABC123DEF [fastboot]  │                          │
│     │                ├─────────────────────┤                           │
│     │                │ No device connected   │ ← when empty            │
│     │                └─────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Trade-offs

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Complexity** | 🟢 Low | shadcn Select is a primitive — minimal custom code |
| **Extensibility** | 🟡 Medium | Select items are text-only — hard to add edit/nickname/badge |
| **Risk** | 🟢 Low | Standard pattern, predictable behavior |
| **Maintenance** | 🟢 Low | Same centralized polling as Approach A |
| **Visual footprint** | 🟡 Medium | Select has fixed min-width, may look wide at 1024px |

### Limitations

- **No room for edit nickname** or rich metadata per device row
- **Select items** can only show text + simple icons — no inline actions
- Less "native app" feel, more "form field" feel in the header

---

## Approach C — Sidebar Footer Device Panel

Move device status into the **AppSidebar footer** (below the theme toggle). Always visible, expands with sidebar.

### Wireframe — Sidebar expanded

```
┌─────────────────┬───────────────────────────────────────────────────┐
│ 🔷 ADB GUI Next │                                                   │
│ Desktop Toolkit │  Dashboard                                       │
│                 │                                                   │
│ MAIN            │  ┌──────────────────────────────────────────────┐ │
│ ▶ Dashboard     │  │ Wireless ADB Connection                     │ │
│   Applications  │  │ ...                                          │ │
│   File Explorer │  └──────────────────────────────────────────────┘ │
│                 │                                                   │
│ ADVANCED        │  ┌──────────────────────────────────────────────┐ │
│   Flasher       │  │ Device Info                                  │ │
│   Utilities     │  │ ...                                          │ │
│   Payload       │  └──────────────────────────────────────────────┘ │
│ ─────────────── │                                                   │
│ 🟢 emulator-5554│                                                   │
│    [adb]     ▾  │                                                   │
│ ─────────────── │                                                   │
│  About          │                                                   │
│  🌙 Theme       │                                                   │
└─────────────────┴───────────────────────────────────────────────────┘
```

### Wireframe — Sidebar collapsed (icon mode)

```
┌──┬──────────────────────────────────────────────────────────────────┐
│🔷│  Dashboard                                                       │
│  │                                                                   │
│🏠│  ...                                                              │
│📦│                                                                   │
│📁│                                                                   │
│⚡│                                                                   │
│⚙│                                                                   │
│📦│                                                                   │
│──│                                                                   │
│🟢│ ← device dot only (tooltip: "emulator-5554 [adb]")              │
│──│                                                                   │
│ℹ│                                                                   │
│🌙│                                                                   │
└──┴──────────────────────────────────────────────────────────────────┘
```

### Trade-offs

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Complexity** | 🟡 Medium | Sidebar footer needs custom layout + icon-mode adaptation |
| **Extensibility** | 🟡 Medium | Sidebar real estate is limited; dropdown might feel cramped |
| **Risk** | 🟡 Medium | Sidebar icon mode is tricky — tooltip-only is less discoverable |
| **Maintenance** | 🟡 Medium | Device switcher logic tied to sidebar state (collapsed/expanded) |
| **Visual footprint** | 🟢 Minimal | Uses existing sidebar space — no header changes needed |

### Limitations

- **Icon mode**: Only a colored dot visible — user must hover for tooltip
- Sidebar collapse hides device info entirely for small screens
- Feels less prominent than header approaches — device status is "buried"
- More complex responsive behavior (sidebar collapsed = device hidden)

---

## Comparison Matrix

| Criterion | A: Header Pill + Popover | B: Header Select | C: Sidebar Footer |
|-----------|:---:|:---:|:---:|
| Global visibility | ✅ Always | ✅ Always | ⚠️ Hidden when collapsed |
| Rich device rows | ✅ Nickname + badge + edit | ❌ Text only | ⚠️ Limited space |
| Multi-device switch | ✅ Radio-style click | ✅ Native select | ✅ Click in panel |
| Native-app feel | ✅ Premium pill | ⚠️ Form-field feel | ✅ VS Code sidebar style |
| Implementation effort | ~3 hours | ~2 hours | ~4 hours |
| Header height impact | None (inline) | None (inline) | None (no header change) |
| Works at 1024px min | ✅ Pill compresses | ⚠️ Select may overflow | ✅ Sidebar adapts |
| Future `-s serial` ready | ✅ Store has selectedDevice | ✅ Same | ✅ Same |

---

## Recommendation: Approach A — Header Pill + Popover

**Why:**
1. **Always visible** — device status on every screen, every sidebar state
2. **Rich popover** — room for nickname, badge, edit button, refresh
3. **Minimal footprint** — 32px pill in the header, no vertical space wasted
4. **Premium native feel** — similar to VS Code's branch switcher or Docker Desktop's environment pill
5. **Cleanest DRY win** — remove `ConnectedDevicesCard` from Flasher + Utilities, centralize polling

---

## Architecture Changes (All Approaches)

### 1. Centralize Device Polling

Move `useQuery` out of individual views into a shared hook or MainLayout:

```
Before (3 independent polls):
  Dashboard → useQuery(['devices'], 3s)
  Flasher   → useQuery(['allDevices'], 4s)
  Utilities → useQuery(['allDevices'], 3s)

After (1 global poll):
  MainLayout → useQuery(['allDevices'], 3s)  ← always on
  Dashboard  → uses shared query data (no own poll)
  Flasher    → uses shared query data (no own poll)
  Utilities  → uses shared query data (no own poll)
```

### 2. Add `selectedDevice` to `deviceStore`

```ts
interface DeviceState {
  devices: Device[];
  selectedSerial: string | null;  // NEW — which device is "active"
  deviceInfo: DeviceInfo | null;
  setDevices: (devices: Device[]) => void;
  setSelectedSerial: (serial: string | null) => void;
  // ...
}
```

**Auto-select logic:**
- 1 device → auto-select it
- Device disconnects + was selected → clear selection
- New device connects + nothing selected → auto-select it
- User manually selects → persist until disconnect

### 3. Remove ConnectedDevicesCard from Flasher + Utilities

- Dashboard keeps it for the rich detailed view
- Flasher and Utilities drop the card entirely
- Header pill provides awareness everywhere

---

## Decision Log

| # | Decision | Alternatives | Reason |
|---|----------|-------------|--------|
| 1 | Keep ConnectedDevicesCard in Dashboard only | Remove entirely | Dashboard is the "home" — user expects device overview there |
| 2 | Centralize polling in MainLayout | Keep per-view polling | DRY, single source of truth, less ADB spam |
| 3 | Use `fetchAllDevices` globally | `fetchDevices` (ADB only) | Flasher/Utilities need fastboot devices too |
| 4 | Add `selectedSerial` to deviceStore | Context, URL param | Zustand is already the pattern; no router exists |
| 5 | No `-s serial` backend changes yet | Wire it now | YAGNI — store prep is enough; backend changes are separate |

---

## Open Questions

1. Should the Dashboard also use the centralized query, or keep its own (since it only needs ADB devices)?
2. When the popover shows a device list, should there be an "Edit Nickname" button inline, or should that stay in Dashboard only?
3. Should the device pill show the connection badge (e.g., `[adb]`) or just the status dot color?

---

> **Next step**: Confirm which approach to implement, resolve open questions, then proceed to implementation.
