import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useLogStore } from '@/lib/logStore';
import { usePayloadDumperStore } from '@/lib/payloadDumperStore';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import {
  SelectPayloadFile,
  SelectOutputDirectory,
  ListPayloadPartitionsWithDetails,
  ExtractPayload,
  OpenFolder,
  CleanupPayloadCache,
  CheckRemotePayload,
  ListRemotePayloadPartitions,
  GetRemotePayloadMetadata,
} from '@/lib/desktop/backend';
import { formatBytesNum } from '@/lib/utils';
import type { ExtractionStatus } from '@/lib/payloadDumperStore';

import type { ConnectionStatus } from '@/components/RemoteUrlPanel';

interface UsePayloadActionsOptions {
  mode: 'local' | 'remote';
  remoteUrl: string;
  prefetch: boolean;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setEstimatedSize: (size: string | null) => void;
  setMode: (mode: 'local' | 'remote') => void;
  setRemoteUrl: (url: string) => void;
  setPrefetch: (prefetch: boolean) => void;
  status: ExtractionStatus;
}

interface PayloadActions {
  handleCheckUrl: () => Promise<void>;
  loadRemotePartitions: () => Promise<void>;
  handleCancelLoadPartitions: () => void;
  handlePayloadDrop: (paths: string[]) => Promise<void>;
  handleSelectPayload: () => Promise<void>;
  handleSelectOutput: () => Promise<void>;
  handleOpenOutputFolder: () => Promise<void>;
  handleRefreshPartitions: () => Promise<void>;
  handleExtract: () => Promise<void>;
  handleReset: () => void;
}

export function usePayloadActions(options: UsePayloadActionsOptions): PayloadActions {
  const {
    mode,
    remoteUrl,
    prefetch,
    setConnectionStatus,
    setEstimatedSize,
    setMode,
    setRemoteUrl,
    setPrefetch,
    status,
  } = options;

  const {
    payloadPath,
    outputPath,
    partitions,
    outputDir,
    completedPartitions,
    setPayloadPath,
    setOutputPath,
    setPartitions,
    setStatus,
    setExtractedFiles,
    setErrorMessage,
    setOutputDir,
    setExtractingPartitions,
    addCompletedPartitions,
    clearPartitionProgress,
    setRemoteMetadata,
    reset,
  } = usePayloadDumperStore();

  const cancelLoadingRef = useRef(false);

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
          const currentCompleted = usePayloadDumperStore.getState().completedPartitions;

          setPartitions(
            partitionList.map((p) => ({
              name: p.name,
              size: p.size,
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

  const handleCheckUrl = useCallback(async () => {
    if (!remoteUrl.trim()) return;

    setConnectionStatus('checking');
    setEstimatedSize(null);

    try {
      debugLog(`Checking remote URL: ${remoteUrl}`);
      const info = await CheckRemotePayload(remoteUrl.trim());
      if (info.supportsRanges) {
        setConnectionStatus('ready');
        setEstimatedSize(formatBytesNum(info.contentLength));
        toast.success('URL verified - range requests supported');
        useLogStore
          .getState()
          .addLog(`URL verified: ${formatBytesNum(info.contentLength)}`, 'info');
      } else {
        setConnectionStatus('error');
        toast.error('Server does not support range requests');
        useLogStore.getState().addLog('Server does not support range requests', 'error');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error(`Failed to check URL: ${error}`);
      handleError('Check Remote URL', error);
    }
  }, [remoteUrl, setConnectionStatus, setEstimatedSize]);

  const loadRemotePartitions = useCallback(async () => {
    if (!remoteUrl.trim()) return;

    cancelLoadingRef.current = false;
    setStatus('loading-partitions');
    setErrorMessage('');
    useLogStore.getState().addLog('Loading partitions from remote URL...', 'info');

    try {
      debugLog(`Loading remote partitions from: ${remoteUrl}`);
      const partitionList = await ListRemotePayloadPartitions(remoteUrl.trim());

      if (cancelLoadingRef.current) {
        useLogStore.getState().addLog('Loading partitions cancelled by user', 'info');
        setStatus('idle');
        return;
      }

      if (partitionList && partitionList.length > 0) {
        setPayloadPath(remoteUrl.trim());
        setPartitions(
          partitionList.map((p) => ({
            name: p.name,
            size: p.size,
            selected: true,
          })),
        );
        setStatus('ready');
        toast.success(`Found ${partitionList.length} partitions`);
        handleSuccess('Load Remote Partitions', `Found ${partitionList.length} partitions`);

        // Fire-and-forget metadata fetch — non-blocking, failure logged silently
        GetRemotePayloadMetadata(remoteUrl.trim())
          .then((metadata) => {
            setRemoteMetadata(metadata);
            debugLog('Remote payload metadata loaded');
          })
          .catch((err) => {
            debugLog(`Metadata fetch failed (non-blocking): ${err}`);
            useLogStore.getState().addLog(`Metadata fetch failed: ${err}`, 'warning');
          });
      } else {
        setErrorMessage('No partitions found in remote payload');
        setStatus('error');
        useLogStore.getState().addLog('No partitions found in remote payload', 'error');
      }
    } catch (error) {
      if (cancelLoadingRef.current) {
        useLogStore.getState().addLog('Loading partitions cancelled by user', 'info');
        return;
      }
      setErrorMessage(String(error));
      setStatus('error');
      handleError('Load Remote Partitions', error);
    } finally {
      cancelLoadingRef.current = false;
    }
  }, [remoteUrl, setPartitions, setPayloadPath, setStatus, setErrorMessage, setRemoteMetadata]);

  const handleCancelLoadPartitions = useCallback(() => {
    cancelLoadingRef.current = true;
    setStatus('idle');
    useLogStore.getState().addLog('Cancelling partition loading...', 'info');
  }, [setStatus]);

  const handlePayloadDrop = useCallback(
    async (paths: string[]) => {
      if (status === 'extracting' || status === 'loading-partitions') return;
      if (paths.length === 0) return;

      const filePath = paths[0];
      await CleanupPayloadCache();
      setPayloadPath(filePath);
      toast.success('Payload file selected');
      useLogStore.getState().addLog(`Selected payload: ${filePath}`, 'info');
      await loadPartitions(filePath);
    },
    [status, setPayloadPath, loadPartitions],
  );

  const handleSelectPayload = useCallback(async () => {
    try {
      debugLog('Selecting payload file');
      const path = await SelectPayloadFile();
      if (path) {
        await CleanupPayloadCache();
        setPayloadPath(path);
        toast.success('Payload file selected');
        useLogStore.getState().addLog(`Selected payload: ${path}`, 'info');
        await loadPartitions(path);
      }
    } catch (error) {
      handleError('Select Payload File', error);
    }
  }, [setPayloadPath, loadPartitions]);

  const handleSelectOutput = useCallback(async () => {
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
  }, [setOutputPath]);

  const handleOpenOutputFolder = useCallback(async () => {
    const effectiveOutputPath = outputDir || outputPath;
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
  }, [outputDir, outputPath]);

  const handleRefreshPartitions = useCallback(async () => {
    if (!payloadPath) return;
    if (
      mode === 'remote' ||
      payloadPath.startsWith('http://') ||
      payloadPath.startsWith('https://')
    ) {
      await loadRemotePartitions();
    } else {
      await loadPartitions(payloadPath);
    }
  }, [payloadPath, mode, loadRemotePartitions, loadPartitions]);

  const handleExtract = useCallback(async () => {
    if (!payloadPath) {
      toast.error('Please select a payload file');
      return;
    }

    const partitionsToExtract = partitions
      .filter((p) => p.selected && !completedPartitions.has(p.name))
      .map((p) => p.name);

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
      const targetOutputPath = outputDir || outputPath;
      const result = await ExtractPayload(
        payloadPath,
        targetOutputPath,
        partitionsToExtract,
        mode === 'remote' ? prefetch : undefined,
      );

      if (result.success) {
        const newFiles = result.extractedFiles || [];
        setExtractedFiles([...usePayloadDumperStore.getState().extractedFiles, ...newFiles]);
        setOutputDir(result.outputDir || '');
        setStatus('success');

        const newCompleted = newFiles.map((f) => f.replace('.img', ''));
        addCompletedPartitions(newCompleted);
        setExtractingPartitions(new Set());
        clearPartitionProgress();

        toast.success(`Extraction complete! ${newFiles.length} files extracted`, { id: toastId });
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
  }, [
    payloadPath,
    partitions,
    completedPartitions,
    outputDir,
    outputPath,
    mode,
    prefetch,
    setStatus,
    setErrorMessage,
    setExtractingPartitions,
    setExtractedFiles,
    setOutputDir,
    addCompletedPartitions,
    clearPartitionProgress,
  ]);

  const handleReset = useCallback(() => {
    reset();
    setMode('local');
    setRemoteUrl('');
    setPrefetch(false);
    setConnectionStatus('idle');
    setEstimatedSize(null);
    setRemoteMetadata(null);
    cancelLoadingRef.current = false;
    useLogStore.getState().addLog('Payload Dumper reset', 'info');
  }, [
    reset,
    setMode,
    setRemoteUrl,
    setPrefetch,
    setConnectionStatus,
    setEstimatedSize,
    setRemoteMetadata,
  ]);

  return {
    handleCheckUrl,
    loadRemotePartitions,
    handleCancelLoadPartitions,
    handlePayloadDrop,
    handleSelectPayload,
    handleSelectOutput,
    handleOpenOutputFolder,
    handleRefreshPartitions,
    handleExtract,
    handleReset,
  };
}
