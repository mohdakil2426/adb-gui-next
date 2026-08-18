import { FileUp, HardDrive, ListPlus, Loader2, Plus, ShieldAlert, X } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import {
  COMMON_PARTITIONS,
  detectPartitionFromFilename,
} from '@/features/flasher/model/flasherConstants';
import type { BatchPartitionItem, FastbootVitals } from '@/features/flasher/model/flasherTypes';
import { MultiPartitionQueue } from '@/features/flasher/partition/MultiPartitionQueue';
import { PartitionSelectorChips } from '@/features/flasher/partition/PartitionSelectorChips';
import { SlotSwitcherCard } from '@/features/flasher/partition/SlotSwitcherCard';
import { DeviceGate } from '@/features/flasher/ui/DeviceGate';
import { DropArea } from '@/features/flasher/ui/DropArea';
import { isHighRiskPartition } from '@/features/flasher/utils/flasherRisk';
import { FileSelector } from '@/shared/components/FileSelector';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { getFileName } from '@/shared/utils/filePath';

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
  onSwitchSlot: (slot: 'a' | 'b') => void;
  partition: string;
  queue: BatchPartitionItem[];
  requestFlash: () => void;
  selectedFastbootSerial: string | null;
  setFilePath: (path: string) => void;
  setPartition: (partition: string) => void;
  vitals: FastbootVitals;
}

export function FlasherPartitionTab({
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
  isFastbootMode,
  onSwitchSlot,
  onRebootFastboot,
  queue,
  isBatchFlashing,
  currentIndex,
  onAddToQueue,
  onRemoveQueueItem,
  onClearQueue,
  onExecuteBatch,
}: FlasherPartitionTabProps) {
  // Auto-detect partition from filename when filePath changes
  useEffect(() => {
    if (!filePath) {
      return;
    }
    const fileName = getFileName(filePath);
    const detected = detectPartitionFromFilename(fileName);
    if (detected && (!partition || partition === 'boot')) {
      setPartition(detected);
    }
  }, [filePath, partition, setPartition]);

  const isHighRisk = isHighRiskPartition(partition);
  const fileName = filePath ? getFileName(filePath) : '';

  const handleAddCurrentToQueue = useCallback(() => {
    if (partition && filePath) {
      onAddToQueue(partition, filePath);
    }
  }, [onAddToQueue, partition, filePath]);

  return (
    <div className="grid @3xl:grid-cols-2 grid-cols-1 items-start gap-5">
      {/* ── Left Column: Primary Flash Card ──────────────────────────── */}
      <div className="flex" ref={flashSectionRef}>
        <Card className="flex h-full w-full flex-col justify-between rounded-xl border-border bg-surface shadow-none">
          <div className="flex flex-1 flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground text-title">
                  <HardDrive className="size-5 text-muted-foreground" />
                  Flash Partition Image
                </CardTitle>
                {partition ? (
                  <Badge
                    className="font-mono text-[10px]"
                    variant={isHighRisk ? 'destructive' : 'outline'}
                  >
                    {isHighRisk ? 'Critical Partition' : 'Standard Partition'}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="text-caption">
                Flash an image file directly to a fastboot hardware partition.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
              {/* Partition Selector Chips */}
              <PartitionSelectorChips
                disabled={isGlobalLoading || isBatchFlashing}
                onSelectPartition={(p) => setPartition(p)}
                selectedPartition={partition}
              />

              {/* Partition Name Input */}
              <Field>
                <FieldLabel htmlFor="flasher-partition">Partition Name</FieldLabel>
                <Input
                  disabled={isGlobalLoading || isBatchFlashing}
                  id="flasher-partition"
                  list="partition-suggestions"
                  onChange={(e) => setPartition(e.target.value)}
                  placeholder="e.g., boot, recovery, vendor_boot, super"
                  value={partition}
                />
                <FieldDescription>
                  Choose a fastboot partition name or type a custom one.
                </FieldDescription>
                <datalist id="partition-suggestions">
                  {COMMON_PARTITIONS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>

              {/* High-Risk Warning Alert */}
              {isHighRisk ? (
                <Alert variant="destructive">
                  <ShieldAlert className="size-4" />
                  <AlertTitle>High Hazard Partition ({partition})</AlertTitle>
                  <AlertDescription className="text-caption">
                    Writing an incompatible image to {partition} may corrupt cryptographic root or
                    device dynamic tables.
                  </AlertDescription>
                </Alert>
              ) : null}

              {/* Image File Selector / DropArea */}
              {filePath ? (
                <div className="flex flex-col gap-2">
                  <FileSelector
                    disabled={isGlobalLoading || isBatchFlashing}
                    icon={<FileUp className="size-4" />}
                    label="Image File"
                    onSelect={onSelectImageFile}
                    path={filePath}
                    trailingAction={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label="Clear selected image file"
                            disabled={isGlobalLoading || isBatchFlashing}
                            onClick={() => setFilePath('')}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear selection</TooltipContent>
                      </Tooltip>
                    }
                  />

                  {/* Auto-detected partition badge */}
                  {fileName ? (
                    <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface-raised/40 px-3 py-1.5 text-caption">
                      <span className="text-muted-foreground">
                        Target file: <span className="font-mono text-foreground">{fileName}</span>
                      </span>
                      <Button
                        className="h-6 gap-1 px-2 text-[11px]"
                        disabled={isGlobalLoading || isBatchFlashing || !partition}
                        onClick={handleAddCurrentToQueue}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Plus className="size-3" />
                        Queue in Batch
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <DropArea
                  browseLabel="Browse Image"
                  disabled={isGlobalLoading || isBatchFlashing}
                  icon={FileUp}
                  isDragging={dragTarget === 'flash'}
                  label="Drop an image file here"
                  onBrowse={onSelectImageFile}
                  sublabel="Accepted: .img files (auto-detects partition from filename)"
                />
              )}
            </CardContent>
          </div>

          <div className="px-6 pt-2 pb-6">
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={
                  isGlobalLoading ||
                  isBatchFlashing ||
                  !partition ||
                  !filePath ||
                  !selectedFastbootSerial
                }
                onClick={requestFlash}
                type="button"
              >
                {loadingAction === 'flash' ? (
                  <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                ) : (
                  <FileUp className="mr-2 size-4 shrink-0" />
                )}
                Flash Partition ({partition || 'Select Target'})
              </Button>

              <Button
                disabled={isGlobalLoading || isBatchFlashing || !partition || !filePath}
                onClick={handleAddCurrentToQueue}
                title="Add to multi-partition queue"
                type="button"
                variant="outline"
              >
                <ListPlus className="size-4" />
              </Button>
            </div>

            {selectedFastbootSerial ? null : (
              <DeviceGate>
                Flashing needs the selected device in fastboot or bootloader mode. Use Utilities →
                Reboot Bootloader, then pick it in the device switcher.
              </DeviceGate>
            )}
          </div>
        </Card>
      </div>

      {/* ── Right Column: Slot Switcher & Batch Queue ────────────────── */}
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
      </div>
    </div>
  );
}
