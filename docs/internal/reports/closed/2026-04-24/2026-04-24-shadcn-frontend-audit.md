# shadcn Frontend Audit - 2026-04-24

## Scope

Audited the frontend shadcn surface for ADB GUI Next:

- `components.json`
- `src/styles/global.css`
- `src/components/ui/*`
- shared components under `src/components/*`
- feature components under `src/components/views/*`, `src/components/marketplace/*`, `src/components/payload-dumper/*`, and `src/components/emulator-manager/*`

This is an analysis report only. No frontend source files were changed.

## Source Material

- Project Memory Bank: all six core files were read before analysis.
- Project shadcn config: `bunx --bun shadcn@latest info --json`
- Installed shadcn docs lookup: `bunx --bun shadcn@latest docs ...`
- Context7 shadcn docs: `/llmstxt/ui_shadcn_llms_txt`
- Web Interface Guidelines fetched from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`

Relevant official shadcn guidance used:

- Vite projects add components with the shadcn CLI, using the project runner. This repo uses Bun, so use `bunx --bun shadcn@latest add <component>`.
- `components.json` should define aliases, icon library, `rsc: false` for Vite, and `cssVariables: true`.
- Tailwind v4 shadcn projects should map CSS variables through `@theme inline` and use semantic tokens like `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`.
- Form layouts should prefer shadcn `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `Input`, `Select`, and related primitives over ad hoc grouped `div`s.
- Cards are intended to be composed from `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` where the surface has an identifiable title/content/action structure.
- Dialog-like surfaces must have accessible titles. Tabs triggers belong inside `TabsList`. Command items belong in a command context. Badges, Skeleton, Alert, Empty, Separator, Tooltip, and Table should replace one-off equivalents where practical.

## Executive Summary

The frontend is already in good shape for a mature shadcn/Tauri desktop app. The core primitives exist, aliases are correct, Tailwind v4 tokens are configured, the sidebar migration is sound, dialogs generally have titles, and many shared surfaces use `Card`, `Badge`, `Separator`, `Table`, `ScrollArea`, `Tabs`, `Popover`, `Command`, `Tooltip`, and `sonner`.

The remaining issues are concentrated in four areas:

1. Some controls are still hand-built instead of using available shadcn primitives.
2. Several status, warning, and empty/loading surfaces are custom markup rather than `Alert`, `Empty`, `Skeleton`, `Switch`, `Select`, `ToggleGroup`, `Field`, or `InputGroup`.
3. Some components bypass the project's semantic status tokens with raw Tailwind color families.
4. A few accessibility and interaction details are weaker than the surrounding code: raw `role="button"` cards, native `title` tooltips, image sizing, missing `aria-label` on icon buttons, and raw checkbox labels.

Recommended direction: do not rewrite the entire UI. Add the missing official primitives and migrate the highest-value surfaces in small passes.

## Current shadcn Project State

`bunx --bun shadcn@latest info --json` reports:

- Framework: Vite
- RSC: false
- TypeScript: true
- Tailwind: v4
- Tailwind CSS file: `src/styles/global.css`
- Style: `new-york`
- Base: `radix`
- Icon library: `lucide`
- Import alias: `@`
- UI alias: `@/components/ui`

Installed shadcn components:

`alert-dialog`, `badge`, `button`, `card`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `scroll-area`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `table`, `tabs`, `tooltip`.

High-value official components not currently installed but directly useful in this codebase:

- `select`
- `switch`
- `alert`
- `empty`
- `field`
- `input-group`
- `toggle-group`
- `textarea`
- `radio-group`
- `slider`
- `avatar`

Suggested CLI batch:

```bash
bunx --bun shadcn@latest add select switch alert empty field input-group toggle-group textarea radio-group slider avatar
```

Use `--dry-run` / `--diff` first if updating an existing primitive.

## What Is Working Well

### shadcn configuration is healthy

- `components.json` has `rsc: false`, Vite-friendly aliases, `cssVariables: true`, and `iconLibrary: lucide`.
- `src/styles/global.css` uses Tailwind v4 `@theme inline` mappings for core shadcn tokens and project-specific status/terminal tokens.
- The app correctly avoids `'use client'`, which matches Vite/Tauri.

### Core app shell follows shadcn patterns

- `MainLayout` uses `SidebarProvider`, `AppSidebar`, `SidebarInset`, `SidebarTrigger`, and the project-specific viewport-locked layout.
- `AppSidebar` uses the shadcn sidebar family rather than custom navigation markup.
- `sidebar-context.ts` keeps non-component exports out of `sidebar.tsx`, preserving Fast Refresh hygiene.

### Overlay composition is mostly correct

- `DialogContent` instances generally include `DialogTitle`.
- `AlertDialogContent` instances generally include `AlertDialogTitle`.
- `TabsTrigger` usage is inside `TabsList`.
- `CommandInput` is now used inside `Command` context where applicable, and the Memory Bank records the previous crash pattern.

### Shared primitives are moving in the right direction

- `CopyButton`, `LoadingButton`, `CheckboxItem`, `EmptyState`, `SelectionSummaryBar`, `SectionHeader`, `FileSelector`, and `DropZone` reduce repeated local markup.
- `CardTitle` has a project-local `as` prop to preserve heading hierarchy while keeping Card composition.

## Findings

### P1 - Add official form primitives and migrate form-like layouts

The app uses `Input`, `Label`, and `Checkbox`, but most form-like sections are still assembled from raw `div` stacks. Official shadcn docs now recommend `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `Select`, and related components for structured forms.

Examples:

- `src/components/marketplace/MarketplaceSettings.tsx:260` uses `space-y-2` for a form field.
- `src/components/marketplace/MarketplaceSettings.tsx:262` uses a native `<select>` for result density.
- `src/components/marketplace/MarketplaceSettings.tsx:274` uses another hand-rolled field wrapper for the GitHub token.
- `src/components/RemoteUrlPanel.tsx:37`, `src/components/RemoteUrlPanel.tsx:39`, and `src/components/RemoteUrlPanel.tsx:82` use manual form grouping.
- `src/components/FileSelector.tsx:42` uses a raw `<label>` instead of shadcn `Label`.

Recommendation:

- Add `field`, `select`, and `input-group`.
- Migrate settings dialogs and URL/path input rows first.
- Use `FieldGroup` for grouped settings, `Field` for each field, and `FieldDescription` for helper text.
- Replace native select with shadcn `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, and `SelectValue`.

### P1 - Replace custom toggle/option controls with ToggleGroup, RadioGroup, or Switch

Several two-option or binary controls are custom buttons or checkbox rows. These work visually, but shadcn offers stronger semantic and keyboard patterns.

Examples:

- `src/components/emulator-manager/RootSourceStep.tsx:99` hand-builds a two-choice mode selector with raw buttons.
- `src/components/emulator-manager/RootSourceStep.tsx:171` creates a custom clickable card with `role="button"` but no keyboard handler.
- `src/components/emulator-manager/RootSourceStep.tsx:223` uses another raw button for file picking card behavior.
- `src/components/views/debloater/DebloaterTab.tsx:260` and `src/components/views/debloater/DebloaterTab.tsx:280` use custom button-like toggles for expert and disable mode.
- `src/components/marketplace/FilterBar.tsx:94` and `src/components/marketplace/FilterBar.tsx:110` implement grid/list view mode with two Buttons and `aria-pressed`.
- `src/components/RemoteUrlPanel.tsx:85` and `src/components/RemoteUrlPanel.tsx:91` use a checkbox plus raw label for a binary mode.

Recommendation:

- Add `toggle-group`, `switch`, and `radio-group`.
- Use `ToggleGroup` for 2-7 mutually exclusive mode options such as Download vs Local File and Grid vs List.
- Use `Switch` for durable binary settings like expert mode, disable mode, and prefetch.
- Use `RadioGroup` where each option needs richer text and a single choice.

### P1 - Convert status/warning boxes to Alert

The repo has many one-off warning/success/error panels. Some use `Card`, some use raw `div`, and many carry raw color classes. Official shadcn has `Alert` for this job.

Examples:

- `src/components/emulator-manager/EmulatorLaunchTab.tsx:81` uses a warning `Card` with `border-amber-500/30 bg-amber-500/10`.
- `src/components/emulator-manager/EmulatorRootTab.tsx:21` uses a raw warning panel.
- `src/components/emulator-manager/EmulatorRestoreTab.tsx:34` uses a manually colored status panel.
- `src/components/emulator-manager/RootSourceStep.tsx:148` uses a custom error panel.
- `src/components/views/debloater/ReviewSelectionDialog.tsx:183` uses a custom destructive warning panel.

Recommendation:

- Add `alert`.
- Use `Alert`, `AlertTitle`, and `AlertDescription` for warning, error, and informational panels.
- Add project variants if needed, but keep status colors mapped through `warning`, `success`, and `destructive` tokens.

### P1 - Replace raw status color utilities with semantic tokens or badge variants

Project rules explicitly prefer semantic tokens and Badge variants over raw color families. There is still raw emerald/amber/red/blue/zinc styling in status badges and warning panels.

Examples:

- `src/components/emulator-manager/AvdSwitcher.tsx:69`, `177`, `190`, `191`
- `src/components/emulator-manager/EmulatorLaunchTab.tsx:81`, `83`, `86`
- `src/components/emulator-manager/EmulatorRootTab.tsx:21`
- `src/components/emulator-manager/RootProgressStep.tsx:64`
- `src/components/emulator-manager/RootResultStep.tsx:32`, `39`
- `src/components/views/debloater/DebloaterTab.tsx:265`, `273`, `285`, `361`
- `src/components/views/debloater/DescriptionPanel.tsx:45`
- `src/components/views/debloater/ReviewSelectionDialog.tsx:142`, `149`, `183`
- `src/components/views/ViewEmulatorManager.tsx:230`, `241`

Recommendation:

- Extend `badge-variants.ts` or status helpers with `success`, `warning`, `info`, and `neutral` variants.
- Use `bg-warning`, `text-warning-foreground`, `border-warning`, `bg-success`, `text-success`, and `text-destructive` instead of raw `amber-*`, `emerald-*`, `red-*`, and `blue-*`.
- Keep provider/source brand coloring isolated where it truly represents provider identity, not app status.

### P2 - Improve Card composition in repeated item cards

Several repeated cards use `Card` + `CardContent` only, even where the surface has title, description, metadata, and footer actions. Official shadcn examples emphasize full Card composition.

Examples:

- `src/components/marketplace/AppCard.tsx:41` and `42` render the whole app card inside `CardContent`.
- `src/components/views/ViewAppManager.tsx:37` and `38` use a shell Card with only `CardContent`.
- `src/components/views/ViewEmulatorManager.tsx:305` and `306` use the same shell-card pattern.
- `src/components/RemoteUrlPanel.tsx:99` and `106` use a status Card with only `CardContent`; this should likely become `Alert`.

Recommendation:

- For repeated app cards, use `CardHeader` for icon/name/provider/version, `CardContent` for summary and metadata, and `CardFooter` for install/details actions.
- Keep shell cards intentionally headerless only where the header exists outside the card and this pattern is documented.
- Convert non-card alert/status surfaces to `Alert`.

### P2 - Avoid `div role="button"` and raw clickable cards where Button/asChild or Radix patterns fit

The app usually uses real buttons, but some cards and rows still simulate buttons with `div`.

Examples:

- `src/components/marketplace/AppCard.tsx:43` uses `div role="button"` with keyboard handling.
- `src/components/emulator-manager/RootSourceStep.tsx:171` uses `div role="button"` without matching keyboard handling.
- `src/components/views/ViewFileExplorer.tsx:968` uses a raw button for path editing, which is semantically okay but should be checked against shadcn Button styling consistency.

Recommendation:

- Prefer `Button asChild` for clickable wrappers when practical.
- For selectable cards, consider `ToggleGroupItem`, `RadioGroupItem`, or a small `SelectableCard` wrapper with standardized focus ring, keyboard behavior, and `aria-pressed` / `aria-selected`.
- Treat `role="button"` as a last resort and always include `tabIndex`, Enter, and Space handling.

### P2 - Standardize icon usage inside buttons

The local shadcn skill rules call for icons in Buttons to use `data-icon` and avoid manual icon sizing inside components. Current code frequently uses `mr-2 size-4`, `size-3.5`, or `h-4 w-4` directly inside Button content.

Examples:

- `src/components/marketplace/MarketplaceSettings.tsx:235`, `237`, `243`, `301`, `309`
- `src/components/RemoteUrlPanel.tsx:70`, `75`
- `src/components/payload-dumper/PayloadSourceTabs.tsx:91`, `96`
- `src/components/views/ViewAppManager.tsx:45`, `49`
- `src/components/views/ViewFlasher.tsx:461`, `479`, `533`, `555`, `589`
- `src/components/ActionButton.tsx:45`

Recommendation:

- Update `button.tsx` / `button-variants.ts` to support the current shadcn icon selector pattern if needed.
- Gradually migrate in-button icons to `data-icon="inline-start"` / `data-icon="inline-end"`.
- Keep non-button standalone icons on the existing project convention until that migration is explicit.

### P2 - Replace native `title` tooltips with shadcn Tooltip where user-facing

Native `title` appears in many places. It is acceptable for low-level overflow disclosure, but user-facing controls and metadata benefit from consistent shadcn `Tooltip`.

Examples:

- `src/components/emulator-manager/RootSourceStep.tsx:198`
- `src/components/marketplace/MarketplaceEmptyState.tsx:93`, `126`, `149`, `172`, `197`
- `src/components/payload-dumper/FileBanner.tsx:72`, `155`
- `src/components/payload-dumper/FileBannerDetails.tsx:64`
- `src/components/views/ViewFileExplorer.tsx:866`, `904`, `921`, `933`, `945`, `992`, `1035`, `1047`
- `src/components/views/ViewUtilities.tsx:480`
- `src/components/ui/sidebar.tsx:261`

Recommendation:

- Keep `title` for passive truncated text only if the team accepts native behavior.
- Use `Tooltip`, `TooltipTrigger`, and `TooltipContent` for buttons, icon actions, and discoverable commands.
- File Explorer toolbar is the highest-value migration area because it has many icon-heavy actions.

### P2 - Add explicit image dimensions for app icons and logos

The Web Interface Guidelines require explicit width and height to prevent layout shift. Some images use Tailwind `size-*`, but native `width` and `height` attributes are still missing.

Examples:

- `src/components/marketplace/AppCard.tsx:58`
- `src/components/marketplace/AppDetailView.tsx:131`, `203`
- `src/components/marketplace/AppListItem.tsx:54`
- `src/components/views/ViewAbout.tsx:16`
- `src/components/AppSidebar.tsx:84`
- `src/components/WelcomeScreen.tsx:13`

Recommendation:

- Add `width` and `height` attributes matching the fixed slot size.
- Keep `loading="lazy"` for below-fold marketplace images and detail screenshots.
- App cards already reserve fixed icon slots; native dimensions will make that stronger.

### P2 - Adopt shadcn Empty instead of the project-only EmptyState where possible

The repo has a local `EmptyState` component and uses it successfully, but official shadcn now has `empty`. The local wrapper may still be useful, but it should either wrap shadcn `Empty` or be intentionally kept as the project abstraction.

Examples:

- `src/components/EmptyState.tsx`
- `src/components/views/ViewEmulatorManager.tsx:346`
- `src/components/marketplace/MarketplaceEmptyState.tsx`
- Dashboard still has opportunities for empty-device state consistency.

Recommendation:

- Add `empty`.
- Convert `EmptyState` to a thin project wrapper over shadcn `Empty`, or explicitly document why the project wrapper remains.
- Use one empty-state vocabulary across Dashboard, Marketplace, File Explorer, Payload Dumper, and Emulator Manager.

### P2 - Use shadcn Table in safety review dialog

`ReviewSelectionDialog` renders a raw table even though `Table` is installed.

Example:

- `src/components/views/debloater/ReviewSelectionDialog.tsx:90`

Recommendation:

- Replace raw `<table>` with `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`.
- This keeps row spacing, borders, and typography consistent with File Explorer.

### P3 - Replace custom loading placeholders with Skeleton where appropriate

The project has shadcn `Skeleton`, but some loading states still use raw `animate-pulse`.

Examples:

- `src/components/marketplace/AppDetailView.tsx:192`
- `src/components/views/ViewAppManager.tsx:45`

Recommendation:

- Use `Skeleton` for placeholder blocks and rows.
- Keep spinner icons for active commands where progress is immediate and command-like.

### P3 - Improve input attributes for settings/search fields

Some inputs need better browser/assistive hints.

Examples:

- `src/components/marketplace/MarketplaceSettings.tsx:175` GitHub OAuth client ID should include `name`, `autoComplete="off"`, and `spellCheck={false}`.
- `src/components/marketplace/MarketplaceSettings.tsx:276` PAT should include `name`, `autoComplete="off"`, and `spellCheck={false}`.
- `src/components/marketplace/SearchBar.tsx:57` search input should include an explicit `name` and consider `type="search"`.
- `src/components/RemoteUrlPanel.tsx:45` URL input should use `type="url"`, `inputMode="url"`, `name`, and `autoComplete="off"`.
- `src/components/ShellPanel.tsx:187` shell command input should use `spellCheck={false}` and `autoComplete="off"`.

Recommendation:

- As part of the `Field` / `InputGroup` migration, standardize field attributes for URL, token, command, search, and numeric controls.

### P3 - Prefer shared formatters over local `new Date` and `toFixed` formatting

Most date formatting is acceptable, but there are still isolated local formatters and direct `new Date(...).toLocaleDateString()` calls.

Examples:

- `src/components/emulator-manager/RootSourceStep.tsx:21` defines local `formatBytes`.
- `src/components/emulator-manager/RootSourceStep.tsx:31` defines local date formatting.
- `src/components/marketplace/AppCard.tsx:95` uses `toFixed(1)` for rating.
- `src/components/marketplace/AppCard.tsx:104` uses direct `new Date(...).toLocaleDateString()`.
- `src/components/marketplace/AppDetailView.tsx:185` and `312` use inline MB formatting.

Recommendation:

- Centralize byte, date, and compact number formatting in `src/lib/utils.ts` or feature-local formatter modules.
- Use `Intl.NumberFormat` for ratings/downloads/sizes where user-facing.
- Use `Intl.DateTimeFormat` constants for repeated date rendering.

## Component Adoption Roadmap

### Phase 1 - Add missing official primitives

Run:

```bash
bunx --bun shadcn@latest add select switch alert empty field input-group toggle-group textarea radio-group slider avatar
```

Then inspect every added file. Preserve local alias conventions and project theming.

### Phase 2 - Form and settings cleanup

Targets:

- `MarketplaceSettings`
- `RemoteUrlPanel`
- `FileSelector`
- `EditNicknameDialog`
- `ShellPanel`

Changes:

- Convert field wrappers to `FieldGroup` / `Field`.
- Replace native select with shadcn `Select`.
- Use `InputGroup` where an input has a clear button or leading icon.
- Add correct input attributes.

### Phase 3 - Alerts and semantic status cleanup

Targets:

- Emulator Manager warning/status panels
- Debloater review warnings
- Root source error state
- Remote URL status card

Changes:

- Replace custom panels with `Alert`.
- Move raw amber/emerald/red/blue/zinc status styling into variants or semantic tokens.

### Phase 4 - Selection and mode controls

Targets:

- Root source Download vs Local File
- Marketplace Grid vs List
- Debloater Expert Mode / Disable Mode
- Remote URL Prefetch Mode

Changes:

- Use `ToggleGroup`, `Switch`, or `RadioGroup`.
- Remove raw button/role-button patterns where a primitive fits.

### Phase 5 - Polish pass

Targets:

- File Explorer toolbar
- Marketplace app cards and images
- App detail loading and screenshots
- ReviewSelectionDialog table

Changes:

- Replace native title tooltips on actions with shadcn `Tooltip`.
- Add image dimensions.
- Replace raw tables with shadcn `Table`.
- Use `Skeleton` for loading blocks.

## Risks and Notes

- Do not run `add --all --overwrite` without an explicit review/merge plan. This repo has intentional local primitive changes such as polymorphic `CardTitle`, sidebar Fast Refresh split, and custom variants.
- The current shadcn primitives are source-owned in the app. Any update should use `bunx --bun shadcn@latest add <component> --dry-run` and `--diff` before merging.
- The app is a Tauri desktop surface, so not every web guideline applies literally. URL state sync, browser navigation semantics, and some safe-area guidance are lower priority here than viewport containment, keyboard access, and desktop ergonomics.
- The Memory Bank says the user recently requested lint-only verification. For this report-only task, no source quality gates were needed beyond command-based inspection.

## Bottom Line

The frontend is not far from a strong shadcn-first posture. The highest-return work is not a redesign; it is adding the missing official primitives and using them to replace the remaining custom form, alert, toggle, tooltip, and empty/loading patterns. That will make the UI more consistent, more accessible, and easier to maintain without disturbing the existing Tauri desktop architecture.
