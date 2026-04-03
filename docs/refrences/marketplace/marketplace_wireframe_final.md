# Marketplace — Final Wireframe

> Simple. Polished. Consistent with existing views.

---

## Design Philosophy

**Strip everything to its essence.** The marketplace has ONE job:
search an app → see it → install it to your device. That's it.

No tabs. No categories. No custom repos. No grid/list toggle.
Just a search bar, a clean list of results, and a detail sheet.

---

## View Structure

The marketplace follows the same `flex flex-col gap-6` pattern as Dashboard
and AppManager. Two Cards stacked vertically — that's the whole page.

---

## Wireframe — Default State (No Search Yet)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─ Card ─────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  🛒 App Marketplace                                    │ │
│  │  Search and install open-source apps via ADB           │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ 🔍  Search apps...                               │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Card ─────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │                                                        │ │
│  │                                                        │ │
│  │                       📦                               │ │
│  │                                                        │ │
│  │             Search for an app to get started           │ │
│  │                                                        │ │
│  │        Browse apps from F-Droid, IzzyOnDroid,          │ │
│  │              GitHub Releases, and more                 │ │
│  │                                                        │ │
│  │                                                        │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Wireframe — Search Results

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─ Card ─────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  🛒  App Marketplace                                   │ │
│  │  Search and install open-source apps via ADB           │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ 🔍  newpipe                              [Clear] │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Card ─────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  Results                                   8 apps found│ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │                                                  │  │ │
│  │  │  ┌────┐  NewPipe                        v0.27.5  │  │ │
│  │  │  │icon│  Lightweight YouTube frontend            │  │ │
│  │  │  └────┘  F-Droid · IzzyOnDroid        [Install]  │  │ │
│  │  │                                                  │  │ │
│  │  ├──────────────────────────────────────────────────┤  │ │
│  │  │                                                  │  │ │
│  │  │  ┌────┐  NewPipe SponsorBlock          v0.27.5  │  │ │
│  │  │  │icon│  NewPipe with SponsorBlock               │  │ │
│  │  │  └────┘  IzzyOnDroid                  [Install]  │  │ │
│  │  │                                                  │  │ │
│  │  ├──────────────────────────────────────────────────┤  │ │
│  │  │                                                  │  │ │
│  │  │  ┌────┐  NewPipe x                      v0.26.1 │  │ │
│  │  │  │icon│  Feature-rich fork                       │  │ │
│  │  │  └────┘  GitHub                       [Install]  │  │ │
│  │  │                                                  │  │ │
│  │  ├──────────────────────────────────────────────────┤  │ │
│  │  │                                                  │  │ │
│  │  │  ┌────┐  PipePipe                       v3.5.0  │  │ │
│  │  │  │icon│  YouTube, NicoNico, BiliBili             │  │ │
│  │  │  └────┘  F-Droid                      [Install]  │  │ │
│  │  │                                                  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key details:**
- Results are a scrollable list inside the Card (`max-h-[50vh]`)
- Each row: icon (32px) + name/description + version + source badges + install button
- Source badges are small `text-[10px]` text — not big colorful chips
- Rows use `hover:bg-accent` — same as AppManager package rows
- Click row → opens detail sheet. Click Install → direct install.

---

## Wireframe — App Detail (Sheet / Dialog)

When user clicks a row, a Dialog pops up with more info:

```
┌── Dialog ──────────────────────────────────────────────────┐
│                                                            │
│  ┌──────┐                                                  │
│  │      │  NewPipe                                         │
│  │ icon │  v0.27.5  ·  13.2 MB  ·  Apache-2.0             │
│  │ 48px │  by Team NewPipe                                 │
│  └──────┘                                                  │
│                                                            │
│  Available from:                                           │
│  ● F-Droid          (built from source)                    │
│  ● IzzyOnDroid      (developer binary)                     │
│  ● GitHub Release   (original release)                     │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │   ⬇  Install to device                              │  │
│  │      via: F-Droid  ▾                                 │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ About ─────────────────────────────────────────────┐  │
│  │ NewPipe is a free, lightweight YouTube frontend     │  │
│  │ for Android. It does not use any Google framework   │  │
│  │ libraries or the YouTube API. It only parses the    │  │
│  │ website to gain the information it needs...         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│                                             [Close]        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Key details:**
- Uses shadcn `Dialog` — same pattern as `EditNicknameDialog`, `AlertDialog`
- Source picker is a simple `Select` dropdown, not a fancy multi-source UI
- Install button uses `LoadingButton` pattern with spinner during download
- Description truncated with "Show more" if long
- No version history, no screenshots, no permissions — keep it simple

---

## Wireframe — Installing State

```
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  ┌────┐  NewPipe                        v0.27.5  │
  │  │icon│  Lightweight YouTube frontend            │
  │  └────┘  F-Droid · IzzyOnDroid                   │
  │                                                  │
  │  ┌──────────────────────────────────────────┐    │
  │  │  ◐  Downloading... 45%                   │    │
  │  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │
  │  └──────────────────────────────────────────┘    │
  │                                                  │
  ├──────────────────────────────────────────────────┤
  │                                                  │
  │  ┌────┐  NewPipe SponsorBlock          v0.27.5   │
  │  │icon│  NewPipe with SponsorBlock               │
  │  └────┘  IzzyOnDroid                  [Install]  │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

- Progress bar replaces the Install button inline
- States: `[Install]` → `Downloading... 45%` → `Installing...` → `✓ Installed`
- Uses Tauri progress events (same pattern as payload extraction)

---

## Component Map

```
ViewMarketplace.tsx
├── Card (Search)
│   ├── CardHeader → 🛒 icon + title + description
│   └── CardContent
│       └── CommandInput (search bar)
│
├── Card (Results)
│   ├── CardHeader → "Results" + count
│   └── CardContent
│       ├── EmptyState (before search)
│       └── Scrollable list (max-h-[50vh])
│           └── AppRow (repeated)
│               ├── App icon (32px, rounded)
│               ├── Name + description (truncate)
│               ├── Version (text-muted-foreground)
│               ├── Source text (text-xs)
│               └── InstallButton / ProgressBar
│
└── AppDetailDialog.tsx (on row click)
    ├── Icon + Name + Version + License
    ├── Source list with radio select
    ├── Install button (LoadingButton)
    └── Description (collapsible)
```

---

## What This Design Does NOT Have (Intentionally)

| Omitted Feature | Why |
|-----------------|-----|
| Provider tabs | Unnecessary complexity — search queries all providers |
| Grid view | List is denser and more scannable for app names |
| Categories | F-Droid categories aren't useful for power users who know what they want |
| Custom repos | Phase 2 — add later via settings gear icon |
| Trending feed | Phase 2 — add later as a section above results |
| Grid/List toggle | One layout. Keep it simple. |
| Version history | Phase 2 — detail dialog can grow later |
| Screenshots | Not available from most providers anyway |
| Batch install | Phase 2 |
| Filter chips | Not needed for V1 — search is enough |

---

## Consistency Checklist

| Rule | ✅ How This Design Follows It |
|------|-------------------------------|
| View wrapper | `flex flex-col gap-6` — same as Dashboard, AppManager |
| Card structure | `Card` > `CardHeader` > `CardTitle` (icon h-5 w-5) > `CardContent` |
| Search | shadcn `CommandInput` — same as AppManager package search |
| List rows | `hover:bg-accent` + `rounded-sm px-2 py-2` — same as AppManager |
| Icon sizing | CardTitle: `h-5 w-5`, list icons: `h-4 w-4 shrink-0` |
| Empty state | `EmptyState` component — centered icon + text |
| Buttons | `LoadingButton` with `Loader2 animate-spin` |
| Dialog | shadcn `Dialog` — same as EditNicknameDialog |
| Scroll | `max-h-[50vh] min-h-[150px] overflow-y-auto` |
| Toasts | `toast.success("Installed!")` / `toast.error(...)` |
| Error handling | try/catch → `handleError()` → toast + log |
| State | Zustand `marketplaceStore.ts` |
| Imports | `@/` alias, `import type` for types |
| Colors | Semantic tokens only (`bg-muted`, `text-muted-foreground`) |

---

*Simple is better than complex. Ship V1, iterate based on feedback.*
