import React, { useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Package,
  FileArchive,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  HardDrive,
  FolderOutput,
  FileDown,
  ExternalLink,
} from 'lucide-react';
import { cn, getFileName } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckboxItem } from '@/components/CheckboxItem';
import { Progress } from '@/components/ui/progress';
import { useLogStore } from '@/lib/logStore';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';
import {
  SelectPayloadFile,
  SelectOutputDirectory,
  ListPayloadPartitionsWithDetails,
  ExtractPayload,
  OpenFolder,
  CleanupPayloadCache,
} from '@/lib/desktop/backend';
import { EventsOn } from '@/lib/desktop/runtime';
import { DropZone } from '@/components/DropZone';

// Format bytes to human-readable size
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Extraction progress indicator using shadcn Progress
function ExtractionProgressBar({
  isExtracting,
  isCompleted,
  realProgress,
}: {
  isExtracting: boolean;
  isCompleted: boolean;
  realProgress?: number;
}) {
  const displayProgress = isCompleted ? 100 : (realProgress ?? 0);
  if (!isExtracting && !isCompleted) return null;

  return (
    <div className="flex items-center gap-2 w-full">
      <Progress
        value={displayProgress}
        className={cn('flex-1 h-1.5', isCompleted ? '[&>div]:bg-success' : '')}
      />
      <span
        className={cn(
          'text-[10px] font-medium tabular-nums w-8 text-right shrink-0',
          isCompleted ? 'text-success' : 'text-primary',
        )}
      >
        {Math.round(displayProgress)}%
      </span>
    </div>
  );
}

export function ViewPayloadDumper({ activeView: _activeView }: { activeView: string }) {
  // Use Zustand store for state persistence
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
    setPayloadPath,
    setOutputPath,
    setPartitions,
    togglePartition,
    toggleAll,
    setStatus,
    setExtractedFiles,
    setErrorMessage,
    setOutputDir,
    setExtractingPartitions,
    addCompletedPartitions,
    markPartitionCompleted,
    updatePartitionProgress,
    clearPartitionProgress,
    reset,
  } = usePayloadDumperStore();

  // Subscribe to real-time progress events from backend
  useEffect(() => {
    const unlisten = EventsOn(
      'payload:progress',
      (data: { partitionName: string; current: number; total: number; completed: boolean }) => {
        // Update progress
        updatePartitionProgress(data.partitionName, data.current, data.total);

        // If partition extraction is completed, mark it as done immediately
        if (data.completed) {
          markPartitionCompleted(data.partitionName);
        }
      },
    );

    return unlisten;
  }, [updatePartitionProgress, markPartitionCompleted]);

  // Calculate selected partitions that are NOT already extracted
  const selectedNotExtracted = useMemo(() => {
    return partitions.filter((p) => p.selected && !completedPartitions.has(p.name));
  }, [partitions, completedPartitions]);

  const selectedCount = partitions.filter((p) => p.selected).length;
  const toExtractCount = selectedNotExtracted.length;
  const toExtractSize = selectedNotExtracted.reduce((acc, p) => acc + p.size, 0);
  const allSelected = partitions.length > 0 && partitions.every((p) => p.selected);
  const hasCompletedPartitions = completedPartitions.size > 0;
  const isExtractionActive = status === 'extracting' || hasCompletedPartitions;
  const totalPayloadSize = partitions.reduce((acc, p) => acc + p.size, 0);

  // Effective output path: use outputDir if already extracted, otherwise user-selected outputPath
  const effectiveOutputPath = outputDir || outputPath;

  // Auto-load partitions when payload is selected (preserves extracted status on refresh)
  const loadPartitions = useCallback(
    async (path: string) => {
      if (!path) return;

      setStatus('loading-partitions');
      setErrorMessage('');
      useLogStore.getState().addLog('Loading partitions from payload...', 'info');

      try {
        debugLog(`Loading partitions from: ${path}`);
        const partitionList = await ListPayloadPartitionsWithDetails(path);
        if (partitionList && partitionList.length > 0) {
          // Get current completed partitions to preserve their deselected state
          const currentCompleted = usePayloadDumperStore.getState().completedPartitions;

          setPartitions(
            partitionList.map((p) => ({
              name: p.name,
              size: p.size,
              // Don't select partitions that are already extracted
              selected: !currentCompleted.has(p.name),
            })),
          );
          setStatus('ready');
          toast.success(`Found ${partitionList.length} partitions`);
          handleSuccess('Load Partitions', `Found ${partitionList.length} partitions`);
        } else {
          setErrorMessage('No partitions found in payload');
          setStatus('error');
          useLogStore.getState().addLog('No partitions found in payload', 'error');
        }
      } catch (error) {
        setErrorMessage(String(error));
        setStatus('error');
        handleError('Load Partitions', error);
      }
    },
    [setStatus, setErrorMessage, setPartitions],
  );

  // Handle payload file dropped via DropZone
  const handlePayloadDrop = useCallback(
    async (paths: string[]) => {
      if (status === 'extracting' || status === 'loading-partitions') return;
      if (paths.length === 0) return;

      const filePath = paths[0];

      // Clean up any previously extracted temp files
      await CleanupPayloadCache();

      setPayloadPath(filePath);
      toast.success('Payload file selected');
      useLogStore.getState().addLog(`Selected payload: ${filePath}`, 'info');
      await loadPartitions(filePath);
    },
    [status, setPayloadPath, loadPartitions],
  );

  const handleSelectPayload = async () => {
    try {
      debugLog('Selecting payload file');
      const path = await SelectPayloadFile();
      if (path) {
        // Clean up any previously extracted temp files
        await CleanupPayloadCache();

        setPayloadPath(path);
        toast.success('Payload file selected');
        useLogStore.getState().addLog(`Selected payload: ${path}`, 'info');
        // Auto-load partitions
        await loadPartitions(path);
      }
    } catch (error) {
      handleError('Select Payload File', error);
    }
  };

  const handleSelectOutput = async () => {
    try {
      debugLog('Selecting output directory');
      const path = await SelectOutputDirectory();
      if (path) {
        setOutputPath(path);
        toast.success('Output directory selected');
        useLogStore.getState().addLog(`Selected output directory: ${path}`, 'info');
      }
    } catch (error) {
      handleError('Select Output Directory', error);
    }
  };

  const handleOpenOutputFolder = async () => {
    if (!effectiveOutputPath) {
      toast.error('No output folder to open');
      return;
    }

    try {
      debugLog(`Opening folder: ${effectiveOutputPath}`);
      await OpenFolder(effectiveOutputPath);
    } catch (error) {
      handleError('Open Output Folder', error);
    }
  };

  const handleRefreshPartitions = async () => {
    if (payloadPath) {
      await loadPartitions(payloadPath);
    }
  };

  const handleToggleAll = () => {
    toggleAll(!allSelected);
  };

  const handleExtract = async () => {
    if (!payloadPath) {
      toast.error('Please select a payload file');
      return;
    }

    // Get selected partitions that haven't been extracted yet
    const partitionsToExtract = selectedNotExtracted.map((p) => p.name);

    if (partitionsToExtract.length === 0) {
      if (selectedCount > 0 && hasCompletedPartitions) {
        toast.info('All selected partitions have already been extracted');
      } else {
        toast.error('Please select at least one partition');
      }
      return;
    }

    setStatus('extracting');
    setErrorMessage('');

    // Start extraction animation only for partitions to extract
    setExtractingPartitions(new Set(partitionsToExtract));

    const toastId = toast.loading(`Extracting ${partitionsToExtract.length} partition(s)...`);
    useLogStore
      .getState()
      .addLog(`Starting extraction of ${partitionsToExtract.length} partitions...`, 'info');

    try {
      // Use previously created outputDir if available, otherwise use user-selected outputPath
      const targetOutputPath = outputDir || outputPath;
      const result = await ExtractPayload(payloadPath, targetOutputPath, partitionsToExtract);

      if (result.success) {
        // Add new files to existing extracted files
        const newFiles = result.extractedFiles || [];
        setExtractedFiles([...usePayloadDumperStore.getState().extractedFiles, ...newFiles]);
        setOutputDir(result.outputDir || '');
        setStatus('success');

        // Add newly completed partitions (merge with existing) and deselect them
        const newCompleted = newFiles.map((f) => f.replace('.img', ''));
        addCompletedPartitions(newCompleted);
        setExtractingPartitions(new Set());
        clearPartitionProgress();

        toast.success(`Extraction complete! ${newFiles.length} files extracted`, {
          id: toastId,
        });
        useLogStore
          .getState()
          .addLog(
            `Extraction complete: ${newFiles.length} files to ${result.outputDir}`,
            'success',
          );
      } else {
        setErrorMessage(result.error || 'Unknown error');
        setStatus('error');
        setExtractingPartitions(new Set());
        clearPartitionProgress();
        toast.error(`Extraction failed: ${result.error}`, { id: toastId });
        useLogStore.getState().addLog(`Extraction failed: ${result.error}`, 'error');
      }
    } catch (error) {
      setErrorMessage(String(error));
      setStatus('error');
      setExtractingPartitions(new Set());
      clearPartitionProgress();
      toast.error(`Extraction failed: ${error}`, { id: toastId });
      useLogStore.getState().addLog(`Extraction failed: ${error}`, 'error');
    }
  };

  const handleReset = () => {
    reset();
    useLogStore.getState().addLog('Payload Dumper reset', 'info');
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Extraction Setup
          </CardTitle>
          <CardDescription>Select payload file and output directory for extraction</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!payloadPath ? (
            /* ── State: Empty — DropZone ── */
            <DropZone
              onFilesDropped={handlePayloadDrop}
              onBrowse={handleSelectPayload}
              acceptExtensions={['.bin', '.zip']}
              rejectMessage="Only payload.bin or .zip files are accepted"
              icon={FileArchive}
              label="Drop payload.bin or OTA zip here"
              browseLabel="Select Payload File"
              sublabel="Accepts .bin and .zip files"
              disabled={status === 'extracting' || status === 'loading-partitions'}
            />
          ) : status === 'loading-partitions' && partitions.length === 0 ? (
            /* ── State: Loading — stage indicator ── */
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <div className="relative rounded-full bg-primary/10 p-5">
                  <Loader2 className="size-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <p className="text-sm font-medium">
                  {payloadPath.toLowerCase().endsWith('.zip')
                    ? 'Extracting payload from ZIP...'
                    : 'Parsing partition manifest...'}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {getFileName(payloadPath)}
                </p>
              </div>
            </div>
          ) : (
            /* ── State: Loaded — banner + table + footer ── */
            <>
              {/* Zone 1: File Info Banner */}
              <div className="rounded-lg bg-muted/30 border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileArchive className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium truncate">{getFileName(payloadPath)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleSelectPayload}
                          disabled={status === 'extracting' || status === 'loading-partitions'}
                        >
                          <FileArchive className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Change Payload</TooltipContent>
                    </Tooltip>
                    {partitions.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleRefreshPartitions}
                            disabled={status === 'loading-partitions' || status === 'extracting'}
                          >
                            <RefreshCw
                              className={cn(
                                'h-3.5 w-3.5',
                                status === 'loading-partitions' && 'animate-spin',
                              )}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Refresh Partitions</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleSelectOutput}
                          disabled={status === 'extracting'}
                        >
                          <FolderOutput className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {effectiveOutputPath || 'Select Output Directory'}
                      </TooltipContent>
                    </Tooltip>
                    {effectiveOutputPath && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleOpenOutputFolder}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Open Output Folder</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {partitions.length > 0 && (
                    <span>
                      {partitions.length} partitions &bull; {formatBytes(totalPayloadSize)} total
                    </span>
                  )}
                  {effectiveOutputPath && (
                    <>
                      <span>&bull;</span>
                      <span className={cn('truncate', outputDir && !outputPath && 'text-success')}>
                        {getFileName(effectiveOutputPath)}
                        {outputDir && !outputPath && ' (auto)'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Zone 2: Partition Table (adaptive columns) */}
              {partitions.length > 0 && (
                <div className="flex flex-col gap-3">
                  {/* Summary + toggle */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedCount}/{partitions.length} selected
                      {hasCompletedPartitions && ` \u2022 ${completedPartitions.size} extracted`}
                      {toExtractCount > 0 && ` \u2022 ${formatBytes(toExtractSize)} to extract`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleAll}
                      className="text-xs h-7"
                      disabled={status === 'extracting'}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="rounded-lg border bg-muted/30 overflow-hidden">
                    {/* Header — adaptive */}
                    <div
                      className={cn(
                        'grid gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                        isExtractionActive
                          ? 'grid-cols-[28px_0.8fr_5fr_72px]'
                          : 'grid-cols-[28px_1fr_72px]',
                      )}
                    >
                      <span></span>
                      <span>Partition</span>
                      {isExtractionActive && <span className="text-center">Progress</span>}
                      <span className="text-right">Size</span>
                    </div>

                    {/* Rows — scrollable */}
                    <div className="divide-y divide-border/50 max-h-100 overflow-y-auto">
                      {partitions.map((partition, index) => {
                        const isRowExtracting = extractingPartitions.has(partition.name);
                        const isRowCompleted = completedPartitions.has(partition.name);
                        const progress = partitionProgress.get(partition.name);
                        const realProgressPercent = progress?.percentage ?? 0;

                        return (
                          <div
                            key={partition.name}
                            onClick={() =>
                              status !== 'extracting' && !isRowCompleted && togglePartition(index)
                            }
                            role="checkbox"
                            aria-checked={isRowCompleted ? true : partition.selected}
                            aria-disabled={status === 'extracting' || isRowCompleted}
                            tabIndex={isRowCompleted || status === 'extracting' ? -1 : 0}
                            onKeyDown={(e) => {
                              if (
                                (e.key === ' ' || e.key === 'Enter') &&
                                status !== 'extracting' &&
                                !isRowCompleted
                              ) {
                                e.preventDefault();
                                togglePartition(index);
                              }
                            }}
                            className={cn(
                              'grid gap-2 px-4 py-3 text-sm transition-colors items-center',
                              isExtractionActive
                                ? 'grid-cols-[28px_0.8fr_5fr_72px]'
                                : 'grid-cols-[28px_1fr_72px]',
                              status !== 'extracting' &&
                                !isRowCompleted &&
                                'cursor-pointer hover:bg-muted/50',
                              partition.selected && !isRowCompleted && 'bg-primary/5',
                              isRowCompleted && 'bg-success/5',
                            )}
                          >
                            {/* Checkbox / completed */}
                            {isRowCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <CheckboxItem
                                checked={partition.selected}
                                disabled={status === 'extracting'}
                              />
                            )}

                            {/* Name */}
                            <div className="flex items-center gap-2 min-w-0">
                              {isRowExtracting && !isRowCompleted ? (
                                <Loader2 className="h-4 w-4 shrink-0 text-primary animate-spin" />
                              ) : (
                                <HardDrive
                                  className={cn(
                                    'h-4 w-4 shrink-0',
                                    isRowCompleted
                                      ? 'text-success'
                                      : partition.selected
                                        ? 'text-primary'
                                        : 'text-muted-foreground',
                                  )}
                                />
                              )}
                              <span
                                className={cn(
                                  'font-medium truncate',
                                  isRowCompleted
                                    ? 'text-success'
                                    : partition.selected
                                      ? 'text-foreground'
                                      : 'text-muted-foreground',
                                )}
                              >
                                {partition.name}
                              </span>
                            </div>

                            {/* Progress — only when extraction active */}
                            {isExtractionActive && (
                              <div className="flex items-center justify-center">
                                <ExtractionProgressBar
                                  isExtracting={isRowExtracting}
                                  isCompleted={isRowCompleted}
                                  realProgress={realProgressPercent}
                                />
                              </div>
                            )}

                            {/* Size */}
                            <span
                              className={cn(
                                'text-xs tabular-nums text-right',
                                isRowCompleted
                                  ? 'text-success font-medium'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {formatBytes(partition.size)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Zone 3: Action Footer */}
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={status === 'extracting'}
                  className="text-muted-foreground"
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button
                  onClick={handleExtract}
                  disabled={
                    !payloadPath ||
                    status === 'extracting' ||
                    status === 'loading-partitions' ||
                    toExtractCount === 0
                  }
                >
                  {status === 'extracting' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {toExtractCount > 0
                        ? `Extract (${toExtractCount}) \u2014 ${formatBytes(toExtractSize)}`
                        : selectedCount > 0
                          ? 'Already Extracted'
                          : 'Select Partitions'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Status / Results Card */}
      {(status === 'success' || status === 'error') && extractedFiles.length > 0 && (
        <Card
          className={cn(
            'border-2',
            status === 'success'
              ? 'border-success/50 bg-success/5'
              : 'border-destructive/50 bg-destructive/5',
          )}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className={cn(
                'flex items-center gap-2 text-lg',
                status === 'success' ? 'text-success' : 'text-destructive',
              )}
            >
              {status === 'success' ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Extraction Complete
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" />
                  Extraction Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status === 'success' && (
              <div className="flex flex-col gap-3">
                {outputDir && (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Saved to:</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <code
                        className="text-xs bg-muted px-3 py-2 rounded flex-1 min-w-0 truncate font-mono border select-all"
                        title={outputDir}
                      >
                        {outputDir}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleOpenOutputFolder}
                            className="h-9 w-9 shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Open in File Explorer</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}
                {extractedFiles.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      Extracted {extractedFiles.length} partition(s):
                    </p>
                    <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {extractedFiles.map((file) => (
                        <div
                          key={file}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <FileDown className="h-3.5 w-3.5 text-success shrink-0" />
                          <span className="truncate">{file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {status === 'error' && errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
