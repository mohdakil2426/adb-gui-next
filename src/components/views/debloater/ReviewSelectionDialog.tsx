import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Safety Tier</TableHead>
                <TableHead className="text-right">Packages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_REMOVAL_TIERS.map((tier) => {
                const count = tierCounts[tier];
                if (count === 0) return null;
                const classes = REMOVAL_TIER_CLASSES[tier];
                return (
                  <TableRow key={tier}>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          classes.badge,
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', classes.dot)} />
                        {REMOVAL_TIER_LABELS[tier]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{count}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {pkg.list}
                </span>
                <span className="flex-1 truncate font-mono text-foreground">{pkg.name}</span>
                <span
                  className={cn(
                    'shrink-0 text-[9px] font-medium',
                    disableMode ? 'text-warning-foreground' : 'text-destructive',
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
              {isCreatingBackup && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Backup
            </Button>
          )}
        </div>

        {/* Warning banner */}
        {hasUnsafe && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Unsafe packages selected</AlertTitle>
            <AlertDescription>
              These may cause system instability or bootloops. Ensure you have a backup.
            </AlertDescription>
          </Alert>
        )}

        <Alert className="border-warning/30 bg-warning/10 text-warning-foreground">
          <AlertTriangle />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">
            You cannot brick your device with user-space debloating, but removing essential packages
            may cause a bootloop requiring a factory reset. Always backup first.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            variant={hasUnsafe ? 'destructive' : 'default'}
            onClick={() => void onConfirm()}
            disabled={isApplying}
          >
            {isApplying && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {isApplying
              ? 'Applying…'
              : `Apply ${selectedPackages.size} Action${selectedPackages.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
