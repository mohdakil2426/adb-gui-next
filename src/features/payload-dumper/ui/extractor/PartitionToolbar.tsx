import { ArrowDownUp, CheckSquare, Search, Square } from 'lucide-react';
import type { CategoryFilterType } from '@/features/payload-dumper/ui/extractor/PartitionCategoryFilter';
import { PartitionCategoryFilter } from '@/features/payload-dumper/ui/extractor/PartitionCategoryFilter';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { formatBytes } from '@/shared/utils/format';

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}

interface PartitionToolbarProps {
  activeCategory: CategoryFilterType;
  allFilteredSelected: boolean;
  completedCount: number;
  filteredCount: number;
  isBusy: boolean;
  onInvertFiltered: () => void;
  onSearchChange: (query: string) => void;
  onSelectCategory: (category: CategoryFilterType) => void;
  onToggleAll: () => void;
  partitions: PartitionInfo[];
  searchQuery: string;
  selectedCount: number;
  toExtractSize: number;
  totalCount: number;
}

export function PartitionToolbar({
  activeCategory,
  allFilteredSelected,
  completedCount,
  filteredCount,
  isBusy,
  onInvertFiltered,
  onSearchChange,
  onSelectCategory,
  onToggleAll,
  partitions,
  searchQuery,
  selectedCount,
  toExtractSize,
  totalCount,
}: PartitionToolbarProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {/* Top Bar: Search Input & Category Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-body"
            disabled={isBusy}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search partition name (e.g. boot, system)…"
            value={searchQuery}
          />
        </div>

        <PartitionCategoryFilter
          activeCategory={activeCategory}
          onSelectCategory={onSelectCategory}
          partitions={partitions}
        />
      </div>

      {/* Sub-bar: Selection Counters & Bulk Selection Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/50 border-t pt-2.5 text-caption">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-medium text-foreground">
            {filteredCount} of {totalCount} partitions shown
          </span>
          <span>·</span>
          <span className="tabular-nums">
            {selectedCount} selected ({formatBytes(toExtractSize)} to extract)
          </span>
          {completedCount > 0 ? (
            <>
              <span>·</span>
              <span className="font-medium text-success">{completedCount} extracted</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            className="h-7 px-2 text-caption"
            disabled={isBusy}
            onClick={onToggleAll}
            size="sm"
            type="button"
            variant="ghost"
          >
            {allFilteredSelected ? (
              <>
                <Square className="mr-1 size-3.5" /> Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="mr-1 size-3.5" /> Select All
              </>
            )}
          </Button>
          <Button
            className="h-7 px-2 text-caption"
            disabled={isBusy}
            onClick={onInvertFiltered}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowDownUp className="mr-1 size-3.5" /> Invert Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
