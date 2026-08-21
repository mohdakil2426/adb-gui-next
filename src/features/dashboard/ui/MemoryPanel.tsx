import { m, useReducedMotion } from 'framer-motion';
import { Activity, CheckCircle2, Cpu, Layers, MemoryStick } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { backend } from '@/desktop/models';
import type { MemorySample } from '@/features/dashboard/model/memoryHistoryStore';
import { TONE_TEXT, usageTone } from '@/features/dashboard/model/tone';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { UsageBar } from '@/features/dashboard/ui/UsageBar';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatPercent, usageRatio } from '@/shared/utils/format';

/**
 * Recharts is ~100 kB of the initial bundle if imported statically, and the
 * sparkline is the only chart on this screen — so it is code-split behind
 * `React.lazy` and only fetched once enough samples exist.
 */
const MemorySparkline = lazy(() =>
  import('@/features/dashboard/ui/MemorySparkline').then((module) => ({
    default: module.MemorySparkline,
  })),
);

const MIN_SPARKLINE_SAMPLES = 1;
interface MemoryPanelProps {
  isLoading: boolean;
  memory: backend.MemoryInfo | null;
  samples: MemorySample[];
}

export function MemoryPanel({ isLoading, memory, samples }: MemoryPanelProps) {
  const ratio = usageRatio(memory?.usedBytes ?? 0, memory?.totalBytes ?? 0);
  const tone = usageTone(ratio);
  const hasMemory = Boolean(memory && memory.totalBytes > 0);
  const shouldReduceMotion = useReducedMotion();

  // Provide immediate baseline sample if memory is available but history has not accumulated yet
  const effectiveSamples: MemorySample[] =
    samples.length > 0
      ? samples
      : hasMemory && memory
        ? [{ at: Date.now(), totalBytes: memory.totalBytes, usedBytes: memory.usedBytes }]
        : [];

  const containerVariants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion ? { duration: 0 } : { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.2, ease: [0.2, 0, 0, 1] as const },
    },
  };

  return (
    <PanelCard icon={MemoryStick} title="Memory">
      {isLoading && !hasMemory ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <m.div
          animate="visible"
          className="flex w-full flex-1 flex-col justify-between gap-3"
          initial="hidden"
          variants={containerVariants}
        >
          <div className="flex flex-col gap-2">
            {hasMemory && memory ? (
              <m.div className="flex flex-col gap-1.5" variants={itemVariants}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="numeric font-medium text-body text-muted-foreground">
                    {formatBytes(memory.usedBytes)} of {formatBytes(memory.totalBytes)}
                  </span>
                  <m.span
                    animate={{ opacity: 1 }}
                    className={cn('numeric font-semibold text-label', TONE_TEXT[tone])}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    key={ratio}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                  >
                    {formatPercent(ratio)}
                  </m.span>
                </div>
                <UsageBar label="Memory used" ratio={ratio} tone={tone} />
              </m.div>
            ) : (
              <m.p className="text-body text-muted-foreground" variants={itemVariants}>
                The device did not report /proc/meminfo.
              </m.p>
            )}

            {/* Memory History Sparkline */}
            <m.div
              className="flex flex-col gap-1 border-border/50 border-t pt-1.5"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                <span>Memory History</span>
                <span className="numeric font-mono text-[10px] text-muted-foreground lowercase">
                  {formatPercent(ratio)}
                </span>
              </div>
              {effectiveSamples.length >= MIN_SPARKLINE_SAMPLES ? (
                <Suspense fallback={<Skeleton className="h-9 w-full rounded-md" />}>
                  <MemorySparkline samples={effectiveSamples} />
                </Suspense>
              ) : (
                <div className="flex h-9 items-center justify-center rounded-md border border-border/40 bg-surface-raised/20 text-caption text-muted-foreground">
                  Collecting telemetry samples…
                </div>
              )}
            </m.div>
          </div>

          {/* 2x2 Micro-Metrics Chip Grid (Matches BatteryPanel & StoragePanel) */}
          {hasMemory && memory ? (
            <m.div
              className="grid w-full grid-cols-2 gap-2 border-border/50 border-t pt-2"
              variants={itemVariants}
            >
              {/* Used Memory Chip */}
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
                <Activity className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">
                    Used
                  </span>
                  <span className="truncate font-medium font-mono text-[11px] text-foreground">
                    {formatBytes(memory.usedBytes)}
                  </span>
                </div>
              </div>

              {/* Available Memory Chip */}
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
                <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">
                    Available
                  </span>
                  <span className="truncate font-medium font-mono text-[11px] text-foreground">
                    {formatBytes(memory.availableBytes)}
                  </span>
                </div>
              </div>

              {/* Free Memory Chip */}
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
                <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">
                    Free
                  </span>
                  <span className="truncate font-medium font-mono text-[11px] text-foreground">
                    {formatBytes(memory.totalBytes - memory.usedBytes)}
                  </span>
                </div>
              </div>

              {/* Total Memory Chip */}
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
                <Cpu className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">
                    Total
                  </span>
                  <span className="truncate font-medium font-mono text-[11px] text-foreground">
                    {formatBytes(memory.totalBytes)}
                  </span>
                </div>
              </div>
            </m.div>
          ) : null}
        </m.div>
      )}
    </PanelCard>
  );
}
