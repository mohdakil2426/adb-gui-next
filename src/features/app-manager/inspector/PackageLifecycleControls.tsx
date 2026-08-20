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
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
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
  const [isConfirmForceStopOpen, setIsConfirmForceStopOpen] = useState(false);
  const [isConfirmClearDataOpen, setIsConfirmClearDataOpen] = useState(false);
  const [isConfirmDisableOpen, setIsConfirmDisableOpen] = useState(false);

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
          type="button"
          variant="outline"
        >
          <Play aria-hidden="true" className="size-3.5 text-emerald-500" data-icon="inline-start" />
          <span>Launch</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => setIsConfirmForceStopOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Square aria-hidden="true" className="size-3.5 text-amber-500" data-icon="inline-start" />
          <span>Force Stop</span>
        </Button>
        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => runOp('clear_cache', 'Clear Cache')}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw
            aria-hidden="true"
            className="size-3.5 text-sky-500"
            data-icon="inline-start"
          />
          <span>Clear Cache</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => setIsConfirmClearDataOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden="true" className="size-3.5 text-rose-500" data-icon="inline-start" />
          <span>Clear Data</span>
        </Button>
        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={handlePullApk}
          size="sm"
          type="button"
          variant="outline"
        >
          <Download aria-hidden="true" className="size-3.5 text-primary" data-icon="inline-start" />
          <span>Export APK</span>
        </Button>

        <Button
          className="h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={() => {
            if (info.isEnabled) {
              setIsConfirmDisableOpen(true);
            } else {
              void runOp('enable', 'Enable');
            }
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {info.isEnabled ? (
            <>
              <ZapOff
                aria-hidden="true"
                className="size-3.5 text-amber-500"
                data-icon="inline-start"
              />
              <span>Disable App</span>
            </>
          ) : (
            <>
              <Zap
                aria-hidden="true"
                className="size-3.5 text-emerald-500"
                data-icon="inline-start"
              />
              <span>Enable App</span>
            </>
          )}
        </Button>
        <Button
          className="col-span-2 h-8 justify-start gap-1.5 text-caption"
          disabled={isActing}
          onClick={handleOpenSettings}
          size="sm"
          type="button"
          variant="outline"
        >
          <Settings
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
            data-icon="inline-start"
          />
          <span>Open App Settings on Device</span>
        </Button>
      </div>

      {/* Force Stop Confirmation */}
      <ConfirmDialog
        confirmLabel="Force Stop"
        description={`Are you sure you want to force stop ${info.label || info.name}? Any unsaved work or background operations will be terminated.`}
        destructive
        onConfirm={() => {
          setIsConfirmForceStopOpen(false);
          void runOp('force_stop', 'Force Stop');
        }}
        onOpenChange={setIsConfirmForceStopOpen}
        open={isConfirmForceStopOpen}
        title={`Force stop ${info.label || info.name}?`}
      />

      {/* Clear Data Confirmation */}
      <ConfirmDialog
        confirmLabel="Clear Data"
        description={`This will permanently delete all app data, databases, logins, accounts, and cache for ${info.label || info.name}. The application will be reset to its clean state.`}
        destructive
        onConfirm={() => {
          setIsConfirmClearDataOpen(false);
          void runOp('clear_data', 'Clear Data');
        }}
        onOpenChange={setIsConfirmClearDataOpen}
        open={isConfirmClearDataOpen}
        title={`Clear all data for ${info.label || info.name}?`}
      />

      {/* Disable Package Confirmation */}
      <ConfirmDialog
        confirmLabel="Disable Package"
        description={`Disabling ${info.label || info.name} will hide it from the launcher and prevent background execution. Some system services or dependent apps may be affected.`}
        destructive
        onConfirm={() => {
          setIsConfirmDisableOpen(false);
          void runOp('disable', 'Disable');
        }}
        onOpenChange={setIsConfirmDisableOpen}
        open={isConfirmDisableOpen}
        title={`Disable ${info.label || info.name}?`}
      />
    </div>
  );
}
