import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import type { LucideIcon } from 'lucide-react';
import {
  CircuitBoard,
  Copy,
  MonitorSmartphone,
  Power,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Zap,
} from 'lucide-react';
import { VIEWS } from '@/app/shell/viewConfig';
import { Reboot } from '@/desktop/backend';
import {
  AVAILABLE,
  blocked,
  type CommandAction,
  type CommandAvailability,
  type CommandContext,
  deviceLabel,
} from '@/shared/commands/types';
import { trackOperation } from '@/shared/stores/operationStore';
import { getStatusConfig } from '@/shared/utils/deviceStatus';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';

/**
 * Gate shared by every device-scoped action.
 *
 * Blocked actions are never hidden — they render disabled with the reason, so
 * the palette explains what is missing instead of silently omitting the row.
 */
export function deviceAvailability(ctx: CommandContext): CommandAvailability {
  if (!ctx.selectedDevice) {
    return blocked(ctx.devices.length === 0 ? 'No device connected' : 'No device selected');
  }
  const status = ctx.selectedDevice.status.toLowerCase();
  if (status === 'unauthorized') {
    return blocked('Unauthorized — accept the USB debugging prompt');
  }
  if (status === 'offline') {
    return blocked('Device offline — reconnect the cable');
  }
  return AVAILABLE;
}

interface RebootTarget {
  icon: LucideIcon;
  id: string;
  keywords: string[];
  label: string;
  /** Mode passed to the `reboot` command; empty string means "system". */
  mode: string;
}

const REBOOT_TARGETS: RebootTarget[] = [
  {
    icon: Power,
    id: 'device.reboot.system',
    keywords: ['restart', 'reboot', 'system', 'android'],
    label: 'Reboot to System',
    mode: '',
  },
  {
    icon: Zap,
    id: 'device.reboot.bootloader',
    keywords: ['restart', 'reboot', 'bootloader', 'fastboot', 'flash'],
    label: 'Reboot to Bootloader',
    mode: 'bootloader',
  },
  {
    icon: RotateCcw,
    id: 'device.reboot.recovery',
    keywords: ['restart', 'reboot', 'recovery', 'twrp', 'sideload'],
    label: 'Reboot to Recovery',
    mode: 'recovery',
  },
  {
    icon: CircuitBoard,
    id: 'device.reboot.fastbootd',
    keywords: ['restart', 'reboot', 'fastbootd', 'userspace', 'dynamic'],
    label: 'Reboot to Fastbootd',
    mode: 'fastboot',
  },
];

function runReboot(ctx: CommandContext, target: RebootTarget): void {
  const serial = ctx.selectedSerial;
  if (!serial) {
    return;
  }
  const name = deviceLabel(ctx.nicknames, serial);
  const destination = target.label.replace('Reboot to ', '');
  void trackOperation(
    { label: `Rebooting ${name} to ${destination}`, view: VIEWS.UTILS },
    async () => {
      try {
        await Reboot(target.mode, serial);
        handleSuccess('Reboot', `${name} is rebooting to ${destination}`);
      } catch (error) {
        handleError('Reboot', error);
      }
    },
  );
}

function copySerial(ctx: CommandContext): void {
  const serial = ctx.selectedSerial;
  if (!serial) {
    return;
  }
  void (async () => {
    try {
      await writeText(serial);
      handleSuccess('Clipboard', `Serial ${serial} copied`);
    } catch (error) {
      handleError('Clipboard', error);
    }
  })();
}

/** Reboot targets, refresh and copy-serial — the Actions group's device half. */
export function deviceActionCommands(): CommandAction[] {
  const reboots: CommandAction[] = REBOOT_TARGETS.map((target) => ({
    available: deviceAvailability,
    group: 'actions',
    icon: target.icon,
    id: target.id,
    keywords: target.keywords,
    label: target.label,
    run: (ctx) => {
      runReboot(ctx, target);
    },
  }));

  return [
    ...reboots,
    {
      available: () => AVAILABLE,
      group: 'actions',
      icon: RefreshCw,
      id: 'device.refresh',
      keywords: ['scan', 'devices', 'reload', 'poll', 'detect'],
      label: 'Refresh Devices',
      run: (ctx) => {
        ctx.shell.refreshDevices();
      },
    },
    {
      available: (ctx) => (ctx.selectedSerial ? AVAILABLE : blocked('No device selected')),
      group: 'actions',
      icon: Copy,
      id: 'device.copySerial',
      keywords: ['serial', 'clipboard', 'copy', 'id'],
      label: 'Copy Device Serial',
      run: copySerial,
    },
  ];
}

/**
 * One entry per connected device. With nothing attached the group keeps a single
 * disabled row explaining how to get one, rather than rendering empty.
 */
export function deviceSelectionCommands(ctx: CommandContext): CommandAction[] {
  if (ctx.devices.length === 0) {
    return [
      {
        available: () => blocked('Connect over USB, then run Refresh Devices'),
        group: 'devices',
        icon: MonitorSmartphone,
        id: 'device.none',
        keywords: ['device', 'usb', 'connect', 'empty'],
        label: 'No devices detected',
        run: () => undefined,
      },
    ];
  }

  return ctx.devices.map((device) => {
    const name = deviceLabel(ctx.nicknames, device.serial);
    const isSelected = device.serial === ctx.selectedSerial;
    return {
      available: () => AVAILABLE,
      group: 'devices',
      hint: isSelected ? 'active' : getStatusConfig(device.status).label,
      icon: Smartphone,
      id: `device.select.${device.serial}`,
      keywords: [device.serial, device.status, 'select', 'switch', 'target'],
      label: name,
      run: (target) => {
        target.shell.selectDevice(device.serial);
      },
    } satisfies CommandAction;
  });
}
