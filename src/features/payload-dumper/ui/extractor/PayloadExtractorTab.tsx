import { useCallback, useMemo, useState } from 'react';
import type { backend } from '@/desktop/models';
import type { PartitionProgress } from '@/features/payload-dumper/model/payloadProgressStore';
import { ActionFooter } from '@/features/payload-dumper/ui/ActionFooter';
import type { CategoryFilterType } from '@/features/payload-dumper/ui/extractor/PartitionCategoryFilter';
import { PartitionTableList } from '@/features/payload-dumper/ui/extractor/PartitionTableList';
import { PartitionToolbar } from '@/features/payload-dumper/ui/extractor/PartitionToolbar';
import { FileBanner } from '@/features/payload-dumper/ui/FileBanner';
import { LoadingState } from '@/features/payload-dumper/ui/LoadingState';
import { OutputDirectoryField } from '@/features/payload-dumper/ui/OutputDirectoryField';
import { PayloadSourceTabs } from '@/features/payload-dumper/ui/PayloadSourceTabs';
import { getPartitionCategory } from '@/features/payload-dumper/utils/partitionCategories';
import type { ConnectionStatus } from '@/shared/components/RemoteUrlPanel';
import { Card, CardContent } from '@/shared/ui/card';

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
  onRefreshPartitions?: () => void;
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
  remoteMetadata?: backend.RemotePayloadMetadata | null | undefined;
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
  onRefreshPartitions,
  remoteMetadata,
}: PayloadExtractorTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilterType>('all');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const isBusy = status === 'extracting' || status === 'loading-partitions';
  const isRemote =
    mode === 'remote' || payloadPath.startsWith('http://') || payloadPath.startsWith('https://');
  const totalPayloadSize = useMemo(
    () => partitions.reduce((total, partition) => total + partition.size, 0),
    [partitions],
  );
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
      {/* Ingestion & Loading States (shown when no partitions are loaded) */}
      {partitions.length === 0 ? (
        <>
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
        </>
      ) : null}

      {/* Partitions & Extraction Workspace */}
      {partitions.length > 0 ? (
        <>
          {/* Active Loaded Payload Source Banner */}
          <FileBanner
            isDetailsOpen={isDetailsOpen}
            isRemote={isRemote}
            onRefreshPartitions={onRefreshPartitions ?? (() => {})}
            onReset={onReset}
            onSelectPayload={onSelectPayload}
            onToggleDetails={() => setIsDetailsOpen((prev) => !prev)}
            outputPath={effectiveOutputPath}
            partitionCount={partitions.length}
            payloadPath={payloadPath}
            prefetch={prefetch}
            remoteMetadata={remoteMetadata ?? null}
            remoteUrl={remoteUrl}
            status={status}
            totalPayloadSize={totalPayloadSize}
          />

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
              <PartitionToolbar
                activeCategory={activeCategory}
                allFilteredSelected={allFilteredSelected}
                completedCount={completedPartitions.size}
                filteredCount={filteredPartitions.length}
                isBusy={isBusy}
                onInvertFiltered={handleInvertFiltered}
                onSearchChange={setSearchQuery}
                onSelectCategory={setActiveCategory}
                onToggleAll={onToggleAll}
                partitions={partitions}
                searchQuery={searchQuery}
                selectedCount={selectedCount}
                toExtractSize={toExtractSize}
                totalCount={partitions.length}
              />
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
