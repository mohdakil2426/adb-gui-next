import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FlashPartition,
  SelectImageFile,
  SelectZipFile,
  SideloadPackage,
  WipeData,
} from '@/desktop/backend';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/formatting';
import { partitionSchema } from '@/shared/utils/schemas';

interface QueuedAction {
  filePath: string;
  partition?: string;
  type: 'flash' | 'sideload';
}

export function useFlasherActions() {
  const [partition, setPartition] = useState(() => localStorage.getItem('flasher.partition') ?? '');
  const [filePath, setFilePath] = useState(() => localStorage.getItem('flasher.filePath') ?? '');
  const [sideloadFilePath, setSideloadFilePath] = useState(
    () => localStorage.getItem('flasher.sideloadFilePath') ?? '',
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [queuedAction, setQueuedAction] = useState<QueuedAction | null>(null);

  useEffect(() => localStorage.setItem('flasher.partition', partition), [partition]);
  useEffect(() => localStorage.setItem('flasher.filePath', filePath), [filePath]);
  useEffect(
    () => localStorage.setItem('flasher.sideloadFilePath', sideloadFilePath),
    [sideloadFilePath],
  );

  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const selectedDevice = useMemo(
    () => devices.find((device) => device.serial === selectedSerial) ?? null,
    [devices, selectedSerial],
  );
  const selectedFastbootSerial = useMemo(
    () =>
      selectedDevice &&
      (selectedDevice.status === 'fastboot' || selectedDevice.status === 'bootloader')
        ? selectedDevice.serial
        : null,
    [selectedDevice],
  );
  const selectedSideloadSerial = useMemo(
    () =>
      selectedDevice &&
      (selectedDevice.status === 'sideload' || selectedDevice.status === 'recovery')
        ? selectedDevice.serial
        : null,
    [selectedDevice],
  );

  const isGlobalLoading = !!loadingAction;

  const executeFlash = useCallback(
    async (partitionName: string, imgPath: string, serial: string | null) => {
      setLoadingAction('flash');
      const toastId = toast.loading(`Flashing ${partitionName} partition...`);
      try {
        await FlashPartition(partitionName, imgPath, serial);
        toast.success('Flash Complete', {
          description: `${partitionName} flashed successfully.`,
          id: toastId,
        });
        useLogStore.getState().addLog(`Flashed partition ${partitionName}: Success`, 'success');
      } catch (error) {
        toast.dismiss(toastId);
        handleError('Flash Partition', error);
      } finally {
        setLoadingAction(null);
      }
    },
    [],
  );

  const executeSideload = useCallback(async (zipPath: string, serial: string | null) => {
    const fileName = getFileName(zipPath);
    setLoadingAction('sideload');
    const toastId = toast.loading(`Sideloading ${fileName}...`);
    try {
      const output = await SideloadPackage(zipPath, serial);
      const description = output || `${fileName} sideloaded successfully.`;
      toast.success('Sideload Complete', { description, id: toastId });
      useLogStore.getState().addLog(`Sideloaded ${fileName}: ${description}`, 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Recovery Sideload', error);
    } finally {
      setLoadingAction(null);
    }
  }, []);

  useEffect(() => {
    if (!queuedAction || isGlobalLoading) {
      return;
    }
    const isReady =
      queuedAction.type === 'flash'
        ? Boolean(selectedFastbootSerial)
        : Boolean(selectedSideloadSerial);
    if (!isReady) {
      return;
    }
    const action = queuedAction;
    setQueuedAction(null);
    if (action.type === 'flash') {
      if (action.partition && selectedFastbootSerial) {
        void executeFlash(action.partition, action.filePath, selectedFastbootSerial);
      }
      return;
    }
    void executeSideload(action.filePath, selectedSideloadSerial);
  }, [
    executeFlash,
    executeSideload,
    isGlobalLoading,
    queuedAction,
    selectedFastbootSerial,
    selectedSideloadSerial,
  ]);

  const handleSelectImageFile = useCallback(async () => {
    try {
      debugLog('Selecting image file');
      const selected = await SelectImageFile();
      if (selected) {
        setFilePath(selected);
        toast.info(`File selected: ${getFileName(selected)}`);
      }
    } catch (error) {
      handleError('Select Image File', error);
    }
  }, []);

  const handleSelectSideloadFile = useCallback(async () => {
    try {
      debugLog('Selecting ZIP file for sideload');
      const selected = await SelectZipFile();
      if (selected) {
        setSideloadFilePath(selected);
        toast.info(`ZIP selected: ${getFileName(selected)}`);
      }
    } catch (error) {
      handleError('Select ZIP File', error);
    }
  }, []);

  const handleFlash = useCallback(() => {
    const parsed = partitionSchema.safeParse(partition);
    if (!parsed.success) {
      toast.error('Invalid partition name', {
        description: parsed.error.issues[0]?.message ?? 'Unknown error',
      });
      return;
    }
    if (!filePath) {
      toast.error('No file selected.');
      return;
    }
    if (selectedFastbootSerial) {
      void executeFlash(partition, filePath, selectedFastbootSerial);
      return;
    }
    setQueuedAction({ type: 'flash', partition, filePath });
    toast.info('Waiting for fastboot device...', {
      description: 'Action will execute automatically when a fastboot device connects.',
    });
  }, [executeFlash, filePath, partition, selectedFastbootSerial]);

  const handleSideload = useCallback(() => {
    if (!sideloadFilePath) {
      toast.error('No update package selected.');
      return;
    }
    if (selectedSideloadSerial) {
      void executeSideload(sideloadFilePath, selectedSideloadSerial);
      return;
    }
    setQueuedAction({ type: 'sideload', filePath: sideloadFilePath });
    toast.info('Waiting for sideload device...', {
      description: 'Action will execute automatically when a sideload/recovery device connects.',
    });
  }, [executeSideload, selectedSideloadSerial, sideloadFilePath]);

  const handleWipe = useCallback(async () => {
    setLoadingAction('wipe');
    const toastId = toast.loading('Wiping data... Device will factory reset.');
    try {
      await WipeData(selectedFastbootSerial);
      toast.success('Wipe Complete', { description: 'Device data has been erased.', id: toastId });
      useLogStore.getState().addLog('Device data wiped (Factory Reset): Success', 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Wipe Data', error);
    } finally {
      setLoadingAction(null);
    }
  }, [selectedFastbootSerial]);

  return {
    filePath,
    handleFlash,
    handleSelectImageFile,
    handleSelectSideloadFile,
    handleSideload,
    handleWipe,
    isGlobalLoading,
    loadingAction,
    partition,
    queuedAction,
    selectedFastbootSerial,
    selectedSideloadSerial,
    setFilePath,
    setPartition,
    setQueuedAction,
    setSideloadFilePath,
    sideloadFilePath,
  };
}
