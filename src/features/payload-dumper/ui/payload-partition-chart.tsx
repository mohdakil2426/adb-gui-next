import { BarChart3, PieChart } from "lucide-react";
import { useMemo, useState } from "react";

import { Ring } from "@/shared/charts/ring";
import { RingCenter } from "@/shared/charts/ring-center";
import { RingChart } from "@/shared/charts/ring-chart";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "@/shared/utils/format";

const RING_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const RING_DOT_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export interface PartitionItem {
  name: string;
  size: number;
}

export interface PayloadPartitionChartProps {
  className?: string;
  partitions: PartitionItem[];
}

export const PayloadPartitionChart = ({ partitions, className }: PayloadPartitionChartProps) => {
  const [chartType, setChartType] = useState<"bar" | "ring">("bar");

  const totalBytes = useMemo(() => partitions.reduce((sum, p) => sum + p.size, 0), [partitions]);

  const sortedPartitions = useMemo(
    () => partitions.filter((p) => p.size > 0).toSorted((a, b) => b.size - a.size),
    [partitions]
  );

  const topPartitions = useMemo(() => sortedPartitions.slice(0, 6), [sortedPartitions]);

  const barChartData = useMemo(() => {
    if (sortedPartitions.length === 0) {
      return [];
    }
    const top = sortedPartitions.slice(0, 8);
    const others = sortedPartitions.slice(8);
    const otherTotal = others.reduce((acc, p) => acc + p.size, 0);

    const data: Record<string, unknown>[] = top.map((p) => ({
      formattedSize: formatBytes(p.size),
      name: p.name,
      sizeMb: Math.round((p.size / (1024 * 1024)) * 10) / 10,
    }));

    if (otherTotal > 0) {
      data.push({
        formattedSize: formatBytes(otherTotal),
        name: `other (${others.length})`,
        sizeMb: Math.round((otherTotal / (1024 * 1024)) * 10) / 10,
      });
    }

    return data;
  }, [sortedPartitions]);

  const ringChartData = useMemo(() => {
    if (topPartitions.length === 0) {
      return [];
    }
    return topPartitions.map((p, idx) => ({
      color: RING_PALETTE[idx % RING_PALETTE.length],
      label: p.name,
      maxValue: totalBytes || 1,
      value: p.size,
    }));
  }, [topPartitions, totalBytes]);

  if (sortedPartitions.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-border bg-surface rounded-xl shadow-none", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <BarChart3 aria-hidden="true" className="text-primary size-4 shrink-0" />
            <CardTitle className="text-body text-foreground font-semibold">
              Partition Allocation
            </CardTitle>
            <Badge className="text-caption font-mono" variant="secondary">
              {partitions.length} partitions
            </Badge>
          </div>
          <p className="text-caption text-muted-foreground">
            Total image size:{" "}
            <span className="text-foreground font-medium">{formatBytes(totalBytes)}</span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            aria-label="Bar chart view"
            aria-pressed={chartType === "bar"}
            className="text-caption h-7 px-2.5"
            onClick={() => setChartType("bar")}
            size="sm"
            variant={chartType === "bar" ? "secondary" : "ghost"}
          >
            <BarChart3 aria-hidden="true" className="mr-1.5 size-3.5" data-icon="inline-start" />
            Bars
          </Button>
          <Button
            aria-label="Ring chart view"
            aria-pressed={chartType === "ring"}
            className="text-caption h-7 px-2.5"
            onClick={() => setChartType("ring")}
            size="sm"
            variant={chartType === "ring" ? "secondary" : "ghost"}
          >
            <PieChart aria-hidden="true" className="mr-1.5 size-3.5" data-icon="inline-start" />
            Rings
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {chartType === "bar" ? (
          <div className="flex flex-col gap-2 py-1">
            {barChartData.map((d) => {
              const maxMb = Number(barChartData[0]?.sizeMb || 1);
              const pct = Math.min(100, Math.max(3, (Number(d.sizeMb) / maxMb) * 100));
              return (
                <div className="flex flex-col gap-1" key={String(d.name)}>
                  <div className="text-caption flex items-center justify-between font-mono">
                    <span className="text-foreground font-medium">{String(d.name)}</span>
                    <span className="text-muted-foreground">{String(d.formattedSize)}</span>
                  </div>
                  <div className="bg-secondary/60 h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full w-(--progress-pct) rounded-full transition-all duration-300"
                      style={{ "--progress-pct": `${pct}%` } as React.CSSProperties}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-around gap-4 py-2 @sm:flex-row">
            <RingChart
              baseInnerRadius={32}
              data={ringChartData}
              ringGap={4}
              size={170}
              strokeWidth={8}
            >
              {ringChartData.map((_, i) => (
                <Ring index={i} key={topPartitions[i]?.name ?? i} lineCap="round" />
              ))}
              <RingCenter>
                {({ label }) => (
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="text-body text-foreground font-bold tabular-nums">
                      {formatBytes(totalBytes)}
                    </span>
                    <span className="text-caption text-muted-foreground">{label}</span>
                  </div>
                )}
              </RingCenter>
            </RingChart>

            <div className="flex min-w-[200px] flex-col gap-1.5">
              {topPartitions.map((p, idx) => {
                const dotClass = RING_DOT_CLASSES[idx % RING_DOT_CLASSES.length];
                const percent = totalBytes > 0 ? ((p.size / totalBytes) * 100).toFixed(1) : "0";
                return (
                  <div
                    className="text-caption flex items-center justify-between gap-3"
                    key={p.name}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        aria-hidden="true"
                        className={cn("size-2 shrink-0 rounded-full", dotClass)}
                      />
                      <span className="text-foreground truncate font-mono font-medium">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">{percent}%</span>
                      <span className="text-foreground font-medium">{formatBytes(p.size)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Partition Badges */}
        <div className="border-border/40 text-caption flex flex-wrap items-center gap-1.5 border-t pt-2.5">
          <span className="text-muted-foreground mr-1 font-medium">Top allocations:</span>
          {topPartitions.map((p) => (
            <Badge
              className="text-caption gap-1 px-2 py-0.5 font-mono"
              key={p.name}
              variant="secondary"
            >
              <span>{p.name}</span>
              <span className="text-muted-foreground">{formatBytes(p.size)}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
