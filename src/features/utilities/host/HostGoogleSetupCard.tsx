import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, ListTree, Usb, Zap } from 'lucide-react';
import { useState } from 'react';
import { HostSetupInstall, HostSetupInstallDriver, HostSetupRepairPath } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useHostSetupProgress } from '@/features/utilities/hooks/useHostSetupProgress';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { queryKeys } from '@/shared/utils/queries';

const STAGE_LABEL: Record<string, string> = {
  catalog: 'Reading Google SDK catalog…',
  done: 'Finished',
  'download-driver': 'Downloading USB driver…',
  'download-tools': 'Downloading platform-tools…',
  elevate: 'Waiting for administrator permission…',
  extract: 'Extracting package…',
};

interface HostGoogleSetupCardProps {
  status: backend.HostSetupStatus | undefined;
}

export function HostGoogleSetupCard({ status }: HostGoogleSetupCardProps) {
  const queryClient = useQueryClient();
  const progress = useHostSetupProgress();
  const [toolsConfirmOpen, setToolsConfirmOpen] = useState(false);
  const [driverConfirmOpen, setDriverConfirmOpen] = useState(false);
  const [pathConfirmOpen, setPathConfirmOpen] = useState(false);

  const invalidateStatus = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.hostSetup.status });
    void queryClient.invalidateQueries({ queryKey: ['hostToolVersions'] });
  };

  const installTools = useMutation({
    mutationFn: HostSetupInstall,
    onError: (err) => handleError('Platform-tools install', err),
    onSuccess: (res) => {
      invalidateStatus();
      if (res.driverMessage) {
        handleSuccess(
          'Platform-tools',
          `Platform-tools ready at ${res.installPath}. ${res.driverMessage}`,
        );
      } else {
        handleSuccess('Platform-tools', `Platform-tools ready at ${res.installPath}`);
      }
    },
  });

  const installDriver = useMutation({
    mutationFn: HostSetupInstallDriver,
    onError: (err) => handleError('Driver install', err),
    onSuccess: (res) => {
      invalidateStatus();
      handleSuccess('USB Driver', res.driverMessage ?? 'Google USB Driver registered successfully');
    },
  });

  const repairPath = useMutation({
    mutationFn: HostSetupRepairPath,
    onError: (err) => handleError('PATH update', err),
    onSuccess: () => {
      invalidateStatus();
      handleSuccess('System PATH', 'Added C:\\Android\\platform-tools to system PATH');
    },
  });

  const isBusy = installTools.isPending || installDriver.isPending || repairPath.isPending;

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Zap className="size-4.5 text-primary" />
            Official Google Platform-Tools & USB Driver Suite
          </CardTitle>
          <Badge className="font-mono text-[10px]" variant="outline">
            Windows Environment
          </Badge>
        </div>
        <CardDescription className="text-body text-muted-foreground">
          Install official standalone platform-tools (C:\Android\platform-tools) and Google USB
          drivers via pnputil
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-1">
        {/* Progress Bar during install */}
        {progress && progress.stage !== 'done' ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
            <div className="flex items-center justify-between text-caption">
              <span className="font-medium text-foreground">
                {STAGE_LABEL[progress.stage] ?? progress.stage}
              </span>
              <span className="font-mono text-muted-foreground">
                {progress.total && progress.total > 0
                  ? Math.round((progress.received / progress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <Progress
              className="h-1.5"
              value={
                progress.total && progress.total > 0
                  ? Math.round((progress.received / progress.total) * 100)
                  : 0
              }
            />
          </div>
        ) : null}

        {/* Tools Actions Grid */}
        <div className="grid @lg:grid-cols-3 @xs:grid-cols-1 gap-3">
          {/* Tool 1: Install Platform-Tools */}
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body text-foreground">
                  Google Platform-Tools
                </span>
                {status?.adbPresent ? (
                  <Badge className="text-[10px]" variant="success">
                    Installed
                  </Badge>
                ) : (
                  <Badge className="text-[10px]" variant="outline">
                    Not Installed
                  </Badge>
                )}
              </div>
              <p className="text-caption text-muted-foreground">
                Standalone adb.exe and fastboot.exe in C:\Android\platform-tools
              </p>
            </div>

            <Button
              className="h-8 gap-1.5 text-caption"
              disabled={isBusy}
              onClick={() => setToolsConfirmOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="size-3.5 text-muted-foreground" />
              {status?.adbPresent ? 'Reinstall Platform-Tools' : 'Install Platform-Tools'}
            </Button>
          </div>

          {/* Tool 2: Google USB Driver */}
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body text-foreground">Google USB Driver</span>
                {status?.driverInstalled ? (
                  <Badge className="text-[10px]" variant="success">
                    Registered
                  </Badge>
                ) : (
                  <Badge className="text-[10px]" variant="outline">
                    Not Registered
                  </Badge>
                )}
              </div>
              <p className="text-caption text-muted-foreground">
                {status?.driverLabel || 'Android composite ADB/Fastboot driver'}
              </p>
            </div>

            <Button
              className="h-8 gap-1.5 text-caption"
              disabled={isBusy}
              onClick={() => setDriverConfirmOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Usb className="size-3.5 text-muted-foreground" />
              {status?.driverInstalled ? 'Reinstall USB Driver' : 'Install USB Driver'}
            </Button>
          </div>

          {/* Tool 3: System PATH */}
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-body text-foreground">
                  System PATH Variable
                </span>
                {status?.onPath ? (
                  <Badge className="text-[10px]" variant="success">
                    Configured
                  </Badge>
                ) : (
                  <Badge className="text-[10px]" variant="warning">
                    Missing
                  </Badge>
                )}
              </div>
              <p className="text-caption text-muted-foreground">
                Allows executing adb/fastboot from any command prompt
              </p>
            </div>

            <Button
              className="h-8 gap-1.5 text-caption"
              disabled={isBusy || status?.onPath}
              onClick={() => setPathConfirmOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <ListTree className="size-3.5 text-muted-foreground" />
              {status?.onPath ? 'PATH Configured' : 'Add to System PATH'}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Confirm Install Tools */}
      <ConfirmDialog
        confirmLabel="Install Platform-Tools"
        consequence={
          <p>
            The official Google platform-tools package will be downloaded and extracted to
            C:\Android\platform-tools.
          </p>
        }
        description="Download and install official Google platform-tools?"
        onConfirm={() => {
          setToolsConfirmOpen(false);
          installTools.mutate();
        }}
        onOpenChange={setToolsConfirmOpen}
        open={toolsConfirmOpen}
        title="Install Google Platform-Tools"
      />

      {/* Confirm Install Driver */}
      <ConfirmDialog
        confirmLabel="Install USB Driver"
        consequence={
          <p>
            Administrator privileges (UAC) will be requested to register android_winusb.inf via
            pnputil.
          </p>
        }
        description="Install official Google USB Driver?"
        onConfirm={() => {
          setDriverConfirmOpen(false);
          installDriver.mutate();
        }}
        onOpenChange={setDriverConfirmOpen}
        open={driverConfirmOpen}
        title="Install Google USB Driver"
      />

      {/* Confirm Repair PATH */}
      <ConfirmDialog
        confirmLabel="Update PATH"
        consequence={
          <p>
            C:\Android\platform-tools will be appended to the Windows system environment PATH
            (requires UAC).
          </p>
        }
        description="Add platform-tools to system PATH?"
        onConfirm={() => {
          setPathConfirmOpen(false);
          repairPath.mutate();
        }}
        onOpenChange={setPathConfirmOpen}
        open={pathConfirmOpen}
        title="Update System PATH"
      />
    </Card>
  );
}
