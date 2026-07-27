import { create } from 'zustand';
import type { ViewType } from '@/app/shell/viewConfig';

/**
 * Global registry of long-running operations.
 *
 * Flash, push/pull, payload extraction, debloat batches and AVD launches all
 * lived in transient toasts that vanish after a few seconds. Producers register
 * here instead and the shell status bar renders the result: a persistent,
 * cancellable home for anything slower than a click.
 *
 * Deliberately **not** persisted — progress must never reach `localStorage`.
 *
 * Producer API (safe to call outside React):
 * ```ts
 * const id = startOperation({ label: 'Extracting system.img', progress: 0, view: 'payload' });
 * updateOperation(id, { detail: '12.4 MB/s', progress: 62 });
 * finishOperation(id);
 * ```
 */
export interface Operation {
  /** Present only when the producer can genuinely abort the work. */
  cancel: (() => void) | null;
  /** Secondary line: throughput, partition name, "3 of 12"… */
  detail: string | null;
  id: string;
  label: string;
  /** 0–100 when measurable; `null` renders as indeterminate. */
  progress: number | null;
  startedAt: number;
  /** Owning view — drives the sidebar activity badge. */
  view: ViewType | null;
}

export interface StartOperationInput {
  cancel?: (() => void) | null;
  detail?: string | null;
  label: string;
  progress?: number | null;
  view?: ViewType | null;
}

export interface OperationPatch {
  cancel?: (() => void) | null;
  detail?: string | null;
  label?: string;
  progress?: number | null;
}

interface OperationState {
  finish: (id: string) => void;
  operations: Operation[];
  start: (input: StartOperationInput) => string;
  update: (id: string, patch: OperationPatch) => void;
}

export const useOperationStore = create<OperationState>((set) => ({
  operations: [],

  start: (input) => {
    const operation: Operation = {
      cancel: input.cancel ?? null,
      detail: input.detail ?? null,
      id: crypto.randomUUID(),
      label: input.label,
      progress: input.progress ?? null,
      startedAt: Date.now(),
      view: input.view ?? null,
    };
    set((state) => ({ operations: [...state.operations, operation] }));
    return operation.id;
  },

  update: (id, patch) => {
    set((state) => ({
      operations: state.operations.map((operation) =>
        operation.id === id ? { ...operation, ...patch } : operation,
      ),
    }));
  },

  finish: (id) => {
    set((state) => ({
      operations: state.operations.filter((operation) => operation.id !== id),
    }));
  },
}));

export function startOperation(input: StartOperationInput): string {
  return useOperationStore.getState().start(input);
}

export function updateOperation(id: string, patch: OperationPatch): void {
  useOperationStore.getState().update(id, patch);
}

export function finishOperation(id: string): void {
  useOperationStore.getState().finish(id);
}

/**
 * Runs `work` while an entry is visible in the status bar, clearing it however
 * the promise settles. `work` owns its own error reporting.
 */
export async function trackOperation<T>(
  input: StartOperationInput,
  work: () => Promise<T>,
): Promise<T> {
  const id = startOperation(input);
  try {
    return await work();
  } finally {
    finishOperation(id);
  }
}

/**
 * Newest running operation, or `null`.
 *
 * Returns the stored object, so the identity only changes when that operation
 * actually changes — the status bar does not re-render on unrelated updates.
 */
export function useActiveOperation(): Operation | null {
  return useOperationStore((state) => state.operations[state.operations.length - 1] ?? null);
}

/** How many operations are queued behind the active one. */
export function usePendingOperationCount(): number {
  return useOperationStore((state) => Math.max(state.operations.length - 1, 0));
}

/** Number of operations owned by `view` — drives the sidebar activity badge. */
export function useViewActivityCount(view: ViewType): number {
  return useOperationStore((state) =>
    state.operations.reduce((total, operation) => (operation.view === view ? total + 1 : total), 0),
  );
}
