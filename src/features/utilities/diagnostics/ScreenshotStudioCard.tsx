import { Camera, Check, Copy, Download, Loader2, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RunShellCommand, SaveScreenshot, SelectScreenshotPng } from '@/desktop/backend';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';

interface ScreenshotStudioCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
}

export function ScreenshotStudioCard({ deviceMode, deviceSerial }: ScreenshotStudioCardProps) {
  const isAdb = deviceMode === 'adb' && Boolean(deviceSerial);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotTime, setScreenshotTime] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedScreenshot, setCopiedScreenshot] = useState(false);

  const handleCaptureScreenshot = async () => {
    if (!deviceSerial) {
      return;
    }
    setIsCapturing(true);
    try {
      const rawBase64 = await RunShellCommand('screencap -p | base64', deviceSerial);
      const cleanBase64 = rawBase64.replace(/\s+/g, '');
      if (cleanBase64.length > 100) {
        setScreenshotBase64(`data:image/png;base64,${cleanBase64}`);
        setScreenshotTime(new Date().toLocaleTimeString());
        handleSuccess('Screenshot', 'Screenshot captured successfully');
      } else {
        throw new Error('Screenshot data stream too short or corrupted');
      }
    } catch (error) {
      handleError('Capture Screenshot', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSaveScreenshotToDisk = async () => {
    if (!deviceSerial) {
      return;
    }
    try {
      const destPath = await SelectScreenshotPng();
      if (!destPath) {
        return;
      }
      setIsCapturing(true);
      await SaveScreenshot(destPath, deviceSerial);
      handleSuccess('Save Screenshot', `Screenshot saved to ${destPath}`);
    } catch (error) {
      handleError('Save Screenshot', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopyScreenshot = async () => {
    if (!screenshotBase64) {
      return;
    }
    try {
      const res = await fetch(screenshotBase64);
      if (!res.ok) {
        throw new Error(`Failed to load screenshot data: ${res.statusText}`);
      }
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        setCopiedScreenshot(true);
        setTimeout(() => setCopiedScreenshot(false), 2000);
        toast.success('Screenshot copied to clipboard');
      }
    } catch (error) {
      toast.error(`Failed to copy screenshot: ${String(error)}`);
    }
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Camera className="size-4.5 text-primary" />
            Device Screenshot Studio
          </CardTitle>
          {screenshotTime ? (
            <Badge className="text-[10px]" variant="secondary">
              Captured {screenshotTime}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="text-body text-muted-foreground">
          Instant high-resolution display frame grab with clipboard copy and file export
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            className="h-8 gap-1.5 px-3 text-caption"
            disabled={!isAdb || isCapturing}
            onClick={() => void handleCaptureScreenshot()}
            size="sm"
            type="button"
          >
            {isCapturing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Camera className="size-3.5" />
            )}
            {screenshotBase64 ? 'Capture Fresh Frame' : 'Take Screenshot'}
          </Button>

          {screenshotBase64 ? (
            <>
              <Button
                className="h-8 gap-1.5 px-3 text-caption"
                onClick={() => void handleCopyScreenshot()}
                size="sm"
                type="button"
                variant="outline"
              >
                {copiedScreenshot ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5 text-muted-foreground" />
                )}
                {copiedScreenshot ? 'Copied to Clipboard' : 'Copy Image'}
              </Button>

              <Button
                className="h-8 gap-1.5 px-3 text-caption"
                onClick={() => void handleSaveScreenshotToDisk()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Download className="size-3.5 text-muted-foreground" />
                Save PNG to Disk
              </Button>
            </>
          ) : null}
        </div>

        {/* Screenshot Viewport Container */}
        {screenshotBase64 ? (
          <div className="flex max-h-[380px] items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-black/80 p-3">
            <img
              alt="Device Screen Capture"
              className="max-h-[360px] max-w-full rounded-md object-contain shadow-md"
              height={360}
              src={screenshotBase64}
              width={180}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/80 border-dashed py-10 text-center">
            <Smartphone className="mb-2 size-8 text-muted-foreground" />
            <span className="font-semibold text-body text-foreground">No Frame Captured Yet</span>
            <span className="text-caption text-muted-foreground">
              Click &quot;Take Screenshot&quot; above to fetch the active display buffer.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
