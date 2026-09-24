import {
  Download,
  FolderOpen,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import type { backend } from "@/desktop/models";
import { CliCommandPreview } from "@/features/scrcpy/binary/cli-command-preview";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";

export type ScrcpyBinaryActionState = "idle" | "checking" | "installing" | "uninstalling";

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
const getDownloadButtonLabel = (
  isInstalling: boolean,
  updateAvailable: boolean,
  installed: boolean,
  latestVersion?: string | null | undefined
) => {
  if (isInstalling) {
    return "Downloading...";
  }
  if (updateAvailable) {
    return `Update to ${latestVersion ?? ""}`;
  }
  if (installed) {
    return "Re-download";
  }
  return "Download & Install";
};

const BinaryTabActions = ({
  installed,
  isCheckingUpdate,
  isInstalling,
  isUninstalling,
  onCheckUpdate,
  onInstall,
  onOpenFolder,
  onOpenUninstall,
  status,
  updateAvailable,
}: {
  installed: boolean;
  isCheckingUpdate: boolean;
  isInstalling: boolean;
  isUninstalling: boolean;
  onCheckUpdate?: () => void;
  onInstall?: () => void;
  onOpenFolder?: (() => void) | undefined;
  onOpenUninstall: () => void;
  status: backend.ScrcpyStatus | undefined;
  updateAvailable: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <Button
      className="text-caption h-8 gap-1.5 px-3 font-medium"
      disabled={isCheckingUpdate || isInstalling}
      onClick={onCheckUpdate}
      size="sm"
      type="button"
      variant="outline"
    >
      {isCheckingUpdate ? (
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" data-icon="inline-start" />
      ) : (
        <RefreshCw aria-hidden="true" className="size-3.5" data-icon="inline-start" />
      )}
      <span>Check Updates</span>
    </Button>

    <Button
      className="text-caption h-8 gap-1.5 px-3 font-medium"
      disabled={isInstalling}
      onClick={onInstall}
      size="sm"
      type="button"
      variant={installed && !updateAvailable ? "secondary" : "default"}
    >
      {isInstalling ? (
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" data-icon="inline-start" />
      ) : (
        <Download aria-hidden="true" className="size-3.5" data-icon="inline-start" />
      )}
      <span>
        {getDownloadButtonLabel(isInstalling, updateAvailable, installed, status?.latestVersion)}
      </span>
    </Button>

    {status?.source === "managed" && installed && onOpenFolder ? (
      <Button
        className="text-caption h-8 gap-1.5 px-3"
        onClick={onOpenFolder}
        size="sm"
        type="button"
        variant="outline"
      >
        <FolderOpen aria-hidden="true" className="size-3.5" data-icon="inline-start" />
        <span>Open Folder</span>
      </Button>
    ) : null}

    {status?.source === "managed" && installed && onOpenUninstall ? (
      <Button
        className="text-caption text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 gap-1.5 px-3"
        disabled={isInstalling || isUninstalling}
        onClick={onOpenUninstall}
        size="sm"
        type="button"
        variant="outline"
      >
        <Trash2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
        <span>Uninstall</span>
      </Button>
    ) : null}
  </div>
);
const BinaryTabDetails = ({
  installed,
  isError,
  isInstalling,
  percent,
  progress,
  status,
}: {
  installed: boolean;
  isError: boolean;
  isInstalling: boolean;
  percent: number | null;
  progress: backend.ScrcpyDownloadProgress | null;
  status: backend.ScrcpyStatus | undefined;
}) => (
  <CardContent className="flex flex-col gap-4">
    {isInstalling ? (
      <div className="border-info/30 bg-info/10 flex flex-col gap-2 rounded-lg border p-3.5">
        <div className="text-caption text-info flex items-center justify-between gap-2 font-medium">
          <span>{progress?.stage ?? "Downloading official Scrcpy release archive..."}</span>
          <span>{percent === null ? "In-flight" : `${percent}%`}</span>
        </div>
        <Progress className="h-1.5" value={percent ?? 0} />
      </div>
    ) : null}

    {isError ? (
      <div className="border-destructive/30 bg-destructive/10 text-caption text-destructive rounded-lg border p-3">
        Could not read local scrcpy installation state. Try checking for updates or reinstalling.
      </div>
    ) : null}

    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
      <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-1 rounded-lg border p-3">
        <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
          Installed Version
        </span>
        <span className="text-foreground text-mono font-mono font-medium">
          {status?.installedVersion ?? (installed ? "Detected" : "Not installed")}
        </span>
      </div>

      <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-1 rounded-lg border p-3">
        <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
          Latest Upstream
        </span>
        <span className="text-foreground text-mono font-mono font-medium">
          {status?.latestVersion ?? "—"}
        </span>
      </div>

      <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-1 rounded-lg border p-3">
        <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
          Binary Source
        </span>
        <span className="text-body text-foreground font-medium capitalize">
          {status?.source ?? "—"}
        </span>
      </div>
    </div>

    {status?.binaryPath ? (
      <div className="border-border/60 bg-surface-raised/30 flex flex-col gap-1 rounded-lg border p-2.5">
        <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
          Executable Location
        </span>
        <span className="text-foreground text-mono-sm truncate font-mono">{status.binaryPath}</span>
      </div>
    ) : null}

    <div className="border-border/60 bg-surface-raised/30 text-caption text-muted-foreground flex items-start gap-2.5 rounded-lg border p-3">
      <ShieldCheck aria-hidden="true" className="text-success size-4 shrink-0" />
      <span>
        Official Genymobile release archives are cryptographically verified using SHA-256 checksums
        prior to extraction. Scrcpy runs as a native detached OS process beside the managed ADB
        daemon.
      </span>
    </div>
  </CardContent>
);

export const ScrcpyBinaryTab = ({
  actionState = "idle",
  isError = false,
  onCheckUpdate,
  onInstall,
  onOpenFolder,
  onUninstall,
  options,
  progress,
  selectedSerials,
  status,
}: ScrcpyBinaryTabProps) => {
  const isCheckingUpdate = actionState === "checking";
  const isInstalling = actionState === "installing";
  const isUninstalling = actionState === "uninstalling";
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
          <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Package aria-hidden="true" className="text-foreground size-4" />
                <CardTitle className="text-body text-foreground font-semibold">
                  Official Genymobile Scrcpy Engine Manager
                </CardTitle>
              </div>
              <CardDescription className="text-caption text-muted-foreground">
                Managed official standalone release binaries downloaded and verified in app data.
              </CardDescription>
            </div>

            <BinaryTabActions
              installed={installed}
              isCheckingUpdate={isCheckingUpdate}
              isInstalling={isInstalling}
              isUninstalling={isUninstalling}
              onCheckUpdate={onCheckUpdate}
              onInstall={onInstall}
              onOpenFolder={onOpenFolder}
              onOpenUninstall={() => setConfirmUninstallOpen(true)}
              status={status}
              updateAvailable={updateAvailable}
            />
          </div>
        </CardHeader>

        <BinaryTabDetails
          installed={installed}
          isError={isError}
          isInstalling={isInstalling}
          percent={percent}
          progress={progress}
          status={status}
        />
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
};
