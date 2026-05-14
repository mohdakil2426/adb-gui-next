import { FileUp, Loader2, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropZone } from '@/shared/components/DropZone';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';

export function ApkPickerPanel({
  apkPaths,
  installProgress,
  isInstalling,
  onAddMore,
  onClearAll,
  onInstall,
  onPathsChange,
  selectedSerial,
}: {
  apkPaths: string[];
  installProgress: { current: number; total: number } | null;
  isInstalling: boolean;
  onAddMore: () => void;
  onClearAll: () => void;
  onInstall: () => void;
  onPathsChange: (next: string[]) => void;
  selectedSerial: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-sm">Install APK</p>
        <p className="text-muted-foreground text-xs">
          Select .apk or .apks files to install on your device.
        </p>
      </div>

      {apkPaths.length === 0 ? (
        <DropZone
          acceptExtensions={['.apk', '.apks']}
          browseLabel="Select App Files"
          disabled={isInstalling || !selectedSerial}
          icon={FileUp}
          label="Drop APK files here"
          onBrowse={onAddMore}
          onFilesDropped={(paths) => {
            onPathsChange([...apkPaths, ...paths]);
            toast.info(`${paths.length} file(s) added`);
          }}
          rejectMessage="Only .apk and .apks files are accepted"
          sublabel="Accepts .apk and .apks files"
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Label>Selected APKs</Label>
            <Button
              className="h-7 gap-1.5 text-xs"
              disabled={isInstalling || !selectedSerial}
              onClick={onAddMore}
              size="sm"
              variant="ghost"
            >
              <FileUp className="size-3.5" />
              Add More
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border bg-popover shadow-sm">
            <div className="max-h-[30vh] min-h-24 overflow-y-auto p-1">
              {apkPaths.map((path) => (
                <div
                  className="group flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
                  key={path}
                >
                  <div className="mr-2 flex min-w-0 flex-1 items-center gap-2">
                    <Package className="size-4 shrink-0 opacity-70" />
                    <span className="truncate">{path.split(/[/\\]/).pop()}</span>
                  </div>
                  <Button
                    className="size-6 opacity-0 hover:bg-transparent hover:text-destructive group-hover:opacity-100"
                    disabled={isInstalling}
                    onClick={() => {
                      onPathsChange(apkPaths.filter((p) => p !== path));
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="size-3" />
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

          <Button
            className="relative w-full overflow-hidden"
            disabled={isInstalling || !selectedSerial}
            onClick={onInstall}
          >
            {isInstalling && installProgress ? (
              <div
                className="absolute inset-0 left-0 bg-primary/20 transition-all duration-300"
                style={{
                  width: `${(installProgress.current / installProgress.total) * 100}%`,
                }}
              />
            ) : null}
            <span className="relative z-10 flex items-center">
              {isInstalling ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Package className="mr-2 size-4" />
              )}
              {isInstalling
                ? `Installing ${installProgress?.current}/${installProgress?.total}…`
                : `Install (${apkPaths.length})`}
            </span>
          </Button>
        </>
      )}
    </div>
  );
}
