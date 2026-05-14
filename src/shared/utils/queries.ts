import type { QueryClient } from '@tanstack/react-query';
import { GetDevices, GetFastbootDevices, GetInstalledPackages, ListAvds } from '@/desktop/backend';
import type { backend } from '@/desktop/models';

type Device = backend.Device;
type AvdSummary = backend.AvdSummary;

// ---------------------------------------------------------------------------
// Query key factory — single source of truth for all TanStack Query keys.
// ---------------------------------------------------------------------------
export const queryKeys = {
  devices: () => ['devices'] as const,
  fastbootDevices: () => ['fastbootDevices'] as const,
  allDevices: () => ['allDevices'] as const,
  packages: () => ['packages'] as const,
  avds: () => ['avds'] as const,
  deviceInfo: (serial: string) => ['deviceInfo', serial] as const,
  emulator: {
    list: ['emulator', 'list'] as const,
    restorePlan: (avdName: string) => ['emulator', 'restorePlan', avdName] as const,
  },
  marketplace: {
    search: (query: string, filters: object) => ['marketplace', 'search', query, filters] as const,
    trending: ['marketplace', 'trending'] as const,
    appDetail: (appId: string) => ['marketplace', 'appDetail', appId] as const,
  },
  debloat: {
    packages: (serial: string) => ['debloat', 'packages', serial] as const,
    lists: ['debloat', 'lists'] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// staleTime constants — in milliseconds
// ---------------------------------------------------------------------------
export const STALE_TIME = {
  DEVICES: 30 * 1000,
  FASTBOOT_DEVICES: 30 * 1000,
  ALL_DEVICES: 30 * 1000,
  PACKAGES: 30 * 1000,
  EMULATOR_LIST: 30 * 1000,
  MARKETPLACE_SEARCH: 5 * 60 * 1000,
  MARKETPLACE_TRENDING: 10 * 60 * 1000,
  MARKETPLACE_DETAIL: 5 * 60 * 1000,
  DEBOLOAT_LISTS: 60 * 60 * 1000,
  DEBOLOAT_PACKAGES: 30 * 1000,
  DEVICE_INFO: 30 * 1000,
} as const;

// ---------------------------------------------------------------------------
// Fetch functions — wrapped to keep views free of direct backend imports
// for query usage. Views that need mutations still import backend directly.
// ---------------------------------------------------------------------------

export const fetchDevices = (): Promise<Device[]> => GetDevices();

export const fetchFastbootDevices = (): Promise<Device[]> => GetFastbootDevices();

/** Fetches ADB + fastboot devices, merges and deduplicates by serial. */
export const fetchAllDevices = async (): Promise<Device[]> => {
  const [adbDevices, fastbootDevices] = await Promise.all([GetDevices(), GetFastbootDevices()]);

  const merged: Device[] = [];

  if (Array.isArray(fastbootDevices)) {
    merged.push(
      ...fastbootDevices
        .filter((d) => !!d && typeof d.serial === 'string')
        .map((d) => ({ serial: d.serial, status: d.status ?? 'fastboot' })),
    );
  }

  if (Array.isArray(adbDevices)) {
    merged.push(
      ...adbDevices
        .filter((d) => !!d && typeof d.serial === 'string')
        .filter((d) => !merged.some((m) => m.serial === d.serial))
        .map((d) => ({ serial: d.serial, status: d.status })),
    );
  }

  return merged;
};

export const fetchPackages = () => GetInstalledPackages();

export const fetchAvds = (): Promise<AvdSummary[]> => ListAvds();

// ---------------------------------------------------------------------------
// Invalidation helpers — call after mutations to keep cache fresh.
// ---------------------------------------------------------------------------
export const invalidateDevices = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.allDevices() });
};

export const invalidatePackages = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.packages() });
};

export const invalidateAvds = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.avds() });
};
