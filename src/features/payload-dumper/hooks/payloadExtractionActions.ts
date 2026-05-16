import { toast } from 'sonner';
import { CreateCancellationToken, ExtractPayload } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { useLogStore } from '@/shared/stores/logStore';

interface PartitionInfo {
  name: string;
  selected: boolean;
}

interface ExtractDependencies {
  addCompletedPartitions: (partitions: string[]) => void;
  clearPartitionProgress: () => void;
  completedPartitions: Set<string>;
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
  setStatus: (status: 'error' | 'extracting' | 'success') => void;
}

export async function runExtractPayload({
  addCompletedPartitions,
  clearPartitionProgress,
  completedPartitions,
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

  setStatus('extracting');
  setErrorMessage('');
  setExtractingPartitions(new Set(partitionsToExtract));
  const toastId = toast.loading(`Extracting ${partitionsToExtract.length} partition(s)...`);
  useLogStore
    .getState()
    .addLog(`Starting extraction of ${partitionsToExtract.length} partitions...`, 'info');

  try {
    const cancelTokenId = await CreateCancellationToken();
    setCancelTokenId(cancelTokenId);
    const targetOutputPath = outputDir || outputPath;
    const result = await ExtractPayload(
      payloadPath,
      targetOutputPath,
      partitionsToExtract,
      mode === 'remote' ? prefetch : undefined,
      cancelTokenId,
    );
    if (result.success) {
      const newFiles = result.extractedFiles || [];
      setExtractedFiles([...usePayloadDumperStore.getState().extractedFiles, ...newFiles]);
      setOutputDir(result.outputDir || '');
      setStatus('success');
      if (result.stats) {
        setExtractionStats(result.stats);
      }
      addCompletedPartitions(newFiles.map((f) => f.replace('.img', '')));
      setExtractingPartitions(new Set());
      clearPartitionProgress();
      toast.success(`Extraction complete! ${newFiles.length} files extracted`, { id: toastId });
      useLogStore
        .getState()
        .addLog(`Extraction complete: ${newFiles.length} files to ${result.outputDir}`, 'success');
      return;
    }
    setErrorMessage(result.error ?? 'Unknown error');
    setStatus('error');
    setExtractingPartitions(new Set());
    clearPartitionProgress();
    toast.error(`Extraction failed: ${result.error}`, { id: toastId });
    useLogStore.getState().addLog(`Extraction failed: ${result.error}`, 'error');
  } catch (error) {
    setErrorMessage(String(error));
    setStatus('error');
    setExtractingPartitions(new Set());
    clearPartitionProgress();
    toast.error(`Extraction failed: ${error}`, { id: toastId });
    useLogStore.getState().addLog(`Extraction failed: ${error}`, 'error');
  } finally {
    setCancelTokenId(null);
  }
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
