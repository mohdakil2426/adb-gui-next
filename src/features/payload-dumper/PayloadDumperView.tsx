import { useCallback, useMemo, useState } from 'react';
import { usePayloadActions } from '@/features/payload-dumper/hooks/usePayloadActions';
import { usePayloadEvents } from '@/features/payload-dumper/hooks/usePayloadEvents';
import { usePayloadLoadEvents } from '@/features/payload-dumper/hooks/usePayloadLoadEvents';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { usePayloadProgressStore } from '@/features/payload-dumper/model/payloadProgressStore';
import {
  isRemoteSource,
  resolvePayloadViewState,
} from '@/features/payload-dumper/model/payloadViewState';
import { ExtractionStatusCard } from '@/features/payload-dumper/ui/ExtractionStatusCard';
import { LoadingState } from '@/features/payload-dumper/ui/LoadingState';
import { PayloadLoadedPanel } from '@/features/payload-dumper/ui/PayloadLoadedPanel';
import { PayloadSourceTabs } from '@/features/payload-dumper/ui/PayloadSourceTabs';
import { RemoteLoadProgressCard } from '@/features/payload-dumper/ui/RemoteLoadProgressCard';
import type { ConnectionStatus } from '@/shared/components/RemoteUrlPanel';

export function ViewPayloadDumper() {
  const payloadPath = usePayloadDumperStore((state) => state.payloadPath);
  const outputPath = usePayloadDumperStore((state) => state.outputPath);
  const partitions = usePayloadDumperStore((state) => state.partitions);
  const status = usePayloadDumperStore((state) => state.status);
  const extractedFiles = usePayloadDumperStore((state) => state.extractedFiles);
  const errorMessage = usePayloadDumperStore((state) => state.errorMessage);
  const outputDir = usePayloadDumperStore((state) => state.outputDir);
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

  // Local UI state — transient, doesn't need to survive view switches
  const [prefetch, setPrefetch] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Subscribe to extract + remote load progress events
  usePayloadEvents();
  usePayloadLoadEvents();

  // All action handlers
  const actions = usePayloadActions({
    mode: activeMode,
    remoteUrl,
    prefetch,
    setConnectionStatus,
    setEstimatedSize,
    setMode: setActiveMode,
    setRemoteUrl,
    setPrefetch,
    status,
  });

  const selectedNotExtracted = useMemo(
    () => partitions.filter((p) => p.selected && !completedPartitions.has(p.name)),
    [partitions, completedPartitions],
  );
  const toExtractSize = selectedNotExtracted.reduce((total, p) => total + p.size, 0);
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const isExtractionActive =
    status === 'extracting' ||
    status === 'cancelling' ||
    completedPartitions.size > 0 ||
    partitionStatuses.size > 0;

  const toggleAllPartitions = useCallback(() => {
    toggleAll(!allSelected);
  }, [allSelected, toggleAll]);
  const toggleDetails = useCallback(() => {
    setIsDetailsOpen((open) => !open);
  }, []);

  const viewState = resolvePayloadViewState({
    activeMode,
    partitionCount: partitions.length,
    payloadPath,
    remoteUrl,
    status,
  });
  const isTerminal = status === 'success' || status === 'error';

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <h1 className="sr-only">Payload Dumper</h1>

      {viewState.kind === 'source' ? (
        <PayloadSourceTabs
          connectionStatus={connectionStatus}
          disabled={status === 'extracting' || status === 'loading-partitions'}
          estimatedSize={estimatedSize}
          isLoadingPartitions={status === 'loading-partitions'}
          loadDetail={loadDetail}
          loadMessage={loadMessage}
          loadPhase={loadPhase}
          loadStartedAt={loadStartedAt}
          loadStep={loadStep}
          loadTotalSteps={loadTotalSteps}
          mode={activeMode}
          onCancelLoadPartitions={actions.handleCancelLoadPartitions}
          onCheckUrl={actions.handleCheckUrl}
          onLoadRemotePartitions={actions.loadRemotePartitions}
          onModeChange={setActiveMode}
          onPayloadDrop={actions.handlePayloadDrop}
          onPrefetchChange={setPrefetch}
          onSelectPayload={actions.handleSelectPayload}
          onUrlChange={setRemoteUrl}
          prefetch={prefetch}
          remoteUrl={remoteUrl}
        />
      ) : null}

      {viewState.kind === 'loading-remote' ? (
        <RemoteLoadProgressCard
          detail={loadDetail}
          estimatedSizeLabel={estimatedSize}
          message={loadMessage}
          onCancel={actions.handleCancelLoadPartitions}
          phase={loadPhase}
          startedAt={loadStartedAt ?? Date.now()}
          step={loadStep}
          totalSteps={loadTotalSteps}
        />
      ) : null}

      {viewState.kind === 'loading-local' ? (
        <LoadingState mode={activeMode} payloadPath={payloadPath} remoteUrl={remoteUrl} />
      ) : null}

      {viewState.kind === 'loaded' ? (
        <PayloadLoadedPanel
          completedPartitions={completedPartitions}
          effectiveOutputPath={outputDir || outputPath}
          isDetailsOpen={isDetailsOpen}
          isExtractionActive={isExtractionActive}
          isRemote={isRemoteSource(activeMode, payloadPath)}
          onCancelExtraction={cancelExtraction}
          onExtract={actions.handleExtract}
          onOpenOutputFolder={actions.handleOpenOutputFolder}
          onRefreshPartitions={actions.handleRefreshPartitions}
          onReset={actions.handleReset}
          onSelectOutput={actions.handleSelectOutput}
          onSelectPayload={actions.handleSelectPayload}
          onToggleAll={toggleAllPartitions}
          onToggleDetails={toggleDetails}
          onTogglePartition={togglePartition}
          outputIsAuto={Boolean(outputDir)}
          outputPath={outputPath}
          partitionProgress={partitionProgress}
          partitionStatuses={partitionStatuses}
          partitions={partitions}
          payloadPath={payloadPath}
          prefetch={prefetch}
          remoteMetadata={remoteMetadata}
          remoteUrl={remoteUrl}
          status={status}
          toExtractCount={selectedNotExtracted.length}
          toExtractSize={toExtractSize}
        />
      ) : null}

      {/*
        Every terminal status renders, including a failure that wrote nothing.
        This used to be gated on `extractedFiles.length > 0`, so an extraction
        that died before the first write left the screen unchanged and the user
        with only a toast that had already gone.
      */}
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
