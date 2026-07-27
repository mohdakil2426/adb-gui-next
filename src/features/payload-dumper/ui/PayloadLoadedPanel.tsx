import type { backend } from '@/desktop/models';
import type { PartitionProgress } from '@/features/payload-dumper/model/payloadProgressStore';
import { ActionFooter } from '@/features/payload-dumper/ui/ActionFooter';
import { FileBanner } from '@/features/payload-dumper/ui/FileBanner';
import { OutputDirectoryField } from '@/features/payload-dumper/ui/OutputDirectoryField';
import { PartitionSizeSummary } from '@/features/payload-dumper/ui/PartitionSizeSummary';
import { PartitionTable } from '@/features/payload-dumper/ui/PartitionTable';

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
