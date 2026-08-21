import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { GetAppOverviewTelemetry } from '@/desktop/backend';
import type { backend } from '@/desktop/models';

export interface AppOverviewResult {
  error: Error | null;
  isLoading: boolean;
  refresh: () => void;
  telemetry: backend.AppOverviewTelemetry | null;
}

/**
 * Application composition for the selected device.
 *
 * Shares the `appOverviewTelemetry` query key (and its 30 s staleness) with
 * the App Manager overview tab, so visiting either view warms the other and
 * the adb round-trip runs once per device per window, not per view.
 */
export function useAppOverview(serial: string | null, enabled: boolean): AppOverviewResult {
  const query = useQuery({
    enabled: enabled && Boolean(serial),
    queryFn: () => GetAppOverviewTelemetry(serial),
    queryKey: ['appOverviewTelemetry', serial],
    retry: false,
    staleTime: 30_000,
  });

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    telemetry: query.data ?? null,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
    error: query.error,
    refresh,
  };
}
