import type { QueryClient } from '@tanstack/react-query';
import { GetAllDevices, GetInstalledPackages, ListAvds } from '@/desktop/backend';
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
  scrcpy: {
    status: ['scrcpy', 'status'] as const,
    activeSessions: ['scrcpy', 'activeSessions'] as const,
    presets: ['scrcpy', 'presets'] as const,
  },
  hostSetup: {
    status: ['hostSetup', 'status'] as const,
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
  /** Global default applied in `App.tsx`. */
  DEFAULT: 30 * 1000,
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

/** Fetches all connected ADB & Fastboot devices from unified backend registry. */
export const fetchAllDevices = async (): Promise<Device[]> => {
  const devices = await GetAllDevices();
  if (!Array.isArray(devices)) {
    return [];
  }
  return devices.map((d) => ({
    serial: d.serial,
    status: d.status || 'device',
    connectionType: d.connectionType ?? 'adb',
  }));
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
