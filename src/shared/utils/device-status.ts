/**
 * Shared device status configuration.
 *
 * Single source of truth for badge labels, shadcn Badge variant, and
 * badge classes for every ADB/fastboot connection status string.
 *
 * Import `getStatusConfig` wherever a device status badge is rendered to
 * eliminate the duplicated STATUS_CONFIG that previously lived in both
 * DeviceSwitcher.tsx.
 */

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface StatusConfig {
  badgeClass: string;
  label: string;
  variant: BadgeVariant;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  bootloader: {
    badgeClass:
      "bg-[var(--device-status-fastboot-bg)] text-[var(--device-status-fastboot-fg)] border-[var(--device-status-fastboot-border)]",
    label: "bootloader",
    variant: "outline",
  },
  device: {
    badgeClass: "bg-success-light text-success border-success/35",
    label: "adb",
    variant: "default",
  },
  fastboot: {
    badgeClass:
      "bg-[var(--device-status-fastboot-bg)] text-[var(--device-status-fastboot-fg)] border-[var(--device-status-fastboot-border)]",
    label: "fastboot",
    variant: "outline",
  },
  offline: {
    badgeClass:
      "bg-[var(--device-status-neutral-bg)] text-[var(--device-status-neutral-fg)] border-[var(--device-status-neutral-border)]",
    label: "offline",
    variant: "destructive",
  },
  recovery: {
    badgeClass:
      "bg-[var(--device-status-recovery-bg)] text-[var(--device-status-recovery-fg)] border-[var(--device-status-recovery-border)]",
    label: "recovery",
    variant: "outline",
  },
  sideload: {
    badgeClass:
      "bg-[var(--device-status-recovery-bg)] text-[var(--device-status-recovery-fg)] border-[var(--device-status-recovery-border)]",
    label: "sideload",
    variant: "outline",
  },
  unauthorized: {
    badgeClass:
      "bg-[var(--device-status-unauthorized-bg)] text-[var(--device-status-unauthorized-fg)] border-[var(--device-status-unauthorized-border)]",
    label: "unauthorized",
    variant: "destructive",
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  badgeClass:
    "bg-[var(--device-status-neutral-bg)] text-[var(--device-status-neutral-fg)] border-[var(--device-status-neutral-border)]",
  label: "",
  variant: "outline",
};

/**
 * Returns the badge label, variant, and class for `status`.
 * Falls back to an outline zinc badge with the raw status string as label.
 */
export const getStatusConfig = (status: string): StatusConfig => {
  const key = status.toLowerCase();
  return STATUS_CONFIG[key] ?? { ...DEFAULT_STATUS_CONFIG, label: key };
};
