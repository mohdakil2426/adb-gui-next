import { Layers, Loader2, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UnpackSuperImage } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import type { PartitionProgress } from '@/features/payload-dumper/model/payloadProgressStore';
import { ActionFooter } from '@/features/payload-dumper/ui/ActionFooter';
import { FileBanner } from '@/features/payload-dumper/ui/FileBanner';
import { OutputDirectoryField } from '@/features/payload-dumper/ui/OutputDirectoryField';
import { PartitionSizeSummary } from '@/features/payload-dumper/ui/PartitionSizeSummary';
import { PartitionTable } from '@/features/payload-dumper/ui/PartitionTable';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { formatBytes } from '@/shared/utils/format';
export interface PayloadPartition {
  name: string;
  selected: boolean;
  size: number;
}

interface PayloadLoadedPanelProps {
  completedPartitions: Set<string>;
  effectiveOutputPath: string;
  isDetailsOpen: boolean;
  isExtractionActive: boolean;
  isRemote: boolean;
  onCancelExtraction: () => void;
  onExtract: () => void;
  onOpenOutputFolder: () => void;
  onRefreshPartitions: () => void;
  onReset: () => void;
  onSelectOutput: () => void;
  onSelectPayload: () => void;
  onToggleAll: () => void;
  onToggleDetails: () => void;
  onTogglePartition: (index: number) => void;
  /** The destination came from the backend, not from a picker. */
  outputIsAuto: boolean;
  outputPath: string;
  partitionProgress: Map<string, PartitionProgress>;
  partitionStatuses: Map<string, backend.PartitionExtractStatus>;
  partitions: PayloadPartition[];
  payloadPath: string;
  prefetch: boolean;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  remoteUrl: string;
  status: string;
  toExtractCount: number;
  toExtractSize: number;
}

/**
 * The loaded layout, in reading order: what is loaded → where it goes → what
 * dominates it → what to take → go.
 *
 * The output directory sits second because it is a required input; it used to
 * be an unlabelled icon in the banner's button row, below every other control
 * in the app in both size and prominence.
 */
export function PayloadLoadedPanel({
  completedPartitions,
  effectiveOutputPath,
  isDetailsOpen,
  isExtractionActive,
  isRemote,
  outputIsAuto,
  onCancelExtraction,
  onExtract,
  onOpenOutputFolder,
  onRefreshPartitions,
  onReset,
  onSelectOutput,
  onSelectPayload,
  onToggleAll,
  onTogglePartition,
  onToggleDetails,
  outputPath,
  partitionProgress,
  partitionStatuses,
  partitions,
  payloadPath,
  prefetch,
  remoteMetadata,
  remoteUrl,
  status,
  toExtractCount,
  toExtractSize,
}: PayloadLoadedPanelProps) {
  const totalPayloadSize = partitions.reduce((total, partition) => total + partition.size, 0);
  const selectedCount = partitions.filter((partition) => partition.selected).length;
  const extractedFiles = usePayloadDumperStore((state) => state.extractedFiles);
  const [isUnpackingSuper, setIsUnpackingSuper] = useState(false);

  const hasSuperPartition = partitions.some(
    (p) => p.name.toLowerCase() === 'super' || p.name.toLowerCase() === 'super.img',
  );
  const isSuperCompleted = completedPartitions.has('super') || completedPartitions.has('super.img');
  const hasSuperExtracted = extractedFiles.some(
    (f) => f.toLowerCase().endsWith('super.img') || f.toLowerCase() === 'super.img',
  );
  const hasSuper = hasSuperPartition || isSuperCompleted || hasSuperExtracted;

  const handleUnpackSuper = async () => {
    setIsUnpackingSuper(true);
    try {
      const superFromFile = extractedFiles.find(
        (f) => f.toLowerCase().endsWith('super.img') || f.toLowerCase() === 'super.img',
      );
      let superPath = '';
      if (superFromFile && (superFromFile.includes('/') || superFromFile.includes('\\'))) {
        superPath = superFromFile;
      } else if (effectiveOutputPath) {
        const sep = effectiveOutputPath.includes('\\') ? '\\' : '/';
        superPath = `${effectiveOutputPath}${sep}super.img`;
      } else if (
        payloadPath &&
        (payloadPath.toLowerCase().endsWith('super.img') ||
          payloadPath.toLowerCase().endsWith('super'))
      ) {
        superPath = payloadPath;
      }

      const outDir =
        effectiveOutputPath || (superPath ? superPath.replace(/[/\\][^/\\]+$/, '') : '');

      if (!(superPath && outDir)) {
        toast.error('Unable to locate super.img path or output directory');
        return;
      }

      toast.info('Unpacking dynamic sub-partitions from super.img...');
      const subPartitions = await UnpackSuperImage(superPath, outDir);

      if (subPartitions.length > 0) {
        const names = subPartitions
          .map(([name, size]) => `${name}.img (${formatBytes(size)})`)
          .join(', ');
        toast.success(
          `Successfully unpacked ${subPartitions.length} dynamic sub-partitions: ${names}`,
        );
      } else {
        toast.warning('No logical sub-partitions found in super.img');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to unpack super.img: ${errorMsg}`);
    } finally {
      setIsUnpackingSuper(false);
    }
  };
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <FileBanner
        isDetailsOpen={isDetailsOpen}
        isRemote={isRemote}
        onRefreshPartitions={onRefreshPartitions}
        onSelectPayload={onSelectPayload}
        onToggleDetails={onToggleDetails}
        outputPath={effectiveOutputPath}
        partitionCount={partitions.length}
        payloadPath={payloadPath}
        prefetch={prefetch}
        remoteMetadata={remoteMetadata}
        remoteUrl={remoteUrl}
        status={status}
        totalPayloadSize={totalPayloadSize}
      />

      <OutputDirectoryField
        disabled={status === 'extracting'}
        effectiveOutputPath={effectiveOutputPath}
        isAuto={outputIsAuto && !outputPath}
        onOpenOutputFolder={onOpenOutputFolder}
        onSelectOutput={onSelectOutput}
      />

      {hasSuper ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Layers className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-caption text-foreground">
                  Dynamic Partition Image Detected
                </h4>
                <Badge className="text-[10px]" variant="secondary">
                  super.img
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground">
                Extract logical sub-partitions (system, vendor, product, odm) directly from
                super.img metadata.
              </p>
            </div>
          </div>
          <Button
            className="shrink-0"
            disabled={isUnpackingSuper || status === 'extracting'}
            onClick={handleUnpackSuper}
            size="sm"
          >
            {isUnpackingSuper ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Unpacking Sub-Partitions...
              </>
            ) : (
              <>
                <PackageOpen className="mr-1.5 size-3.5" />
                Unpack super.img Sub-Partitions
              </>
            )}
          </Button>
        </div>
      ) : null}

      <PartitionSizeSummary completedPartitions={completedPartitions} partitions={partitions} />

      <PartitionTable
        completedPartitions={completedPartitions}
        isExtractionActive={isExtractionActive}
        onToggle={onTogglePartition}
        onToggleAll={onToggleAll}
        partitionProgress={partitionProgress}
        partitionStatuses={partitionStatuses}
        partitions={partitions}
        status={status}
      />

      <ActionFooter
        hasCompletedPartitions={completedPartitions.size > 0}
        onCancel={onCancelExtraction}
        onExtract={onExtract}
        onReset={onReset}
        payloadPath={payloadPath}
        selectedCount={selectedCount}
        status={status}
        toExtractCount={toExtractCount}
        toExtractSize={toExtractSize}
      />
    </div>
  );
}
