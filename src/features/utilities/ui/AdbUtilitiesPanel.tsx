import { Power, RefreshCw, RotateCw, Server, Smartphone, Terminal, Zap } from 'lucide-react';
import { useState } from 'react';
import { UtilitiesGate } from '@/features/utilities/ui/UtilitiesGate';
import { ActionButton } from '@/shared/components/ActionButton';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

type RebootModeId = 'system' | 'recovery' | 'bootloader' | 'fastboot' | null;
type AdbConfirm = 'recovery' | 'bootloader' | 'fastbootd' | 'killServer' | null;

export function AdbUtilitiesPanel({
  deviceMode,
  deviceSerial,
  handleKillServer,
  handleReboot,
  handleRestartServer,
  loadingAction,
  onRescan,
  sentAction,
}: {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  handleKillServer: () => void;
  handleReboot: (mode: string, modeId: RebootModeId, actionId: string) => void;
  handleRestartServer: () => void;
  loadingAction: string | null;
  onRescan: () => void;
  sentAction: string | null;
}) {
  const [pending, setPending] = useState<AdbConfirm>(null);
  const isAdb = deviceMode === 'adb';
  const target = deviceSerial ?? 'the selected device';

  const closeConfirm = (open: boolean) => {
    if (!open) {
      setPending(null);
    }
  };

  const runReboot = (mode: string, modeId: RebootModeId, actionId: string) => {
    setPending(null);
    handleReboot(mode, modeId, actionId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5" />
          ADB Utilities
        </CardTitle>
        <CardDescription>Operations requiring USB Debugging enabled.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isAdb ? null : (
          <UtilitiesGate
            action={
              deviceMode === 'fastboot'
                ? {
                    label: 'Reboot to System',
                    onClick: () => handleReboot('', 'system', 'fb_system'),
                  }
                : { label: 'Rescan', onClick: onRescan }
            }
            message={
              deviceMode === 'fastboot'
                ? 'The selected device is in fastboot mode, where ADB is not available. Reboot it to system to use these actions.'
                : 'Connect a device over USB, enable USB debugging in Developer options, and accept the RSA prompt on the device.'
            }
            title={
              deviceMode === 'fastboot'
                ? 'Selected device is in fastboot mode'
                : 'No ADB device selected'
            }
          />
        )}

        <div className="flex flex-col gap-3">
          <SectionHeader>Power Menu</SectionHeader>
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
            <ActionButton
              actionId="adb_system"
              disabled={!isAdb}
              icon={Power}
              label="Reboot System"
              loadingAction={loadingAction}
              onClick={() => handleReboot('', 'system', 'adb_system')}
              sentAction={sentAction}
              variant="outline"
            />
            <ActionButton
              actionId="adb_recovery"
              disabled={!isAdb}
              icon={RotateCw}
              label="Reboot Recovery"
              loadingAction={loadingAction}
              onClick={() => setPending('recovery')}
              sentAction={sentAction}
              variant="outline"
            />
            <ActionButton
              actionId="adb_bootloader"
              disabled={!isAdb}
              icon={Terminal}
              label="Reboot Bootloader"
              loadingAction={loadingAction}
              onClick={() => setPending('bootloader')}
              sentAction={sentAction}
              variant="outline"
            />
            <ActionButton
              actionId="adb_fastboot"
              disabled={!isAdb}
              icon={Zap}
              label="Reboot Fastbootd"
              loadingAction={loadingAction}
              onClick={() => setPending('fastbootd')}
              sentAction={sentAction}
              variant="outline"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader>Server Control</SectionHeader>
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
            <ActionButton
              actionId="restart_server"
              icon={RefreshCw}
              justifyStart
              label="Restart ADB Server"
              loadingAction={loadingAction}
              onClick={handleRestartServer}
              sentAction={sentAction}
              variant="secondary"
            />
            <ActionButton
              actionId="kill_server"
              className="hover:bg-destructive/10 hover:text-destructive"
              icon={Server}
              justifyStart
              label="Kill ADB Server"
              loadingAction={loadingAction}
              onClick={() => setPending('killServer')}
              sentAction={sentAction}
              variant="secondary"
            />
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        confirmLabel="Reboot to Recovery"
        consequence={
          <p>
            The device leaves normal operation. Any file transfer, install, or shell session in
            flight is cut off.
          </p>
        }
        description={`${target} will restart into recovery mode.`}
        onConfirm={() => runReboot('recovery', 'recovery', 'adb_recovery')}
        onOpenChange={closeConfirm}
        open={pending === 'recovery'}
        title="Reboot into recovery?"
      />

      <ConfirmDialog
        confirmLabel="Reboot to Bootloader"
        consequence={
          <p>
            The device leaves normal operation and becomes reachable only over fastboot. Any
            transfer or shell session in flight is cut off.
          </p>
        }
        description={`${target} will restart into the bootloader.`}
        onConfirm={() => runReboot('bootloader', 'bootloader', 'adb_bootloader')}
        onOpenChange={closeConfirm}
        open={pending === 'bootloader'}
        title="Reboot into the bootloader?"
      />

      <ConfirmDialog
        confirmLabel="Reboot to Fastbootd"
        consequence={
          <p>
            The device leaves normal operation. Any transfer or shell session in flight is cut off.
          </p>
        }
        description={`${target} will restart into fastbootd (userspace fastboot).`}
        onConfirm={() => runReboot('fastboot', 'fastboot', 'adb_fastboot')}
        onOpenChange={closeConfirm}
        open={pending === 'fastbootd'}
        title="Reboot into fastbootd?"
      />

      <ConfirmDialog
        confirmLabel="Kill ADB Server"
        consequence={
          <p>
            Every device in this app disconnects until the server is started again. Use{' '}
            <strong>Restart ADB Server</strong> instead unless you specifically need the server
            stopped.
          </p>
        }
        description="Stops the local adb server. This app talks to every device through it."
        onConfirm={() => {
          setPending(null);
          handleKillServer();
        }}
        onOpenChange={closeConfirm}
        open={pending === 'killServer'}
        title="Kill the ADB server?"
      />
    </Card>
  );
}
