import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { FlashPartition } from '@/desktop/backend';
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
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (!item) {
          continue;
        }

        setCurrentIndex(i);
        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'flashing' } : q)));

        const toastId = toast.loading(`[${i + 1}/${queue.length}] Flashing ${item.partition}...`);

        try {
          await FlashPartition(item.partition, item.filePath, serial);
          setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: 'success' } : q)));
          successCount++;
          toast.success(`Flashed ${item.partition}`, { id: toastId });
          useLogStore
            .getState()
            .addLog(`Batch Flash: ${item.partition} flashed successfully`, 'success');
        } catch (error) {
          failureCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          setQueue((prev) =>
            prev.map((q, idx) => (idx === i ? { ...q, status: 'failed', error: errorMsg } : q)),
          );
          toast.dismiss(toastId);
          handleError(`Batch Flash ${item.partition}`, error);
          // Stop on first failure to prevent bricking
          break;
        }
      }

      setIsBatchFlashing(false);
      setCurrentIndex(null);

      if (failureCount === 0 && successCount > 0) {
        toast.success('Batch Flashing Complete', {
          description: `All ${successCount} partitions flashed successfully in order.`,
        });
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
