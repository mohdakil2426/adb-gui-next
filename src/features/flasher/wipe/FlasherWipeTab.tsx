import { FolderLock, HardDrive, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RunFastbootHostCommand } from '@/desktop/backend';
import { DeviceGate } from '@/features/flasher/ui/DeviceGate';
import { WipeSafetyGate } from '@/features/flasher/wipe/WipeSafetyGate';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useLogStore } from '@/shared/stores/logStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { handleError } from '@/shared/utils/errorHandler';

interface FlasherWipeTabProps {
  disabled: boolean;
  isLoading: boolean;
  onWipeData: () => void;
  serial: string | null;
}

export function FlasherWipeTab({ serial, disabled, isLoading, onWipeData }: FlasherWipeTabProps) {
  const [isGateUnlocked, setIsGateUnlocked] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleErasePartition = async (partitionName: string) => {
    if (!serial) {
      toast.error('No fastboot device connected');
      return;
    }

    setIsActionLoading(true);
    const toastId = toast.loading(`Erasing ${partitionName} partition...`);
    try {
      await RunFastbootHostCommand(`erase ${partitionName}`, serial);
      toast.success(`Erased ${partitionName}`, {
        description: `${partitionName} partition successfully formatted.`,
        id: toastId,
      });
      useLogStore.getState().addLog(`Erased partition ${partitionName}: Success`, 'success');
    } catch (error) {
      toast.dismiss(toastId);
      handleError(`Erase ${partitionName}`, error);
    } finally {
      setIsActionLoading(false);
      setPendingAction(null);
    }
  };

  const isLocked = !isGateUnlocked || disabled || !serial || isLoading || isActionLoading;

  return (
    <div className="grid @3xl:grid-cols-2 grid-cols-1 items-start gap-5">
      {/* ── Left Column: Safety Gate Interlock ───────────────────────── */}
      <div className="flex flex-col gap-4">
        <WipeSafetyGate
          isConfirmed={isGateUnlocked}
          onConfirmationChange={setIsGateUnlocked}
          serial={serial}
        />

        {serial ? null : (
          <DeviceGate>
            Partition wipe utilities require an active device connected in Fastboot mode.
          </DeviceGate>
        )}
      </div>

      {/* ── Right Column: Formatted Partition Erase Tools ────────────── */}
      <div className="flex flex-col gap-4">
        {/* Tool 1: Factory Reset / Wipe Data */}
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-destructive text-title">
                <Trash2 className="size-5" />
                Wipe Userdata (Factory Reset)
              </CardTitle>
              <Badge variant="destructive">Full Wipe</Badge>
            </div>
            <CardDescription className="text-caption">
              Erases the userdata partition over fastboot, wiping all installed apps, photos, and
              accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              className="w-full"
              disabled={isLocked}
              onClick={() => setPendingAction('userdata')}
              type="button"
              variant="destructive"
            >
              {isLoading && pendingAction === 'userdata' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Factory Reset Device
            </Button>
          </CardContent>
        </Card>

        {/* Tool 2: Erase Cache Partition */}
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground text-title">
                <HardDrive className="size-5 text-muted-foreground" />
                Erase Cache Partition
              </CardTitle>
              <Badge variant="outline">Maintenance</Badge>
            </div>
            <CardDescription className="text-caption">
              Clears the legacy cache partition used for recovery logs and temporary OTA cache.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              className="w-full"
              disabled={isLocked}
              onClick={() => setPendingAction('cache')}
              type="button"
              variant="outline"
            >
              {isActionLoading && pendingAction === 'cache' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <HardDrive className="mr-2 size-4" />
              )}
              Erase Cache
            </Button>
          </CardContent>
        </Card>

        {/* Tool 3: Erase Metadata Partition */}
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground text-title">
                <FolderLock className="size-5 text-muted-foreground" />
                Erase Metadata Partition
              </CardTitle>
              <Badge variant="outline">Encryption Reset</Badge>
            </div>
            <CardDescription className="text-caption">
              Erases file-based encryption (FBE) cryptographic metadata. Required when changing
              custom ROM encryption.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              className="w-full"
              disabled={isLocked}
              onClick={() => setPendingAction('metadata')}
              type="button"
              variant="outline"
            >
              {isActionLoading && pendingAction === 'metadata' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FolderLock className="mr-2 size-4" />
              )}
              Erase Metadata
            </Button>
          </CardContent>
        </Card>

        {/* Tool 4: Erase System Partition */}
        <Card className="rounded-xl border-border bg-surface shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-destructive text-title">
                <ShieldAlert className="size-5" />
                Erase System Partition
              </CardTitle>
              <Badge variant="destructive">OS Wipe</Badge>
            </div>
            <CardDescription className="text-caption">
              Clears the active Android OS system partition before installing a fresh ROM image.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              className="w-full"
              disabled={isLocked}
              onClick={() => setPendingAction('system')}
              type="button"
              variant="destructive"
            >
              {isActionLoading && pendingAction === 'system' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ShieldAlert className="mr-2 size-4" />
              )}
              Erase System
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        confirmLabel={`Yes, Erase ${pendingAction?.toUpperCase()}`}
        consequence={
          <p>
            {pendingAction === 'userdata'
              ? 'All personal files, apps, settings, and accounts will be wiped permanently.'
              : `The physical /${pendingAction} partition will be formatted via fastboot erase.`}
          </p>
        }
        description={`Performs a destructive erase of the ${pendingAction} partition on fastboot hardware.`}
        details={[{ label: 'Target Device', mono: true, value: serial ?? 'Unknown' }]}
        onConfirm={() => {
          if (pendingAction === 'userdata') {
            onWipeData();
            setPendingAction(null);
          } else if (pendingAction) {
            void handleErasePartition(pendingAction);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        open={pendingAction !== null}
        title={`Erase ${pendingAction?.toUpperCase()} Partition?`}
      />
    </div>
  );
}
