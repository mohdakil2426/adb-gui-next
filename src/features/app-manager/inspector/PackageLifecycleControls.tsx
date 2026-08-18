import { Download, Play, RotateCcw, Settings, Square, Trash2, Zap, ZapOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  PackageLifecycleOp,
  PullPackageApk,
  RunShellCommand,
  SelectSaveDirectory,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';

interface PackageLifecycleControlsProps {
  info: backend.DetailedPackageInfo;
  onRefresh?: (() => void) | undefined;
  selectedSerial: string | null;
}

export function PackageLifecycleControls({
  info,
  onRefresh,
  selectedSerial,
}: PackageLifecycleControlsProps) {
  const [isActing, setIsActing] = useState(false);

  const runOp = async (op: string, label: string) => {
    if (!selectedSerial) {
      toast.error('No device connected');
      return;
    }
    setIsActing(true);
    try {
      await PackageLifecycleOp(info.name, op, selectedSerial);
      toast.success(`${label} executed successfully`);
      onRefresh?.();
    } catch (e) {
      toast.error(`Failed to ${label.toLowerCase()}: ${String(e)}`);
    } finally {
      setIsActing(false);
    }
  };

  const handlePullApk = async () => {
    if (!selectedSerial) {
      toast.error('No device connected');
      return;
    }
    try {
      const defaultName = `${info.name}.apk`;
      const savePath = await SelectSaveDirectory(defaultName);
      if (!savePath) {
        return;
      }

      setIsActing(true);
      await PullPackageApk(info.name, savePath, selectedSerial);
      toast.success(`Exported APK to ${savePath}`);
    } catch (e) {
      toast.error(`Failed to export APK: ${String(e)}`);
    } finally {
      setIsActing(false);
    }
  };

  const handleOpenSettings = async () => {
    if (!selectedSerial) {
      return;
    }
    try {
      await RunShellCommand(
        `am start -a android.settings.APPLICATION_DETAILS_SETTINGS package:${info.name}`,
        selectedSerial,
      );
      toast.success('Opened App Settings on device');
    } catch (e) {
      toast.error(`Failed to open settings: ${String(e)}`);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground text-label">Lifecycle Operations</h4>
        <span className="text-caption text-muted-foreground">Direct ADB dispatch</span>
      </div>

      <div className="grid @lg:grid-cols-4 grid-cols-2 gap-2">
        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => runOp('launch', 'Launch App')}
          size="sm"
          variant="outline"
        >
          <Play className="size-3.5 text-emerald-500" />
          <span>Launch</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => runOp('force_stop', 'Force Stop')}
          size="sm"
          variant="outline"
        >
          <Square className="size-3.5 text-amber-500" />
          <span>Force Stop</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => runOp('clear_cache', 'Clear Cache')}
          size="sm"
          variant="outline"
        >
          <RotateCcw className="size-3.5 text-sky-500" />
          <span>Clear Cache</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => runOp('clear_data', 'Clear Data')}
          size="sm"
          variant="outline"
        >
          <Trash2 className="size-3.5 text-rose-500" />
          <span>Clear Data</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={handlePullApk}
          size="sm"
          variant="outline"
        >
          <Download className="size-3.5 text-primary" />
          <span>Export APK</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() =>
            runOp(info.isEnabled ? 'disable' : 'enable', info.isEnabled ? 'Disable' : 'Enable')
          }
          size="sm"
          variant="outline"
        >
          {info.isEnabled ? (
            <>
              <ZapOff className="size-3.5 text-amber-500" />
              <span>Disable App</span>
            </>
          ) : (
            <>
              <Zap className="size-3.5 text-emerald-500" />
              <span>Enable App</span>
            </>
          )}
        </Button>

        <Button
          className="col-span-2 h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={handleOpenSettings}
          size="sm"
          variant="outline"
        >
          <Settings className="size-3.5 text-muted-foreground" />
          <span>Open App Settings on Device</span>
        </Button>
      </div>
    </div>
  );
}
