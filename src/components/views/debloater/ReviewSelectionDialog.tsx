import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';
import {
  ALL_REMOVAL_TIERS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  countByTier,
} from './debloaterUtils';
import { CreateDebloatBackup, ListDebloatBackups } from '@/lib/desktop/backend';
import { toast } from 'sonner';
import { AlertTriangle, HardDrive, Loader2, Shield } from 'lucide-react';
import { useDebloatStore } from '@/lib/debloatStore';
import { handleError } from '@/lib/errorHandler';
import { useLogStore } from '@/lib/logStore';

interface ReviewSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPackages: Set<string>;
  packages: backend.DebloatPackageRow[];
  disableMode: boolean;
  onConfirm: () => Promise<void>;
  isApplying: boolean;
}

export function ReviewSelectionDialog({
  open,
  onOpenChange,
  selectedPackages,
  packages,
  disableMode,
  onConfirm,
  isApplying,
}: ReviewSelectionDialogProps) {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupCreated, setBackupCreated] = useState(false);
  const setBackups = useDebloatStore((s) => s.setBackups);

  const selectedRows = packages.filter((p) => selectedPackages.has(p.name));
  const tierCounts = countByTier(packages, selectedPackages);
  const hasUnsafe = tierCounts.Unsafe > 0;
  const actionLabel = disableMode ? 'Disable' : 'Uninstall';

  async function handleCreateBackup() {
    setIsCreatingBackup(true);
    try {
      const snapshots: backend.PackageSnapshot[] = packages.map((p) => ({
        name: p.name,
        state: p.state,
      }));
      await CreateDebloatBackup(snapshots);
      const backups = await ListDebloatBackups();
      setBackups(backups);
      setBackupCreated(true);
      useLogStore.getState().addLog('Debloat backup created', 'success');
      toast.success('Backup created successfully');
    } catch (error) {
      handleError('Create Backup', error);
    } finally {
      setIsCreatingBackup(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={isApplying ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            Review Your Selection
          </DialogTitle>
          <DialogDescription>
            {selectedPackages.size} package{selectedPackages.size !== 1 ? 's' : ''} will be{' '}
            {actionLabel.toLowerCase()}d.
          </DialogDescription>
        </DialogHeader>

        {/* Safety tier summary table */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Safety Tier
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Packages</th>
              </tr>
            </thead>
            <tbody>
              {ALL_REMOVAL_TIERS.map((tier) => {
                const count = tierCounts[tier];
                if (count === 0) return null;
                const classes = REMOVAL_TIER_CLASSES[tier];
                return (
                  <tr key={tier} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          classes.badge,
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', classes.dot)} />
                        {REMOVAL_TIER_LABELS[tier]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Package list */}
        <div className="max-h-40 overflow-y-auto rounded-lg border p-1 text-xs">
          {selectedRows.map((pkg) => {
            const classes = REMOVAL_TIER_CLASSES[pkg.removal];
            return (
              <div
                key={pkg.name}
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/40"
              >
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                    classes.badge,
                  )}
                >
                  {pkg.removal}
                </span>
                <span className="shrink-0 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                  {pkg.list}
                </span>
                <span className="flex-1 truncate font-mono text-foreground">{pkg.name}</span>
                <span
                  className={cn(
                    'shrink-0 text-[9px] font-medium',
                    disableMode ? 'text-amber-500' : 'text-red-500',
                  )}
                >
                  {actionLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Backup prompt */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
          <HardDrive className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 text-xs text-muted-foreground">
            {backupCreated
              ? '✓ Backup created — you can restore later from the Backup tab.'
              : 'Create a device backup before applying to restore if needed.'}
          </div>
          {!backupCreated && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 text-xs"
              disabled={isCreatingBackup}
              onClick={() => void handleCreateBackup()}
            >
              {isCreatingBackup && <Loader2 className="mr-1 size-3 animate-spin" />}
              Backup
            </Button>
          )}
        </div>

        {/* Warning banner */}
        {hasUnsafe && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Unsafe packages selected.</span> These may cause
              system instability or bootloops. Ensure you have a backup.
            </span>
          </div>
        )}

        <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <span className="font-semibold">⚠ Disclaimer:</span> You cannot brick your device with
          user-space debloating, but removing essential packages may cause a bootloop requiring a
          factory reset. Always backup first.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            variant={hasUnsafe ? 'destructive' : 'default'}
            onClick={() => void onConfirm()}
            disabled={isApplying}
          >
            {isApplying && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isApplying
              ? 'Applying…'
              : `Apply ${selectedPackages.size} Action${selectedPackages.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
