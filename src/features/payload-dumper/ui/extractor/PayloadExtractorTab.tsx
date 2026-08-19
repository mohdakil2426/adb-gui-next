import {
  ArrowDownUp,
  CheckSquare,
  FileArchive,
  Layers,
  Search,
  Square,
  UploadCloud,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { backend } from '@/desktop/models';
import type { PartitionProgress } from '@/features/payload-dumper/model/payloadProgressStore';
import { ActionFooter } from '@/features/payload-dumper/ui/ActionFooter';
import {
  type CategoryFilterType,
  PartitionCategoryFilter,
} from '@/features/payload-dumper/ui/extractor/PartitionCategoryFilter';
import { PartitionTableList } from '@/features/payload-dumper/ui/extractor/PartitionTableList';
import { OutputDirectoryField } from '@/features/payload-dumper/ui/OutputDirectoryField';
import { getPartitionCategory } from '@/features/payload-dumper/utils/partitionCategories';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { formatBytes } from '@/shared/utils/format';

interface PartitionInfo {
  name: string;
  selected: boolean;
  size: number;
}

interface PayloadExtractorTabProps {
  completedPartitions: Set<string>;
  effectiveOutputPath: string;
  isExtractionActive: boolean;
  onCancelExtraction: () => void;
  onExtract: () => void;
  onInvertSelection?: () => void;
  onNavigateToSource?: () => void;
  onOpenOutputFolder: () => void;
  onReset: () => void;
  onSelectOutput: () => void;
  onSelectPayload: () => void;
  onToggleAll: () => void;
  onTogglePartition: (index: number) => void;
  outputIsAuto: boolean;
  outputPath: string;
  partitionProgress: Map<string, PartitionProgress>;
  partitionStatuses: Map<string, backend.PartitionExtractStatus>;
  partitions: PartitionInfo[];
  payloadPath: string;
  status: string;
  toExtractCount: number;
  toExtractSize: number;
}

export function PayloadExtractorTab({
  partitions,
  completedPartitions,
  partitionProgress,
  partitionStatuses,
  status,
  payloadPath,
  outputPath,
  effectiveOutputPath,
  outputIsAuto,
  isExtractionActive,
  toExtractCount,
  toExtractSize,
  onTogglePartition,
  onToggleAll,
  onSelectOutput,
  onOpenOutputFolder,
  onExtract,
  onCancelExtraction,
  onReset,
  onSelectPayload,
  onNavigateToSource,
}: PayloadExtractorTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilterType>('all');

  const isBusy = status === 'extracting' || status === 'loading-partitions';

  const filteredPartitions = useMemo(
    () =>
      partitions
        .map((partition, index) => ({ index, partition }))
        .filter(({ partition }) => {
          const matchesSearch = partition.name.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory =
            activeCategory === 'all' || getPartitionCategory(partition.name) === activeCategory;
          return matchesSearch && matchesCategory;
        }),
    [partitions, searchQuery, activeCategory],
  );

  const selectedCount = useMemo(() => partitions.filter((p) => p.selected).length, [partitions]);
  const allFilteredSelected =
    filteredPartitions.length > 0 && filteredPartitions.every((item) => item.partition.selected);

  const handleInvertFiltered = useCallback(() => {
    for (const item of filteredPartitions) {
      onTogglePartition(item.index);
    }
  }, [filteredPartitions, onTogglePartition]);

  if (partitions.length === 0) {
    return (
      <Card className="rounded-xl border-border bg-surface p-8 text-center shadow-none">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <Layers className="size-7 text-muted-foreground" />
          </div>
          <div className="flex max-w-sm flex-col gap-1">
            <h3 className="font-semibold text-foreground text-title">No Partition Table Loaded</h3>
            <p className="text-caption text-muted-foreground">
              Select a local OTA payload.bin file or load a remote OTA stream link to extract
              partitions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onSelectPayload} size="sm" type="button">
              <FileArchive className="mr-1.5 size-3.5" /> Open Local File
            </Button>
            {onNavigateToSource ? (
              <Button onClick={onNavigateToSource} size="sm" type="button" variant="outline">
                <UploadCloud className="mr-1.5 size-3.5" /> Remote URL Stream
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Destination Directory Selector */}
      <OutputDirectoryField
        disabled={status === 'extracting'}
        effectiveOutputPath={effectiveOutputPath}
        isAuto={outputIsAuto && !outputPath}
        onOpenOutputFolder={onOpenOutputFolder}
        onSelectOutput={onSelectOutput}
      />

      {/* Partitions Command Bar */}
      <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
        <CardContent className="flex flex-col gap-3.5 p-0">
          {/* Top Bar: Search Input & Category Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-body"
                disabled={isBusy}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search partition name (e.g. boot, system)…"
                value={searchQuery}
              />
            </div>

            <PartitionCategoryFilter
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              partitions={partitions}
            />
          </div>

          {/* Sub-bar: Selection Counters & Bulk Selection Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-border/50 border-t pt-2.5 text-caption">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium text-foreground">
                {filteredPartitions.length} of {partitions.length} partitions shown
              </span>
              <span>·</span>
              <span className="tabular-nums">
                {selectedCount} selected ({formatBytes(toExtractSize)} to extract)
              </span>
              {completedPartitions.size > 0 ? (
                <>
                  <span>·</span>
                  <span className="font-medium text-success">
                    {completedPartitions.size} extracted
                  </span>
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
                onClick={handleInvertFiltered}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ArrowDownUp className="mr-1 size-3.5" /> Invert Selection
              </Button>
            </div>
          </div>

          {/* Partition Grid List */}
          <PartitionTableList
            filteredPartitions={filteredPartitions}
            isBusy={isBusy}
            isExtractionActive={isExtractionActive}
            onTogglePartition={onTogglePartition}
            partitionProgress={partitionProgress}
            partitionStatuses={partitionStatuses}
          />

          {/* Symmetrical Bottom Action Footer */}
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
        </CardContent>
      </Card>
    </div>
  );
}
