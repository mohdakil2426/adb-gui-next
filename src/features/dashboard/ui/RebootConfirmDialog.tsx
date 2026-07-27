import { TriangleAlert } from 'lucide-react';
import { REBOOT_LABEL, type RebootTarget } from '@/features/dashboard/hooks/useRebootActions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';

interface RebootConfirmDialogProps {
  deviceLabel: string;
  onCancel: () => void;
  onConfirm: (target: RebootTarget) => void;
  target: RebootTarget | null;
}

const CONSEQUENCE: Record<RebootTarget, string> = {
  system: 'The device restarts normally.',
  bootloader:
    'The device leaves Android and enters the bootloader. ADB is unavailable there — only fastboot commands work until you reboot back.',
  recovery:
    'The device leaves Android and enters recovery. Most tools in this app are unavailable until it boots back to system.',
  fastboot:
    'The device enters fastbootd (userspace fastboot). ADB is unavailable there until you reboot back to system.',
};

/** Leaving Android is a mode change the host cannot undo — so it is confirmed. */
export function RebootConfirmDialog({
  deviceLabel,
  onCancel,
  onConfirm,
  target,
}: RebootConfirmDialogProps) {
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={target !== null}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
            Reboot to {target ? REBOOT_LABEL[target] : ''}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-mono text-foreground text-mono">{deviceLabel}</span>
            <span className="mt-2 block">{target ? CONSEQUENCE[target] : ''}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (target) {
                onConfirm(target);
              }
            }}
          >
            Reboot to {target ? REBOOT_LABEL[target] : ''}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
