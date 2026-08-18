import { Download, FolderOpen, Monitor, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { backend } from '@/desktop/models';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

interface ScrcpyStatusCardProps {
  isCheckingUpdate: boolean;
  isError: boolean;
  isInstalling: boolean;
  isUninstalling?: boolean | undefined;
  onCheckUpdate: () => void;
  onInstall: () => void;
  onOpenFolder?: (() => void) | undefined;
  onUninstall?: (() => void) | undefined;
  progress: backend.ScrcpyDownloadProgress | null;
  status: backend.ScrcpyStatus | undefined;
}
export function ScrcpyStatusCard({
  isCheckingUpdate,
  isError,
  isInstalling,
  isUninstalling = false,
  onCheckUpdate,
  onInstall,
  onOpenFolder,
  onUninstall,
  progress,
  status,
}: ScrcpyStatusCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const installed = Boolean(status?.binaryPath);
  const updateAvailable =
    Boolean(status?.latestVersion) && status?.latestVersion !== status?.installedVersion;
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : null;

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2 text-title">
            <Monitor aria-hidden="true" className="size-5" />
            Scrcpy
          </CardTitle>
          <CardDescription>
            Mirror and control the selected device in a separate native window. Official Genymobile
            binaries are downloaded into app data — this app never embeds scrcpy in the webview.
          </CardDescription>
        </div>
        {status?.source === 'managed' && installed ? (
          <div className="flex items-center gap-1">
            {onOpenFolder ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Open installed folder"
                    className="size-7"
                    disabled={isInstalling || isUninstalling}
                    onClick={onOpenFolder}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <FolderOpen aria-hidden="true" className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open installed folder</TooltipContent>
              </Tooltip>
            ) : null}

            {onUninstall ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Uninstall scrcpy"
                    className="size-7 hover:bg-destructive/10 hover:text-destructive"
                    disabled={isInstalling || isUninstalling}
                    onClick={() => setConfirmOpen(true)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Uninstall scrcpy</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isError ? (
          <p className="text-body text-destructive">Could not read the local scrcpy install.</p>
        ) : null}

        {status?.unsupportedReason ? (
          <p className="rounded-lg border border-border bg-surface-raised p-3 text-body text-muted-foreground">
            {status.unsupportedReason} You can still launch a copy of scrcpy that is already on
            PATH.
          </p>
        ) : null}

        <div className="grid @lg:grid-cols-3 grid-cols-1 gap-3">
          {[
            {
              label: 'Installed',
              value: status?.installedVersion ?? (installed ? 'detected' : 'not installed'),
              numeric: true,
            },
            { label: 'Latest', value: status?.latestVersion ?? '—', numeric: true },
            { label: 'Source', value: status?.source ?? '—', numeric: false },
          ].map(({ label, value, numeric }) => (
            <div className="rounded-lg border border-border bg-surface-raised p-3" key={label}>
              <p className="text-caption text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={numeric ? 'numeric font-medium text-body' : 'font-medium text-body'}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {isInstalling && progress ? (
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

        <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
          {status?.canInstallOfficial ? (
            <Button
              disabled={isInstalling}
              onClick={onInstall}
              type="button"
              variant={installed ? 'outline' : 'default'}
            >
              <Download aria-hidden="true" />
              {installed ? 'Redownload official build' : 'Download scrcpy'}
            </Button>
          ) : null}
          <Button
            disabled={isCheckingUpdate || isInstalling}
            onClick={onCheckUpdate}
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Check for update
          </Button>
          {updateAvailable && status?.canInstallOfficial ? (
            <Button
              className="@lg:col-span-2 col-span-1"
              disabled={isInstalling}
              onClick={onInstall}
              type="button"
              variant="outline"
            >
              Update to {status.latestVersion}
            </Button>
          ) : null}
        </div>
      </CardContent>

      <ConfirmDialog
        confirmLabel="Uninstall"
        consequence={
          <p>
            Official scrcpy binaries will be removed from app data. You will need to download scrcpy
            again to mirror devices.
          </p>
        }
        description="Deletes downloaded scrcpy binaries and stops any active mirroring sessions."
        destructive
        details={[
          { label: 'Package', value: 'Genymobile scrcpy' },
          { label: 'Installed version', value: status?.installedVersion ?? 'Managed build' },
        ]}
        onConfirm={() => {
          setConfirmOpen(false);
          onUninstall?.();
        }}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Uninstall scrcpy?"
      />
    </Card>
  );
}
