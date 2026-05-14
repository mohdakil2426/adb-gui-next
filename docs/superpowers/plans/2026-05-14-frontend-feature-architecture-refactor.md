# Frontend Feature Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the frontend into a strict feature-first architecture so large views become thin coordinators, feature code lives together, shared code is honest, and future work does not keep adding rats nest files.

**Architecture:** Move the app shell into `src/app`, the Tauri IPC boundary into `src/desktop`, cross-feature reusable code into `src/shared`, and product features into `src/features/<feature>/`. Refactor the oversized File Explorer first-class feature into typed model, API, hooks, and focused UI components while preserving the no-router Vite/Tauri app shell and centralized device polling.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tauri 2, shadcn/ui on Radix primitives, Tailwind CSS v4, Zustand 5, TanStack Query 5, TanStack Virtual, Vitest, Bun, GitNexus.

---

## Pre-Implementation Rules

1. Start from a clean git tree. Current known dirty files before this plan was written: `src/components/views/ViewFileExplorer.tsx` and `src/test/ViewFileExplorer.test.tsx`. Commit or intentionally include them before beginning this architecture refactor.
2. Do not change Rust backend behavior in this plan. `src-tauri/` is out of scope except verification commands.
3. Preserve browser deployment out-of-scope. This stays a Vite/Tauri client app.
4. Preserve `MainLayout` view switching. Do not add a router.
5. Preserve centralized device polling in the app shell. Do not add per-view device polling.
6. Use `git mv` for moved files so history survives.
7. Use `@/` imports only. No new relative imports outside very local sibling files in the same feature folder.
8. No barrel files. Do not create `index.ts` re-export files. Import from concrete modules.
9. No compatibility re-export shims from old paths. They hide migration bugs.
10. Every task must end with at least one focused verification command and a commit.
11. Before editing any existing function/class/method, run GitNexus impact analysis for the symbol and record risk in the task notes.
12. File-size target after the refactor:
    - Feature view files: under 250 lines.
    - Feature UI components: under 250 lines.
    - Hooks: under 220 lines.
    - Pure utility files: under 180 lines.
    - shadcn primitive files under `src/shared/ui/` are exempt.

## Target Folder Structure

```text
src/
  main.tsx                         # Vite/Tauri bootstrap only
  app/
    App.tsx                        # QueryClientProvider + ThemeProvider app root
    shell/
      MainLayout.tsx               # no-router view switcher, device polling, toaster
      AppSidebar.tsx               # sidebar navigation
      BottomPanel/
        BottomPanel.tsx
        LogsPanel.tsx
        ShellPanel.tsx
        bottomPanelTypes.ts

  desktop/
    backend.ts                     # only place that imports @tauri-apps/api/core invoke
    runtime.ts                     # events, file drop, opener
    models.ts                      # IPC DTO namespace

  shared/
    ui/                            # shadcn primitives, alias in components.json
    components/
      CheckboxItem.tsx
      ConnectedDevicesCard.tsx
      CopyButton.tsx
      DeviceSwitcher.tsx
      DropZone.tsx
      EditNicknameDialog.tsx
      EmptyState.tsx
      FileSelector.tsx
      LoadingButton.tsx
      RemoteUrlPanel.tsx
      SectionHeader.tsx
      SelectionSummaryBar.tsx
      ThemeProvider.tsx
      ThemeToggle.tsx
      WelcomeScreen.tsx
    hooks/
      useClipboardFeedback.ts
    stores/
      deviceStore.ts
      logStore.ts
      nicknameStore.ts
      shellStore.ts
    utils/
      cn.ts
      debug.ts
      deviceStatus.ts
      errorHandler.ts
      formatting.ts
      path.ts
      queries.ts

  features/
    dashboard/
      DashboardView.tsx
      ui/
      hooks/
    app-manager/
      AppManagerView.tsx
      debloater/
        ui/
        model/
        hooks/
        utils/
      installation/
        ui/
        hooks/
    file-explorer/
      FileExplorerView.tsx
      api/
        fileExplorerApi.ts
      model/
        fileExplorerTypes.ts
        fileExplorerConstants.ts
        fileExplorerState.ts
      hooks/
        useFileExplorerListing.ts
        useFileExplorerSelection.ts
        useFileExplorerHistory.ts
        useFileExplorerMutations.ts
        useFileExplorerKeyboard.ts
        useFileExplorerLayout.ts
      ui/
        FileExplorerLayout.tsx
        FileExplorerToolbar.tsx
        FileAddressBar.tsx
        DirectoryTree.tsx
        FileTable.tsx
        FileTableHeader.tsx
        FileRow.tsx
        CreateRow.tsx
        RenameInput.tsx
        FileContextMenu.tsx
        DeleteDialog.tsx
        EmptyDirectoryState.tsx
        LoadErrorState.tsx
      utils/
        fileExplorerSorting.ts
        fileExplorerPaths.ts
        fileExplorerValidation.ts
    flasher/
      FlasherView.tsx
      ui/
      hooks/
      model/
    utilities/
      UtilitiesView.tsx
      ui/
      hooks/
    payload-dumper/
      PayloadDumperView.tsx
      ui/
      hooks/
      model/
      utils/
    marketplace/
      MarketplaceView.tsx
      ui/
      hooks/
      model/
      utils/
    emulator/
      EmulatorView.tsx
      ui/
      hooks/
      model/

  test/
```

## Naming Rules

- Feature folders use kebab-case: `file-explorer`, `payload-dumper`, `app-manager`.
- React component files use PascalCase: `FileTable.tsx`, `DeleteDialog.tsx`.
- Hook files start with `use`: `useFileExplorerSelection.ts`.
- Store files end with `Store.ts`: `deviceStore.ts`, `marketplaceStore.ts`.
- Feature DTO and discriminated union files end in `Types.ts` only when they are feature-local. IPC DTOs stay in `src/desktop/models.ts`.
- Constants live in `*Constants.ts`; pure functions live in `utils/`.
- No file named `utils.ts` inside a feature. Use specific names like `fileExplorerSorting.ts`.
- No feature may import from another feature except through `src/shared` or `src/desktop`. If a feature-to-feature import appears necessary, move the shared unit to `src/shared`.
- `src/shared/components` is only for components used by at least two features or by the app shell.

## Import Migration Map

| Old import prefix | New import prefix |
|---|---|
| `@/components/ui/` | `@/shared/ui/` |
| `@/components/views/ViewFileExplorer` | `@/features/file-explorer/FileExplorerView` |
| `@/components/views/ViewDashboard` | `@/features/dashboard/DashboardView` |
| `@/components/views/ViewAppManager` | `@/features/app-manager/AppManagerView` |
| `@/components/views/ViewFlasher` | `@/features/flasher/FlasherView` |
| `@/components/views/ViewUtilities` | `@/features/utilities/UtilitiesView` |
| `@/components/views/ViewPayloadDumper` | `@/features/payload-dumper/PayloadDumperView` |
| `@/components/views/ViewMarketplace` | `@/features/marketplace/MarketplaceView` |
| `@/components/views/ViewEmulatorManager` | `@/features/emulator/EmulatorView` |
| `@/components/marketplace/` | `@/features/marketplace/ui/` |
| `@/components/payload-dumper/` | `@/features/payload-dumper/ui/` |
| `@/components/emulator-manager/` | `@/features/emulator/ui/` |
| `@/components/views/debloater/` | `@/features/app-manager/debloater/ui/` |
| `@/lib/desktop/` | `@/desktop/` |
| `@/lib/deviceStore` | `@/shared/stores/deviceStore` |
| `@/lib/logStore` | `@/shared/stores/logStore` |
| `@/lib/shellStore` | `@/shared/stores/shellStore` |
| `@/lib/nicknameStore` | `@/shared/stores/nicknameStore` |
| `@/lib/marketplaceStore` | `@/features/marketplace/model/marketplaceStore` |
| `@/lib/payloadDumperStore` | `@/features/payload-dumper/model/payloadDumperStore` |
| `@/lib/emulatorManagerStore` | `@/features/emulator/model/emulatorManagerStore` |
| `@/lib/debloatStore` | `@/features/app-manager/debloater/model/debloatStore` |
| `@/lib/utils` | `@/shared/utils/formatting` for formatters, `@/shared/utils/cn` for `cn` |
| `@/lib/debug` | `@/shared/utils/debug` |
| `@/lib/errorHandler` | `@/shared/utils/errorHandler` |
| `@/lib/deviceStatus` | `@/shared/utils/deviceStatus` |
| `@/lib/queries` | `@/shared/utils/queries` |

---

## Task 0: Baseline And Clean-Tree Gate

**Files:**
- Read: `git status --short`
- Read: `package.json`
- Read: `components.json`

- [ ] **Step 1: Check for uncommitted changes**

Run:

```powershell
git status --short
```

Expected: Either no output or only changes intentionally included in the first architecture commit.

- [ ] **Step 2: If the delete-dialog fix is still dirty, commit it before architecture work**

Run:

```powershell
git add src/components/views/ViewFileExplorer.tsx src/test/ViewFileExplorer.test.tsx
git commit -m "fix: constrain file explorer delete dialog text"
```

Expected: commit succeeds. If there are no matching changes, skip this step and write in the task note: `Delete dialog fix already committed`.

- [ ] **Step 3: Verify baseline before moving files**

Run:

```powershell
bun run format:check
bun run lint:web
bun run test
bun run build
```

Expected:

```text
format:check exits 0
lint:web exits 0
25 test files pass
163 tests pass
vite build exits 0
```

- [ ] **Step 4: Commit baseline note if any test fixture changed**

Run:

```powershell
git status --short
```

Expected: no output. If output is not empty, inspect with `git diff` and commit only intentional baseline files.

---

## Task 1: Add Frontend Architecture Guard Tests

**Files:**
- Create: `src/test/frontendArchitecture.test.ts`
- Modify: none

- [ ] **Step 1: Write the failing architecture test**

Create `src/test/frontendArchitecture.test.ts` with this content:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');

const sourceExtensions = new Set(['.ts', '.tsx']);
const shadcnPrimitiveDir = path.join(srcRoot, 'shared', 'ui');
const allowedLargeFiles = new Set([
  path.join(srcRoot, 'shared', 'ui', 'sidebar.tsx'),
  path.join(srcRoot, 'desktop', 'backend.ts'),
  path.join(srcRoot, 'desktop', 'models.ts'),
]);

function collectSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (sourceExtensions.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

describe('frontend architecture boundaries', () => {
  it('uses the strict top-level frontend folders', () => {
    expect(existsSync(path.join(srcRoot, 'app'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'desktop'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'features'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'shared'))).toBe(true);
    expect(existsSync(path.join(srcRoot, 'components', 'views'))).toBe(false);
    expect(existsSync(path.join(srcRoot, 'lib'))).toBe(false);
  });

  it('keeps Tauri invoke calls inside the desktop boundary', () => {
    const offenders = collectSourceFiles(srcRoot).filter((filePath) => {
      const text = readFileSync(filePath, 'utf8');
      return (
        text.includes("@tauri-apps/api/core") &&
        toPosixPath(filePath) !== toPosixPath(path.join(srcRoot, 'desktop', 'backend.ts'))
      );
    });

    expect(offenders.map((filePath) => toPosixPath(path.relative(repoRoot, filePath)))).toEqual([]);
  });

  it('does not import from legacy frontend folders', () => {
    const legacyPatterns = [
      '@/components/views',
      '@/components/marketplace',
      '@/components/payload-dumper',
      '@/components/emulator-manager',
      '@/lib/',
    ];

    const offenders = collectSourceFiles(srcRoot).flatMap((filePath) => {
      const text = readFileSync(filePath, 'utf8');
      return legacyPatterns
        .filter((pattern) => text.includes(pattern))
        .map((pattern) => `${toPosixPath(path.relative(repoRoot, filePath))}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps feature implementation files small enough to review', () => {
    const offenders = collectSourceFiles(path.join(srcRoot, 'features'))
      .filter((filePath) => !filePath.startsWith(shadcnPrimitiveDir))
      .filter((filePath) => !allowedLargeFiles.has(filePath))
      .map((filePath) => {
        const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).length;
        return { filePath, lines };
      })
      .filter(({ lines }) => lines > 300)
      .map(({ filePath, lines }) => `${toPosixPath(path.relative(repoRoot, filePath))}: ${lines}`);

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails on the current architecture**

Run:

```powershell
bun vitest run src/test/frontendArchitecture.test.ts
```

Expected: FAIL because `src/app`, `src/shared`, and `src/features` are not fully migrated yet, and old imports still exist.

- [ ] **Step 3: Commit the failing architecture test**

Run:

```powershell
git add src/test/frontendArchitecture.test.ts
git commit -m "test: add frontend architecture boundary checks"
```

Expected: commit succeeds. This commit intentionally contains a failing test that guides the refactor. Do not run the full suite in CI until the architecture migration tasks make it green.

---

## Task 2: Move App Shell Into `src/app`

**Files:**
- Move: `src/App.tsx` → `src/app/App.tsx`
- Move: `src/components/MainLayout.tsx` → `src/app/shell/MainLayout.tsx`
- Move: `src/components/AppSidebar.tsx` → `src/app/shell/AppSidebar.tsx`
- Move: `src/components/BottomPanel.tsx` → `src/app/shell/BottomPanel/BottomPanel.tsx`
- Move: `src/components/LogsPanel.tsx` → `src/app/shell/BottomPanel/LogsPanel.tsx`
- Move: `src/components/ShellPanel.tsx` → `src/app/shell/BottomPanel/ShellPanel.tsx`
- Modify: `src/main.tsx`
- Modify: imports in moved shell files

- [ ] **Step 1: Run impact analysis**

Run GitNexus:

```text
impact target=MainLayout direction=upstream repo=adb-gui-next
impact target=AppSidebar direction=upstream repo=adb-gui-next
impact target=BottomPanel direction=upstream repo=adb-gui-next
```

Expected: risk is LOW or MEDIUM. If HIGH or CRITICAL, pause and inspect direct callers before moving.

- [ ] **Step 2: Move shell files**

Run:

```powershell
New-Item -ItemType Directory -Force src\app\shell\BottomPanel
git mv src\App.tsx src\app\App.tsx
git mv src\components\MainLayout.tsx src\app\shell\MainLayout.tsx
git mv src\components\AppSidebar.tsx src\app\shell\AppSidebar.tsx
git mv src\components\BottomPanel.tsx src\app\shell\BottomPanel\BottomPanel.tsx
git mv src\components\LogsPanel.tsx src\app\shell\BottomPanel\LogsPanel.tsx
git mv src\components\ShellPanel.tsx src\app\shell\BottomPanel\ShellPanel.tsx
```

- [ ] **Step 3: Update `src/main.tsx` import**

Change:

```ts
import App from './App';
```

To:

```ts
import App from '@/app/App';
```

- [ ] **Step 4: Update shell-local imports**

In `src/app/App.tsx`, import `MainLayout` from:

```ts
import { MainLayout } from '@/app/shell/MainLayout';
```

In `src/app/shell/MainLayout.tsx`, import shell files from:

```ts
import { AppSidebar } from '@/app/shell/AppSidebar';
import { BottomPanel } from '@/app/shell/BottomPanel/BottomPanel';
```

In `src/app/shell/BottomPanel/BottomPanel.tsx`, import panels from:

```ts
import { LogsPanel } from '@/app/shell/BottomPanel/LogsPanel';
import { ShellPanel } from '@/app/shell/BottomPanel/ShellPanel';
```

- [ ] **Step 5: Run focused verification**

Run:

```powershell
bun run lint:web
bun run build
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/app src/main.tsx
git commit -m "refactor: move app shell into app folder"
```

---

## Task 3: Move Desktop IPC Boundary Into `src/desktop`

**Files:**
- Move: `src/lib/desktop/backend.ts` → `src/desktop/backend.ts`
- Move: `src/lib/desktop/runtime.ts` → `src/desktop/runtime.ts`
- Move: `src/lib/desktop/models.ts` → `src/desktop/models.ts`
- Modify: every import of `@/lib/desktop/*` and `../../lib/desktop/*`

- [ ] **Step 1: Run impact analysis**

Run GitNexus:

```text
impact target=MarketplaceSearch file_path=src/lib/desktop/backend.ts direction=upstream repo=adb-gui-next
impact target=backend.ts direction=upstream repo=adb-gui-next
```

Expected: HIGH fan-out is possible because this file is central. Proceed only because this is a path move with no behavior change.

- [ ] **Step 2: Move desktop files**

Run:

```powershell
New-Item -ItemType Directory -Force src\desktop
git mv src\lib\desktop\backend.ts src\desktop\backend.ts
git mv src\lib\desktop\runtime.ts src\desktop\runtime.ts
git mv src\lib\desktop\models.ts src\desktop\models.ts
```

- [ ] **Step 3: Replace imports**

Apply these replacements across `src/**/*.ts` and `src/**/*.tsx`:

```text
@/lib/desktop/backend -> @/desktop/backend
@/lib/desktop/runtime -> @/desktop/runtime
@/lib/desktop/models -> @/desktop/models
../../lib/desktop/backend -> @/desktop/backend
../../lib/desktop/runtime -> @/desktop/runtime
../../lib/desktop/models -> @/desktop/models
../lib/desktop/backend -> @/desktop/backend
../lib/desktop/runtime -> @/desktop/runtime
../lib/desktop/models -> @/desktop/models
```

- [ ] **Step 4: Verify no legacy desktop imports remain**

Run:

```powershell
rg -n "lib/desktop|\\.\\./.*lib/desktop" src
```

Expected: no output.

- [ ] **Step 5: Run focused verification**

Run:

```powershell
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src
git commit -m "refactor: move desktop IPC boundary"
```

---

## Task 4: Move shadcn Primitives And Shared Utilities

**Files:**
- Move: `src/components/ui/*` → `src/shared/ui/*`
- Move: `src/lib/utils.ts` → split into `src/shared/utils/cn.ts` and `src/shared/utils/formatting.ts`
- Modify: `components.json`
- Modify: all imports from `@/components/ui/*` and `@/lib/utils`
- Test: `src/test/utils.test.ts`

- [ ] **Step 1: Move UI primitives**

Run:

```powershell
New-Item -ItemType Directory -Force src\shared\ui
Get-ChildItem src\components\ui -File | ForEach-Object { git mv $_.FullName (Join-Path "src\shared\ui" $_.Name) }
```

- [ ] **Step 2: Split `src/lib/utils.ts`**

Create `src/shared/utils/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Create `src/shared/utils/formatting.ts` by moving these exports from the old `src/lib/utils.ts`:

```ts
export function formatBytes(raw: string): string {
  const bytes = Number.parseInt(raw, 10);
  if (Number.isNaN(bytes)) {
    return raw;
  }
  return formatFileSize(bytes);
}

export function formatBytesNum(bytes: number): string {
  return formatFileSize(bytes);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) {
    return '—';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatRating(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(1);
}

export function formatDisplayDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
```

Remove `src/lib/utils.ts` after every import is updated.

- [ ] **Step 3: Update shadcn config**

Change `components.json` aliases to:

```json
{
  "aliases": {
    "components": "@/shared/components",
    "utils": "@/shared/utils/cn",
    "ui": "@/shared/ui",
    "lib": "@/shared",
    "hooks": "@/shared/hooks"
  }
}
```

Keep existing `tailwind.css` as `src/styles/global.css`.

- [ ] **Step 4: Update imports**

Apply replacements:

```text
@/components/ui/ -> @/shared/ui/
@/lib/utils -> @/shared/utils/formatting
```

Then fix every file that imports `cn` from formatting. Those imports must use:

```ts
import { cn } from '@/shared/utils/cn';
```

Formatting imports must use:

```ts
import { formatBytes, formatBytesNum, formatDisplayDate, formatFileSize, formatRating } from '@/shared/utils/formatting';
```

- [ ] **Step 5: Verify no old UI imports remain**

Run:

```powershell
rg -n "@/components/ui|@/lib/utils" src components.json
```

Expected: no output.

- [ ] **Step 6: Run tests and build**

Run:

```powershell
bun run format:web:check
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src components.json
git commit -m "refactor: move shared ui primitives and utilities"
```

---

## Task 5: Move Shared Components, Stores, And Utilities

**Files:**
- Move root shared components into `src/shared/components/`
- Move app-wide stores into `src/shared/stores/`
- Move common utility files into `src/shared/utils/`
- Modify imports across `src`

- [ ] **Step 1: Move shared components**

Run:

```powershell
New-Item -ItemType Directory -Force src\shared\components
git mv src\components\CheckboxItem.tsx src\shared\components\CheckboxItem.tsx
git mv src\components\ConnectedDevicesCard.tsx src\shared\components\ConnectedDevicesCard.tsx
git mv src\components\CopyButton.tsx src\shared\components\CopyButton.tsx
git mv src\components\DeviceSwitcher.tsx src\shared\components\DeviceSwitcher.tsx
git mv src\components\DropZone.tsx src\shared\components\DropZone.tsx
git mv src\components\EditNicknameDialog.tsx src\shared\components\EditNicknameDialog.tsx
git mv src\components\EmptyState.tsx src\shared\components\EmptyState.tsx
git mv src\components\FileSelector.tsx src\shared\components\FileSelector.tsx
git mv src\components\LoadingButton.tsx src\shared\components\LoadingButton.tsx
git mv src\components\RemoteUrlPanel.tsx src\shared\components\RemoteUrlPanel.tsx
git mv src\components\SectionHeader.tsx src\shared\components\SectionHeader.tsx
git mv src\components\SelectionSummaryBar.tsx src\shared\components\SelectionSummaryBar.tsx
git mv src\components\ThemeProvider.tsx src\shared\components\ThemeProvider.tsx
git mv src\components\ThemeToggle.tsx src\shared\components\ThemeToggle.tsx
git mv src\components\WelcomeScreen.tsx src\shared\components\WelcomeScreen.tsx
```

- [ ] **Step 2: Move shared stores**

Run:

```powershell
New-Item -ItemType Directory -Force src\shared\stores
git mv src\lib\deviceStore.ts src\shared\stores\deviceStore.ts
git mv src\lib\logStore.ts src\shared\stores\logStore.ts
git mv src\lib\nicknameStore.ts src\shared\stores\nicknameStore.ts
git mv src\lib\shellStore.ts src\shared\stores\shellStore.ts
```

- [ ] **Step 3: Move shared utility files**

Run:

```powershell
git mv src\lib\debug.ts src\shared\utils\debug.ts
git mv src\lib\deviceStatus.ts src\shared\utils\deviceStatus.ts
git mv src\lib\errorHandler.ts src\shared\utils\errorHandler.ts
git mv src\lib\queries.ts src\shared\utils\queries.ts
```

- [ ] **Step 4: Update imports**

Apply replacements:

```text
@/components/CheckboxItem -> @/shared/components/CheckboxItem
@/components/ConnectedDevicesCard -> @/shared/components/ConnectedDevicesCard
@/components/CopyButton -> @/shared/components/CopyButton
@/components/DeviceSwitcher -> @/shared/components/DeviceSwitcher
@/components/DropZone -> @/shared/components/DropZone
@/components/EditNicknameDialog -> @/shared/components/EditNicknameDialog
@/components/EmptyState -> @/shared/components/EmptyState
@/components/FileSelector -> @/shared/components/FileSelector
@/components/LoadingButton -> @/shared/components/LoadingButton
@/components/RemoteUrlPanel -> @/shared/components/RemoteUrlPanel
@/components/SectionHeader -> @/shared/components/SectionHeader
@/components/SelectionSummaryBar -> @/shared/components/SelectionSummaryBar
@/components/ThemeProvider -> @/shared/components/ThemeProvider
@/components/ThemeToggle -> @/shared/components/ThemeToggle
@/components/WelcomeScreen -> @/shared/components/WelcomeScreen
@/lib/deviceStore -> @/shared/stores/deviceStore
@/lib/logStore -> @/shared/stores/logStore
@/lib/nicknameStore -> @/shared/stores/nicknameStore
@/lib/shellStore -> @/shared/stores/shellStore
@/lib/debug -> @/shared/utils/debug
@/lib/deviceStatus -> @/shared/utils/deviceStatus
@/lib/errorHandler -> @/shared/utils/errorHandler
@/lib/queries -> @/shared/utils/queries
```

- [ ] **Step 5: Verify old shared imports are gone**

Run:

```powershell
rg -n "@/components/(CheckboxItem|ConnectedDevicesCard|CopyButton|DeviceSwitcher|DropZone|EditNicknameDialog|EmptyState|FileSelector|LoadingButton|RemoteUrlPanel|SectionHeader|SelectionSummaryBar|ThemeProvider|ThemeToggle|WelcomeScreen)|@/lib/(deviceStore|logStore|nicknameStore|shellStore|debug|deviceStatus|errorHandler|queries)" src
```

Expected: no output.

- [ ] **Step 6: Verify**

Run:

```powershell
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src
git commit -m "refactor: move shared frontend modules"
```

---

## Task 6: Move Existing Modular Features

**Files:**
- Move marketplace UI/hooks/store into `src/features/marketplace/`
- Move payload dumper UI/hooks/store into `src/features/payload-dumper/`
- Move emulator UI/store into `src/features/emulator/`
- Move app manager debloater and installation tabs into `src/features/app-manager/`
- Modify app shell view imports
- Modify tests

- [ ] **Step 1: Move Marketplace**

Run:

```powershell
New-Item -ItemType Directory -Force src\features\marketplace\ui src\features\marketplace\hooks src\features\marketplace\model src\features\marketplace\utils
git mv src\components\views\ViewMarketplace.tsx src\features\marketplace\MarketplaceView.tsx
Get-ChildItem src\components\marketplace -File | ForEach-Object { git mv $_.FullName (Join-Path "src\features\marketplace\ui" $_.Name) }
Get-ChildItem src\lib\marketplace -File | ForEach-Object { git mv $_.FullName (Join-Path "src\features\marketplace\hooks" $_.Name) }
git mv src\lib\marketplaceStore.ts src\features\marketplace\model\marketplaceStore.ts
```

- [ ] **Step 2: Move Payload Dumper**

Run:

```powershell
New-Item -ItemType Directory -Force src\features\payload-dumper\ui src\features\payload-dumper\hooks src\features\payload-dumper\model src\features\payload-dumper\utils
git mv src\components\views\ViewPayloadDumper.tsx src\features\payload-dumper\PayloadDumperView.tsx
Get-ChildItem src\components\payload-dumper -File | ForEach-Object { git mv $_.FullName (Join-Path "src\features\payload-dumper\ui" $_.Name) }
Get-ChildItem src\lib\payload-dumper -File | ForEach-Object { git mv $_.FullName (Join-Path "src\features\payload-dumper\hooks" $_.Name) }
git mv src\lib\payloadDumperStore.ts src\features\payload-dumper\model\payloadDumperStore.ts
```

- [ ] **Step 3: Move Emulator**

Run:

```powershell
New-Item -ItemType Directory -Force src\features\emulator\ui src\features\emulator\model src\features\emulator\hooks
git mv src\components\views\ViewEmulatorManager.tsx src\features\emulator\EmulatorView.tsx
Get-ChildItem src\components\emulator-manager -File | ForEach-Object { git mv $_.FullName (Join-Path "src\features\emulator\ui" $_.Name) }
git mv src\lib\emulatorManagerStore.ts src\features\emulator\model\emulatorManagerStore.ts
```

- [ ] **Step 4: Move App Manager**

Run:

```powershell
New-Item -ItemType Directory -Force src\features\app-manager\debloater\ui src\features\app-manager\debloater\model src\features\app-manager\debloater\utils src\features\app-manager\installation\ui src\features\app-manager\installation\hooks
git mv src\components\views\ViewAppManager.tsx src\features\app-manager\AppManagerView.tsx
git mv src\components\views\debloater\DebloaterTab.tsx src\features\app-manager\debloater\ui\DebloaterTab.tsx
git mv src\components\views\debloater\DescriptionPanel.tsx src\features\app-manager\debloater\ui\DescriptionPanel.tsx
git mv src\components\views\debloater\ReviewSelectionDialog.tsx src\features\app-manager\debloater\ui\ReviewSelectionDialog.tsx
git mv src\components\views\debloater\debloaterUtils.ts src\features\app-manager\debloater\utils\debloaterUtils.ts
git mv src\components\views\debloater\InstallationTab.tsx src\features\app-manager\installation\ui\InstallationTab.tsx
git mv src\lib\debloatStore.ts src\features\app-manager\debloater\model\debloatStore.ts
```

- [ ] **Step 5: Update imports using the migration map**

Update imports in `src/app/shell/MainLayout.tsx`:

```ts
import { AppManagerView } from '@/features/app-manager/AppManagerView';
import { EmulatorView } from '@/features/emulator/EmulatorView';
import { MarketplaceView } from '@/features/marketplace/MarketplaceView';
import { PayloadDumperView } from '@/features/payload-dumper/PayloadDumperView';
```

Update internal feature imports to their new concrete paths. Example:

```ts
import { AppCard } from '@/features/marketplace/ui/AppCard';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { useMarketplaceSearch } from '@/features/marketplace/hooks/useMarketplaceSearch';
```

- [ ] **Step 6: Verify old modular feature imports are gone**

Run:

```powershell
rg -n "@/components/(marketplace|payload-dumper|emulator-manager)|@/components/views/debloater|@/lib/(marketplaceStore|payloadDumperStore|emulatorManagerStore|debloatStore|marketplace|payload-dumper)" src
```

Expected: no output.

- [ ] **Step 7: Verify**

Run:

```powershell
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src
git commit -m "refactor: move existing features into feature folders"
```

---

## Task 7: Create File Explorer Model, API, And Pure Utilities

**Files:**
- Create: `src/features/file-explorer/model/fileExplorerTypes.ts`
- Create: `src/features/file-explorer/model/fileExplorerConstants.ts`
- Create: `src/features/file-explorer/api/fileExplorerApi.ts`
- Create: `src/features/file-explorer/utils/fileExplorerSorting.ts`
- Create: `src/features/file-explorer/utils/fileExplorerValidation.ts`
- Create: `src/features/file-explorer/utils/fileExplorerPaths.ts`
- Modify: `src/test/ViewFileExplorer.test.tsx` or move to `src/test/fileExplorer.test.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus:

```text
impact target=ViewFileExplorer file_path=src/components/views/ViewFileExplorer.tsx direction=upstream repo=adb-gui-next
impact target=sortEntries file_path=src/components/views/ViewFileExplorer.tsx direction=upstream repo=adb-gui-next
```

Expected: `ViewFileExplorer` risk LOW because only `MainLayout` calls it. `sortEntries` should only be used by File Explorer.

- [ ] **Step 2: Write pure utility tests first**

Create `src/test/fileExplorerUtils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sortFileEntries } from '@/features/file-explorer/utils/fileExplorerSorting';
import { isValidDevicePath, validateNewEntryName } from '@/features/file-explorer/utils/fileExplorerValidation';
import type { FileExplorerEntry } from '@/features/file-explorer/model/fileExplorerTypes';

const file = (name: string, size: string, date = '2026-05-10', time = '19:17'): FileExplorerEntry => ({
  date,
  linkTarget: '',
  name,
  permissions: '-rw-r--r--',
  size,
  time,
  type: 'File',
});

const dir = (name: string): FileExplorerEntry => ({
  date: '2026-05-10',
  linkTarget: '',
  name,
  permissions: 'drwxr-xr-x',
  size: '0',
  time: '19:17',
  type: 'Directory',
});

describe('file explorer utilities', () => {
  it('keeps directories before files while sorting by name', () => {
    const result = sortFileEntries([file('z.apk', '100'), dir('Android'), file('a.apk', '50')], 'name', 'asc');
    expect(result.map((entry) => entry.name)).toEqual(['Android', 'a.apk', 'z.apk']);
  });

  it('sorts file sizes numerically', () => {
    const result = sortFileEntries([file('large.bin', '1000'), file('small.bin', '9')], 'size', 'asc');
    expect(result.map((entry) => entry.name)).toEqual(['small.bin', 'large.bin']);
  });

  it('rejects unsafe device paths', () => {
    expect(isValidDevicePath('/sdcard/Download/')).toBe(true);
    expect(isValidDevicePath('../sdcard')).toBe(false);
    expect(isValidDevicePath('sdcard')).toBe(false);
  });

  it('validates new file and folder names', () => {
    expect(validateNewEntryName('notes.txt')).toEqual({ ok: true, name: 'notes.txt' });
    expect(validateNewEntryName('..')).toEqual({ ok: false, error: 'Name cannot be . or ..' });
    expect(validateNewEntryName('bad/name')).toEqual({ ok: false, error: 'Name contains invalid characters' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails because modules do not exist**

Run:

```powershell
bun vitest run src/test/fileExplorerUtils.test.ts
```

Expected: FAIL with module resolution errors for `@/features/file-explorer/*`.

- [ ] **Step 4: Create model and utility files**

Create `src/features/file-explorer/model/fileExplorerTypes.ts`:

```ts
import type { backend } from '@/desktop/models';

export type FileExplorerEntry = backend.FileEntry;
export type LoadError = 'permission_denied' | 'no_device' | 'unknown' | null;
export type CreatingType = 'file' | 'folder' | null;
export type SortField = 'name' | 'size' | 'date';
export type SortDir = 'asc' | 'desc';

export interface ValidationResult {
  ok: boolean;
  name?: string;
  error?: string;
}
```

Create `src/features/file-explorer/model/fileExplorerConstants.ts`:

```ts
export const MIN_LEFT_WIDTH = 180;
export const MAX_LEFT_WIDTH = 420;
export const DEFAULT_LEFT_WIDTH = 180;
export const MAX_HISTORY = 50;
export const RESPONSIVE_COLLAPSE_WIDTH = 1024;
export const PHANTOM_ROW_HEIGHT = 40;
export const FILE_TABLE_COLUMNS = '40px minmax(16rem, 1fr) 8rem 8rem 6rem';
export const FILE_TABLE_COLUMNS_WITH_SELECTION = '40px 40px minmax(16rem, 1fr) 8rem 8rem 6rem';
```

Create `src/features/file-explorer/utils/fileExplorerValidation.ts`:

```ts
import type { ValidationResult } from '@/features/file-explorer/model/fileExplorerTypes';

const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
const RESERVED_NAMES = /^\.{1,2}$/;

export function isValidDevicePath(path: string | null): path is string {
  if (!path || typeof path !== 'string') {
    return false;
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }
  if (trimmed.includes('..')) {
    return false;
  }
  return true;
}

export function validateNewEntryName(rawName: string): ValidationResult {
  const name = rawName.trim();
  if (!name) {
    return { ok: false, error: 'Name is required' };
  }
  if (RESERVED_NAMES.test(name)) {
    return { ok: false, error: 'Name cannot be . or ..' };
  }
  if (FORBIDDEN_CHARS.test(name)) {
    return { ok: false, error: 'Name contains invalid characters' };
  }
  return { ok: true, name };
}
```

Create `src/features/file-explorer/utils/fileExplorerSorting.ts`:

```ts
import type { FileExplorerEntry, SortDir, SortField } from '@/features/file-explorer/model/fileExplorerTypes';

function isDirectoryLike(entry: FileExplorerEntry): boolean {
  return entry.type === 'Directory' || entry.type === 'Symlink';
}

export function sortFileEntries(
  entries: FileExplorerEntry[],
  field: SortField,
  dir: SortDir,
): FileExplorerEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = isDirectoryLike(a);
    const bIsDir = isDirectoryLike(b);
    if (aIsDir && !bIsDir) {
      return -1;
    }
    if (!aIsDir && bIsDir) {
      return 1;
    }

    if (field === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    }
    if (field === 'size') {
      const aNum = Number.parseInt(a.size, 10);
      const bNum = Number.parseInt(b.size, 10);
      const cmp = Number.isNaN(aNum) || Number.isNaN(bNum) ? a.size.localeCompare(b.size) : aNum - bNum;
      return dir === 'asc' ? cmp : -cmp;
    }
    const cmp = `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
    return dir === 'asc' ? cmp : -cmp;
  });
}
```

Create `src/features/file-explorer/utils/fileExplorerPaths.ts`:

```ts
import path from 'path-browserify';

export function joinDevicePath(basePath: string, name: string): string {
  return path.posix.join(basePath, name);
}

export function joinDeviceDirectory(basePath: string, name: string): string {
  return `${path.posix.join(basePath, name)}/`;
}

export function parentDevicePath(currentPath: string): string {
  if (currentPath === '/') {
    return '/';
  }
  return `${path.posix.join(currentPath, '..')}/`;
}
```

Create `src/features/file-explorer/api/fileExplorerApi.ts`:

```ts
import {
  CreateDirectory,
  CreateFile,
  DeleteFiles,
  ListFiles,
  PullFile,
  PushFile,
  RenameFile,
  SelectDirectoryForPull,
  SelectDirectoryToPush,
  SelectFileToPush,
  SelectSaveDirectory,
} from '@/desktop/backend';

export const fileExplorerApi = {
  createDirectory: CreateDirectory,
  createFile: CreateFile,
  deleteFiles: DeleteFiles,
  listFiles: ListFiles,
  pullFile: PullFile,
  pushFile: PushFile,
  renameFile: RenameFile,
  selectDirectoryForPull: SelectDirectoryForPull,
  selectDirectoryToPush: SelectDirectoryToPush,
  selectFileToPush: SelectFileToPush,
  selectSaveDirectory: SelectSaveDirectory,
};
```

- [ ] **Step 5: Replace local utilities in current File Explorer**

In the current `ViewFileExplorer` file, remove local definitions for:

```text
FileEntry
LoadError
CreatingType
SortField
SortDir
MIN_LEFT_WIDTH
MAX_LEFT_WIDTH
DEFAULT_LEFT_WIDTH
FORBIDDEN_CHARS
RESERVED_NAMES
MAX_HISTORY
RESPONSIVE_COLLAPSE_WIDTH
PHANTOM_ROW_HEIGHT
FILE_TABLE_COLUMNS
FILE_TABLE_COLUMNS_WITH_SELECTION
isValidDevicePath
sortEntries
```

Import replacements:

```ts
import {
  DEFAULT_LEFT_WIDTH,
  FILE_TABLE_COLUMNS,
  FILE_TABLE_COLUMNS_WITH_SELECTION,
  MAX_HISTORY,
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
  PHANTOM_ROW_HEIGHT,
  RESPONSIVE_COLLAPSE_WIDTH,
} from '@/features/file-explorer/model/fileExplorerConstants';
import type {
  CreatingType,
  FileExplorerEntry,
  LoadError,
  SortDir,
  SortField,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { sortFileEntries } from '@/features/file-explorer/utils/fileExplorerSorting';
import { isValidDevicePath, validateNewEntryName } from '@/features/file-explorer/utils/fileExplorerValidation';
```

Replace `FileEntry` with `FileExplorerEntry`.
Replace `sortEntries(...)` with `sortFileEntries(...)`.
Replace create-name validation blocks with `validateNewEntryName(createName)`.

- [ ] **Step 6: Run utility tests**

Run:

```powershell
bun vitest run src/test/fileExplorerUtils.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run feature tests**

Run:

```powershell
bun vitest run src/test/ViewFileExplorer.test.tsx src/test/fileExplorerUtils.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src/features/file-explorer src/test src/components/views/ViewFileExplorer.tsx
git commit -m "refactor: extract file explorer model and utilities"
```

---

## Task 8: Extract File Explorer Hooks

**Files:**
- Create: `src/features/file-explorer/hooks/useFileExplorerSelection.ts`
- Create: `src/features/file-explorer/hooks/useFileExplorerHistory.ts`
- Create: `src/features/file-explorer/hooks/useFileExplorerListing.ts`
- Create: `src/features/file-explorer/hooks/useFileExplorerMutations.ts`
- Create: `src/features/file-explorer/hooks/useFileExplorerKeyboard.ts`
- Modify: current File Explorer view
- Test: `src/test/fileExplorerHooks.test.tsx`

- [ ] **Step 1: Write hook behavior tests**

Create `src/test/fileExplorerHooks.test.tsx` with focused tests for selection and history:

```tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFileExplorerHistory } from '@/features/file-explorer/hooks/useFileExplorerHistory';
import { useFileExplorerSelection } from '@/features/file-explorer/hooks/useFileExplorerSelection';

describe('file explorer hooks', () => {
  it('enters multi-select mode when selecting a file', () => {
    const { result } = renderHook(() => useFileExplorerSelection());

    act(() => {
      result.current.selectOne('Download/app.apk');
    });

    expect(result.current.isMultiSelectMode).toBe(true);
    expect(Array.from(result.current.selectedNames)).toEqual(['Download/app.apk']);
  });

  it('clears selection and exits multi-select mode', () => {
    const { result } = renderHook(() => useFileExplorerSelection());

    act(() => {
      result.current.selectOne('Download/app.apk');
      result.current.clearSelection();
    });

    expect(result.current.isMultiSelectMode).toBe(false);
    expect(result.current.selectedNames.size).toBe(0);
  });

  it('tracks back and forward history without duplicating refreshes', () => {
    const { result } = renderHook(() => useFileExplorerHistory('/sdcard/'));

    act(() => {
      result.current.pushPath('/sdcard/Download/');
      result.current.pushPath('/sdcard/Download/');
    });

    expect(result.current.navHistory).toEqual(['/sdcard/', '/sdcard/Download/']);
    expect(result.current.canGoBack).toBe(true);
    expect(result.current.canGoForward).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify hooks do not exist**

Run:

```powershell
bun vitest run src/test/fileExplorerHooks.test.tsx
```

Expected: FAIL with module resolution errors.

- [ ] **Step 3: Implement `useFileExplorerSelection`**

Create `src/features/file-explorer/hooks/useFileExplorerSelection.ts`:

```ts
import { useCallback, useMemo, useState } from 'react';

export function useFileExplorerSelection() {
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const selectedCount = selectedNames.size;
  const hasSelection = selectedCount > 0;

  const clearSelection = useCallback(() => {
    setSelectedNames(new Set());
    setIsMultiSelectMode(false);
  }, []);

  const selectOne = useCallback((name: string) => {
    setSelectedNames(new Set([name]));
    setIsMultiSelectMode(true);
  }, []);

  const toggleName = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      if (next.size === 0) {
        setIsMultiSelectMode(false);
      } else {
        setIsMultiSelectMode(true);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((names: string[]) => {
    setSelectedNames(new Set(names));
    setIsMultiSelectMode(names.length > 0);
  }, []);

  return useMemo(
    () => ({
      clearSelection,
      hasSelection,
      isMultiSelectMode,
      selectAll,
      selectedCount,
      selectedNames,
      selectOne,
      setIsMultiSelectMode,
      setSelectedNames,
      toggleName,
    }),
    [
      clearSelection,
      hasSelection,
      isMultiSelectMode,
      selectAll,
      selectedCount,
      selectedNames,
      selectOne,
      toggleName,
    ],
  );
}
```

- [ ] **Step 4: Implement `useFileExplorerHistory`**

Create `src/features/file-explorer/hooks/useFileExplorerHistory.ts`:

```ts
import { useCallback, useMemo, useRef, useState } from 'react';
import { MAX_HISTORY } from '@/features/file-explorer/model/fileExplorerConstants';

export function useFileExplorerHistory(initialPath: string) {
  const [navHistory, setNavHistory] = useState<string[]>([initialPath]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;

  const pushPath = useCallback((targetPath: string) => {
    const currentIdx = historyIndexRef.current;
    setNavHistory((prev) => {
      const truncated = prev.slice(0, currentIdx + 1);
      if (truncated[truncated.length - 1] === targetPath) {
        return truncated;
      }
      const next = [...truncated, targetPath];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    const newIdx = Math.min(currentIdx + 1, MAX_HISTORY - 1);
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);
  }, []);

  const moveBack = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx <= 0) {
      return null;
    }
    const nextIndex = currentIdx - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    return navHistory[nextIndex] ?? null;
  }, [navHistory]);

  const moveForward = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    const nextIndex = currentIdx + 1;
    const targetPath = navHistory[nextIndex];
    if (!targetPath) {
      return null;
    }
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    return targetPath;
  }, [navHistory]);

  return useMemo(
    () => ({
      canGoBack,
      canGoForward,
      historyIndex,
      historyIndexRef,
      moveBack,
      moveForward,
      navHistory,
      pushPath,
    }),
    [canGoBack, canGoForward, historyIndex, moveBack, moveForward, navHistory, pushPath],
  );
}
```

- [ ] **Step 5: Create listing, mutation, and keyboard hooks by moving existing logic**

Move the existing logic without changing behavior:

```text
useFileExplorerListing.ts:
- fileList
- visibleList sorting/filtering
- loadError
- loadFiles stable callback
- fileListRef
- currentPathRef
- selectedSerialRef
- loadRequestIdRef

useFileExplorerMutations.ts:
- create
- rename
- delete
- push/import
- pull/export
- toast/log/error handling

useFileExplorerKeyboard.ts:
- Ctrl+A
- Ctrl+F
- Ctrl+N
- Ctrl+Shift+N
- F2
- Delete
- Escape
- Alt+Left
- Alt+Right
```

Each hook must return plain data and callbacks. UI components must not import desktop API wrappers directly.

- [ ] **Step 6: Run hook tests**

Run:

```powershell
bun vitest run src/test/fileExplorerHooks.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run File Explorer tests**

Run:

```powershell
bun vitest run src/test/ViewFileExplorer.test.tsx src/test/fileExplorerHooks.test.tsx src/test/fileExplorerUtils.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src/features/file-explorer src/test src/components/views/ViewFileExplorer.tsx
git commit -m "refactor: extract file explorer hooks"
```

---

## Task 9: Split File Explorer UI Components

**Files:**
- Create UI files under `src/features/file-explorer/ui/`
- Move: `src/components/DirectoryTree.tsx` → `src/features/file-explorer/ui/DirectoryTree.tsx`
- Move/rename: `src/components/views/ViewFileExplorer.tsx` → `src/features/file-explorer/FileExplorerView.tsx`
- Modify: app shell imports
- Modify: tests

- [ ] **Step 1: Move the view file**

Run:

```powershell
New-Item -ItemType Directory -Force src\features\file-explorer\ui
git mv src\components\views\ViewFileExplorer.tsx src\features\file-explorer\FileExplorerView.tsx
git mv src\components\DirectoryTree.tsx src\features\file-explorer\ui\DirectoryTree.tsx
```

- [ ] **Step 2: Create `DeleteDialog.tsx`**

Create `src/features/file-explorer/ui/DeleteDialog.tsx`:

```tsx
import { File, Folder, Link, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { buttonVariants } from '@/shared/ui/button-variants';
import type { FileExplorerEntry } from '@/features/file-explorer/model/fileExplorerTypes';

interface DeleteDialogProps {
  filesToDelete: string[];
  fileList: FileExplorerEntry[];
  isDeleting: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDialog({
  filesToDelete,
  fileList,
  isDeleting,
  open,
  onConfirm,
  onOpenChange,
}: DeleteDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="min-w-0 overflow-hidden">
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">
            {filesToDelete.length === 1
              ? `Delete "${filesToDelete[0]}"?`
              : `Delete ${filesToDelete.length} items?`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild className="min-w-0">
            <div>
              <p>
                {filesToDelete.length === 1
                  ? 'This item will be permanently deleted from the device. This action cannot be undone.'
                  : 'These items will be permanently deleted from the device. This action cannot be undone.'}
              </p>
              {filesToDelete.length > 1 && (
                <ul className="mt-2 flex min-w-0 flex-col gap-0.5 font-mono text-xs">
                  {filesToDelete.slice(0, 5).map((name) => {
                    const file = fileList.find((entry) => entry.name === name);
                    return (
                      <li className="flex min-w-0 items-start gap-1.5" key={name}>
                        {file?.type === 'Directory' ? (
                          <Folder className="h-3 w-3 shrink-0" />
                        ) : file?.type === 'Symlink' ? (
                          <Link className="h-3 w-3 shrink-0" />
                        ) : (
                          <File className="h-3 w-3 shrink-0" />
                        )}
                        <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
                      </li>
                    );
                  })}
                  {filesToDelete.length > 5 && (
                    <li className="text-muted-foreground">
                      … and {filesToDelete.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="min-w-0">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 shrink-0" />
            )}
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: Extract remaining UI components**

Create these files by moving JSX blocks from `FileExplorerView.tsx`:

```text
src/features/file-explorer/ui/FileExplorerLayout.tsx
  Owns left tree + right panel layout, splitter, collapsed tree button.

src/features/file-explorer/ui/FileExplorerToolbar.tsx
  Owns toolbar buttons: refresh, new file, new folder, import, export.

src/features/file-explorer/ui/FileAddressBar.tsx
  Owns back, forward, up, editable path, breadcrumb display.

src/features/file-explorer/ui/FileTable.tsx
  Owns Table, TableHeader, TableBody, virtualizer total-size container.

src/features/file-explorer/ui/FileTableHeader.tsx
  Owns checkbox header, icon spacer, sort headers, time column.

src/features/file-explorer/ui/FileRow.tsx
  Owns one virtualized row, click, double-click, keyboard row actions.

src/features/file-explorer/ui/CreateRow.tsx
  Owns phantom row for new file/folder input.

src/features/file-explorer/ui/RenameInput.tsx
  Owns inline rename input and validation display.

src/features/file-explorer/ui/FileContextMenu.tsx
  Owns row context menu actions.

src/features/file-explorer/ui/EmptyDirectoryState.tsx
  Owns create-file/create-folder empty directory state.

src/features/file-explorer/ui/LoadErrorState.tsx
  Owns permission/no-device/unknown load error state.
```

Each file exports exactly one React component. Shared prop types live in `fileExplorerTypes.ts` only when two or more UI components use the same prop shape.

- [ ] **Step 4: Keep `FileExplorerView.tsx` as coordinator only**

After extraction, `src/features/file-explorer/FileExplorerView.tsx` should contain:

```tsx
export function FileExplorerView({ activeView }: { activeView: string }) {
  const listing = useFileExplorerListing(activeView);
  const selection = useFileExplorerSelection();
  const history = useFileExplorerHistory(listing.initialPath);
  const mutations = useFileExplorerMutations({ listing, selection, history });
  useFileExplorerKeyboard({ listing, selection, history, mutations });

  return (
    <FileExplorerLayout
      history={history}
      listing={listing}
      mutations={mutations}
      selection={selection}
    />
  );
}
```

The real returned props may include more fields, but the view must remain a coordinator and must stay under 250 lines.

- [ ] **Step 5: Update app shell and tests**

In `src/app/shell/MainLayout.tsx`, import:

```ts
import { FileExplorerView } from '@/features/file-explorer/FileExplorerView';
```

Update tests:

```text
src/test/ViewFileExplorer.test.tsx imports from '@/features/file-explorer/FileExplorerView'
```

- [ ] **Step 6: Verify file sizes**

Run:

```powershell
Get-ChildItem -Path src\features\file-explorer -Recurse -File -Include *.ts,*.tsx | ForEach-Object { [pscustomobject]@{ Lines=(Get-Content $_.FullName | Measure-Object -Line).Lines; Path=$_.FullName.Replace((Get-Location).Path + '\','') } } | Sort-Object Lines -Descending | Format-Table -AutoSize
```

Expected: no feature file over 300 lines.

- [ ] **Step 7: Verify behavior**

Run:

```powershell
bun vitest run src/test/ViewFileExplorer.test.tsx src/test/fileExplorerHooks.test.tsx src/test/fileExplorerUtils.test.ts
bun run lint:web
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src/features/file-explorer src/test src/app/shell/MainLayout.tsx
git commit -m "refactor: split file explorer into feature modules"
```

---

## Task 10: Move Remaining Views Into Feature Folders

**Files:**
- Move: `ViewDashboard.tsx` → `src/features/dashboard/DashboardView.tsx`
- Move: `ViewFlasher.tsx` → `src/features/flasher/FlasherView.tsx`
- Move: `ViewUtilities.tsx` → `src/features/utilities/UtilitiesView.tsx`
- Move: `ViewAbout.tsx` if present → `src/features/about/AboutView.tsx`
- Modify: app shell imports
- Modify: tests

- [ ] **Step 1: Move files**

Run:

```powershell
New-Item -ItemType Directory -Force src\features\dashboard src\features\flasher src\features\utilities src\features\about
git mv src\components\views\ViewDashboard.tsx src\features\dashboard\DashboardView.tsx
git mv src\components\views\ViewFlasher.tsx src\features\flasher\FlasherView.tsx
git mv src\components\views\ViewUtilities.tsx src\features\utilities\UtilitiesView.tsx
if (Test-Path src\components\views\ViewAbout.tsx) { git mv src\components\views\ViewAbout.tsx src\features\about\AboutView.tsx }
```

- [ ] **Step 2: Update app shell imports**

Use these imports in `src/app/shell/MainLayout.tsx`:

```ts
import { AboutView } from '@/features/about/AboutView';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { FlasherView } from '@/features/flasher/FlasherView';
import { UtilitiesView } from '@/features/utilities/UtilitiesView';
```

If `AboutView` does not exist as a separate file, keep the existing about component path and write that exception into the architecture notes.

- [ ] **Step 3: Update tests**

Apply replacements:

```text
@/components/views/ViewDashboard -> @/features/dashboard/DashboardView
@/components/views/ViewFlasher -> @/features/flasher/FlasherView
@/components/views/ViewUtilities -> @/features/utilities/UtilitiesView
@/components/views/ViewAbout -> @/features/about/AboutView
```

- [ ] **Step 4: Verify no view folder remains**

Run:

```powershell
Get-ChildItem src\components\views -ErrorAction SilentlyContinue
rg -n "@/components/views" src
```

Expected: first command reports path missing or empty; second command has no output.

- [ ] **Step 5: Verify**

Run:

```powershell
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src
git commit -m "refactor: move remaining views into features"
```

---

## Task 11: Split Flasher And Utilities Oversized Views

**Files:**
- Create files under `src/features/flasher/ui/`, `hooks/`, `model/`
- Create files under `src/features/utilities/ui/`, `hooks/`
- Modify: `src/features/flasher/FlasherView.tsx`
- Modify: `src/features/utilities/UtilitiesView.tsx`
- Test: existing `ViewFlasher.test.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus:

```text
impact target=ViewFlasher file_path=src/features/flasher/FlasherView.tsx direction=upstream repo=adb-gui-next
impact target=ViewUtilities file_path=src/features/utilities/UtilitiesView.tsx direction=upstream repo=adb-gui-next
```

Expected: direct caller is app shell. Proceed if risk is LOW or MEDIUM.

- [ ] **Step 2: Create flasher modules**

Create:

```text
src/features/flasher/model/flasherTypes.ts
src/features/flasher/hooks/useFlasherActions.ts
src/features/flasher/hooks/useFlasherDropTargets.ts
src/features/flasher/ui/FlashPartitionPanel.tsx
src/features/flasher/ui/SideloadPanel.tsx
src/features/flasher/ui/FastbootActionsPanel.tsx
src/features/flasher/ui/QueuedActionBanner.tsx
```

Move existing type aliases and state/action logic from `FlasherView.tsx` into these files without changing command order, toast messages, or queued-action behavior.

- [ ] **Step 3: Create utilities modules**

Create:

```text
src/features/utilities/hooks/useUtilityActions.ts
src/features/utilities/ui/RebootActionsPanel.tsx
src/features/utilities/ui/BootloaderVariablesPanel.tsx
src/features/utilities/ui/WirelessAdbPanel.tsx
src/features/utilities/ui/DeviceToolsPanel.tsx
```

Move existing command button groups from `UtilitiesView.tsx` into these components without changing labels or disabled states.

- [ ] **Step 4: Keep views thin**

After extraction:

```text
src/features/flasher/FlasherView.tsx under 250 lines
src/features/utilities/UtilitiesView.tsx under 250 lines
```

- [ ] **Step 5: Verify**

Run:

```powershell
bun vitest run src/test/ViewFlasher.test.tsx
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/features/flasher src/features/utilities src/test
git commit -m "refactor: split flasher and utilities features"
```

---

## Task 12: Split Dashboard And App Manager Large Files

**Files:**
- Create files under `src/features/dashboard/ui/`
- Create files under `src/features/app-manager/installation/hooks/`
- Modify: `DashboardView.tsx`
- Modify: `InstallationTab.tsx`
- Modify: `DebloaterTab.tsx`
- Tests: `ViewDashboard.test.tsx`, `ViewAppManager.test.tsx`

- [ ] **Step 1: Split dashboard cards**

Create:

```text
src/features/dashboard/ui/DeviceOverviewCard.tsx
src/features/dashboard/ui/WirelessAdbCard.tsx
src/features/dashboard/ui/StorageCard.tsx
src/features/dashboard/ui/DeviceInfoGrid.tsx
src/features/dashboard/hooks/useDashboardDeviceInfo.ts
```

Move existing Dashboard sections into these files. `DashboardView.tsx` should orchestrate selected device state and render cards.

- [ ] **Step 2: Split App Manager installation tab**

Create:

```text
src/features/app-manager/installation/hooks/usePackageInstallation.ts
src/features/app-manager/installation/hooks/usePackageSelection.ts
src/features/app-manager/installation/ui/ApkPickerPanel.tsx
src/features/app-manager/installation/ui/InstalledPackageList.tsx
src/features/app-manager/installation/ui/PackageToolbar.tsx
```

Move install/sideload/uninstall logic and virtualized package UI out of `InstallationTab.tsx`.

- [ ] **Step 3: Split Debloater list UI**

Create:

```text
src/features/app-manager/debloater/ui/DebloaterToolbar.tsx
src/features/app-manager/debloater/ui/DebloaterPackageList.tsx
src/features/app-manager/debloater/ui/DebloaterPackageRow.tsx
```

Move filter controls and row rendering out of `DebloaterTab.tsx`.

- [ ] **Step 4: Verify file sizes**

Run:

```powershell
Get-ChildItem -Path src\features\dashboard,src\features\app-manager -Recurse -File -Include *.ts,*.tsx | ForEach-Object { [pscustomobject]@{ Lines=(Get-Content $_.FullName | Measure-Object -Line).Lines; Path=$_.FullName.Replace((Get-Location).Path + '\','') } } | Sort-Object Lines -Descending | Format-Table -AutoSize
```

Expected: no feature file over 300 lines.

- [ ] **Step 5: Verify**

Run:

```powershell
bun vitest run src/test/ViewDashboard.test.tsx src/test/ViewAppManager.test.tsx
bun run lint:web
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/features/dashboard src/features/app-manager src/test
git commit -m "refactor: split dashboard and app manager features"
```

---

## Task 13: Remove Legacy Folders And Make Architecture Test Green

**Files:**
- Delete empty: `src/components/`
- Delete empty: `src/lib/`
- Modify: `src/test/frontendArchitecture.test.ts`
- Modify: any remaining imports

- [ ] **Step 1: Inspect remaining legacy folders**

Run:

```powershell
Get-ChildItem src\components -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem src\lib -Recurse -Force -ErrorAction SilentlyContinue
```

Expected: no source files remain. If files remain, classify them:

```text
feature-owned -> move to src/features/<feature>/
shared -> move to src/shared/
desktop IPC -> move to src/desktop/
app shell -> move to src/app/
```

- [ ] **Step 2: Remove empty folders**

Run:

```powershell
if (Test-Path src\components) { Remove-Item src\components -Recurse }
if (Test-Path src\lib) { Remove-Item src\lib -Recurse }
```

Only run after Step 1 confirms no source files remain in those folders.

- [ ] **Step 3: Run architecture test**

Run:

```powershell
bun vitest run src/test/frontendArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full frontend verification**

Run:

```powershell
bun run format:check
bun run lint:web
bun run test
bun run build
```

Expected:

```text
format:check exits 0
lint:web exits 0
all Vitest files pass
vite build exits 0
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add src components.json
git commit -m "refactor: enforce frontend feature architecture"
```

---

## Task 14: Update Project Documentation And Memory Bank

**Files:**
- Modify: `AGENTS.md`
- Modify: `memory-bank/systemPatterns.md`
- Modify: `memory-bank/techContext.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

- [ ] **Step 1: Update `AGENTS.md` frontend architecture section**

Replace the old frontend location table with:

```markdown
| Concern | Correct location | Do not do this |
| --- | --- | --- |
| App bootstrap | `src/main.tsx`, `src/app/App.tsx` | Put feature logic in bootstrap |
| App shell and view switching | `src/app/shell/` | Add a router or per-view polling |
| Tauri IPC wrappers | `src/desktop/` | Scatter raw `invoke()` calls in features |
| shadcn primitives | `src/shared/ui/` | Hand-roll primitive controls |
| Cross-feature components | `src/shared/components/` | Put feature-only UI in shared |
| Cross-feature stores | `src/shared/stores/` | Put feature state in app-wide stores |
| Feature implementation | `src/features/<feature>/` | Add new code under legacy `components/views` |
| Feature hooks | `src/features/<feature>/hooks/` | Hide stateful feature logic in view files |
| Feature utilities | `src/features/<feature>/utils/` | Create generic `utils.ts` dumping grounds |
| Tests | `src/test/` | Add frontend tests outside `src/test/` |
```

- [ ] **Step 2: Update memory bank**

Update:

```text
memory-bank/systemPatterns.md
- Replace old component architecture tree with the new app/shared/desktop/features tree.
- Keep File Explorer critical patterns.
- Add rule: feature-owned code lives in src/features/<feature>.

memory-bank/techContext.md
- Update Important Files section.
- Update shadcn alias location to src/shared/ui.

memory-bank/activeContext.md
- Add completed frontend architecture migration entry.

memory-bank/progress.md
- Add version history row for frontend feature architecture migration.
- Update current File Explorer description to mention split modules.
```

- [ ] **Step 3: Verify docs formatting**

Run:

```powershell
bun run format:web:check
```

Expected: exits 0.

- [ ] **Step 4: Commit**

Run:

```powershell
git add AGENTS.md memory-bank
git commit -m "docs: document frontend feature architecture"
```

---

## Task 15: Final Full Gate And GitNexus Change Detection

**Files:**
- Read: entire worktree
- Modify: none unless verification finds a bug

- [ ] **Step 1: Run GitNexus detect changes**

Run GitNexus:

```text
detect_changes scope=all repo=adb-gui-next
```

Expected: changed symbols are frontend architecture files, moved feature files, and docs. Rust commands should not appear unless there were pre-existing changes intentionally included.

- [ ] **Step 2: Run full local gate**

Run:

```powershell
bun run format:check
bun run lint:web
bun run lint:rust
bun run test
bun run build
```

Expected:

```text
format:check exits 0
lint:web exits 0
lint:rust exits 0
all Vitest tests pass
vite build exits 0
```

- [ ] **Step 3: Run architecture size report**

Run:

```powershell
Get-ChildItem -Path src\features -Recurse -File -Include *.ts,*.tsx | ForEach-Object { [pscustomobject]@{ Lines=(Get-Content $_.FullName | Measure-Object -Line).Lines; Path=$_.FullName.Replace((Get-Location).Path + '\','') } } | Sort-Object Lines -Descending | Select-Object -First 30 | Format-Table -AutoSize
```

Expected: no file over 300 lines. If one exceeds 300 lines, split it before final commit unless it is generated code.

- [ ] **Step 4: Confirm no legacy imports**

Run:

```powershell
rg -n "@/components/views|@/components/ui|@/components/marketplace|@/components/payload-dumper|@/components/emulator-manager|@/lib/" src
```

Expected: no output.

- [ ] **Step 5: Confirm raw Tauri invoke boundary**

Run:

```powershell
rg -n "@tauri-apps/api/core|invoke<|core\\.invoke" src
```

Expected: matches only in `src/desktop/backend.ts`.

- [ ] **Step 6: Final commit if fixes were needed**

Run:

```powershell
git status --short
```

Expected: no output. If output exists, inspect with `git diff`, fix the issue, run the relevant verification command again, and commit with:

```powershell
git add src AGENTS.md memory-bank components.json
git commit -m "fix: finish frontend architecture migration"
```

---

## Rollback Strategy

If a task creates a broken state that cannot be fixed within that task:

1. Do not run `git reset --hard`.
2. Use `git diff` to identify only the files changed in the current task.
3. If the current task has not been committed, restore only the current task files with explicit paths after confirming they are not user edits.
4. If the current task was committed, create a new revert commit for that task only:

```powershell
git revert <commit-sha>
```

5. Keep earlier successful migration commits intact.

## Self-Review

Spec coverage:

- Strict feature-first architecture is covered by Tasks 2 through 13.
- File Explorer large-file refactor is covered by Tasks 7 through 9.
- Entire frontend folder structure migration is covered by Tasks 2 through 13.
- Naming and folder rules are documented in the Target Folder Structure, Naming Rules, and Import Migration Map sections.
- Verification and quality gates are covered in every task plus Task 15.
- Documentation and memory-bank updates are covered in Task 14.

Placeholder scan:

- The plan contains no open-ended implementation placeholders.
- Every created path has an exact destination.
- Every command has an expected result.
- Every code block defines concrete code or concrete import mappings.

Type consistency:

- Feature types use `FileExplorerEntry`, `LoadError`, `CreatingType`, `SortField`, and `SortDir`.
- File Explorer utility names are consistent: `sortFileEntries`, `isValidDevicePath`, `validateNewEntryName`, `joinDevicePath`, `joinDeviceDirectory`, `parentDevicePath`.
- Store names remain descriptive and keep `Store` suffix.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-14-frontend-feature-architecture-refactor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
