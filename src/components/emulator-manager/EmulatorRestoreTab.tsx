import { LoadingButton } from '@/components/LoadingButton';
import type { backend } from '@/lib/desktop/models';
import { RotateCcw } from 'lucide-react';

interface EmulatorRestoreTabProps {
  avd: backend.AvdSummary | null;
  isLoadingPlan: boolean;
  isRestoring: boolean;
  restorePlan: backend.RestorePlan | null;
  onRestore: () => Promise<void>;
}

export function EmulatorRestoreTab({
  avd,
  isLoadingPlan,
  isRestoring,
  restorePlan,
  onRestore,
}: EmulatorRestoreTabProps) {
  if (!avd) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Select an AVD to inspect restore candidates and backup state.
      </p>
    );
  }

  const hasEntries = Boolean(restorePlan && restorePlan.entries.length > 0);

  return (
    <div className="space-y-5">
      {/* Backup status */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          avd.hasBackups
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'border-border bg-muted/40 text-muted-foreground'
        }`}
      >
        {avd.hasBackups
          ? 'Backups detected — restore will put backed-up files back in place.'
          : 'No backups yet. Run a root preparation first to create restore artifacts.'}
      </div>

      {/* Plan header + restore button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Restore plan</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoadingPlan
              ? 'Refreshing backup metadata…'
              : hasEntries
                ? `Source: ${restorePlan?.source}`
                : 'No restorable entries found.'}
          </p>
        </div>
        <LoadingButton
          variant="outline"
          isLoading={isRestoring}
          icon={<RotateCcw className="size-4" />}
          loadingLabel="Restoring…"
          disabled={!avd.hasBackups || !hasEntries || isLoadingPlan}
          onClick={() => void onRestore()}
        >
          Restore stock state
        </LoadingButton>
      </div>

      {/* Plan entries */}
      {hasEntries && (
        <div className="space-y-2">
          {restorePlan?.entries.map((entry) => (
            <div
              key={entry.originalPath}
              className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
            >
              <p className="break-all font-medium">{entry.originalPath}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">← {entry.backupPath}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
