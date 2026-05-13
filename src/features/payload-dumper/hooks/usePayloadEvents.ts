import { useEffect } from 'react';
import { EventsOn } from '@/lib/desktop/runtime';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';

/**
 * Subscribes to 'payload:progress' Tauri events from the Rust backend.
 * Updates partition progress and marks partitions as completed in the store.
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
      (data: { partitionName: string; current: number; total: number; completed: boolean }) => {
        updatePartitionProgress(data.partitionName, data.current, data.total);

        if (data.completed) {
          markPartitionCompleted(data.partitionName);
        }
      },
    );

    return unlisten;
  }, [updatePartitionProgress, markPartitionCompleted]);
}
