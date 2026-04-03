# ADB GUI Next — Marketplace UI Design Proposals

> 3 Design Concepts with ASCII Wireframes, Consistency Audit & Recommendation
> Research Date: April 2026

---

## Table of Contents

1. [Existing UI Pattern Audit](#1-existing-ui-pattern-audit)
2. [Design Principles & Constraints](#2-design-principles--constraints)
3. [Design A — "Provider Hub" (Tabbed Multi-Source)](#3-design-a--provider-hub)
4. [Design B — "Unified Discovery" (Single Search Feed)](#4-design-b--unified-discovery)
5. [Design C — "Split Panel" (Browse + Detail)](#5-design-c--split-panel)
6. [Component Breakdown & Shared Patterns](#6-component-breakdown--shared-patterns)
7. [Comparison Matrix](#7-comparison-matrix)
8. [Final Recommendation](#8-final-recommendation)

---

## 1. Existing UI Pattern Audit

Before designing the Marketplace, I audited every existing view to extract reusable
patterns and ensure visual consistency.

### Layout DNA (Shared by All 7 Views)

```
┌─ MainLayout ──────────────────────────────────────────────────────────┐
│ h-svh overflow-hidden                                                │
│ ┌─ SidebarProvider ─────────────────────────────────────────────────┐ │
│ │ ┌─ AppSidebar ─┐ ┌─ SidebarInset ──────────────────────────────┐ │ │
│ │ │  Icon mode   │ │ header  shrink-0  h-12  border-b            │ │ │
│ │ │  collapsible │ │ ┌──────────────────────────────────────────┐ │ │ │
│ │ │              │ │ │ SidebarTrigger │ DeviceSwitcher │ Toolbar│ │ │ │
│ │ │  Main group  │ │ └──────────────────────────────────────────┘ │ │ │
│ │ │  Advanced    │ │                                              │ │ │
│ │ │              │ │ flex-1 overflow-y-auto  main-scroll-area    │ │ │
│ │ │  ─────────── │ │ ┌──────────────────────────────────────────┐ │ │ │
│ │ │  About       │ │ │  p-4 sm:p-6  max-w-1280px               │ │ │ │
│ │ │  Theme       │ │ │  AnimatePresence (opacity 150ms)         │ │ │ │
│ │ │              │ │ │  ┌──────────────────────────────────────┐ │ │ │ │
│ │ │              │ │ │  │  <View Component />                 │ │ │ │ │
│ │ │              │ │ │  └──────────────────────────────────────┘ │ │ │ │
│ │ │              │ │ └──────────────────────────────────────────┘ │ │ │
│ │ └──────────────┘ └────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────────────────┘ │
│ BottomPanel (fixed, viewport-anchored)                                │
└───────────────────────────────────────────────────────────────────────┘
```

### Reusable Primitives to Use in Marketplace

| Pattern | Source View | shadcn Component | Notes |
|---------|-------------|-----------------|-------|
| Card layout | Dashboard, AppManager | `Card`/`CardHeader`/`CardTitle`/`CardContent` | Always `h-5 w-5` icon in CardTitle |
| Search | AppManager | `Command`/`CommandInput`/`CommandEmpty` | `shouldFilter={false}` for external filter |
| Virtualized list | AppManager | `@tanstack/react-virtual` | `h-[40vh] min-h-[150px]` scroll container |
| Filter chips | AppManager | `DropdownMenu` + `DropdownMenuRadioGroup` | Shows count per group |
| Selection bar | AppManager, FileExplorer | `SelectionSummaryBar` | Count + clear + action slot |
| Drop zone | AppManager, Flasher | `DropZone` | Position-based hit-testing |
| Loading button | All views | `LoadingButton` / `Loader2 animate-spin` | Consistent spinner placement |
| Empty state | AppManager | `EmptyState` | Centered icon + text + action |
| Badge | AppManager | `Badge` variant=secondary/outline | `text-[10px] px-1.5 py-0` |
| Section header | Utilities, PayloadDumper | `SectionHeader` | Icon + title + optional action |
| Tabs | PayloadDumper | `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` | Local/Remote pattern |
| Tooltip | All toolbar buttons | `Tooltip`/`TooltipTrigger`/`TooltipContent` | Never native `title=` |
| Copy button | Dashboard, PayloadDumper | `CopyButton` | Clipboard + visual feedback |

### Semantic Color Tokens (MUST use)

```
bg-background    bg-card         bg-muted         bg-accent        bg-popover
bg-primary       bg-secondary    bg-destructive   bg-success       bg-warning
text-foreground  text-muted-foreground  text-primary  text-destructive
border-border    border-border/50
```

### Typography (Onest font)

- Card title: `font-semibold` (inherited from CardTitle)
- Body text: `text-sm`
- Metadata labels: `text-xs text-muted-foreground`
- Badge text: `text-[10px]`

---

## 2. Design Principles & Constraints

### Must Follow

1. **No router** — use `useState<ViewType>` + switch. Marketplace is a new ViewType (`'marketplace'`).
2. **`flex flex-col gap-6`** — root wrapper pattern for all views.
3. **Semantic tokens only** — no hardcoded hex/rgb.
4. **`cn()` for conditional classes** — never template literals.
5. **`@/` imports** — except `../../lib/desktop/` from views.
6. **Error handling** — try/catch → `toast.error()` + `addLog()`.
7. **Viewport-relative heights** — `max-h-[40vh]` not fixed px.
8. **`min-w-0` chain** — all flex ancestors must propagate.
9. **Icon sizing** — CardTitle `h-5 w-5`, inline `h-4 w-4 shrink-0`.

### Marketplace-Specific Constraints

- **6 providers** — F-Droid, IzzyOnDroid, Custom Repos, GitHub, Aptoide, Uptodown
- **Search across all simultaneously** via `Promise.allSettled()`
- **Provider deduplication** — same package from multiple sources → single card with badges
- **Download → ADB install** — one-click flow with progress
- **Device awareness** — uses global `deviceStore.selectedSerial`
- **Attribution required** — "Powered by Aptoide", "Powered by Uptodown"

---

## 3. Design A — "Provider Hub"

### Concept

A **tabbed interface** where each provider gets its own tab with tailored content.
A combined "All Sources" tab aggregates results. This mirrors the PayloadDumper's
Local/Remote tabs pattern already in the codebase.

### Best For

- Users who want **control over which source** they browse
- **Provider-specific features** (GitHub trending, F-Droid categories, Repo management)
- **Phased rollout** — add tabs as providers ship

### ASCII Wireframe — Main Browse View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🛒  App Marketplace                                           │   │
│  │  Browse, download, and install apps from trusted sources       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [🔍 Search apps across all providers...              ] [⚙ ️]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ╔═══════╦═════════╦═══════╦════════╦═════════╦══════════╗       │  │
│  │ ║  All  ║ F-Droid ║ Izzy  ║ GitHub ║ Aptoide ║ Uptodown ║       │  │
│  │ ╚═══════╩═════════╩═══════╩════════╩═════════╩══════════╝       │  │
│  │                                                                  │  │
│  │  ┌─ Trending FOSS ──────────────────────────────────────────┐   │  │
│  │  │                                                          │   │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │  │
│  │  │  │ [Icon]   │  │ [Icon]   │  │ [Icon]   │  │ [Icon] │  │   │  │
│  │  │  │ NewPipe  │  │ Signal   │  │ Organic  │  │ VLC    │  │   │  │
│  │  │  │ v0.27.5  │  │ v7.14.0  │  │ Maps 4.2 │  │ v3.6   │  │   │  │
│  │  │  │ ★ 32.1k  │  │ ★ 26.0k  │  │ ★ 11.2k  │  │ ★ 15k  │  │   │  │
│  │  │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌────┐ │  │   │  │
│  │  │  │ │ Get  │ │  │ │ Get  │ │  │ │ Get  │ │  │ │Get │ │  │   │  │
│  │  │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └────┘ │  │   │  │
│  │  │  │ ⬡F-Droid │  │ ⬡GitHub  │  │ ⬡F-Droid │  │ ⬡Izzy  │  │   │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │   │  │
│  │  │                                                          │   │  │
│  │  └──────────────────────────────────────────────────────────┘   │  │
│  │                                                                  │  │
│  │  ┌─ Recently Updated ───────────────────────────────────────┐   │  │
│  │  │  ┌─────────────────────────────────────────────────────┐ │   │  │
│  │  │  │ [Icon] Telegram FOSS  v10.15.2   ⬡GitHub   [Get ▾] │ │   │  │
│  │  │  ├─────────────────────────────────────────────────────┤ │   │  │
│  │  │  │ [Icon] Bitwarden      v2026.4.0  ⬡F-Droid  [Get ▾] │ │   │  │
│  │  │  ├─────────────────────────────────────────────────────┤ │   │  │
│  │  │  │ [Icon] KeePassDX      v4.2.1     ⬡Izzy     [Get ▾] │ │   │  │
│  │  │  └─────────────────────────────────────────────────────┘ │   │  │
│  │  └──────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — App Detail Sheet (Dialog/Overlay)

```
┌── App Detail ──────────────────────────────────────────────────┐
│                                                                │
│  ┌──────┐  NewPipe  v0.27.5                                   │
│  │[Icon]│  Lightweight YouTube frontend                        │
│  │ 64px │  ★ 32.1k stars  •  Apache-2.0  •  Kotlin           │
│  └──────┘  Available from: ⬡F-Droid  ⬡IzzyOnDroid  ⬡GitHub   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [▼ Download & Install]  ← device: OnePlus 8 Pro        │  │
│  │  └─ F-Droid (recommended)                               │  │
│  │  └─ IzzyOnDroid                                         │  │
│  │  └─ GitHub Release                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Description ───────────────────────────────────────────┐  │
│  │ NewPipe is a free and open-source YouTube client that   │  │
│  │ runs without Google Play services. Subscribe to         │  │
│  │ channels, watch videos, and download media...           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Version History ──────────────────────────────────────┐   │
│  │  v0.27.5  •  2026-03-28  •  13.2 MB      [Get]        │   │
│  │  v0.27.4  •  2026-03-15  •  13.1 MB      [Get]        │   │
│  │  v0.27.3  •  2026-02-20  •  13.0 MB      [Get]        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│                                        [Close]                 │
└────────────────────────────────────────────────────────────────┘
```

### Pros & Cons

| ✅ Pros | ❌ Cons |
|---------|--------|
| Matches existing Tabs pattern (PayloadDumper) | 6 tabs can feel crowded on small widths |
| Each provider can have tailored features | User must know which provider to use |
| Easy phased rollout — 1 tab per sprint | "All" tab might feel redundant vs per-provider |
| Clear visual separation of sources | More complex state management (tab + search) |

---

## 4. Design B — "Unified Discovery"

### Concept

A **single search-first feed** that queries all providers simultaneously. Results
appear in a unified grid/list with source badges. Provider filter chips let users
narrow down. Inspired by Obtainium + GitHub Store model.

### Best For

- Users who **don't care about the source**, they just want the app
- **Simplest mental model** — type, browse, install
- **De-duplication focus** — same app from 3 sources shown as one card

### ASCII Wireframe — Search Results

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🛒  App Marketplace                                           │   │
│  │  Search and install apps from F-Droid, GitHub, and more        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search apps...                                    [Ctrl+K]  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Filter: [All✓] [F-Droid] [Izzy] [GitHub] [Aptoide] [Uptodown]        │
│  Sort:   [Relevance ▾]     View: [Grid ▦] [List ≡]                    │
│                                          12 results from 4 providers   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │  │
│  │  │ ┌────┐           │  │ ┌────┐           │  │ ┌────┐        │  │  │
│  │  │ │icon│  NewPipe   │  │ │icon│  Signal   │  │ │icon│ VLC   │  │  │
│  │  │ └────┘           │  │ └────┘           │  │ └────┘        │  │  │
│  │  │ v0.27.5          │  │ v7.14.0          │  │ v3.6.2        │  │  │
│  │  │ Lightweight YT   │  │ Private msgs     │  │ Media player  │  │  │
│  │  │                  │  │                  │  │               │  │  │
│  │  │ ⬡FD ⬡Izzy ⬡GH   │  │ ⬡GitHub          │  │ ⬡FD ⬡Apt     │  │  │
│  │  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌───────────┐│  │  │
│  │  │ │  ⬇ Install   │ │  │ │  ⬇ Install   │ │  │ │ ⬇ Install ││  │  │
│  │  │ └──────────────┘ │  │ └──────────────┘ │  │ └───────────┘│  │  │
│  │  └──────────────────┘  └──────────────────┘  └───────────────┘  │  │
│  │                                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │  │
│  │  │ ┌────┐           │  │ ┌────┐           │  │ ┌────┐        │  │  │
│  │  │ │icon│ Organic   │  │ │icon│ KeePassDX │  │ │icon│ Brave  │  │  │
│  │  │ └────┘  Maps     │  │ └────┘           │  │ └────┘        │  │  │
│  │  │ v4.2.0           │  │ v4.2.1           │  │ v1.73.99      │  │  │
│  │  │ Offline maps     │  │ Password mgr     │  │ Browser       │  │  │
│  │  │                  │  │                  │  │               │  │  │
│  │  │ ⬡FD              │  │ ⬡Izzy ⬡GH        │  │ ⬡GH ⬡Apt     │  │  │
│  │  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌───────────┐│  │  │
│  │  │ │  ⬇ Install   │ │  │ │  ⬇ Install   │ │  │ │ ⬇ Install ││  │  │
│  │  │ └──────────────┘ │  │ └──────────────┘ │  │ └───────────┘│  │  │
│  │  └──────────────────┘  └──────────────────┘  └───────────────┘  │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Powered by F-Droid • IzzyOnDroid • GitHub • Aptoide • Uptodown │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — Empty State (First Visit)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search apps...                                    [Ctrl+K]  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│                                                                         │
│                         ┌────────────────────┐                          │
│                         │                    │                          │
│                         │    🛒              │                          │
│                         │                    │                          │
│                         │  Search for apps   │                          │
│                         │  to get started    │                          │
│                         │                    │                          │
│                         │  Browse open-source│                          │
│                         │  apps from F-Droid,│                          │
│                         │  GitHub, and more  │                          │
│                         │                    │                          │
│                         │  ┌──────────────┐  │                          │
│                         │  │ Browse FOSS  │  │                          │
│                         │  └──────────────┘  │                          │
│                         └────────────────────┘                          │
│                                                                         │
│  ┌─ Popular Open-Source Apps ───────────────────────────────────────┐   │
│  │  [NewPipe] [Signal] [Bitwarden] [VLC] [Organic Maps] [Brave]   │   │
│  │  [Telegram FOSS] [KeePassDX] [Aegis] [AntennaPod] [K-9 Mail]  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pros & Cons

| ✅ Pros | ❌ Cons |
|---------|--------|
| Simplest user experience — just search | De-duplication logic is complex |
| Matches mental model: "I want *this* app" | Provider-specific features hidden |
| Grid/List toggle gives flexibility | GitHub trending needs separate section |
| Ctrl+K power-user friendly | No custom repo management surface |
| Aligns with shadcn Command pattern | Attribution per-provider in footer |

---

## 5. Design C — "Split Panel"

### Concept

A **two-column layout** like File Explorer's dual-pane. Left pane is a persistent
provider/category browser with search. Right pane shows app details when selected.
Inspired by the DirectoryTree + file list pattern already in the app.

### Best For

- **Power users** who manage custom repos and multiple providers
- Desktop-first UI with **maximum information density**
- Users who browse many apps per session

### ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🛒  App Marketplace                                    [⚙]    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search apps...                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────┬──────────────────────────────────────────┐  │
│  │  PROVIDERS            │  Search results (12)                     │  │
│  │  ─────────────────    │  Sort: [Relevance▾]  View: [▦] [≡]      │  │
│  │                       │                                          │  │
│  │  ▸ All Sources        │  ┌─────────────────────────────────────┐ │  │
│  │  ▸ F-Droid    (4,012) │  │ [icon] NewPipe           v0.27.5   │ │  │
│  │  ▸ IzzyOnDroid(3,105) │  │        Lightweight YT frontend     │ │  │
│  │  ▸ GitHub      (∞)    │  │        ⬡F-Droid ⬡Izzy    [Install] │ │  │
│  │  ▸ Aptoide   (~1M)    │  ├─────────────────────────────────────┤ │  │
│  │  ▸ Uptodown  (~3M)    │  │ [icon] Signal            v7.14.0   │ │  │
│  │                       │  │        Private messenger            │ │  │
│  │  CUSTOM REPOS         │  │        ⬡GitHub            [Install] │ │  │
│  │  ─────────────────    │  ├─────────────────────────────────────┤ │  │
│  │  ▸ MicroG             │  │ [icon] VLC Media          v3.6.2   │ │  │
│  │  ▸ Guardian Project   │  │        Open-source media player    │ │  │
│  │  ▸ CalyxOS            │  │        ⬡F-Droid ⬡Aptoide [Install] │ │  │
│  │  ▸ Bromite            │  ├─────────────────────────────────────┤ │  │
│  │  ┌────────────────┐   │  │ [icon] Organic Maps       v4.2.0   │ │  │
│  │  │ + Add Repo     │   │  │        Offline maps & navigation   │ │  │
│  │  └────────────────┘   │  │        ⬡F-Droid           [Install] │ │  │
│  │                       │  └─────────────────────────────────────┘ │  │
│  │  CATEGORIES           │                                          │  │
│  │  ─────────────────    │                                          │  │
│  │  ▸ Communication      │                                          │  │
│  │  ▸ Media              │                                          │  │
│  │  ▸ Privacy & Security │                                          │  │
│  │  ▸ Navigation         │                                          │  │
│  │  ▸ System Tools       │                                          │  │
│  │  ▸ Development        │                                          │  │
│  └───────────────────────┴──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — With App Selected (Right Detail Pane Expands)

```
┌──────────────┬────────────────────────┬─────────────────────────────┐
│  PROVIDERS   │  Results (12)          │  App Detail                 │
│              │                        │                             │
│  ▸ All       │  [icon] NewPipe ◀━━━━━━│  ┌─────┐ NewPipe v0.27.5  │
│  ▸ F-Droid   │  [icon] Signal         │  │icon │ by Team NewPipe  │
│  ▸ IzzyOnDroid│ [icon] VLC            │  │64px │ ★ 32.1k • Apache │
│  ▸ GitHub    │  [icon] Organic Maps   │  └─────┘                   │
│  ▸ Aptoide   │  [icon] KeePassDX     │                             │
│  ▸ Uptodown  │  [icon] Brave         │  Sources:                   │
│              │  [icon] Telegram FOSS  │  ⬡ F-Droid  (recommended)  │
│  CUSTOM REPOS│  [icon] Bitwarden     │  ⬡ IzzyOnDroid             │
│  ▸ MicroG    │  [icon] AntennaPod    │  ⬡ GitHub Release          │
│  ▸ Guardian  │  [icon] K-9 Mail      │                             │
│  + Add Repo  │  [icon] Aegis         │  ┌──────────────────────┐  │
│              │                        │  │  ⬇ Download & Install│  │
│  CATEGORIES  │                        │  │  to: OnePlus 8 Pro   │  │
│  ▸ Comms     │                        │  └──────────────────────┘  │
│  ▸ Media     │                        │                             │
│  ▸ Privacy   │                        │  Lightweight YouTube       │
│  ▸ Navigation│                        │  frontend that runs        │
│              │                        │  without Google services.  │
│              │                        │                             │
│              │                        │  Versions:                  │
│              │                        │  v0.27.5 • Mar 28 [Get]    │
│              │                        │  v0.27.4 • Mar 15 [Get]    │
└──────────────┴────────────────────────┴─────────────────────────────┘
```

### Pros & Cons

| ✅ Pros | ❌ Cons |
|---------|--------|
| Maximum information density | Complex layout — 3 columns on narrow windows |
| Custom repo management built-in | Doesn't match other views' single-column style |
| No Dialog needed — inline detail | Needs responsive breakpoint strategy |
| Familiar to File Explorer users | Most complex to build |
| Category browsing built-in | Left pane needs lazy-loaded index fetching |

---

## 6. Component Breakdown & Shared Patterns

### New Components Needed (All Designs)

| Component | Location | Purpose |
|-----------|----------|---------|
| `ViewMarketplace.tsx` | `src/components/views/` | Main view component |
| `AppCard.tsx` | `src/components/` | App card (grid mode) |
| `AppListItem.tsx` | `src/components/` | App row (list mode) |
| `AppDetailSheet.tsx` | `src/components/` | App detail dialog |
| `ProviderBadge.tsx` | `src/components/` | Source badge with icon |
| `InstallButton.tsx` | `src/components/` | Download + install combo |
| `ProviderFilterChips.tsx` | `src/components/` | Filter chips bar |

### New Store Layer

| File | Location | Purpose |
|------|----------|---------|
| `marketplaceStore.ts` | `src/lib/` | Zustand store (search, filter, results, download state) |
| `types.ts` | `src/lib/desktop/marketplace/` | `AppInfo`, `SearchResult`, `ProviderConfig` |
| `backend.ts` | `src/lib/desktop/marketplace/` | Tauri invoke wrappers per provider |

### Sidebar Addition

```typescript
// AppSidebar.tsx — add to Main group
{ id: 'marketplace', icon: Store, label: 'Marketplace' }
```

---

## 7. Comparison Matrix

| Criterion | A: Provider Hub | B: Unified Discovery | C: Split Panel |
|-----------|:--------------:|:-------------------:|:--------------:|
| **UI Consistency** | ★★★★★ | ★★★★★ | ★★★☆☆ |
| **Simplicity** | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| **Power-User Fit** | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| **Build Effort** | ★★★★☆ (Med) | ★★★★★ (Low) | ★★★☆☆ (High) |
| **Mobile Responsiveness** | ★★★★☆ | ★★★★★ | ★★☆☆☆ |
| **Phased Rollout** | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| **De-duplication** | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| **Custom Repo Mgmt** | ★★★☆☆ | ★★☆☆☆ | ★★★★★ |
| **Matches Existing UX** | ★★★★★ | ★★★★☆ | ★★★★☆ |

---

## 8. Final Recommendation

### 🏆 Recommended: **Design B — Unified Discovery** (with elements from A & C)

**Why Design B wins:**

1. **Lowest cognitive load** — users search for an app, not a provider. The marketplace
   should feel like "I want NewPipe" not "I need to go to the F-Droid tab first."

2. **Best UI consistency** — single-column Card layout with search, filter chips, and
   grid mirrors patterns already in Dashboard + AppManager. No new layout paradigm.

3. **Fastest to ship** — Phase 1 is literally: search input + grid of cards + detail dialog.
   No tabs to build, no split-pane resize, no category tree.

4. **De-duplication as a feature** — showing "Available from: F-Droid, IzzyOnDroid, GitHub"
   on a single card is a unique selling point vs any other tool.

### Hybrid Enhancement (Borrow from A & C)

- **From Design A**: Add a "Trending" and "Recently Updated" section on the empty state
  (before user searches). These curated feeds give the page life on first visit.

- **From Design C**: Add a gear icon (⚙) button that opens a **Settings dialog** for
  managing custom F-Droid repos (add/remove/enable). This avoids cluttering the main
  view while keeping repo management accessible.

### Phased Implementation

| Phase | Scope | Effort |
|-------|-------|--------|
| **P1** | Search + F-Droid + IzzyOnDroid + card grid + detail dialog + install | 1 week |
| **P2** | GitHub provider + trending feeds + filter chips + Ctrl+K | 1 week |
| **P3** | Aptoide + Uptodown + Grid/List toggle + download progress | 1 week |
| **P4** | Custom repos dialog + de-duplication + batch install + update checker | 1 week |

### Key Design Decisions Locked

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Single-column Card, `flex flex-col gap-6` | Matches all 7 existing views |
| Search | shadcn `Command` with `CommandInput` | Matches AppManager pattern |
| Results | Responsive grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | Cards reflow on resize |
| Detail | `Dialog` / `Sheet` overlay | Progressive disclosure; no layout shift |
| Filters | Horizontal chip bar with `Button variant="outline"` toggles | Familiar, accessible |
| Install | `LoadingButton` with progress → `toast.success` | Matches existing install UX |
| State | `marketplaceStore.ts` (Zustand) | Matches `deviceStore`, `logStore`, `payloadDumperStore` |
| Icons | `lucide-react`: `Store`, `Download`, `ShieldCheck`, `Star` | Consistent icon set |
| Attribution | Footer bar: "Powered by..." per active provider | Required by Aptoide & Uptodown |

---

*Document by ADB GUI Next — April 2026*
*Based on analysis of: existing codebase (7 views, 22+ shadcn components, 30+ Tauri commands),*
*ADB_GUI_Kit_Store_Plan.md, marketplace_analysis.md, and 2025-2026 UI/UX design research.*
