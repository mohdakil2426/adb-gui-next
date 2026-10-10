import { GitBranch, Layers, Package, Store } from "lucide-react";
import { useEffect, useState } from "react";

import { MarketplaceGetOverviewStats } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { cn } from "@/shared/utils/cn";
import { formatPercent, usageRatio } from "@/shared/utils/format";

interface SourceCompositionDonutProps {
  communityCount?: number;
  fdroidCount?: number;
  githubCount?: number;
  totalCatalogCount?: number;
}

const SIZE = 128;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

export const SourceCompositionDonut = (props: SourceCompositionDonutProps) => {
  const [stats, setStats] = useState<backend.MarketplaceOverviewStats | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const data = await MarketplaceGetOverviewStats();
        if (!cancelled && data) {
          setStats(data);
        }
      } catch {
        // Stats are optional, fallback defaults will be used
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const fdroidCount = props.fdroidCount ?? stats?.fdroidCount ?? 4820;
  const githubCount = props.githubCount ?? stats?.githubCount ?? 6140;
  const communityCount = props.communityCount ?? stats?.communityCount ?? 3240;
  const totalCatalogCount = props.totalCatalogCount ?? stats?.totalApps ?? stats?.totalAppsCount;

  const slices = [
    {
      barClass: "bg-chart-1",
      color: "var(--chart-1)",
      count: githubCount,
      icon: GitBranch,
      iconBg: "bg-chart-1/10 text-chart-1",
      key: "github",
      label: "GitHub Releases",
    },
    {
      barClass: "bg-chart-2",
      color: "var(--chart-2)",
      count: fdroidCount,
      icon: Package,
      iconBg: "bg-chart-2/10 text-chart-2",
      key: "fdroid",
      label: "F-Droid Index",
    },
    {
      barClass: "bg-chart-3",
      color: "var(--chart-3)",
      count: communityCount,
      icon: Store,
      iconBg: "bg-chart-3/10 text-chart-3",
      key: "community",
      label: "Izzy / Community",
    },
  ].filter((s) => s.count > 0);

  const total = slices.reduce((sum, s) => sum + s.count, 0) || totalCatalogCount || 1;
  const activeSlice = slices.find((s) => s.key === activeKey) ?? null;
  const showGap = slices.length > 1;
  let offset = 0;

  return (
    <div className="border-border bg-surface flex h-full flex-col justify-between gap-3.5 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="text-primary size-4" />
          <h3 className="text-body text-foreground font-semibold">Source Composition</h3>
        </div>
        <span className="numeric text-caption text-muted-foreground font-mono">
          {total.toLocaleString()} total apps
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row">
        {/* Centered Interactive SVG Donut */}
        <div
          className="relative size-(--donut-size) shrink-0"
          style={{ "--donut-size": `${SIZE}px` } as React.CSSProperties}
        >
          <svg
            aria-label="Source repository composition chart"
            className="size-full -rotate-90"
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              fill="none"
              r={RADIUS}
              stroke="var(--border)"
              strokeWidth={STROKE}
            />
            {slices.map((slice) => {
              const ratio = usageRatio(slice.count, total);
              const arcLength = ratio * CIRCUMFERENCE;
              const dashLength = Math.max(0, arcLength - (showGap ? GAP : 0));
              const currentOffset = offset;
              offset += arcLength;
              const isDimmed = activeKey !== null && activeKey !== slice.key;

              return (
                <circle
                  // oxlint-disable-next-line shadcn/no-arbitrary-values -- SVG donut segments animate stroke-dasharray, stroke-dashoffset, and opacity
                  className="cursor-pointer transition-[stroke-dasharray,stroke-dashoffset,opacity,stroke-width] duration-200 ease-out"
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  fill="none"
                  key={slice.key}
                  onPointerEnter={() => setActiveKey(slice.key)}
                  onPointerLeave={() => setActiveKey(null)}
                  opacity={isDimmed ? 0.3 : 1}
                  r={RADIUS}
                  stroke={slice.color}
                  strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
                  strokeDashoffset={-currentOffset}
                  strokeWidth={activeKey === slice.key ? STROKE + 2 : STROKE}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {activeSlice ? (
              <>
                <span className="numeric text-foreground text-title leading-none font-bold">
                  {formatPercent(usageRatio(activeSlice.count, total))}
                </span>
                <span className="text-muted-foreground text-caption mt-1 max-w-20 truncate font-medium">
                  {activeSlice.label.split(" ")[0]}
                </span>
              </>
            ) : (
              <>
                <span className="numeric text-foreground text-title leading-none font-bold">
                  {slices.length}
                </span>
                <span className="text-muted-foreground text-caption mt-1 font-mono tracking-wider uppercase">
                  Sources
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend with Metrics */}
        <div className="flex h-full w-full flex-1 flex-col justify-between gap-2">
          {slices.map((slice) => {
            const Icon = slice.icon;
            const ratio = usageRatio(slice.count, total);
            const pct = formatPercent(ratio);
            const isHovered = activeKey === slice.key;

            return (
              <div
                className={cn(
                  "flex flex-1 cursor-pointer flex-col justify-center gap-1.5 rounded-md border px-2.5 py-2 transition-colors",
                  isHovered
                    ? "border-border bg-surface-raised"
                    : "border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised"
                )}
                key={slice.key}
                onPointerEnter={() => setActiveKey(slice.key)}
                onPointerLeave={() => setActiveKey(null)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded",
                        slice.iconBg
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <span className="text-caption text-foreground truncate font-medium">
                      {slice.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="numeric text-caption text-muted-foreground font-mono">
                      {slice.count.toLocaleString()}
                    </span>
                    <span className="numeric text-caption text-foreground bg-surface border-border/40 rounded border px-1.5 py-0.5 font-mono font-bold">
                      {pct}
                    </span>
                  </div>
                </div>
                <div className="bg-secondary h-1 w-full overflow-hidden rounded-full">
                  <div
                    className={cn("h-full w-(--bar-width) rounded-full", slice.barClass)}
                    style={{ "--bar-width": `${ratio * 100}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
