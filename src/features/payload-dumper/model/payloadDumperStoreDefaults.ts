import type { backend } from '@/desktop/models';
import type { ExtractionRecord, ExtractionStatus } from './payloadDumperStore';

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

export const payloadDumperInitialState = {
  activeMode: 'local' as 'local' | 'remote',
  cancelTokenId: null as string | null,
  completedPartitions: new Set<string>(),
  errorMessage: '',
  extractedFiles: [] as string[],
  extractingPartitions: new Set<string>(),
  extractionStats: null as backend.ExtractionStats | null,
  history: [] as ExtractionRecord[],
  /** True once a real `payload:load-progress` event arrives for this load. */
  loadProgressFromEvent: false,
  loadDetail: null as string | null,
  loadMessage: '',
  loadPhase: null as backend.PayloadLoadPhase | null,
  loadStartedAt: null as number | null,
  loadStep: 0,
  loadTotalSteps: 4,
  outputDir: '',
  outputPath: '',
  partitionProgress: new Map<string, PartitionProgress>(),
  /** Per-partition extract lifecycle: pending | running | verifying | completed | failed */
  partitionStatuses: new Map<string, backend.PartitionExtractStatus>(),
  partitions: [] as PartitionInfo[],
  payloadPath: '',
  remoteMetadata: null as backend.RemotePayloadMetadata | null,
  remoteUrl: '',
  status: 'idle' as ExtractionStatus,
};

export function rehydratePayloadDumperState(state: unknown) {
  if (!(state && typeof state === 'object')) {
    return;
  }
  const candidate = state as {
    completedPartitions?: unknown;
    extractingPartitions?: unknown;
    partitionProgress?: unknown;
    partitionStatuses?: unknown;
  };

  if (!(candidate.extractingPartitions instanceof Set)) {
    candidate.extractingPartitions = new Set<string>();
  }
  if (!(candidate.completedPartitions instanceof Set)) {
    candidate.completedPartitions = new Set<string>();
  }
  if (!(candidate.partitionProgress instanceof Map)) {
    candidate.partitionProgress = new Map<string, PartitionProgress>();
  }
  if (!(candidate.partitionStatuses instanceof Map)) {
    candidate.partitionStatuses = new Map<string, backend.PartitionExtractStatus>();
  }
}
