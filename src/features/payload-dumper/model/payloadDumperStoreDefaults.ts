import type { backend } from '@/desktop/models';
import type { ExtractionRecord, ExtractionStatus } from './payloadDumperStore';

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}

/**
 * Per-partition progress/status lives in the non-persisted `payloadProgressStore`
 * — see the note there for why it must never sit behind `zustand/persist`.
 */
export const payloadDumperInitialState = {
  activeMode: 'local' as 'local' | 'remote',
  cancelTokenId: null as string | null,
  errorMessage: '',
  extractedFiles: [] as string[],
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
  partitions: [] as PartitionInfo[],
  payloadPath: '',
  remoteMetadata: null as backend.RemotePayloadMetadata | null,
  remoteUrl: '',
  status: 'idle' as ExtractionStatus,
};
