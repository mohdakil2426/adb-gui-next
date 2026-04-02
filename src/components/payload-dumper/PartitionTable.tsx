import { cn, formatBytesNum } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PartitionRow } from './PartitionRow';

interface PartitionTableProps {
  partitions: Array<{ name: string; size: number; selected: boolean }>;
  extractingPartitions: Set<string>;
  completedPartitions: Set<string>;
  partitionProgress: Map<string, { current: number; total: number; percentage: number }>;
  isExtractionActive: boolean;
  status: string;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
}

/**
 * Partition table with adaptive column layout.
 * Shows 3 columns (checkbox, name, size) normally,
 * expands to 4 columns (+ progress) during/after extraction.
 * Includes summary bar with select/deselect all toggle.
 */
export function PartitionTable({
  partitions,
  extractingPartitions,
  completedPartitions,
  partitionProgress,
  isExtractionActive,
  status,
  onToggle,
  onToggleAll,
}: PartitionTableProps) {
  if (partitions.length === 0) return null;

  const selectedCount = partitions.filter((p) => p.selected).length;
  const hasCompletedPartitions = completedPartitions.size > 0;
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const toExtractCount = partitions.filter(
    (p) => p.selected && !completedPartitions.has(p.name),
  ).length;
  const toExtractSize = partitions
    .filter((p) => p.selected && !completedPartitions.has(p.name))
    .reduce((acc, p) => acc + p.size, 0);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Summary + toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">
          {selectedCount}/{partitions.length} selected
          {hasCompletedPartitions && ` \u2022 ${completedPartitions.size} extracted`}
          {toExtractCount > 0 && ` \u2022 ${formatBytesNum(toExtractSize)} to extract`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleAll}
          className="text-xs h-7"
          disabled={status === 'extracting'}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {/* Table container */}
      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        {/* Header — adaptive */}
        <div
          className={cn(
            'grid gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground',
            isExtractionActive
              ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
              : 'grid-cols-[28px_minmax(0,1fr)_72px]',
          )}
        >
          <span></span>
          <span>Partition</span>
          {isExtractionActive && <span className="text-center">Progress</span>}
          <span className="text-right">Size</span>
        </div>

        {/* Rows — scrollable */}
        <div className="divide-y divide-border/50 max-h-100 overflow-y-auto">
          {partitions.map((partition, index) => {
            const isRowExtracting = extractingPartitions.has(partition.name);
            const isRowCompleted = completedPartitions.has(partition.name);
            const progress = partitionProgress.get(partition.name);
            const realProgressPercent = progress?.percentage ?? 0;

            return (
              <PartitionRow
                key={partition.name}
                partition={partition}
                index={index}
                isExtracting={isRowExtracting}
                isCompleted={isRowCompleted}
                progressPercent={realProgressPercent}
                showProgress={isExtractionActive}
                onToggle={onToggle}
                disabled={status === 'extracting'}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
