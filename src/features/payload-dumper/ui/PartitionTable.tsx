import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/utils/cn';
import { formatBytesNum } from '@/shared/utils/formatting';
import { PartitionRow } from './PartitionRow';

interface PartitionTableProps {
  completedPartitions: Set<string>;
  extractingPartitions: Set<string>;
  isExtractionActive: boolean;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  partitionProgress: Map<string, { current: number; total: number; percentage: number }>;
  partitions: { name: string; size: number; selected: boolean }[];
  status: string;
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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPartitions = useMemo(() => {
    if (!searchQuery.trim()) {
      return partitions;
    }
    const query = searchQuery.toLowerCase();
    return partitions.filter((p) => p.name.toLowerCase().includes(query));
  }, [partitions, searchQuery]);

  const { toExtractCount, toExtractSize } = useMemo(() => {
    let count = 0;
    let size = 0;
    for (const p of filteredPartitions) {
      if (p.selected && !completedPartitions.has(p.name)) {
        count++;
        size += p.size;
      }
    }
    return { toExtractCount: count, toExtractSize: size };
  }, [filteredPartitions, completedPartitions]);

  if (partitions.length === 0) {
    return null;
  }

  const selectedCount = filteredPartitions.filter((p) => p.selected).length;
  const hasCompletedPartitions = completedPartitions.size > 0;
  const allSelected = filteredPartitions.length > 0 && filteredPartitions.every((p) => p.selected);
  const isFiltered = searchQuery.trim().length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Summary + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {isFiltered ? `${filteredPartitions.length} of ${partitions.length} shown \u2022 ` : ''}
          {selectedCount}/{filteredPartitions.length} selected
          {hasCompletedPartitions ? ` \u2022 ${completedPartitions.size} extracted` : null}
          {toExtractCount > 0 && ` \u2022 ${formatBytesNum(toExtractSize)} to extract`}
        </span>
        <Button
          className="h-7 text-xs"
          disabled={status === 'extracting'}
          onClick={onToggleAll}
          size="sm"
          variant="ghost"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {/* Table container */}
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <div className="flex justify-center border-border/50 border-b px-4 py-3">
          <Input
            className="h-8 w-full max-w-xl text-sm"
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Search partitions..."
            value={searchQuery}
          />
        </div>

        {/* Header — adaptive */}
        <div
          className={cn(
            'grid gap-2 border-b bg-muted/50 px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider',
            isExtractionActive
              ? 'grid-cols-[28px_minmax(0,0.8fr)_minmax(0,5fr)_72px]'
              : 'grid-cols-[28px_minmax(0,1fr)_72px]',
          )}
        >
          <span />
          <span>Partition</span>
          {isExtractionActive ? <span className="text-center">Progress</span> : null}
          <span className="text-right">Size</span>
        </div>

        {/* Rows — scrollable */}
        <div className="max-h-[40vh] min-h-[120px] divide-y divide-border/50 overflow-y-auto overflow-x-hidden">
          {filteredPartitions.map((partition, index) => {
            const isRowExtracting = extractingPartitions.has(partition.name);
            const isRowCompleted = completedPartitions.has(partition.name);
            const progress = partitionProgress.get(partition.name);
            const realProgressPercent = progress?.percentage ?? 0;

            return (
              <PartitionRow
                disabled={status === 'extracting'}
                index={index}
                isCompleted={isRowCompleted}
                isExtracting={isRowExtracting}
                key={partition.name}
                onToggle={onToggle}
                partition={partition}
                progressPercent={realProgressPercent}
                showProgress={isExtractionActive}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
