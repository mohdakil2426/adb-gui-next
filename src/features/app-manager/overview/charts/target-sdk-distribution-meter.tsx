import { m, useReducedMotion } from "framer-motion";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { cn } from "@/shared/utils/cn";
import { formatPercent, usageRatio } from "@/shared/utils/format";

interface TargetSdkDistributionMeterProps {
  buckets: {
    // <= API 29
    legacy: number;
    // API 34+
    modern: number;
    // API 30-33
    standard: number;
    maxApi?: number | undefined;
    minApi?: number | undefined;
  };
  totalCount: number;
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

const SEGMENTS = [
  { bucketKey: "modern", colorClass: "bg-success", label: "Android 14+" },
  { bucketKey: "standard", colorClass: "bg-info", label: "Android 11–13" },
  { bucketKey: "legacy", colorClass: "bg-warning", label: "≤ Android 10" },
] as const;

export const TargetSdkDistributionMeter = ({
  buckets,
  totalCount,
}: TargetSdkDistributionMeterProps) => {
  const shouldReduceMotion = useReducedMotion();
  const total = totalCount || 1;

  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-foreground text-label font-medium">Target SDK Distribution</h3>
          {buckets.legacy > 0 ? (
            <span className="bg-warning-muted text-caption text-warning flex items-center gap-1 rounded px-1.5 py-0.5 font-medium">
              <AlertTriangle aria-hidden="true" className="size-3" />
              {buckets.legacy} Legacy
            </span>
          ) : (
            <span className="bg-success-muted text-caption text-success flex items-center gap-1 rounded px-1.5 py-0.5 font-medium">
              <ShieldCheck aria-hidden="true" className="size-3" />
              Modern
            </span>
          )}
        </div>
        <span className="numeric text-caption text-muted-foreground">API compliance</span>
      </div>

      {/* Proportional segmented bar — scaleX fills, never width */}
      <div
        aria-label={`Target SDK distribution: ${buckets.modern} modern, ${buckets.standard} standard, ${buckets.legacy} legacy`}
        className="bg-surface-raised flex h-3 w-full gap-px overflow-hidden rounded-full"
      >
        {SEGMENTS.map((segment, index) => (
          <m.div
            animate={{ opacity: 1, scaleX: 1 }}
            aria-hidden="true"
            className={cn("h-full origin-left", segment.colorClass)}
            initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0 }}
            key={segment.bucketKey}
            style={{ width: `${(buckets[segment.bucketKey] / total) * 100}%` }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    delay: 0.1 + index * 0.08,
                    duration: 0.4,
                    ease: EASE_STANDARD,
                  }
            }
          />
        ))}
      </div>

      {/* Segment legend */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {SEGMENTS.map((segment, index) => {
          const count = buckets[segment.bucketKey];
          return (
            <m.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
              key={segment.bucketKey}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      delay: 0.2 + index * 0.06,
                      duration: 0.28,
                      ease: EASE_STANDARD,
                    }
              }
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", segment.colorClass)}
                />
                <span className="text-caption text-muted-foreground truncate">{segment.label}</span>
              </div>
              <div className="flex items-baseline gap-1 pt-0.5">
                <span className="numeric text-body text-foreground font-semibold">{count}</span>
                <span className="numeric text-caption text-muted-foreground">
                  ({formatPercent(usageRatio(count, total))})
                </span>
              </div>
            </m.div>
          );
        })}
      </div>
    </div>
  );
};
