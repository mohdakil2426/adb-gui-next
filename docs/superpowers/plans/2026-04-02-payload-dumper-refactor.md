# Payload Dumper Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `ViewPayloadDumper.tsx` (957 lines) into focused, modular files with clear separation of concerns — hooks for business logic, sub-components for UI.

**Architecture:** Extract 8 UI sub-components into `src/components/payload-dumper/` and 2 hooks into `src/lib/payload-dumper/`. The main view becomes a ~150-line container that wires state to hooks and composes components. No Rust backend changes needed — this is purely a frontend refactoring.

**Tech Stack:** React 19, TypeScript 5.9, Zustand v5, Tauri 2 IPC, shadcn/ui, lucide-react, sonner

---

## File Structure Map

### New Files (10)

| File | Responsibility | Lines (est.) |
|------|---------------|-------------|
| `src/lib/payload-dumper/usePayloadEvents.ts` | Subscribe to `payload:progress` Tauri events, update store | ~25 |
| `src/lib/payload-dumper/usePayloadActions.ts` | All handler functions (check URL, load partitions, extract, reset, etc.) | ~180 |
| `src/components/payload-dumper/ExtractionProgressBar.tsx` | Progress bar with percentage display | ~30 |
| `src/components/payload-dumper/LoadingState.tsx` | Loading spinner stage indicator | ~30 |
| `src/components/payload-dumper/FileBanner.tsx` | File info banner with action buttons | ~80 |
| `src/components/payload-dumper/PartitionRow.tsx` | Single partition row (checkbox, name, progress, size) | ~60 |
| `src/components/payload-dumper/PartitionTable.tsx` | Summary bar + table header + row iteration | ~80 |
| `src/components/payload-dumper/ActionFooter.tsx` | Reset + Extract buttons with dynamic labels | ~50 |
| `src/components/payload-dumper/PayloadSourceTabs.tsx` | Local/Remote tabs with DropZone + RemoteUrlPanel | ~50 |
| `src/components/payload-dumper/ExtractionStatusCard.tsx` | Success/error outcome card with file list | ~70 |

### Modified Files (1)

| File | Change |
|------|--------|
| `src/components/views/ViewPayloadDumper.tsx` | Reduce from 957 → ~150 lines by importing hooks and components |

### Unchanged Files (for reference)

- `src/lib/payloadDumperStore.ts` — Zustand store (no changes)
- `src/lib/desktop/backend.ts` — Tauri command wrappers (no changes)
- `src/lib/desktop/runtime.ts` — Event system (no changes)
- `src/lib/errorHandler.ts` — Error/success handlers (no changes)
- `src/lib/utils.ts` — `cn()`, `getFileName()`, `formatBytesNum()` (no changes)
- `src/components/CheckboxItem.tsx` — Shared checkbox (no changes)
- `src/components/DropZone.tsx` — Shared drop zone (no changes)
- `src/components/RemoteUrlPanel.tsx` — Remote URL panel (no changes)

---

## Task 1: Create `usePayloadEvents` Hook

**Files:**
- Create: `src/lib/payload-dumper/usePayloadEvents.ts`

**Purpose:** Extract the `EventsOn('payload:progress')` event listener from `ViewPayloadDumper.tsx` (lines 114-129) into a dedicated hook. This hook subscribes to real-time progress events from the Rust backend and updates the Zustand store.

- [ ] **Step 1: Create the hook file**

Create `src/lib/payload-dumper/usePayloadEvents.ts`:

```typescript
import { useEffect } from 'react';
import { EventsOn } from '@/lib/desktop/runtime';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';

/**
 * Subscribes to 'payload:progress' Tauri events from the Rust backend.
 * Updates partition progress and marks partitions as completed in the store.
 *
 * This hook has no return value — it's a side-effect-only hook.
 * Call it once in the component that owns the extraction lifecycle.
 */
export function usePayloadEvents(): void {
  const { updatePartitionProgress, markPartitionCompleted } = usePayloadDumperStore();

  useEffect(() => {
    const unlisten = EventsOn(
      'payload:progress',
      (data: { partitionName: string; current: number; total: number; completed: boolean }) => {
        updatePartitionProgress(data.partitionName, data.current, data.total);

        if (data.completed) {
          markPartitionCompleted(data.partitionName);
        }
      },
    );

    return unlisten;
  }, [updatePartitionProgress, markPartitionCompleted]);
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors related to the new file. The types match exactly what was in `ViewPayloadDumper.tsx` lines 114-129.

- [ ] **Step 3: Commit**

```bash
git add src/lib/payload-dumper/usePayloadEvents.ts
git commit -m "refactor(payload-dumper): extract usePayloadEvents hook for progress event handling"
```

---

## Task 2: Create `usePayloadActions` Hook

**Files:**
- Create: `src/lib/payload-dumper/usePayloadActions.ts`

**Purpose:** Extract all handler functions from `ViewPayloadDumper.tsx` into a single hook. This hook orchestrates backend commands, manages local UI state, and returns callable methods. It receives local state (`mode`, `remoteUrl`, `prefetch`, etc.) as options and returns all action handlers.

**Key design decisions:**
- `cancelLoadingRef` is created inside this hook and returned — the component doesn't need to manage it
- The hook receives `mode`, `remoteUrl`, `prefetch`, `connectionStatus`, `setConnectionStatus`, `setEstimatedSize` as options
- All handlers use `useCallback` with stable dependencies
- The `loadPartitions` helper is defined inside the hook but not exposed (used by `handlePayloadDrop` and `handleSelectPayload`)

- [ ] **Step 1: Create the hook file**

Create `src/lib/payload-dumper/usePayloadActions.ts`:

```typescript
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useLogStore } from '@/lib/logStore';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import {
  SelectPayloadFile,
  SelectOutputDirectory,
  ListPayloadPartitionsWithDetails,
  ExtractPayload,
  OpenFolder,
  CleanupPayloadCache,
  CheckRemotePayload,
  ListRemotePayloadPartitions,
} from '@/lib/desktop/backend';
import type { ConnectionStatus } from '@/components/RemoteUrlPanel';
import { formatBytesNum } from '@/lib/utils';

interface UsePayloadActionsOptions {
  mode: 'local' | 'remote';
  remoteUrl: string;
  prefetch: boolean;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setEstimatedSize: (size: string | null) => void;
  setMode: (mode: 'local' | 'remote') => void;
  setRemoteUrl: (url: string) => void;
  setPrefetch: (prefetch: boolean) => void;
  status: string;
}

interface PayloadActions {
  handleCheckUrl: () => Promise<void>;
  loadRemotePartitions: () => Promise<void>;
  handleCancelLoadPartitions: () => void;
  handlePayloadDrop: (paths: string[]) => Promise<void>;
  handleSelectPayload: () => Promise<void>;
  handleSelectOutput: () => Promise<void>;
  handleOpenOutputFolder: () => Promise<void>;
  handleRefreshPartitions: () => Promise<void>;
  handleExtract: () => Promise<void>;
  handleReset: () => void;
}

export function usePayloadActions(options: UsePayloadActionsOptions): PayloadActions {
  const {
    mode,
    remoteUrl,
    prefetch,
    connectionStatus,
    setConnectionStatus,
    setEstimatedSize,
    setMode,
    setRemoteUrl,
    setPrefetch,
    status,
  } = options;

  const {
    payloadPath,
    outputPath,
    partitions,
    outputDir,
    completedPartitions,
    setPayloadPath,
    setOutputPath,
    setPartitions,
    setStatus,
    setExtractedFiles,
    setErrorMessage,
    setOutputDir,
    setExtractingPartitions,
    addCompletedPartitions,
    clearPartitionProgress,
    reset,
  } = usePayloadDumperStore();

  // Ref to track if loading should be cancelled (avoids stale closure issues)
  const cancelLoadingRef = useRef(false);

  // Load partitions from local file (internal helper, not exposed)
  const loadPartitions = useCallback(
    async (path: string) => {
      if (!path) return;

      setStatus('loading-partitions');
      setErrorMessage('');
      useLogStore.getState().addLog('Loading partitions from payload...', 'info');

      try {
        debugLog(`Loading partitions from: ${path}`);
        const partitionList = await ListPayloadPartitionsWithDetails(path);
        if (partitionList && partitionList.length > 0) {
          const currentCompleted = usePayloadDumperStore.getState().completedPartitions;

          setPartitions(
            partitionList.map((p) => ({
              name: p.name,
              size: p.size,
              selected: !currentCompleted.has(p.name),
            })),
          );
          setStatus('ready');
          toast.success(`Found ${partitionList.length} partitions`);
          handleSuccess('Load Partitions', `Found ${partitionList.length} partitions`);
        } else {
          setErrorMessage('No partitions found in payload');
          setStatus('error');
          useLogStore.getState().addLog('No partitions found in payload', 'error');
        }
      } catch (error) {
        setErrorMessage(String(error));
        setStatus('error');
        handleError('Load Partitions', error);
      }
    },
    [setStatus, setErrorMessage, setPartitions],
  );

  // Handle remote URL connection check
  const handleCheckUrl = useCallback(async () => {
    if (!remoteUrl.trim()) return;

    setConnectionStatus('checking');
    setEstimatedSize(null);

    try {
      debugLog(`Checking remote URL: ${remoteUrl}`);
      const info = await CheckRemotePayload(remoteUrl.trim());
      if (info.supportsRanges) {
        setConnectionStatus('ready');
        setEstimatedSize(formatBytesNum(info.contentLength));
        toast.success('URL verified - range requests supported');
        useLogStore.getState().addLog(`URL verified: ${formatBytesNum(info.contentLength)}`, 'info');
      } else {
        setConnectionStatus('error');
        toast.error('Server does not support range requests');
        useLogStore.getState().addLog('Server does not support range requests', 'error');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error(`Failed to check URL: ${error}`);
      handleError('Check Remote URL', error);
    }
  }, [remoteUrl, setConnectionStatus, setEstimatedSize]);

  // Load partitions from remote URL
  const loadRemotePartitions = useCallback(async () => {
    if (!remoteUrl.trim()) return;

    cancelLoadingRef.current = false;
    setStatus('loading-partitions');
    setErrorMessage('');
    useLogStore.getState().addLog('Loading partitions from remote URL...', 'info');

    try {
      debugLog(`Loading remote partitions from: ${remoteUrl}`);
      const partitionList = await ListRemotePayloadPartitions(remoteUrl.trim());

      if (cancelLoadingRef.current) {
        useLogStore.getState().addLog('Loading partitions cancelled by user', 'info');
        setStatus('idle');
        return;
      }

      if (partitionList && partitionList.length > 0) {
        setPayloadPath(remoteUrl.trim());
        setPartitions(
          partitionList.map((p) => ({
            name: p.name,
            size: p.size,
            selected: true,
          })),
        );
        setStatus('ready');
        toast.success(`Found ${partitionList.length} partitions`);
        handleSuccess('Load Remote Partitions', `Found ${partitionList.length} partitions`);
      } else {
        setErrorMessage('No partitions found in remote payload');
        setStatus('error');
        useLogStore.getState().addLog('No partitions found in remote payload', 'error');
      }
    } catch (error) {
      if (cancelLoadingRef.current) {
        useLogStore.getState().addLog('Loading partitions cancelled by user', 'info');
        return;
      }
      setErrorMessage(String(error));
      setStatus('error');
      handleError('Load Remote Partitions', error);
    } finally {
      cancelLoadingRef.current = false;
    }
  }, [remoteUrl, setPartitions, setPayloadPath, setStatus, setErrorMessage]);

  // Cancel loading partitions from remote URL
  const handleCancelLoadPartitions = useCallback(() => {
    cancelLoadingRef.current = true;
    setStatus('idle');
    useLogStore.getState().addLog('Cancelling partition loading...', 'info');
  }, [setStatus]);

  // Handle payload file dropped via DropZone
  const handlePayloadDrop = useCallback(
    async (paths: string[]) => {
      if (status === 'extracting' || status === 'loading-partitions') return;
      if (paths.length === 0) return;

      const filePath = paths[0];
      await CleanupPayloadCache();
      setPayloadPath(filePath);
      toast.success('Payload file selected');
      useLogStore.getState().addLog(`Selected payload: ${filePath}`, 'info');
      await loadPartitions(filePath);
    },
    [status, setPayloadPath, loadPartitions],
  );

  const handleSelectPayload = useCallback(async () => {
    try {
      debugLog('Selecting payload file');
      const path = await SelectPayloadFile();
      if (path) {
        await CleanupPayloadCache();
        setPayloadPath(path);
        toast.success('Payload file selected');
        useLogStore.getState().addLog(`Selected payload: ${path}`, 'info');
        await loadPartitions(path);
      }
    } catch (error) {
      handleError('Select Payload File', error);
    }
  }, [setPayloadPath, loadPartitions]);

  const handleSelectOutput = useCallback(async () => {
    try {
      debugLog('Selecting output directory');
      const path = await SelectOutputDirectory();
      if (path) {
        setOutputPath(path);
        toast.success('Output directory selected');
        useLogStore.getState().addLog(`Selected output directory: ${path}`, 'info');
      }
    } catch (error) {
      handleError('Select Output Directory', error);
    }
  }, [setOutputPath]);

  const handleOpenOutputFolder = useCallback(async () => {
    const effectiveOutputPath = outputDir || outputPath;
    if (!effectiveOutputPath) {
      toast.error('No output folder to open');
      return;
    }
    try {
      debugLog(`Opening folder: ${effectiveOutputPath}`);
      await OpenFolder(effectiveOutputPath);
    } catch (error) {
      handleError('Open Output Folder', error);
    }
  }, [outputDir, outputPath]);

  const handleRefreshPartitions = useCallback(async () => {
    if (!payloadPath) return;
    if (
      mode === 'remote' ||
      payloadPath.startsWith('http://') ||
      payloadPath.startsWith('https://')
    ) {
      await loadRemotePartitions();
    } else {
      await loadPartitions(payloadPath);
    }
  }, [payloadPath, mode, loadRemotePartitions, loadPartitions]);

  const handleExtract = useCallback(async () => {
    if (!payloadPath) {
      toast.error('Please select a payload file');
      return;
    }

    const partitionsToExtract = partitions
      .filter((p) => p.selected && !completedPartitions.has(p.name))
      .map((p) => p.name);

    if (partitionsToExtract.length === 0) {
      const selectedCount = partitions.filter((p) => p.selected).length;
      if (selectedCount > 0 && completedPartitions.size > 0) {
        toast.info('All selected partitions have already been extracted');
      } else {
        toast.error('Please select at least one partition');
      }
      return;
    }

    setStatus('extracting');
    setErrorMessage('');
    setExtractingPartitions(new Set(partitionsToExtract));

    const toastId = toast.loading(`Extracting ${partitionsToExtract.length} partition(s)...`);
    useLogStore.getState().addLog(`Starting extraction of ${partitionsToExtract.length} partitions...`, 'info');

    try {
      const targetOutputPath = outputDir || outputPath;
      const result = await ExtractPayload(
        payloadPath,
        targetOutputPath,
        partitionsToExtract,
        mode === 'remote' ? prefetch : undefined,
      );

      if (result.success) {
        const newFiles = result.extractedFiles || [];
        setExtractedFiles([...usePayloadDumperStore.getState().extractedFiles, ...newFiles]);
        setOutputDir(result.outputDir || '');
        setStatus('success');

        const newCompleted = newFiles.map((f) => f.replace('.img', ''));
        addCompletedPartitions(newCompleted);
        setExtractingPartitions(new Set());
        clearPartitionProgress();

        toast.success(`Extraction complete! ${newFiles.length} files extracted`, { id: toastId });
        useLogStore.getState().addLog(
          `Extraction complete: ${newFiles.length} files to ${result.outputDir}`,
          'success',
        );
      } else {
        setErrorMessage(result.error || 'Unknown error');
        setStatus('error');
        setExtractingPartitions(new Set());
        clearPartitionProgress();
        toast.error(`Extraction failed: ${result.error}`, { id: toastId });
        useLogStore.getState().addLog(`Extraction failed: ${result.error}`, 'error');
      }
    } catch (error) {
      setErrorMessage(String(error));
      setStatus('error');
      setExtractingPartitions(new Set());
      clearPartitionProgress();
      toast.error(`Extraction failed: ${error}`, { id: toastId });
      useLogStore.getState().addLog(`Extraction failed: ${error}`, 'error');
    }
  }, [
    payloadPath, partitions, completedPartitions, outputDir, outputPath,
    mode, prefetch, setStatus, setErrorMessage, setExtractingPartitions,
    setExtractedFiles, setOutputDir, addCompletedPartitions, clearPartitionProgress,
  ]);

  const handleReset = useCallback(() => {
    reset();
    setMode('local');
    setRemoteUrl('');
    setPrefetch(false);
    setConnectionStatus('idle');
    setEstimatedSize(null);
    cancelLoadingRef.current = false;
    useLogStore.getState().addLog('Payload Dumper reset', 'info');
  }, [reset, setMode, setRemoteUrl, setPrefetch, setConnectionStatus, setEstimatedSize]);

  return {
    handleCheckUrl,
    loadRemotePartitions,
    handleCancelLoadPartitions,
    handlePayloadDrop,
    handleSelectPayload,
    handleSelectOutput,
    handleOpenOutputFolder,
    handleRefreshPartitions,
    handleExtract,
    handleReset,
  };
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors. All types match the original implementation exactly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/payload-dumper/usePayloadActions.ts
git commit -m "refactor(payload-dumper): extract usePayloadActions hook for backend orchestration"
```

---

## Task 3: Create `ExtractionProgressBar` Component

**Files:**
- Create: `src/components/payload-dumper/ExtractionProgressBar.tsx`

**Purpose:** Extract the progress bar component from `ViewPayloadDumper.tsx` (lines 44-72). Shows a shadcn `Progress` bar with percentage text. Used both for overall extraction and per-partition progress.

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/ExtractionProgressBar.tsx`:

```typescript
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ExtractionProgressBarProps {
  isExtracting: boolean;
  isCompleted: boolean;
  realProgress?: number;
}

/**
 * Extraction progress indicator using shadcn Progress component.
 * Shows percentage with color coding: green for completed, primary for in-progress.
 */
export function ExtractionProgressBar({
  isExtracting,
  isCompleted,
  realProgress,
}: ExtractionProgressBarProps) {
  const displayProgress = isCompleted ? 100 : (realProgress ?? 0);
  if (!isExtracting && !isCompleted) return null;

  return (
    <div className="flex items-center gap-2 w-full">
      <Progress
        value={displayProgress}
        className={cn('flex-1 h-1.5', isCompleted ? '[&>div]:bg-success' : '')}
      />
      <span
        className={cn(
          'text-[10px] font-medium tabular-nums w-8 text-right shrink-0',
          isCompleted ? 'text-success' : 'text-primary',
        )}
      >
        {Math.round(displayProgress)}%
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/ExtractionProgressBar.tsx
git commit -m "refactor(payload-dumper): extract ExtractionProgressBar component"
```

---

## Task 4: Create `LoadingState` Component

**Files:**
- Create: `src/components/payload-dumper/LoadingState.tsx`

**Purpose:** Extract the loading state UI from `ViewPayloadDumper.tsx` (lines 544-565). Shows a centered spinner with contextual message based on mode and file type.

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/LoadingState.tsx`:

```typescript
import { Loader2 } from 'lucide-react';
import { getFileName } from '@/lib/utils';

interface LoadingStateProps {
  mode: 'local' | 'remote';
  remoteUrl: string;
  payloadPath: string;
}

/**
 * Loading stage indicator shown while partitions are being loaded.
 * Displays contextual messages based on source type (remote URL, ZIP, or plain .bin).
 */
export function LoadingState({ mode, remoteUrl, payloadPath }: LoadingStateProps) {
  const getMessage = (): string => {
    if (mode === 'remote') return 'Connecting to remote URL...';
    if (payloadPath.toLowerCase().endsWith('.zip')) return 'Extracting payload from ZIP...';
    return 'Parsing partition manifest...';
  };

  const getSubtitle = (): string => {
    if (mode === 'remote') return remoteUrl;
    return getFileName(payloadPath);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <div className="relative rounded-full bg-primary/10 p-5">
          <Loader2 className="size-8 text-primary animate-spin" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-sm font-medium">{getMessage()}</p>
        <p className="text-xs text-muted-foreground truncate max-w-xs" title={getSubtitle()}>
          {getSubtitle()}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/LoadingState.tsx
git commit -m "refactor(payload-dumper): extract LoadingState component"
```

---

## Task 5: Create `PartitionRow` Component

**Files:**
- Create: `src/components/payload-dumper/PartitionRow.tsx`

**Purpose:** Extract a single partition row from `ViewPayloadDumper.tsx` (lines 719-820). Each row shows checkbox/completed indicator, partition name with icon, optional progress bar, and size. Uses `React.memo` for performance since there can be 50+ rows.

**Key design decisions:**
- `React.memo` prevents re-renders when other rows update
- Grid columns match the table header via `showProgress` prop
- Accessibility: `role="checkbox"`, `aria-checked`, `aria-disabled`, `tabIndex`, `onKeyDown`

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/PartitionRow.tsx`:

```typescript
import React from 'react';
import { CheckCircle2, HardDrive, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CheckboxItem } from '@/components/CheckboxItem';
import { ExtractionProgressBar } from './ExtractionProgressBar';
import { formatBytesNum } from '@/lib/utils';

interface PartitionRowProps {
  partition: { name: string; size: number; selected: boolean };
  index: number;
  isExtracting: boolean;
  isCompleted: boolean;
  progressPercent: number;
  showProgress: boolean;
  onToggle: (index: number) => void;
  disabled: boolean;
}

/**
 * Single partition row in the partition table.
 * Memoized to prevent unnecessary re-renders when other rows update.
 */
export const PartitionRow = React.memo(function PartitionRow({
  partition,
  index,
  isExtracting,
  isCompleted,
  progressPercent,
  showProgress,
  onToggle,
  disabled,
}: PartitionRowProps) {
  return (
    <div
      onClick={() => !disabled && !isCompleted && onToggle(index)}
      role="checkbox"
      aria-checked={isCompleted ? true : partition.selected}
      aria-disabled={disabled || isCompleted}
      tabIndex={isCompleted || disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled && !isCompleted) {
          e.preventDefault();
          onToggle(index);
        }
      }}
      className={cn(
        'grid gap-2 px-4 py-3 text-sm transition-colors items-center',
        showProgress
          ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
          : 'grid-cols-[28px_minmax(0,1fr)_72px]',
        !disabled && !isCompleted && 'cursor-pointer hover:bg-muted/50',
        partition.selected && !isCompleted && 'bg-primary/5',
        isCompleted && 'bg-success/5',
      )}
    >
      {/* Checkbox / completed */}
      {isCompleted ? (
        <CheckCircle2 className="h-5 w-5 text-success" />
      ) : (
        <CheckboxItem checked={partition.selected} disabled={disabled} />
      )}

      {/* Name */}
      <div className="flex items-center gap-2 min-w-0">
        {isExtracting && !isCompleted ? (
          <Loader2 className="h-4 w-4 shrink-0 text-primary animate-spin" />
        ) : (
          <HardDrive
            className={cn(
              'h-4 w-4 shrink-0',
              isCompleted
                ? 'text-success'
                : partition.selected
                  ? 'text-primary'
                  : 'text-muted-foreground',
            )}
          />
        )}
        <span
          className={cn(
            'font-medium truncate',
            isCompleted
              ? 'text-success'
              : partition.selected
                ? 'text-foreground'
                : 'text-muted-foreground',
          )}
        >
          {partition.name}
        </span>
      </div>

      {/* Progress — only when extraction active */}
      {showProgress && (
        <div className="flex items-center justify-center">
          <ExtractionProgressBar
            isExtracting={isExtracting}
            isCompleted={isCompleted}
            realProgress={progressPercent}
          />
        </div>
      )}

      {/* Size */}
      <span
        className={cn(
          'text-xs tabular-nums text-right',
          isCompleted ? 'text-success font-medium' : 'text-muted-foreground',
        )}
      >
        {formatBytesNum(partition.size)}
      </span>
    </div>
  );
});
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/PartitionRow.tsx
git commit -m "refactor(payload-dumper): extract PartitionRow component with React.memo"
```

---

## Task 6: Create `PartitionTable` Component

**Files:**
- Create: `src/components/payload-dumper/PartitionTable.tsx`

**Purpose:** Extract the partition table (summary bar + header + row iteration) from `ViewPayloadDumper.tsx` (lines 680-825). Manages adaptive columns and iterates over partitions. Includes the "Select All / Deselect All" toggle button.

**Key design decisions:**
- Receives pre-computed values (`isExtractionActive`, `partitionProgress` map) from parent
- Uses `PartitionRow` component from Task 5
- Summary bar shows selected count, extracted count, and size to extract

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/PartitionTable.tsx`:

```typescript
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatBytesNum } from '@/lib/utils';
import { PartitionRow } from './PartitionRow';

interface PartitionTableProps {
  partitions: Array<{ name: string; size: number; selected: boolean }>;
  extractingPartitions: Set<string>;
  completedPartitions: Set<string>;
  partitionProgress: Map<string, { current: number; total: number; percentage: number }>;
  isExtractionActive: boolean;
  status: string;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
}

/**
 * Partition table with adaptive column layout.
 * Shows 3 columns (checkbox, name, size) normally,
 * expands to 4 columns (+ progress) during/after extraction.
 * Includes summary bar with select/deselect all toggle.
 */
export function PartitionTable({
  partitions,
  extractingPartitions,
  completedPartitions,
  partitionProgress,
  isExtractionActive,
  status,
  onToggle,
  onToggleAll,
}: PartitionTableProps) {
  if (partitions.length === 0) return null;

  const selectedCount = partitions.filter((p) => p.selected).length;
  const hasCompletedPartitions = completedPartitions.size > 0;
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const toExtractCount = partitions.filter(
    (p) => p.selected && !completedPartitions.has(p.name),
  ).length;
  const toExtractSize = partitions
    .filter((p) => p.selected && !completedPartitions.has(p.name))
    .reduce((acc, p) => acc + p.size, 0);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Summary + toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">
          {selectedCount}/{partitions.length} selected
          {hasCompletedPartitions && ` \u2022 ${completedPartitions.size} extracted`}
          {toExtractCount > 0 && ` \u2022 ${formatBytesNum(toExtractSize)} to extract`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleAll}
          className="text-xs h-7"
          disabled={status === 'extracting'}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {/* Table container */}
      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        {/* Header — adaptive */}
        <div
          className={cn(
            'grid gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground',
            isExtractionActive
              ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
              : 'grid-cols-[28px_minmax(0,1fr)_72px]',
          )}
        >
          <span></span>
          <span>Partition</span>
          {isExtractionActive && <span className="text-center">Progress</span>}
          <span className="text-right">Size</span>
        </div>

        {/* Rows — scrollable */}
        <div className="divide-y divide-border/50 max-h-100 overflow-y-auto">
          {partitions.map((partition, index) => {
            const isRowExtracting = extractingPartitions.has(partition.name);
            const isRowCompleted = completedPartitions.has(partition.name);
            const progress = partitionProgress.get(partition.name);
            const realProgressPercent = progress?.percentage ?? 0;

            return (
              <PartitionRow
                key={partition.name}
                partition={partition}
                index={index}
                isExtracting={isRowExtracting}
                isCompleted={isRowCompleted}
                progressPercent={realProgressPercent}
                showProgress={isExtractionActive}
                onToggle={onToggle}
                disabled={status === 'extracting'}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/PartitionTable.tsx
git commit -m "refactor(payload-dumper): extract PartitionTable component with summary bar"
```

---

## Task 7: Create `FileBanner` Component

**Files:**
- Create: `src/components/payload-dumper/FileBanner.tsx`

**Purpose:** Extract the file info banner from `ViewPayloadDumper.tsx` (lines 570-677). Shows file name/URL, partition count, total size, output path, and action buttons (change payload, refresh, select output, open folder).

**Key design decisions:**
- All action callbacks are passed from parent (no backend calls inside)
- Detects remote vs local mode via `isRemote` prop
- Output path shows green text when auto-detected (`outputDir` without `outputPath`)

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/FileBanner.tsx`:

```typescript
import { FileArchive, FolderOutput, ExternalLink, RefreshCw, Globe } from 'lucide-react';
import { cn, getFileName, formatBytesNum } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FileBannerProps {
  payloadPath: string;
  isRemote: boolean;
  remoteUrl: string;
  partitions: Array<{ name: string; size: number }>;
  totalPayloadSize: number;
  effectiveOutputPath: string;
  outputDir: string;
  outputPath: string;
  status: string;
  onSelectPayload: () => void;
  onRefreshPartitions: () => void;
  onSelectOutput: () => void;
  onOpenOutputFolder: () => void;
}

/**
 * File info banner showing payload details, partition count, and action buttons.
 * Zone 1 of the loaded state layout.
 */
export function FileBanner({
  payloadPath,
  isRemote,
  remoteUrl,
  partitions,
  totalPayloadSize,
  effectiveOutputPath,
  outputDir,
  outputPath,
  status,
  onSelectPayload,
  onRefreshPartitions,
  onSelectOutput,
  onOpenOutputFolder,
}: FileBannerProps) {
  const displayName = isRemote ? remoteUrl : getFileName(payloadPath);
  const isDisabled = status === 'extracting' || status === 'loading-partitions';

  return (
    <div className="rounded-lg bg-muted/30 border p-3 flex flex-col gap-2 w-full overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-1 overflow-hidden min-w-0">
          {isRemote ? (
            <Globe className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <FileArchive className="h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" title={displayName}>
              {displayName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSelectPayload}
                disabled={isDisabled}
              >
                <FileArchive className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Change Payload</TooltipContent>
          </Tooltip>
          {partitions.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRefreshPartitions}
                  disabled={status === 'loading-partitions' || status === 'extracting'}
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5',
                      status === 'loading-partitions' && 'animate-spin',
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh Partitions</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSelectOutput}
                disabled={status === 'extracting'}
              >
                <FolderOutput className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {effectiveOutputPath || 'Select Output Directory'}
            </TooltipContent>
          </Tooltip>
          {effectiveOutputPath && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onOpenOutputFolder}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open Output Folder</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        {partitions.length > 0 && (
          <span>
            {partitions.length} partitions &bull; {formatBytesNum(totalPayloadSize)} total
          </span>
        )}
        {effectiveOutputPath && (
          <>
            <span>&bull;</span>
            <div className="flex-1 min-w-0">
              <p
                className={cn('truncate', outputDir && !outputPath && 'text-success')}
                title={effectiveOutputPath}
              >
                {getFileName(effectiveOutputPath)}
                {outputDir && !outputPath && ' (auto)'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/FileBanner.tsx
git commit -m "refactor(payload-dumper): extract FileBanner component"
```

---

## Task 8: Create `ActionFooter` Component

**Files:**
- Create: `src/components/payload-dumper/ActionFooter.tsx`

**Purpose:** Extract the action footer from `ViewPayloadDumper.tsx` (lines 828-865). Contains Reset and Extract buttons with dynamic labels based on extraction state.

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/ActionFooter.tsx`:

```typescript
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytesNum } from '@/lib/utils';

interface ActionFooterProps {
  payloadPath: string;
  status: string;
  toExtractCount: number;
  toExtractSize: number;
  selectedCount: number;
  hasCompletedPartitions: boolean;
  onReset: () => void;
  onExtract: () => void;
}

/**
 * Action footer with Reset and Extract buttons.
 * Zone 3 of the loaded state layout.
 * Extract button shows dynamic labels based on state.
 */
export function ActionFooter({
  payloadPath,
  status,
  toExtractCount,
  toExtractSize,
  selectedCount,
  hasCompletedPartitions,
  onReset,
  onExtract,
}: ActionFooterProps) {
  const getExtractLabel = (): string => {
    if (status === 'extracting') return 'Extracting...';
    if (toExtractCount > 0) {
      return `Extract (${toExtractCount}) \u2014 ${formatBytesNum(toExtractSize)}`;
    }
    if (selectedCount > 0 && hasCompletedPartitions) return 'Already Extracted';
    return 'Select Partitions';
  };

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={status === 'extracting'}
        className="text-muted-foreground"
      >
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        Reset
      </Button>
      <Button
        onClick={onExtract}
        disabled={
          !payloadPath ||
          status === 'extracting' ||
          status === 'loading-partitions' ||
          toExtractCount === 0
        }
      >
        {status === 'extracting' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {getExtractLabel()}
          </>
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/ActionFooter.tsx
git commit -m "refactor(payload-dumper): extract ActionFooter component"
```

---

## Task 9: Create `PayloadSourceTabs` Component

**Files:**
- Create: `src/components/payload-dumper/PayloadSourceTabs.tsx`

**Purpose:** Extract the Local/Remote tabs from `ViewPayloadDumper.tsx` (lines 482-543). Contains `DropZone` for local files and `RemoteUrlPanel` for remote URLs.

**Note:** The original code also had a "Load Partitions from URL" button and "Cancel Loading" button inside the remote tab content. These are handled by the parent component's `actions.loadRemotePartitions` and `actions.handleCancelLoadPartitions`. However, looking at the original code more carefully, these buttons are inside the TabsContent and need access to `status` and the actions. The cleanest approach is to pass a `loadAction` prop that handles both the button rendering and the action.

Actually, reviewing the original code (lines 523-541), the "Load Partitions from URL" button and cancel button are rendered conditionally based on `connectionStatus === 'ready'` and `status === 'loading-partitions'`. Since these depend on state from the parent, we need to pass them as props.

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/PayloadSourceTabs.tsx`:

```typescript
import { FileArchive, Globe, XCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DropZone } from '@/components/DropZone';
import { RemoteUrlPanel, type ConnectionStatus } from '@/components/RemoteUrlPanel';

interface PayloadSourceTabsProps {
  mode: 'local' | 'remote';
  onModeChange: (mode: 'local' | 'remote') => void;
  remoteUrl: string;
  onUrlChange: (url: string) => void;
  prefetch: boolean;
  onPrefetchChange: (prefetch: boolean) => void;
  connectionStatus: ConnectionStatus;
  estimatedSize: string | null;
  onCheckUrl: () => void;
  onSelectPayload: () => void;
  onPayloadDrop: (paths: string[]) => void;
  isLoadingPartitions: boolean;
  onLoadRemotePartitions: () => void;
  onCancelLoadPartitions: () => void;
  disabled: boolean;
}

/**
 * Source selection tabs: Local File and Remote URL.
 * Shown when no payload is selected yet.
 */
export function PayloadSourceTabs({
  mode,
  onModeChange,
  remoteUrl,
  onUrlChange,
  prefetch,
  onPrefetchChange,
  connectionStatus,
  estimatedSize,
  onCheckUrl,
  onSelectPayload,
  onPayloadDrop,
  isLoadingPartitions,
  onLoadRemotePartitions,
  onCancelLoadPartitions,
  disabled,
}: PayloadSourceTabsProps) {
  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as 'local' | 'remote')} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="local" className="flex items-center gap-2">
          <FileArchive className="h-4 w-4" />
          Local File
        </TabsTrigger>
        <TabsTrigger value="remote" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Remote URL
        </TabsTrigger>
      </TabsList>

      <TabsContent value="local" className="mt-4">
        <DropZone
          onFilesDropped={onPayloadDrop}
          onBrowse={onSelectPayload}
          acceptExtensions={['.bin', '.zip']}
          rejectMessage="Only payload.bin or .zip files are accepted"
          icon={FileArchive}
          label="Drop payload.bin or OTA zip here"
          browseLabel="Select Payload File"
          sublabel="Accepts .bin and .zip files"
          disabled={disabled}
        />
      </TabsContent>

      <TabsContent value="remote" className="mt-4 min-w-0">
        <RemoteUrlPanel
          url={remoteUrl}
          onUrlChange={onUrlChange}
          prefetch={prefetch}
          onPrefetchChange={onPrefetchChange}
          connectionStatus={connectionStatus}
          estimatedSize={estimatedSize}
          onCheckUrl={onCheckUrl}
          disabled={disabled}
        />
        {connectionStatus === 'ready' && (
          <div className="mt-4 flex gap-2 min-w-0">
            {isLoadingPartitions ? (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={onCancelLoadPartitions}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Loading...
              </Button>
            ) : (
              <Button className="w-full" onClick={onLoadRemotePartitions}>
                <Globe className="mr-2 h-4 w-4" />
                Load Partitions from URL
              </Button>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/PayloadSourceTabs.tsx
git commit -m "refactor(payload-dumper): extract PayloadSourceTabs component"
```

---

## Task 10: Create `ExtractionStatusCard` Component

**Files:**
- Create: `src/components/payload-dumper/ExtractionStatusCard.tsx`

**Purpose:** Extract the success/error status card from `ViewPayloadDumper.tsx` (lines 870-954). Shows extraction results with file list and open folder button.

- [ ] **Step 1: Create the component file**

Create `src/components/payload-dumper/ExtractionStatusCard.tsx`:

```typescript
import { CheckCircle2, XCircle, FileDown, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ExtractionStatusCardProps {
  status: 'success' | 'error';
  extractedFiles: string[];
  outputDir: string;
  errorMessage: string;
  onOpenOutputFolder: () => void;
}

/**
 * Post-extraction status card showing success or error state.
 * On success: displays output directory and extracted file list.
 * On error: displays error message.
 */
export function ExtractionStatusCard({
  status,
  extractedFiles,
  outputDir,
  errorMessage,
  onOpenOutputFolder,
}: ExtractionStatusCardProps) {
  if (extractedFiles.length === 0) return null;

  return (
    <Card
      className={cn(
        'border-2 min-w-0',
        status === 'success'
          ? 'border-success/50 bg-success/5'
          : 'border-destructive/50 bg-destructive/5',
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle
          className={cn(
            'flex items-center gap-2 text-lg',
            status === 'success' ? 'text-success' : 'text-destructive',
          )}
        >
          {status === 'success' ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Extraction Complete
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5" />
              Extraction Failed
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'success' && (
          <div className="flex flex-col gap-3">
            {outputDir && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground font-medium">Saved to:</span>
                <div className="flex items-center gap-2 min-w-0">
                  <code
                    className="text-xs bg-muted px-3 py-2 rounded flex-1 min-w-0 truncate font-mono border select-all"
                    title={outputDir}
                  >
                    {outputDir}
                  </code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={onOpenOutputFolder}
                        className="h-9 w-9 shrink-0"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Open in File Explorer</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
            {extractedFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Extracted {extractedFiles.length} partition(s):
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {extractedFiles.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <FileDown className="h-3.5 w-3.5 text-success shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {status === 'error' && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify type consistency**

Run: `pnpm lint:web`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payload-dumper/ExtractionStatusCard.tsx
git commit -m "refactor(payload-dumper): extract ExtractionStatusCard component"
```

---

## Task 11: Refactor `ViewPayloadDumper.tsx` to Use Hooks and Components

**Files:**
- Modify: `src/components/views/ViewPayloadDumper.tsx`

**Purpose:** Replace the 957-line monolithic component with a slim ~150-line container that:
1. Imports and calls `usePayloadEvents()` and `usePayloadActions()` hooks
2. Imports all extracted sub-components
3. Computes derived values and passes them as props
4. Renders the component tree

This is the final integration step. The component should be functionally identical to before.

- [ ] **Step 1: Replace the entire file content**

Replace `src/components/views/ViewPayloadDumper.tsx` with:

```typescript
import { useMemo, useState } from 'react';
import { Package, FileArchive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';
import { cn } from '@/lib/utils';
import { usePayloadEvents } from '@/lib/payload-dumper/usePayloadEvents';
import { usePayloadActions } from '@/lib/payload-dumper/usePayloadActions';
import { PayloadSourceTabs } from '@/components/payload-dumper/PayloadSourceTabs';
import { LoadingState } from '@/components/payload-dumper/LoadingState';
import { FileBanner } from '@/components/payload-dumper/FileBanner';
import { PartitionTable } from '@/components/payload-dumper/PartitionTable';
import { ActionFooter } from '@/components/payload-dumper/ActionFooter';
import { ExtractionStatusCard } from '@/components/payload-dumper/ExtractionStatusCard';
import type { ConnectionStatus } from '@/components/RemoteUrlPanel';

export function ViewPayloadDumper() {
  const {
    payloadPath,
    outputPath,
    partitions,
    status,
    extractedFiles,
    errorMessage,
    outputDir,
    extractingPartitions,
    completedPartitions,
    partitionProgress,
    togglePartition,
    toggleAll,
  } = usePayloadDumperStore();

  // Local UI state
  const [mode, setMode] = useState<'local' | 'remote'>('local');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [prefetch, setPrefetch] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  // Subscribe to progress events
  usePayloadEvents();

  // All action handlers
  const actions = usePayloadActions({
    mode,
    remoteUrl,
    prefetch,
    connectionStatus,
    setConnectionStatus,
    setEstimatedSize,
    setMode,
    setRemoteUrl,
    setPrefetch,
    status,
  });

  // Derived values
  const selectedNotExtracted = useMemo(
    () => partitions.filter((p) => p.selected && !completedPartitions.has(p.name)),
    [partitions, completedPartitions],
  );
  const toExtractCount = selectedNotExtracted.length;
  const toExtractSize = selectedNotExtracted.reduce((acc, p) => acc + p.size, 0);
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const hasCompletedPartitions = completedPartitions.size > 0;
  const isExtractionActive = status === 'extracting' || hasCompletedPartitions;
  const totalPayloadSize = partitions.reduce((acc, p) => acc + p.size, 0);
  const effectiveOutputPath = outputDir || outputPath;
  const isRemote =
    mode === 'remote' ||
    payloadPath.startsWith('http://') ||
    payloadPath.startsWith('https://');

  return (
    <div className="flex flex-col gap-6 pb-10 w-full min-w-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <div className="relative h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Payload Dumper</h1>
          <p className="text-sm text-muted-foreground">
            Extract partition images from Android OTA payload.bin files
          </p>
        </div>
      </div>

      {/* Main Card */}
      <Card className="w-full overflow-hidden min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Extraction Setup
          </CardTitle>
          <CardDescription>Select payload file and output directory for extraction</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 w-full overflow-hidden min-w-0">
          {!payloadPath ? (
            /* State: Empty — Tabs for Local/Remote */
            <PayloadSourceTabs
              mode={mode}
              onModeChange={setMode}
              remoteUrl={remoteUrl}
              onUrlChange={setRemoteUrl}
              prefetch={prefetch}
              onPrefetchChange={setPrefetch}
              connectionStatus={connectionStatus}
              estimatedSize={estimatedSize}
              onCheckUrl={actions.handleCheckUrl}
              onSelectPayload={actions.handleSelectPayload}
              onPayloadDrop={actions.handlePayloadDrop}
              isLoadingPartitions={status === 'loading-partitions'}
              onLoadRemotePartitions={actions.loadRemotePartitions}
              onCancelLoadPartitions={actions.handleCancelLoadPartitions}
              disabled={status === 'extracting' || status === 'loading-partitions'}
            />
          ) : status === 'loading-partitions' && partitions.length === 0 ? (
            /* State: Loading — stage indicator */
            <LoadingState mode={mode} remoteUrl={remoteUrl} payloadPath={payloadPath} />
          ) : (
            /* State: Loaded — banner + table + footer */
            <>
              {/* Zone 1: File Info Banner */}
              <FileBanner
                payloadPath={payloadPath}
                isRemote={isRemote}
                remoteUrl={remoteUrl}
                partitions={partitions}
                totalPayloadSize={totalPayloadSize}
                effectiveOutputPath={effectiveOutputPath}
                outputDir={outputDir}
                outputPath={outputPath}
                status={status}
                onSelectPayload={actions.handleSelectPayload}
                onRefreshPartitions={actions.handleRefreshPartitions}
                onSelectOutput={actions.handleSelectOutput}
                onOpenOutputFolder={actions.handleOpenOutputFolder}
              />

              {/* Zone 2: Partition Table */}
              <PartitionTable
                partitions={partitions}
                extractingPartitions={extractingPartitions}
                completedPartitions={completedPartitions}
                partitionProgress={partitionProgress}
                isExtractionActive={isExtractionActive}
                status={status}
                onToggle={togglePartition}
                onToggleAll={() => toggleAll(!allSelected)}
              />

              {/* Zone 3: Action Footer */}
              <ActionFooter
                payloadPath={payloadPath}
                status={status}
                toExtractCount={toExtractCount}
                toExtractSize={toExtractSize}
                selectedCount={partitions.filter((p) => p.selected).length}
                hasCompletedPartitions={hasCompletedPartitions}
                onReset={actions.handleReset}
                onExtract={actions.handleExtract}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Status / Results Card */}
      <ExtractionStatusCard
        status={status as 'success' | 'error'}
        extractedFiles={extractedFiles}
        outputDir={outputDir}
        errorMessage={errorMessage}
        onOpenOutputFolder={actions.handleOpenOutputFolder}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run quality gates**

Run: `pnpm format:check`
Expected: May fail if formatting differs. If so, run `pnpm format` first.

Run: `pnpm lint:web`
Expected: 0 errors, 0 warnings.

Run: `pnpm build`
Expected: Clean build with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/views/ViewPayloadDumper.tsx
git commit -m "refactor(payload-dumper): integrate hooks and sub-components, reduce from 957 to ~150 lines"
```

---

## Task 12: Add Barrel Exports

**Files:**
- Create: `src/components/payload-dumper/index.ts`
- Create: `src/lib/payload-dumper/index.ts`

**Purpose:** Barrel exports for clean imports. This follows the pattern used in `src-tauri/src/commands/mod.rs` and `src-tauri/src/payload/mod.rs`.

- [ ] **Step 1: Create component barrel export**

Create `src/components/payload-dumper/index.ts`:

```typescript
export { PayloadSourceTabs } from './PayloadSourceTabs';
export { LoadingState } from './LoadingState';
export { FileBanner } from './FileBanner';
export { PartitionTable } from './PartitionTable';
export { PartitionRow } from './PartitionRow';
export { ExtractionProgressBar } from './ExtractionProgressBar';
export { ActionFooter } from './ActionFooter';
export { ExtractionStatusCard } from './ExtractionStatusCard';
```

- [ ] **Step 2: Create hook barrel export**

Create `src/lib/payload-dumper/index.ts`:

```typescript
export { usePayloadEvents } from './usePayloadEvents';
export { usePayloadActions } from './usePayloadActions';
```

- [ ] **Step 3: Run quality gates**

Run: `pnpm format:check`
Expected: Clean.

Run: `pnpm lint:web`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/payload-dumper/index.ts src/lib/payload-dumper/index.ts
git commit -m "refactor(payload-dumper): add barrel exports for clean imports"
```

---

## Self-Review

### 1. Spec Coverage Check

| Original Plan Requirement | Task |
|--------------------------|------|
| Create `usePayloadEvents.ts` | Task 1 |
| Create `usePayloadActions.ts` | Task 2 |
| Extract `ExtractionProgressBar` | Task 3 |
| Extract `ExtractionStatusCard` | Task 10 |
| Extract `ActionFooter` | Task 8 |
| Extract `PartitionRow` | Task 5 |
| Extract `PartitionTable` | Task 6 |
| Extract `PayloadSourceTabs` | Task 9 |
| Refactor `ViewPayloadDumper.tsx` | Task 11 |
| File info banner extraction | Task 7 |
| Loading state extraction | Task 4 |
| `cancelLoadingRef` handling | Task 2 (inside hook) |
| Barrel exports | Task 12 |

### 2. Placeholder Scan

- No "TBD", "TODO", "implement later" found
- All error handling is shown in actual code (Tasks 2, 11)
- All test commands specified (lint, build)
- No "Similar to Task N" patterns
- All types, function names, and props are consistent across tasks

### 3. Type Consistency Check

- `ConnectionStatus` imported from `@/components/RemoteUrlPanel` — consistent across Tasks 2, 9, 11
- `PartitionRow` receives `{ name: string; size: number; selected: boolean }` — matches store's `PartitionInfo`
- `formatBytesNum` used consistently from `@/lib/utils`
- `usePayloadActions` returns `PayloadActions` interface — all methods are `useCallback` wrapped
- `PartitionTable` includes summary bar with `onToggleAll` — matches original behavior
- `PayloadSourceTabs` receives `isLoadingPartitions`, `onLoadRemotePartitions`, `onCancelLoadPartitions` — matches original remote tab button behavior

### 4. Architecture Verification

- **No Rust changes needed** — this is purely frontend refactoring
- **Store unchanged** — `payloadDumperStore.ts` remains the single source of truth
- **Backend unchanged** — `backend.ts` wrappers remain the same
- **Each file has one clear responsibility** — hooks for logic, components for UI
- **Follows existing patterns** — uses `@/` alias, `cn()` for classes, shadcn components, semantic color tokens
- **Performance** — `PartitionRow` uses `React.memo` to prevent unnecessary re-renders

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-02-payload-dumper-refactor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
