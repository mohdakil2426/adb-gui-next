import { create } from 'zustand';

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
}

type ExtractionStatus = "idle" | "loading-partitions" | "ready" | "extracting" | "success" | "error";

interface PayloadDumperState {
    // Input/Output paths
    payloadPath: string;
    outputPath: string;

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

    // Actions
    setPayloadPath: (path: string) => void;
    setOutputPath: (path: string) => void;
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
    updatePartitionProgress: (name: string, current: number, total: number, completed?: boolean) => void;
    clearPartitionProgress: () => void;
    reset: () => void;
    clearExtractionState: () => void;
}

const initialState = {
    payloadPath: '',
    outputPath: '',
    partitions: [] as PartitionInfo[],
    status: 'idle' as ExtractionStatus,
    extractedFiles: [] as string[],
    errorMessage: '',
    outputDir: '',
    extractingPartitions: new Set<string>(),
    completedPartitions: new Set<string>(),
    partitionProgress: new Map<string, PartitionProgress>(),
};

export const usePayloadDumperStore = create<PayloadDumperState>((set, get) => ({
    ...initialState,

    setPayloadPath: (path) => set({
        payloadPath: path,
        // Only reset partitions and extraction state when new file is selected
        partitions: [],
        status: 'idle',
        extractedFiles: [],
        errorMessage: '',
        outputDir: '',
        extractingPartitions: new Set<string>(),
        completedPartitions: new Set<string>(),
    }),

    setOutputPath: (path) => set({ outputPath: path }),

    setPartitions: (partitions) => set({ partitions }),

    togglePartition: (index) => set((state) => {
        const updated = [...state.partitions];
        updated[index] = { ...updated[index], selected: !updated[index].selected };
        return { partitions: updated };
    }),

    toggleAll: (selected) => set((state) => ({
        partitions: state.partitions.map(p => ({ ...p, selected }))
    })),

    setStatus: (status) => set({ status }),

    setExtractedFiles: (files) => set({ extractedFiles: files }),

    setErrorMessage: (message) => set({ errorMessage: message }),

    setOutputDir: (dir) => set({ outputDir: dir }),

    setExtractingPartitions: (partitions) => set({ extractingPartitions: partitions }),

    setCompletedPartitions: (partitions) => set({ completedPartitions: partitions }),

    // Add newly completed partitions and deselect them
    addCompletedPartitions: (partitions) => set((state) => {
        const updatedCompleted = new Set(state.completedPartitions);
        partitions.forEach(p => updatedCompleted.add(p));

        // Deselect extracted partitions
        const updatedPartitions = state.partitions.map(p =>
            partitions.includes(p.name) ? { ...p, selected: false } : p
        );

        return {
            completedPartitions: updatedCompleted,
            partitions: updatedPartitions,
        };
    }),

    // Mark a single partition as completed (called from progress events)
    markPartitionCompleted: (name) => set((state) => {
        const updatedCompleted = new Set(state.completedPartitions);
        updatedCompleted.add(name);

        // Remove from extracting set
        const updatedExtracting = new Set(state.extractingPartitions);
        updatedExtracting.delete(name);

        // Deselect the completed partition
        const updatedPartitions = state.partitions.map(p =>
            p.name === name ? { ...p, selected: false } : p
        );

        return {
            completedPartitions: updatedCompleted,
            extractingPartitions: updatedExtracting,
            partitions: updatedPartitions,
        };
    }),

    // Update real-time progress for a specific partition
    updatePartitionProgress: (name, current, total, completed) => set((state) => {
        const newProgress = new Map(state.partitionProgress);
        newProgress.set(name, {
            current,
            total,
            percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        });
        return { partitionProgress: newProgress };
    }),

    // Clear all partition progress (after extraction completes)
    clearPartitionProgress: () => set({ partitionProgress: new Map() }),

    reset: () => set({
        ...initialState,
        extractingPartitions: new Set<string>(),
        completedPartitions: new Set<string>(),
        partitionProgress: new Map(),
    }),

    // Clear only extraction state but keep file and partitions
    clearExtractionState: () => set({
        status: 'ready',
        extractingPartitions: new Set<string>(),
        errorMessage: '',
        partitionProgress: new Map(),
    }),
}));
