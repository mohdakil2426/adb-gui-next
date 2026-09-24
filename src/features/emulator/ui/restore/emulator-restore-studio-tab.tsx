import {
  CheckCircle2,
  CircleCheck,
  FileCode,
  HardDrive,
  History,
  Info,
  RotateCcw,
} from "lucide-react";

import type { backend } from "@/desktop/models";
import { LoadingButton } from "@/shared/components/loading-button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";

interface EmulatorRestoreStudioTabProps {
  avd: backend.AvdSummary | null;
  isLoadingPlan: boolean;
  isRestoring: boolean;
  onRequestRestore: () => void;
  restorePlan: backend.RestorePlan | null;
}

const getPlanSourceLabel = (isLoadingPlan: boolean, hasEntries: boolean, source?: string) => {
  if (isLoadingPlan) {
    return "Analyzing backup archive…";
  }
  if (hasEntries) {
    return `Archive Source: ${source ?? ""}`;
  }
  return "No modified system files recorded";
};

const RestorePlanContent = ({
  hasEntries,
  isLoadingPlan,
  restorePlan,
}: {
  hasEntries: boolean;
  isLoadingPlan: boolean;
  restorePlan: backend.RestorePlan | null;
}) => {
  if (isLoadingPlan) {
    return (
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }
  if (hasEntries && restorePlan) {
    return (
      <div className="flex flex-col gap-2.5">
        {restorePlan.entries.map((entry) => {
          const fileName = entry.originalPath.split(/[/\\]/u).pop() ?? entry.originalPath;

          return (
            <div
              className="border-border/60 bg-surface-raised/40 flex flex-col justify-between gap-3 rounded-lg border p-3.5 @sm:flex-row @sm:items-center"
              key={entry.originalPath}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="border-border/60 bg-surface text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border">
                  <FileCode aria-hidden="true" className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-body text-foreground font-mono font-medium">
                    {fileName}
                  </span>
                  <span className="text-caption text-muted-foreground truncate font-mono">
                    {entry.originalPath}
                  </span>
                </div>
              </div>
              <Badge className="shrink-0 font-mono text-[10px]" variant="outline">
                backup
              </Badge>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="border-border/60 bg-surface-raised/40 rounded-lg border p-4 text-center">
      <p className="text-body text-muted-foreground">
        No stock backup archives found for this AVD.
      </p>
    </div>
  );
};

export const EmulatorRestoreStudioTab = ({
  avd,
  isLoadingPlan,
  isRestoring,
  onRequestRestore,
  restorePlan,
}: EmulatorRestoreStudioTabProps) => {
  if (!avd) {
    return (
      <div className="border-border bg-surface-raised/40 rounded-lg border p-8 text-center">
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
      <Card className="border-border bg-surface @container rounded-xl py-4 shadow-none">
        <CardHeader className="gap-0 px-4.5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle
              as="h2"
              className="text-caption text-muted-foreground flex items-center gap-2 font-medium tracking-wider uppercase"
            >
              <History aria-hidden="true" className="text-muted-foreground size-3.5" />
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
              "flex items-start gap-3 rounded-xl border p-4",
              avd.hasBackups
                ? "border-success/30 bg-success-muted"
                : "border-border/60 bg-surface-raised/40"
            )}
          >
            {avd.hasBackups ? (
              <CircleCheck aria-hidden="true" className="text-success mt-0.5 size-5 shrink-0" />
            ) : (
              <Info aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-body text-foreground font-semibold">
                {avd.hasBackups
                  ? "Stock Snapshot & Ramdisk Backups Verified"
                  : "No Stock Backup Created Yet"}
              </p>
              <p className="text-caption text-muted-foreground">
                {avd.hasBackups
                  ? "Pristine system files were archived before the root patch was applied. Restoring copies the stock files back over the emulator, cleanly undoing any Magisk modification."
                  : "Backups are created automatically the first time you execute the Root Studio workflow. Once created, you can restore to stock with 1 click."}
              </p>
            </div>
          </div>

          <div className="border-border/40 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-body text-foreground font-medium">
                {getPlanSourceLabel(isLoadingPlan, hasEntries, restorePlan?.source)}
              </span>
              <span className="text-caption text-muted-foreground">
                {hasEntries
                  ? `${restorePlan?.entries.length} pristine file(s) available for atomic restoration`
                  : "Run root workflow to generate a rollback point"}
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
      <Card className="border-border bg-surface @container rounded-xl py-4 shadow-none">
        <CardHeader className="gap-0 px-4.5 pb-3">
          <CardTitle
            as="h2"
            className="text-caption text-muted-foreground flex items-center gap-2 font-medium tracking-wider uppercase"
          >
            <HardDrive aria-hidden="true" className="text-muted-foreground size-3.5" />
            Archived Stock System Files
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-4.5">
          <RestorePlanContent
            hasEntries={hasEntries}
            isLoadingPlan={isLoadingPlan}
            restorePlan={restorePlan}
          />
        </CardContent>
      </Card>
    </div>
  );
};
