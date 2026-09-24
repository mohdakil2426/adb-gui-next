import { Loader2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import type { backend } from "@/desktop/models";
// biome-ignore format: keep single line to preserve architectural line count limits
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

interface UninstallConfirmDialogProps {
  isUninstalling: boolean;
  onOpenChange?: (open: boolean) => void;
  onUninstall: () => void;
  open?: boolean;
  packages: backend.InstalledPackage[];
  selectedPackages: Set<string>;
  selectedSerial: string | null;
  trigger?: ReactNode;
}

/**
 * Batch confirmation: lists the actual packages, not just a count. Kept as the
 * app's standard for destructive batches.
 */
export const UninstallConfirmDialog = ({
  isUninstalling,
  onOpenChange,
  onUninstall,
  open,
  packages,
  selectedPackages,
  selectedSerial,
  trigger,
}: UninstallConfirmDialogProps) => {
  const count = selectedPackages.size;
  const dialogProps: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  } = {};
  if (open !== undefined) {
    dialogProps.open = open;
    if (onOpenChange !== undefined) {
      dialogProps.onOpenChange = onOpenChange;
    }
  }

  const renderTrigger = () => {
    if (trigger) {
      return <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>;
    }
    if (open === undefined) {
      return (
        <AlertDialogTrigger asChild>
          <Button
            className="w-full"
            disabled={isUninstalling || count === 0 || !selectedSerial}
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            Uninstall {count > 0 ? `(${count})` : ""}
          </Button>
        </AlertDialogTrigger>
      );
    }
    return null;
  };
  return (
    <AlertDialog {...dialogProps}>
      {renderTrigger()}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Uninstall {count} package{count === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-3">
              <p className="text-body">
                These packages are removed from{" "}
                <span className="text-foreground text-mono font-mono">
                  {selectedSerial ?? "the selected device"}
                </span>
                . Reinstall them from the Install tab or the Marketplace if you need them back.
              </p>
              <div className="border-border bg-muted max-h-40 overflow-y-auto rounded-md border p-2">
                {[...selectedPackages].map((name) => {
                  const pkg = packages.find((entry) => entry.name === name);
                  return (
                    <div className="flex min-w-0 items-baseline gap-2" key={name}>
                      <span className="text-body text-foreground min-w-0 flex-1 truncate">
                        {pkg?.label || name}
                      </span>
                      <span className="text-mono-sm text-muted-foreground min-w-0 flex-1 truncate font-mono">
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="border-warning/30 bg-warning-muted text-caption text-foreground rounded-md border px-3 py-2">
                <span className="font-semibold">Disclaimer:</span> ADB GUI Next is not responsible
                for system instability, bootloops or data loss caused by uninstalling packages.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive/50 active:bg-destructive-active"
            disabled={isUninstalling || !selectedSerial}
            onClick={onUninstall}
          >
            {isUninstalling ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            Uninstall {count}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
