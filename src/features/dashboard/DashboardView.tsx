import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ConnectWirelessAdb,
  DisconnectWirelessAdb,
  EnableWirelessAdb,
  GetDeviceInfo,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { DeviceInfoCard } from '@/features/dashboard/ui/DeviceInfoCard';
import { WirelessAdbCard } from '@/features/dashboard/ui/WirelessAdbCard';
import { ConnectedDevicesCard } from '@/shared/components/ConnectedDevicesCard';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { debugLog } from '@/shared/utils/debug';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { queryKeys } from '@/shared/utils/queries';
import { type WirelessAdbValues, wirelessAdbSchema } from '@/shared/utils/schemas';

export function ViewDashboard({ activeView }: { activeView: string }) {
  const queriedDevices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const deviceInfo = useDeviceStore((state) => state.deviceInfo);
  const setDeviceInfo = useDeviceStore((state) => state.setDeviceInfo);
  const queryClient = useQueryClient();
  const [isRefreshingInfo, setIsRefreshingInfo] = useState(false);
  const [isEnablingTcpip, setIsEnablingTcpip] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const isEditing = useDeviceStore((state) => state.isEditingNickname);
  const setIsEditing = useDeviceStore((state) => state.setIsEditingNickname);
  const editingSerial = useDeviceStore((state) => state.editingDeviceSerial);
  const setEditingSerial = useDeviceStore((state) => state.setEditingDeviceSerial);
  const selectedDevice = queriedDevices.find((device) => device.serial === selectedSerial);
  const dashboardMode =
    selectedDevice && (selectedDevice.status === 'device' || selectedDevice.status === 'recovery')
      ? 'adb'
      : selectedDevice &&
          (selectedDevice.status === 'fastboot' || selectedDevice.status === 'bootloader')
        ? 'fastboot'
        : 'unknown';

  const wirelessForm = useForm<WirelessAdbValues>({
    resolver: zodResolver(wirelessAdbSchema),
    defaultValues: { ip: '', port: '5555' },
  });
  const watchedIp = useWatch({
    control: wirelessForm.control,
    name: 'ip',
    defaultValue: '',
  });

  const refreshDevices = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allDevices() });
  }, [queryClient]);

  const refreshInfo = useCallback(async () => {
    if (!selectedSerial) {
      setDeviceInfo(null);
      return;
    }

    setIsRefreshingInfo(true);
    try {
      debugLog('Refreshing device info');
      const result = await GetDeviceInfo(selectedSerial);
      setDeviceInfo(result);
      debugLog('Device info refreshed:', result);
    } catch (error) {
      handleError('Refresh Device Info', error);
      setDeviceInfo(null);
    } finally {
      setIsRefreshingInfo(false);
    }
  }, [selectedSerial, setDeviceInfo]);

  useEffect(() => {
    if (activeView === 'dashboard' && selectedSerial && !deviceInfo) {
      void refreshInfo();
    }
  }, [activeView, selectedSerial, deviceInfo, refreshInfo]);

  useEffect(() => {
    if (deviceInfo?.ipAddress && !deviceInfo.ipAddress.startsWith('N/A')) {
      wirelessForm.setValue('ip', deviceInfo.ipAddress, {
        shouldValidate: false,
      });
    }
  }, [deviceInfo?.ipAddress, wirelessForm]);

  const handleEnableTcpip = async () => {
    setIsEnablingTcpip(true);
    const toastId = toast.loading('Enabling wireless mode (port 5555)...', {
      description: 'Please wait... Device must be connected via USB.',
    });
    try {
      debugLog('Enabling wireless ADB on port 5555');
      const output = await EnableWirelessAdb('5555', selectedSerial);
      toast.success('Wireless mode enabled!', {
        id: toastId,
        description: output,
      });
      handleSuccess('Wireless ADB', `Wireless mode enabled: ${output}`);
      refreshDevices();
    } catch (error) {
      toast.error('Failed to enable wireless mode', { id: toastId });
      handleError('Enable Wireless ADB', error);
    }
    setIsEnablingTcpip(false);
  };

  const handleConnect = async (values: WirelessAdbValues) => {
    setIsConnecting(true);
    const toastId = toast.loading(`Connecting to ${values.ip}:${values.port}...`);
    try {
      debugLog(`Connecting to ${values.ip}:${values.port}`);
      const output = await ConnectWirelessAdb(values.ip, values.port);
      toast.success('Connection successful!', {
        id: toastId,
        description: output,
      });
      handleSuccess('Wireless ADB', `Connected to ${values.ip}:${values.port}: ${output}`);
      refreshDevices();
    } catch (error) {
      toast.error('Connection failed', { id: toastId });
      handleError('Wireless ADB Connect', error);
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    const values = wirelessForm.getValues();
    const parsed = wirelessAdbSchema.safeParse(values);
    if (!parsed.success) {
      toast.error('Invalid input', {
        description: parsed.error.issues[0]?.message ?? 'Unknown error',
      });
      return;
    }
    setIsDisconnecting(true);
    const toastId = toast.loading(`Disconnecting from ${values.ip}:${values.port}...`);
    try {
      debugLog(`Disconnecting from ${values.ip}:${values.port}`);
      const output = await DisconnectWirelessAdb(values.ip, values.port);
      toast.success('Disconnected', { id: toastId, description: output });
      handleSuccess('Wireless ADB', `Disconnected from ${values.ip}:${values.port}: ${output}`);
      refreshDevices();
    } catch (error) {
      toast.error('Disconnect failed', { id: toastId });
      handleError('Wireless ADB Disconnect', error);
    }
    setIsDisconnecting(false);
  };

  const openEditDialog = useCallback(
    (device: backend.Device) => {
      setEditingSerial(device.serial);
      setIsEditing(true);
    },
    [setEditingSerial, setIsEditing],
  );

  const handleNicknameSaved = useCallback(() => {
    refreshDevices();
  }, [refreshDevices]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Dashboard</h1>
      <ConnectedDevicesCard
        devices={queriedDevices.map((device) => ({
          serial: device.serial,
          status: device.status,
        }))}
        isLoading={false}
        onEdit={(serial) => {
          const device = queriedDevices.find((d) => d.serial === serial);
          if (device) {
            openEditDialog(device);
          }
        }}
        onRefresh={refreshDevices}
      />

      <WirelessAdbCard
        deviceMode={dashboardMode}
        handleConnect={handleConnect}
        handleDisconnect={handleDisconnect}
        handleEnableTcpip={handleEnableTcpip}
        isConnecting={isConnecting}
        isDisconnecting={isDisconnecting}
        isEnablingTcpip={isEnablingTcpip}
        selectedSerial={selectedSerial}
        watchedIp={watchedIp}
        wirelessForm={wirelessForm}
      />
      <DeviceInfoCard
        deviceInfo={deviceInfo}
        isRefreshingInfo={isRefreshingInfo}
        onRefresh={() => {
          void refreshInfo();
        }}
        selectedSerial={selectedSerial}
      />

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={(open) => {
          setIsEditing(open);
          if (!open) {
            setEditingSerial(null);
          }
        }}
        onSaved={handleNicknameSaved}
        serial={editingSerial}
      />
    </div>
  );
}
