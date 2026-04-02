import { useMemo, useState } from 'react';
import { Package, FileArchive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';
import { usePayloadEvents } from '@/lib/payload-dumper/usePayloadEvents';
import { usePayloadActions } from '@/lib/payload-dumper/usePayloadActions';
import { PayloadSourceTabs } from '@/components/payload-dumper/PayloadSourceTabs';
import { LoadingState } from '@/components/payload-dumper/LoadingState';
import { FileBanner } from '@/components/payload-dumper/FileBanner';
import { PartitionTable } from '@/components/payload-dumper/PartitionTable';
import { ActionFooter } from '@/components/payload-dumper/ActionFooter';
import { ExtractionStatusCard } from '@/components/payload-dumper/ExtractionStatusCard';
import type { ConnectionStatus } from '@/components/RemoteUrlPanel';

export function ViewPayloadDumper() {
  const {
    payloadPath,
    outputPath,
    partitions,
    status,
    extractedFiles,
    errorMessage,
    outputDir,
    extractingPartitions,
    completedPartitions,
    partitionProgress,
    togglePartition,
    toggleAll,
  } = usePayloadDumperStore();

  // Local UI state
  const [mode, setMode] = useState<'local' | 'remote'>('local');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [prefetch, setPrefetch] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  // Subscribe to progress events
  usePayloadEvents();

  // All action handlers
  const actions = usePayloadActions({
    mode,
    remoteUrl,
    prefetch,
    setConnectionStatus,
    setEstimatedSize,
    setMode,
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
    mode === 'remote' || payloadPath.startsWith('http://') || payloadPath.startsWith('https://');

  return (
    <div className="flex flex-col gap-6 pb-10 w-full min-w-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <div className="relative h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Payload Dumper</h1>
          <p className="text-sm text-muted-foreground">
            Extract partition images from Android OTA payload.bin files
          </p>
        </div>
      </div>

      {/* Main Card */}
      <Card className="w-full overflow-hidden min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Extraction Setup
          </CardTitle>
          <CardDescription>Select payload file and output directory for extraction</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 w-full overflow-hidden min-w-0">
          {!payloadPath ? (
            /* State: Empty — Tabs for Local/Remote */
            <PayloadSourceTabs
              mode={mode}
              onModeChange={setMode}
              remoteUrl={remoteUrl}
              onUrlChange={setRemoteUrl}
              prefetch={prefetch}
              onPrefetchChange={setPrefetch}
              connectionStatus={connectionStatus}
              estimatedSize={estimatedSize}
              onCheckUrl={actions.handleCheckUrl}
              onSelectPayload={actions.handleSelectPayload}
              onPayloadDrop={actions.handlePayloadDrop}
              isLoadingPartitions={status === 'loading-partitions'}
              onLoadRemotePartitions={actions.loadRemotePartitions}
              onCancelLoadPartitions={actions.handleCancelLoadPartitions}
              disabled={status === 'extracting' || status === 'loading-partitions'}
            />
          ) : status === 'loading-partitions' && partitions.length === 0 ? (
            /* State: Loading — stage indicator */
            <LoadingState mode={mode} remoteUrl={remoteUrl} payloadPath={payloadPath} />
          ) : (
            /* State: Loaded — banner + table + footer */
            <>
              {/* Zone 1: File Info Banner */}
              <FileBanner
                payloadPath={payloadPath}
                isRemote={isRemote}
                remoteUrl={remoteUrl}
                partitions={partitions}
                totalPayloadSize={totalPayloadSize}
                effectiveOutputPath={effectiveOutputPath}
                outputDir={outputDir}
                outputPath={outputPath}
                status={status}
                onSelectPayload={actions.handleSelectPayload}
                onRefreshPartitions={actions.handleRefreshPartitions}
                onSelectOutput={actions.handleSelectOutput}
                onOpenOutputFolder={actions.handleOpenOutputFolder}
              />

              {/* Zone 2: Partition Table */}
              <PartitionTable
                partitions={partitions}
                extractingPartitions={extractingPartitions}
                completedPartitions={completedPartitions}
                partitionProgress={partitionProgress}
                isExtractionActive={isExtractionActive}
                status={status}
                onToggle={togglePartition}
                onToggleAll={() => toggleAll(!allSelected)}
              />

              {/* Zone 3: Action Footer */}
              <ActionFooter
                payloadPath={payloadPath}
                status={status}
                toExtractCount={toExtractCount}
                toExtractSize={toExtractSize}
                selectedCount={partitions.filter((p) => p.selected).length}
                hasCompletedPartitions={hasCompletedPartitions}
                onReset={actions.handleReset}
                onExtract={actions.handleExtract}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Status / Results Card */}
      {(status === 'success' || status === 'error') && extractedFiles.length > 0 && (
        <ExtractionStatusCard
          status={status}
          extractedFiles={extractedFiles}
          outputDir={outputDir}
          errorMessage={errorMessage}
          onOpenOutputFolder={actions.handleOpenOutputFolder}
        />
      )}
    </div>
  );
}
