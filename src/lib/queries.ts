import { GetDevices, GetFastbootDevices, GetInstalledPackages } from './desktop/backend';
import type { backend } from './desktop/models';

type Device = backend.Device;

// ---------------------------------------------------------------------------
// Query key factory — single source of truth for all TanStack Query keys.
// ---------------------------------------------------------------------------
export const queryKeys = {
  devices: () => ['devices'] as const,
  fastbootDevices: () => ['fastbootDevices'] as const,
  allDevices: () => ['allDevices'] as const,
  packages: () => ['packages'] as const,
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
