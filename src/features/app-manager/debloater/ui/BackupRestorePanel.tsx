import { Archive, History, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ListDebloatBackups, RestoreDebloatBackup } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { finishOperation, startOperation } from '@/shared/stores/operationStore';
import { Button } from '@/shared/ui/button';
import { handleError } from '@/shared/utils/errorHandler';

const backupTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** `BackupSummary.createdAt` is a Unix-seconds string produced by the Rust side. */
function formatBackupTimestamp(createdAt: string): string {
  const seconds = Number.parseInt(createdAt, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Unknown date';
  }
  return backupTimestampFormatter.format(new Date(seconds * 1000));
}

/**
 * The missing other half of debloating.
 *
 * The app has always created backups and told the user they could restore
 * later; `restore_debloat_backup` simply had no caller. This is that caller.
 */
export function BackupRestorePanel() {
  const backups = useDebloatStore((s) => s.backups);
  const setBackups = useDebloatStore((s) => s.setBackups);
  const applyResults = useDebloatStore((s) => s.applyResults);
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);

  const [pending, setPending] = useState<backend.BackupSummary | null>(null);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshBackups() {
    setIsRefreshing(true);
    try {
      setBackups(await ListDebloatBackups(selectedSerial));
    } catch (error) {
      handleError('List Backups', error);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function restoreBackup(backup: backend.BackupSummary) {
    setPending(null);
    setRestoringFile(backup.fileName);
    const operationId = startOperation({
      detail: `${backup.packageCount} packages`,
      label: `Restoring backup from ${formatBackupTimestamp(backup.createdAt)}`,
      view: 'apps',
    });
    const toastId = toast.loading(`Restoring ${backup.packageCount} package states…`);
    try {
      const results = await RestoreDebloatBackup(backup.fileName, selectedSerial);
      applyResults(results);
      const failed = results.filter((result) => !result.success).length;
      const restored = results.length - failed;
      if (failed === 0) {
        toast.success(`Restored ${restored} package${restored === 1 ? '' : 's'}`, { id: toastId });
        useLogStore.getState().addLog(`Debloat restore: ${restored} packages`, 'success');
      } else {
        toast.warning(`Restored ${restored}, ${failed} failed`, { id: toastId });
        useLogStore.getState().addLog(`Debloat restore: ${failed} failures`, 'error');
      }
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Restore Backup', error);
    } finally {
      finishOperation(operationId);
      setRestoringFile(null);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3">
      <header className="flex items-center gap-2">
        <Archive aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <h3 className="flex-1 font-medium text-label">Backups ({backups.length})</h3>
        <Button
          aria-label="Refresh backup list"
          disabled={isRefreshing || !selectedSerial}
          onClick={() => void refreshBackups()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <RefreshCw aria-hidden="true" className={isRefreshing ? 'animate-spin' : undefined} />
        </Button>
      </header>

      {backups.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {selectedSerial
            ? 'No backups yet. Create one from Review Selection before you apply changes — it records every package state so this device can be put back.'
            : 'Select a device to see its backups.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {backups.map((backup) => (
            <li
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
              key={backup.fileName}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">
                  {formatBackupTimestamp(backup.createdAt)}
                </span>
                <span className="truncate font-mono text-mono-sm text-muted-foreground">
                  {backup.fileName}
                </span>
              </div>
              <span className="numeric shrink-0 text-caption text-muted-foreground">
                {backup.packageCount} packages
              </span>
              <Button
                className="shrink-0"
                disabled={restoringFile !== null || !selectedSerial}
                onClick={() => {
                  setPending(backup);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {restoringFile === backup.fileName ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <History aria-hidden="true" />
                )}
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        confirmLabel="Restore Backup"
        consequence={
          <p>
            Every package recorded in this backup is put back to the state it had then. Debloating
            you did afterwards is undone, and packages missing from the backup are left alone.
          </p>
        }
        description="Replays the recorded state of each package onto the selected device."
        destructive={false}
        details={
          pending
            ? [
                { label: 'Taken', value: formatBackupTimestamp(pending.createdAt) },
                { label: 'Packages', value: String(pending.packageCount) },
                { label: 'File', mono: true, value: pending.fileName },
                { label: 'Target', mono: true, value: selectedSerial ?? 'unknown' },
              ]
            : []
        }
        onConfirm={() => {
          if (pending) {
            void restoreBackup(pending);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        open={pending !== null}
        title="Restore this backup?"
      />
    </section>
  );
}
