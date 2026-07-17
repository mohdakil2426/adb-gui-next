import { useEffect } from 'react';
import { EventsOn } from '@/desktop/runtime';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';

/**
 * Subscribes to 'payload:progress' Tauri events from the Rust backend.
 * Updates partition progress and marks partitions as completed in the store.
 *
 * Overall extraction status still flips to success/error when `ExtractPayload`
 * returns — progress events alone never leave `extracting`/`cancelling`.
 * This matches otaripper / payload-dumper CLI: process exit is the session signal;
 * per-partition bars are progress only.
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
        throughputMbps?: number;
        total: number;
        totalBytes?: number;
      }) => {
        // Ignore prefetch download pseudo-partition in the table.
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
        );

        if (data.completed) {
          markPartitionCompleted(data.partitionName);
        }
      },
    );

    return unlisten;
  }, [updatePartitionProgress, markPartitionCompleted]);
}
