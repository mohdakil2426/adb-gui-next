import { Activity, Layers, MemoryStick, Percent } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import type { backend } from "@/desktop/models";
import type { MemorySample } from "@/features/dashboard/model/memory-history-store";
import { TONE_TEXT, usageTone } from "@/features/dashboard/model/tone";
import type { Tone } from "@/features/dashboard/model/tone";
import { PanelCard } from "@/features/dashboard/ui/panel-card";
import { SpecChip } from "@/features/dashboard/ui/spec-chip";
import { UsageBar } from "@/features/dashboard/ui/usage-bar";
import { Gauge } from "@/shared/charts/gauge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatBytes, formatPercent, usageRatio } from "@/shared/utils/format";

/**
 * Recharts is ~100 kB of the initial bundle if imported statically, and the
 * sparkline is the only chart on this screen — so it is code-split behind
 * `React.lazy` and only fetched once enough samples exist.
 */
const MemorySparkline = lazy(async () => {
  const module = await import("@/features/dashboard/ui/memory-sparkline");
  return { default: module.MemorySparkline };
});

const TONE_CSS_COLOR: Record<Tone, string> = {
  danger: "var(--destructive)",
  neutral: "var(--chart-1)",
  ok: "var(--success)",
  warn: "var(--warning)",
};

interface MemoryPanelProps {
  isLoading: boolean;
  memory: backend.MemoryInfo | null;
  samples: MemorySample[];
}

export const MemoryPanel = ({ isLoading, memory, samples }: MemoryPanelProps) => {
  const ratio = usageRatio(memory?.usedBytes ?? 0, memory?.totalBytes ?? 0);
  const tone = usageTone(ratio);
  const hasMemory = Boolean(memory && memory.totalBytes > 0);
  // eslint-disable-next-line react/hook-use-state -- mount timestamp captured once as immutable state
  const [mountTime] = useState(() => Date.now());

  // Provide immediate baseline sample if memory is available but history has not accumulated yet
  const effectiveSamples = useMemo<MemorySample[]>(() => {
    if (samples.length > 0) {
      return samples;
    }
    if (hasMemory && memory) {
      return [
        {
          at: mountTime,
          totalBytes: memory.totalBytes,
          usedBytes: memory.usedBytes,
        },
      ];
    }
    return [];
  }, [samples, hasMemory, memory, mountTime]);

  return (
    <PanelCard delay={0.19} icon={MemoryStick} title="Memory">
      {isLoading && !hasMemory ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col justify-between gap-3">
          {hasMemory && memory ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="numeric text-display text-foreground font-semibold">
                  {formatPercent(ratio)}
                </span>
                <span className={cn("numeric text-label font-medium", TONE_TEXT[tone])}>
                  {formatBytes(memory.usedBytes)} of {formatBytes(memory.totalBytes)}
                </span>
              </div>
              <Gauge
                activeFill={TONE_CSS_COLOR[tone]}
                className="w-full"
                linearHeight={10}
                orientation="linear"
                totalNotches={32}
                value={Math.round(ratio * 100)}
              />
              <UsageBar label="Memory used" ratio={ratio} tone={tone} />
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              The device did not report /proc/meminfo.
            </p>
          )}

          {/* Session history waveform */}
          {hasMemory ? (
            <div className="border-border/50 flex flex-col gap-1 border-t pt-2">
              <div className="text-caption text-muted-foreground flex items-center justify-between font-medium tracking-wider uppercase">
                <span>Session history</span>
                <span className="numeric lowercase">
                  {effectiveSamples.length} {effectiveSamples.length === 1 ? "sample" : "samples"}
                </span>
              </div>
              <Suspense fallback={<Skeleton className="h-16 w-full rounded-md" />}>
                <MemorySparkline samples={effectiveSamples} />
              </Suspense>
            </div>
          ) : null}

          {hasMemory && memory ? (
            <div className="border-border/50 grid w-full grid-cols-2 gap-2 border-t pt-2">
              <SpecChip icon={Activity} label="Used" value={formatBytes(memory.usedBytes)} />
              <SpecChip
                icon={Layers}
                label="Available"
                value={formatBytes(memory.availableBytes)}
              />
              <SpecChip
                icon={Percent}
                label="Free"
                value={formatBytes(memory.totalBytes - memory.usedBytes)}
              />
              <SpecChip icon={MemoryStick} label="Total" value={formatBytes(memory.totalBytes)} />
            </div>
          ) : null}
        </div>
      )}
    </PanelCard>
  );
};
