import { CheckCircle2, FileCheck, Loader2, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface SideloadProgressCardProps {
  fileName?: string;
  isSideloading: boolean;
  packagePath?: string;
}

export function SideloadProgressCard({
  isSideloading,
  fileName,
  packagePath,
}: SideloadProgressCardProps) {
  const [streamProgress, setStreamProgress] = useState<{
    percentage: number;
    stage: string;
    message: string;
  }>({
    percentage: 0,
    stage: 'idle',
    message: '',
  });

  useEffect(() => {
    if (!isSideloading) {
      return;
    }

    const unlisten = EventsOn<backend.SideloadProgress>('flasher:sideload-progress', (payload) => {
      const percentage = payload.percentage ?? payload.percent ?? 0;
      const stage = payload.stage ?? payload.phase ?? 'sideloading';
      const message = payload.message ?? '';
      setStreamProgress({ percentage, stage, message });
    });

    return () => {
      unlisten();
    };
  }, [isSideloading]);
  const steps = [
    {
      id: 'verify',
      label: '1. Package Verification',
      description: 'Verifies OTA ZIP zip-structure and cryptographic manifest',
      status: isSideloading ? 'complete' : packagePath ? 'ready' : 'pending',
    },
    {
      id: 'stream',
      label: '2. ADB Sideload Stream',
      description:
        streamProgress.percentage > 0
          ? `Transferred ${streamProgress.percentage}% to device`
          : 'Streams raw payload bytes to device recovery daemon',
      status:
        streamProgress.percentage >= 100 ||
        streamProgress.stage === 'verifying' ||
        streamProgress.stage === 'success'
          ? 'complete'
          : isSideloading
            ? 'active'
            : 'pending',
    },
    {
      id: 'install',
      label: '3. Device Processing',
      description: 'Recovery updater executes delta patches and updates target slot',
      status:
        streamProgress.stage === 'verifying'
          ? 'active'
          : streamProgress.stage === 'success'
            ? 'complete'
            : 'pending',
    },
    {
      id: 'finalize',
      label: '4. Slot Handover',
      description: 'Bootloader marks new slot active and clean boot target',
      status: streamProgress.stage === 'success' ? 'complete' : 'pending',
    },
  ];
  return (
    <Card className="flex flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <Radio className="size-5 text-info" />
            Sideload Pipeline & Execution Tracker
          </CardTitle>
          <Badge variant={isSideloading ? 'default' : 'outline'}>
            {isSideloading ? 'Transferring' : 'Ready'}
          </Badge>
        </div>
        <CardDescription className="text-caption">
          Real-time lifecycle stages for ADB sideload OTA package installation.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5">
        {/* Streamed Progress Bar during execution */}
        {isSideloading ? (
          <div className="flex flex-col gap-2 rounded-lg border border-info/30 bg-info/5 p-3">
            <div className="flex items-center justify-between text-caption">
              <span className="font-semibold text-foreground">
                Streaming {fileName || 'Package'} to Recovery... ({streamProgress.percentage}%)
              </span>
              <span className="font-mono text-info">
                {streamProgress.message ||
                  (streamProgress.percentage >= 100 ? 'Processing' : 'Live Transfer')}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-info transition-all duration-300 ease-out"
                style={{ width: `${Math.max(2, Math.min(100, streamProgress.percentage))}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Steps Grid */}
        <div className="flex flex-col gap-2">
          {steps.map((step) => (
            <div
              className={cn(
                'flex items-start justify-between gap-3 rounded-lg border p-2.5 transition-colors',
                step.status === 'active'
                  ? 'border-info/40 bg-info/5 shadow-xs'
                  : step.status === 'complete'
                    ? 'border-success/30 bg-success/5'
                    : 'border-border/70 bg-surface-raised/40',
              )}
              key={step.id}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <div
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                    step.status === 'active' && 'bg-info/10 text-info',
                    step.status === 'complete' && 'bg-success/10 text-success',
                    step.status === 'ready' && 'bg-surface text-foreground',
                    step.status === 'pending' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {step.status === 'active' ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : step.status === 'complete' ? (
                    <CheckCircle2 className="size-3" />
                  ) : step.status === 'ready' ? (
                    <FileCheck className="size-3" />
                  ) : (
                    <div className="size-1.5 rounded-full bg-muted-foreground" />
                  )}
                </div>

                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-body text-foreground">{step.label}</span>
                  <span className="text-caption text-muted-foreground">{step.description}</span>
                </div>
              </div>

              <Badge
                className="shrink-0 font-mono text-[9px] uppercase"
                variant={
                  step.status === 'active'
                    ? 'default'
                    : step.status === 'complete'
                      ? 'success'
                      : 'outline'
                }
              >
                {step.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
