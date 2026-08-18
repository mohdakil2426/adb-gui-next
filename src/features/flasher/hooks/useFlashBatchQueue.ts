import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { FlashPartitionBatch } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';
import type { BatchPartitionItem } from '@/features/flasher/model/flasherTypes';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/filePath';

const PARTITION_ORDER_PRIORITY: Record<string, number> = {
  boot: 10,
  init_boot: 20,
  vendor_boot: 30,
  dtbo: 40,
  vbmeta: 50,
  vbmeta_system: 52,
  vbmeta_vendor: 54,
  recovery: 60,
  super: 70,
  system: 80,
  vendor: 90,
  product: 100,
  system_ext: 110,
  odm: 120,
  modem: 130,
  radio: 140,
  bluetooth: 150,
  dsp: 160,
  persist: 170,
  userdata: 200,
};

function getPartitionPriority(partition: string): number {
  const clean = partition.toLowerCase().replace(/_[ab]$/, '');
  return PARTITION_ORDER_PRIORITY[clean] ?? 999;
}

export function useFlashBatchQueue() {
  const [queue, setQueue] = useState<BatchPartitionItem[]>([]);
  const [isBatchFlashing, setIsBatchFlashing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const addToQueue = useCallback((partition: string, filePath: string) => {
    const fileName = getFileName(filePath);
    setQueue((prev) => {
      const existing = prev.find((item) => item.partition === partition);
      if (existing) {
        return prev.map((item) => {
          if (item.partition === partition) {
            const { error: _err, ...rest } = item;
            return { ...rest, filePath, fileName, status: 'queued' as const };
          }
          return item;
        });
      }
      const newItem: BatchPartitionItem = {
        id: crypto.randomUUID(),
        partition,
        filePath,
        fileName,
        status: 'queued',
      };
      const updated = [...prev, newItem];
      return updated.sort(
        (a, b) => getPartitionPriority(a.partition) - getPartitionPriority(b.partition),
      );
    });
    toast.info(`Added ${partition} to flash queue`);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(null);
  }, []);

  const executeBatch = useCallback(
    async (serial: string | null) => {
      if (!serial) {
        toast.error('No fastboot device connected for batch flashing');
        return;
      }
      if (queue.length === 0) {
        toast.error('Flash queue is empty');
        return;
      }

      setIsBatchFlashing(true);
      const toastId = toast.loading(`Starting batch flash for ${queue.length} partition(s)...`);

      const unlisten = EventsOn<backend.BatchFlashProgress>(
        'flasher:batch-progress',
        (progress) => {
          const idx = progress.currentIndex ?? progress.index ?? 0;
          const part = progress.currentPartition ?? progress.partition;
          const stage = progress.stage ?? progress.status;
          setCurrentIndex(idx);

          if (stage === 'flashing') {
            toast.loading(`[${idx + 1}/${queue.length}] Flashing ${part ?? 'partition'}...`, {
              id: toastId,
            });
          }

          setQueue((prev) =>
            prev.map((q, i) => {
              if (i === idx || (part && q.partition === part)) {
                let status: BatchPartitionItem['status'] = q.status;
                if (stage === 'flashing') {
                  status = 'flashing';
                } else if (stage === 'success' || stage === 'done') {
                  status = 'success';
                } else if (stage === 'failed') {
                  status = 'failed';
                }
                return {
                  ...q,
                  status,
                  ...(progress.error ? { error: progress.error } : {}),
                };
              }
              return q;
            }),
          );
        },
      );

      try {
        const batchItems: backend.BatchFlashItem[] = queue.map((item) => ({
          id: item.id,
          partition: item.partition,
          imagePath: item.filePath,
          filePath: item.filePath,
          fileName: item.fileName,
          fileSize: item.size ?? null,
        }));

        await FlashPartitionBatch(batchItems, serial);
        toast.success('Batch Flashing Complete', {
          description: `All ${queue.length} partition(s) processed successfully.`,
          id: toastId,
        });
        useLogStore
          .getState()
          .addLog(`Batch Flash: ${queue.length} partition(s) flashed successfully`, 'success');
      } catch (error) {
        toast.dismiss(toastId);
        handleError('Batch Flash', error);
      } finally {
        unlisten();
        setIsBatchFlashing(false);
        setCurrentIndex(null);
      }
    },
    [queue],
  );

  return {
    addToQueue,
    clearQueue,
    currentIndex,
    executeBatch,
    isBatchFlashing,
    queue,
    removeFromQueue,
  };
}
