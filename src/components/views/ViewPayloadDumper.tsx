import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
  Upload,
  ExternalLink,
} from 'lucide-react';
import { cn, getFileName } from '@/lib/utils';
import { CheckboxItem } from '@/components/CheckboxItem';
import { Progress } from '@/components/ui/progress';
import { SectionHeader } from '@/components/SectionHeader';
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
import { OnFileDrop, OnFileDropOff, EventsOn, EventsOff } from '@/lib/desktop/runtime';

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

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dropTargetRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time progress events from backend
  useEffect(() => {
    EventsOn(
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

    return () => {
      EventsOff('payload:progress');
    };
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

  // Handle file dropped via Wails runtime
  const handleFileDrop = useCallback(
    async (x: number, y: number, paths: string[]) => {
      setIsDragging(false);

      if (status === 'extracting' || status === 'loading-partitions') {
        return;
      }

      if (paths.length === 0) return;

      const filePath = paths[0];
      const fileName = filePath.toLowerCase();

      // Check if it's a valid file type
      if (!fileName.endsWith('.bin') && !fileName.endsWith('.zip')) {
        toast.error('Please drop a payload.bin or .zip file');
        return;
      }

      // Clean up any previously extracted temp files
      await CleanupPayloadCache();

      setPayloadPath(filePath);
      toast.success('Payload file selected');
      useLogStore.getState().addLog(`Selected payload: ${filePath}`, 'info');
      await loadPartitions(filePath);
    },
    [status, setPayloadPath, loadPartitions],
  );

  // Set up Wails drag and drop listener
  useEffect(() => {
    // Register the file drop handler with Wails runtime
    OnFileDrop(handleFileDrop, false);

    // Clean up when component unmounts
    return () => {
      OnFileDropOff();
    };
  }, [handleFileDrop]);

  // Handle native drag events for visual feedback
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only show overlay if no payload is selected and not busy
      if (!payloadPath && status !== 'extracting' && status !== 'loading-partitions') {
        setIsDragging(true);
      }
    },
    [payloadPath, status],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if leaving the container (not entering a child)
    const rect = dropTargetRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsDragging(false);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

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
        setExtractedFiles([...extractedFiles, ...newFiles]);
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
    <div
      ref={dropTargetRef}
      className="flex flex-col gap-6 pb-10"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
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
      <Card
        className={cn(
          'transition-all duration-200 relative',
          isDragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Extraction Setup
          </CardTitle>
          <CardDescription>Select payload file and output directory for extraction</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Drag & Drop Zone (shown when dragging and no payload selected) */}
          {isDragging && !payloadPath && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-3 text-primary">
                <Upload className="h-12 w-12" />
                <p className="text-lg font-medium">Drop payload.bin here</p>
              </div>
            </div>
          )}

          {/* File Selection Section */}
          <div className="flex flex-col gap-3">
            <SectionHeader>Input & Output</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Input File Button */}
              <div className="flex gap-2 min-w-0">
                <Button
                  variant="secondary"
                  className="flex-1 min-w-0 justify-start pl-4 overflow-hidden"
                  onClick={handleSelectPayload}
                  disabled={status === 'extracting' || status === 'loading-partitions'}
                >
                  {status === 'loading-partitions' ? (
                    <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <FileArchive className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {payloadPath ? getFileName(payloadPath) : 'Select or Drop Payload'}
                  </span>
                </Button>
                {payloadPath && partitions.length > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={handleRefreshPartitions}
                    disabled={status === 'loading-partitions' || status === 'extracting'}
                    title="Refresh Partitions"
                  >
                    <RefreshCw
                      className={cn('h-4 w-4', status === 'loading-partitions' && 'animate-spin')}
                    />
                  </Button>
                )}
              </div>

              {/* Output Directory Button */}
              <div className="flex gap-2 min-w-0">
                <Button
                  variant="secondary"
                  className="flex-1 min-w-0 justify-start pl-4 overflow-hidden"
                  onClick={handleSelectOutput}
                  disabled={status === 'extracting'}
                >
                  <FolderOutput className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {effectiveOutputPath ? getFileName(effectiveOutputPath) : 'Output (Auto)'}
                  </span>
                </Button>
                {effectiveOutputPath && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={handleOpenOutputFolder}
                    title="Open Output Folder"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Path hints */}
            {(payloadPath || effectiveOutputPath) && (
              <div className="text-xs text-muted-foreground flex flex-col gap-1">
                {payloadPath && (
                  <p className="truncate" title={payloadPath}>
                    <span className="font-medium">Input:</span> {payloadPath}
                  </p>
                )}
                {effectiveOutputPath && (
                  <p className="truncate" title={effectiveOutputPath}>
                    <span className="font-medium">Output:</span>{' '}
                    <span className={cn(outputDir && !outputPath && 'text-success')}>
                      {effectiveOutputPath}
                      {outputDir && !outputPath && ' (auto-generated)'}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Partition Selection - Full Table View with Progress */}
          {partitions.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* Partition Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <SectionHeader>Partitions</SectionHeader>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {selectedCount}/{partitions.length} selected
                    {hasCompletedPartitions && ` • ${completedPartitions.size} extracted`}
                    {toExtractCount > 0 && ` • ${formatBytes(toExtractSize)} to extract`}
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
              </div>

              {/* Partition Table */}
              <div className="rounded-lg border bg-muted/30 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[28px_1fr_minmax(120px,1fr)_72px] gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span></span>
                  <span>Partition</span>
                  <span className="text-center">Progress</span>
                  <span className="text-right">Size</span>
                </div>

                {/* Partition List */}
                <div className="divide-y divide-border/50">
                  {partitions.map((partition, index) => {
                    const isExtracting = extractingPartitions.has(partition.name);
                    const isCompleted = completedPartitions.has(partition.name);
                    const progress = partitionProgress.get(partition.name);
                    const realProgressPercent = progress?.percentage ?? 0;

                    return (
                      <div
                        key={partition.name}
                        onClick={() =>
                          status !== 'extracting' && !isCompleted && togglePartition(index)
                        }
                        role="checkbox"
                        aria-checked={isCompleted ? true : partition.selected}
                        aria-disabled={status === 'extracting' || isCompleted}
                        tabIndex={isCompleted || status === 'extracting' ? -1 : 0}
                        onKeyDown={(e) => {
                          if (
                            (e.key === ' ' || e.key === 'Enter') &&
                            status !== 'extracting' &&
                            !isCompleted
                          ) {
                            e.preventDefault();
                            togglePartition(index);
                          }
                        }}
                        className={cn(
                          'grid grid-cols-[28px_1fr_minmax(120px,1fr)_72px] gap-2 px-4 py-3 text-sm transition-colors items-center',
                          status !== 'extracting' &&
                            !isCompleted &&
                            'cursor-pointer hover:bg-muted/50',
                          partition.selected && !isCompleted && 'bg-primary/5',
                          isCompleted && 'bg-success/5',
                        )}
                      >
                        {/* Status Icon (checkbox or completed icon) */}
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <CheckboxItem
                            checked={partition.selected}
                            disabled={status === 'extracting'}
                          />
                        )}

                        {/* Name with Icon */}
                        <div className="flex items-center gap-2 min-w-0">
                          {isExtracting && !isCompleted ? (
                            <Loader2 className="h-4 w-4 shrink-0 text-primary animate-spin" />
                          ) : (
                            <HardDrive
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isCompleted
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
                              isCompleted
                                ? 'text-success'
                                : partition.selected
                                  ? 'text-foreground'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {partition.name}
                          </span>
                        </div>

                        {/* Progress Bar - Centered */}
                        <div className="flex items-center justify-center">
                          <ExtractionProgressBar
                            isExtracting={isExtracting}
                            isCompleted={isCompleted}
                            realProgress={realProgressPercent}
                          />
                        </div>

                        {/* Size */}
                        <span
                          className={cn(
                            'text-xs tabular-nums text-right',
                            isCompleted ? 'text-success font-medium' : 'text-muted-foreground',
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

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <SectionHeader>Actions</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={status === 'extracting'}
                className="justify-start pl-4"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
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
                className="justify-start pl-4"
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
                      ? `Extract (${toExtractCount})`
                      : selectedCount > 0
                        ? 'Already Extracted'
                        : 'Select Partitions'}
                  </>
                )}
              </Button>
            </div>
          </div>
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleOpenOutputFolder}
                        className="h-9 w-9 shrink-0"
                        title="Open in File Explorer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
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
