import { MemoryStick } from 'lucide-react';
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

/**
 * Two points draw a straight wedge between them, not a trend — the first
 * segment always looks dramatic regardless of what the device is actually
 * doing. Three points is the floor for a shape that says anything honest.
 */
const MIN_SPARKLINE_SAMPLES = 3;

interface MemoryPanelProps {
  isLoading: boolean;
  memory: backend.MemoryInfo | null;
  samples: MemorySample[];
}

export function MemoryPanel({ isLoading, memory, samples }: MemoryPanelProps) {
  const ratio = usageRatio(memory?.usedBytes ?? 0, memory?.totalBytes ?? 0);
  const tone = usageTone(ratio);
  const hasMemory = Boolean(memory && memory.totalBytes > 0);

  return (
    <PanelCard icon={MemoryStick} title="Memory">
      {isLoading && !hasMemory ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {hasMemory && memory ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="numeric font-medium text-body text-muted-foreground">
                  {formatBytes(memory.usedBytes)} of {formatBytes(memory.totalBytes)}
                </span>
                <span className={cn('numeric font-semibold text-label', TONE_TEXT[tone])}>
                  {formatPercent(ratio)}
                </span>
              </div>
              <UsageBar label="Memory used" ratio={ratio} tone={tone} />
              <div className="flex items-center justify-between pt-0.5 text-caption text-muted-foreground">
                <span>{formatBytes(memory.availableBytes)} available</span>
                <span>{formatBytes(memory.totalBytes - memory.usedBytes)} free</span>
              </div>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              The device did not report /proc/meminfo.
            </p>
          )}

          <div className="flex flex-col gap-1.5 border-border/50 border-t pt-1">
            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
              Memory History
            </span>
            {samples.length >= MIN_SPARKLINE_SAMPLES ? (
              <Suspense fallback={<Skeleton className="h-16 w-full" />}>
                <MemorySparkline samples={samples} />
              </Suspense>
            ) : (
              <p className="flex h-16 items-center text-caption text-muted-foreground">
                Collecting telemetry samples across refreshes…
              </p>
            )}
          </div>
        </div>
      )}
    </PanelCard>
  );
}
