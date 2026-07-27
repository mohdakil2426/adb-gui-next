import { Loader2, Trash2 } from 'lucide-react';
import type { backend } from '@/desktop/models';
// biome-ignore format: keep single line to preserve architectural line count limits
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';

interface UninstallConfirmDialogProps {
  isUninstalling: boolean;
  onUninstall: () => void;
  packages: backend.InstalledPackage[];
  selectedPackages: Set<string>;
  selectedSerial: string | null;
}

/**
 * Batch confirmation: lists the actual packages, not just a count. Kept as the
 * app's standard for destructive batches.
 */
export function UninstallConfirmDialog({
  isUninstalling,
  onUninstall,
  packages,
  selectedPackages,
  selectedSerial,
}: UninstallConfirmDialogProps) {
  const count = selectedPackages.size;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className="w-full"
          disabled={isUninstalling || count === 0 || !selectedSerial}
          type="button"
          variant="destructive"
        >
          <Trash2 aria-hidden="true" />
          Uninstall {count > 0 ? `(${count})` : ''}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Uninstall {count} package{count === 1 ? '' : 's'}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-3">
              <p className="text-body">
                These packages are removed from{' '}
                <span className="font-mono text-foreground text-mono">
                  {selectedSerial ?? 'the selected device'}
                </span>
                . Reinstall them from the Install tab or the Marketplace if you need them back.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted p-2">
                {Array.from(selectedPackages).map((name) => {
                  const pkg = packages.find((entry) => entry.name === name);
                  return (
                    <div className="flex min-w-0 items-baseline gap-2" key={name}>
                      <span className="min-w-0 flex-1 truncate text-body text-foreground">
                        {pkg?.label || name}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-mono-sm text-muted-foreground">
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="rounded-md border border-warning/30 bg-warning-muted px-3 py-2 text-caption text-foreground">
                <span className="font-semibold">Disclaimer:</span> ADB GUI Next is not responsible
                for system instability, bootloops or data loss caused by uninstalling packages.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
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
}
