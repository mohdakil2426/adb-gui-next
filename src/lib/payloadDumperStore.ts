import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { backend } from '@/lib/desktop/models';
import { CreateCancellationToken, CancelExtraction } from '@/lib/desktop/backend';
import { useLogStore } from './logStore';
import { toast } from 'sonner';

interface PartitionInfo {
  name: string;
  size: number;
  selected: boolean;
}

// Real-time progress info per partition
interface PartitionProgress {
  current: number;
  total: number;
  percentage: number;
  bytesWritten: number;
  totalBytes: number;
  throughputMbps: number;
  etaSeconds: number;
}

export type ExtractionStatus =
  | 'idle'
  | 'loading-partitions'
  | 'ready'
  | 'extracting'
  | 'cancelling'
  | 'success'
  | 'error';

export interface ExtractionRecord {
  id: string;
  timestamp: number;
  payloadPath: string;
  outputDir: string;
  partitions: string[];
  duration: number;
  totalBytes: number;
  status: 'success' | 'error' | 'cancelled';
  error?: string;
}

interface PayloadDumperState {
  // Input/Output paths
  payloadPath: string;
  outputPath: string;

  // Remote mode
  remoteUrl: string;
  activeMode: 'local' | 'remote';

  // Partitions
  partitions: PartitionInfo[];

  // Status
  status: ExtractionStatus;
  extractedFiles: string[];
  errorMessage: string;
  outputDir: string;

  // Extraction tracking (persisted)
  extractingPartitions: Set<string>;
  completedPartitions: Set<string>;

  // Real-time progress per partition
  partitionProgress: Map<string, PartitionProgress>;

  // Extraction stats (after completion)
  extractionStats: backend.ExtractionStats | null;

  // Remote payload metadata (HTTP + ZIP + OTA manifest)
  remoteMetadata: backend.RemotePayloadMetadata | null;

  // Cancellation
  cancelTokenId: string | null;

  // Extraction history (persisted)
  history: ExtractionRecord[];

  // Actions
  setPayloadPath: (path: string) => void;
  setOutputPath: (path: string) => void;
  setRemoteUrl: (url: string) => void;
  setActiveMode: (mode: 'local' | 'remote') => void;
  setPartitions: (partitions: PartitionInfo[]) => void;
  togglePartition: (index: number) => void;
  toggleAll: (selected: boolean) => void;
  setStatus: (status: ExtractionStatus) => void;
  setExtractedFiles: (files: string[]) => void;
  setErrorMessage: (message: string) => void;
  setOutputDir: (dir: string) => void;
  setExtractingPartitions: (partitions: Set<string>) => void;
  setCompletedPartitions: (partitions: Set<string>) => void;
  addCompletedPartitions: (partitions: string[]) => void;
  markPartitionCompleted: (name: string) => void;
  updatePartitionProgress: (
    name: string,
    current: number,
    total: number,
    completed?: boolean,
    bytesWritten?: number,
    totalBytes?: number,
    throughputMbps?: number,
    etaSeconds?: number,
  ) => void;
  clearPartitionProgress: () => void;
  setExtractionStats: (stats: backend.ExtractionStats | null) => void;
  setRemoteMetadata: (metadata: backend.RemotePayloadMetadata | null) => void;
  setCancelTokenId: (id: string | null) => void;
  createAndSetCancellationToken: () => Promise<void>;
  cancelExtraction: () => void;
  addToHistory: (record: ExtractionRecord) => void;
  clearHistory: () => void;
  reset: () => void;
  clearExtractionState: () => void;
}

const initialState = {
  payloadPath: '',
  outputPath: '',
  remoteUrl: '',
  activeMode: 'local' as 'local' | 'remote',
  partitions: [] as PartitionInfo[],
  status: 'idle' as ExtractionStatus,
  extractedFiles: [] as string[],
  errorMessage: '',
  outputDir: '',
  extractingPartitions: new Set<string>(),
  completedPartitions: new Set<string>(),
  partitionProgress: new Map<string, PartitionProgress>(),
  remoteMetadata: null as backend.RemotePayloadMetadata | null,
  extractionStats: null as backend.ExtractionStats | null,
  cancelTokenId: null as string | null,
  history: [] as ExtractionRecord[],
};

export const usePayloadDumperStore = create<PayloadDumperState>()(
  persist(
    (set) => ({
      ...initialState,

      setPayloadPath: (path) => {
        set({
          payloadPath: path,
          // Only reset partitions and extraction state when new file is selected
          partitions: [],
          status: 'idle',
          extractedFiles: [],
          errorMessage: '',
          outputDir: '',
          extractingPartitions: new Set<string>(),
          completedPartitions: new Set<string>(),
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
          if (!partition) return { partitions: updated };
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
        set({ extractingPartitions: partitions });
      },

      setCompletedPartitions: (partitions) => {
        set({ completedPartitions: partitions });
      },

      // Add newly completed partitions and deselect them
      addCompletedPartitions: (partitions) => {
        set((state) => {
          const updatedCompleted = new Set(state.completedPartitions);
          partitions.forEach((p) => updatedCompleted.add(p));

          // Deselect extracted partitions
          const updatedPartitions = state.partitions.map((p) =>
            partitions.includes(p.name) ? { ...p, selected: false } : p,
          );

          return {
            completedPartitions: updatedCompleted,
            partitions: updatedPartitions,
          };
        });
      },

      // Mark a single partition as completed (called from progress events)
      markPartitionCompleted: (name) => {
        set((state) => {
          const updatedCompleted = new Set(state.completedPartitions);
          updatedCompleted.add(name);

          // Remove from extracting set
          const updatedExtracting = new Set(state.extractingPartitions);
          updatedExtracting.delete(name);

          // Deselect the completed partition
          const updatedPartitions = state.partitions.map((p) =>
            p.name === name ? { ...p, selected: false } : p,
          );

          return {
            completedPartitions: updatedCompleted,
            extractingPartitions: updatedExtracting,
            partitions: updatedPartitions,
          };
        });
      },

      // Update real-time progress for a specific partition
      updatePartitionProgress: (
        name,
        current,
        total,
        _completed,
        bytesWritten,
        totalBytes,
        throughputMbps,
        etaSeconds,
      ) => {
        set((state) => {
          const newProgress = new Map(state.partitionProgress);
          newProgress.set(name, {
            current,
            total,
            percentage: total > 0 ? Math.round((current / total) * 100) : 0,
            bytesWritten: bytesWritten ?? 0,
            totalBytes: totalBytes ?? 0,
            throughputMbps: throughputMbps ?? 0,
            etaSeconds: etaSeconds ?? 0,
          });
          return { partitionProgress: newProgress };
        });
      },

      // Clear all partition progress (after extraction completes)
      clearPartitionProgress: () => {
        set({ partitionProgress: new Map() });
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
        const tokenId = usePayloadDumperStore.getState().cancelTokenId;
        if (tokenId) {
          CancelExtraction(tokenId).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`Failed to cancel extraction: ${message}`);
            useLogStore.getState().addLog(`Error cancelling extraction: ${message}`, 'error');
          });
          set({ status: 'cancelling' });
        }
      },

      setExtractionStats: (stats) => {
        set({ extractionStats: stats });
      },

      // History actions
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
          ...initialState,
          history: [],
          extractingPartitions: new Set<string>(),
          completedPartitions: new Set<string>(),
          partitionProgress: new Map(),
          remoteMetadata: null,
          extractionStats: null,
        });
      },

      // Clear only extraction state but keep file and partitions
      clearExtractionState: () => {
        set({
          status: 'ready',
          extractingPartitions: new Set<string>(),
          errorMessage: '',
          partitionProgress: new Map(),
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
        if (state) {
          if (!state.extractingPartitions || !(state.extractingPartitions instanceof Set)) {
            state.extractingPartitions = new Set<string>();
          }
          if (!state.completedPartitions || !(state.completedPartitions instanceof Set)) {
            state.completedPartitions = new Set<string>();
          }
          if (!state.partitionProgress || !(state.partitionProgress instanceof Map)) {
            state.partitionProgress = new Map<string, PartitionProgress>();
          }
        }
      },
    },
  ),
);
