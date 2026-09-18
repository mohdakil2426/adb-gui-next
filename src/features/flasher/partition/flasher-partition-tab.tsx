import { useCallback, useEffect, useState } from "react";

import { InspectPartitionImage } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { detectPartitionFromFilename } from "@/features/flasher/model/flasher-constants";
import type { BatchPartitionItem, FastbootVitals } from "@/features/flasher/model/flasher-types";
import { MultiPartitionQueue } from "@/features/flasher/partition/multi-partition-queue";
import { PartitionFlashCard } from "@/features/flasher/partition/partition-flash-card";
import { SlotSwitcherCard } from "@/features/flasher/partition/slot-switcher-card";
import { DeviceGate } from "@/features/flasher/ui/device-gate";
import { getFileName } from "@/shared/utils/file-path";

interface FlasherPartitionTabProps {
  currentIndex: number | null;
  dragTarget: string;
  filePath: string;
  flashSectionRef: React.RefObject<HTMLDivElement | null>;
  isBatchFlashing: boolean;
  isFastbootMode: boolean;
  isGlobalLoading: boolean;
  loadingAction: string | null;
  onAddToQueue: (partition: string, filePath: string) => void;
  onClearQueue: () => void;
  onExecuteBatch: () => void;
  onRebootFastboot?: () => void;
  onRemoveQueueItem: (id: string) => void;
  onSelectImageFile: () => void;
  onSwitchSlot: (slot: "a" | "b") => void;
  partition: string;
  queue: BatchPartitionItem[];
  requestFlash: () => void;
  selectedFastbootSerial: string | null;
  setFilePath: (path: string) => void;
  setPartition: (partition: string) => void;
  vitals: FastbootVitals;
}

export const FlasherPartitionTab = ({
  filePath,
  setFilePath,
  partition,
  setPartition,
  isGlobalLoading,
  loadingAction,
  selectedFastbootSerial,
  onSelectImageFile,
  requestFlash,
  dragTarget,
  flashSectionRef,
  vitals,
  onSwitchSlot,
  isFastbootMode,
  queue,
  onAddToQueue,
  onRemoveQueueItem,
  onClearQueue,
  onExecuteBatch,
  isBatchFlashing,
  currentIndex,
  onRebootFastboot,
}: FlasherPartitionTabProps) => {
  const [inspectInfo, setInspectInfo] = useState<backend.PartitionTargetInfo | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  useEffect(() => {
    if (!filePath) {
      return;
    }

    let cancelled = false;

    const inspect = async () => {
      setIsInspecting(true);
      try {
        const info = await InspectPartitionImage(filePath);
        if (!cancelled && info) {
          setInspectInfo(info);
          if (info.detectedPartition) {
            setPartition(info.detectedPartition);
          } else {
            const guessed = detectPartitionFromFilename(getFileName(filePath));
            if (guessed) {
              setPartition(guessed);
            }
          }
        }
      } catch {
        if (!cancelled) {
          const guessed = detectPartitionFromFilename(getFileName(filePath));
          if (guessed) {
            setPartition(guessed);
          }
        }
      } finally {
        if (!cancelled) {
          setIsInspecting(false);
        }
      }
    };

    void inspect();

    return () => {
      cancelled = true;
      setInspectInfo(null);
    };
  }, [filePath, setPartition]);

  const handleAddCurrentToQueue = useCallback(() => {
    if (partition && filePath) {
      onAddToQueue(partition, filePath);
    }
  }, [onAddToQueue, partition, filePath]);

  return (
    <div className="grid @3xl:grid-cols-2 grid-cols-1 items-start gap-5">
      <PartitionFlashCard
        dragTarget={dragTarget}
        filePath={filePath}
        flashSectionRef={flashSectionRef}
        inspectInfo={inspectInfo}
        isBatchFlashing={isBatchFlashing}
        isGlobalLoading={isGlobalLoading}
        isInspecting={isInspecting}
        loadingAction={loadingAction}
        onAddToQueue={handleAddCurrentToQueue}
        onSelectImageFile={onSelectImageFile}
        partition={partition}
        requestFlash={requestFlash}
        selectedFastbootSerial={selectedFastbootSerial}
        setFilePath={setFilePath}
        setPartition={setPartition}
      />

      <div className="flex flex-col gap-5">
        <SlotSwitcherCard
          activeSlot={vitals.activeSlot}
          disabled={isGlobalLoading || isBatchFlashing}
          isFastbootMode={isFastbootMode}
          onRebootFastboot={onRebootFastboot}
          onSwitchSlot={onSwitchSlot}
          slotCount={vitals.slotCount}
        />

        <MultiPartitionQueue
          currentIndex={currentIndex}
          disabled={isGlobalLoading}
          isBatchFlashing={isBatchFlashing}
          onClearQueue={onClearQueue}
          onExecuteBatch={onExecuteBatch}
          onRemoveItem={onRemoveQueueItem}
          queue={queue}
          serial={selectedFastbootSerial}
        />

        {isFastbootMode ? null : (
          <DeviceGate>
            Device is not in Fastboot mode. Connect a device in bootloader mode to flash partitions.
          </DeviceGate>
        )}
      </div>
    </div>
  );
};
