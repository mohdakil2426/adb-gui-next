import { Activity, CheckCircle2, Clock, Loader2, Package, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

import type { InstallProgress } from "@/features/app-manager/debloater/model/installation-store";
import { Badge } from "@/shared/ui/badge";
import { Progress } from "@/shared/ui/progress";
import { formatDuration } from "@/shared/utils/format";

const PERCENT = 100;
const TICK_MS = 1000;

const useElapsedSeconds = (startedAt: number): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return Math.floor((now - startedAt) / TICK_MS);
};

interface InstallProgressCardProps {
  flagsCount?: number;
  progress: InstallProgress;
}

/**
 * Precision Hardware Cockpit Telemetry Monitor for active batch installation.
 * Accurately conveys in-flight socket streaming and package manager verification.
 */
export const InstallProgressCard = ({ flagsCount = 1, progress }: InstallProgressCardProps) => {
  const elapsed = useElapsedSeconds(progress.startedAt);
  const ratio = progress.total === 0 ? 0 : progress.completed / progress.total;
  const currentStep = Math.min(progress.completed + 1, progress.total);
  const percentage = Math.round(ratio * PERCENT);

  return (
    <output
      aria-live="polite"
      className="border-primary/40 bg-surface ring-primary/20 flex w-full flex-col gap-3 rounded-xl border p-4 shadow-sm ring-1"
    >
      {/* Top Banner: In-Flight Status & Live Clock */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="border-primary/30 bg-primary/10 text-primary relative flex size-7 items-center justify-center rounded-md border">
            <Loader2 aria-hidden="true" className="text-primary size-4 animate-spin" />
            <span className="bg-primary absolute -top-0.5 -right-0.5 size-2 animate-ping rounded-full" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-body text-foreground font-semibold">
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
        <div className="border-border bg-surface-raised text-foreground text-mono-sm flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono font-semibold">
          <Clock aria-hidden="true" className="text-muted-foreground size-3.5" />
          <span>{formatDuration(elapsed)} elapsed</span>
        </div>
      </div>

      {/* Determinate Progress Meter */}
      <div className="flex flex-col gap-1.5">
        <Progress className="h-2" value={percentage} />
        <div className="text-caption text-muted-foreground flex items-center justify-between">
          <span>
            {progress.completed} of {progress.total} packages installed
          </span>
          <span className="text-foreground font-mono font-medium">
            {progress.total - progress.completed} remaining
          </span>
        </div>
      </div>

      {/* Active In-Flight Package Spec Box */}
      {progress.currentFile ? (
        <div className="border-border bg-surface-raised/70 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Package aria-hidden="true" className="text-primary size-4 shrink-0" />
            <span className="text-foreground text-mono truncate font-mono font-bold">
              {progress.currentFile}
            </span>
          </div>
          <Badge className="h-4.5 shrink-0 px-1.5 font-mono text-[10px]" variant="outline">
            In Flight
          </Badge>
        </div>
      ) : null}

      {/* Telemetry Metrics Strip */}
      <div className="grid grid-cols-2 gap-2 pt-0.5 @lg:grid-cols-4">
        <div className="border-border/70 bg-surface-raised/40 flex flex-col rounded-md border p-2">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Completed
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-500" />
            <span className="numeric text-foreground text-mono-sm font-mono font-bold">
              {progress.completed} / {progress.total}
            </span>
          </div>
        </div>

        <div className="border-border/70 bg-surface-raised/40 flex flex-col rounded-md border p-2">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Elapsed Time
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <Clock aria-hidden="true" className="text-muted-foreground size-3.5" />
            <span className="numeric text-foreground text-mono-sm font-mono font-bold">
              {formatDuration(elapsed)}
            </span>
          </div>
        </div>

        <div className="border-border/70 bg-surface-raised/40 flex flex-col rounded-md border p-2">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Active Flags
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <Terminal aria-hidden="true" className="text-muted-foreground size-3.5" />
            <span className="numeric text-foreground text-mono-sm font-mono font-bold">
              {flagsCount} flag{flagsCount === 1 ? "" : "s"} active
            </span>
          </div>
        </div>

        <div className="border-border/70 bg-surface-raised/40 flex flex-col rounded-md border p-2">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Socket State
          </span>
          <div className="flex items-center gap-1 pt-0.5">
            <Activity aria-hidden="true" className="size-3.5 animate-pulse text-sky-500" />
            <span className="text-foreground text-mono-sm font-mono font-bold">Active Stream</span>
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
};
