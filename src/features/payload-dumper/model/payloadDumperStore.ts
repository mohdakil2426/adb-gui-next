import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CancelExtraction, CreateCancellationToken } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useLogStore } from '@/shared/stores/logStore';
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
  cancelExtraction: () => void;
  cancelTokenId: string | null;
  clearExtractionState: () => void;
  clearHistory: () => void;
  clearPartitionProgress: () => void;
  completedPartitions: Set<string>;
  createAndSetCancellationToken: () => Promise<void>;
  errorMessage: string;
  extractedFiles: string[];
  extractingPartitions: Set<string>;
  extractionStats: backend.ExtractionStats | null;
  history: ExtractionRecord[];
  markPartitionCompleted: (name: string) => void;
  outputDir: string;
  outputPath: string;
  partitionProgress: Map<string, PartitionProgress>;
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
  setOutputDir: (dir: string) => void;
  setOutputPath: (path: string) => void;
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
  ) => void;
}
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
        set({ extractingPartitions: partitions });
      },
      setCompletedPartitions: (partitions) => {
        set({ completedPartitions: partitions });
      },
      addCompletedPartitions: (partitions) => {
        set((state) => {
          const updatedCompleted = new Set(state.completedPartitions);
          partitions.forEach((p) => updatedCompleted.add(p));
          const updatedPartitions = state.partitions.map((p) =>
            partitions.includes(p.name) ? { ...p, selected: false } : p,
          );
          return {
            completedPartitions: updatedCompleted,
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
          remoteMetadata: null,
          extractionStats: null,
        });
      },
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
        rehydratePayloadDumperState(state);
      },
    },
  ),
);
