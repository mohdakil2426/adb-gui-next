import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { GetDeviceTelemetry } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { toLegacyDeviceInfo } from '@/features/dashboard/model/legacyDeviceInfo';
import { useMemoryHistoryStore } from '@/features/dashboard/model/memoryHistoryStore';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { handleError } from '@/shared/utils/errorHandler';

/** A snapshot older than this is refetched when the Dashboard mounts. */
const TELEMETRY_STALE_MS = 10_000;
/**
 * Foreground refresh cadence. This is **not** the device poll: it reads the
 * selected device in one batched `adb shell` round-trip, only while the
 * Dashboard is mounted (other views unmount it) and only while the window has
 * focus (TanStack's default). It is what makes the memory sparkline live.
 */
const TELEMETRY_POLL_MS = 15_000;

export const telemetryQueryKey = (serial: string) => ['deviceTelemetry', serial] as const;

export interface DeviceTelemetryResult {
  error: Error | null;
  isFetching: boolean;
  isLoading: boolean;
  refresh: () => void;
  telemetry: backend.DeviceTelemetry | null;
  updatedAt: number;
}

/**
 * Auto-loading device telemetry. There is no "click refresh to load" dead end:
 * selecting a device is the intent, so the read starts immediately.
 */
export function useDeviceTelemetry(serial: string | null, enabled: boolean): DeviceTelemetryResult {
  const recordSample = useMemoryHistoryStore((state) => state.record);
  const setDeviceInfo = useDeviceStore((state) => state.setDeviceInfo);

  const query = useQuery({
    queryKey: telemetryQueryKey(serial ?? ''),
    enabled: enabled && Boolean(serial),
    queryFn: async () => {
      try {
        return await GetDeviceTelemetry(serial);
      } catch (error) {
        handleError('Device Telemetry', error);
        throw error;
      }
    },
    staleTime: TELEMETRY_STALE_MS,
    // Stop polling a device that is failing rather than raising a toast every
    // interval; the inline error state carries the retry.
    refetchInterval: (telemetryQuery) => (telemetryQuery.state.error ? false : TELEMETRY_POLL_MS),
    retry: false,
  });

  const { data, dataUpdatedAt, refetch } = query;

  useEffect(() => {
    if (!(serial && data)) {
      return;
    }
    // Keeps the shell's sidebar device card fed from the same round-trip.
    setDeviceInfo(toLegacyDeviceInfo(data, serial));
    if (data.memory.totalBytes === 0) {
      return;
    }
    recordSample(serial, {
      at: dataUpdatedAt,
      usedBytes: data.memory.usedBytes,
      totalBytes: data.memory.totalBytes,
    });
  }, [serial, data, dataUpdatedAt, recordSample, setDeviceInfo]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    telemetry: data ?? null,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
    isFetching: query.isFetching,
    error: query.error,
    updatedAt: dataUpdatedAt,
    refresh,
  };
}
