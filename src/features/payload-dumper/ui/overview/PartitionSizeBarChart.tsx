import { CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  CATEGORY_COLORS,
  getPartitionCategory,
} from '@/features/payload-dumper/utils/partitionCategories';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes, formatPercent } from '@/shared/utils/format';

interface PartitionItem {
  name: string;
  size: number;
}

interface PartitionSizeBarChartProps {
  completedPartitions?: Set<string>;
  partitions: PartitionItem[];
}

export function PartitionSizeBarChart({
  partitions,
  completedPartitions = new Set(),
}: PartitionSizeBarChartProps) {
  const { topPartitions, totalPayloadSize, peakSize } = useMemo(() => {
    const sorted = [...partitions].sort((a, b) => b.size - a.size);
    const top = sorted.slice(0, 10);
    const peak = top[0]?.size ?? 0;
    const total = partitions.reduce((sum, p) => sum + p.size, 0);
    return { peakSize: peak, topPartitions: top, totalPayloadSize: total };
  }, [partitions]);

  return (
    <Card className="flex flex-col justify-between rounded-lg border-border bg-surface p-4 shadow-none">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="font-semibold text-foreground text-title">Top 10 Largest Partitions</h3>
          <p className="text-caption text-muted-foreground">
            Ranked by uncompressed block storage footprint
          </p>
        </div>
        <Badge className="text-caption" variant="secondary">
          {totalPayloadSize > 0 ? formatBytes(totalPayloadSize) : '0 B'} Total
        </Badge>
      </div>

      <CardContent className="flex flex-1 flex-col justify-center p-0 pt-2">
        {topPartitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-caption text-muted-foreground">
              No partitions available. Load a payload to inspect partition capacities.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {topPartitions.map((part, index) => {
              const percentOfPeak = peakSize > 0 ? (part.size / peakSize) * 100 : 0;
              const percentOfTotal =
                totalPayloadSize > 0 ? (part.size / totalPayloadSize) * 100 : 0;
              const isExtracted = completedPartitions.has(part.name);
              const category = getPartitionCategory(part.name);
              const barColor = CATEGORY_COLORS[category];

              return (
                <div
                  className="flex flex-col gap-1 rounded-md border border-border/40 bg-surface-raised/30 p-1.5 px-2 transition-colors hover:bg-surface-raised/70"
                  key={part.name}
                  title={`${part.name}: ${formatBytes(part.size)} (${formatPercent(percentOfTotal / 100, { fractionDigits: 1 })} of total)`}
                >
                  <div className="flex items-center justify-between text-body">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-4 font-mono text-[10px] text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="truncate font-medium font-mono text-foreground text-mono-sm">
                        {part.name}
                      </span>
                      {isExtracted ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-success">
                          <CheckCircle2 className="size-3" /> Extracted
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-medium text-caption text-foreground">
                        {formatBytes(part.size)}
                      </span>
                      <span className="w-11 text-right font-mono text-[11px] text-muted-foreground">
                        {formatPercent(percentOfTotal / 100, { fractionDigits: 1 })}
                      </span>
                    </div>
                  </div>

                  {/* Visual SVG bar gauge */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        backgroundColor: barColor,
                        width: `${Math.max(2, percentOfPeak)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
