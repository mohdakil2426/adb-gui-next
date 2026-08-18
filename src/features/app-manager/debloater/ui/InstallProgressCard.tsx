import { Activity, CheckCircle2, Clock, Loader2, Package, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InstallProgress } from '@/features/app-manager/debloater/model/installationStore';
import { Badge } from '@/shared/ui/badge';
import { Progress } from '@/shared/ui/progress';
import { formatDuration } from '@/shared/utils/format';

const PERCENT = 100;
const TICK_MS = 1000;

function useElapsedSeconds(startedAt: number): number {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / TICK_MS));

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startedAt) / TICK_MS));
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / TICK_MS));
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);

  return elapsed;
}

interface InstallProgressCardProps {
  flagsCount?: number;
  progress: InstallProgress;
}

/**
 * Precision Hardware Cockpit Telemetry Monitor for active batch installation.
 * Accurately conveys in-flight socket streaming and package manager verification.
 */
export function InstallProgressCard({ flagsCount = 1, progress }: InstallProgressCardProps) {
  const elapsed = useElapsedSeconds(progress.startedAt);
  const ratio = progress.total === 0 ? 0 : progress.completed / progress.total;
  const currentStep = Math.min(progress.completed + 1, progress.total);
  const percentage = Math.round(ratio * PERCENT);

  return (
    <output
      aria-live="polite"
      className="flex w-full flex-col gap-3 rounded-xl border border-primary/40 bg-surface p-4 shadow-sm ring-1 ring-primary/20"
    >
      {/* Top Banner: In-Flight Status & Live Clock */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
            <span className="absolute -top-0.5 -right-0.5 size-2 animate-ping rounded-full bg-primary" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-body text-foreground">
                Installing Package {currentStep} of {progress.total}
              </span>
              <Badge className="h-4.5 px-1.5 font-mono text-[10px]" variant="secondary">
                {percentage}%
              </Badge>
            </div>
            <span className="text-caption text-muted-foreground">
              Streaming binary over ADB socket & awaiting package verification
            </span>
          </div>
        </div>

        {/* Running Elapsed Clock Pill */}
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono font-semibold text-foreground text-mono-sm">
          <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <span>{formatDuration(elapsed)} elapsed</span>
        </div>
      </div>

      {/* Determinate Progress Meter */}
      <div className="flex flex-col gap-1.5">
        <Progress className="h-2" value={percentage} />
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>
            {progress.completed} of {progress.total} packages installed
          </span>
          <span className="font-medium font-mono text-foreground">
            {progress.total - progress.completed} remaining
          </span>
        </div>
      </div>

      {/* Active In-Flight Package Spec Box */}
      {progress.currentFile ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised/70 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Package aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="truncate font-bold font-mono text-foreground text-mono">
              {progress.currentFile}
            </span>
          </div>
          <Badge className="h-4.5 shrink-0 px-1.5 font-mono text-[10px]" variant="outline">
            In Flight
          </Badge>
        </div>
      ) : null}

      {/* Telemetry Metrics Strip */}
      <div className="grid @lg:grid-cols-4 grid-cols-2 gap-2 pt-0.5">
        <div className="flex flex-col rounded-md border border-border/70 bg-surface-raised/40 p-2">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Completed
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-500" />
            <span className="numeric font-bold font-mono text-foreground text-mono-sm">
              {progress.completed} / {progress.total}
            </span>
          </div>
        </div>

        <div className="flex flex-col rounded-md border border-border/70 bg-surface-raised/40 p-2">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Elapsed Time
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <Clock aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="numeric font-bold font-mono text-foreground text-mono-sm">
              {formatDuration(elapsed)}
            </span>
          </div>
        </div>

        <div className="flex flex-col rounded-md border border-border/70 bg-surface-raised/40 p-2">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Active Flags
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <Terminal aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <span className="numeric font-bold font-mono text-foreground text-mono-sm">
              {flagsCount} flag{flagsCount === 1 ? '' : 's'} active
            </span>
          </div>
        </div>

        <div className="flex flex-col rounded-md border border-border/70 bg-surface-raised/40 p-2">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Socket State
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <Activity aria-hidden="true" className="size-3.5 animate-pulse text-sky-500" />
            <span className="font-bold font-mono text-foreground text-mono-sm">Active Stream</span>
          </div>
        </div>
      </div>

      {/* Honest ADB Communication Note */}
      <span className="text-caption text-muted-foreground leading-relaxed">
        Android Package Manager streams the entire binary over USB/Wi-Fi and runs on-device DEX
        optimization and signature checks before yielding a return status.
      </span>
    </output>
  );
}
