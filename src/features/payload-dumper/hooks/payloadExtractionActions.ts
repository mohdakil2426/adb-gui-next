import { toast } from 'sonner';
import { CreateCancellationToken, ExtractPayload } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import {
  DOWNLOAD_PARTITION,
  usePayloadProgressStore,
} from '@/features/payload-dumper/model/payloadProgressStore';
import { useLogStore } from '@/shared/stores/logStore';

interface PartitionInfo {
  name: string;
  selected: boolean;
}

interface ExtractDependencies {
  addCompletedPartitions: (partitions: string[]) => void;
  clearPartitionProgress: () => void;
  clearTransientPartitionStatuses: () => void;
  completedPartitions: Set<string>;
  failActivePartitions: () => void;
  mode: 'local' | 'remote';
  outputDir: string;
  outputPath: string;
  partitions: PartitionInfo[];
  payloadPath: string;
  prefetch: boolean;
  setCancelTokenId: (id: string | null) => void;
  setErrorMessage: (message: string) => void;
  setExtractedFiles: (files: string[]) => void;
  setExtractingPartitions: (partitions: Set<string>) => void;
  setExtractionStats: (stats: backend.ExtractionStats | null) => void;
  setOutputDir: (dir: string) => void;
  setStatus: (status: 'error' | 'extracting' | 'ready' | 'success') => void;
}

function isCancelledMessage(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }
  return message.toLowerCase().includes('cancelled');
}

function partitionNameFromExtractedFile(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  return base.replace(/\.img$/i, '');
}

export async function runExtractPayload({
  addCompletedPartitions,
  clearPartitionProgress,
  clearTransientPartitionStatuses,
  completedPartitions,
  failActivePartitions,
  mode,
  outputDir,
  outputPath,
  partitions,
  payloadPath,
  prefetch,
  setCancelTokenId,
  setErrorMessage,
  setExtractedFiles,
  setExtractingPartitions,
  setExtractionStats,
  setOutputDir,
  setStatus,
}: ExtractDependencies) {
  if (!payloadPath) {
    toast.error('Please select a payload file');
    return;
  }

  const partitionsToExtract: string[] = [];
  for (const p of partitions) {
    if (p.selected && !completedPartitions.has(p.name)) {
      partitionsToExtract.push(p.name);
    }
  }
  if (partitionsToExtract.length === 0) {
    const selectedCount = partitions.filter((p) => p.selected).length;
    if (selectedCount > 0 && completedPartitions.size > 0) {
      toast.info('All selected partitions have already been extracted');
    } else {
      toast.error('Please select at least one partition');
    }
    return;
  }

  // Create cancel token BEFORE status=extracting so Cancel is never a silent no-op.
  let cancelTokenId: string;
  try {
    cancelTokenId = await CreateCancellationToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setErrorMessage(message);
    setStatus('error');
    toast.error(`Failed to start extraction: ${message}`);
    useLogStore.getState().addLog(`Failed to create cancellation token: ${message}`, 'error');
    return;
  }

  setCancelTokenId(cancelTokenId);
  setStatus('extracting');
  setErrorMessage('');
  // Seeds partitionStatuses → pending for each name in the set.
  setExtractingPartitions(new Set(partitionsToExtract));
  const toastId = toast.loading(`Extracting ${partitionsToExtract.length} partition(s)...`);
  useLogStore
    .getState()
    .addLog(`Starting extraction of ${partitionsToExtract.length} partitions...`, 'info');

  try {
    const targetOutputPath = outputDir || outputPath;
    const result = await ExtractPayload(
      payloadPath,
      targetOutputPath,
      partitionsToExtract,
      mode === 'remote' ? prefetch : undefined,
      cancelTokenId,
    );

    const newFiles = result.extractedFiles || [];
    if (newFiles.length > 0) {
      setExtractedFiles([...usePayloadDumperStore.getState().extractedFiles, ...newFiles]);
      addCompletedPartitions(newFiles.map(partitionNameFromExtractedFile));
    }
    if (result.outputDir) {
      setOutputDir(result.outputDir);
    }
    if (result.stats) {
      setExtractionStats(result.stats);
    } else if (result.success) {
      // Light 4.2: fall back to live progress samples when Rust stats are absent.
      const fallback = aggregateProgressStats(newFiles.length);
      if (fallback) {
        setExtractionStats(fallback);
      }
    }

    if (newFiles.length > 0) {
      const parts = newFiles.map(partitionNameFromExtractedFile);
      const totalBytes = result.stats?.totalBytes ?? 0;
      const duration = result.stats?.durationMs ?? 0;
      usePayloadDumperStore.getState().addToHistory({
        duration,
        id: `extract-${Date.now()}`,
        outputDir: result.outputDir || outputDir || outputPath,
        partitions: parts,
        payloadPath,
        status: result.success
          ? 'success'
          : isCancelledMessage(result.error)
            ? 'cancelled'
            : 'error',
        timestamp: Date.now(),
        totalBytes,
      });
    }
    if (result.success) {
      setStatus('success');
      setExtractingPartitions(new Set());
      clearTransientPartitionStatuses();
      clearPartitionProgress();
      toast.success(`Extraction complete! ${newFiles.length} files extracted`, { id: toastId });
      useLogStore
        .getState()
        .addLog(`Extraction complete: ${newFiles.length} files to ${result.outputDir}`, 'success');
      return;
    }

    // Cancel is a first-class terminal state (rhythmcache GUI / otaripper pattern), not a hard error.
    if (isCancelledMessage(result.error)) {
      setErrorMessage('');
      setStatus(newFiles.length > 0 ? 'success' : 'ready');
      setExtractingPartitions(new Set());
      clearTransientPartitionStatuses();
      clearPartitionProgress();
      const message =
        newFiles.length > 0
          ? `Extraction cancelled — ${newFiles.length} file(s) kept`
          : 'Extraction cancelled';
      toast.info(message, { id: toastId });
      useLogStore.getState().addLog(message, 'info');
      return;
    }

    setErrorMessage(result.error ?? 'Unknown error');
    setStatus('error');
    failActivePartitions();
    clearPartitionProgress();
    toast.error(`Extraction failed: ${result.error}`, { id: toastId });
    useLogStore.getState().addLog(`Extraction failed: ${result.error}`, 'error');
  } catch (error) {
    const message = String(error);
    if (isCancelledMessage(message)) {
      setExtractingPartitions(new Set());
      clearTransientPartitionStatuses();
      clearPartitionProgress();
      setErrorMessage('');
      setStatus('ready');
      toast.info('Extraction cancelled', { id: toastId });
      useLogStore.getState().addLog('Extraction cancelled', 'info');
      return;
    }
    failActivePartitions();
    clearPartitionProgress();
    setErrorMessage(message);
    setStatus('error');
    toast.error(`Extraction failed: ${error}`, { id: toastId });
    useLogStore.getState().addLog(`Extraction failed: ${error}`, 'error');
  } finally {
    setCancelTokenId(null);
  }
}

/** Best-effort stats from last progress samples when ExtractPayloadResult.stats is missing. */
function aggregateProgressStats(partitionsExtracted: number): backend.ExtractionStats | null {
  const progress = usePayloadProgressStore.getState().partitionProgress;
  let totalBytes = 0;
  let throughputSum = 0;
  let throughputCount = 0;
  for (const [name, p] of progress) {
    if (name === DOWNLOAD_PARTITION) {
      continue;
    }
    totalBytes += p.bytesWritten || p.totalBytes || 0;
    if (p.throughputMbps > 0) {
      throughputSum += p.throughputMbps;
      throughputCount++;
    }
  }
  if (partitionsExtracted === 0 && totalBytes === 0) {
    return null;
  }
  return {
    durationMs: 0,
    partitionsExtracted,
    throughputMbps: throughputCount > 0 ? throughputSum / throughputCount : 0,
    totalBytes,
  };
}

export function runResetPayloadDumper(
  reset: () => void,
  setMode: (mode: 'local' | 'remote') => void,
  setRemoteUrl: (url: string) => void,
  setPrefetch: (prefetch: boolean) => void,
  setConnectionStatus: (status: 'idle') => void,
  setEstimatedSize: (size: string | null) => void,
  setRemoteMetadata: (metadata: null) => void,
  cancelLoadingRef: { current: boolean },
) {
  reset();
  setMode('local');
  setRemoteUrl('');
  setPrefetch(false);
  setConnectionStatus('idle');
  setEstimatedSize(null);
  setRemoteMetadata(null);
  cancelLoadingRef.current = false;
  useLogStore.getState().addLog('Dumper reset', 'info');
}
