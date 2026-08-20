import { toast } from 'sonner';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CreateCancellationToken } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useLogStore } from '@/shared/stores/logStore';
import { cancelPayloadExtraction } from './cancelPayloadExtraction';
import { payloadDumperInitialState } from './payloadDumperStoreDefaults';
import { usePayloadProgressStore } from './payloadProgressStore';

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}
export type ExtractionStatus =
  | 'idle'
  | 'loading-partitions'
  | 'ready'
  | 'extracting'
  | 'cancelling'
  | 'success'
  | 'error';
export type { PartitionExtractStatus } from './payloadProgressStore';
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
  createAndSetCancellationToken: () => Promise<void>;
  errorMessage: string;
  extractedFiles: string[];
  extractionStats: backend.ExtractionStats | null;
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
  partitions: PartitionInfo[];
  payloadPath: string;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  remoteUrl: string;
  reset: () => void;
  setActiveMode: (mode: 'local' | 'remote') => void;
  setCancelTokenId: (id: string | null) => void;
  setErrorMessage: (message: string) => void;
  setExtractedFiles: (files: string[]) => void;
  setExtractionStats: (stats: backend.ExtractionStats | null) => void;
  setLoadProgress: (progress: backend.PayloadLoadProgress, fromEvent?: boolean) => void;
  setOptimisticLoadStep: (step: number) => void;
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

function deselect(partitions: PartitionInfo[], names: Set<string>): PartitionInfo[] {
  return partitions.map((p) => (names.has(p.name) ? { ...p, selected: false } : p));
}

export const usePayloadDumperStore = create<PayloadDumperState>()(
  persist(
    (set) => ({
      // Status updates announced via role="status" / role="alert" in ExtractionStatusCard and toast channel
      ...payloadDumperInitialState,
      setPayloadPath: (path) => {
        usePayloadProgressStore.getState().clearAll();
        set({
          payloadPath: path,
          partitions: [],
          status: 'idle',
          extractedFiles: [],
          errorMessage: '',
          outputDir: '',
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
      addCompletedPartitions: (partitions) => {
        usePayloadProgressStore.getState().addCompleted(partitions);
        const completedNames = new Set(partitions);
        set((state) => ({ partitions: deselect(state.partitions, completedNames) }));
      },
      markPartitionCompleted: (name) => {
        usePayloadProgressStore.getState().markCompleted(name);
        set((state) => ({ partitions: deselect(state.partitions, new Set([name])) }));
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
        const { cancelTokenId, status } = usePayloadDumperStore.getState();
        cancelPayloadExtraction(cancelTokenId, status, set);
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
        usePayloadProgressStore.getState().clearAll();
        set({
          ...payloadDumperInitialState,
          history: [],
          remoteMetadata: null,
          extractionStats: null,
        });
      },
      clearExtractionState: () => {
        const progress = usePayloadProgressStore.getState();
        progress.clearTransientPartitionStatuses();
        progress.setExtractingPartitions(new Set<string>());
        progress.clearPartitionProgress();
        set({ status: 'ready', errorMessage: '' });
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
    },
  ),
);
