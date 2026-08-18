export type FlasherTab = 'overview' | 'partition' | 'sideload' | 'wipe';

export type FlasherConnectionMode =
  | 'FASTBOOT'
  | 'FASTBOOTD'
  | 'SIDELOAD'
  | 'ADB'
  | 'RECOVERY'
  | 'OFFLINE'
  | 'UNAUTHORIZED'
  | 'NO_DEVICE';

export type BootloaderLockState = 'UNLOCKED' | 'LOCKED' | 'UNKNOWN';

export type ActiveSlot = 'a' | 'b' | 'single' | 'unknown';

export interface FastbootVitals {
  activeSlot: ActiveSlot;
  batteryLevel: number | null;
  batteryVoltage: string | null;
  bootloaderVersion: string | null;
  connectionMode: FlasherConnectionMode;
  isBatterySafe: boolean;
  isUserspace: boolean;
  lockState: BootloaderLockState;
  productBoard: string | null;
  rawSlot: string | null;
  secureBoot: boolean | null;
  serial: string | null;
  slotCount: number;
}

export type DiagnosticStatus = 'pass' | 'warn' | 'fail' | 'checking' | 'idle';

export interface DiagnosticItem {
  description: string;
  fixAction?: (() => void) | undefined;
  fixLabel?: string | undefined;
  id: string;
  label: string;
  status: DiagnosticStatus;
  tip?: string | undefined;
  value?: string | undefined;
}
export interface BatchPartitionItem {
  error?: string;
  fileName: string;
  filePath: string;
  id: string;
  partition: string;
  size?: number;
  status: 'queued' | 'flashing' | 'success' | 'failed';
}

export interface FlashAuditEntry {
  action: 'flash' | 'sideload' | 'wipe' | 'erase' | 'slot_switch';
  details?: string;
  id: string;
  status: 'success' | 'failed' | 'in-progress';
  target: string;
  timestamp: string;
}

export type PartitionCategory = 'boot' | 'recovery' | 'system' | 'radio' | 'all';
