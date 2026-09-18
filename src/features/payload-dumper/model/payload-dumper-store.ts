import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CreateCancellationToken } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { useLogStore } from "@/shared/stores/log-store";

import { cancelPayloadExtraction } from "./cancel-payload-extraction";
import { payloadDumperInitialState } from "./payload-dumper-store-defaults";
import { usePayloadProgressStore } from "./payload-progress-store";

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}
export type ExtractionStatus =
  | "idle"
  | "loading-partitions"
  | "ready"
  | "extracting"
  | "cancelling"
  | "success"
  | "error";
export type { PartitionExtractStatus } from "./payload-progress-store";
export interface ExtractionRecord {
  duration: number;
  error?: string;
  id: string;
  outputDir: string;
  partitions: string[];
  payloadPath: string;
  status: "success" | "error" | "cancelled";
  timestamp: number;
  totalBytes: number;
}
interface PayloadDumperState {
  activeMode: "local" | "remote";
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
  setActiveMode: (mode: "local" | "remote") => void;
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
  "verifyConnection",
  "locateIndex",
  "detectFormat",
  "readPartitions",
];

const LOAD_MESSAGE_BY_STEP = [
  "Verifying connection…",
  "Locating package index…",
  "Detecting format…",
  "Reading partition list…",
];

const deselect = (partitions: PartitionInfo[], names: Set<string>): PartitionInfo[] =>
  partitions.map((p) => (names.has(p.name) ? { ...p, selected: false } : p));

export const usePayloadDumperStore = create<PayloadDumperState>()(
  persist(
    (set) => ({
      // Status updates announced via role="status" / role="alert" in ExtractionStatusCard and toast channel
      ...payloadDumperInitialState,
      addCompletedPartitions: (partitions) => {
        usePayloadProgressStore.getState().addCompleted(partitions);
        const completedNames = new Set(partitions);
        set((state) => ({
          partitions: deselect(state.partitions, completedNames),
        }));
      },
      addToHistory: (record) => {
        set((state) => ({
          history: [record, ...state.history].slice(0, 50),
        }));
      },
      beginLoadProgress: () => {
        set({
          loadDetail: null,
          loadMessage: LOAD_MESSAGE_BY_STEP[0] ?? "Loading partitions…",
          loadPhase: "verifyConnection",
          loadProgressFromEvent: false,
          loadStartedAt: Date.now(),
          loadStep: 1,
          loadTotalSteps: 4,
        });
      },
      cancelExtraction: () => {
        const { cancelTokenId, status } = usePayloadDumperStore.getState();
        cancelPayloadExtraction(cancelTokenId, status, set);
      },
      clearExtractionState: () => {
        const progress = usePayloadProgressStore.getState();
        progress.clearTransientPartitionStatuses();
        progress.setExtractingPartitions(new Set<string>());
        progress.clearPartitionProgress();
        set({ errorMessage: "", status: "ready" });
      },
      clearHistory: () => {
        set({ history: [] });
      },
      clearLoadProgress: () => {
        set({
          loadDetail: null,
          loadMessage: "",
          loadPhase: null,
          loadProgressFromEvent: false,
          loadStartedAt: null,
          loadStep: 0,
          loadTotalSteps: 4,
        });
      },
      createAndSetCancellationToken: async () => {
        try {
          const tokenId = await CreateCancellationToken();
          set({ cancelTokenId: tokenId });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          toast.error(`Failed to create cancellation token: ${message}`);
          useLogStore.getState().addLog(`Error creating cancellation token: ${message}`, "error");
        }
      },
      markPartitionCompleted: (name) => {
        usePayloadProgressStore.getState().markCompleted(name);
        set((state) => ({
          partitions: deselect(state.partitions, new Set([name])),
        }));
      },
      reset: () => {
        usePayloadProgressStore.getState().clearAll();
        set({
          ...payloadDumperInitialState,
          extractionStats: null,
          history: [],
          remoteMetadata: null,
        });
      },
      setActiveMode: (mode) => {
        set({ activeMode: mode });
      },
      setCancelTokenId: (id) => {
        set({ cancelTokenId: id });
      },
      setErrorMessage: (message) => {
        set({ errorMessage: message });
      },
      setExtractedFiles: (files) => {
        set({ extractedFiles: files });
      },
      setExtractionStats: (stats) => {
        set({ extractionStats: stats });
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
          loadMessage: LOAD_MESSAGE_BY_STEP[index] ?? "Loading partitions…",
          loadPhase: LOAD_PHASE_BY_STEP[index] ?? "verifyConnection",
          loadStep: clamped,
          loadTotalSteps: 4,
        });
      },
      setOutputDir: (dir) => {
        set({ outputDir: dir });
      },
      setOutputPath: (path) => {
        set({ outputPath: path });
      },
      setPartitions: (partitions) => {
        set({ partitions });
      },
      setPayloadPath: (path) => {
        usePayloadProgressStore.getState().clearAll();
        set({
          errorMessage: "",
          extractedFiles: [],
          outputDir: "",
          partitions: [],
          payloadPath: path,
          remoteMetadata: null,
          status: "idle",
        });
      },
      setRemoteMetadata: (metadata) => {
        set({ remoteMetadata: metadata });
      },
      setRemoteUrl: (url) => {
        set({ remoteUrl: url });
      },
      setStatus: (status) => {
        set({ status });
      },
      toggleAll: (selected) => {
        set((state) => ({
          partitions: state.partitions.map((p) => ({ ...p, selected })),
        }));
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
    }),
    {
      name: "payload-dumper-storage",
      partialize: (state) => ({
        activeMode: state.activeMode,
        history: state.history,
        outputPath: state.outputPath,
        remoteUrl: state.remoteUrl,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
