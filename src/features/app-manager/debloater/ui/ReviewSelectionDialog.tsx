import { AlertTriangle, HardDrive, Loader2, Shield } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { useDebloatStore } from '@/lib/debloatStore';
import { CreateDebloatBackup, ListDebloatBackups } from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { handleError } from '@/lib/errorHandler';
import { useLogStore } from '@/lib/logStore';
import { cn } from '@/lib/utils';
import {
  ALL_REMOVAL_TIERS,
  countByTier,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
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
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-[10px]',
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
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/40"
                key={pkg.name}
              >
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 font-medium text-[9px]',
                    classes.badge,
                  )}
                >
                  {pkg.removal}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium text-[9px] text-muted-foreground">
                  {pkg.list}
                </span>
                <span className="flex-1 truncate font-mono text-foreground">{pkg.name}</span>
                <span
                  className={cn(
                    'shrink-0 font-medium text-[9px]',
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
          <div className="flex-1 text-muted-foreground text-xs">
            {backupCreated
              ? '✓ Backup created — you can restore later from the Backup tab.'
              : 'Create a device backup before applying to restore if needed.'}
          </div>
          {!backupCreated && (
            <Button
              className="h-7 shrink-0 text-xs"
              disabled={isCreatingBackup}
              onClick={() => void handleCreateBackup()}
              size="sm"
              variant="outline"
            >
              {isCreatingBackup ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : null}
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

        <Alert className="border-warning/30 bg-warning/10 text-warning-foreground">
          <AlertTriangle />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">
            You cannot brick your device with user-space debloating, but removing essential packages
            may cause a bootloop requiring a factory reset. Always backup first.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            disabled={isApplying}
            onClick={() => {
              onOpenChange(false);
            }}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={isApplying}
            onClick={() => void onConfirm()}
            variant={hasUnsafe ? 'destructive' : 'default'}
          >
            {isApplying ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {isApplying
              ? 'Applying…'
              : `Apply ${selectedPackages.size} Action${selectedPackages.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
