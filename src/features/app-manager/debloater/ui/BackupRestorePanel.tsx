import {
  Archive,
  Camera,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreateDebloatBackup, ListDebloatBackups, RestoreDebloatBackup } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { finishOperation, startOperation } from '@/shared/stores/operationStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { handleError } from '@/shared/utils/errorHandler';

const backupTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatBackupTimestamp(createdAt: string): string {
  const seconds = Number.parseInt(createdAt, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Unknown date';
  }
  return backupTimestampFormatter.format(new Date(seconds * 1000));
}

export function BackupRestorePanel() {
  const backups = useDebloatStore((s) => s.backups);
  const packages = useDebloatStore((s) => s.packages);
  const setBackups = useDebloatStore((s) => s.setBackups);
  const applyResults = useDebloatStore((s) => s.applyResults);
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);

  const [pending, setPending] = useState<backend.BackupSummary | null>(null);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  async function handleCreateBackup() {
    if (!selectedSerial || packages.length === 0) {
      toast.error('Cannot create backup: No active device packages found');
      return;
    }

    setIsCreatingBackup(true);
    const toastId = toast.loading('Creating device package snapshot…');
    try {
      const snapshots: backend.PackageSnapshot[] = packages.map((p) => ({
        name: p.name,
        state: p.state,
      }));
      await CreateDebloatBackup(snapshots, selectedSerial);
      const updatedBackups = await ListDebloatBackups(selectedSerial);
      setBackups(updatedBackups);
      useLogStore
        .getState()
        .addLog(`Debloat snapshot created (${snapshots.length} packages)`, 'success');
      toast.success(`Snapshot saved (${snapshots.length} package states recorded)`, {
        id: toastId,
      });
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Create Snapshot Backup', error);
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function refreshBackups() {
    if (!selectedSerial) {
      return;
    }
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
        toast.success(`Restored ${restored} package${restored === 1 ? '' : 's'} successfully`, {
          id: toastId,
        });
        useLogStore
          .getState()
          .addLog(`Debloat restore: ${restored} package states restored`, 'success');
      } else {
        toast.warning(`Restored ${restored} packages, ${failed} failed`, { id: toastId });
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
    <section
      aria-label="Device state snapshots and backups"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-none"
    >
      {/* ── Panel Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-b pb-2.5">
        <div className="flex items-center gap-2">
          <Archive aria-hidden="true" className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground text-label">
            Device State Snapshots & Backups
          </h3>
          <Badge className="font-mono text-caption" variant="neutral">
            {backups.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="h-8 cursor-pointer gap-1.5 px-3 text-caption"
            disabled={isCreatingBackup || packages.length === 0 || !selectedSerial}
            onClick={() => void handleCreateBackup()}
            size="sm"
            type="button"
            variant="outline"
          >
            {isCreatingBackup ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Camera aria-hidden="true" className="size-3.5" />
            )}
            Take State Snapshot
          </Button>

          <Button
            aria-label="Refresh backup list"
            className="size-8 text-muted-foreground hover:text-foreground"
            disabled={isRefreshing || !selectedSerial}
            onClick={() => void refreshBackups()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? 'size-3.5 animate-spin' : 'size-3.5'}
            />
          </Button>
        </div>
      </div>

      {/* ── Snapshot List / Empty State ── */}
      {backups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2.5 rounded-md border border-border/60 border-dashed bg-surface-raised/30 p-6 text-center">
          <ShieldCheck aria-hidden="true" className="size-8 text-muted-foreground/60" />
          <div className="flex max-w-md flex-col gap-1">
            <span className="font-medium text-body text-foreground">
              {selectedSerial ? 'No snapshots recorded yet' : 'Connect a device to manage backups'}
            </span>
            <span className="text-caption text-muted-foreground">
              {selectedSerial
                ? 'Create a snapshot before debloating to record all package states (Enabled / Disabled / Uninstalled). You can restore any snapshot with 1 click.'
                : 'Select a device from the top switcher to inspect its state backups.'}
            </span>
          </div>

          {selectedSerial && packages.length > 0 ? (
            <Button
              className="mt-1 cursor-pointer gap-1.5 text-caption"
              disabled={isCreatingBackup}
              onClick={() => void handleCreateBackup()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isCreatingBackup ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <Plus aria-hidden="true" className="size-3.5" />
              )}
              Create First State Snapshot
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
          {backups.map((backup) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-surface-raised/40 p-2.5 transition-colors hover:border-border hover:bg-accent/50"
              key={backup.fileName}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface">
                  <HardDrive aria-hidden="true" className="size-3.5 text-muted-foreground" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-body text-foreground">
                    {formatBackupTimestamp(backup.createdAt)}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {backup.fileName}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <Badge className="font-mono text-caption" variant="neutral">
                  {backup.packageCount} packages
                </Badge>
                <Button
                  className="h-7 cursor-pointer gap-1 px-2.5 text-caption"
                  disabled={restoringFile !== null || !selectedSerial}
                  onClick={() => setPending(backup)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {restoringFile === backup.fileName ? (
                    <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-3" />
                  )}
                  Restore State
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        confirmLabel="Restore Snapshot"
        consequence={
          <p className="leading-relaxed">
            Every package recorded in this snapshot will be re-applied to its recorded state on{' '}
            <span className="font-mono font-semibold text-foreground">
              {selectedSerial ?? 'the device'}
            </span>
            . Any debloating performed afterwards will be reversed.
          </p>
        }
        description="Replays the exact recorded state of each package onto the device."
        destructive={false}
        details={
          pending
            ? [
                { label: 'Snapshot Date', value: formatBackupTimestamp(pending.createdAt) },
                { label: 'Packages Recorded', value: `${pending.packageCount} packages` },
                { label: 'File Name', mono: true, value: pending.fileName },
                { label: 'Target Device', mono: true, value: selectedSerial ?? 'unknown' },
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
        title="Restore device state snapshot?"
      />
    </section>
  );
}
