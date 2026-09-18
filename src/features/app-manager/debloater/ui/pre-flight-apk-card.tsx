import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Cpu,
  Layers,
  Loader2,
  Package,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BatchInspectPackages } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import {
  getFormatBadgeColor,
  getSdkName,
} from "@/features/app-manager/debloater/model/install-flags";
import type { ItemInstallStatus } from "@/features/app-manager/debloater/model/installation-store";
import { useInstallationStore } from "@/features/app-manager/debloater/model/installation-store";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { getFileName } from "@/shared/utils/file-path";
import { formatBytes } from "@/shared/utils/format";

interface PreFlightApkCardProps {
  disabled?: boolean | undefined;
  filePath: string;
  installStatus?: ItemInstallStatus | undefined;
  isInstalling?: boolean | undefined;
  onRemove: (path: string) => void;
}

/**
 * Pre-Flight APK card previewing queued binaries before or during installation.
 * Shows package name, version, target SDK, ABIs, splits, permissions, and live installation status.
 */
const PreFlightCardIcon = ({
  fileName,
  filePath,
  inspection,
}: {
  fileName: string;
  filePath: string;
  inspection?: backend.ApkInspectionResult | undefined;
}) => {
  const isBundle =
    inspection?.format === "xapk" || inspection?.format === "apks" || inspection?.format === "apkm";

  const renderIcon = () => {
    if (inspection?.iconBase64) {
      return (
        <img
          alt={inspection.label || fileName}
          className="size-full object-contain p-1"
          height={40}
          src={`data:image/png;base64,${inspection.iconBase64}`}
          width={40}
        />
      );
    }
    if (isBundle) {
      return <Layers aria-hidden="true" className="size-5 text-sky-500" />;
    }
    return <Package aria-hidden="true" className="size-5 text-muted-foreground" />;
  };

  return (
    <div className="relative flex size-8.5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-raised">
      {renderIcon()}
      <span className="absolute right-0.5 bottom-0.5 rounded bg-background/90 px-1 font-bold font-mono text-caption text-foreground uppercase">
        {inspection?.format ?? filePath.split(".").pop() ?? "apk"}
      </span>
    </div>
  );
};

const PreFlightCardStatus = ({
  disabled,
  fileName,
  filePath,
  installStatus,
  isInstalling,
  onRemove,
  status,
}: {
  disabled?: boolean | undefined;
  fileName: string;
  filePath: string;
  installStatus?: ItemInstallStatus | undefined;
  isInstalling?: boolean | undefined;
  onRemove: (path: string) => void;
  status: string;
}) => {
  if (status === "installing") {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-caption text-primary">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        <span>Installing…</span>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-caption text-emerald-500">
        <CheckCircle2 aria-hidden="true" className="size-3" />
        <span>
          {installStatus?.durationMs
            ? `Installed (${(installStatus.durationMs / 1000).toFixed(1)}s)`
            : "Installed"}
        </span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-medium text-caption text-destructive">
        <AlertCircle aria-hidden="true" className="size-3" />
        <span>Failed</span>
      </div>
    );
  }

  return (
    <Button
      aria-label={`Remove ${fileName} from install queue`}
      className="size-7 text-muted-foreground opacity-60 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      disabled={disabled || isInstalling}
      onClick={() => onRemove(filePath)}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <Trash2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
    </Button>
  );
};

const PreFlightCardSpecGrid = ({
  inspection,
  isLoadingInspection,
}: {
  inspection?: backend.ApkInspectionResult | undefined;
  isLoadingInspection: boolean;
}) => {
  let versionText = "—";
  if (inspection?.versionName) {
    versionText = `v${inspection.versionName} (${inspection.versionCode})`;
  } else if (isLoadingInspection) {
    versionText = "Reading…";
  }

  const renderTargetSdk = () => {
    if (inspection?.targetSdk) {
      return (
        <>
          API {inspection.targetSdk}{" "}
          <span className="font-normal text-muted-foreground">
            ({getSdkName(inspection.targetSdk)})
          </span>
        </>
      );
    }
    if (isLoadingInspection) {
      return "Reading…";
    }
    return "—";
  };

  let abiText = "Universal";
  if (inspection?.abis?.length) {
    abiText = inspection.abis.join(", ");
  } else if (isLoadingInspection) {
    abiText = "Reading…";
  }

  return (
    <div className="grid @lg:grid-cols-4 grid-cols-2 gap-1.5 pt-0.5">
      {/* Version Name & Code */}
      <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          Version
        </span>
        <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
          {versionText}
        </span>
      </div>

      {/* Target SDK */}
      <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          Target SDK
        </span>
        <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
          {renderTargetSdk()}
        </span>
      </div>

      {/* Native ABIs */}
      <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          Architecture / ABI
        </span>
        <div className="flex items-center gap-1 overflow-hidden">
          <Cpu aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
            {abiText}
          </span>
        </div>
      </div>

      {/* File Size & Bundle info */}
      <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
        <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          File Size
        </span>
        <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
          {inspection?.fileSize ? formatBytes(inspection.fileSize) : "—"}
        </span>
      </div>
    </div>
  );
};
const PreFlightCardHeader = ({
  fileName,
  filePath,
  inspection,
}: {
  fileName: string;
  filePath: string;
  inspection?: backend.ApkInspectionResult | undefined;
}) => (
  <div className="flex min-w-0 flex-1 flex-col">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="truncate font-semibold text-body text-foreground">
        {inspection?.label || fileName}
      </span>

      <Badge
        className="h-4.5 px-1.5 font-mono text-[10px] uppercase"
        variant={getFormatBadgeColor(inspection?.format ?? "apk")}
      >
        .{inspection?.format ?? filePath.split(".").pop()}
      </Badge>

      {inspection?.isTestOnly ? (
        <Badge className="h-4.5 px-1.5 text-[10px]" variant="destructive">
          testOnly
        </Badge>
      ) : null}
    </div>

    <span className="truncate font-mono text-mono-sm text-muted-foreground">
      {inspection?.packageName || fileName}
    </span>
  </div>
);

const PreFlightCardNotices = ({
  inspection,
  inspectionError,
  installStatus,
  status,
}: {
  inspection?: backend.ApkInspectionResult | undefined;
  inspectionError: string | null;
  installStatus?: ItemInstallStatus | undefined;
  status: string;
}) => (
  <>
    {inspection?.splitNames && inspection.splitNames.length > 0 ? (
      <div className="flex items-center gap-1.5 rounded-md border border-info/20 bg-info-muted px-2.5 py-1 text-caption text-info">
        <Archive aria-hidden="true" className="size-3.5 shrink-0" />
        <span>
          Split App Bundle: Includes{" "}
          <strong className="font-semibold">
            {inspection.splitNames.length} APK split modules
          </strong>{" "}
          (will install via <code className="font-mono">adb install-multiple</code>)
        </span>
      </div>
    ) : null}

    {inspection?.targetSdk && inspection.targetSdk < 23 ? (
      <div className="flex items-center gap-1.5 rounded-md border border-warning/25 bg-warning-muted px-2.5 py-1 text-caption text-warning">
        <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0" />
        <span>
          Legacy Target SDK {inspection.targetSdk}: Android 14+ requires{" "}
          <code className="font-bold font-mono">--bypass-low-target-sdk-block</code> flag enabled.
        </span>
      </div>
    ) : null}

    {status === "failed" && installStatus?.error ? (
      <Alert
        className="border-destructive/30 bg-destructive-muted text-destructive"
        variant="destructive"
      >
        <AlertCircle aria-hidden="true" className="size-3.5" />
        <AlertTitle className="text-caption">Installation failed</AlertTitle>
        <AlertDescription className="break-all font-mono text-mono-sm">
          {installStatus.error}
        </AlertDescription>
      </Alert>
    ) : null}

    {inspectionError ? (
      <div className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-muted px-2.5 py-1.5 text-caption text-warning">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0 break-all font-mono text-mono-sm leading-tight">
          Manifest inspection notice: {inspectionError}
        </span>
      </div>
    ) : null}
  </>
);

export const PreFlightApkCard = ({
  disabled = false,
  filePath,
  installStatus,
  isInstalling = false,
  onRemove,
}: PreFlightApkCardProps) => {
  const inspections = useInstallationStore((s) => s.inspections);
  const setInspection = useInstallationStore((s) => s.setInspection);
  const [isLoadingInspection, setIsLoadingInspection] = useState(() => !inspections[filePath]);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const inspection: backend.ApkInspectionResult | undefined = inspections[filePath];
  const fileName = useMemo(() => getFileName(filePath), [filePath]);

  // Inspect package on mount if not cached
  useEffect(() => {
    let isCancelled = false;
    if (inspection) {
      return;
    }

    const runInspect = async () => {
      try {
        const results = await BatchInspectPackages([filePath]);
        if (!isCancelled) {
          const [res] = results;
          if (res) {
            setInspection(filePath, res);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setInspectionError(String(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingInspection(false);
        }
      }
    };
    void runInspect();
    return () => {
      isCancelled = true;
    };
  }, [filePath, inspection, setInspection]);

  // Dynamic status handling
  const status = installStatus?.status ?? "queued";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border p-2.5 transition-colors duration-200",
        status === "installing" && "border-primary/50 bg-primary/5 ring-1 ring-primary/30",
        status === "completed" && "border-success/30 bg-success-muted",
        status === "failed" && "border-destructive/40 bg-destructive-muted",
        status === "queued" &&
          "border-border bg-surface hover:border-border-control hover:bg-surface-raised/40"
      )}
    >
      {/* Top row: Icon, Name/Label, and Remove / Status indicator */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {/* App Icon / File Format glyph */}
          <PreFlightCardIcon fileName={fileName} filePath={filePath} inspection={inspection} />

          <PreFlightCardHeader fileName={fileName} filePath={filePath} inspection={inspection} />
        </div>

        {/* Action button / In-flight status */}
        <div className="flex items-center gap-2">
          <PreFlightCardStatus
            disabled={disabled}
            fileName={fileName}
            filePath={filePath}
            installStatus={installStatus}
            isInstalling={isInstalling}
            onRemove={onRemove}
            status={status}
          />
        </div>
      </div>

      {/* Metadata spec pills grid */}
      <PreFlightCardSpecGrid inspection={inspection} isLoadingInspection={isLoadingInspection} />

      <PreFlightCardNotices
        inspection={inspection}
        inspectionError={inspectionError}
        installStatus={installStatus}
        status={status}
      />
    </div>
  );
};
