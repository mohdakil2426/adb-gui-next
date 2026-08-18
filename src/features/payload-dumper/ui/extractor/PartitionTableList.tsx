import type { backend } from '@/desktop/models';
import type { PartitionProgress } from '@/features/payload-dumper/model/payloadProgressStore';
import { PartitionRow } from '@/features/payload-dumper/ui/PartitionRow';
import { PARTITION_GRID_COLUMNS } from '@/features/payload-dumper/ui/partitionGrid';

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}

interface FilteredPartitionItem {
  index: number;
  partition: PartitionInfo;
}

interface PartitionTableListProps {
  filteredPartitions: FilteredPartitionItem[];
  isBusy: boolean;
  isExtractionActive: boolean;
  onTogglePartition: (index: number) => void;
  partitionProgress: Map<string, PartitionProgress>;
  partitionStatuses: Map<string, backend.PartitionExtractStatus>;
}

export function PartitionTableList({
  filteredPartitions,
  isBusy,
  isExtractionActive,
  onTogglePartition,
  partitionProgress,
  partitionStatuses,
}: PartitionTableListProps) {
  return (
    <>
      {/* Partition Grid Header */}
      <div
        className="grid items-center gap-2 border-border/60 border-b bg-surface-raised/40 px-3 py-2 font-medium text-[11px] text-label text-muted-foreground uppercase tracking-wider"
        style={{ gridTemplateColumns: PARTITION_GRID_COLUMNS }}
      >
        <span>Sel</span>
        <span>Partition Name</span>
        <span>Uncompressed Size</span>
        <span className="text-right">Live Progress</span>
      </div>

      {/* Partition Grid Rows */}
      <div className="flex max-h-[480px] flex-col divide-y divide-border/40 overflow-y-auto rounded-md border border-border/60 bg-surface">
        {filteredPartitions.length === 0 ? (
          <div className="py-8 text-center text-caption text-muted-foreground">
            No partitions match current search or category filter.
          </div>
        ) : (
          filteredPartitions.map(({ partition, index }) => {
            const prog = partitionProgress.get(partition.name);
            const extractStatus = partitionStatuses.get(partition.name);
            const progressPercent = prog?.percentage ?? 0;
            const showProgress =
              isExtractionActive && (prog !== undefined || extractStatus !== undefined);

            return (
              <PartitionRow
                disabled={isBusy}
                extractStatus={extractStatus}
                index={index}
                key={partition.name}
                onToggle={onTogglePartition}
                partition={partition}
                progressPercent={progressPercent}
                showProgress={showProgress}
                throughputMbps={prog?.throughputMbps}
              />
            );
          })
        )}
      </div>
    </>
  );
}
