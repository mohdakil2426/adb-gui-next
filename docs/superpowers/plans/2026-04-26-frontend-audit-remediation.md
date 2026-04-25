# Frontend Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining frontend consistency, accessibility, and shadcn-rule gaps identified in the April 26, 2026 deep audit without changing backend contracts or the Tauri desktop shell architecture.

**Architecture:** Keep the existing React 19 + Vite + shadcn desktop shell intact and focus on small, reviewable frontend-only fixes. Prefer shared primitives and semantic tokens over one-off styling, and fold repeated UX patterns into reusable helpers instead of patching each view ad hoc.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4, shadcn/ui (radix base), Zustand, Vitest, Testing Library

---

## File Structure

### Shared design-system and shell files

- Modify: `src/styles/global.css`
  - Add semantic device-status color tokens and any narrowly-scoped terminal token helpers needed by the bottom panel cleanup.
- Modify: `src/lib/deviceStatus.ts`
  - Replace raw palette badge classes with semantic token-backed classes.
- Modify: `src/components/FileSelector.tsx`
  - Remove native `title` usage and expose the full path in a shadcn-aligned accessible pattern.
- Modify: `src/components/ConnectedDevicesCard.tsx`
  - Normalize empty state and row composition to match the shared component language.
- Modify: `src/components/DeviceSwitcher.tsx`
  - Keep behavior intact while aligning status badge styling with the new semantic status config.
- Modify: `src/components/BottomPanel.tsx`
  - Replace the custom filter popup with shadcn menu primitives and remove the remaining ad hoc terminal hover styling.
- Modify: `src/components/LogsPanel.tsx`
  - Align row hover styling with the updated terminal token strategy if needed.

### View-specific files

- Modify: `src/components/views/ViewDashboard.tsx`
  - Convert the wireless ADB form and info cards to the current shared form and tooltip patterns.
- Modify: `src/components/views/ViewFlasher.tsx`
  - Convert the flash form to `Field` composition and align drop/select affordances with existing shared primitives.
- Modify: `src/components/views/ViewMarketplace.tsx`
  - Review sticky/filter shell alignment and tighten the sidebar/filter composition if necessary.
- Modify: `src/components/marketplace/AppCard.tsx`
  - Tighten semantics for the full-card clickable layout and make the action structure consistent with shadcn guidance.
- Modify: `src/components/marketplace/AppListItem.tsx`
  - Mirror the AppCard semantic cleanup in list mode.

### Tests and audit docs

- Modify: `src/test/ConnectedDevicesCard.test.tsx`
  - Update expectations if empty-state or badge semantics change.
- Add or modify: `src/test/deviceStatus.test.ts`
  - Lock in the new semantic status token mapping.
- Add or modify: `src/test/FileSelector.test.tsx`
  - Cover full-path disclosure and the removal of native `title`.
- Add or modify: `src/test/ViewDashboard.test.tsx`
  - Cover the updated wireless ADB form composition and validation messaging.
- Add or modify: `src/test/BottomPanel.test.tsx`
  - Cover filter menu behavior once the custom popup is replaced.
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
  - Document the frontend audit follow-up once work is complete.

---

### Task 1: Lock The Audit Baseline In Tests

**Files:**
- Create: `src/test/deviceStatus.test.ts`
- Create: `src/test/FileSelector.test.tsx`
- Modify: `src/test/ConnectedDevicesCard.test.tsx`

- [ ] **Step 1: Write the failing device-status test**

```ts
import { describe, expect, it } from 'vitest';
import { getStatusConfig } from '@/lib/deviceStatus';

describe('deviceStatus', () => {
  it('returns semantic token classes for known device states', () => {
    expect(getStatusConfig('device')).toMatchObject({
      label: 'adb',
      variant: 'default',
      badgeClass: expect.stringContaining('bg-[var(--device-status-adb-bg)]'),
    });
    expect(getStatusConfig('unauthorized')).toMatchObject({
      label: 'unauthorized',
      variant: 'destructive',
      badgeClass: expect.stringContaining('text-[var(--device-status-unauthorized-fg)]'),
    });
  });
});
```

- [ ] **Step 2: Write the failing FileSelector test**

```tsx
import { render, screen } from '@testing-library/react';
import { FileSelector } from '@/components/FileSelector';

describe('FileSelector', () => {
  it('shows the full selected path in visible assistive text instead of native title', () => {
    render(<FileSelector label="Payload File" path="/sdcard/Download/payload.bin" onSelect={() => {}} />);

    expect(screen.getByText('/sdcard/Download/payload.bin')).toBeInTheDocument();
    expect(screen.getByText('/sdcard/Download/payload.bin')).not.toHaveAttribute('title');
  });
});
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```bash
bun run test -- src/test/deviceStatus.test.ts src/test/FileSelector.test.tsx src/test/ConnectedDevicesCard.test.tsx
```

Expected: FAIL because `deviceStatus.test.ts` does not exist yet and `FileSelector` still renders a `title`.

- [ ] **Step 4: Add the test files and adjust the connected-devices assertions minimally**

```ts
// src/test/deviceStatus.test.ts
import { describe, expect, it } from 'vitest';
import { getStatusConfig } from '@/lib/deviceStatus';

describe('deviceStatus', () => {
  it('returns semantic token classes for known device states', () => {
    expect(getStatusConfig('device')).toMatchObject({
      label: 'adb',
      variant: 'default',
      badgeClass: expect.stringContaining('bg-[var(--device-status-adb-bg)]'),
    });
    expect(getStatusConfig('unauthorized')).toMatchObject({
      label: 'unauthorized',
      variant: 'destructive',
      badgeClass: expect.stringContaining('text-[var(--device-status-unauthorized-fg)]'),
    });
  });
});
```

```tsx
// src/test/FileSelector.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileSelector } from '@/components/FileSelector';

describe('FileSelector', () => {
  it('shows the full selected path in visible assistive text instead of native title', () => {
    render(<FileSelector label="Payload File" path="/sdcard/Download/payload.bin" onSelect={() => {}} />);

    const fullPath = screen.getByText('/sdcard/Download/payload.bin');
    expect(fullPath).toBeInTheDocument();
    expect(fullPath).not.toHaveAttribute('title');
  });
});
```

- [ ] **Step 5: Re-run the focused tests**

Run:

```bash
bun run test -- src/test/deviceStatus.test.ts src/test/FileSelector.test.tsx src/test/ConnectedDevicesCard.test.tsx
```

Expected: FAIL only on real implementation gaps, not missing files.

- [ ] **Step 6: Commit the baseline tests**

```bash
git add src/test/deviceStatus.test.ts src/test/FileSelector.test.tsx src/test/ConnectedDevicesCard.test.tsx
git commit -m "test: lock frontend audit regressions"
```

### Task 2: Replace Raw Device Badge Palette Classes With Semantic Tokens

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/lib/deviceStatus.ts`
- Test: `src/test/deviceStatus.test.ts`

- [ ] **Step 1: Add semantic device-status CSS variables**

```css
/* src/styles/global.css */
:root {
  --device-status-adb-bg: color-mix(in oklch, var(--success) 18%, transparent);
  --device-status-adb-fg: var(--success);
  --device-status-adb-border: color-mix(in oklch, var(--success) 35%, transparent);
  --device-status-fastboot-bg: color-mix(in oklch, var(--warning) 18%, transparent);
  --device-status-fastboot-fg: var(--warning-foreground);
  --device-status-fastboot-border: color-mix(in oklch, var(--warning) 38%, transparent);
  --device-status-recovery-bg: color-mix(in oklch, var(--chart-2) 18%, transparent);
  --device-status-recovery-fg: var(--chart-2);
  --device-status-recovery-border: color-mix(in oklch, var(--chart-2) 35%, transparent);
  --device-status-neutral-bg: color-mix(in oklch, var(--muted-foreground) 16%, transparent);
  --device-status-neutral-fg: var(--muted-foreground);
  --device-status-neutral-border: color-mix(in oklch, var(--muted-foreground) 28%, transparent);
  --device-status-unauthorized-bg: color-mix(in oklch, var(--destructive) 16%, transparent);
  --device-status-unauthorized-fg: var(--destructive);
  --device-status-unauthorized-border: color-mix(in oklch, var(--destructive) 32%, transparent);
}
```

- [ ] **Step 2: Refactor the status config to use those tokens**

```ts
// src/lib/deviceStatus.ts
const STATUS_CONFIG: Record<string, StatusConfig> = {
  device: {
    label: 'adb',
    variant: 'default',
    badgeClass:
      'bg-[var(--device-status-adb-bg)] text-[var(--device-status-adb-fg)] border-[var(--device-status-adb-border)]',
  },
  fastboot: {
    label: 'fastboot',
    variant: 'outline',
    badgeClass:
      'bg-[var(--device-status-fastboot-bg)] text-[var(--device-status-fastboot-fg)] border-[var(--device-status-fastboot-border)]',
  },
  unauthorized: {
    label: 'unauthorized',
    variant: 'destructive',
    badgeClass:
      'bg-[var(--device-status-unauthorized-bg)] text-[var(--device-status-unauthorized-fg)] border-[var(--device-status-unauthorized-border)]',
  },
};
```

- [ ] **Step 3: Run the focused device-status test**

Run:

```bash
bun run test -- src/test/deviceStatus.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run lint for the touched files**

Run:

```bash
bun run lint:web
```

Expected: PASS with no Tailwind/classname or TypeScript issues from the new token classes.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/lib/deviceStatus.ts src/test/deviceStatus.test.ts
git commit -m "refactor: replace raw device badge colors with semantic tokens"
```

### Task 3: Remove Native Title Tooltips And Normalize Full-Path Disclosure

**Files:**
- Modify: `src/components/FileSelector.tsx`
- Modify: `src/components/views/ViewDashboard.tsx`
- Test: `src/test/FileSelector.test.tsx`

- [ ] **Step 1: Replace FileSelector `title` usage with visible supporting text**

```tsx
// src/components/FileSelector.tsx
{path && (
  <FieldDescription className="break-all text-xs">
    {path}
  </FieldDescription>
)}
```

- [ ] **Step 2: Remove dashboard info-cell native titles and rely on truncation + copy controls**

```tsx
// src/components/views/ViewDashboard.tsx
<div className="text-sm text-muted-foreground truncate">
  {label}
</div>
<div className={cn('font-semibold truncate', valueClassName)}>
  {value || 'N/A'}
</div>
```

- [ ] **Step 3: Run the focused tests**

Run:

```bash
bun run test -- src/test/FileSelector.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run the dashboard-related test suite if present, otherwise run all frontend tests**

Run:

```bash
bun run test
```

Expected: PASS or reveal any dashboard snapshot/assertion updates needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileSelector.tsx src/components/views/ViewDashboard.tsx src/test/FileSelector.test.tsx
git commit -m "fix: remove remaining native title tooltips"
```

### Task 4: Normalize The Dashboard Wireless ADB Form To Current shadcn Form Patterns

**Files:**
- Modify: `src/components/views/ViewDashboard.tsx`
- Add or modify: `src/test/ViewDashboard.test.tsx`

- [ ] **Step 1: Write the failing dashboard form test**

```tsx
it('renders the wireless adb inputs with explicit field labels and validation text', async () => {
  render(<ViewDashboard activeView="dashboard" />);

  expect(screen.getByLabelText('Device IP Address')).toBeInTheDocument();
  expect(screen.getByLabelText('Wireless ADB Port')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused dashboard test**

Run:

```bash
bun run test -- src/test/ViewDashboard.test.tsx
```

Expected: FAIL if the test file does not exist yet or if current assertions do not match the form.

- [ ] **Step 3: Refactor the wireless section to `FieldGroup` / `Field` composition**

```tsx
// src/components/views/ViewDashboard.tsx
<FieldGroup>
  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
    <Field data-invalid={Boolean(wirelessForm.formState.errors.ip)}>
      <FieldLabel htmlFor="dashboard-wireless-ip">Device IP Address</FieldLabel>
      <Input
        id="dashboard-wireless-ip"
        aria-invalid={Boolean(wirelessForm.formState.errors.ip)}
        {...wirelessForm.register('ip')}
      />
      {wirelessForm.formState.errors.ip && (
        <FieldDescription>{wirelessForm.formState.errors.ip.message}</FieldDescription>
      )}
    </Field>
    <Field data-invalid={Boolean(wirelessForm.formState.errors.port)}>
      <FieldLabel htmlFor="dashboard-wireless-port">Wireless ADB Port</FieldLabel>
      <Input
        id="dashboard-wireless-port"
        aria-invalid={Boolean(wirelessForm.formState.errors.port)}
        {...wirelessForm.register('port')}
      />
      {wirelessForm.formState.errors.port && (
        <FieldDescription>{wirelessForm.formState.errors.port.message}</FieldDescription>
      )}
    </Field>
  </div>
</FieldGroup>
```

- [ ] **Step 4: Re-run the focused dashboard test**

Run:

```bash
bun run test -- src/test/ViewDashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/ViewDashboard.tsx src/test/ViewDashboard.test.tsx
git commit -m "refactor: normalize dashboard wireless adb form"
```

### Task 5: Normalize The Flasher Form To Shared Field Patterns

**Files:**
- Modify: `src/components/views/ViewFlasher.tsx`
- Add or modify: `src/test/ViewFlasher.test.tsx`

- [ ] **Step 1: Write the failing flasher form test**

```tsx
it('renders the flash partition input with an explicit field label', () => {
  render(<ViewFlasher />);
  expect(screen.getByLabelText('Partition Name')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused flasher test**

Run:

```bash
bun run test -- src/test/ViewFlasher.test.tsx
```

Expected: FAIL if the test file is missing or if assertions need wiring.

- [ ] **Step 3: Replace the raw label/input block with `Field` composition**

```tsx
// src/components/views/ViewFlasher.tsx
<Field>
  <FieldLabel htmlFor="flasher-partition">Partition Name</FieldLabel>
  <Input
    id="flasher-partition"
    list="partition-suggestions"
    placeholder="e.g., boot, recovery, vendor_boot"
    value={partition}
    onChange={(e) => setPartition(e.target.value)}
    disabled={isGlobalLoading}
  />
  <FieldDescription>Choose a fastboot partition name or type a custom one.</FieldDescription>
</Field>
```

- [ ] **Step 4: Re-run the focused flasher test**

Run:

```bash
bun run test -- src/test/ViewFlasher.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/ViewFlasher.tsx src/test/ViewFlasher.test.tsx
git commit -m "refactor: align flasher form with shared field components"
```

### Task 6: Replace The Bottom Panel’s Custom Filter Popup With shadcn Menu Primitives

**Files:**
- Modify: `src/components/BottomPanel.tsx`
- Modify: `src/components/LogsPanel.tsx`
- Add or modify: `src/test/BottomPanel.test.tsx`

- [ ] **Step 1: Write the failing bottom-panel filter interaction test**

```tsx
it('opens the log filter menu and applies a level option', async () => {
  render(<BottomPanel viewportHeight={900} />);

  await user.click(screen.getByLabelText('Filter Logs'));
  await user.click(screen.getByRole('menuitemradio', { name: 'Error' }));

  expect(useLogStore.getState().filter).toBe('error');
});
```

- [ ] **Step 2: Run the focused bottom-panel test**

Run:

```bash
bun run test -- src/test/BottomPanel.test.tsx
```

Expected: FAIL because the current filter popup is not a shadcn menu.

- [ ] **Step 3: Replace the custom popup block with `DropdownMenuRadioGroup`**

```tsx
// src/components/BottomPanel.tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Filter Logs" className="size-6">
      <Filter className="size-3.5" aria-hidden="true" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-40">
    <DropdownMenuLabel>Filter logs</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuRadioGroup value={filter} onValueChange={(value) => setFilter(value as LogLevel | 'all')}>
      {FILTER_OPTIONS.map((option) => (
        <DropdownMenuRadioItem key={option.value} value={option.value}>
          {option.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] **Step 4: Remove any now-unneeded ad hoc terminal hover classes**

```tsx
// src/components/LogsPanel.tsx
<div className="flex gap-2 px-3 py-0.5 transition-colors hover:bg-accent/20">
```

- [ ] **Step 5: Re-run the focused bottom-panel test**

Run:

```bash
bun run test -- src/test/BottomPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomPanel.tsx src/components/LogsPanel.tsx src/test/BottomPanel.test.tsx
git commit -m "refactor: replace custom log filter popup with shadcn menu"
```

### Task 7: Tighten Device Surface Empty States And Row Composition

**Files:**
- Modify: `src/components/ConnectedDevicesCard.tsx`
- Modify: `src/components/DeviceSwitcher.tsx`
- Modify: `src/test/ConnectedDevicesCard.test.tsx`

- [ ] **Step 1: Write the failing empty-state expectation**

```tsx
it('renders a shared empty-state presentation when no devices are present', () => {
  render(
    <ConnectedDevicesCard devices={[]} isLoading={false} onRefresh={() => {}} onEdit={() => {}} />,
  );

  expect(screen.getByText('No device detected. Ensure USB Debugging is enabled.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Refactor the empty state to use the shared EmptyState wrapper**

```tsx
// src/components/ConnectedDevicesCard.tsx
{devices.length === 0 ? (
  <EmptyState
    icon={Smartphone}
    title={isLoading ? 'Scanning for devices…' : 'No devices detected'}
    description={isLoading ? 'Looking for connected Android devices.' : emptyText}
    className="py-6"
  />
) : (
```

- [ ] **Step 3: Keep DeviceSwitcher aligned with the new semantic badge classes**

```tsx
// src/components/DeviceSwitcher.tsx
<Badge
  variant={config.variant}
  className={cn('shrink-0 px-1.5 py-0 text-[10px]', config.badgeClass)}
>
  {config.label}
</Badge>
```

- [ ] **Step 4: Run the focused device component tests**

Run:

```bash
bun run test -- src/test/ConnectedDevicesCard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConnectedDevicesCard.tsx src/components/DeviceSwitcher.tsx src/test/ConnectedDevicesCard.test.tsx
git commit -m "refactor: normalize device surface empty states"
```

### Task 8: Tighten Marketplace Interaction Semantics Without Changing Behavior

**Files:**
- Modify: `src/components/marketplace/AppCard.tsx`
- Modify: `src/components/marketplace/AppListItem.tsx`
- Modify: `src/components/views/ViewMarketplace.tsx`
- Add or modify: `src/test/ViewMarketplace.test.tsx`

- [ ] **Step 1: Write the failing marketplace interaction test**

```tsx
it('keeps install actions separate from detail navigation', async () => {
  render(<ViewMarketplace />);

  expect(screen.getAllByRole('button', { name: /install|view details|details/i }).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Review and simplify the clickable-card semantics**

```tsx
// src/components/marketplace/AppCard.tsx
<Card className="group border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/10 hover:shadow-md">
  <CardHeader className="p-0">
    <button type="button" className="w-full text-left" onClick={onSelect}>
      {/* existing header + content wrapper */}
    </button>
  </CardHeader>
  <CardFooter className="justify-end p-4 pt-0">
    <Button onClick={handleInstall} />
  </CardFooter>
</Card>
```

- [ ] **Step 3: Mirror the same separation in list view**

```tsx
// src/components/marketplace/AppListItem.tsx
<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/50">
  <button type="button" className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left" onClick={onSelect}>
    {/* existing summary content */}
  </button>
  <Button onClick={handleInstall} />
</div>
```

- [ ] **Step 4: Verify the sticky/filter shell still behaves after any layout tweaks**

Run:

```bash
bun run test -- src/test/ViewMarketplace.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketplace/AppCard.tsx src/components/marketplace/AppListItem.tsx src/components/views/ViewMarketplace.tsx src/test/ViewMarketplace.test.tsx
git commit -m "refactor: tighten marketplace interaction semantics"
```

### Task 9: Final Verification, Audit Notes, And Memory Bank Update

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`

- [ ] **Step 1: Run the full frontend test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 2: Run formatting and lint checks**

Run:

```bash
bun run format:check
bun run lint
```

Expected: PASS, with the known caveat that Rust lint uses the project’s current isolated-target workflow if needed.

- [ ] **Step 3: Run a full frontend build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 4: Update the memory bank with the audit follow-up**

```md
## Recently Completed

### 2026-04-26 — Frontend Audit Remediation Follow-Up

**Change:** Finished the second-pass frontend audit remediation: semantic device-status tokens, removal of native title tooltips, dashboard/flasher form normalization, bottom-panel filter migration to shadcn menu primitives, and tighter device/marketplace semantics.

**Verification:** `bun run test`, `bun run format:check`, `bun run lint`, and `bun run build`.
```

- [ ] **Step 5: Commit the final documentation updates**

```bash
git add memory-bank/activeContext.md memory-bank/progress.md
git commit -m "docs: record frontend audit remediation follow-up"
```

## Self-Review

- Spec coverage: this plan covers the deeper audit findings in shared shell/components, dashboard forms, flasher forms, device status semantics, marketplace interaction semantics, and bottom-panel accessibility cleanup.
- Placeholder scan: no `TODO`/`TBD` placeholders remain; every task has exact files and commands.
- Type consistency: all file names, component names, and store references match the current codebase structure from the audit pass.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-frontend-audit-remediation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
