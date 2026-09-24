import type { backend } from "@/desktop/models";
import type { PartitionProgress } from "@/features/payload-dumper/model/payload-progress-store";
import { PARTITION_GRID_COLUMNS } from "@/features/payload-dumper/ui/partition-grid";
import { PartitionRow } from "@/features/payload-dumper/ui/partition-row";

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

export const PartitionTableList = ({
  filteredPartitions,
  isBusy,
  isExtractionActive,
  onTogglePartition,
  partitionProgress,
  partitionStatuses,
}: PartitionTableListProps) => (
  <>
    {/* Partition Grid Header */}
    <div
      className="border-border/60 bg-surface-raised/40 text-muted-foreground text-caption grid grid-cols-(--grid-cols) items-center gap-2 border-b px-3 py-2 font-medium tracking-wider uppercase"
      style={{ "--grid-cols": PARTITION_GRID_COLUMNS } as React.CSSProperties}
    >
      <span>Sel</span>
      <span>Partition Name</span>
      <span>Uncompressed Size</span>
      <span className="text-right">Live Progress</span>
    </div>

    {/* Partition Grid Rows */}
    <div className="divide-border/40 border-border/60 bg-surface flex max-h-[480px] flex-col divide-y overflow-y-auto rounded-md border">
      {filteredPartitions.length === 0 ? (
        <div className="text-caption text-muted-foreground py-8 text-center">
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
