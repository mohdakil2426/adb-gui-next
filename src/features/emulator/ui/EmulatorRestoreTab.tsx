import { CircleCheck, ExternalLink, Info, RotateCcw } from 'lucide-react';
import { OpenFolder } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { LoadingButton } from '@/shared/components/LoadingButton';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { handleError } from '@/shared/utils/errorHandler';

interface EmulatorRestoreTabProps {
  avd: backend.AvdSummary | null;
  isLoadingPlan: boolean;
  isRestoring: boolean;
  /** Opens the confirmation. Restore itself is never one click. */
  onRequestRestore: () => void;
  restorePlan: backend.RestorePlan | null;
}

async function openBackupFolder(backupPath: string) {
  try {
    const separator = Math.max(backupPath.lastIndexOf('\\'), backupPath.lastIndexOf('/'));
    await OpenFolder(separator > 0 ? backupPath.slice(0, separator) : backupPath);
  } catch (error) {
    handleError('Open Backup Folder', error);
  }
}

export function EmulatorRestoreTab({
  avd,
  isLoadingPlan,
  isRestoring,
  restorePlan,
  onRequestRestore,
}: EmulatorRestoreTabProps) {
  if (!avd) {
    return (
      <p className="py-4 text-body text-muted-foreground">
        Select an AVD to inspect restore candidates and backup state.
      </p>
    );
  }

  const hasEntries = Boolean(restorePlan && restorePlan.entries.length > 0);
  const canRestore = avd.hasBackups && hasEntries && !isLoadingPlan;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-md border p-3',
          avd.hasBackups ? 'border-success/30 bg-success-muted' : 'border-border bg-surface-raised',
        )}
      >
        {avd.hasBackups ? (
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-body text-foreground">
            {avd.hasBackups ? 'Backups detected' : 'No backups yet'}
          </p>
          <p className="text-caption text-muted-foreground">
            {avd.hasBackups
              ? 'Restoring copies the stock files back over the emulator, undoing any root patch.'
              : 'Backups are created the first time you run the root workflow. Run it once to get a restore point.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <SectionHeader>Restore plan</SectionHeader>
          <p className="mt-1 text-body text-muted-foreground">
            {isLoadingPlan
              ? 'Reading backup metadata…'
              : hasEntries
                ? `From ${restorePlan?.source}`
                : 'Nothing to restore — no backed-up files were found for this AVD.'}
          </p>
        </div>
        <LoadingButton
          disabled={!canRestore}
          icon={<RotateCcw aria-hidden="true" className="size-4" />}
          isLoading={isRestoring}
          loadingLabel="Restoring…"
          onClick={onRequestRestore}
          variant="outline"
        >
          Restore stock state
        </LoadingButton>
      </div>

      {isLoadingPlan ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-13 w-full" />
          <Skeleton className="h-13 w-full" />
        </div>
      ) : null}

      {!isLoadingPlan && hasEntries ? (
        <ul className="flex flex-col gap-1.5">
          {restorePlan?.entries.map((entry) => (
            <li
              className="rounded-md border border-border bg-surface-raised px-3 py-2"
              key={entry.originalPath}
            >
              <p className="break-all font-mono text-foreground text-mono">{entry.originalPath}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="min-w-0 break-all font-mono text-mono-sm text-muted-foreground">
                  ← {entry.backupPath}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={`Open the folder containing ${entry.backupPath}`}
                      className="shrink-0"
                      onClick={() => {
                        void openBackupFolder(entry.backupPath);
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Open backup location</TooltipContent>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
