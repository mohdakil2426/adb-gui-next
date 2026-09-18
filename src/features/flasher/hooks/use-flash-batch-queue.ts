import { useCallback, useState } from "react";
import { toast } from "sonner";

import { FlashPartitionBatch } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { EventsOn } from "@/desktop/runtime";
import type { BatchPartitionItem } from "@/features/flasher/model/flasher-types";
import { useLogStore } from "@/shared/stores/log-store";
import { handleError } from "@/shared/utils/error-handler";
import { getFileName } from "@/shared/utils/file-path";

const PARTITION_ORDER_PRIORITY: Record<string, number> = {
  bluetooth: 150,
  boot: 10,
  dsp: 160,
  dtbo: 40,
  init_boot: 20,
  modem: 130,
  odm: 120,
  persist: 170,
  product: 100,
  radio: 140,
  recovery: 60,
  super: 70,
  system: 80,
  system_ext: 110,
  userdata: 200,
  vbmeta: 50,
  vbmeta_system: 52,
  vbmeta_vendor: 54,
  vendor: 90,
  vendor_boot: 30,
};

const getPartitionPriority = (partition: string): number => {
  const clean = partition.toLowerCase().replace(/_[ab]$/u, "");
  return PARTITION_ORDER_PRIORITY[clean] ?? 999;
};

export const useFlashBatchQueue = () => {
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
            return { ...rest, fileName, filePath, status: "queued" as const };
          }
          return item;
        });
      }
      const newItem: BatchPartitionItem = {
        fileName,
        filePath,
        id: crypto.randomUUID(),
        partition,
        status: "queued",
      };
      const updated = [...prev, newItem];
      return updated.toSorted(
        (a, b) => getPartitionPriority(a.partition) - getPartitionPriority(b.partition)
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
        toast.error("No fastboot device connected for batch flashing");
        return;
      }
      if (queue.length === 0) {
        toast.error("Flash queue is empty");
        return;
      }

      setIsBatchFlashing(true);
      const toastId = toast.loading(`Starting batch flash for ${queue.length} partition(s)...`);

      const unlisten = EventsOn<backend.BatchFlashProgress>(
        "flasher:batch-progress",
        (progress) => {
          const idx = progress.currentIndex ?? progress.index ?? 0;
          const part = progress.currentPartition ?? progress.partition;
          const stage = progress.stage ?? progress.status;
          setCurrentIndex(idx);

          if (stage === "flashing") {
            toast.loading(`[${idx + 1}/${queue.length}] Flashing ${part ?? "partition"}...`, {
              id: toastId,
            });
          }

          setQueue((prev) =>
            prev.map((q, i) => {
              if (i === idx || (part && q.partition === part)) {
                let status: BatchPartitionItem["status"] = q.status;
                if (stage === "flashing") {
                  status = "flashing";
                } else if (stage === "success" || stage === "done") {
                  status = "success";
                } else if (stage === "failed") {
                  status = "failed";
                }
                return {
                  ...q,
                  status,
                  ...(progress.error ? { error: progress.error } : {}),
                };
              }
              return q;
            })
          );
        }
      );

      try {
        const batchItems: backend.BatchFlashItem[] = queue.map((item) => ({
          fileName: item.fileName,
          filePath: item.filePath,
          fileSize: item.size ?? null,
          id: item.id,
          imagePath: item.filePath,
          partition: item.partition,
        }));

        await FlashPartitionBatch(batchItems, serial);
        toast.success("Batch Flashing Complete", {
          description: `All ${queue.length} partition(s) processed successfully.`,
          id: toastId,
        });
        useLogStore
          .getState()
          .addLog(`Batch Flash: ${queue.length} partition(s) flashed successfully`, "success");
      } catch (error) {
        toast.dismiss(toastId);
        handleError("Batch Flash", error);
      } finally {
        unlisten();
        setIsBatchFlashing(false);
        setCurrentIndex(null);
      }
    },
    [queue]
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
};
