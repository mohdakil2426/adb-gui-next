import { AlertTriangle, HardDrive, Loader2, Shield } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreateDebloatBackup, ListDebloatBackups } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/utils/cn';
import { handleError } from '@/shared/utils/errorHandler';
import {
  ALL_REMOVAL_TIERS,
  countByTier,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from './debloaterUtils';

interface ReviewSelectionDialogProps {
  disableMode: boolean;
  isApplying: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  packages: backend.DebloatPackageRow[];
  selectedPackages: Set<string>;
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
      const serial = useDeviceStore.getState().selectedSerial;
      await CreateDebloatBackup(snapshots, serial);
      const backups = await ListDebloatBackups(serial);
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
    <Dialog onOpenChange={isApplying ? () => undefined : onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            Review Your Selection
          </DialogTitle>
          <DialogDescription>
            {selectedPackages.size} package
            {selectedPackages.size === 1 ? '' : 's'} will be {actionLabel.toLowerCase()}d.
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
                if (count === 0) {
                  return null;
                }
                const classes = REMOVAL_TIER_CLASSES[tier];
                return (
                  <TableRow key={tier}>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-caption',
                          classes.badge,
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn('size-1.5 rounded-full', classes.dot)}
                        />
                        {REMOVAL_TIER_LABELS[tier]}
                      </span>
                      <span className="mt-1 block text-caption text-muted-foreground">
                        {REMOVAL_TIER_MEANINGS[tier]}
                      </span>
                    </TableCell>
                    <TableCell className="numeric text-right font-mono">{count}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Package list */}
        <div className="custom-scroll max-h-40 overflow-y-auto rounded-lg border border-border p-1">
          {selectedRows.map((pkg) => {
            const classes = REMOVAL_TIER_CLASSES[pkg.removal];
            return (
              <div
                className="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-accent"
                key={pkg.name}
              >
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 font-medium text-caption',
                    classes.badge,
                  )}
                >
                  {pkg.removal}
                </span>
                <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-medium text-caption text-muted-foreground">
                  {pkg.list}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-foreground text-mono">
                  {pkg.name}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-medium text-caption',
                    disableMode ? 'text-warning' : 'text-destructive',
                  )}
                >
                  {actionLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Backup prompt */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
          <HardDrive aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 text-body text-muted-foreground">
            {backupCreated
              ? 'Backup created — restore it any time from Backups, below the package list.'
              : 'Create a device backup before applying so this is reversible.'}
          </div>
          {!backupCreated && (
            <Button
              className="shrink-0"
              disabled={isCreatingBackup}
              onClick={() => void handleCreateBackup()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isCreatingBackup ? <Loader2 className="animate-spin" /> : null}
              Backup
            </Button>
          )}
        </div>

        {/* Warning banner */}
        {hasUnsafe ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Unsafe packages selected</AlertTitle>
            <AlertDescription>
              These may cause system instability or bootloops. Ensure you have a backup.
            </AlertDescription>
          </Alert>
        ) : null}

        <Alert className="border-warning/30 bg-warning-muted">
          <AlertTriangle />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription>
            You cannot brick your device with user-space debloating, but removing essential packages
            may cause a bootloop requiring a factory reset. Always back up first.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            disabled={isApplying}
            onClick={() => {
              onOpenChange(false);
            }}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={isApplying}
            onClick={() => void onConfirm()}
            type="button"
            variant={hasUnsafe ? 'destructive' : 'default'}
          >
            {isApplying ? <Loader2 className="animate-spin" /> : null}
            {isApplying
              ? 'Applying…'
              : `Apply ${selectedPackages.size} Action${selectedPackages.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
