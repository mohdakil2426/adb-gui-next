import { Code2, Cpu, FileCode2, Play, Shield, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { MarketplaceGetOverviewStats } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { cn } from "@/shared/utils/cn";
import { formatPercent, usageRatio } from "@/shared/utils/format";

interface CategoryDistributionMeterProps {
  devCount?: number;
  mediaCount?: number;
  privacyCount?: number;
  systemCount?: number;
  toolsCount?: number;
}

export const CategoryDistributionMeter = (props: CategoryDistributionMeterProps) => {
  const [stats, setStats] = useState<backend.MarketplaceOverviewStats | null>(null);

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

  const systemCount = props.systemCount ?? stats?.systemCount ?? 3120;
  const privacyCount = props.privacyCount ?? stats?.privacyCount ?? 2840;
  const devCount = props.devCount ?? stats?.devCount ?? 4210;
  const mediaCount = props.mediaCount ?? stats?.mediaCount ?? 2190;
  const toolsCount = props.toolsCount ?? stats?.toolsCount ?? 1840;
  const categories = [
    {
      count: devCount,
      dotClass: "bg-chart-1",
      icon: Code2,
      key: "dev",
      label: "Developer Tools",
    },
    {
      count: systemCount,
      dotClass: "bg-chart-2",
      icon: Cpu,
      key: "system",
      label: "System & Root",
    },
    {
      count: privacyCount,
      dotClass: "bg-chart-3",
      icon: Shield,
      key: "privacy",
      label: "Privacy & Security",
    },
    {
      count: mediaCount,
      dotClass: "bg-chart-4",
      icon: Play,
      key: "media",
      label: "Media & Streaming",
    },
    {
      count: toolsCount,
      dotClass: "bg-chart-5",
      icon: Wrench,
      key: "tools",
      label: "Utility & System Mods",
    },
  ];

  const total = categories.reduce((sum, c) => sum + c.count, 0) || 1;

  return (
    <div className="border-border bg-surface @container flex flex-col justify-between rounded-lg border p-4">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="text-muted-foreground size-4" />
          <h3 className="text-body text-foreground font-semibold">Category Spectrum</h3>
        </div>
        <span className="numeric text-caption text-muted-foreground font-mono">
          {total.toLocaleString()} categorized
        </span>
      </div>

      {/* Proportional Segmented Bar */}
      <div className="border-border/50 bg-surface-raised my-3 flex h-3.5 w-full overflow-hidden rounded-full border">
        {categories.map((cat) => {
          const pct = (cat.count / total) * 100;
          return (
            <div
              className={cn(
                // oxlint-disable-next-line shadcn/no-arbitrary-values -- segmented meter animates width and hover opacity without transition:all
                "h-full w-(--segment-width) transition-[width,opacity] duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-80",
                cat.dotClass
              )}
              key={cat.key}
              style={{ "--segment-width": `${pct}%` } as React.CSSProperties}
              title={`${cat.label}: ${cat.count.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Segment Legend Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1 @sm:grid-cols-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const ratio = usageRatio(cat.count, total);
          const pct = formatPercent(ratio);
          return (
            <div
              className="border-border/40 bg-surface-raised/40 flex flex-col justify-between rounded-md border p-2"
              key={cat.key}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon className="text-muted-foreground size-3 shrink-0" />
                <span className="text-caption text-foreground truncate font-medium">
                  {cat.label}
                </span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="numeric text-caption text-muted-foreground font-mono">
                  {cat.count.toLocaleString()}
                </span>
                <span className="numeric text-caption text-foreground font-mono font-bold">
                  {pct}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
