import { create } from 'zustand';
import type { backend } from '@/desktop/models';

/**
 * High-frequency extraction telemetry, deliberately kept OUT of the persisted
 * `payloadDumperStore`.
 *
 * `zustand/persist` wraps `setState` unconditionally — no dirty check, no
 * debounce — so every progress event on a persisted store costs a
 * `{...get()}` + `partialize` + `JSON.stringify` + blocking
 * `localStorage.setItem`. Thousands of events per extraction made that the
 * dominant source of extraction jank. Nothing in this store is durable, so
 * nothing here is persisted.
 */

export interface PartitionProgress {
  bytesWritten: number;
  current: number;
  etaSeconds: number;
  percentage: number;
  throughputMbps: number;
  total: number;
  totalBytes: number;
}

export type PartitionExtractStatus = backend.PartitionExtractStatus;

/** Prefetch pseudo-partition: progress-only, never drives a table row status. */
export const DOWNLOAD_PARTITION = '__download__';

interface PayloadProgressState {
  addCompleted: (partitions: string[]) => void;
  clearAll: () => void;
  clearPartitionProgress: () => void;
  clearTransientPartitionStatuses: () => void;
  completedPartitions: Set<string>;
  extractingPartitions: Set<string>;
  failActivePartitions: () => void;
  markCompleted: (name: string) => void;
  partitionProgress: Map<string, PartitionProgress>;
  /** Per-partition extract lifecycle: pending | running | verifying | completed | failed */
  partitionStatuses: Map<string, PartitionExtractStatus>;
  setCompletedPartitions: (partitions: Set<string>) => void;
  setExtractingPartitions: (partitions: Set<string>) => void;
  setPartitionStatus: (name: string, status: PartitionExtractStatus) => void;
  updatePartitionProgress: (
    name: string,
    current: number,
    total: number,
    completed?: boolean,
    bytesWritten?: number,
    totalBytes?: number,
    throughputMbps?: number,
    etaSeconds?: number,
    extractStatus?: PartitionExtractStatus,
  ) => void;
}

function keepCompletedOnly(
  statuses: Map<string, PartitionExtractStatus>,
): Map<string, PartitionExtractStatus> {
  const kept = new Map<string, PartitionExtractStatus>();
  for (const [name, status] of statuses) {
    if (status === 'completed') {
      kept.set(name, status);
    }
  }
  return kept;
}

export const usePayloadProgressStore = create<PayloadProgressState>((set) => ({
  completedPartitions: new Set<string>(),
  extractingPartitions: new Set<string>(),
  partitionProgress: new Map<string, PartitionProgress>(),
  partitionStatuses: new Map<string, PartitionExtractStatus>(),

  updatePartitionProgress: (
    name,
    current,
    total,
    completed,
    bytesWritten,
    totalBytes,
    throughputMbps,
    etaSeconds,
    extractStatus,
  ) => {
    set((state) => {
      const newProgress = new Map(state.partitionProgress);
      const prev = newProgress.get(name);
      newProgress.set(name, {
        current,
        total,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        bytesWritten: bytesWritten ?? prev?.bytesWritten ?? 0,
        totalBytes: totalBytes ?? prev?.totalBytes ?? 0,
        // Keep last known throughput when event omits a sample (Rust only sends on interval).
        throughputMbps: throughputMbps ?? prev?.throughputMbps ?? 0,
        etaSeconds: etaSeconds ?? prev?.etaSeconds ?? 0,
      });

      if (name === DOWNLOAD_PARTITION) {
        return { partitionProgress: newProgress };
      }

      const statuses = new Map(state.partitionStatuses);
      const nextStatus: PartitionExtractStatus =
        extractStatus ??
        (completed ? 'completed' : statuses.get(name) === 'completed' ? 'completed' : 'running');
      statuses.set(name, nextStatus);

      return { partitionProgress: newProgress, partitionStatuses: statuses };
    });
  },

  markCompleted: (name) => {
    set((state) => {
      const updatedCompleted = new Set(state.completedPartitions);
      updatedCompleted.add(name);
      const updatedExtracting = new Set(state.extractingPartitions);
      updatedExtracting.delete(name);
      const statuses = new Map(state.partitionStatuses);
      statuses.set(name, 'completed');
      return {
        completedPartitions: updatedCompleted,
        extractingPartitions: updatedExtracting,
        partitionStatuses: statuses,
      };
    });
  },

  addCompleted: (partitions) => {
    set((state) => {
      const updatedCompleted = new Set(state.completedPartitions);
      const statuses = new Map(state.partitionStatuses);
      for (const p of partitions) {
        updatedCompleted.add(p);
        statuses.set(p, 'completed');
      }
      return { completedPartitions: updatedCompleted, partitionStatuses: statuses };
    });
  },

  setExtractingPartitions: (partitions) => {
    set((state) => {
      const statuses = new Map(state.partitionStatuses);
      for (const name of partitions) {
        if (statuses.get(name) !== 'completed') {
          statuses.set(name, 'pending');
        }
      }
      return { extractingPartitions: partitions, partitionStatuses: statuses };
    });
  },

  setCompletedPartitions: (partitions) => {
    set({ completedPartitions: partitions });
  },

  setPartitionStatus: (name, status) => {
    set((state) => {
      const statuses = new Map(state.partitionStatuses);
      statuses.set(name, status);
      return { partitionStatuses: statuses };
    });
  },

  failActivePartitions: () => {
    set((state) => {
      const statuses = new Map(state.partitionStatuses);
      for (const [name, status] of statuses) {
        if (status === 'pending' || status === 'running' || status === 'verifying') {
          statuses.set(name, 'failed');
        }
      }
      for (const name of state.extractingPartitions) {
        if (statuses.get(name) !== 'completed') {
          statuses.set(name, 'failed');
        }
      }
      return { partitionStatuses: statuses, extractingPartitions: new Set<string>() };
    });
  },

  clearTransientPartitionStatuses: () => {
    set((state) => ({ partitionStatuses: keepCompletedOnly(state.partitionStatuses) }));
  },

  clearPartitionProgress: () => {
    set({ partitionProgress: new Map<string, PartitionProgress>() });
  },

  clearAll: () => {
    set({
      completedPartitions: new Set<string>(),
      extractingPartitions: new Set<string>(),
      partitionProgress: new Map<string, PartitionProgress>(),
      partitionStatuses: new Map<string, PartitionExtractStatus>(),
    });
  },
}));
