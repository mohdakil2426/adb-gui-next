import { FileUp, HardDrive, ListPlus, ShieldAlert, X } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { COMMON_PARTITIONS } from '@/features/flasher/model/flasherConstants';
import { PartitionInspectionBadge } from '@/features/flasher/partition/PartitionInspectionBadge';
import { PartitionSelectorChips } from '@/features/flasher/partition/PartitionSelectorChips';
import { DropArea } from '@/features/flasher/ui/DropArea';
import { isHighRiskPartition } from '@/features/flasher/utils/flasherRisk';
import { FileSelector } from '@/shared/components/FileSelector';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { getFileName } from '@/shared/utils/filePath';

interface PartitionFlashCardProps {
  dragTarget: string;
  filePath: string;
  flashSectionRef: React.RefObject<HTMLDivElement | null>;
  inspectInfo: backend.PartitionTargetInfo | null;
  isBatchFlashing: boolean;
  isGlobalLoading: boolean;
  isInspecting: boolean;
  loadingAction: string | null;
  onAddToQueue: () => void;
  onSelectImageFile: () => void;
  partition: string;
  requestFlash: () => void;
  selectedFastbootSerial: string | null;
  setFilePath: (p: string) => void;
  setPartition: (p: string) => void;
}

export function PartitionFlashCard({
  partition,
  setPartition,
  filePath,
  setFilePath,
  isGlobalLoading,
  isBatchFlashing,
  loadingAction,
  selectedFastbootSerial,
  onSelectImageFile,
  requestFlash,
  dragTarget,
  onAddToQueue,
  inspectInfo,
  isInspecting,
  flashSectionRef,
}: PartitionFlashCardProps) {
  const isHighRisk = isHighRiskPartition(partition);
  const fileName = filePath ? getFileName(filePath) : '';

  return (
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
            <PartitionSelectorChips
              disabled={isGlobalLoading || isBatchFlashing}
              onSelectPartition={(p) => setPartition(p)}
              selectedPartition={partition}
            />

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

                {fileName ? (
                  <PartitionInspectionBadge
                    disabled={isGlobalLoading || isBatchFlashing}
                    fileName={fileName}
                    inspectInfo={inspectInfo}
                    isInspecting={isInspecting}
                    onAddToQueue={onAddToQueue}
                    partition={partition}
                  />
                ) : null}
              </div>
            ) : (
              <DropArea
                browseLabel="Browse image"
                disabled={isGlobalLoading || isBatchFlashing}
                icon={HardDrive}
                isDragging={dragTarget === 'image'}
                label="Drop .img file here"
                onBrowse={onSelectImageFile}
                sublabel="Supports .img, .bin files"
              />
            )}
          </CardContent>
        </div>
        <CardFooter className="flex items-center justify-between border-border border-t pt-4">
          <Button
            className="gap-1.5"
            disabled={isGlobalLoading || isBatchFlashing || !partition || !filePath}
            onClick={onAddToQueue}
            type="button"
            variant="outline"
          >
            <ListPlus className="size-4" />
            Add to Batch Queue
          </Button>

          <Button
            className="gap-2 font-medium"
            disabled={
              isGlobalLoading ||
              isBatchFlashing ||
              !selectedFastbootSerial ||
              !partition ||
              !filePath
            }
            onClick={requestFlash}
            type="button"
            variant={isHighRisk ? 'destructive' : 'default'}
          >
            <HardDrive className="size-4" />
            {loadingAction === 'flash' ? 'Flashing...' : 'Flash Partition'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
