import {
  CheckCircle2,
  CircleCheck,
  FileCode,
  FolderOpen,
  HardDrive,
  History,
  Info,
  RotateCcw,
} from 'lucide-react';
import { OpenFolder } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { LoadingButton } from '@/shared/components/LoadingButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { handleError } from '@/shared/utils/errorHandler';

interface EmulatorRestoreStudioTabProps {
  avd: backend.AvdSummary | null;
  isLoadingPlan: boolean;
  isRestoring: boolean;
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

export function EmulatorRestoreStudioTab({
  avd,
  isLoadingPlan,
  isRestoring,
  onRequestRestore,
  restorePlan,
}: EmulatorRestoreStudioTabProps) {
  if (!avd) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised/40 p-8 text-center">
        <p className="text-body text-muted-foreground">
          Select an AVD to inspect restore candidates and backup state.
        </p>
      </div>
    );
  }

  const hasEntries = Boolean(restorePlan && restorePlan.entries.length > 0);
  const canRestore = avd.hasBackups && hasEntries && !isLoadingPlan;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Backup & Pristine Integrity Status Banner */}
      <Card className="@container rounded-xl border-border bg-surface py-4 shadow-none">
        <CardHeader className="gap-0 px-4.5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle
              as="h2"
              className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
            >
              <History aria-hidden="true" className="size-3.5 text-muted-foreground" />
              Backup & Snapshot State Integrity
            </CardTitle>

            {avd.hasBackups ? (
              <Badge variant="success">
                <CheckCircle2 aria-hidden="true" className="size-3" />
                Backups Valid & Available
              </Badge>
            ) : (
              <Badge variant="outline">No Backups Found</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-4.5">
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4',
              avd.hasBackups
                ? 'border-success/30 bg-success-muted'
                : 'border-border/60 bg-surface-raised/40',
            )}
          >
            {avd.hasBackups ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold text-body text-foreground">
                {avd.hasBackups
                  ? 'Stock Snapshot & Ramdisk Backups Verified'
                  : 'No Stock Backup Created Yet'}
              </p>
              <p className="text-caption text-muted-foreground">
                {avd.hasBackups
                  ? 'Pristine system files were archived before the root patch was applied. Restoring copies the stock files back over the emulator, cleanly undoing any Magisk modification.'
                  : 'Backups are created automatically the first time you execute the Root Studio workflow. Once created, you can restore to stock with 1 click.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-border/40 border-t pt-3">
            <div className="flex min-w-0 flex-col">
              <span className="font-medium text-body text-foreground">
                {isLoadingPlan
                  ? 'Analyzing backup archive…'
                  : hasEntries
                    ? `Archive Source: ${restorePlan?.source}`
                    : 'No modified system files recorded'}
              </span>
              <span className="text-caption text-muted-foreground">
                {hasEntries
                  ? `${restorePlan?.entries.length} pristine file(s) available for atomic restoration`
                  : 'Run root workflow to generate a rollback point'}
              </span>
            </div>

            <LoadingButton
              disabled={!canRestore}
              icon={<RotateCcw aria-hidden="true" className="size-4" />}
              isLoading={isRestoring}
              loadingLabel="Restoring stock state…"
              onClick={onRequestRestore}
              variant="outline"
            >
              Restore Stock State
            </LoadingButton>
          </div>
        </CardContent>
      </Card>

      {/* 2. System Files Modified & Rollback Plan Table */}
      <Card className="@container rounded-xl border-border bg-surface py-4 shadow-none">
        <CardHeader className="gap-0 px-4.5 pb-3">
          <CardTitle
            as="h2"
            className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
          >
            <HardDrive aria-hidden="true" className="size-3.5 text-muted-foreground" />
            Archived Stock System Files
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-4.5">
          {isLoadingPlan ? (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : hasEntries && restorePlan ? (
            <div className="flex flex-col gap-2.5">
              {restorePlan.entries.map((entry) => {
                const fileName = entry.originalPath.split(/[/\\]/).pop() ?? entry.originalPath;

                return (
                  <div
                    className="flex @sm:flex-row flex-col @sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-raised/40 p-3.5"
                    key={entry.originalPath}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted-foreground">
                        <FileCode aria-hidden="true" className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium font-mono text-body text-foreground">
                          {fileName}
                        </span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          Target: {entry.originalPath}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label={`Open folder for ${fileName}`}
                            onClick={() => {
                              void openBackupFolder(entry.backupPath);
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <FolderOpen aria-hidden="true" className="size-3.5" />
                            <span className="@xs:inline hidden">Open Folder</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reveal backup in File Explorer</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 bg-surface-raised/20 p-6 text-center">
              <p className="text-body text-muted-foreground">
                No backup entries registered. Pristine stock files will be archived when root is
                applied.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
