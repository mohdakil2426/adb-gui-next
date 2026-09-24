/* eslint-disable react/todo -- non-React-Compiler try/finally flow */
import {
  Archive,
  Camera,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CreateDebloatBackup, ListDebloatBackups, RestoreDebloatBackup } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { useDebloatStore } from "@/features/app-manager/debloater/model/debloat-store";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { useDeviceStore } from "@/shared/stores/device-store";
import { useLogStore } from "@/shared/stores/log-store";
import { finishOperation, startOperation } from "@/shared/stores/operation-store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { handleError } from "@/shared/utils/error-handler";

const backupTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatBackupTimestamp = (createdAt: string): string => {
  const s = Math.trunc(Number(createdAt));
  return Number.isFinite(s) && s > 0
    ? backupTimestampFormatter.format(new Date(s * 1000))
    : "Unknown date";
};

export const BackupRestorePanel = () => {
  const backups = useDebloatStore((s) => s.backups);
  const packages = useDebloatStore((s) => s.packages);
  const setBackups = useDebloatStore((s) => s.setBackups);
  const applyResults = useDebloatStore((s) => s.applyResults);
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);

  const [pending, setPending] = useState<backend.BackupSummary | null>(null);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  const handleCreateBackup = async () => {
    if (!selectedSerial || packages.length === 0) {
      toast.error("Cannot create backup: No active device packages found");
      return;
    }
    setIsCreatingBackup(true);
    const toastId = toast.loading("Creating device package snapshot…");
    try {
      const snapshots: backend.PackageSnapshot[] = packages.map((p) => ({
        name: p.name,
        state: p.state,
      }));
      await CreateDebloatBackup(snapshots, selectedSerial);
      setBackups(await ListDebloatBackups(selectedSerial));
      useLogStore
        .getState()
        .addLog(`Debloat snapshot created (${snapshots.length} packages)`, "success");
      toast.success(`Snapshot saved (${snapshots.length} package states recorded)`, {
        id: toastId,
      });
    } catch (error) {
      toast.dismiss(toastId);
      handleError("Create Snapshot Backup", error);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const refreshBackups = async () => {
    if (!selectedSerial) {
      return;
    }
    setIsRefreshing(true);
    try {
      setBackups(await ListDebloatBackups(selectedSerial));
    } catch (error) {
      handleError("List Backups", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const restoreBackup = async (backup: backend.BackupSummary) => {
    setPending(null);
    setRestoringFile(backup.fileName);
    const operationId = startOperation({
      detail: `${backup.packageCount} packages`,
      label: `Restoring backup from ${formatBackupTimestamp(backup.createdAt)}`,
      view: "apps",
    });
    const toastId = toast.loading(`Restoring ${backup.packageCount} package states…`);
    try {
      const results = await RestoreDebloatBackup(backup.fileName, selectedSerial);
      applyResults(results);
      const failed = results.filter((r) => !r.success).length;
      const restored = results.length - failed;
      if (failed === 0) {
        toast.success(`Restored ${restored} package${restored === 1 ? "" : "s"} successfully`, {
          id: toastId,
        });
        useLogStore
          .getState()
          .addLog(`Debloat restore: ${restored} package states restored`, "success");
      } else {
        toast.warning(`Restored ${restored} packages, ${failed} failed`, {
          id: toastId,
        });
        useLogStore.getState().addLog(`Debloat restore: ${failed} failures`, "error");
      }
    } catch (error) {
      toast.dismiss(toastId);
      handleError("Restore Backup", error);
    } finally {
      finishOperation(operationId);
      setRestoringFile(null);
    }
  };

  return (
    <section
      aria-label="Device state snapshots and backups"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3.5 shadow-none"
    >
      {/* ── Panel Header ── */}
      <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2">
          <Archive aria-hidden="true" className="text-muted-foreground size-4" />
          <h3 className="text-foreground text-label font-semibold">
            Device State Snapshots & Backups
          </h3>
          <Badge className="text-caption font-mono" variant="neutral">
            {backups.length}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="text-caption h-8 cursor-pointer gap-1.5 px-3"
            disabled={isCreatingBackup || packages.length === 0 || !selectedSerial}
            onClick={() => {
              void handleCreateBackup();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {isCreatingBackup ? (
              <Loader2
                aria-hidden="true"
                className="size-3.5 animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <Camera aria-hidden="true" className="size-3.5" data-icon="inline-start" />
            )}
            Take State Snapshot
          </Button>

          <Button
            aria-label="Refresh backup list"
            className="text-muted-foreground hover:text-foreground size-8"
            disabled={isRefreshing || !selectedSerial}
            onClick={() => {
              void refreshBackups();
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? "size-3.5 animate-spin" : "size-3.5"}
              data-icon="inline-start"
            />
          </Button>
        </div>
      </div>

      {/* ── Snapshot List / Empty State ── */}
      {backups.length === 0 ? (
        <div className="border-border/60 bg-surface-raised/30 flex flex-col items-center justify-center gap-2.5 rounded-md border border-dashed p-6 text-center">
          <ShieldCheck aria-hidden="true" className="text-muted-foreground/60 size-8" />
          <div className="flex max-w-md flex-col gap-1">
            <span className="text-body text-foreground font-medium">
              {selectedSerial ? "No snapshots recorded yet" : "Connect a device to manage backups"}
            </span>
            <span className="text-caption text-muted-foreground">
              {selectedSerial
                ? "Create a snapshot before debloating to record all package states (Enabled / Disabled / Uninstalled). You can restore any snapshot with 1 click."
                : "Select a device from the top switcher to inspect its state backups."}
            </span>
          </div>

          {selectedSerial && packages.length > 0 ? (
            <Button
              className="text-caption mt-1 cursor-pointer gap-1.5"
              disabled={isCreatingBackup}
              onClick={() => {
                void handleCreateBackup();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {isCreatingBackup ? (
                <Loader2
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Plus aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              )}
              Create First State Snapshot
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
          {backups.map((backup) => (
            <div
              className="border-border/40 bg-surface-raised/40 hover:border-border hover:bg-accent/50 flex items-center justify-between gap-3 rounded-md border p-2.5 transition-colors"
              key={backup.fileName}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="border-border/60 bg-surface flex size-7 shrink-0 items-center justify-center rounded-md border">
                  <HardDrive aria-hidden="true" className="text-muted-foreground size-3.5" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body text-foreground truncate font-medium">
                    {formatBackupTimestamp(backup.createdAt)}
                  </span>
                  <span className="text-muted-foreground text-mono-sm truncate font-mono">
                    {backup.fileName}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <Badge className="text-caption font-mono" variant="neutral">
                  {backup.packageCount} packages
                </Badge>
                <Button
                  className="text-caption h-7 cursor-pointer gap-1 px-2.5"
                  disabled={restoringFile !== null || !selectedSerial}
                  onClick={() => setPending(backup)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {restoringFile === backup.fileName ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-3 animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-3" data-icon="inline-start" />
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
            Every package recorded in this snapshot will be re-applied to its recorded state on{" "}
            <span className="text-foreground font-mono font-semibold">
              {selectedSerial ?? "the device"}
            </span>
            . Any debloating performed afterwards will be reversed.
          </p>
        }
        description="Replays the exact recorded state of each package onto the device."
        destructive={false}
        details={
          pending
            ? [
                {
                  label: "Snapshot Date",
                  value: formatBackupTimestamp(pending.createdAt),
                },
                {
                  label: "Packages Recorded",
                  value: `${pending.packageCount} packages`,
                },
                { label: "File Name", mono: true, value: pending.fileName },
                {
                  label: "Target Device",
                  mono: true,
                  value: selectedSerial ?? "unknown",
                },
              ]
            : []
        }
        onConfirm={() => {
          if (pending) {
            void restoreBackup(pending);
          }
        }}
        onOpenChange={(open) => !open && setPending(null)}
        open={pending !== null}
        title="Restore device state snapshot?"
      />
    </section>
  );
};
