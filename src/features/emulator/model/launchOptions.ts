import type { backend } from '@/desktop/models';

export type LaunchOptionKey = keyof backend.EmulatorLaunchOptions;

export const DEFAULT_LAUNCH_OPTIONS: backend.EmulatorLaunchOptions = {
  coldBoot: false,
  noBootAnim: false,
  noSnapshotLoad: false,
  noSnapshotSave: false,
  wipeData: false,
  writableSystem: false,
};

/**
 * Cold boot means "ignore the saved snapshot going in, and do not write one
 * coming out" — all three flags together. Rooting depends on it: a snapshot
 * restored on the next launch silently reverts the patched ramdisk.
 */
export const COLD_BOOT_LAUNCH_OPTIONS: backend.EmulatorLaunchOptions = {
  ...DEFAULT_LAUNCH_OPTIONS,
  coldBoot: true,
  noSnapshotLoad: true,
  noSnapshotSave: true,
};

export interface LaunchOptionMeta {
  /** Acknowledgement text shown before this flag may be used. */
  acknowledgement?: string;
  description: string;
  /** Needs an explicit acknowledgement before launching. */
  destructive: boolean;
  key: LaunchOptionKey;
  label: string;
}

/**
 * Every launch flag the emulator accepts, in the order they are presented.
 * This list is the only place a flag is named, so the Launch tab, the toolbar
 * summary and the acknowledgement gate can never disagree about what is on.
 */
export const LAUNCH_OPTIONS: readonly LaunchOptionMeta[] = [
  {
    description: 'Boot from scratch instead of restoring the saved snapshot.',
    destructive: false,
    key: 'coldBoot',
    label: 'Cold boot',
  },
  {
    description: 'Ignore an existing Quick Boot snapshot on start.',
    destructive: false,
    key: 'noSnapshotLoad',
    label: 'Skip snapshot load',
  },
  {
    description: 'Do not write a snapshot when the emulator shuts down.',
    destructive: false,
    key: 'noSnapshotSave',
    label: 'Skip snapshot save',
  },
  {
    description: 'Skip the Android boot animation to start faster.',
    destructive: false,
    key: 'noBootAnim',
    label: 'Disable boot animation',
  },
  {
    acknowledgement: 'I understand writable-system leaves this AVD in a modified state.',
    description: 'Mount /system read-write. Required by some root workflows.',
    destructive: true,
    key: 'writableSystem',
    label: 'Writable system',
  },
  {
    acknowledgement: 'I understand wiping data erases everything on this emulator profile.',
    description: 'Erase the user data partition on start. Cannot be undone.',
    destructive: true,
    key: 'wipeData',
    label: 'Wipe user data',
  },
] as const;

/** Enabled flags, as short labels — the toolbar's "what will happen" summary. */
export function summarizeLaunchOptions(options: backend.EmulatorLaunchOptions): string[] {
  return LAUNCH_OPTIONS.filter((option) => options[option.key]).map((option) => option.label);
}

/** Which destructive launch flags the user has explicitly ticked. */
export type LaunchAcknowledgements = Partial<Record<LaunchOptionKey, boolean>>;

/** Destructive flags that are on and therefore need an explicit tick. */
export function destructiveLaunchOptions(
  options: backend.EmulatorLaunchOptions,
): LaunchOptionMeta[] {
  return LAUNCH_OPTIONS.filter((option) => option.destructive && options[option.key]);
}

/**
 * Destructive flags that are on and *not* yet acknowledged. Both launch
 * controls consult this, so neither can start a wipe the user never confirmed.
 */
export function unacknowledgedLaunchOptions(
  options: backend.EmulatorLaunchOptions,
  acknowledgements: LaunchAcknowledgements,
): LaunchOptionMeta[] {
  return destructiveLaunchOptions(options).filter((option) => !acknowledgements[option.key]);
}

/** True when the configured options are exactly a cold boot and nothing else. */
export function isColdBootPreset(options: backend.EmulatorLaunchOptions): boolean {
  return LAUNCH_OPTIONS.every(
    (option) => options[option.key] === COLD_BOOT_LAUNCH_OPTIONS[option.key],
  );
}
