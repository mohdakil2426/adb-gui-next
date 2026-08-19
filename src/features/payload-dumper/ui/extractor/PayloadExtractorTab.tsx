import { ArrowDownUp, CheckSquare, Search, Square } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { backend } from '@/desktop/models';
import type { PartitionProgress } from '@/features/payload-dumper/model/payloadProgressStore';
import { ActionFooter } from '@/features/payload-dumper/ui/ActionFooter';
import {
  type CategoryFilterType,
  PartitionCategoryFilter,
} from '@/features/payload-dumper/ui/extractor/PartitionCategoryFilter';
import { PartitionTableList } from '@/features/payload-dumper/ui/extractor/PartitionTableList';
import { LoadingState } from '@/features/payload-dumper/ui/LoadingState';
import { OutputDirectoryField } from '@/features/payload-dumper/ui/OutputDirectoryField';
import { PayloadSourceTabs } from '@/features/payload-dumper/ui/PayloadSourceTabs';
import { getPartitionCategory } from '@/features/payload-dumper/utils/partitionCategories';
import type { ConnectionStatus } from '@/shared/components/RemoteUrlPanel';
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
  connectionStatus: ConnectionStatus;
  effectiveOutputPath: string;
  estimatedSize: string | null;
  isExtractionActive: boolean;
  isLoadingPartitions: boolean;
  loadDetail?: string | null | undefined;
  loadMessage?: string | undefined;
  loadPhase?: backend.PayloadLoadPhase | null | undefined;
  loadStartedAt?: number | null | undefined;
  loadStep?: number | undefined;
  loadTotalSteps?: number | undefined;
  mode: 'local' | 'remote';
  onCancelExtraction: () => void;
  onCancelLoadPartitions: () => void;
  onCheckUrl: () => void;
  onExtract: () => void;
  onInvertSelection?: () => void;
  onLoadRemotePartitions: () => void;
  onModeChange: (mode: 'local' | 'remote') => void;
  onOpenOutputFolder: () => void;
  onPayloadDrop: (paths: string[]) => void;
  onPrefetchChange: (prefetch: boolean) => void;
  onReset: () => void;
  onSelectOutput: () => void;
  onSelectPayload: () => void;
  onToggleAll: () => void;
  onTogglePartition: (index: number) => void;
  onUrlChange: (url: string) => void;
  outputIsAuto: boolean;
  outputPath: string;
  partitionProgress: Map<string, PartitionProgress>;
  partitionStatuses: Map<string, backend.PartitionExtractStatus>;
  partitions: PartitionInfo[];
  payloadPath: string;
  prefetch: boolean;
  remoteUrl: string;
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
  mode,
  onModeChange,
  remoteUrl,
  onUrlChange,
  prefetch,
  onPrefetchChange,
  connectionStatus,
  estimatedSize,
  isLoadingPartitions,
  loadDetail,
  loadMessage,
  loadPhase,
  loadStartedAt,
  loadStep,
  loadTotalSteps,
  onCheckUrl,
  onPayloadDrop,
  onLoadRemotePartitions,
  onCancelLoadPartitions,
  onTogglePartition,
  onToggleAll,
  onSelectOutput,
  onOpenOutputFolder,
  onExtract,
  onCancelExtraction,
  onReset,
  onSelectPayload,
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

  return (
    <div className="flex flex-col gap-4">
      {/* Integrated Source & Remote Loader Ingestion Card */}
      <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
        <CardContent className="flex flex-col gap-4 p-0">
          <PayloadSourceTabs
            connectionStatus={connectionStatus}
            disabled={isBusy}
            estimatedSize={estimatedSize}
            isLoadingPartitions={isLoadingPartitions}
            loadDetail={loadDetail}
            loadMessage={loadMessage}
            loadPhase={loadPhase}
            loadStartedAt={loadStartedAt}
            loadStep={loadStep}
            loadTotalSteps={loadTotalSteps}
            mode={mode}
            onCancelLoadPartitions={onCancelLoadPartitions}
            onCheckUrl={onCheckUrl}
            onLoadRemotePartitions={onLoadRemotePartitions}
            onModeChange={onModeChange}
            onPayloadDrop={onPayloadDrop}
            onPrefetchChange={onPrefetchChange}
            onSelectPayload={onSelectPayload}
            onUrlChange={onUrlChange}
            prefetch={prefetch}
            remoteUrl={remoteUrl}
          />
        </CardContent>
      </Card>

      {/* Local Parsing Loading State */}
      {status === 'loading-partitions' && mode === 'local' ? (
        <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
          <CardContent className="p-0">
            <LoadingState mode={mode} payloadPath={payloadPath} remoteUrl={remoteUrl} />
          </CardContent>
        </Card>
      ) : null}

      {/* Partitions & Extraction Workspace */}
      {partitions.length > 0 ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
