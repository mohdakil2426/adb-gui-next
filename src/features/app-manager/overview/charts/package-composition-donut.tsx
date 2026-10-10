import { m, useReducedMotion } from "framer-motion";
import { Cpu, Package, PauseCircle, User } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/utils/cn";
import { formatPercent, usageRatio } from "@/shared/utils/format";

export interface PackageCompositionDonutProps {
  disabledCount?: number | undefined;
  systemCount?: number | undefined;
  totalCount?: number | undefined;
  userCount?: number | undefined;
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * Precision hardware telemetry card for user / system / disabled packages.
 * Displays a holistic multi-segment distribution bar paired with rich
 * category diagnostic rows.
 */
export const PackageCompositionDonut = ({
  disabledCount = 0,
  systemCount = 0,
  totalCount,
  userCount = 0,
}: PackageCompositionDonutProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const total = Math.max(1, totalCount ?? userCount + systemCount + disabledCount);

  const categories = [
    {
      barClass: "bg-chart-1",
      count: userCount,
      description: "Third-party & sideloaded applications",
      icon: User,
      iconBg: "bg-chart-1/10 text-chart-1",
      key: "user",
      label: "User Applications",
    },
    {
      barClass: "bg-chart-2",
      count: systemCount,
      description: "Android OS & OEM platform core",
      icon: Cpu,
      iconBg: "bg-chart-2/10 text-chart-2",
      key: "system",
      label: "System Framework",
    },
    {
      barClass: "bg-chart-3",
      count: disabledCount,
      description: "Deactivated & frozen packages",
      icon: PauseCircle,
      iconBg: "bg-chart-3/10 text-chart-3",
      key: "disabled",
      label: "Disabled & Frozen",
    },
  ];

  return (
    <div className="border-border bg-surface flex h-full flex-col justify-between gap-3.5 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package aria-hidden="true" className="text-primary size-4" />
          <h3 className="text-foreground text-label font-medium">Package Distribution</h3>
        </div>
        <span className="numeric text-caption text-muted-foreground font-mono">
          {total} packages
        </span>
      </div>

      {/* Holistic Multi-Segment Capacity Bar */}
      <div className="border-border/60 bg-secondary/60 flex h-3 w-full gap-0.5 overflow-hidden rounded-full border p-0.5">
        {categories.map((cat) => {
          const rawPct = (cat.count / total) * 100;
          const displayPct = cat.count > 0 ? Math.max(1.8, rawPct) : 0;
          const isDimmed = activeKey !== null && activeKey !== cat.key;

          return (
            <div
              className={cn(
                // oxlint-disable-next-line shadcn/no-arbitrary-values -- segmented meter tracks dynamic width without transition-all
                "h-full w-(--segment-width) rounded-full transition-opacity duration-200",
                cat.barClass,
                isDimmed ? "opacity-35" : "opacity-100"
              )}
              key={cat.key}
              onPointerEnter={() => setActiveKey(cat.key)}
              onPointerLeave={() => setActiveKey(null)}
              style={{ "--segment-width": `${displayPct}%` } as React.CSSProperties}
              title={`${cat.label}: ${cat.count} (${rawPct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 3 Rich Diagnostic Metric Rows */}
      <div className="flex flex-1 flex-col justify-between gap-2">
        {categories.map((cat, idx) => {
          const isHovered = activeKey === cat.key;
          const ratio = usageRatio(cat.count, total);
          const pct = formatPercent(ratio);
          const Icon = cat.icon;

          return (
            <m.div
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "group flex flex-1 cursor-pointer flex-col justify-center gap-1.5 rounded-md border p-2 transition-all",
                isHovered
                  ? "border-border bg-surface-raised shadow-xs"
                  : "border-border/60 bg-surface-raised/40 hover:border-border hover:bg-surface-raised"
              )}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
              key={cat.key}
              onPointerEnter={() => setActiveKey(cat.key)}
              onPointerLeave={() => setActiveKey(null)}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { delay: 0.1 + idx * 0.05, duration: 0.28, ease: EASE_STANDARD }
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={cn(
                      "flex size-6.5 shrink-0 items-center justify-center rounded",
                      cat.iconBg
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-body text-foreground truncate font-medium">
                      {cat.label}
                    </span>
                    <span className="text-caption text-muted-foreground truncate">
                      {cat.description}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="numeric text-body text-foreground font-semibold">
                    {cat.count}
                  </span>
                  <span className="numeric text-caption text-muted-foreground bg-surface border-border/40 rounded border px-1.5 py-0.5 font-medium">
                    {pct}
                  </span>
                </div>
              </div>

              {/* Category micro-progress bar */}
              <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
                <m.div
                  animate={{ scaleX: ratio }}
                  className={cn("h-full w-full origin-left rounded-full", cat.barClass)}
                  initial={shouldReduceMotion ? false : { scaleX: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { delay: 0.16 + idx * 0.05, duration: 0.35, ease: EASE_STANDARD }
                  }
                />
              </div>
            </m.div>
          );
        })}
      </div>
    </div>
  );
};
