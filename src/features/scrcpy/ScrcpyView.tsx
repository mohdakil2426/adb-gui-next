import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Monitor, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ScrcpyCheckUpdate, ScrcpyInstall, ScrcpyLaunch, ScrcpyStatus } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useScrcpyProgress } from '@/features/scrcpy/hooks/useScrcpyProgress';
import { DEFAULT_SCRCPY_OPTIONS } from '@/features/scrcpy/model/defaults';
import { ScrcpySessionCard } from '@/features/scrcpy/ui/ScrcpySessionCard';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { handleError } from '@/shared/utils/errorHandler';
import { queryKeys } from '@/shared/utils/queries';

export function ViewScrcpy() {
  const queryClient = useQueryClient();
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const progress = useScrcpyProgress();
  const [options, setOptions] = useState<backend.ScrcpyLaunchOptions>(DEFAULT_SCRCPY_OPTIONS);

  const statusQuery = useQuery({
    queryFn: ScrcpyStatus,
    queryKey: queryKeys.scrcpy.status,
  });

  const install = useMutation({
    mutationFn: ScrcpyInstall,
    onError: (error) => {
      handleError('Scrcpy download', error);
    },
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.scrcpy.status, status);
      toast.success(`scrcpy ${status.installedVersion ?? ''} is ready`);
    },
  });

  const checkUpdate = useMutation({
    mutationFn: ScrcpyCheckUpdate,
    onError: (error) => {
      handleError('Scrcpy update check', error);
    },
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.scrcpy.status, status);
      if (status.latestVersion && status.latestVersion !== status.installedVersion) {
        toast.message(`Update available: ${status.latestVersion}`);
      } else {
        toast.success('scrcpy is up to date');
      }
    },
  });

  const launch = useMutation({
    mutationFn: () => ScrcpyLaunch(options, selectedSerial),
    onError: (error) => {
      handleError('Scrcpy launch', error);
    },
    onSuccess: () => {
      toast.success('Opened a native scrcpy window');
    },
  });

  const status = statusQuery.data;
  const installed = Boolean(status?.binaryPath);
  const updateAvailable =
    Boolean(status?.latestVersion) && status?.latestVersion !== status?.installedVersion;
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : null;

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Scrcpy</h1>

      <Card className="border-border bg-surface shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title">
            <Monitor aria-hidden="true" className="size-5" />
            Scrcpy
          </CardTitle>
          <CardDescription>
            Mirror and control the selected device in a separate native window. Official Genymobile
            binaries are downloaded into app data — this app never embeds scrcpy in the webview.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {statusQuery.isError ? (
            <p className="text-body text-destructive">Could not read the local scrcpy install.</p>
          ) : null}

          {status?.unsupportedReason ? (
            <p className="rounded-lg border border-border bg-surface-raised p-3 text-body text-muted-foreground">
              {status.unsupportedReason} You can still launch a copy of scrcpy that is already on
              PATH.
            </p>
          ) : null}

          <div className="grid @lg:grid-cols-3 grid-cols-1 gap-3">
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-caption text-muted-foreground uppercase tracking-wide">
                Installed
              </p>
              <p className="numeric font-medium text-body">
                {status?.installedVersion ?? (installed ? 'detected' : 'not installed')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-caption text-muted-foreground uppercase tracking-wide">Latest</p>
              <p className="numeric font-medium text-body">{status?.latestVersion ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <p className="text-caption text-muted-foreground uppercase tracking-wide">Source</p>
              <p className="font-medium text-body">{status?.source ?? '—'}</p>
            </div>
          </div>

          {install.isPending && progress ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-muted-foreground">{progress.stage}</span>
                <span className="numeric text-caption text-muted-foreground">
                  {percent == null ? '…' : `${percent}%`}
                </span>
              </div>
              <Progress value={percent ?? 15} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {status?.canInstallOfficial ? (
              <Button disabled={install.isPending} onClick={() => install.mutate()} type="button">
                <Download aria-hidden="true" />
                {installed ? 'Redownload official build' : 'Download scrcpy'}
              </Button>
            ) : null}
            <Button
              disabled={checkUpdate.isPending || install.isPending}
              onClick={() => checkUpdate.mutate()}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Check for update
            </Button>
            {updateAvailable && status?.canInstallOfficial ? (
              <Button
                disabled={install.isPending}
                onClick={() => install.mutate()}
                type="button"
                variant="secondary"
              >
                Update to {status.latestVersion}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ScrcpySessionCard
        canLaunch={installed || status?.source === 'path'}
        isLaunching={launch.isPending}
        onLaunch={() => launch.mutate()}
        onOptionsChange={(partial) => {
          setOptions((current) => ({ ...current, ...partial }));
        }}
        options={options}
        serial={selectedSerial}
      />
    </div>
  );
}
