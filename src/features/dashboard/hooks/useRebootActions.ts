import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Reboot } from '@/desktop/backend';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { invalidateDevices } from '@/shared/utils/queries';

/** `''` is `adb reboot` with no argument — a normal boot. */
export type RebootTarget = 'system' | 'bootloader' | 'recovery' | 'fastboot';

const REBOOT_ARGUMENT: Record<RebootTarget, string> = {
  system: '',
  bootloader: 'bootloader',
  recovery: 'recovery',
  fastboot: 'fastboot',
};

export const REBOOT_LABEL: Record<RebootTarget, string> = {
  system: 'System',
  bootloader: 'Bootloader',
  recovery: 'Recovery',
  fastboot: 'Fastbootd',
};

/**
 * Rebooting out of Android is a mode change the user cannot undo from the host,
 * so anything except a plain reboot asks first.
 */
export const REBOOT_NEEDS_CONFIRMATION: Record<RebootTarget, boolean> = {
  system: false,
  bootloader: true,
  recovery: true,
  fastboot: true,
};

export interface RebootController {
  confirm: (target: RebootTarget) => void;
  dismiss: () => void;
  pendingConfirmation: RebootTarget | null;
  request: (target: RebootTarget) => void;
  runningTarget: RebootTarget | null;
}

export function useRebootActions(serial: string | null): RebootController {
  const queryClient = useQueryClient();
  const [runningTarget, setRunningTarget] = useState<RebootTarget | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<RebootTarget | null>(null);

  const run = useCallback(
    async (target: RebootTarget) => {
      setRunningTarget(target);
      const label = REBOOT_LABEL[target];
      const toastId = toast.loading(`Rebooting to ${label}…`);
      try {
        await Reboot(REBOOT_ARGUMENT[target], serial);
        toast.success(`Reboot to ${label} sent`, { id: toastId });
        handleSuccess('Reboot', `Reboot to ${label} sent`);
        invalidateDevices(queryClient);
      } catch (error) {
        toast.error(`Reboot to ${label} failed`, { id: toastId });
        handleError('Reboot', error);
      }
      setRunningTarget(null);
    },
    [queryClient, serial],
  );

  const request = useCallback(
    (target: RebootTarget) => {
      if (REBOOT_NEEDS_CONFIRMATION[target]) {
        setPendingConfirmation(target);
        return;
      }
      void run(target);
    },
    [run],
  );

  const confirm = useCallback(
    (target: RebootTarget) => {
      setPendingConfirmation(null);
      void run(target);
    },
    [run],
  );

  const dismiss = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  return { pendingConfirmation, runningTarget, request, confirm, dismiss };
}
