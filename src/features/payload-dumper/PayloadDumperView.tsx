import { FileArchive, Package } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePayloadActions } from '@/features/payload-dumper/hooks/usePayloadActions';
import { usePayloadEvents } from '@/features/payload-dumper/hooks/usePayloadEvents';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { ActionFooter } from '@/features/payload-dumper/ui/ActionFooter';
import { ExtractionStatusCard } from '@/features/payload-dumper/ui/ExtractionStatusCard';
import { FileBanner } from '@/features/payload-dumper/ui/FileBanner';
import { LoadingState } from '@/features/payload-dumper/ui/LoadingState';
import { PartitionTable } from '@/features/payload-dumper/ui/PartitionTable';
import { PayloadSourceTabs } from '@/features/payload-dumper/ui/PayloadSourceTabs';
import type { ConnectionStatus } from '@/shared/components/RemoteUrlPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function ViewPayloadDumper() {
  const payloadPath = usePayloadDumperStore((state) => state.payloadPath);
  const outputPath = usePayloadDumperStore((state) => state.outputPath);
  const partitions = usePayloadDumperStore((state) => state.partitions);
  const status = usePayloadDumperStore((state) => state.status);
  const extractedFiles = usePayloadDumperStore((state) => state.extractedFiles);
  const errorMessage = usePayloadDumperStore((state) => state.errorMessage);
  const outputDir = usePayloadDumperStore((state) => state.outputDir);
  const extractingPartitions = usePayloadDumperStore((state) => state.extractingPartitions);
  const completedPartitions = usePayloadDumperStore((state) => state.completedPartitions);
  const partitionProgress = usePayloadDumperStore((state) => state.partitionProgress);
  const remoteUrl = usePayloadDumperStore((state) => state.remoteUrl);
  const activeMode = usePayloadDumperStore((state) => state.activeMode);
  const remoteMetadata = usePayloadDumperStore((state) => state.remoteMetadata);
  const extractionStats = usePayloadDumperStore((state) => state.extractionStats);
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

  // Subscribe to progress events
  usePayloadEvents();

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

  // Derived values
  const selectedNotExtracted = useMemo(
    () => partitions.filter((p) => p.selected && !completedPartitions.has(p.name)),
    [partitions, completedPartitions],
  );
  const toExtractCount = selectedNotExtracted.length;
  const toExtractSize = selectedNotExtracted.reduce((acc, p) => acc + p.size, 0);
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const hasCompletedPartitions = completedPartitions.size > 0;
  const isExtractionActive = status === 'extracting' || hasCompletedPartitions;
  const totalPayloadSize = partitions.reduce((acc, p) => acc + p.size, 0);
  const effectiveOutputPath = outputDir || outputPath;
  const isRemote =
    activeMode === 'remote' ||
    payloadPath.startsWith('http://') ||
    payloadPath.startsWith('https://');

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
          <div className="relative flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Package aria-hidden="true" className="size-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="sr-only">Payload Dumper</h1>
          <p className="text-muted-foreground text-sm">
            Extract partition images from Android OTA, OnePlus OPS, and Oppo OFP files
          </p>
        </div>
      </div>

      {/* Main Card */}
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive aria-hidden="true" className="size-5" />
            Extraction Setup
          </CardTitle>
          <CardDescription>Select payload file and output directory for extraction</CardDescription>
        </CardHeader>
        <CardContent className="flex w-full min-w-0 flex-col gap-4 overflow-hidden">
          {payloadPath ? (
            status === 'loading-partitions' && partitions.length === 0 ? (
              /* State: Loading — stage indicator */
              <LoadingState mode={activeMode} payloadPath={payloadPath} remoteUrl={remoteUrl} />
            ) : (
              /* State: Loaded — banner + table + footer */
              <>
                {/* Zone 1: File Info Banner */}
                <FileBanner
                  effectiveOutputPath={effectiveOutputPath}
                  isDetailsOpen={isDetailsOpen}
                  isRemote={isRemote}
                  onOpenOutputFolder={actions.handleOpenOutputFolder}
                  onRefreshPartitions={actions.handleRefreshPartitions}
                  onSelectOutput={actions.handleSelectOutput}
                  onSelectPayload={actions.handleSelectPayload}
                  onToggleDetails={() => {
                    setIsDetailsOpen((prev) => !prev);
                  }}
                  outputDir={outputDir}
                  outputPath={outputPath}
                  partitions={partitions}
                  payloadPath={payloadPath}
                  prefetch={prefetch}
                  remoteMetadata={remoteMetadata}
                  remoteUrl={remoteUrl}
                  status={status}
                  totalPayloadSize={totalPayloadSize}
                />

                {/* Zone 2: Partition Table */}
                <PartitionTable
                  completedPartitions={completedPartitions}
                  extractingPartitions={extractingPartitions}
                  isExtractionActive={isExtractionActive}
                  onToggle={togglePartition}
                  onToggleAll={() => {
                    toggleAll(!allSelected);
                  }}
                  partitionProgress={partitionProgress}
                  partitions={partitions}
                  status={status}
                />

                {/* Zone 3: Action Footer */}
                <ActionFooter
                  hasCompletedPartitions={hasCompletedPartitions}
                  onCancel={cancelExtraction}
                  onExtract={actions.handleExtract}
                  onReset={actions.handleReset}
                  payloadPath={payloadPath}
                  selectedCount={partitions.filter((p) => p.selected).length}
                  status={status}
                  toExtractCount={toExtractCount}
                  toExtractSize={toExtractSize}
                />
              </>
            )
          ) : (
            /* State: Empty — Tabs for Local/Remote */
            <PayloadSourceTabs
              connectionStatus={connectionStatus}
              disabled={status === 'extracting' || status === 'loading-partitions'}
              estimatedSize={estimatedSize}
              isLoadingPartitions={status === 'loading-partitions'}
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
          )}
        </CardContent>
      </Card>

      {/* Status / Results Card */}
      {(status === 'success' || status === 'error') && extractedFiles.length > 0 && (
        <ExtractionStatusCard
          errorMessage={errorMessage}
          extractedFiles={extractedFiles}
          extractionStats={extractionStats}
          onOpenOutputFolder={actions.handleOpenOutputFolder}
          outputDir={outputDir}
          status={status}
        />
      )}
    </div>
  );
}
