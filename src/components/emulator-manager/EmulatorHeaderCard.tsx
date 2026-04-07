import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { backend } from '@/lib/desktop/models';
import { getFileName } from '@/lib/utils';
import { ShieldCheck, Smartphone } from 'lucide-react';

interface EmulatorHeaderCardProps {
  avd: backend.AvdSummary | null;
}

function rootStateCopy(state: backend.AvdRootState): string {
  switch (state) {
    case 'rooted':
      return 'Rooted';
    case 'modified':
      return 'Modified';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Stock';
  }
}

export function EmulatorHeaderCard({ avd }: EmulatorHeaderCardProps) {
  if (!avd) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Smartphone}
            title="Select an emulator"
            description="Pick an AVD from the roster to inspect launch, root, and restore controls."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-4 border-b pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">{avd.name}</CardTitle>
              {avd.isRunning ? (
                <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  Running
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full">
                  Stopped
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full">
                {rootStateCopy(avd.rootState)}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {avd.hasBackups ? 'Backups ready' : 'No backups'}
              </Badge>
            </div>
            <CardDescription className="max-w-3xl">
              Manage runtime controls, assisted root flows, and restore actions for this Android
              Studio virtual device.
            </CardDescription>
          </div>

          <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4 text-primary" />
              Runtime health
            </div>
            <p className="mt-2 text-muted-foreground">
              {avd.serial
                ? `Connected as ${avd.serial}`
                : 'Not attached to adb. Launch the emulator to enable root actions.'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Target</p>
          <p className="font-medium">{avd.target ?? 'Unknown target'}</p>
          <p className="text-sm text-muted-foreground">API {avd.apiLevel ?? 'Unknown'}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Profile</p>
          <p className="font-medium">{avd.deviceName ?? 'Unknown device'}</p>
          <p className="text-sm text-muted-foreground">{avd.abi ?? 'Unknown ABI'}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Ramdisk</p>
          <p className="font-medium">
            {avd.ramdiskPath ? getFileName(avd.ramdiskPath) : 'Unavailable'}
          </p>
          <p className="text-sm text-muted-foreground break-all">
            {avd.ramdiskPath ?? avd.avdPath}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Config</p>
          <p className="font-medium">{getFileName(avd.iniPath)}</p>
          <p className="text-sm text-muted-foreground break-all">{avd.iniPath}</p>
        </div>
      </CardContent>
    </Card>
  );
}
