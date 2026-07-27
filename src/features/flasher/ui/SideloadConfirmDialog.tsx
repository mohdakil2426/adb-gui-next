import { type ConfirmDetail, ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { getFileName } from '@/shared/utils/filePath';

interface SideloadConfirmDialogProps {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  packagePath: string;
  serial: string | null;
}

/**
 * `adb sideload` hands a whole update package to the device's recovery, which
 * then writes whichever partitions the package tells it to. It gets the same
 * confirmation weight as a partition flash.
 */
export function SideloadConfirmDialog({
  onConfirm,
  onOpenChange,
  open,
  packagePath,
  serial,
}: SideloadConfirmDialogProps) {
  const packageName = getFileName(packagePath);

  const details: ConfirmDetail[] = [
    { label: 'Target', mono: true, value: serial ?? 'unknown' },
    { label: 'Mode', value: 'recovery / sideload' },
    { label: 'Package', mono: true, value: packageName },
    { label: 'Path', mono: true, value: packagePath },
  ];

  return (
    <ConfirmDialog
      confirmLabel="Sideload Package"
      consequence={
        <p>
          A package built for another device or another Android version can leave this device unable
          to boot. Do not disconnect the cable while sideload is running.
        </p>
      }
      description="The device's recovery decides which partitions this package writes. It cannot be undone."
      details={details}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="Sideload update package?"
    />
  );
}
