import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Reboot,
  RunAdbHostCommand,
  RunFastbootHostCommand,
  SaveLog,
  WipeData,
} from '@/desktop/backend';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { debugLog } from '@/shared/utils/debug';
import { queryKeys } from '@/shared/utils/queries';

type RebootMode = 'system' | 'recovery' | 'bootloader' | 'fastboot' | null;
type DeviceConnectionMode = 'adb' | 'fastboot' | 'unknown';

export function useUtilityActions() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [sentAction, setSentAction] = useState<string | null>(null);
  const [showGetVarDialog, setShowGetVarDialog] = useState(false);
  const [getVarContent, setGetVarContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const allDevices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const queryClient = useQueryClient();
  const refetchDevices = () => queryClient.invalidateQueries({ queryKey: queryKeys.allDevices() });

  const { deviceMode, deviceSerial } = useMemo(() => {
    if (!allDevices.length) {
      return { deviceMode: 'unknown' as DeviceConnectionMode, deviceSerial: null };
    }
    const selectedDevice = allDevices.find((device) => device.serial === selectedSerial);
    if (!selectedDevice) {
      return { deviceMode: 'unknown' as DeviceConnectionMode, deviceSerial: null };
    }
    if (selectedDevice.status === 'device' || selectedDevice.status === 'recovery') {
      debugLog('Device mode: adb');
      return { deviceMode: 'adb' as DeviceConnectionMode, deviceSerial: selectedDevice.serial };
    }
    if (selectedDevice.status === 'fastboot' || selectedDevice.status === 'bootloader') {
      debugLog('Device mode: fastboot');
      return {
        deviceMode: 'fastboot' as DeviceConnectionMode,
        deviceSerial: selectedDevice.serial,
      };
    }
    return { deviceMode: 'unknown' as DeviceConnectionMode, deviceSerial: null };
  }, [allDevices, selectedSerial]);

  const handleReboot = async (mode: string, modeId: RebootMode, actionId: string) => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction(actionId);
    const toastId = toast.loading('Sending reboot command...');
    try {
      await Reboot(mode, deviceSerial);
      toast.success(`Reboot to ${modeId ?? 'system'} initiated`, { id: toastId });
      useLogStore.getState().addLog(`Rebooting to ${modeId ?? 'system'}...`, 'info');
      setSentAction(actionId);
      setTimeout(() => setSentAction(null), 2000);
    } catch (error) {
      debugLog(`Error rebooting to ${modeId}:`, error);
      toast.error('Failed to send reboot command', { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Reboot failed: ${error}`, 'error');
    }
    setLoadingAction(null);
    void refetchDevices();
  };

  const handleRestartServer = async () => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction('restart_server');
    const toastId = toast.loading('Restarting ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      await RunAdbHostCommand('start-server');
      toast.success('ADB Server Restarted', { id: toastId });
      useLogStore.getState().addLog('ADB Server restarted', 'success');
      setSentAction('restart_server');
      setTimeout(() => setSentAction(null), 2000);
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to restart server', { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to restart ADB server: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleKillServer = async () => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction('kill_server');
    const toastId = toast.loading('Killing ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      toast.success('ADB Server Killed', { id: toastId });
      useLogStore.getState().addLog('ADB Server killed', 'warning');
      setSentAction('kill_server');
      setTimeout(() => setSentAction(null), 2000);
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to kill server', { id: toastId, description: String(error) });
    }
    setLoadingAction(null);
  };

  const handleSetActiveSlot = async (slot: string) => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction(`set_active_${slot}`);
    const toastId = toast.loading(`Setting active slot to ${slot.toUpperCase()}...`);
    try {
      await RunFastbootHostCommand(`--set-active=${slot}`, deviceSerial);
      toast.success(`Active slot set to ${slot.toUpperCase()}`, { id: toastId });
      useLogStore.getState().addLog(`Set active slot to ${slot}`, 'success');
      setSentAction(`set_active_${slot}`);
      setTimeout(() => setSentAction(null), 2000);
    } catch (error) {
      toast.error(`Failed to set slot ${slot}`, { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to set active slot ${slot}: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleFastbootGetVars = async () => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction('get_vars');
    try {
      const output = await RunFastbootHostCommand('getvar all', deviceSerial);
      setGetVarContent(output);
      setShowGetVarDialog(true);
      useLogStore.getState().addLog('Fetched fastboot variables', 'success');
      setSentAction('get_vars');
      setTimeout(() => setSentAction(null), 2000);
    } catch (error) {
      toast.error('Failed to get variables', { description: String(error) });
      useLogStore.getState().addLog(`Failed to get fastboot vars: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleSaveGetVars = async () => {
    if (!getVarContent) {
      return;
    }
    try {
      const prefix = deviceSerial ? `${deviceSerial}-getvarall` : 'unknown-device-getvarall';
      const path = await SaveLog(getVarContent, prefix);
      toast.success(`Saved to ${path}`);
      useLogStore.getState().addLog(`Saved fastboot vars to ${path}`, 'success');
    } catch (error) {
      toast.error('Failed to save log', { description: String(error) });
    }
  };

  const handleCloseGetVarDialog = useCallback(() => setShowGetVarDialog(false), []);

  const handleWipeData = async () => {
    setLoadingAction('wipe_data');
    const toastId = toast.loading('Wiping User Data (this may take a while)...');
    try {
      await WipeData(deviceSerial);
      toast.success('Device Wiped Successfully', { id: toastId });
      useLogStore.getState().addLog('Device user data wiped (fastboot -w)', 'success');
    } catch (error) {
      toast.error('Wipe Failed', { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Wipe failed: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  return {
    deviceMode,
    deviceSerial,
    getVarContent,
    handleCloseGetVarDialog,
    handleFastbootGetVars,
    handleKillServer,
    handleReboot,
    handleRestartServer,
    handleSaveGetVars,
    handleSetActiveSlot,
    handleWipeData,
    isEditing,
    isGlobalLoading: !!loadingAction || !!sentAction,
    loadingAction,
    refetchDevices,
    sentAction,
    setIsEditing,
    setShowGetVarDialog,
    showGetVarDialog,
  };
}
