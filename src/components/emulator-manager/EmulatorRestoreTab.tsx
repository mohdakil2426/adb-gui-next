import { CheckCircle2, ExternalLink, RotateCcw } from 'lucide-react';
import { LoadingButton } from '@/components/LoadingButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { OpenFolder } from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { handleError } from '@/lib/errorHandler';

interface EmulatorRestoreTabProps {
  avd: backend.AvdSummary | null;
  isLoadingPlan: boolean;
  isRestoring: boolean;
  onRestore: () => Promise<void>;
  restorePlan: backend.RestorePlan | null;
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
      <p className="py-4 text-muted-foreground text-sm">
        Select an AVD to inspect restore candidates and backup state.
      </p>
    );
  }

  const hasEntries = Boolean(restorePlan && restorePlan.entries.length > 0);

  const handleOpenBackupFolder = async (backupPath: string) => {
    try {
      const folderPath = backupPath.substring(0, backupPath.lastIndexOf('\\'));
      await OpenFolder(folderPath);
    } catch (error) {
      handleError('Open Backup Folder', error);
    }
  };

  return (
    <div className="space-y-5">
      {/* Backup status */}
      <Alert className={avd.hasBackups ? 'border-success/30 bg-success/10 text-success' : ''}>
        <CheckCircle2 />
        <AlertTitle>{avd.hasBackups ? 'Backups detected' : 'No backups yet'}</AlertTitle>
        <AlertDescription>
          {avd.hasBackups
            ? 'Restore will put backed-up files back in place.'
            : 'Run a root preparation first to create restore artifacts.'}
        </AlertDescription>
      </Alert>

      {/* Plan header + restore button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm">Restore plan</p>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {isLoadingPlan
              ? 'Refreshing backup metadata…'
              : hasEntries
                ? `Source: ${restorePlan?.source}`
                : 'No restorable entries found.'}
          </p>
        </div>
        <LoadingButton
          disabled={!(avd.hasBackups && hasEntries) || isLoadingPlan}
          icon={<RotateCcw className="size-4" />}
          isLoading={isRestoring}
          loadingLabel="Restoring…"
          onClick={() => void onRestore()}
          variant="outline"
        >
          Restore stock state
        </LoadingButton>
      </div>

      {/* Plan entries */}
      {hasEntries ? (
        <div className="space-y-2">
          {restorePlan?.entries.map((entry) => (
            <div
              className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
              key={entry.originalPath}
            >
              <p className="break-all font-medium">{entry.originalPath}</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="break-all text-muted-foreground text-xs">← {entry.backupPath}</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleOpenBackupFolder(entry.backupPath)}
                      size="icon"
                      variant="ghost"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Open backup location</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
