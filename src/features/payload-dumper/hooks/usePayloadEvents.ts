import { useEffect } from 'react';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';

/**
 * Subscribes to 'payload:progress' Tauri events from the Rust backend.
 * Updates partition progress + extract status and marks partitions completed.
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
  const updatePartitionProgress = usePayloadDumperStore((state) => state.updatePartitionProgress);
  const markPartitionCompleted = usePayloadDumperStore((state) => state.markPartitionCompleted);

  useEffect(() => {
    const unlisten = EventsOn(
      'payload:progress',
      (data: {
        bytesWritten?: number;
        completed: boolean;
        current: number;
        etaSeconds?: number;
        partitionName: string;
        status?: backend.PartitionExtractStatus;
        throughputMbps?: number;
        total: number;
        totalBytes?: number;
      }) => {
        const extractStatus = resolveExtractStatus(data);

        // Ignore prefetch download pseudo-partition in the table status map
        // (updatePartitionProgress skips status for __download__).
        if (data.partitionName === '__download__') {
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
      },
    );

    return unlisten;
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
