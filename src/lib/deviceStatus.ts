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
    badgeClass:
      'bg-[var(--device-status-adb-bg)] text-[var(--device-status-adb-fg)] border-[var(--device-status-adb-border)]',
  },
  fastboot: {
    label: 'fastboot',
    variant: 'outline',
    badgeClass:
      'bg-[var(--device-status-fastboot-bg)] text-[var(--device-status-fastboot-fg)] border-[var(--device-status-fastboot-border)]',
  },
  bootloader: {
    label: 'bootloader',
    variant: 'outline',
    badgeClass:
      'bg-[var(--device-status-fastboot-bg)] text-[var(--device-status-fastboot-fg)] border-[var(--device-status-fastboot-border)]',
  },
  recovery: {
    label: 'recovery',
    variant: 'outline',
    badgeClass:
      'bg-[var(--device-status-recovery-bg)] text-[var(--device-status-recovery-fg)] border-[var(--device-status-recovery-border)]',
  },
  sideload: {
    label: 'sideload',
    variant: 'outline',
    badgeClass:
      'bg-[var(--device-status-recovery-bg)] text-[var(--device-status-recovery-fg)] border-[var(--device-status-recovery-border)]',
  },
  unauthorized: {
    label: 'unauthorized',
    variant: 'destructive',
    badgeClass:
      'bg-[var(--device-status-unauthorized-bg)] text-[var(--device-status-unauthorized-fg)] border-[var(--device-status-unauthorized-border)]',
  },
  offline: {
    label: 'offline',
    variant: 'destructive',
    badgeClass:
      'bg-[var(--device-status-neutral-bg)] text-[var(--device-status-neutral-fg)] border-[var(--device-status-neutral-border)]',
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: '',
  variant: 'outline',
  badgeClass:
    'bg-[var(--device-status-neutral-bg)] text-[var(--device-status-neutral-fg)] border-[var(--device-status-neutral-border)]',
};

/**
 * Returns the badge label, variant, and class for `status`.
 * Falls back to an outline zinc badge with the raw status string as label.
 */
export function getStatusConfig(status: string): StatusConfig {
  const key = status.toLowerCase();
  return STATUS_CONFIG[key] ?? { ...DEFAULT_STATUS_CONFIG, label: key };
}
