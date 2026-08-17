import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Download, FolderOpen, ListTree, SquareTerminal, Usb } from 'lucide-react';
import { useState } from 'react';
import {
  HostSetupInstall,
  HostSetupInstallDriver,
  HostSetupRepairPath,
  HostSetupStatus,
  LaunchDeviceManager,
  LaunchHostSetupTerminal,
  OpenFolder,
} from '@/desktop/backend';
import { useHostSetupProgress } from '@/features/utilities/hooks/useHostSetupProgress';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { isWindows } from '@/shared/utils/platform';
import { queryKeys } from '@/shared/utils/queries';

const STAGE_LABEL: Record<string, string> = {
  catalog: 'Reading Google SDK catalog…',
  'download-tools': 'Downloading platform-tools…',
  'download-driver': 'Downloading USB driver…',
  extract: 'Extracting package…',
  elevate: 'Waiting for administrator permission…',
  done: 'Finished',
};

export function HostSetupPanel() {
  const queryClient = useQueryClient();
  const progress = useHostSetupProgress();
  const [toolsConfirmOpen, setToolsConfirmOpen] = useState(false);
  const [driverConfirmOpen, setDriverConfirmOpen] = useState(false);
  const [pathConfirmOpen, setPathConfirmOpen] = useState(false);

  const statusQuery = useQuery({
    enabled: isWindows,
    queryFn: HostSetupStatus,
    queryKey: queryKeys.hostSetup.status,
  });

  const invalidateStatus = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.hostSetup.status });
  };

  const installTools = useMutation({
    mutationFn: HostSetupInstall,
    onError: (error) => handleError('Platform-tools', error),
    onSuccess: (result) => {
      invalidateStatus();
      handleSuccess(
        'Platform-tools',
        `Version ${result.platformToolsVersion} installed to ${result.installPath}.`,
      );
    },
  });

  const installDriver = useMutation({
    mutationFn: HostSetupInstallDriver,
    onError: (error) => handleError('USB driver', error),
    onSuccess: (result) => {
      invalidateStatus();
      handleSuccess(
        'USB driver',
        `Google USB Driver ${result.platformToolsVersion} was added with pnputil.`,
      );
    },
  });

  const repairPath = useMutation({
    mutationFn: HostSetupRepairPath,
    onError: (error) => handleError('System PATH', error),
    onSuccess: () => {
      invalidateStatus();
      handleSuccess(
        'System PATH',
        'C:\\Android\\platform-tools was added to the Windows system Path. Open a new terminal to use adb.',
      );
    },
  });

  if (!isWindows) {
    return null;
  }

  const status = statusQuery.data;
  const busy = installTools.isPending || installDriver.isPending || repairPath.isPending;
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : busy
        ? 15
        : 0;
  const stageLabel = progress ? (STAGE_LABEL[progress.stage] ?? progress.stage) : null;
  const waitingLabel = repairPath.isPending
    ? 'Waiting for administrator permission to update the system Path…'
    : installDriver.isPending
      ? (stageLabel ?? 'Installing USB driver…')
      : (stageLabel ?? 'Working…');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download />
          Windows host setup
        </CardTitle>
        <CardDescription>
          Install official Google platform-tools and the Google USB driver separately. Tools go to{' '}
          <span className="font-mono text-mono-sm">C:\Android\platform-tools</span>. This app still
          uses its bundled ADB; these installs are for Windows and other tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
          {[
            { label: 'Install path', mono: true, value: status?.installPath ?? '…' },
            { label: 'adb.exe', value: status?.adbPresent ? 'Present' : 'Not installed' },
            { label: 'USB driver', value: status?.driverLabel ?? 'Checking…' },
            {
              label: 'System PATH',
              value: status?.onPath
                ? 'Yes — C:\\Android\\platform-tools is on the system Path'
                : 'No — not on the system Path yet',
            },
            {
              label: 'Latest platform-tools',
              mono: true,
              value: status?.latestPlatformTools ?? 'Could not read catalog',
            },
            {
              label: 'Latest USB driver',
              mono: true,
              value: status?.latestUsbDriver ?? 'Could not read catalog',
            },
          ].map((item) => (
            <div className="flex min-w-0 flex-col gap-0.5" key={item.label}>
              <dt className="text-caption text-muted-foreground uppercase tracking-wide">
                {item.label}
              </dt>
              <dd className={item.mono ? 'font-mono text-foreground text-mono-sm' : 'text-body'}>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {busy ? (
          <div className="flex flex-col gap-2">
            <Progress value={percent} />
            <p className="text-caption text-muted-foreground">{waitingLabel}</p>
          </div>
        ) : null}

        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
          <Button
            disabled={busy}
            onClick={() => setToolsConfirmOpen(true)}
            type="button"
            variant="outline"
          >
            <Download />
            {status?.adbPresent ? 'Reinstall platform-tools' : 'Install platform-tools'}
          </Button>
          <Button
            disabled={busy}
            onClick={() => setDriverConfirmOpen(true)}
            type="button"
            variant="outline"
          >
            <Usb />
            {status?.driverInstalled ? 'Reinstall USB driver' : 'Install USB driver'}
          </Button>
          <Button
            disabled={!status?.adbPresent || Boolean(status?.onPath) || busy}
            onClick={() => setPathConfirmOpen(true)}
            type="button"
            variant="outline"
          >
            <ListTree />
            Add to system PATH
          </Button>
          <Button
            disabled={!status?.adbPresent || busy}
            onClick={() => {
              void OpenFolder(status?.installPath ?? '').catch((error: unknown) => {
                handleError('Open tools folder', error);
              });
            }}
            type="button"
            variant="outline"
          >
            <FolderOpen />
            Open folder
          </Button>
          <Button
            disabled={!status?.adbPresent || busy}
            onClick={() => {
              void LaunchHostSetupTerminal().catch((error: unknown) => {
                handleError('Launch terminal', error);
              });
            }}
            type="button"
            variant="outline"
          >
            <SquareTerminal />
            Open terminal here
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void LaunchDeviceManager().catch((error: unknown) => {
                handleError('Device Manager', error);
              });
            }}
            type="button"
            variant="outline"
          >
            <Cpu />
            Device Manager
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        confirmLabel="Download and install"
        consequence={
          <p>
            Windows will ask for administrator permission to write C:\Android\platform-tools and
            update the system Path. The USB driver is not installed by this action.
          </p>
        }
        description="Downloads official platform-tools from dl.google.com. Existing files in C:\Android\platform-tools are replaced."
        destructive={false}
        details={[
          { label: 'Package', value: 'Google platform-tools' },
          { label: 'Destination', mono: true, value: 'C:\\Android\\platform-tools' },
        ]}
        onConfirm={() => {
          setToolsConfirmOpen(false);
          installTools.mutate();
        }}
        onOpenChange={setToolsConfirmOpen}
        open={toolsConfirmOpen}
        title="Install Google platform-tools?"
      />
      <ConfirmDialog
        confirmLabel="Download and install"
        consequence={
          <p>
            Windows will ask for administrator permission to run pnputil on android_winusb.inf.
            Platform-tools are not changed.
          </p>
        }
        description="Downloads the official Google USB Driver from dl.google.com and registers it with Windows."
        destructive={false}
        details={[
          { label: 'Package', value: 'Google USB Driver' },
          { label: 'INF', mono: true, value: 'android_winusb.inf' },
        ]}
        onConfirm={() => {
          setDriverConfirmOpen(false);
          installDriver.mutate();
        }}
        onOpenChange={setDriverConfirmOpen}
        open={driverConfirmOpen}
        title="Install Google USB driver?"
      />
      <ConfirmDialog
        confirmLabel="Update system Path"
        consequence={
          <p>
            Windows will ask for administrator permission. This writes C:\Android\platform-tools
            into the system Path (not the user Path).
          </p>
        }
        description="Adds the installed platform-tools folder to the Windows system Path environment variable."
        destructive={false}
        details={[
          { label: 'Variable', value: 'Path (system)' },
          { label: 'Entry', mono: true, value: 'C:\\Android\\platform-tools' },
        ]}
        onConfirm={() => {
          setPathConfirmOpen(false);
          repairPath.mutate();
        }}
        onOpenChange={setPathConfirmOpen}
        open={pathConfirmOpen}
        title="Add platform-tools to the system Path?"
      />
    </Card>
  );
}
