import { FilePlus2, Loader2, Package, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { BatchInspectPackages } from '@/desktop/backend';
import {
  buildAdbInstallFlags,
  type InstallProgress,
  useInstallationStore,
} from '@/features/app-manager/debloater/model/installationStore';
import { InstallDropZone } from '@/features/app-manager/debloater/ui/InstallDropZone';
import { InstallFlagsCockpit } from '@/features/app-manager/debloater/ui/InstallFlagsCockpit';
import { InstallProgressCard } from '@/features/app-manager/debloater/ui/InstallProgressCard';
import { PreFlightApkCard } from '@/features/app-manager/debloater/ui/PreFlightApkCard';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { formatBytes } from '@/shared/utils/format';

interface ApkPickerPanelProps {
  apkPaths: string[];
  installProgress: InstallProgress | null;
  isInstalling: boolean;
  onAddMore: () => void;
  onClearAll: () => void;
  onInstall: () => void;
  onPathsChange: (next: string[]) => void;
  selectedSerial: string | null;
}

export function ApkPickerPanel({
  apkPaths,
  installProgress,
  isInstalling,
  onAddMore,
  onClearAll,
  onInstall,
  onPathsChange,
  selectedSerial,
}: ApkPickerPanelProps) {
  const inspections = useInstallationStore((s) => s.inspections);
  const setInspection = useInstallationStore((s) => s.setInspection);
  const itemStatuses = useInstallationStore((s) => s.itemStatuses);
  const installFlags = useInstallationStore((s) => s.installFlags);

  // Eagerly batch inspect any newly added APK paths
  useEffect(() => {
    const uninspected = apkPaths.filter((p) => !inspections[p]);
    if (uninspected.length === 0) {
      return;
    }
    let isCancelled = false;
    BatchInspectPackages(uninspected)
      .then((results) => {
        if (!isCancelled) {
          for (const res of results) {
            if (res.filePath) {
              setInspection(res.filePath, res);
            }
          }
        }
      })
      .catch(() => {
        // Fallback per-card inspection catches individual errors
      });
    return () => {
      isCancelled = true;
    };
  }, [apkPaths, inspections, setInspection]);

  const activeFlagArgs = useMemo(() => buildAdbInstallFlags(installFlags), [installFlags]);

  const handleFilesDropped = useCallback(
    (paths: string[]) => {
      // De-duplicate newly dropped paths
      const existing = new Set(apkPaths);
      const uniqueNew = paths.filter((p) => !existing.has(p));
      if (uniqueNew.length === 0) {
        toast.info('File(s) already in queue');
        return;
      }
      onPathsChange([...apkPaths, ...uniqueNew]);
      toast.success(`Added ${uniqueNew.length} file(s) to install queue`);
    },
    [apkPaths, onPathsChange],
  );

  const handleRemoveFile = useCallback(
    (pathToRemove: string) => {
      onPathsChange(apkPaths.filter((p) => p !== pathToRemove));
    },
    [apkPaths, onPathsChange],
  );

  // Compute total inspected file size
  const totalSizeBytes = useMemo(() => {
    let total = 0;
    for (const path of apkPaths) {
      const insp = inspections[path];
      if (insp?.fileSize) {
        total += insp.fileSize;
      }
    }
    return total;
  }, [apkPaths, inspections]);

  return (
    <div className="flex flex-col gap-3">
      {/* State 1: Empty Queue */}
      {apkPaths.length === 0 ? (
        <div className="flex flex-col gap-3">
          <InstallDropZone
            disabled={isInstalling}
            onBrowse={onAddMore}
            onFilesDropped={handleFilesDropped}
            selectedSerial={selectedSerial}
          />
          <InstallFlagsCockpit disabled={isInstalling} />
        </div>
      ) : (
        /* State 2: Active Queue with Pre-Flight Inspection & Controls */
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-none">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-foreground">
                <Package aria-hidden="true" className="size-4.5 text-primary" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-body text-foreground">
                    Installation Queue
                  </span>
                  <Badge className="h-5 px-2 font-mono text-[11px]" variant="secondary">
                    {apkPaths.length} file{apkPaths.length === 1 ? '' : 's'}
                  </Badge>
                  {totalSizeBytes > 0 ? (
                    <Badge className="h-5 px-2 font-mono text-[11px]" variant="outline">
                      {formatBytes(totalSizeBytes)} total
                    </Badge>
                  ) : null}
                </div>
                <span className="text-caption text-muted-foreground">
                  Ready for sideloading onto selected Android hardware
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="h-8 gap-1.5 px-3 font-medium text-caption"
                disabled={isInstalling}
                onClick={onAddMore}
                size="sm"
                type="button"
                variant="outline"
              >
                <FilePlus2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                Add More Files
              </Button>
              <Button
                className="h-8 gap-1.5 px-2.5 text-caption text-muted-foreground hover:text-destructive"
                disabled={isInstalling}
                onClick={onClearAll}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                Clear Queue
              </Button>
            </div>
          </div>

          {/* ADB Install Flags Switchboard Cockpit */}
          <InstallFlagsCockpit disabled={isInstalling} />

          {/* Active Installation Live Progress Telemetry (when in-flight) */}
          {isInstalling && installProgress ? (
            <InstallProgressCard flagsCount={activeFlagArgs.length} progress={installProgress} />
          ) : null}

          {/* Persistent Compact Drag & Drop Zone for Continuous Adding */}
          <InstallDropZone
            compact
            disabled={isInstalling}
            onBrowse={onAddMore}
            onFilesDropped={handleFilesDropped}
            selectedSerial={selectedSerial}
          />

          {/* Pre-Flight APK Cards List (Scrollable, Fixed Max-Height) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="font-medium text-caption text-muted-foreground uppercase tracking-wider">
                Pre-Flight Binary Inspection ({apkPaths.length})
              </span>
              <span className="text-caption text-muted-foreground">
                Validated attributes parsed from package manifests
              </span>
            </div>

            <div className="flex max-h-[396px] flex-col gap-2 overflow-y-auto pr-1">
              {apkPaths.map((path) => (
                <PreFlightApkCard
                  disabled={isInstalling || !selectedSerial}
                  filePath={path}
                  installStatus={itemStatuses[path]}
                  isInstalling={isInstalling}
                  key={path}
                  onRemove={handleRemoveFile}
                />
              ))}
            </div>
          </div>

          {/* Primary Installation Action Trigger */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <Button
              className="h-10 w-full gap-2 font-semibold text-body shadow-xs"
              disabled={isInstalling || !selectedSerial}
              onClick={onInstall}
              size="lg"
              type="button"
            >
              {isInstalling ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  <span>
                    Installing Queue ({installProgress ? installProgress.completed + 1 : 1} of{' '}
                    {apkPaths.length})…
                  </span>
                </>
              ) : (
                <>
                  <Package aria-hidden="true" className="size-4" data-icon="inline-start" />
                  <span>
                    Install {apkPaths.length} Package{apkPaths.length === 1 ? '' : 's'} onto Device
                  </span>
                </>
              )}
            </Button>

            {selectedSerial ? null : (
              <span className="text-center text-caption text-muted-foreground">
                Connect and pick a target device in the sidebar to begin installation.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
