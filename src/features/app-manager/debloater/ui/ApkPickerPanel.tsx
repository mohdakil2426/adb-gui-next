import { FileUp, Loader2, Package, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import type { InstallProgress } from '@/features/app-manager/debloater/model/installationStore';
import { InstallProgressCard } from '@/features/app-manager/debloater/ui/InstallProgressCard';
import { DropZone } from '@/shared/components/DropZone';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
import { Button } from '@/shared/ui/button';
import { getFileName } from '@/shared/utils/filePath';

/** Module constant: a fresh array literal here re-registered the window-level
 *  drag-drop handler on every render. */
const APK_EXTENSIONS = ['.apk', '.apks'];

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
  const handleFilesDropped = useCallback(
    (paths: string[]) => {
      onPathsChange([...apkPaths, ...paths]);
      toast.info(`${paths.length} file(s) added`);
    },
    [apkPaths, onPathsChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {apkPaths.length === 0 ? (
        <DropZone
          acceptExtensions={APK_EXTENSIONS}
          browseLabel="Select APK files"
          disabled={isInstalling || !selectedSerial}
          icon={FileUp}
          label="Drop APK files here"
          onBrowse={onAddMore}
          onFilesDropped={handleFilesDropped}
          rejectMessage="Only .apk and .apks files are accepted"
          sublabel="Accepts .apk and .apks files"
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-label text-muted-foreground">Queued for install</span>
            <Button
              disabled={isInstalling || !selectedSerial}
              onClick={onAddMore}
              size="sm"
              type="button"
              variant="ghost"
            >
              <FileUp aria-hidden="true" />
              Add more
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="custom-scroll max-h-64 min-h-24 overflow-y-auto p-1">
              {apkPaths.map((path) => (
                <div
                  className="group flex h-8 items-center justify-between gap-2 rounded-md px-2 hover:bg-accent"
                  key={path}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Package
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate font-mono text-foreground text-mono">
                      {getFileName(path)}
                    </span>
                  </div>
                  <Button
                    aria-label={`Remove ${getFileName(path)}`}
                    className="opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    disabled={isInstalling}
                    onClick={() => {
                      onPathsChange(apkPaths.filter((p) => p !== path));
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <SelectionSummaryBar
            count={apkPaths.length}
            disabled={isInstalling}
            label="file(s)"
            onClear={onClearAll}
          />

          {isInstalling && installProgress ? (
            <InstallProgressCard progress={installProgress} />
          ) : null}

          <Button
            className="w-full"
            disabled={isInstalling || !selectedSerial}
            onClick={onInstall}
            type="button"
          >
            {isInstalling ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Package aria-hidden="true" />
            )}
            {isInstalling ? 'Installing…' : `Install ${apkPaths.length} file(s)`}
          </Button>
        </>
      )}
    </div>
  );
}
