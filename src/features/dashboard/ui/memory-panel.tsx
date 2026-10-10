import { Activity, Layers, MemoryStick, Percent } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import type { backend } from "@/desktop/models";
import type { MemorySample } from "@/features/dashboard/model/memory-history-store";
import { usageTone } from "@/features/dashboard/model/tone";
import type { Tone } from "@/features/dashboard/model/tone";
import { PanelCard } from "@/features/dashboard/ui/panel-card";
import { SpecChip } from "@/features/dashboard/ui/spec-chip";
import { Ring } from "@/shared/charts/ring";
import { RingCenter } from "@/shared/charts/ring-center";
import { RingChart } from "@/shared/charts/ring-chart";
import type { RingData } from "@/shared/charts/ring-context";
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

const TONE_BG_CLASS: Record<Tone, string> = {
  danger: "bg-destructive",
  neutral: "bg-chart-1",
  ok: "bg-success",
  warn: "bg-warning",
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
  const ringData: RingData[] = useMemo(() => {
    if (!memory || memory.totalBytes <= 0) {
      return [];
    }

    const data: RingData[] = [
      {
        color: TONE_CSS_COLOR[tone],
        label: "Used RAM",
        maxValue: memory.totalBytes,
        value: memory.usedBytes,
      },
    ];

    if (memory.availableBytes > 0) {
      data.push({
        color: "var(--chart-2)",
        label: "Available RAM",
        maxValue: memory.totalBytes,
        value: memory.availableBytes,
      });
    }

    return data;
  }, [memory, tone]);

  return (
    <PanelCard delay={0.19} icon={MemoryStick} title="Memory">
      {isLoading && !hasMemory ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <Skeleton className="size-[210px] rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col justify-between gap-3">
          {hasMemory && memory ? (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <RingChart
                baseInnerRadius={68}
                data={ringData}
                ringGap={6}
                size={210}
                strokeWidth={12}
              >
                {ringData.map((_, index) => (
                  <Ring index={index} key={ringData[index]?.label ?? index} lineCap="round" />
                ))}
                <RingCenter defaultLabel="Used">
                  {({ value, label, isHovered }) => (
                    <div className="flex flex-col items-center justify-center px-1 text-center">
                      <span className="numeric text-display text-foreground font-bold tracking-tight">
                        {isHovered ? formatBytes(value) : formatPercent(ratio)}
                      </span>
                      <span className="text-caption text-muted-foreground font-medium">
                        {isHovered
                          ? label
                          : `${formatBytes(memory.usedBytes)} of ${formatBytes(memory.totalBytes)}`}
                      </span>
                    </div>
                  )}
                </RingCenter>
              </RingChart>

              {/* Ring chart legend */}
              <div className="text-caption flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={cn("size-2 rounded-full", TONE_BG_CLASS[tone])}
                  />
                  <span className="text-muted-foreground">Used:</span>
                  <span className="text-foreground font-medium">
                    {formatBytes(memory.usedBytes)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="bg-chart-2 size-2 rounded-full" />
                  <span className="text-muted-foreground">Available:</span>
                  <span className="text-foreground font-medium">
                    {formatBytes(memory.availableBytes)}
                  </span>
                </div>
              </div>
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
