import type { backend } from '@/desktop/models';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';

interface RestoreConfirmDialogProps {
  avd: backend.AvdSummary | null;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  restorePlan: backend.RestorePlan | null;
}

/**
 * Restoring overwrites the AVD's live ramdisk with the backed-up copy — it is
 * the exact inverse of rooting and it is not undoable, so it gets the same
 * confirmation treatment as a flash or a wipe.
 */
export function RestoreConfirmDialog({
  avd,
  onCancel,
  onConfirm,
  open,
  restorePlan,
}: RestoreConfirmDialogProps) {
  const entryCount = restorePlan?.entries.length ?? 0;

  return (
    <ConfirmDialog
      confirmLabel="Restore stock files"
      consequence={
        <span>
          Any root patch applied to this AVD is discarded. If you want root back you have to run the
          root workflow again from the start.
        </span>
      }
      description="The backed-up stock files are copied back over the emulator's current ones. This cannot be undone."
      details={[
        { label: 'Emulator', value: avd?.name ?? '—', mono: true },
        { label: 'Backup source', value: restorePlan?.source ?? '—', mono: true },
        {
          label: 'Files restored',
          value: `${entryCount} ${entryCount === 1 ? 'file' : 'files'}`,
        },
      ]}
      onConfirm={onConfirm}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
      open={open}
      title="Restore stock emulator files?"
    />
  );
}
