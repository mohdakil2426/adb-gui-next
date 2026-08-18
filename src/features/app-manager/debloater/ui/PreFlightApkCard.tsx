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
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BatchInspectPackages } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { ItemInstallStatus } from '@/features/app-manager/debloater/model/installationStore';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import {
  getFormatBadgeColor,
  getSdkName,
} from '@/features/app-manager/debloater/model/installFlags';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { getFileName } from '@/shared/utils/filePath';
import { formatBytes } from '@/shared/utils/format';

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
export function PreFlightApkCard({
  disabled = false,
  filePath,
  installStatus,
  isInstalling = false,
  onRemove,
}: PreFlightApkCardProps) {
  const inspections = useInstallationStore((s) => s.inspections);
  const setInspection = useInstallationStore((s) => s.setInspection);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const inspection: backend.ApkInspectionResult | undefined = inspections[filePath];
  const fileName = useMemo(() => getFileName(filePath), [filePath]);

  // Inspect package on mount if not cached
  useEffect(() => {
    let isCancelled = false;
    if (inspection) {
      return;
    }

    setIsLoadingInspection(true);
    BatchInspectPackages([filePath])
      .then((results) => {
        if (!isCancelled) {
          const res = results[0];
          if (res) {
            setInspection(filePath, res);
          }
          setIsLoadingInspection(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setInspectionError(String(err));
          setIsLoadingInspection(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [filePath, inspection, setInspection]);

  // Dynamic status handling
  const status = installStatus?.status ?? 'queued';

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border p-2.5 transition-all',
        status === 'installing' && 'border-primary/50 bg-primary/5 ring-1 ring-primary/30',
        status === 'completed' && 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10',
        status === 'failed' && 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10',
        status === 'queued' &&
          'border-border bg-surface hover:border-border-control hover:bg-surface-raised/40',
      )}
    >
      {/* Top row: Icon, Name/Label, and Remove / Status indicator */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {/* App Icon / File Format glyph */}
          <div className="relative flex size-8.5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-raised">
            {inspection?.iconBase64 ? (
              <img
                alt={inspection.label || fileName}
                className="size-full object-contain p-1"
                height={40}
                src={`data:image/png;base64,${inspection.iconBase64}`}
                width={40}
              />
            ) : inspection?.format === 'xapk' ||
              inspection?.format === 'apks' ||
              inspection?.format === 'apkm' ? (
              <Layers aria-hidden="true" className="size-5 text-sky-500" />
            ) : (
              <Package aria-hidden="true" className="size-5 text-muted-foreground" />
            )}

            {/* Sub-format indicator badge */}
            <span className="absolute right-0.5 bottom-0.5 rounded bg-background/90 px-1 font-bold font-mono text-[9px] text-foreground uppercase">
              {inspection?.format ?? filePath.split('.').pop() ?? 'apk'}
            </span>
          </div>

          {/* Details header */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-semibold text-body text-foreground">
                {inspection?.label || fileName}
              </span>

              <Badge
                className="h-4.5 px-1.5 font-mono text-[10px] uppercase"
                variant={getFormatBadgeColor(inspection?.format ?? 'apk')}
              >
                .{inspection?.format ?? filePath.split('.').pop()}
              </Badge>

              {inspection?.isTestOnly ? (
                <Badge className="h-4.5 px-1.5 text-[10px]" variant="destructive">
                  testOnly
                </Badge>
              ) : null}
            </div>

            {/* Package identifier */}
            <span className="truncate font-mono text-mono-sm text-muted-foreground">
              {inspection?.packageName || fileName}
            </span>
          </div>
        </div>

        {/* Action button / In-flight status */}
        <div className="flex items-center gap-2">
          {status === 'installing' ? (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-caption text-primary">
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              <span>Installing…</span>
            </div>
          ) : status === 'completed' ? (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-caption text-emerald-500">
              <CheckCircle2 aria-hidden="true" className="size-3" />
              <span>
                {installStatus?.durationMs
                  ? `Installed (${(installStatus.durationMs / 1000).toFixed(1)}s)`
                  : 'Installed'}
              </span>
            </div>
          ) : status === 'failed' ? (
            <div className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-medium text-caption text-destructive">
              <AlertCircle aria-hidden="true" className="size-3" />
              <span>Failed</span>
            </div>
          ) : (
            <Button
              aria-label={`Remove ${fileName} from install queue`}
              className="size-7 text-muted-foreground opacity-60 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              disabled={disabled || isInstalling}
              onClick={() => onRemove(filePath)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Metadata spec pills grid */}
      <div className="grid @lg:grid-cols-4 grid-cols-2 gap-1.5 pt-0.5">
        {/* Version Name & Code */}
        <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Version
          </span>
          <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
            {inspection?.versionName
              ? `v${inspection.versionName} (${inspection.versionCode})`
              : isLoadingInspection
                ? 'Reading…'
                : '—'}
          </span>
        </div>

        {/* Target SDK */}
        <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Target SDK
          </span>
          <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
            {inspection?.targetSdk ? (
              <>
                API {inspection.targetSdk}{' '}
                <span className="font-normal text-muted-foreground">
                  ({getSdkName(inspection.targetSdk)})
                </span>
              </>
            ) : isLoadingInspection ? (
              'Reading…'
            ) : (
              '—'
            )}
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
              {inspection?.abis?.length
                ? inspection.abis.join(', ')
                : isLoadingInspection
                  ? 'Reading…'
                  : 'Universal'}
            </span>
          </div>
        </div>

        {/* File Size & Bundle info */}
        <div className="flex flex-col rounded-md border border-border/60 bg-surface-raised/40 px-2 py-1">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            File Size
          </span>
          <span className="truncate font-mono font-semibold text-foreground text-mono-sm">
            {inspection?.fileSize ? formatBytes(inspection.fileSize) : '—'}
          </span>
        </div>
      </div>

      {/* Pre-flight Warnings / Split package info */}
      {inspection?.splitNames && inspection.splitNames.length > 0 ? (
        <div className="flex items-center gap-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-caption text-sky-600 dark:text-sky-400">
          <Archive aria-hidden="true" className="size-3.5 shrink-0" />
          <span>
            Split App Bundle: Includes{' '}
            <strong className="font-semibold">
              {inspection.splitNames.length} APK split modules
            </strong>{' '}
            (will install via <code className="font-mono">adb install-multiple</code>)
          </span>
        </div>
      ) : null}

      {inspection?.targetSdk && inspection.targetSdk < 23 ? (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-600 text-caption dark:text-amber-400">
          <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0" />
          <span>
            Legacy Target SDK {inspection.targetSdk}: Android 14+ requires{' '}
            <code className="font-bold font-mono">--bypass-low-target-sdk-block</code> flag enabled.
          </span>
        </div>
      ) : null}

      {/* Error state if inspection or installation failed */}
      {status === 'failed' && installStatus?.error ? (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-caption text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-all font-mono text-mono-sm leading-tight">
            {installStatus.error}
          </span>
        </div>
      ) : inspectionError ? (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-500 text-caption">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-all font-mono text-mono-sm leading-tight">
            Manifest inspection notice: {inspectionError}
          </span>
        </div>
      ) : null}
    </div>
  );
}
