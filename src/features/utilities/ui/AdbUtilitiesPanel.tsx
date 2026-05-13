import { Power, RefreshCw, RotateCw, Server, Smartphone, Terminal, Zap } from 'lucide-react';
import { ActionButton } from '@/shared/components/ActionButton';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function AdbUtilitiesPanel({
  deviceMode,
  handleKillServer,
  handleReboot,
  handleRestartServer,
  loadingAction,
  sentAction,
}: {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  handleKillServer: () => void;
  handleReboot: (
    mode: string,
    modeId: 'system' | 'recovery' | 'bootloader' | 'fastboot' | null,
    actionId: string,
  ) => void;
  handleRestartServer: () => void;
  loadingAction: string | null;
  sentAction: string | null;
}) {
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
        <div className="flex flex-col gap-3">
          <SectionHeader>Power Menu</SectionHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionButton
              actionId="adb_system"
              disabled={deviceMode !== 'adb'}
              icon={Power}
              label="Reboot System"
              loadingAction={loadingAction}
              onClick={() => handleReboot('', 'system', 'adb_system')}
              sentAction={sentAction}
              tall
              variant="outline"
            />
            <ActionButton
              actionId="adb_recovery"
              disabled={deviceMode !== 'adb'}
              icon={RotateCw}
              label="Reboot Recovery"
              loadingAction={loadingAction}
              onClick={() => handleReboot('recovery', 'recovery', 'adb_recovery')}
              sentAction={sentAction}
              tall
              variant="outline"
            />
            <ActionButton
              actionId="adb_bootloader"
              disabled={deviceMode !== 'adb'}
              icon={Terminal}
              label="Reboot Bootloader"
              loadingAction={loadingAction}
              onClick={() => handleReboot('bootloader', 'bootloader', 'adb_bootloader')}
              sentAction={sentAction}
              tall
              variant="outline"
            />
            <ActionButton
              actionId="adb_fastboot"
              disabled={deviceMode !== 'adb'}
              icon={Zap}
              label="Reboot Fastbootd"
              loadingAction={loadingAction}
              onClick={() => handleReboot('fastboot', 'fastboot', 'adb_fastboot')}
              sentAction={sentAction}
              tall
              variant="outline"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader>Server Control</SectionHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              onClick={handleKillServer}
              sentAction={sentAction}
              variant="secondary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
