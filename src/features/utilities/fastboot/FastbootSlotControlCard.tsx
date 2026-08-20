import { Layers, RotateCw, Zap } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

interface FastbootSlotControlCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  handleReboot: (
    mode: string,
    modeId: 'system' | 'recovery' | 'bootloader' | 'fastboot' | null,
    actionId: string,
  ) => void;
  handleSetActiveSlot: (slot: string) => void;
  handleWipeData: () => void;
  isGlobalLoading?: boolean;
  loadingAction?: string | null;
  sentAction?: string | null;
}

type DangerAction = 'slotA' | 'slotB' | 'wipe' | null;

export function FastbootSlotControlCard({
  deviceMode,
  deviceSerial,
  handleReboot,
  handleSetActiveSlot,
  handleWipeData,
  isGlobalLoading,
  loadingAction: _loadingAction,
  sentAction: _sentAction,
}: FastbootSlotControlCardProps) {
  const isFastboot = deviceMode === 'fastboot';
  const [pendingDanger, setPendingDanger] = useState<DangerAction>(null);

  const handleConfirmAction = () => {
    if (pendingDanger === 'slotA') {
      handleSetActiveSlot('a');
    } else if (pendingDanger === 'slotB') {
      handleSetActiveSlot('b');
    } else if (pendingDanger === 'wipe') {
      handleWipeData();
    }
    setPendingDanger(null);
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-semibold text-title">
          <Zap className="size-4.5 text-primary" />
          Bootloader Slot Controls & Fastboot Power
        </CardTitle>
        <CardDescription className="text-body text-muted-foreground">
          Switch active boot partitions (Slot A / B), execute firmware reboots, and manage fastbootd
          dynamic partitions
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-1">
        {/* Row 1: Slot Switchers */}
        <div className="grid @lg:grid-cols-2 @xs:grid-cols-1 gap-3">
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isFastboot || isGlobalLoading}
            onClick={() => setPendingDanger('slotA')}
            type="button"
            variant="outline"
          >
            <Layers className="size-5 text-muted-foreground" data-icon="inline-start" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Set Active Slot _A</span>
              <span className="text-caption text-muted-foreground">fastboot --set-active=a</span>
            </div>
          </Button>

          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isFastboot || isGlobalLoading}
            onClick={() => setPendingDanger('slotB')}
            type="button"
            variant="outline"
          >
            <Layers className="size-5 text-muted-foreground" data-icon="inline-start" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Set Active Slot _B</span>
              <span className="text-caption text-muted-foreground">fastboot --set-active=b</span>
            </div>
          </Button>
        </div>

        {/* Row 2: Fastboot Reboots */}
        <div className="grid @lg:grid-cols-3 @xs:grid-cols-2 gap-3 border-border/50 border-t pt-3">
          <Button
            className="h-12 justify-start gap-3 p-3 text-left"
            disabled={!isFastboot || isGlobalLoading}
            onClick={() => handleReboot('', 'system', 'fastboot-reboot')}
            type="button"
            variant="outline"
          >
            <RotateCw className="size-4.5 text-muted-foreground" data-icon="inline-start" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot System</span>
              <span className="text-caption text-muted-foreground">Normal boot</span>
            </div>
          </Button>

          <Button
            className="h-12 justify-start gap-3 p-3 text-left"
            disabled={!isFastboot || isGlobalLoading}
            onClick={() => handleReboot('bootloader', 'bootloader', 'fastboot-reboot-bootloader')}
            type="button"
            variant="outline"
          >
            <Zap className="size-4.5 text-muted-foreground" data-icon="inline-start" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot Bootloader</span>
              <span className="text-caption text-muted-foreground">Restart fastboot</span>
            </div>
          </Button>

          <Button
            className="h-12 justify-start gap-3 p-3 text-left"
            disabled={!isFastboot || isGlobalLoading}
            onClick={() => handleReboot('fastboot', 'fastboot', 'fastboot-reboot-fastbootd')}
            type="button"
            variant="outline"
          >
            <Zap className="size-4.5 text-warning" data-icon="inline-start" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot FastbootD</span>
              <span className="text-caption text-muted-foreground">Userspace flasher</span>
            </div>
          </Button>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        confirmLabel={
          pendingDanger === 'slotA'
            ? 'Set Slot A Active'
            : pendingDanger === 'slotB'
              ? 'Set Slot B Active'
              : 'Execute'
        }
        consequence={
          <p>
            Switching active slot will make the device attempt to boot from the target slot on next
            reboot.
          </p>
        }
        description={`Set active partition slot on ${deviceSerial ?? 'the connected device'}?`}
        details={[{ label: 'Device Serial', mono: true, value: deviceSerial ?? 'Unknown' }]}
        onConfirm={handleConfirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDanger(null);
          }
        }}
        open={Boolean(pendingDanger)}
        title="Confirm Fastboot Operation"
      />
    </Card>
  );
}
