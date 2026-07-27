import { useEffect, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';
import {
  type ExtractionStatus,
  usePayloadDumperStore,
} from '@/features/payload-dumper/model/payloadDumperStore';
import {
  DOWNLOAD_PARTITION,
  usePayloadProgressStore,
} from '@/features/payload-dumper/model/payloadProgressStore';

/** Coalescing window for progress bursts. Rust can emit thousands per extraction. */
const PROGRESS_FLUSH_MS = 100;

/** The only statuses during which a progress event still describes reality. */
const IN_FLIGHT_STATUSES = new Set<ExtractionStatus>([
  'loading-partitions',
  'extracting',
  'cancelling',
]);

interface PayloadProgressEvent {
  bytesWritten?: number;
  completed: boolean;
  current: number;
  etaSeconds?: number;
  partitionName: string;
  status?: backend.PartitionExtractStatus;
  throughputMbps?: number;
  total: number;
  totalBytes?: number;
}

/**
 * Subscribes to 'payload:progress' Tauri events from the Rust backend.
 * Updates partition progress + extract status and marks partitions completed.
 *
 * Events are coalesced per partition over a ~100ms window: a burst of N events
 * for the same partition costs one store write, and only the newest sample is
 * applied. (The Rust side also throttles emission; the two are complementary —
 * a hidden window still flushes here because this is a timer, not a rAF.)
 *
 * Status mapping (when event omits explicit `status`):
 * - first non-complete progress → running
 * - completed: true → completed
 * - pending is set at extract start via setExtractingPartitions
 * - failed is set on overall extract error via failActivePartitions
 * - verifying only if backend sends status: 'verifying'
 *
 * Overall extraction status still flips to success/error when `ExtractPayload`
 * returns — progress events alone never leave `extracting`/`cancelling`.
 *
 * This hook has no return value — it's a side-effect-only hook.
 * Call it once in the component that owns the extraction lifecycle.
 */
export function usePayloadEvents(): void {
  const updatePartitionProgress = usePayloadProgressStore((state) => state.updatePartitionProgress);
  const markPartitionCompleted = usePayloadDumperStore((state) => state.markPartitionCompleted);
  const pendingRef = useRef(new Map<string, PayloadProgressEvent>());
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const pending = pendingRef.current;

    const apply = (data: PayloadProgressEvent) => {
      // A buffered burst can outlive the run that produced it: the flush timer
      // fires *after* `runExtractPayload` cleared progress and set the terminal
      // status, which re-inserted phantom 'running' rows and overwrote 'failed'.
      // Only an in-flight extraction may write progress.
      if (!IN_FLIGHT_STATUSES.has(usePayloadDumperStore.getState().status)) {
        return;
      }

      const extractStatus = resolveExtractStatus(data);

      // Ignore prefetch download pseudo-partition in the table status map
      // (updatePartitionProgress skips status for __download__).
      if (data.partitionName === DOWNLOAD_PARTITION) {
        updatePartitionProgress(
          data.partitionName,
          data.current,
          data.total,
          data.completed,
          data.bytesWritten,
          data.totalBytes,
          data.throughputMbps,
          data.etaSeconds,
        );
        return;
      }

      updatePartitionProgress(
        data.partitionName,
        data.current,
        data.total,
        data.completed,
        data.bytesWritten,
        data.totalBytes,
        data.throughputMbps,
        data.etaSeconds,
        extractStatus,
      );

      if (data.completed || extractStatus === 'completed') {
        markPartitionCompleted(data.partitionName);
      }
    };

    const flush = () => {
      flushTimerRef.current = null;
      if (pending.size === 0) {
        return;
      }
      const batch = [...pending.values()];
      pending.clear();
      for (const data of batch) {
        apply(data);
      }
    };

    const unlisten = EventsOn('payload:progress', (data: PayloadProgressEvent) => {
      pending.set(data.partitionName, data);
      if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(flush, PROGRESS_FLUSH_MS);
      }
    });

    return () => {
      unlisten();
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
      flush();
    };
  }, [updatePartitionProgress, markPartitionCompleted]);
}

function resolveExtractStatus(data: {
  completed: boolean;
  status?: backend.PartitionExtractStatus;
}): backend.PartitionExtractStatus | undefined {
  if (data.status) {
    return data.status;
  }
  if (data.completed) {
    return 'completed';
  }
  return 'running';
}
