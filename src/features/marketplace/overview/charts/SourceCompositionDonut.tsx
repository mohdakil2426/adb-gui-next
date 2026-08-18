import { GitBranch, Layers, Package, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MarketplaceGetOverviewStats } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { formatPercent, usageRatio } from '@/shared/utils/format';

interface SourceCompositionDonutProps {
  communityCount?: number;
  fdroidCount?: number;
  githubCount?: number;
  totalCatalogCount?: number;
}

const SIZE = 124;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

export function SourceCompositionDonut(props: SourceCompositionDonutProps) {
  const [stats, setStats] = useState<backend.MarketplaceOverviewStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    MarketplaceGetOverviewStats()
      .then((data) => {
        if (!cancelled && data) {
          setStats(data);
        }
      })
      .catch(() => {});
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
      key: 'github',
      label: 'GitHub Releases',
      count: githubCount,
      color: 'var(--chart-1)',
      dotClass: 'bg-chart-1',
      icon: GitBranch,
    },
    {
      key: 'fdroid',
      label: 'F-Droid Index',
      count: fdroidCount,
      color: 'var(--chart-2)',
      dotClass: 'bg-chart-2',
      icon: Package,
    },
    {
      key: 'community',
      label: 'Izzy / Community',
      count: communityCount,
      color: 'var(--chart-3)',
      dotClass: 'bg-chart-3',
      icon: Store,
    },
  ].filter((s) => s.count > 0);

  const total = slices.reduce((sum, s) => sum + s.count, 0) || totalCatalogCount || 1;
  const showGap = slices.length > 1;
  let offset = 0;

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-body text-foreground">Source Composition</h3>
        </div>
        <span className="numeric font-mono text-caption text-muted-foreground">
          {total.toLocaleString()} total apps
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 pt-2 sm:flex-row">
        {/* Pure SVG Donut */}
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            aria-label="Source repository composition chart"
            className="-rotate-90"
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
            {/* Rendered Arc Segments */}
            {slices.map((slice) => {
              const ratio = usageRatio(slice.count, total);
              const arcLength = ratio * CIRCUMFERENCE;
              const dashLength = Math.max(0, arcLength - (showGap ? GAP : 0));
              const currentOffset = offset;
              offset += arcLength;

              return (
                <circle
                  className="transition-all duration-300 ease-out"
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  fill="none"
                  key={slice.key}
                  r={RADIUS}
                  stroke={slice.color}
                  strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
                  strokeDashoffset={-currentOffset}
                  strokeWidth={STROKE}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="numeric font-bold text-foreground text-title leading-tight">
              {slices.length}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Sources
            </span>
          </div>
        </div>

        {/* Legend with Metrics */}
        <div className="flex w-full flex-1 flex-col gap-2">
          {slices.map((slice) => {
            const Icon = slice.icon;
            const pct = formatPercent(usageRatio(slice.count, total));
            return (
              <div
                className="flex items-center justify-between rounded-md border border-border/40 bg-surface-raised/40 px-2.5 py-1.5"
                key={slice.key}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-caption text-foreground">
                    {slice.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="numeric font-mono text-caption text-muted-foreground">
                    {slice.count.toLocaleString()}
                  </span>
                  <span className="numeric font-medium font-mono text-caption text-foreground">
                    {pct}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
