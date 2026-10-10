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
      iconBg: "bg-chart-1/10 text-chart-1",
      key: "dev",
      label: "Developer Tools",
    },
    {
      count: systemCount,
      dotClass: "bg-chart-2",
      icon: Cpu,
      iconBg: "bg-chart-2/10 text-chart-2",
      key: "system",
      label: "System & Root",
    },
    {
      count: privacyCount,
      dotClass: "bg-chart-3",
      icon: Shield,
      iconBg: "bg-chart-3/10 text-chart-3",
      key: "privacy",
      label: "Privacy & Security",
    },
    {
      count: mediaCount,
      dotClass: "bg-chart-4",
      icon: Play,
      iconBg: "bg-chart-4/10 text-chart-4",
      key: "media",
      label: "Media & Streaming",
    },
    {
      count: toolsCount,
      dotClass: "bg-chart-5",
      icon: Wrench,
      iconBg: "bg-chart-5/10 text-chart-5",
      key: "tools",
      label: "Utility & System Mods",
    },
  ];

  const total = categories.reduce((sum, c) => sum + c.count, 0) || 1;

  return (
    <div className="border-border bg-surface @container flex h-full flex-col justify-between gap-3.5 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode2 className="text-primary size-4" />
          <h3 className="text-body text-foreground font-semibold">Category Spectrum</h3>
        </div>
        <span className="numeric text-caption text-muted-foreground font-mono">
          {total.toLocaleString()} categorized
        </span>
      </div>

      {/* Proportional Segmented Bar */}
      <div className="border-border/60 bg-secondary/60 flex h-3 w-full gap-0.5 overflow-hidden rounded-full border p-0.5">
        {categories.map((cat) => {
          const pct = (cat.count / total) * 100;
          const isDimmed = activeKey !== null && activeKey !== cat.key;
          return (
            <div
              className={cn(
                // oxlint-disable-next-line shadcn/no-arbitrary-values -- segmented meter animates width and hover opacity without transition:all
                "h-full w-(--segment-width) rounded-full transition-[width,opacity] duration-200",
                cat.dotClass,
                isDimmed ? "opacity-35" : "opacity-100"
              )}
              key={cat.key}
              onPointerEnter={() => setActiveKey(cat.key)}
              onPointerLeave={() => setActiveKey(null)}
              style={{ "--segment-width": `${pct}%` } as React.CSSProperties}
              title={`${cat.label}: ${cat.count.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Segment Legend Grid (2-column with 5th full-width to prevent truncation and empty cell) */}
      <div className="grid flex-1 grid-cols-1 gap-2 @sm:grid-cols-2">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          const ratio = usageRatio(cat.count, total);
          const pct = formatPercent(ratio);
          const isHovered = activeKey === cat.key;
          const isLastOdd = idx === categories.length - 1 && categories.length % 2 === 1;

          return (
            <div
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition-colors",
                isLastOdd && "@sm:col-span-2",
                isHovered
                  ? "border-border bg-surface-raised"
                  : "border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised"
              )}
              key={cat.key}
              onPointerEnter={() => setActiveKey(cat.key)}
              onPointerLeave={() => setActiveKey(null)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded",
                    cat.iconBg
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                <span className="text-caption text-foreground truncate font-medium">
                  {cat.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="numeric text-caption text-muted-foreground font-mono">
                  {cat.count.toLocaleString()}
                </span>
                <span className="numeric text-caption text-foreground bg-surface border-border/40 rounded border px-1.5 py-0.5 font-mono font-bold">
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
