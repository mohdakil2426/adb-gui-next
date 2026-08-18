import { Camera, FileText, Loader2, Sparkles, Trash2, Tv, Wifi } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RunShellCommand, SaveLog, SaveScreenshot, SelectScreenshotPng } from '@/desktop/backend';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';

interface InstantActionsCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  onNavigateTab: (tab: 'power' | 'diagnostics' | 'fastboot' | 'host') => void;
}

export function InstantActionsCard({
  deviceMode,
  deviceSerial,
  onNavigateTab,
}: InstantActionsCardProps) {
  const isAdb = deviceMode === 'adb' && Boolean(deviceSerial);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleCaptureScreenshot = async () => {
    if (!deviceSerial) {
      return;
    }
    setRunningAction('screenshot');
    try {
      const destPath = await SelectScreenshotPng();
      if (!destPath) {
        setRunningAction(null);
        return;
      }
      await SaveScreenshot(destPath, deviceSerial);
      handleSuccess('Screenshot', `Screenshot saved to ${destPath}`);
    } catch (error) {
      handleError('Screenshot', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setRunningAction(null);
    }
  };

  const handleDumpBugreport = async () => {
    if (!deviceSerial) {
      return;
    }
    setRunningAction('bugreport');
    const toastId = toast.loading('Generating ADB bugreport & sysinfo dump...');
    try {
      const logText = await RunShellCommand(
        'dumpsys batterystats && dumpsys meminfo',
        deviceSerial,
      );
      await SaveLog(logText, 'txt');
      toast.success('Sysinfo report exported successfully', { id: toastId });
    } catch (error) {
      toast.error(`Failed to dump sysinfo: ${String(error)}`, { id: toastId });
    } finally {
      setRunningAction(null);
    }
  };

  const handleClearLogcat = async () => {
    if (!deviceSerial) {
      return;
    }
    setRunningAction('clear-logcat');
    try {
      await RunShellCommand('logcat -c', deviceSerial);
      toast.success('Logcat buffer flushed clean');
    } catch (error) {
      toast.error(`Failed to clear logcat: ${String(error)}`);
    } finally {
      setRunningAction(null);
    }
  };

  const handleToggleWifi = async () => {
    if (!deviceSerial) {
      return;
    }
    setRunningAction('wifi');
    try {
      await RunShellCommand('svc wifi disable && svc wifi enable', deviceSerial);
      toast.success('Wi-Fi radio cycled successfully');
    } catch (error) {
      toast.error(`Failed to toggle Wi-Fi: ${String(error)}`);
    } finally {
      setRunningAction(null);
    }
  };

  const handleToggleDemoMode = async () => {
    if (!deviceSerial) {
      return;
    }
    setRunningAction('demo');
    try {
      await RunShellCommand(
        'settings put global sysui_demo_allowed 1 && am broadcast -a com.android.systemui.demo -e command enter',
        deviceSerial,
      );
      toast.success('Demo mode broadcast sent');
    } catch (error) {
      toast.error(`Failed to trigger demo mode: ${String(error)}`);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-semibold text-title">
          <Sparkles className="size-4.5 text-primary" />
          Instant Action Command Cockpit
        </CardTitle>
        <CardDescription className="text-body text-muted-foreground">
          Fast one-click device automation, stream captures, and buffer operations
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="grid @lg:grid-cols-3 @xs:grid-cols-2 gap-3">
          {/* Action 1: Capture Screenshot */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(runningAction)}
            onClick={() => void handleCaptureScreenshot()}
            type="button"
            variant="outline"
          >
            {runningAction === 'screenshot' ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Camera className="size-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Capture Screenshot</span>
              <span className="text-caption text-muted-foreground">Save PNG to host disk</span>
            </div>
          </Button>

          {/* Action 2: Dump Sysinfo Report */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(runningAction)}
            onClick={() => void handleDumpBugreport()}
            type="button"
            variant="outline"
          >
            {runningAction === 'bugreport' ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <FileText className="size-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Dump Sysinfo Report</span>
              <span className="text-caption text-muted-foreground">Battery & memory logs</span>
            </div>
          </Button>

          {/* Action 3: Clear Logcat Buffer */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(runningAction)}
            onClick={() => void handleClearLogcat()}
            type="button"
            variant="outline"
          >
            {runningAction === 'clear-logcat' ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Trash2 className="size-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Flush Logcat Buffer</span>
              <span className="text-caption text-muted-foreground">logcat -c instant clear</span>
            </div>
          </Button>

          {/* Action 4: Cycle Wi-Fi Radio */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(runningAction)}
            onClick={() => void handleToggleWifi()}
            type="button"
            variant="outline"
          >
            {runningAction === 'wifi' ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Wifi className="size-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">Cycle Wi-Fi Radio</span>
              <span className="text-caption text-muted-foreground">svc wifi restart cycle</span>
            </div>
          </Button>

          {/* Action 5: Toggle SystemUI Demo Mode */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            disabled={!isAdb || Boolean(runningAction)}
            onClick={() => void handleToggleDemoMode()}
            type="button"
            variant="outline"
          >
            {runningAction === 'demo' ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Tv className="size-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">SystemUI Demo Mode</span>
              <span className="text-caption text-muted-foreground">Clean statusbar for photo</span>
            </div>
          </Button>

          {/* Action 6: Open Diagnostics Suite */}
          <Button
            className="h-14 justify-start gap-3 p-3 text-left"
            onClick={() => onNavigateTab('diagnostics')}
            type="button"
            variant="outline"
          >
            <Camera className="size-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-semibold text-body text-foreground">
                Screenshot & Log Studio
              </span>
              <span className="text-caption text-muted-foreground">Live viewer & preview</span>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
