import { useMemo } from 'react';
import {
  CATEGORY_COLORS,
  CATEGORY_DOT_CLASSES,
  CATEGORY_LABELS,
  getPartitionCategory,
  type PartitionCategory,
} from '@/features/payload-dumper/utils/partitionCategories';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes, formatPercent } from '@/shared/utils/format';

interface PartitionItem {
  name: string;
  size: number;
}

interface PayloadCompositionDonutProps {
  partitions: PartitionItem[];
}

const SIZE = 130;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

export function PayloadCompositionDonut({ partitions }: PayloadCompositionDonutProps) {
  const { slices, totalBytes, totalCount } = useMemo(() => {
    const counts: Record<PartitionCategory, { count: number; size: number }> = {
      boot: { count: 0, size: 0 },
      modem: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
      system: { count: 0, size: 0 },
    };

    let totalS = 0;
    for (const p of partitions) {
      const cat = getPartitionCategory(p.name);
      counts[cat].count++;
      counts[cat].size += p.size;
      totalS += p.size;
    }

    const categories: PartitionCategory[] = ['boot', 'system', 'modem', 'other'];
    const activeSlices = categories
      .map((cat) => ({
        category: cat,
        color: CATEGORY_COLORS[cat],
        count: counts[cat].count,
        dotClass: CATEGORY_DOT_CLASSES[cat],
        label: CATEGORY_LABELS[cat],
        size: counts[cat].size,
      }))
      .filter((s) => s.count > 0);

    return {
      slices: activeSlices,
      totalBytes: totalS,
      totalCount: partitions.length,
    };
  }, [partitions]);

  const showGap = slices.length > 1;
  let offset = 0;

  return (
    <Card className="flex flex-col justify-between rounded-lg border-border bg-surface p-4 shadow-none">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="font-semibold text-foreground text-title">Payload Partition Breakdown</h3>
          <p className="text-caption text-muted-foreground">
            Distribution by functional subsystem & architecture layer
          </p>
        </div>
        <span className="numeric font-medium text-caption text-muted-foreground">
          {totalCount} partitions
        </span>
      </div>

      <CardContent className="flex flex-1 flex-col justify-center p-0 pt-2">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="relative flex size-28 items-center justify-center">
              <svg
                aria-label="Standby payload donut chart"
                className="size-full rotate-[-90deg]"
                viewBox={`0 0 ${SIZE} ${SIZE}`}
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  fill="none"
                  r={RADIUS}
                  stroke="var(--border)"
                  strokeWidth={STROKE}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-semibold text-caption text-muted-foreground">Standby</span>
              </div>
            </div>
            <p className="mt-2 text-caption text-muted-foreground">
              Load a payload to inspect functional partition layers
            </p>
          </div>
        ) : (
          <div className="flex @lg:flex-row flex-col items-center gap-5">
            {/* Pure SVG Donut visualizer */}
            <div className="relative flex size-32 shrink-0 items-center justify-center">
              <svg
                aria-label={`Payload composition chart: ${totalCount} partitions`}
                className="size-full rotate-[-90deg]"
                role="img"
                viewBox={`0 0 ${SIZE} ${SIZE}`}
              >
                {slices.map((slice) => {
                  const fraction =
                    totalBytes > 0 ? slice.size / totalBytes : slice.count / totalCount;
                  const length = fraction * CIRCUMFERENCE;
                  const dash = showGap ? Math.max(0, length - GAP) : length;
                  const circle = (
                    <circle
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      fill="none"
                      key={slice.category}
                      r={RADIUS}
                      stroke={slice.color}
                      strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                      strokeDashoffset={-offset}
                      strokeWidth={STROKE}
                    />
                  );
                  offset += length;
                  return circle;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="numeric font-semibold text-foreground text-title">
                  {totalCount}
                </span>
                <span className="text-caption text-muted-foreground">parts</span>
              </div>
            </div>

            {/* Subsystem Metric Legend */}
            <div className="flex w-full flex-1 flex-col justify-center gap-2">
              {slices.map((slice) => {
                const percent = totalBytes > 0 ? (slice.size / totalBytes) * 100 : 0;
                return (
                  <div
                    className="flex items-center justify-between gap-2 text-body"
                    key={slice.category}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`size-2.5 shrink-0 rounded-full ${slice.dotClass}`}
                      />
                      <span className="truncate text-muted-foreground">{slice.label}</span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                      <span className="font-medium text-foreground">{slice.count}</span>
                      <span className="text-caption text-muted-foreground">
                        ({formatBytes(slice.size)})
                      </span>
                      <span className="w-10 text-right font-mono text-caption text-muted-foreground">
                        {formatPercent(percent / 100, { fractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
