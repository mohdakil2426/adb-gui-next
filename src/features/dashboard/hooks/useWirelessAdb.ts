import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ConnectWirelessAdb, DisconnectWirelessAdb, EnableWirelessAdb } from '@/desktop/backend';
import { useWirelessAdbStore } from '@/shared/stores/wirelessAdbStore';
import { debugLog } from '@/shared/utils/debug';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { invalidateDevices } from '@/shared/utils/queries';
import { type WirelessAdbValues, wirelessAdbSchema } from '@/shared/utils/schemas';

const DEFAULT_PORT = '5555';

export interface WirelessAdbController {
  connect: (values: WirelessAdbValues) => Promise<void>;
  disconnect: () => Promise<void>;
  enableTcpip: () => Promise<void>;
  form: UseFormReturn<WirelessAdbValues>;
  ip: string;
  isBusy: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isEnablingTcpip: boolean;
}

/**
 * Wireless ADB pairing: enable `tcpip` over USB, then connect over the network.
 * The IP is pre-filled from telemetry so the common path is one click.
 */
export function useWirelessAdb(
  selectedSerial: string | null,
  deviceIpAddress: string | null,
): WirelessAdbController {
  const persistedIp = useWirelessAdbStore((state) => state.persistedIp);
  const persistedPort = useWirelessAdbStore((state) => state.persistedPort);
  const setPersistedIp = useWirelessAdbStore((state) => state.setPersistedIp);
  const setPersistedPort = useWirelessAdbStore((state) => state.setPersistedPort);
  const queryClient = useQueryClient();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEnablingTcpip, setIsEnablingTcpip] = useState(false);

  const form = useForm<WirelessAdbValues>({
    resolver: zodResolver(wirelessAdbSchema),
    defaultValues: { ip: persistedIp || '', port: persistedPort || DEFAULT_PORT },
  });

  const ip = useWatch({ control: form.control, name: 'ip', defaultValue: '' });
  const port = useWatch({
    control: form.control,
    name: 'port',
    defaultValue: persistedPort || DEFAULT_PORT,
  });

  const { setValue } = form;
  useEffect(() => {
    if (deviceIpAddress) {
      setValue('ip', deviceIpAddress, { shouldValidate: false });
      setPersistedIp(deviceIpAddress);
    }
  }, [deviceIpAddress, setValue, setPersistedIp]);

  useEffect(() => {
    if (ip) {
      setPersistedIp(ip);
    }
  }, [ip, setPersistedIp]);

  useEffect(() => {
    if (port) {
      setPersistedPort(port);
    }
  }, [port, setPersistedPort]);

  const enableTcpip = useCallback(async () => {
    setIsEnablingTcpip(true);
    const toastId = toast.loading(`Enabling wireless mode on port ${DEFAULT_PORT}…`, {
      description: 'The device must be connected over USB.',
    });
    try {
      debugLog('Enabling wireless ADB');
      const output = await EnableWirelessAdb(DEFAULT_PORT, selectedSerial);
      toast.success('Wireless mode enabled', { id: toastId, description: output });
      handleSuccess('Wireless ADB', `Wireless mode enabled: ${output}`);
      invalidateDevices(queryClient);
    } catch (error) {
      toast.error('Failed to enable wireless mode', { id: toastId });
      handleError('Enable Wireless ADB', error);
    }
    setIsEnablingTcpip(false);
  }, [queryClient, selectedSerial]);

  const connect = useCallback(
    async (values: WirelessAdbValues) => {
      setIsConnecting(true);
      const toastId = toast.loading(`Connecting to ${values.ip}:${values.port}…`);
      try {
        debugLog(`Connecting to ${values.ip}:${values.port}`);
        const output = await ConnectWirelessAdb(values.ip, values.port);
        toast.success('Connected', { id: toastId, description: output });
        handleSuccess('Wireless ADB', `Connected to ${values.ip}:${values.port}: ${output}`);
        invalidateDevices(queryClient);
      } catch (error) {
        toast.error('Connection failed', { id: toastId });
        handleError('Wireless ADB Connect', error);
      }
      setIsConnecting(false);
    },
    [queryClient],
  );

  const disconnect = useCallback(async () => {
    const values = form.getValues();
    const parsed = wirelessAdbSchema.safeParse(values);
    if (!parsed.success) {
      toast.error('Invalid address', {
        description: parsed.error.issues[0]?.message ?? 'Check the IP address and port.',
      });
      return;
    }
    setIsDisconnecting(true);
    const toastId = toast.loading(`Disconnecting from ${values.ip}:${values.port}…`);
    try {
      debugLog(`Disconnecting from ${values.ip}:${values.port}`);
      const output = await DisconnectWirelessAdb(values.ip, values.port);
      toast.success('Disconnected', { id: toastId, description: output });
      handleSuccess('Wireless ADB', `Disconnected from ${values.ip}:${values.port}: ${output}`);
      invalidateDevices(queryClient);
    } catch (error) {
      toast.error('Disconnect failed', { id: toastId });
      handleError('Wireless ADB Disconnect', error);
    }
    setIsDisconnecting(false);
  }, [form, queryClient]);

  return {
    form,
    ip,
    isConnecting,
    isDisconnecting,
    isEnablingTcpip,
    isBusy: isConnecting || isDisconnecting || isEnablingTcpip,
    connect,
    disconnect,
    enableTcpip,
  };
}
