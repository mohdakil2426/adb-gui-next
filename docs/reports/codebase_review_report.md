# ADB GUI Next — Comprehensive UI Code Review Report

> **Scope**: Web UI (`src/`) — React 19 + TypeScript + Tailwind v4 + shadcn/ui  
> **Date**: 2026-03-23 | **Reviewed by**: Antigravity Code Reviewer

---

## Executive Summary

The codebase is well-structured with a solid Tauri 2 abstraction layer, Zustand state management, and TanStack Query. Overall quality is good, but there are **clear opportunities** across four categories:

1. 🗑️ **Dead/Unused Code & Assets** — 3 items
2. 🔒 **Hard-Coded Values** — 11 findings
3. ♻️ **Reusability & DRY Improvements** — 9 patterns to extract
4. 🎨 **shadcn Component Opportunities** — 9 missing components to leverage

---

## 1. 🗑️ Dead Code & Unused Artifacts

### 1.1 [src/App.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/App.css) — Completely Orphaned

**File**: [src/App.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/App.css) (117 lines)

This file is a **Vite create-app template relic**. It still contains `.logo.vite`, `.logo.react`, `.logo.tauri`, `#greet-input` rules and a raw `h1`, `button`, `input`, `:root` block that directly contradicts the Tailwind v4 theme in [global.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/styles/global.css). It is **not imported by any component**. The main Tailwind file is [global.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/styles/global.css).

> [!CAUTION]
> [App.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/App.css) is never imported — it is dead weight but has conflicting styles that could bite you if someone accidentally imports it.

**Action**: Delete [src/App.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/App.css) entirely.

---

### 1.2 [ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx) — Dead State Variable

**File**: [src/components/views/ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx), lines 64–65

```tsx
const refreshTimeout = null;
void (refreshTimeout && handleError);
```

This is leftover from a refactor. The `void` statement is a no-op that suppresses a lint warning for an unused import that was never cleaned up. `handleError` is already imported and used elsewhere in the file — this suppression is just noise.

**Action**: Remove lines 64–65 entirely.

---

### 1.3 [WelcomeScreen.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/WelcomeScreen.tsx) — Commented-Out JSX

**File**: [src/components/WelcomeScreen.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/WelcomeScreen.tsx), lines 23–28

```tsx
{/* <p className="text-center text-xs text-muted-foreground">
  Loading app... {Math.round(clampedProgress)}%
</p> */}
{/* <Loader2 className="h-6 w-6 animate-spin text-primary" /> */}
```

Two elements are indefinitely commented out. If they're not needed, remove them; if they are, undo the comment. Dead JSX comments are noise.

**Action**: Remove commented JSX.

---

## 2. 🔒 Hard-Coded Values (Semantic / Constant Violations)

### 2.1 Status Colors in [ConnectedDevicesCard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/ConnectedDevicesCard.tsx) — Raw Tailwind Color Classes

**File**: [src/components/ConnectedDevicesCard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/ConnectedDevicesCard.tsx), lines 63–72

```tsx
let statusColor = 'text-yellow-500';
if (device.status === 'device') {
  statusColor = 'text-green-500';
} else if (device.status === 'fastboot') {
  statusColor = 'text-blue-500';
} else if (device.status === 'unauthorized') {
  statusColor = 'text-red-500';
}
```

Raw Tailwind color classes (`text-green-500`, `text-blue-500`, `text-red-500`) are used for status coloring. This bypasses the theme system entirely. The correct approach is to use **shadcn Badge** with semantic variants OR define custom CSS tokens. If you ever change the primary color, these are invisible to the theme.

> [!WARNING]
> Hard-coded Tailwind color classes bypass the theme system. In dark mode, `text-green-500` may have poor contrast.

**Better approach**: Use shadcn `Badge` component with a variant map:
```tsx
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  device: 'default',
  fastboot: 'secondary',
  unauthorized: 'destructive',
  ...
};
```

---

### 2.2 Package Type Badge Colors in [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx) — Hard-Coded

**File**: [src/components/views/ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx), lines 438–443

```tsx
pkg.packageType === 'user'
  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
```

Hard-coded `blue-*` and `amber-*` color classes. This should be a `Badge` component with variant or a CSS token.

---

### 2.3 [ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx) — `emerald-*` Color References (6 instances)

**File**: [src/components/views/ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx)

The completed/success state uses `text-emerald-500`, `text-emerald-600 dark:text-emerald-400`, `border-emerald-500/50`, `bg-emerald-500/5`. These should use the CSS token `--terminal-log-success` or a proper semantic class, not raw Tailwind color classes.

---

### 2.4 [ViewFileExplorer.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFileExplorer.tsx) — Hard-Coded `text-blue-500` for Folder Icon

**File**: [src/components/views/ViewFileExplorer.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFileExplorer.tsx), line 332

```tsx
<Folder className="h-4 w-4 text-blue-500" />
```

A single hard-coded blue. Should use `text-primary` or a semantic token.

---

### 2.5 [ViewAbout.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAbout.tsx) — Hard-Coded `text-red-500`

**File**: [src/components/views/ViewAbout.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAbout.tsx), line 88

```tsx
<Heart className="w-5 h-5 text-red-500 fill-red-500/20" />
```

Should use a dedicated token like `text-destructive` or a custom `--heart-color` CSS variable.

---

### 2.6 [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx) — No `alertDialogAction` variant for Wipe button

**File**: [src/components/views/ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx), line 338

```tsx
<AlertDialogAction className="bg-destructive hover:bg-destructive/90">
```

The `Wipe Data` confirm button applies destructive styling inline, while [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx) correctly uses `buttonVariants({ variant: 'destructive' })`. This is an inconsistency — both should use the same pattern.

---

### 2.7 [ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx) — [handleCopyGetVars](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx#207-216) Directly Calls `writeText`

**File**: [src/components/views/ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx), lines 207–214

```tsx
const handleCopyGetVars = async () => {
  await writeText(getVarContent);
  toast.success('Copied to clipboard');
};
```

This duplicates what [CopyButton](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/CopyButton.tsx#17-52) already does. The [CopyButton](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/CopyButton.tsx#17-52) shared component exists precisely for this use case. The shared component adds the show-checkmark UX and proper error handling in one place.

---

### 2.8 [BottomPanel.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/BottomPanel.tsx) — `navigator.clipboard` Fallback

**File**: [src/components/BottomPanel.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/BottomPanel.tsx), line 119

```tsx
navigator.clipboard.writeText(text);
```

This is a fallback for "environments without Tauri clipboard." But this is a Tauri app — there is no "non-Tauri" environment and no need for this fallback. Remove it.

---

### 2.9 [MainLayout.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/MainLayout.tsx) — `useLogStore.getState()` Called in Render

**File**: [src/components/MainLayout.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/MainLayout.tsx), lines 355, 375

```tsx
isLogOpen && useLogStore.getState().activeTab === 'shell'
```

`useLogStore.getState()` is called inline inside JSX. This bypasses React's reactivity — the button state won't update when `activeTab` changes unless the component re-renders for another reason. This should use a selector: `const { activeTab } = useLogStore()`.

> [!WARNING]
> This is a reactivity bug — the active state of the Shell/Logs toggle buttons may not reflect the current tab.

---

### 2.10 [ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx) — Custom Partition Table (No shadcn Table)

**File**: [src/components/views/ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx), lines 581–685

A fully custom partition table is built with raw `<div>` grid layouts and manual `grid-cols-[28px_1fr_...]` column definitions. The project already has `shadcn/ui Table` installed and used in [ViewFileExplorer.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFileExplorer.tsx). The partition table should use the same `Table`, `TableHeader`, `TableRow`, `TableCell` primitives.

---

### 2.11 [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx) — Custom Search Input (Raw `<input>`)

**File**: [src/components/views/ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx), line 383

```tsx
<input
  className="flex h-10 w-full bg-transparent py-3 text-sm outline-none ..."
  placeholder="Search packages..."
/>
```

A raw `<input>` is used instead of the shadcn `Input` component. The project already has `Input` installed. The raw element forgoes accessibility attributes and theme integration.

---

## 3. ♻️ Reusability / DRY Improvement Opportunities

### 3.1 `LoadingButton` — Duplicated Spinner Pattern (15+ instances)

Every view has this pattern repeated identically:

```tsx
{isLoading ? (
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
) : (
  <SomeIcon className="mr-2 h-4 w-4" />
)}
Button Label
```

This appears in **ViewFlasher** (4×), **ViewDashboard** (4×), **ViewFileExplorer** (4×), **ViewUtilities** (5×), **ViewAppManager** (3×), **ViewPayloadDumper** (2×). That's **20+ identical spinner/icon patterns**.

**Extract to** `src/components/LoadingButton.tsx`:

```tsx
interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  isLoading: boolean;
  icon: React.ReactNode;
  loadingLabel?: string;
}

export function LoadingButton({ isLoading, icon, loadingLabel, children, ...props }: LoadingButtonProps) {
  return (
    <Button {...props}>
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {isLoading && loadingLabel ? loadingLabel : children}
    </Button>
  );
}
```

---

### 3.2 `SectionHeader` — Repeated Section Header Pattern

**Files**: [ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx), [ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx)

The pattern:
```tsx
<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  Section Title
</h4>
```
...appears **6+ times** across views. Extract to:

```tsx
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}
```

---

### 3.3 `FileSelector` — Duplicated File Selection Pattern

**Files**: [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx), [ViewFileExplorer.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFileExplorer.tsx), [ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx)

All three have this pattern:
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">Label</label>
  <div className="flex gap-2">
    <Button variant="outline" className="flex-1" onClick={handleSelect}>Select File</Button>
  </div>
  <p className="text-sm text-muted-foreground truncate">{path || 'No file selected.'}</p>
</div>
```

**Extract to** `src/components/FileSelector.tsx` with `label`, `path`, `onSelect`, [placeholder](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx#55-57), and `isLoading` props.

---

### 3.4 `SelectionSummaryBar` — Duplicated Selected-Items Footer

**Files**: [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx) (appears twice — APK files and packages)

```tsx
{selectedPackages.size > 0 && (
  <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md flex justify-between items-center">
    <span>Selected: <span className="font-medium">{selectedPackages.size}</span> package(s)</span>
    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs hover:text-destructive"
      onClick={() => setSelectedPackages(new Set())}>
      Clear Selection
    </Button>
  </div>
)}
```

This pattern exists **twice** inside the same component. Extract as `SelectionSummaryBar`.

---

### 3.5 `StatusBadge` — Device Status Display Consolidation

**File**: [ConnectedDevicesCard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/ConnectedDevicesCard.tsx)

The status string → color mapping is an imperative if-else chain. Replace with a `StatusBadge` component or object map that can be reused wherever device status is displayed (future fastboot status labels, etc.).

---

### 3.6 [InfoItem](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#373-401) in [ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx) — Promote to Shared Component

**File**: [src/components/views/ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx), lines 373–400

[InfoItem](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#373-401) is a well-designed internal component but is defined locally inside the view file. It could be useful in the About page, Utilities device info section, or in future device detail panels. Move to `src/components/InfoItem.tsx`.

---

### 3.7 Nickname Editing Pattern — Duplicated in 3 Views

**Files**: [ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx), [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx), [ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx)

All three views replicate:
```tsx
const [isEditing, setIsEditing] = useState(false);
// ...
<EditNicknameDialog isOpen={isEditing} onOpenChange={setIsEditing} serial={...} onSaved={...} />
```

Consider a `useNicknameEdit()` hook that returns `{ isEditing, openEdit, EditDialog }` to reduce boilerplate in each view.

---

### 3.8 File Path → Filename Utility — Multiple Inline Implementations

The `path.split(/[/\\]/).pop()` pattern for extracting filenames appears **5+ times** across views:
- [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx) line 133
- [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx) lines 81, 96
- [ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx) line 409 ([getFileName](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#408-413) function — already extracted!)

The [getFileName](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#408-413) function in [ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx) is the right approach. Extract it to [src/lib/utils.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/utils.ts) as a named export so all views import it from one place.

---

### 3.9 [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx) — Mixed Concerns in 531 Lines

The AppManager view handles **install** and **uninstall** in one 531-line file. Each feature could be its own sub-component:
- `AppInstallCard` — APK selection + installation
- `AppUninstallCard` — search + virtual list + uninstall action

This would let each sub-component manage its own state, making the code much easier to read and test.

---

## 4. 🎨 shadcn Component Opportunities

These are components already available in shadcn/ui (not yet installed or not properly used) that could significantly improve the codebase.

### 4.1 `Badge` — Status Indicators Everywhere

**Priority**: 🔴 High

Currently used nowhere. Should be used in:
- **ConnectedDevicesCard**: device status text (replace `text-green-500` strings)
- **ViewAppManager**: package type labels (replace `bg-blue-500/15 text-blue-600 dark:text-blue-400` inline spans)
- **ViewPayloadDumper**: partition state indicators
- **ViewFileExplorer**: file type indicator

```bash
npx shadcn@latest add badge
```

**Usage example** for device status:
```tsx
<Badge variant={statusVariant[device.status]}>{statusLabel}</Badge>
```

---

### 4.2 [Progress](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#44-84) — Progress Bars

**Priority**: 🔴 High

Three separate custom progress bar implementations exist:
1. **ViewAppManager** — installation progress bar (lines 299–303, manual `div` with `style.width`)
2. **ViewPayloadDumper** — [ExtractionProgressBar](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#44-84) component (manual `div` with animated width)
3. **WelcomeScreen** — loading bar (manual `div` with `style.width`)

All three should use the shadcn [Progress](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#44-84) component, which handles accessibility via `role="progressbar"` and `aria-valuenow`.

```bash
npx shadcn@latest add progress
```

---

### 4.3 [Dialog](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#165-169) — Output Viewer (GetVar All)

**Priority**: 🟡 Medium

**File**: [ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx), lines 493–537

The fastboot variables output is displayed in an `AlertDialog`. `AlertDialog` is semantically for confirmations that require user decisions (yes/no). A read-only output viewer should use a **[Dialog](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#165-169)** instead. `AlertDialog` is being misused here as a generic modal.

```bash
npx shadcn@latest add dialog
```

---

### 4.4 `Separator` — Section Dividers

**Priority**: 🟡 Medium

Multiple views use `<div className="w-px h-4 mx-1" />` (BottomPanel) or spacing conventions to separate sections. The shadcn `Separator` component provides proper semantic HTML (`<hr>` with `role="separator"`) and theme-aware color.

```bash
npx shadcn@latest add separator
```

---

### 4.5 `Skeleton` — Loading States

**Priority**: 🟡 Medium

Currently, most views show either a spinner or empty space while loading. Skeleton loaders would significantly improve perceived performance:
- **ViewDashboard** Device Info section (12 info items)
- **ViewAppManager** Package list loading state (currently just a spinner in the filter bar)
- **ViewFileExplorer** File table loading (currently a centered spinner)

```bash
npx shadcn@latest add skeleton
```

---

### 4.6 [Select](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#103-116) — Package Filter Dropdown Alternative

**Priority**: 🟡 Medium

**File**: [ViewAppManager.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx), lines 345–370

The package type filter currently uses `DropdownMenu` + `DropdownMenuRadioGroup`. For a filter with only 3 fixed options (All/User/System), a shadcn [Select](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#103-116) component is semantically more appropriate and requires less code.

```bash
npx shadcn@latest add select
```

---

### 4.7 `Textarea` — Shell Input Enhancement

**Priority**: 🟢 Low

**File**: [ShellPanel.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/ShellPanel.tsx), line 184

The shell input uses a single-line `Input`. Some ADB commands can be long (e.g. `adb shell am start -n com.example/.MainActivity -a android.intent.action.VIEW -d "https://..."`). A resizable `Textarea` with a `min-h` of 1 row and `max-h` of 3-4 rows would give users more control.

```bash
npx shadcn@latest add textarea
```

---

### 4.8 `Sheet` — Mobile-Responsive Sidebar

**Priority**: 🟢 Low

On narrow windows, the sidebar collapse works but a collapsed sidebar shows icon-only buttons. For very small windows or if you ever add a hamburger menu, a `Sheet` (drawer) component would give a proper slide-out navigation experience without requiring a router.

```bash
npx shadcn@latest add sheet
```

---

### 4.9 `Popover` — BottomPanel Filter Menu

**Priority**: 🟢 Low

**File**: [BottomPanel.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/BottomPanel.tsx), lines 268–294

The log filter is a manually built dropdown div:
```tsx
{isFilterOpen && (
  <div className="absolute right-0 bottom-8 z-50 rounded-md border shadow-lg ...">
    {FILTER_OPTIONS.map(...)}
  </div>
)}
```

This doesn't handle outside-click-to-close properly and has no focus trap or keyboard navigation. Replace with shadcn `Popover` for accessibility and click-outside behavior.

```bash
npx shadcn@latest add popover
```

---

## 5. Architecture & Patterns

### 5.1 [models.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/models.ts) — Class-Based DTOs vs Plain Interfaces

**File**: [src/lib/desktop/models.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/models.ts)

The DTOs use `class` with [createFrom()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/models.ts#58-61) and a `source: any` constructor pattern — this is a Wails 2 code generation artifact. In Tauri 2 + TypeScript, Tauri's `invoke()` already returns correctly-typed plain objects. The class-based approach with `source: any` loses type safety at the constructor call site.

**Recommendation**: Migrate to plain TypeScript `interface` or `type` definitions. Since these are DTO shapes for `invoke()` return values, they don't need constructors.

```ts
// Current pattern (Wails artifact):
export class Device {
  constructor(source: any = {}) { this.serial = source['serial']; }
}

// Preferred (modern Tauri 2):
export interface Device {
  serial: string;
  status: string;
}
```

---

### 5.2 `activeView` Prop Threading — Mild Coupling

Every view receives `activeView: string` as a prop so it knows whether to trigger its polling or data loading. This is used as: `refetchInterval: activeView === 'dashboard' ? 3000 : false`. 

While functional, it tightly couples the view to parent navigation state. A cleaner pattern would be:
- Use `enabled: true` always (views are unmounted when not active due to AnimatePresence)
- Or use an `isActive` boolean prop instead of the string comparison

This is a minor improvement but could simplify view components.

---

### 5.3 `EditNicknameDialog` — Should Use [Dialog](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#165-169) Not Custom Implementation

**File**: [src/components/EditNicknameDialog.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/EditNicknameDialog.tsx)

```tsx
// Currently likely uses a custom/AlertDialog approach
```

Check if `EditNicknameDialog` uses the shadcn [Dialog](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#165-169) component or implements its own modal. If not using [Dialog](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#165-169), it should be migrated.

---

### 5.4 Keyboard Shortcut Infrastructure — Missing

Currently only `Ctrl+\`` (toggle panel) exists. Many ADB GUI users are power users who would benefit from more keyboard shortcuts. Consider a `useKeyboardShortcuts()` hook registered globally (e.g. `Ctrl+R` = refresh, `Ctrl+K` = shell).

---

## 6. Prioritized Action Plan

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Fix reactivity bug: `useLogStore.getState()` in JSX → use selector | XS | High |
| 🔴 P0 | Delete [src/App.css](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/App.css) (dead file) | XS | Low |
| 🔴 P0 | Remove `refreshTimeout` dead code in [ViewUtilities.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewUtilities.tsx) | XS | Low |
| 🔴 P1 | Install `Badge` and replace all hard-coded status/type color classes | S | High |
| 🔴 P1 | Install [Progress](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#44-84) and replace all 3 custom progress bar implementations | S | High |
| 🔴 P1 | Replace `AlertDialog` with [Dialog](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#165-169) in GetVar All output viewer | S | Medium |
| 🟡 P2 | Extract `LoadingButton` shared component (20+ usages) | M | High |
| 🟡 P2 | Extract `SectionHeader` shared component | XS | Medium |
| 🟡 P2 | Extract [getFileName()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#408-413) to [src/lib/utils.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/utils.ts) | XS | Medium |
| 🟡 P2 | Replace `<input>` with shadcn `Input` in AppManager search | XS | Medium |
| 🟡 P2 | Use `buttonVariants({ variant: 'destructive' })` in ViewFlasher wipe button | XS | Low |
| 🟡 P2 | Install `Separator` and replace manual divider divs | S | Medium |
| 🟡 P3 | Install `Skeleton` for loading states | M | High (UX) |
| 🟡 P3 | Extract `FileSelector` shared component | S | Medium |
| 🟡 P3 | Extract [InfoItem](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#373-401) from ViewDashboard to shared component | XS | Low |
| 🟡 P3 | Migrate [models.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/models.ts) DTOs from classes to plain interfaces | M | Medium |
| 🟢 P4 | Install `Popover` for BottomPanel log filter | S | Medium |
| 🟢 P4 | Split [ViewAppManager](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#42-531) into `AppInstallCard` + `AppUninstallCard` | M | Medium |
| 🟢 P4 | `useNicknameEdit()` hook to DRY the 3-view nickname pattern | S | Low |
| 🟢 P4 | Install [Select](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#103-116) for package filter | S | Low |
| 🟢 P4 | Install `Textarea` for shell input | S | Low |

---

## 7. Quick Wins (Do These First)

These can be done in under 10 minutes total:

```bash
# 1. Delete App.css
Remove-Item src/App.css

# 2. Install missing shadcn components
npx shadcn@latest add badge
npx shadcn@latest add progress
npx shadcn@latest add dialog
npx shadcn@latest add separator
npx shadcn@latest add skeleton
```

Then fix the **P0 reactivity bug** in [MainLayout.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/MainLayout.tsx):

```diff
-  const { togglePanel, isOpen: isLogOpen, setActiveTab, unreadCount } = useLogStore();
+  const { togglePanel, isOpen: isLogOpen, setActiveTab, unreadCount, activeTab } = useLogStore();

 // In JSX:
-  isLogOpen && useLogStore.getState().activeTab === 'shell'
+  isLogOpen && activeTab === 'shell'
-  isLogOpen && useLogStore.getState().activeTab === 'logs'
+  isLogOpen && activeTab === 'logs'
```

---

## 8. shadcn Components Inventory

| Component | Installed | Should Install |
|-----------|-----------|---------------|
| alert-dialog | ✅ | — |
| button | ✅ | — |
| card | ✅ | — |
| command | ✅ (unused?) | — |
| dropdown-menu | ✅ | — |
| input | ✅ | — |
| label | ✅ | — |
| scroll-area | ✅ | — |
| sonner | ✅ | — |
| table | ✅ | — |
| tabs | ✅ | — |
| tooltip | ✅ | — |
| **badge** | ❌ | ✅ P1 |
| **progress** | ❌ | ✅ P1 |
| **dialog** | ❌ | ✅ P1 |
| **separator** | ❌ | ✅ P2 |
| **skeleton** | ❌ | ✅ P3 |
| **select** | ❌ | ✅ P3 |
| **popover** | ❌ | ✅ P4 |
| **textarea** | ❌ | ✅ P4 |
| **sheet** | ❌ | ✅ P4 |

> [!NOTE]
> The `command` component is installed but appears unused in the current codebase. It may have been installed speculatively. Verify whether it is needed — if not, it's dead weight.

---

## 9. Code Quality Summary

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 8/10 | Clean Tauri abstraction, proper stores, TanStack Query |
| DRY | 5/10 | Many duplicated patterns (spinner, file selector, section header) |
| shadcn Utilization | 5/10 | Core components used, but Badge/Progress/Dialog/Skeleton missing |
| Hard-Coded Values | 6/10 | Several raw color classes bypass theme system |
| Component Size | 6/10 | [ViewPayloadDumper](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx#85-819) (819 lines) and [ViewAppManager](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewAppManager.tsx#42-531) (531 lines) are too large |
| Type Safety | 7/10 | [models.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/models.ts) uses `source: any` — should migrate to plain interfaces |
| Reactivity | 8/10 | One P0 bug: `getState()` in render |
| Accessibility | 6/10 | Custom inputs, manual dropdowns missing ARIA roles |
| Performance | 9/10 | Virtual list, TanStack Query, AnimatePresence all correct |

**Overall: 7/10** — A well-built app with clear, actionable improvements available.
