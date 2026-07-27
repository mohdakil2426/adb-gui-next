import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { backend } from '@/desktop/models';
import { PARTITION_GRID_COLUMNS } from '@/features/payload-dumper/ui/partitionGrid';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { formatBytes } from '@/shared/utils/format';
import { PartitionRow } from './PartitionRow';

interface PartitionProgressView {
  current: number;
  percentage: number;
  throughputMbps?: number;
  total: number;
}

interface PartitionTableProps {
  completedPartitions: Set<string>;
  isExtractionActive: boolean;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  partitionProgress: Map<string, PartitionProgressView>;
  partitionStatuses: Map<string, backend.PartitionExtractStatus>;
  partitions: { name: string; size: number; selected: boolean }[];
  status: string;
}

/**
 * Partition table on a **fixed** four-column grid.
 *
 * The header and every row used to switch between a 3- and a 4-column template
 * the moment extraction started, so pressing Extract reflowed the entire list
 * under the cursor. The progress column is now always reserved and simply left
 * empty until there is progress to put in it.
 */
export function PartitionTable({
  partitions,
  completedPartitions,
  partitionProgress,
  partitionStatuses,
  isExtractionActive,
  status,
  onToggle,
  onToggleAll,
}: PartitionTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPartitions = useMemo(() => {
    const indexedPartitions = partitions.map((partition, index) => ({ index, partition }));
    if (!searchQuery.trim()) {
      return indexedPartitions;
    }
    const query = searchQuery.toLowerCase();
    return indexedPartitions.filter(({ partition }) =>
      partition.name.toLowerCase().includes(query),
    );
  }, [partitions, searchQuery]);

  const { toExtractCount, toExtractSize } = useMemo(() => {
    let count = 0;
    let size = 0;
    for (const { partition: p } of filteredPartitions) {
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

  const selectedCount = filteredPartitions.filter(({ partition }) => partition.selected).length;
  const hasCompletedPartitions = completedPartitions.size > 0;
  const failedCount = [...partitionStatuses.values()].filter((s) => s === 'failed').length;
  const allSelected =
    filteredPartitions.length > 0 &&
    filteredPartitions.every(({ partition }) => partition.selected);
  const isFiltered = searchQuery.trim().length > 0;
  const selectionLocked = status === 'extracting' || status === 'cancelling';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Summary + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="numeric text-caption text-muted-foreground">
          {isFiltered ? `${filteredPartitions.length} of ${partitions.length} shown · ` : ''}
          {selectedCount}/{filteredPartitions.length} selected
          {hasCompletedPartitions ? ` · ${completedPartitions.size} extracted` : null}
          {failedCount > 0 ? ` · ${failedCount} failed` : null}
          {toExtractCount > 0 && ` · ${formatBytes(toExtractSize)} to extract`}
        </span>
        <Button
          disabled={selectionLocked}
          onClick={onToggleAll}
          size="sm"
          type="button"
          variant="ghost"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
      </div>

      {/* Table container */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="relative flex items-center border-border border-b px-3 py-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-5 size-3.5 text-muted-foreground"
          />
          <Input
            aria-label="Search partitions"
            className="h-8 w-full pl-7 text-body"
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Search partitions…"
            value={searchQuery}
          />
        </div>

        {/* Header — the grid never changes, so rows never reflow mid-extraction */}
        <div
          className="grid gap-2 border-border border-b bg-surface-raised px-3 py-2 text-caption text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: PARTITION_GRID_COLUMNS }}
        >
          <span />
          <span>Partition</span>
          <span className="text-center">Progress</span>
          <span className="text-right">Size</span>
        </div>

        {/* Rows — scrollable. Capped with `min(40vh,28rem)` rather than a bare
            `40vh`: this view scrolls as a normal page (it is not viewport-locked
            like File Explorer/Marketplace), so the table cannot flex to fill an
            exact remaining height — but a raw vh value would still keep growing
            on a tall/4K window well past the point of being useful. The rem
            ceiling caps that growth; `min-h-[120px]` keeps it from collapsing at
            the 720px window-height floor. */}
        <div className="max-h-[min(40vh,28rem)] min-h-[120px] divide-y divide-border/60 overflow-y-auto overflow-x-hidden">
          {filteredPartitions.length === 0 ? (
            <p className="px-3 py-6 text-center text-body text-muted-foreground">
              {`No partition matches “${searchQuery}” — clear the search to see all ${partitions.length}.`}
            </p>
          ) : null}
          {filteredPartitions.map(({ partition, index }) => {
            const extractStatus = resolveRowStatus(
              partition.name,
              partitionStatuses,
              completedPartitions,
            );
            const progress = partitionProgress.get(partition.name);
            const realProgressPercent = progress?.percentage ?? 0;

            return (
              <PartitionRow
                disabled={selectionLocked}
                extractStatus={extractStatus}
                index={index}
                key={partition.name}
                onToggle={onToggle}
                partition={partition}
                progressPercent={realProgressPercent}
                showProgress={isExtractionActive}
                throughputMbps={progress?.throughputMbps}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function resolveRowStatus(
  name: string,
  partitionStatuses: Map<string, backend.PartitionExtractStatus>,
  completedPartitions: Set<string>,
): backend.PartitionExtractStatus | undefined {
  const fromMap = partitionStatuses.get(name);
  if (fromMap) {
    return fromMap;
  }
  if (completedPartitions.has(name)) {
    return 'completed';
  }
  return;
}
