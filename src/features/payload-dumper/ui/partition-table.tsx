import { Search } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import type { backend } from "@/desktop/models";
import { PARTITION_GRID_COLUMNS } from "@/features/payload-dumper/ui/partition-grid";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { formatBytes } from "@/shared/utils/format";

import { PartitionRow } from "./partition-row";

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
const resolveRowStatus = (
  name: string,
  partitionStatuses: Map<string, backend.PartitionExtractStatus>,
  completedPartitions: Set<string>
): backend.PartitionExtractStatus | undefined => {
  const fromMap = partitionStatuses.get(name);
  if (fromMap) {
    return fromMap;
  }
  if (completedPartitions.has(name)) {
    return "completed";
  }
  return undefined;
};

export const PartitionTable = ({
  partitions,
  completedPartitions,
  partitionProgress,
  partitionStatuses,
  isExtractionActive,
  status,
  onToggle,
  onToggleAll,
}: PartitionTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPartitions = useMemo(() => {
    const indexedPartitions = partitions.map((partition, index) => ({
      index,
      partition,
    }));
    if (!searchQuery.trim()) {
      return indexedPartitions;
    }
    const query = searchQuery.toLowerCase();
    return indexedPartitions.filter(({ partition }) =>
      partition.name.toLowerCase().includes(query)
    );
  }, [partitions, searchQuery]);

  const { toExtractCount, toExtractSize } = useMemo(() => {
    let count = 0;
    let size = 0;
    for (const { partition: p } of filteredPartitions) {
      if (p.selected && !completedPartitions.has(p.name)) {
        count += 1;
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
  const failedCount = [...partitionStatuses.values()].filter((s) => s === "failed").length;
  const allSelected =
    filteredPartitions.length > 0 &&
    filteredPartitions.every(({ partition }) => partition.selected);
  const isFiltered = searchQuery.trim().length > 0;
  const selectionLocked = status === "extracting" || status === "cancelling";

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Summary + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="numeric text-caption text-muted-foreground">
          {isFiltered ? `${filteredPartitions.length} of ${partitions.length} shown · ` : ""}
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
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </div>

      {/* Table container */}
      <div className="border-border bg-surface overflow-hidden rounded-lg border">
        <div className="border-border relative flex items-center border-b px-3 py-2">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute left-5 size-3.5"
          />
          <Input
            aria-label="Search partitions"
            className="text-body h-8 w-full pl-7"
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Search partitions…"
            value={searchQuery}
          />
        </div>

        {/* Header — the grid never changes, so rows never reflow mid-extraction */}
        <div
          className="border-border bg-surface-raised text-caption text-muted-foreground grid grid-cols-(--grid-cols) gap-2 border-b px-3 py-2 tracking-wide uppercase"
          style={{ "--grid-cols": PARTITION_GRID_COLUMNS } as CSSProperties}
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
        <div className="divide-border/60 max-h-[min(40vh,28rem)] min-h-[120px] divide-y overflow-x-hidden overflow-y-auto">
          {filteredPartitions.length === 0 ? (
            <p className="text-body text-muted-foreground px-3 py-6 text-center">
              {`No partition matches “${searchQuery}” — clear the search to see all ${partitions.length}.`}
            </p>
          ) : null}
          {filteredPartitions.map(({ partition, index }) => {
            const extractStatus = resolveRowStatus(
              partition.name,
              partitionStatuses,
              completedPartitions
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
};
