# Design

Desktop toolkit, not a website. Dense, quiet, official **shadcn Neutral**. Colour never shouts; status colour is for the **device**, not chrome.

Source of tokens: `src/styles/global.css`. Primitives: `src/shared/ui/`. Feature UI stays in `src/features/`.

## Taste

- Achromatic surfaces. Primary **inverts** with theme (near-black on light, near-white on dark).
- One visual language everywhere: same tabs, same cards, same type, same radius.
- Tool-first: 13px body, tight gaps (`gap-4`), no decorative gradients, no chart libraries.
- If it isn’t a token class, it doesn’t ship.

## Theme (now)

Official Neutral scaffold (`components.json` `baseColor: "neutral"`). Dark is **gray**, not OLED black.

| | Light | Dark |
| --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| `--card` / `--popover` | white | `oklch(0.205 0 0)` |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` |
| `--muted` / `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |

App aliases (keep using these in features): `canvas` → background · `surface` → card · `surface-raised` → secondary · `surface-overlay` → popover.

Shell: `bg-background text-foreground`. Theme via `next-themes` (`class` on `<html>`). Toasts follow `resolvedTheme` and **our** status tokens, not Sonner’s green/red.

`success` / `warning` / `info` / `destructive` = device or danger only.

Do not put raw hex / rgb / oklch in components. Overlay dimmers may use official `bg-black/50`.

## Type

Tokens carry size + line-height + tracking + weight. Do **not** add `text-xs` / `text-sm` or extra `leading-*` / `font-*`.

| Class | Size | Use |
| --- | --- | --- |
| `text-display` | 24 | view titles (rare; header owns the visible title) |
| `text-title` | 17 | cards, dialogs |
| `text-body` | **13** | default |
| `text-label` | 12 | labels, table heads |
| `text-caption` | 11 | meta, badges — **floor** |
| `text-mono` / `text-mono-sm` | 12 / 11 | serials, paths, logs (+ `font-mono`) |

Updating numbers: add `numeric`. Views keep one `sr-only` `<h1>`.

Fonts: self-hosted Inter + JetBrains Mono. No Google Fonts.

## Layout

Window floor **1024×720**. Content width follows the sidebar, not the viewport.

- **Never** `sm:` / `md:`. Use `@container` + `@xs` / `@sm` / `@lg` / `@xl` / `@2xl` / `@4xl`.
- No `h-[40vh]` lists. `min-h-0` + `flex-1`.
- `gap-*` not `space-x-*`. `size-*` when square.
- Motion: transform/opacity only. `--motion-*` + `ease-standard`. Never animate `height` or `all`.

## Components

shadcn **New York**, Radix, Lucide. Edit `src/shared/ui/*` — do not invent a second kit.

**Tabs (current):** official primitive. `TabsList` is **full width**; every `TabsTrigger` is `flex-1` (equal split). Active: light `bg-background` + shadow; dark `bg-input/30` + `border-input`. No `variant="line"`. No per-page `grid-cols-*`.

- Icon + label: `TabsWithIcon` in `src/components/shadcn-studio/tabs/tabs-03.tsx` (Utilities).
- Same look without the helper: App Manager, Emulator, Payload source, Root wizard — `Tabs` + `TabsList` + icon `TabsTrigger`.
- Never put `flex` on `TabsContent` (it overrides `[hidden] { display: none }` and stacks every panel). Wrap inner content instead. Do not `forceMount` unless you have a reason.

**Cards:** `bg-card` / `bg-surface`, `border-border`, `rounded-lg` or `rounded-xl`, often `shadow-none` in dense views.

**Buttons:** `default` / `destructive` / `outline` / `secondary` / `ghost` / `link`. Depth = inset 1px highlight (`--control-highlight`), not a glow. Icon buttons need `aria-label`. Non-submit: `type="button"`.

**Inputs:** `border-border-control`, `dark:bg-input/30` (official). Placeholder `text-muted-foreground`.

**Sidebar / header / command palette / dialogs:** semantic tokens (`bg-sidebar`, `bg-popover`, `bg-card`). Command palette is ⌘/Ctrl+K.

**Charts:** hand-rolled SVG/CSS against `chart-1..5`. Never add a charting library (`freezePrototype`).

**Bottom panel:** `terminal-*` tokens (aliased to theme surfaces). Logs/shell, not a second palette.

## Do not

- True-black dark canvas (`oklch(0 0 0)`).
- Viewport breakpoints, Next.js patterns, extra UI kits.
- Status colour as decoration (green “success” buttons, blue “info” headers).
- Dead unused `shared/ui` primitives.

When design and this file disagree, **code wins** — then update this file.
