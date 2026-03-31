/**
 * Shared device status configuration.
 *
 * Single source of truth for badge labels, shadcn Badge variant, and
 * badge classes for every ADB/fastboot connection status string.
 *
 * Import `getStatusConfig` wherever a device status badge is rendered to
 * eliminate the duplicated STATUS_CONFIG that previously lived in both
 * DeviceSwitcher.tsx and ConnectedDevicesCard.tsx.
 */

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  badgeClass: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  device: {
    label: 'adb',
    variant: 'default',
    badgeClass: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
  },
  fastboot: {
    label: 'fastboot',
    variant: 'outline',
    badgeClass: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
  },
  bootloader: {
    label: 'bootloader',
    variant: 'outline',
    badgeClass: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
  },
  recovery: {
    label: 'recovery',
    variant: 'outline',
    badgeClass: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  },
  sideload: {
    label: 'sideload',
    variant: 'outline',
    badgeClass: 'bg-violet-400/15 text-violet-400 border-violet-400/30',
  },
  unauthorized: {
    label: 'unauthorized',
    variant: 'destructive',
    badgeClass: 'bg-red-400/15 text-red-400 border-red-400/30',
  },
  offline: {
    label: 'offline',
    variant: 'destructive',
    badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: '',
  variant: 'outline',
  badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

/**
 * Returns the badge label, variant, and class for `status`.
 * Falls back to an outline zinc badge with the raw status string as label.
 */
export function getStatusConfig(status: string): StatusConfig {
  const key = status.toLowerCase();
  return STATUS_CONFIG[key] ?? { ...DEFAULT_STATUS_CONFIG, label: key };
}
