import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  CleanupPayloadCache,
  OpenFolder,
  SelectOutputDirectory,
  SelectPayloadFile,
} from '@/desktop/backend';
import {
  runExtractPayload,
  runResetPayloadDumper,
} from '@/features/payload-dumper/hooks/payloadExtractionActions';
import {
  checkRemoteUrl,
  loadLocalPartitions,
  loadRemotePartitions as runLoadRemotePartitions,
} from '@/features/payload-dumper/hooks/payloadPartitionLoaders';
import type { ExtractionStatus } from '@/features/payload-dumper/model/payloadDumperStore';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import type { ConnectionStatus } from '@/shared/components/RemoteUrlPanel';
import { useLogStore } from '@/shared/stores/logStore';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';

interface UsePayloadActionsOptions {
  mode: 'local' | 'remote';
  prefetch: boolean;
  remoteUrl: string;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setEstimatedSize: (size: string | null) => void;
  setMode: (mode: 'local' | 'remote') => void;
  setPrefetch: (prefetch: boolean) => void;
  setRemoteUrl: (url: string) => void;
  status: ExtractionStatus;
}
interface PayloadActions {
  handleCancelLoadPartitions: () => void;
  handleCheckUrl: () => void;
  handleExtract: () => Promise<void>;
  handleOpenOutputFolder: () => Promise<void>;
  handlePayloadDrop: (paths: string[]) => Promise<void>;
  handleRefreshPartitions: () => Promise<void>;
  handleReset: () => void;
  handleSelectOutput: () => Promise<void>;
  handleSelectPayload: () => Promise<void>;
  loadRemotePartitions: () => Promise<void>;
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
  const payloadPath = usePayloadDumperStore((state) => state.payloadPath);
  const outputPath = usePayloadDumperStore((state) => state.outputPath);
  const partitions = usePayloadDumperStore((state) => state.partitions);
  const outputDir = usePayloadDumperStore((state) => state.outputDir);
  const completedPartitions = usePayloadDumperStore((state) => state.completedPartitions);
  const setPayloadPath = usePayloadDumperStore((state) => state.setPayloadPath);
  const setOutputPath = usePayloadDumperStore((state) => state.setOutputPath);
  const setPartitions = usePayloadDumperStore((state) => state.setPartitions);
  const setStatus = usePayloadDumperStore((state) => state.setStatus);
  const setExtractedFiles = usePayloadDumperStore((state) => state.setExtractedFiles);
  const setErrorMessage = usePayloadDumperStore((state) => state.setErrorMessage);
  const setOutputDir = usePayloadDumperStore((state) => state.setOutputDir);
  const setExtractingPartitions = usePayloadDumperStore((state) => state.setExtractingPartitions);
  const addCompletedPartitions = usePayloadDumperStore((state) => state.addCompletedPartitions);
  const clearPartitionProgress = usePayloadDumperStore((state) => state.clearPartitionProgress);
  const setRemoteMetadata = usePayloadDumperStore((state) => state.setRemoteMetadata);
  const setExtractionStats = usePayloadDumperStore((state) => state.setExtractionStats);
  const setCancelTokenId = usePayloadDumperStore((state) => state.setCancelTokenId);
  const reset = usePayloadDumperStore((state) => state.reset);
  const cancelLoadingRef = useRef(false);
  const checkUrlRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (checkUrlRef.current) {
        clearTimeout(checkUrlRef.current);
      }
    },
    [],
  );
  const loadPartitions = useCallback(
    async (path: string) => {
      await loadLocalPartitions(path, {
        setErrorMessage,
        setPartitions,
        setPayloadPath,
        setRemoteMetadata,
        setStatus,
      });
    },
    [setErrorMessage, setPartitions, setPayloadPath, setRemoteMetadata, setStatus],
  );
  const handleCheckUrl = useCallback(() => {
    if (!remoteUrl.trim()) {
      return;
    }
    if (checkUrlRef.current) {
      clearTimeout(checkUrlRef.current);
    }
    checkUrlRef.current = setTimeout(() => {
      debugLog(`Checking remote URL: ${remoteUrl}`);
      void checkRemoteUrl(remoteUrl, setConnectionStatus, setEstimatedSize);
    }, 500);
  }, [remoteUrl, setConnectionStatus, setEstimatedSize]);
  const loadRemotePartitions = useCallback(async () => {
    if (!remoteUrl.trim()) {
      return;
    }
    cancelLoadingRef.current = false;
    await runLoadRemotePartitions(
      remoteUrl,
      {
        setErrorMessage,
        setPartitions,
        setPayloadPath,
        setRemoteMetadata,
        setStatus,
      },
      () => cancelLoadingRef.current,
      () => {
        cancelLoadingRef.current = false;
      },
    );
  }, [remoteUrl, setPartitions, setPayloadPath, setStatus, setErrorMessage, setRemoteMetadata]);
  const handleCancelLoadPartitions = useCallback(() => {
    cancelLoadingRef.current = true;
    setStatus('idle');
    useLogStore.getState().addLog('Cancelling partition loading...', 'info');
  }, [setStatus]);
  const handlePayloadDrop = useCallback(
    async (paths: string[]) => {
      if (status === 'extracting' || status === 'loading-partitions') {
        return;
      }
      if (paths.length === 0) {
        return;
      }
      const filePath = paths[0];
      if (!filePath) {
        return;
      }
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
    if (!payloadPath) {
      return;
    }
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
    await runExtractPayload({
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
    });
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
    setExtractionStats,
    addCompletedPartitions,
    clearPartitionProgress,
    setCancelTokenId,
  ]);
  const handleReset = useCallback(() => {
    runResetPayloadDumper(
      reset,
      setMode,
      setRemoteUrl,
      setPrefetch,
      setConnectionStatus,
      setEstimatedSize,
      setRemoteMetadata,
      cancelLoadingRef,
    );
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
