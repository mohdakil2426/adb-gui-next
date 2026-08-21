import { Code2, Cpu, FileCode2, Play, Shield, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MarketplaceGetOverviewStats } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { formatPercent, usageRatio } from '@/shared/utils/format';

interface CategoryDistributionMeterProps {
  devCount?: number;
  mediaCount?: number;
  privacyCount?: number;
  systemCount?: number;
  toolsCount?: number;
}

export function CategoryDistributionMeter(props: CategoryDistributionMeterProps) {
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

  const systemCount = props.systemCount ?? stats?.systemCount ?? 3120;
  const privacyCount = props.privacyCount ?? stats?.privacyCount ?? 2840;
  const devCount = props.devCount ?? stats?.devCount ?? 4210;
  const mediaCount = props.mediaCount ?? stats?.mediaCount ?? 2190;
  const toolsCount = props.toolsCount ?? stats?.toolsCount ?? 1840;
  const categories = [
    {
      key: 'dev',
      label: 'Developer Tools',
      count: devCount,
      color: 'var(--chart-1)',
      dotClass: 'bg-chart-1',
      icon: Code2,
    },
    {
      key: 'system',
      label: 'System & Root',
      count: systemCount,
      color: 'var(--chart-2)',
      dotClass: 'bg-chart-2',
      icon: Cpu,
    },
    {
      key: 'privacy',
      label: 'Privacy & Security',
      count: privacyCount,
      color: 'var(--chart-3)',
      dotClass: 'bg-chart-3',
      icon: Shield,
    },
    {
      key: 'media',
      label: 'Media & Streaming',
      count: mediaCount,
      color: 'var(--chart-4)',
      dotClass: 'bg-chart-4',
      icon: Play,
    },
    {
      key: 'tools',
      label: 'Utility & System Mods',
      count: toolsCount,
      color: 'var(--chart-5)',
      dotClass: 'bg-chart-5',
      icon: Wrench,
    },
  ];

  const total = categories.reduce((sum, c) => sum + c.count, 0) || 1;

  return (
    <div className="@container flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-body text-foreground">Category Spectrum</h3>
        </div>
        <span className="numeric font-mono text-caption text-muted-foreground">
          {total.toLocaleString()} categorized
        </span>
      </div>

      {/* Proportional Segmented Bar */}
      <div className="my-3 flex h-3.5 w-full overflow-hidden rounded-full border border-border/50 bg-surface-raised">
        {categories.map((cat) => {
          const pct = (cat.count / total) * 100;
          return (
            <div
              className="h-full transition-[width,opacity] duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-80"
              key={cat.key}
              style={{
                width: `${pct}%`,
                backgroundColor: cat.color,
              }}
              title={`${cat.label}: ${cat.count.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Segment Legend Grid */}
      <div className="grid @sm:grid-cols-3 grid-cols-2 gap-2 pt-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const ratio = usageRatio(cat.count, total);
          const pct = formatPercent(ratio);
          return (
            <div
              className="flex flex-col justify-between rounded-md border border-border/40 bg-surface-raised/40 p-2"
              key={cat.key}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-caption text-foreground">
                  {cat.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="numeric font-mono text-caption text-muted-foreground">
                  {cat.count.toLocaleString()}
                </span>
                <span className="numeric font-bold font-mono text-caption text-foreground">
                  {pct}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
