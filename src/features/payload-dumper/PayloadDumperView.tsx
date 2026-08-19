import { BarChart3, History, Layers, Store } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePayloadActions } from '@/features/payload-dumper/hooks/usePayloadActions';
import { usePayloadEvents } from '@/features/payload-dumper/hooks/usePayloadEvents';
import { usePayloadLoadEvents } from '@/features/payload-dumper/hooks/usePayloadLoadEvents';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { usePayloadProgressStore } from '@/features/payload-dumper/model/payloadProgressStore';
import { ExtractionStatusCard } from '@/features/payload-dumper/ui/ExtractionStatusCard';
import { PayloadExtractorTab } from '@/features/payload-dumper/ui/extractor/PayloadExtractorTab';
import { PayloadHistoryTab } from '@/features/payload-dumper/ui/history/PayloadHistoryTab';
import { PayloadMarketplaceTab } from '@/features/payload-dumper/ui/marketplace/PayloadMarketplaceTab';
import { PayloadOverviewTab } from '@/features/payload-dumper/ui/overview/PayloadOverviewTab';
import { PayloadDumperHeroBanner } from '@/features/payload-dumper/ui/PayloadDumperHeroBanner';
import type { ConnectionStatus } from '@/shared/components/RemoteUrlPanel';
import { Card, CardContent } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export type PayloadTabType = 'overview' | 'marketplace' | 'extractor' | 'history';

export function ViewPayloadDumper() {
  const payloadPath = usePayloadDumperStore((state) => state.payloadPath);
  const outputPath = usePayloadDumperStore((state) => state.outputPath);
  const partitions = usePayloadDumperStore((state) => state.partitions);
  const status = usePayloadDumperStore((state) => state.status);
  const extractedFiles = usePayloadDumperStore((state) => state.extractedFiles);
  const errorMessage = usePayloadDumperStore((state) => state.errorMessage);
  const outputDir = usePayloadDumperStore((state) => state.outputDir);
  const history = usePayloadDumperStore((state) => state.history);
  const completedPartitions = usePayloadProgressStore((state) => state.completedPartitions);
  const partitionProgress = usePayloadProgressStore((state) => state.partitionProgress);
  const partitionStatuses = usePayloadProgressStore((state) => state.partitionStatuses);
  const remoteUrl = usePayloadDumperStore((state) => state.remoteUrl);
  const activeMode = usePayloadDumperStore((state) => state.activeMode);
  const remoteMetadata = usePayloadDumperStore((state) => state.remoteMetadata);
  const extractionStats = usePayloadDumperStore((state) => state.extractionStats);
  const loadPhase = usePayloadDumperStore((state) => state.loadPhase);
  const loadMessage = usePayloadDumperStore((state) => state.loadMessage);
  const loadDetail = usePayloadDumperStore((state) => state.loadDetail);
  const loadStep = usePayloadDumperStore((state) => state.loadStep);
  const loadTotalSteps = usePayloadDumperStore((state) => state.loadTotalSteps);
  const loadStartedAt = usePayloadDumperStore((state) => state.loadStartedAt);
  const setRemoteUrl = usePayloadDumperStore((state) => state.setRemoteUrl);
  const setActiveMode = usePayloadDumperStore((state) => state.setActiveMode);
  const togglePartition = usePayloadDumperStore((state) => state.togglePartition);
  const toggleAll = usePayloadDumperStore((state) => state.toggleAll);
  const cancelExtraction = usePayloadDumperStore((state) => state.cancelExtraction);
  const clearHistory = usePayloadDumperStore((state) => state.clearHistory);

  // Local UI state
  const [activeTab, setActiveTab] = useState<PayloadTabType>('overview');
  const [prefetch, setPrefetch] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  // Subscribe to extract + remote load progress events
  usePayloadEvents();
  usePayloadLoadEvents();

  // All action handlers
  const actions = usePayloadActions({
    mode: activeMode,
    prefetch,
    remoteUrl,
    setConnectionStatus,
    setEstimatedSize,
    setMode: setActiveMode,
    setPrefetch,
    setRemoteUrl,
    status,
  });

  const handleSelectMarketplaceUrl = useCallback(
    (url: string) => {
      setRemoteUrl(url);
      setActiveMode('remote');
      setActiveTab('extractor');
      actions.handleCheckUrl();
    },
    [setRemoteUrl, setActiveMode, actions],
  );

  const selectedNotExtracted = useMemo(
    () => partitions.filter((p) => p.selected && !completedPartitions.has(p.name)),
    [partitions, completedPartitions],
  );
  const toExtractSize = selectedNotExtracted.reduce((total, p) => total + p.size, 0);
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const totalPayloadSize = useMemo(
    () => partitions.reduce((total, partition) => total + partition.size, 0),
    [partitions],
  );
  const selectedCount = useMemo(() => partitions.filter((p) => p.selected).length, [partitions]);

  const isExtractionActive =
    status === 'extracting' ||
    status === 'cancelling' ||
    completedPartitions.size > 0 ||
    partitionStatuses.size > 0;

  const toggleAllPartitions = useCallback(() => {
    toggleAll(!allSelected);
  }, [allSelected, toggleAll]);

  const isTerminal = status === 'success' || status === 'error';
  const effectiveOutputPath = outputDir || outputPath;
  const outputIsAuto = Boolean(outputDir);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <h1 className="sr-only">Payload Dumper</h1>

      {/* Top Precision Hardware Hero Banner */}
      <PayloadDumperHeroBanner
        activeMode={activeMode}
        completedCount={completedPartitions.size}
        isExtractionActive={isExtractionActive}
        onOpenOutputFolder={actions.handleOpenOutputFolder}
        onRefreshPartitions={actions.handleRefreshPartitions}
        onSelectPayload={actions.handleSelectPayload}
        outputDir={outputDir}
        outputPath={outputPath}
        partitionCount={partitions.length}
        payloadPath={payloadPath}
        remoteMetadata={remoteMetadata}
        remoteUrl={remoteUrl}
        selectedCount={selectedCount}
        status={status}
        totalPayloadSize={totalPayloadSize}
      />

      {/* 4-Tab Precision Hardware Cockpit */}
      <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
        <CardContent className="flex flex-col gap-4 p-0">
          <Tabs
            className="w-full gap-4"
            onValueChange={(v) => setActiveTab(v as PayloadTabType)}
            value={activeTab}
          >
            <TabsList className="w-full">
              <TabsTrigger className="flex-1" value="overview">
                <BarChart3 aria-hidden="true" className="mr-2 size-4" />
                Overview
              </TabsTrigger>

              <TabsTrigger className="flex-1" value="marketplace">
                <Store aria-hidden="true" className="mr-2 size-4" />
                Firmware Hub
              </TabsTrigger>

              <TabsTrigger className="flex-1" value="extractor">
                <Layers aria-hidden="true" className="mr-2 size-4" />
                Extractor & Partitions
                {partitions.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.2 font-mono text-[10px] text-primary">
                    {partitions.length}
                  </span>
                ) : null}
              </TabsTrigger>

              <TabsTrigger className="flex-1" value="history">
                <History aria-hidden="true" className="mr-2 size-4" />
                Extracted Outputs & History
                {history.length > 0 || extractedFiles.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-surface-raised px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                    {history.length || extractedFiles.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Overview */}
            <TabsContent value="overview">
              <PayloadOverviewTab onNavigateTab={setActiveTab} />
            </TabsContent>

            {/* Tab 2: Google Pixel Firmware Marketplace */}
            <TabsContent value="marketplace">
              <PayloadMarketplaceTab onSelectRemoteUrl={handleSelectMarketplaceUrl} />
            </TabsContent>

            {/* Tab 3: Extractor & Partitions Workspace */}
            <TabsContent value="extractor">
              <PayloadExtractorTab
                completedPartitions={completedPartitions}
                connectionStatus={connectionStatus}
                effectiveOutputPath={effectiveOutputPath}
                estimatedSize={estimatedSize}
                isExtractionActive={isExtractionActive}
                isLoadingPartitions={status === 'loading-partitions'}
                loadDetail={loadDetail}
                loadMessage={loadMessage}
                loadPhase={loadPhase}
                loadStartedAt={loadStartedAt}
                loadStep={loadStep}
                loadTotalSteps={loadTotalSteps}
                mode={activeMode}
                onCancelExtraction={cancelExtraction}
                onCancelLoadPartitions={actions.handleCancelLoadPartitions}
                onCheckUrl={actions.handleCheckUrl}
                onExtract={actions.handleExtract}
                onLoadRemotePartitions={actions.loadRemotePartitions}
                onModeChange={setActiveMode}
                onOpenOutputFolder={actions.handleOpenOutputFolder}
                onPayloadDrop={actions.handlePayloadDrop}
                onPrefetchChange={setPrefetch}
                onReset={actions.handleReset}
                onSelectOutput={actions.handleSelectOutput}
                onSelectPayload={actions.handleSelectPayload}
                onToggleAll={toggleAllPartitions}
                onTogglePartition={togglePartition}
                onUrlChange={setRemoteUrl}
                outputIsAuto={outputIsAuto}
                outputPath={outputPath}
                partitionProgress={partitionProgress}
                partitionStatuses={partitionStatuses}
                partitions={partitions}
                payloadPath={payloadPath}
                prefetch={prefetch}
                remoteUrl={remoteUrl}
                status={status}
                toExtractCount={selectedNotExtracted.length}
                toExtractSize={toExtractSize}
              />
            </TabsContent>

            {/* Tab 4: Extracted Outputs & History */}
            <TabsContent value="history">
              <PayloadHistoryTab
                extractedFiles={extractedFiles}
                history={history}
                onClearHistory={clearHistory}
                onNavigateToExtractor={() => setActiveTab('extractor')}
                outputDir={outputDir}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Terminal extraction status card on completion/error */}
      {isTerminal ? (
        <ExtractionStatusCard
          errorMessage={errorMessage}
          extractedFiles={extractedFiles}
          extractionStats={extractionStats}
          onOpenOutputFolder={actions.handleOpenOutputFolder}
          onRetry={actions.handleExtract}
          outputDir={outputDir}
          status={status}
        />
      ) : null}
    </div>
  );
}

export default ViewPayloadDumper;
