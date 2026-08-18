import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FlashPartition,
  SelectImageFile,
  SelectZipFile,
  SideloadPackageStream,
  WipeData,
} from '@/desktop/backend';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/filePath';
import { partitionSchema } from '@/shared/utils/schemas';

/** Which destructive flasher action is waiting on an explicit confirmation. */
export type FlasherConfirm = 'flash' | 'sideload' | null;

/**
 * Session-scoped draft so switching views does not clear a half-filled form.
 *
 * Deliberately **not** persisted. These fields used to live in `localStorage`,
 * which meant an image path chosen days earlier was silently reloaded into a
 * partition-write button on the next launch. It dies with the process instead.
 */
const flasherDraft = { filePath: '', partition: '', sideloadFilePath: '' };

// Drop the keys the previous implementation wrote. Nothing reads them any more,
// but a months-old image path sitting in localStorage is the hazard itself.
for (const staleKey of ['flasher.partition', 'flasher.filePath', 'flasher.sideloadFilePath']) {
  localStorage.removeItem(staleKey);
}

export function useFlasherActions() {
  const [partition, setPartitionState] = useState(flasherDraft.partition);
  const [filePath, setFilePathState] = useState(flasherDraft.filePath);
  const [sideloadFilePath, setSideloadFilePathState] = useState(flasherDraft.sideloadFilePath);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<FlasherConfirm>(null);

  const setPartition = useCallback((value: string) => {
    flasherDraft.partition = value;
    setPartitionState(value);
  }, []);
  const setFilePath = useCallback((value: string) => {
    flasherDraft.filePath = value;
    setFilePathState(value);
  }, []);
  const setSideloadFilePath = useCallback((value: string) => {
    flasherDraft.sideloadFilePath = value;
    setSideloadFilePathState(value);
  }, []);

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
      await SideloadPackageStream(zipPath, serial);
      toast.success('Sideload Complete', {
        description: `${fileName} streamed and installed successfully.`,
        id: toastId,
      });
      useLogStore.getState().addLog(`Sideloaded ${fileName}: Success`, 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Recovery Sideload', error);
    } finally {
      setLoadingAction(null);
    }
  }, []);

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
  }, [setFilePath]);

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
  }, [setSideloadFilePath]);

  /**
   * Opens the flash confirmation. Nothing is written to the device here — and a
   * missing device is a hard stop, never a queued action that fires on cable
   * insertion.
   */
  const requestFlash = useCallback(() => {
    const parsed = partitionSchema.safeParse(partition);
    if (!parsed.success) {
      toast.error('Invalid partition name', {
        description: parsed.error.issues[0]?.message ?? 'Unknown error',
      });
      return;
    }
    if (!filePath) {
      toast.error('No image file selected.');
      return;
    }
    if (!selectedFastbootSerial) {
      toast.error('No fastboot device connected', {
        description: 'Boot the device into bootloader or fastboot mode, then try again.',
      });
      return;
    }
    setPendingConfirm('flash');
  }, [filePath, partition, selectedFastbootSerial]);

  const requestSideload = useCallback(() => {
    if (!sideloadFilePath) {
      toast.error('No update package selected.');
      return;
    }
    if (!selectedSideloadSerial) {
      toast.error('No sideload device connected', {
        description: 'Put the device into recovery and choose "Apply update from ADB".',
      });
      return;
    }
    setPendingConfirm('sideload');
  }, [selectedSideloadSerial, sideloadFilePath]);

  const confirmFlash = useCallback(() => {
    setPendingConfirm(null);
    if (!(selectedFastbootSerial && filePath && partition)) {
      return;
    }
    void executeFlash(partition, filePath, selectedFastbootSerial);
  }, [executeFlash, filePath, partition, selectedFastbootSerial]);

  const confirmSideload = useCallback(() => {
    setPendingConfirm(null);
    if (!(selectedSideloadSerial && sideloadFilePath)) {
      return;
    }
    void executeSideload(sideloadFilePath, selectedSideloadSerial);
  }, [executeSideload, selectedSideloadSerial, sideloadFilePath]);

  const handleConfirmOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPendingConfirm(null);
    }
  }, []);

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
    confirmFlash,
    confirmSideload,
    filePath,
    handleConfirmOpenChange,
    handleSelectImageFile,
    handleSelectSideloadFile,
    handleWipe,
    isGlobalLoading,
    loadingAction,
    partition,
    pendingConfirm,
    requestFlash,
    requestSideload,
    selectedFastbootSerial,
    selectedSideloadSerial,
    setFilePath,
    setPartition,
    setSideloadFilePath,
    sideloadFilePath,
  };
}
