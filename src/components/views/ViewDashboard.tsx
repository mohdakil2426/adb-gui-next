import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  GetDeviceInfo,
  EnableWirelessAdb,
  ConnectWirelessAdb,
  DisconnectWirelessAdb,
} from '../../lib/desktop/backend';
import type { backend } from '../../lib/desktop/models';
import { toast } from 'sonner';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import { wirelessAdbSchema, type WirelessAdbValues } from '@/lib/schemas';
import { queryKeys, fetchDevices } from '@/lib/queries';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Smartphone,
  Battery,
  Info,
  Server,
  RefreshCw,
  Loader2,
  Hash,
  Wifi,
  ShieldCheck,
  Cpu,
  Database,
  Code,
  Building,
  Usb,
  PlugZap,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeviceStore } from '@/lib/deviceStore';
import { ConnectedDevicesCard } from '@/components/ConnectedDevicesCard';
import { EditNicknameDialog } from '@/components/EditNicknameDialog';
import { CopyButton } from '@/components/CopyButton';

type Device = backend.Device;

export function ViewDashboard({ activeView }: { activeView: string }) {
  const { deviceInfo, setDeviceInfo } = useDeviceStore();
  const [isRefreshingInfo, setIsRefreshingInfo] = useState(false);
  const [isEnablingTcpip, setIsEnablingTcpip] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [, forceNicknameRefresh] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);

  const wirelessForm = useForm<WirelessAdbValues>({
    resolver: zodResolver(wirelessAdbSchema),
    defaultValues: { ip: '', port: '5555' },
  });
  const watchedIp = wirelessForm.watch('ip');

  const {
    data: queriedDevices = [],
    isFetching: isRefreshingDevices,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: queryKeys.devices(),
    queryFn: fetchDevices,
    refetchInterval: activeView === 'dashboard' ? 3000 : false,
    enabled: activeView === 'dashboard',
  });

  const refreshDevices = useCallback(() => {
    void refetchDevices();
  }, [refetchDevices]);

  const refreshInfo = useCallback(async () => {
    if (queriedDevices.length === 0) {
      setDeviceInfo(null);
      return;
    }

    setIsRefreshingInfo(true);
    try {
      debugLog('Refreshing device info');
      const result = await GetDeviceInfo();
      setDeviceInfo(result);
      debugLog('Device info refreshed:', result);
    } catch (error) {
      handleError('Refresh Device Info', error);
      setDeviceInfo(null);
    } finally {
      setIsRefreshingInfo(false);
    }
  }, [queriedDevices.length, setDeviceInfo]);

  useEffect(() => {
    if (activeView === 'dashboard') {
      refreshDevices();
    }
  }, [activeView, refreshDevices]);

  useEffect(() => {
    if (deviceInfo?.ipAddress && !deviceInfo.ipAddress.startsWith('N/A')) {
      wirelessForm.setValue('ip', deviceInfo.ipAddress, { shouldValidate: false });
    }
  }, [deviceInfo?.ipAddress, wirelessForm]);

  const handleEnableTcpip = async () => {
    setIsEnablingTcpip(true);
    const toastId = toast.loading('Enabling wireless mode (port 5555)...', {
      description: 'Please wait... Device must be connected via USB.',
    });
    try {
      debugLog('Enabling wireless ADB on port 5555');
      const output = await EnableWirelessAdb('5555');
      toast.success('Wireless mode enabled!', { id: toastId, description: output });
      handleSuccess('Wireless ADB', `Wireless mode enabled: ${output}`);
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
      toast.success('Connection successful!', { id: toastId, description: output });
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
      toast.error('Invalid input', { description: parsed.error.issues[0].message });
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

  const openEditDialog = (device: Device) => {
    setCurrentDevice(device);
    setIsEditing(true);
  };

  const handleNicknameSaved = () => {
    forceNicknameRefresh((version) => version + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <ConnectedDevicesCard
        devices={queriedDevices.map((device) => ({
          serial: device.serial,
          status: device.status,
        }))}
        isLoading={isRefreshingDevices}
        onRefresh={refreshDevices}
        onEdit={(serial) => {
          const device = queriedDevices.find((d) => d.serial === serial);
          if (device) openEditDialog(device);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Wireless ADB Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="flex flex-col gap-3">
            <p className="font-medium">Step 1: Enable (via USB)</p>
            <p className="text-sm text-muted-foreground">
              Make sure the device is connected with a USB cable, then click this button..
            </p>
            <Button
              className="w-full h-auto whitespace-normal"
              onClick={handleEnableTcpip}
              disabled={isEnablingTcpip || queriedDevices.length === 0 || isConnecting}
            >
              {isEnablingTcpip ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Usb className="mr-2 h-4 w-4 shrink-0" />
              )}
              Enable Wireless Mode (tcpip)
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-medium">Step 2: Connect (via WiFi)</p>
            <p className="text-sm text-muted-foreground">
              Enter the Device IP (usually automatically filled in) and Port.
            </p>
            <form
              onSubmit={wirelessForm.handleSubmit(handleConnect)}
              className="flex flex-col gap-3"
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Device IP Address"
                    {...wirelessForm.register('ip')}
                    disabled={isConnecting || isDisconnecting}
                  />
                  {wirelessForm.formState.errors.ip && (
                    <p className="text-xs text-destructive mt-1">
                      {wirelessForm.formState.errors.ip.message}
                    </p>
                  )}
                </div>
                <div className="w-24">
                  <Input
                    placeholder="Port"
                    {...wirelessForm.register('port')}
                    disabled={isConnecting || isDisconnecting}
                  />
                  {wirelessForm.formState.errors.port && (
                    <p className="text-xs text-destructive mt-1">
                      {wirelessForm.formState.errors.port.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isConnecting || !watchedIp || isDisconnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Wifi className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  Connect
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting || !watchedIp || isConnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <PlugZap className="mr-2 h-4 w-4 shrink-0" />
                  )}
                  Disconnect
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Device Info
          </CardTitle>
          <Button
            variant="default"
            onClick={refreshInfo}
            disabled={isRefreshingInfo || queriedDevices.length === 0}
          >
            {isRefreshingInfo ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Info
          </Button>
        </CardHeader>
        <CardContent>
          {queriedDevices.length === 0 ? (
            <p className="text-muted-foreground">Connect a device to see info.</p>
          ) : !deviceInfo ? (
            <p className="text-muted-foreground">Click "Refresh Info" to load data.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoItem
                icon={<Building className="h-4 w-4" />}
                label="Brand"
                value={deviceInfo.brand}
              />
              <InfoItem
                icon={<Tag className="h-4 w-4" />}
                label="Device Name"
                value={deviceInfo.deviceName}
              />
              <InfoItem
                icon={<Code className="h-4 w-4" />}
                label="Codename"
                value={deviceInfo.codename}
              />
              <InfoItem
                icon={<Smartphone className="h-4 w-4" />}
                label="Model"
                value={deviceInfo.model}
              />
              <InfoItem
                icon={<Hash className="h-4 w-4" />}
                label="Serial Number"
                value={deviceInfo.serial}
                copyable
              />
              <InfoItem
                icon={<Server className="h-4 w-4" />}
                label="Build Number"
                value={deviceInfo.buildNumber}
              />
              <InfoItem
                icon={<Info className="h-4 w-4" />}
                label="Android Version"
                value={deviceInfo.androidVersion}
              />
              <InfoItem
                icon={<Battery className="h-4 w-4" />}
                label="Battery"
                value={deviceInfo.batteryLevel}
              />
              <InfoItem
                icon={<Cpu className="h-4 w-4" />}
                label="Total RAM"
                value={deviceInfo.ramTotal}
              />
              <InfoItem
                icon={<Database className="h-4 w-4" />}
                label="Internal Storage"
                value={deviceInfo.storageInfo}
              />
              <InfoItem
                icon={<Wifi className="h-4 w-4" />}
                label="IP Address"
                value={deviceInfo.ipAddress}
                copyable
              />
              <InfoItem
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Root Status"
                value={deviceInfo.rootStatus}
                valueClassName={
                  deviceInfo.rootStatus === 'Yes'
                    ? 'text-success font-bold'
                    : 'text-muted-foreground'
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        serial={currentDevice?.serial || null}
        onSaved={handleNicknameSaved}
      />
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  valueClassName,
  copyable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center p-3 bg-muted rounded-lg overflow-hidden">
      <div className="mr-3 text-primary shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground truncate" title={label}>
          {label}
        </div>
        <div className={cn('font-semibold truncate', valueClassName)} title={value}>
          {value ? value : 'N/A'}
        </div>
      </div>
      {copyable && value && <CopyButton value={value} label={label} />}
    </div>
  );
}
