import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CreateCancellationToken } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useLogStore } from '@/shared/stores/logStore';
import { cancelPayloadExtraction } from './cancelPayloadExtraction';
import {
  payloadDumperInitialState,
  rehydratePayloadDumperState,
} from './payloadDumperStoreDefaults';

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}
interface PartitionProgress {
  bytesWritten: number;
  current: number;
  etaSeconds: number;
  percentage: number;
  throughputMbps: number;
  total: number;
  totalBytes: number;
}
export type ExtractionStatus =
  | 'idle'
  | 'loading-partitions'
  | 'ready'
  | 'extracting'
  | 'cancelling'
  | 'success'
  | 'error';
export type PartitionExtractStatus = backend.PartitionExtractStatus;
export interface ExtractionRecord {
  duration: number;
  error?: string;
  id: string;
  outputDir: string;
  partitions: string[];
  payloadPath: string;
  status: 'success' | 'error' | 'cancelled';
  timestamp: number;
  totalBytes: number;
}
interface PayloadDumperState {
  activeMode: 'local' | 'remote';
  addCompletedPartitions: (partitions: string[]) => void;
  addToHistory: (record: ExtractionRecord) => void;
  beginLoadProgress: () => void;
  cancelExtraction: () => void;
  cancelTokenId: string | null;
  clearExtractionState: () => void;
  clearHistory: () => void;
  clearLoadProgress: () => void;
  clearPartitionProgress: () => void;
  clearTransientPartitionStatuses: () => void;
  completedPartitions: Set<string>;
  createAndSetCancellationToken: () => Promise<void>;
  errorMessage: string;
  extractedFiles: string[];
  extractingPartitions: Set<string>;
  extractionStats: backend.ExtractionStats | null;
  failActivePartitions: () => void;
  history: ExtractionRecord[];
  loadDetail: string | null;
  loadMessage: string;
  loadPhase: backend.PayloadLoadPhase | null;
  loadProgressFromEvent: boolean;
  loadStartedAt: number | null;
  loadStep: number;
  loadTotalSteps: number;
  markPartitionCompleted: (name: string) => void;
  outputDir: string;
  outputPath: string;
  partitionProgress: Map<string, PartitionProgress>;
  partitionStatuses: Map<string, PartitionExtractStatus>;
  partitions: PartitionInfo[];
  payloadPath: string;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  remoteUrl: string;
  reset: () => void;
  setActiveMode: (mode: 'local' | 'remote') => void;
  setCancelTokenId: (id: string | null) => void;
  setCompletedPartitions: (partitions: Set<string>) => void;
  setErrorMessage: (message: string) => void;
  setExtractedFiles: (files: string[]) => void;
  setExtractingPartitions: (partitions: Set<string>) => void;
  setExtractionStats: (stats: backend.ExtractionStats | null) => void;
  setLoadProgress: (progress: backend.PayloadLoadProgress, fromEvent?: boolean) => void;
  setOptimisticLoadStep: (step: number) => void;
  setOutputDir: (dir: string) => void;
  setOutputPath: (path: string) => void;
  setPartitionStatus: (name: string, status: PartitionExtractStatus) => void;
  setPartitions: (partitions: PartitionInfo[]) => void;
  setPayloadPath: (path: string) => void;
  setRemoteMetadata: (metadata: backend.RemotePayloadMetadata | null) => void;
  setRemoteUrl: (url: string) => void;
  setStatus: (status: ExtractionStatus) => void;
  status: ExtractionStatus;
  toggleAll: (selected: boolean) => void;
  togglePartition: (index: number) => void;
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

const LOAD_PHASE_BY_STEP: backend.PayloadLoadPhase[] = [
  'verifyConnection',
  'locateIndex',
  'detectFormat',
  'readPartitions',
];

const LOAD_MESSAGE_BY_STEP = [
  'Verifying connection…',
  'Locating package index…',
  'Detecting format…',
  'Reading partition list…',
];
export const usePayloadDumperStore = create<PayloadDumperState>()(
  persist(
    (set) => ({
      ...payloadDumperInitialState,
      setPayloadPath: (path) => {
        set({
          payloadPath: path,
          partitions: [],
          status: 'idle',
          extractedFiles: [],
          errorMessage: '',
          outputDir: '',
          extractingPartitions: new Set<string>(),
          completedPartitions: new Set<string>(),
          partitionStatuses: new Map<string, PartitionExtractStatus>(),
          remoteMetadata: null,
        });
      },
      setOutputPath: (path) => {
        set({ outputPath: path });
      },
      setRemoteUrl: (url) => {
        set({ remoteUrl: url });
      },
      setActiveMode: (mode) => {
        set({ activeMode: mode });
      },
      setPartitions: (partitions) => {
        set({ partitions });
      },
      togglePartition: (index) => {
        set((state) => {
          const updated = [...state.partitions];
          const partition = updated[index];
          if (!partition) {
            return { partitions: updated };
          }
          updated[index] = { ...partition, selected: !partition.selected };
          return { partitions: updated };
        });
      },
      toggleAll: (selected) => {
        set((state) => ({
          partitions: state.partitions.map((p) => ({ ...p, selected })),
        }));
      },
      setStatus: (status) => {
        set({ status });
      },
      setExtractedFiles: (files) => {
        set({ extractedFiles: files });
      },
      setErrorMessage: (message) => {
        set({ errorMessage: message });
      },
      setOutputDir: (dir) => {
        set({ outputDir: dir });
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
          return {
            partitionStatuses: statuses,
            extractingPartitions: new Set<string>(),
          };
        });
      },
      clearTransientPartitionStatuses: () => {
        set((state) => {
          const statuses = new Map<string, PartitionExtractStatus>();
          for (const [name, status] of state.partitionStatuses) {
            if (status === 'completed') {
              statuses.set(name, status);
            }
          }
          return { partitionStatuses: statuses };
        });
      },
      addCompletedPartitions: (partitions) => {
        set((state) => {
          const updatedCompleted = new Set(state.completedPartitions);
          const statuses = new Map(state.partitionStatuses);
          const completedNames = new Set(partitions);
          for (const p of partitions) {
            updatedCompleted.add(p);
            statuses.set(p, 'completed');
          }
          const updatedPartitions = state.partitions.map((p) =>
            completedNames.has(p.name) ? { ...p, selected: false } : p,
          );
          return {
            completedPartitions: updatedCompleted,
            partitionStatuses: statuses,
            partitions: updatedPartitions,
          };
        });
      },
      markPartitionCompleted: (name) => {
        set((state) => {
          const updatedCompleted = new Set(state.completedPartitions);
          updatedCompleted.add(name);
          const updatedExtracting = new Set(state.extractingPartitions);
          updatedExtracting.delete(name);
          const statuses = new Map(state.partitionStatuses);
          statuses.set(name, 'completed');
          const updatedPartitions = state.partitions.map((p) =>
            p.name === name ? { ...p, selected: false } : p,
          );
          return {
            completedPartitions: updatedCompleted,
            extractingPartitions: updatedExtracting,
            partitionStatuses: statuses,
            partitions: updatedPartitions,
          };
        });
      },
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

          // Prefetch pseudo-partition is progress-only; do not drive row statuses.
          if (name === '__download__') {
            return { partitionProgress: newProgress };
          }

          const statuses = new Map(state.partitionStatuses);
          const nextStatus: PartitionExtractStatus =
            extractStatus ??
            (completed
              ? 'completed'
              : statuses.get(name) === 'completed'
                ? 'completed'
                : 'running');
          statuses.set(name, nextStatus);

          return { partitionProgress: newProgress, partitionStatuses: statuses };
        });
      },
      clearPartitionProgress: () => {
        set({ partitionProgress: new Map() });
      },
      beginLoadProgress: () => {
        set({
          loadDetail: null,
          loadMessage: LOAD_MESSAGE_BY_STEP[0] ?? 'Loading partitions…',
          loadPhase: 'verifyConnection',
          loadProgressFromEvent: false,
          loadStartedAt: Date.now(),
          loadStep: 1,
          loadTotalSteps: 4,
        });
      },
      clearLoadProgress: () => {
        set({
          loadDetail: null,
          loadMessage: '',
          loadPhase: null,
          loadProgressFromEvent: false,
          loadStartedAt: null,
          loadStep: 0,
          loadTotalSteps: 4,
        });
      },
      setLoadProgress: (progress, fromEvent = true) => {
        set({
          loadDetail: progress.detail,
          loadMessage: progress.message,
          loadPhase: progress.phase,
          loadProgressFromEvent:
            fromEvent || usePayloadDumperStore.getState().loadProgressFromEvent,
          loadStep: progress.step,
          loadTotalSteps: progress.totalSteps > 0 ? progress.totalSteps : 4,
        });
      },
      setOptimisticLoadStep: (step) => {
        const state = usePayloadDumperStore.getState();
        if (state.loadProgressFromEvent) {
          return;
        }
        const clamped = Math.min(Math.max(step, 1), 4);
        const index = clamped - 1;
        set({
          loadDetail: null,
          loadMessage: LOAD_MESSAGE_BY_STEP[index] ?? 'Loading partitions…',
          loadPhase: LOAD_PHASE_BY_STEP[index] ?? 'verifyConnection',
          loadStep: clamped,
          loadTotalSteps: 4,
        });
      },
      setRemoteMetadata: (metadata) => {
        set({ remoteMetadata: metadata });
      },
      setCancelTokenId: (id) => {
        set({ cancelTokenId: id });
      },
      createAndSetCancellationToken: async () => {
        try {
          const tokenId = await CreateCancellationToken();
          set({ cancelTokenId: tokenId });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to create cancellation token: ${message}`);
          useLogStore.getState().addLog(`Error creating cancellation token: ${message}`, 'error');
        }
      },
      cancelExtraction: () => {
        const { cancelTokenId, status, partitionStatuses } = usePayloadDumperStore.getState();
        cancelPayloadExtraction(cancelTokenId, status, set, partitionStatuses);
      },
      setExtractionStats: (stats) => {
        set({ extractionStats: stats });
      },
      addToHistory: (record) => {
        set((state) => ({
          history: [record, ...state.history].slice(0, 50),
        }));
      },
      clearHistory: () => {
        set({ history: [] });
      },
      reset: () => {
        set({
          ...payloadDumperInitialState,
          history: [],
          extractingPartitions: new Set<string>(),
          completedPartitions: new Set<string>(),
          partitionProgress: new Map(),
          partitionStatuses: new Map(),
          remoteMetadata: null,
          extractionStats: null,
        });
      },
      clearExtractionState: () => {
        set((state) => {
          const statuses = new Map<string, PartitionExtractStatus>();
          for (const [name, status] of state.partitionStatuses) {
            if (status === 'completed') {
              statuses.set(name, status);
            }
          }
          return {
            status: 'ready' as const,
            extractingPartitions: new Set<string>(),
            errorMessage: '',
            partitionProgress: new Map(),
            partitionStatuses: statuses,
          };
        });
      },
    }),
    {
      name: 'payload-dumper-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeMode: state.activeMode,
        remoteUrl: state.remoteUrl,
        outputPath: state.outputPath,
        history: state.history,
      }),
      onRehydrateStorage: () => (state) => {
        rehydratePayloadDumperState(state);
      },
    },
  ),
);
