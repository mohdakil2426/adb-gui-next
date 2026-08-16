import { Camera, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { GetLogcatSnapshot, SaveLog, SaveScreenshot, SelectScreenshotPng } from '@/desktop/backend';
import { ActionButton } from '@/shared/components/ActionButton';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { handleError } from '@/shared/utils/errorHandler';

export function DiagnosticsPanel({
  disabled,
  loadingAction,
  serial,
}: {
  disabled: boolean;
  loadingAction: string | null;
  serial: string | null;
}) {
  const [snapshot, setSnapshot] = useState('');
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    setBusy(true);
    try {
      const text = await GetLogcatSnapshot(serial, 400);
      setSnapshot(text);
      toast.success('Captured a logcat snapshot');
    } catch (error) {
      handleError('Logcat', error);
    } finally {
      setBusy(false);
    }
  };

  const saveDump = async () => {
    if (!snapshot) {
      return;
    }
    try {
      const path = await SaveLog(snapshot, 'logcat');
      toast.success(`Saved logcat to ${path}`);
    } catch (error) {
      handleError('Save logcat', error);
    }
  };

  const captureScreenshot = async () => {
    const targetSerial = serial;
    const destPath = await SelectScreenshotPng();
    if (!destPath) {
      return;
    }
    setBusy(true);
    try {
      const saved = await SaveScreenshot(destPath, targetSerial);
      toast.success(`Saved screenshot to ${saved}`);
    } catch (error) {
      handleError('Screenshot', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText />
          Diagnostics
        </CardTitle>
        <CardDescription>
          Bounded logcat dump and a PNG screenshot. Neither streams live output.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <ActionButton
            actionId="logcat_snapshot"
            disabled={disabled || busy}
            icon={ScrollText}
            label="Capture logcat"
            loadingAction={busy ? 'logcat_snapshot' : loadingAction}
            onClick={() => {
              void capture();
            }}
            sentAction={null}
            variant="outline"
          />
          <Button
            disabled={!snapshot}
            onClick={() => {
              void saveDump();
            }}
            type="button"
            variant="secondary"
          >
            Save dump
          </Button>
          <ActionButton
            actionId="screenshot"
            disabled={disabled || busy}
            icon={Camera}
            label="Save screenshot"
            loadingAction={busy ? 'screenshot' : loadingAction}
            onClick={() => {
              void captureScreenshot();
            }}
            sentAction={null}
            variant="outline"
          />
        </div>
        {snapshot ? (
          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-raised p-3 font-mono text-mono-sm">
            {snapshot}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
