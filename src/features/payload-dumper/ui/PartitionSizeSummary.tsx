import { BarChart3 } from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import {
  MAX_CHART_PARTITIONS,
  type PartitionSizeDatum,
} from '@/features/payload-dumper/ui/partitionSizeData';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatBytes } from '@/shared/utils/format';

/**
 * Code-split so Recharts stays out of the Payload Dumper's chunk. The chart is
 * only worth fetching once a payload has actually been parsed.
 */
const PartitionSizeChart = lazy(() =>
  import('@/features/payload-dumper/ui/PartitionSizeChart').then((module) => ({
    default: module.PartitionSizeChart,
  })),
);

/** Two bars is a comparison; one is just a number with extra steps. */
const MIN_CHART_PARTITIONS = 2;

interface PartitionSizeSummaryProps {
  completedPartitions: Set<string>;
  partitions: { name: string; size: number }[];
}

/**
 * What dominates this extraction.
 *
 * A partition list sorted by name buries the fact that `super` or `system` is
 * 90% of the download; a length-sorted bar makes it the first thing read. Bars
 * for already-written partitions switch to the second chart colour, so progress
 * across a multi-pass extraction is legible at a glance.
 */
export function PartitionSizeSummary({
  completedPartitions,
  partitions,
}: PartitionSizeSummaryProps) {
  const data = useMemo<PartitionSizeDatum[]>(
    () =>
      [...partitions]
        .sort((a, b) => b.size - a.size)
        .slice(0, MAX_CHART_PARTITIONS)
        .map((partition) => ({
          extracted: completedPartitions.has(partition.name),
          name: partition.name,
          size: partition.size,
        })),
    [completedPartitions, partitions],
  );

  if (data.length < MIN_CHART_PARTITIONS) {
    return null;
  }

  const largest = data[0];

  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-caption text-muted-foreground uppercase tracking-wide">
          <BarChart3 aria-hidden="true" className="size-3.5" />
          Largest partitions
        </h3>
        {largest ? (
          <span className="numeric text-caption text-muted-foreground">
            {largest.name} · {formatBytes(largest.size)}
          </span>
        ) : null}
      </header>
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <PartitionSizeChart data={data} />
      </Suspense>
    </section>
  );
}
