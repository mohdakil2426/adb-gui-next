import {
  Download,
  FolderOpen,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { backend } from '@/desktop/models';
import { CliCommandPreview } from '@/features/scrcpy/binary/CliCommandPreview';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';

export type ScrcpyBinaryActionState = 'idle' | 'checking' | 'installing' | 'uninstalling';

interface ScrcpyBinaryTabProps {
  actionState?: ScrcpyBinaryActionState | undefined;
  isError?: boolean | undefined;
  onCheckUpdate: () => void;
  onInstall: () => void;
  onOpenFolder?: (() => void) | undefined;
  onUninstall?: (() => void) | undefined;
  options: backend.ScrcpyLaunchOptions;
  progress: backend.ScrcpyDownloadProgress | null;
  selectedSerials: Set<string>;
  status: backend.ScrcpyStatus | undefined;
}

export function ScrcpyBinaryTab({
  actionState = 'idle',
  isError = false,
  onCheckUpdate,
  onInstall,
  onOpenFolder,
  onUninstall,
  options,
  progress,
  selectedSerials,
  status,
}: ScrcpyBinaryTabProps) {
  const isCheckingUpdate = actionState === 'checking';
  const isInstalling = actionState === 'installing';
  const isUninstalling = actionState === 'uninstalling';
  const [confirmUninstallOpen, setConfirmUninstallOpen] = useState(false);

  const installed = Boolean(status?.binaryPath);
  const updateAvailable =
    Boolean(status?.latestVersion) &&
    Boolean(status?.installedVersion) &&
    status?.latestVersion !== status?.installedVersion;

  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.received / progress.total) * 100))
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Binary Status & Management Card */}
      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="pb-3">
          <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Package aria-hidden="true" className="size-4 text-foreground" />
                <CardTitle className="font-semibold text-body text-foreground">
                  Official Genymobile Scrcpy Engine Manager
                </CardTitle>
              </div>
              <CardDescription className="text-caption text-muted-foreground">
                Managed official standalone release binaries downloaded and verified in app data.
              </CardDescription>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="h-8 gap-1.5 px-3 font-medium text-caption"
                disabled={isCheckingUpdate || isInstalling}
                onClick={onCheckUpdate}
                size="sm"
                type="button"
                variant="outline"
              >
                {isCheckingUpdate ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" className="size-3.5" />
                )}
                <span>Check Updates</span>
              </Button>

              <Button
                className="h-8 gap-1.5 px-3 font-medium text-caption"
                disabled={isInstalling}
                onClick={onInstall}
                size="sm"
                type="button"
                variant={installed && !updateAvailable ? 'secondary' : 'default'}
              >
                {isInstalling ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <Download aria-hidden="true" className="size-3.5" />
                )}
                <span>
                  {isInstalling
                    ? 'Downloading...'
                    : updateAvailable
                      ? `Update to ${status?.latestVersion}`
                      : installed
                        ? 'Re-download'
                        : 'Download & Install'}
                </span>
              </Button>

              {status?.source === 'managed' && installed && onOpenFolder ? (
                <Button
                  className="h-8 gap-1.5 px-3 text-caption"
                  onClick={onOpenFolder}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <FolderOpen aria-hidden="true" className="size-3.5" />
                  <span>Open Folder</span>
                </Button>
              ) : null}

              {status?.source === 'managed' && installed && onUninstall ? (
                <Button
                  className="h-8 gap-1.5 px-3 text-caption text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  disabled={isInstalling || isUninstalling}
                  onClick={() => setConfirmUninstallOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  <span>Uninstall</span>
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Download Progress Bar if in flight */}
          {isInstalling ? (
            <div className="flex flex-col gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3.5">
              <div className="flex items-center justify-between gap-2 font-medium text-caption text-sky-400">
                <span>{progress?.stage ?? 'Downloading official Scrcpy release archive...'}</span>
                <span>{percent === null ? 'In-flight' : `${percent}%`}</span>
              </div>
              <Progress className="h-1.5" value={percent ?? 0} />
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-caption text-destructive">
              Could not read local scrcpy installation state. Try checking for updates or
              reinstalling.
            </div>
          ) : null}

          {/* Metric Tiles */}
          <div className="grid @lg:grid-cols-3 grid-cols-1 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Installed Version
              </span>
              <span className="font-medium font-mono text-foreground text-mono">
                {status?.installedVersion ?? (installed ? 'Detected' : 'Not installed')}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Latest Upstream
              </span>
              <span className="font-medium font-mono text-foreground text-mono">
                {status?.latestVersion ?? '—'}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Binary Source
              </span>
              <span className="font-medium text-body text-foreground capitalize">
                {status?.source ?? '—'}
              </span>
            </div>
          </div>

          {/* Binary Path & Integrity Details */}
          {status?.binaryPath ? (
            <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface-raised/30 p-2.5">
              <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                Executable Location
              </span>
              <span className="truncate font-mono text-foreground text-mono-sm">
                {status.binaryPath}
              </span>
            </div>
          ) : null}

          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-surface-raised/30 p-3 text-caption text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-emerald-400" />
            <span>
              Official Genymobile release archives are cryptographically verified using SHA-256
              checksums prior to extraction. Scrcpy runs as a native detached OS process beside the
              managed ADB daemon.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Live Generated CLI Preview */}
      <CliCommandPreview options={options} selectedSerials={selectedSerials} />

      {/* Confirm Uninstall Dialog */}
      <ConfirmDialog
        confirmLabel="Uninstall Scrcpy"
        description="This will remove the managed scrcpy executable and server binaries from your local application data folder. You can re-download it at any time."
        destructive
        onConfirm={() => {
          setConfirmUninstallOpen(false);
          onUninstall?.();
        }}
        onOpenChange={setConfirmUninstallOpen}
        open={confirmUninstallOpen}
        title="Uninstall Official Scrcpy Engine?"
      />
    </div>
  );
}
