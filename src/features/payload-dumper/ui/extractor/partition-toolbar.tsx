import { ArrowDownUp, CheckSquare, Search, Square } from "lucide-react";

import type { CategoryFilterType } from "@/features/payload-dumper/ui/extractor/partition-category-filter";
import { PartitionCategoryFilter } from "@/features/payload-dumper/ui/extractor/partition-category-filter";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { formatBytes } from "@/shared/utils/format";

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

export const PartitionToolbar = ({
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
}: PartitionToolbarProps) => (
  <div className="flex flex-col gap-3.5">
    {/* Top Bar: Search Input & Category Filters */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative max-w-sm min-w-[200px] flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          aria-label="Search partitions"
          className="text-body h-8 pl-8"
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
    <div className="border-border/50 text-caption flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
      <div className="text-muted-foreground flex items-center gap-2">
        <span className="text-foreground font-medium">
          {filteredCount} of {totalCount} partitions shown
        </span>
        <span>·</span>
        <span className="tabular-nums">
          {selectedCount} selected ({formatBytes(toExtractSize)} to extract)
        </span>
        {completedCount > 0 ? (
          <>
            <span>·</span>
            <span className="text-success font-medium">{completedCount} extracted</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          className="text-caption h-7 px-2"
          disabled={isBusy}
          onClick={onToggleAll}
          size="sm"
          type="button"
          variant="ghost"
        >
          {allFilteredSelected ? (
            <>
              <Square className="mr-1 size-3.5" data-icon="inline-start" /> Deselect All
            </>
          ) : (
            <>
              <CheckSquare className="mr-1 size-3.5" data-icon="inline-start" /> Select All
            </>
          )}
        </Button>
        <Button
          className="text-caption h-7 px-2"
          disabled={isBusy}
          onClick={onInvertFiltered}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowDownUp className="mr-1 size-3.5" data-icon="inline-start" /> Invert Selection
        </Button>
      </div>
    </div>
  </div>
);
