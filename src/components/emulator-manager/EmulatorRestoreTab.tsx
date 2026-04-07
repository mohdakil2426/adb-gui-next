import { LoadingButton } from '@/components/LoadingButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card>
        <CardContent className="py-10">
          <p className="text-sm text-muted-foreground">
            Select an AVD to inspect restore candidates and backup state.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasEntries = Boolean(restorePlan && restorePlan.entries.length > 0);

  return (
    <Card>
      <CardHeader className="gap-2 border-b pb-4">
        <CardTitle className="text-base">Restore and unroot</CardTitle>
        <CardDescription>
          Restore stock emulator artifacts from backups created alongside the original files.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">
            {avd.hasBackups ? 'Backups detected' : 'No backups detected yet'}
          </p>
          <p className="mt-2 text-muted-foreground">
            {avd.hasBackups
              ? 'Restore will put backed-up files back in place without deleting the backups.'
              : 'The first successful root preparation creates the restore artifacts needed here.'}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Restore plan</p>
              <p className="text-sm text-muted-foreground">
                {isLoadingPlan
                  ? 'Refreshing backup metadata...'
                  : hasEntries
                    ? `Source: ${restorePlan?.source}`
                    : 'No restorable file entries available.'}
              </p>
            </div>
            <LoadingButton
              variant="outline"
              isLoading={isRestoring}
              icon={<RotateCcw className="size-4" />}
              loadingLabel="Restoring..."
              disabled={!avd.hasBackups || !hasEntries || isLoadingPlan}
              onClick={() => void onRestore()}
            >
              Restore Stock State
            </LoadingButton>
          </div>

          {hasEntries && (
            <div className="space-y-3">
              {restorePlan?.entries.map((entry) => (
                <div
                  key={entry.originalPath}
                  className="rounded-lg border bg-background/80 p-3 text-sm"
                >
                  <p className="font-medium break-all">{entry.originalPath}</p>
                  <p className="mt-1 text-xs text-muted-foreground break-all">
                    Backup: {entry.backupPath}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
