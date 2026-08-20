import { Flame, Loader2, Power, RotateCw, Smartphone, Zap } from 'lucide-react';
import { useState } from 'react';
import { RunShellCommand } from '@/desktop/backend';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';

interface TargetRebootCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  handleReboot: (
    mode: string,
    modeId: 'system' | 'recovery' | 'bootloader' | 'fastboot' | null,
    actionId: string,
  ) => void;
  loadingAction: string | null;
  sentAction?: string | null;
}

type DangerousRebootMode = 'recovery' | 'bootloader' | 'fastbootd' | 'edl' | null;

export function TargetRebootCard({
  deviceMode,
  deviceSerial,
  handleReboot,
  loadingAction,
  sentAction: _sentAction,
}: TargetRebootCardProps) {
  const isAdb = deviceMode === 'adb' && Boolean(deviceSerial);
  const [pendingConfirm, setPendingConfirm] = useState<DangerousRebootMode>(null);

  const onConfirmReboot = (mode: DangerousRebootMode) => {
    setPendingConfirm(null);
    if (!mode) {
      return;
    }
    if (mode === 'recovery') {
      handleReboot('recovery', 'recovery', 'reboot-recovery');
    } else if (mode === 'bootloader') {
      handleReboot('bootloader', 'bootloader', 'reboot-bootloader');
    } else if (mode === 'fastbootd') {
      handleReboot('fastboot', 'fastboot', 'reboot-fastbootd');
    } else if (mode === 'edl') {
      if (!deviceSerial) {
        return;
      }
      void (async () => {
        try {
          await RunShellCommand('reboot edl', deviceSerial);
          handleSuccess('EDL Reboot', 'Device rebooted to EDL (Emergency Download Mode)');
        } catch (error) {
          handleError('EDL Reboot', error instanceof Error ? error : new Error(String(error)));
        }
      })();
    }
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-semibold text-title">
          <Power className="size-4.5 text-primary" />
          Target Reboot Actions
        </CardTitle>
        <CardDescription className="text-body text-muted-foreground">
          Symmetrical control grid for device reboots into system, recovery, bootloader, or
          low-level firmware modes
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="grid @lg:grid-cols-3 @xs:grid-cols-2 gap-3">
          {/* Reboot 1: System */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(loadingAction)}
            onClick={() => handleReboot('', 'system', 'reboot-system')}
            type="button"
            variant="outline"
          >
            {loadingAction === 'reboot-system' ? (
              <Loader2 className="size-5 animate-spin text-primary" data-icon="inline-start" />
            ) : (
              <RotateCw className="size-5 text-muted-foreground" data-icon="inline-start" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot System</span>
              <span className="text-caption text-muted-foreground">Standard clean OS reboot</span>
            </div>
          </Button>

          {/* Reboot 2: Recovery */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(loadingAction)}
            onClick={() => setPendingConfirm('recovery')}
            type="button"
            variant="outline"
          >
            {loadingAction === 'reboot-recovery' ? (
              <Loader2 className="size-5 animate-spin text-primary" data-icon="inline-start" />
            ) : (
              <Smartphone className="size-5 text-muted-foreground" data-icon="inline-start" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot Recovery</span>
              <span className="text-caption text-muted-foreground">TWRP / Stock Recovery</span>
            </div>
          </Button>

          {/* Reboot 3: Bootloader */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(loadingAction)}
            onClick={() => setPendingConfirm('bootloader')}
            type="button"
            variant="outline"
          >
            {loadingAction === 'reboot-bootloader' ? (
              <Loader2 className="size-5 animate-spin text-primary" data-icon="inline-start" />
            ) : (
              <Zap className="size-5 text-muted-foreground" data-icon="inline-start" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot Bootloader</span>
              <span className="text-caption text-muted-foreground">Fastboot firmware mode</span>
            </div>
          </Button>

          {/* Reboot 4: FastbootD */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(loadingAction)}
            onClick={() => setPendingConfirm('fastbootd')}
            type="button"
            variant="outline"
          >
            {loadingAction === 'reboot-fastbootd' ? (
              <Loader2 className="size-5 animate-spin text-primary" data-icon="inline-start" />
            ) : (
              <Zap className="size-5 text-warning" data-icon="inline-start" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot FastbootD</span>
              <span className="text-caption text-muted-foreground">Dynamic super partition</span>
            </div>
          </Button>

          {/* Reboot 5: EDL / 9008 Mode */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(loadingAction)}
            onClick={() => setPendingConfirm('edl')}
            type="button"
            variant="outline"
          >
            <Flame className="size-5 text-destructive" data-icon="inline-start" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Reboot EDL (9008)</span>
              <span className="text-caption text-muted-foreground">Emergency Download Mode</span>
            </div>
          </Button>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        confirmLabel={`Reboot to ${pendingConfirm?.toUpperCase()}`}
        consequence={
          <p>
            The device will exit Android and enter the selected target boot environment immediately.
          </p>
        }
        description={`Are you sure you want to reboot ${deviceSerial ?? 'the device'} into ${pendingConfirm}?`}
        details={[{ label: 'Target Serial', mono: true, value: deviceSerial ?? 'Unknown' }]}
        onConfirm={() => onConfirmReboot(pendingConfirm)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingConfirm(null);
          }
        }}
        open={Boolean(pendingConfirm)}
        title={`Reboot to ${pendingConfirm?.toUpperCase()}`}
      />
    </Card>
  );
}
