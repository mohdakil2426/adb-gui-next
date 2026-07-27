import type { LucideIcon } from 'lucide-react';
import type { ViewType } from '@/app/shell/viewConfig';
import type { backend } from '@/desktop/models';

/** Palette sections, rendered in this order. */
export type CommandGroupId = 'actions' | 'navigate' | 'devices';

export interface CommandAvailability {
  enabled: boolean;
  /** Why the action cannot run. Rendered in place of the shortcut when disabled. */
  reason: string | null;
}

export const AVAILABLE: CommandAvailability = { enabled: true, reason: null };

/**
 * Marks an action unavailable **with a reason**. Unavailable actions stay
 * visible and say why they are blocked — a smart gate, not a dead end.
 */
export function blocked(reason: string): CommandAvailability {
  return { enabled: false, reason };
}

/** Shell capabilities an action may reach for. All are stable references. */
export interface CommandShell {
  closePalette: () => void;
  launchDeviceManager: () => void;
  launchTerminal: () => void;
  refreshDevices: () => void;
  selectDevice: (serial: string) => void;
  setActiveView: (view: ViewType) => void;
  setTheme: (theme: string) => void;
  showShortcuts: () => void;
  togglePanel: (tab: 'logs' | 'shell') => void;
  toggleSidebar: () => void;
}

/** Everything an action needs to decide availability and to run. */
export interface CommandContext {
  activeView: ViewType;
  devices: backend.Device[];
  nicknames: Record<string, string>;
  selectedDevice: backend.Device | null;
  selectedSerial: string | null;
  shell: CommandShell;
  theme: string;
}

export interface CommandAction {
  available: (ctx: CommandContext) => CommandAvailability;
  group: CommandGroupId;
  /** Right-aligned context: device name, `current`, connection status. */
  hint?: string;
  icon: LucideIcon;
  id: string;
  /** Extra search terms beyond the label. */
  keywords: string[];
  label: string;
  run: (ctx: CommandContext) => void;
  /** Keys rendered as `<Kbd>`, e.g. `['Ctrl', 'B']`. */
  shortcut?: string[];
}

/** Display name for a serial: nickname when set, otherwise the raw serial. */
export function deviceLabel(nicknames: Record<string, string>, serial: string): string {
  return nicknames[serial] ?? serial;
}
