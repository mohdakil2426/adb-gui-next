import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatPercent, usageRatio } from '@/shared/utils/format';

interface TargetSdkDistributionMeterProps {
  buckets: {
    legacy: number; // <= API 29
    modern: number; // API 34+
    standard: number; // API 30-33
    maxApi?: number | undefined;
    minApi?: number | undefined;
  };
  totalCount: number;
}

export function TargetSdkDistributionMeter({
  buckets,
  totalCount,
}: TargetSdkDistributionMeterProps) {
  const total = totalCount || 1;
  const modernPct = (buckets.modern / total) * 100;
  const standardPct = (buckets.standard / total) * 100;
  const legacyPct = (buckets.legacy / total) * 100;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground text-label">Target SDK Distribution</h3>
          {buckets.legacy > 0 ? (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-500 text-caption">
              <AlertTriangle className="size-3" />
              {buckets.legacy} Legacy
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-caption text-emerald-500">
              <ShieldCheck className="size-3" />
              Modern
            </span>
          )}
        </div>
        <span className="numeric text-caption text-muted-foreground">API compliance</span>
      </div>

      {/* Proportional Segmented Bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className="bg-emerald-500 transition-all duration-300"
          style={{ width: `${modernPct}%` }}
          title={`Android 14+ (API 34+): ${buckets.modern}`}
        />
        <div
          className="bg-sky-500 transition-all duration-300"
          style={{ width: `${standardPct}%` }}
          title={`Android 11-13 (API 30-33): ${buckets.standard}`}
        />
        <div
          className="bg-amber-500 transition-all duration-300"
          style={{ width: `${legacyPct}%` }}
          title={`Legacy (<= API 29): ${buckets.legacy}`}
        />
      </div>

      {/* Segment Legend */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate text-caption text-muted-foreground">Android 14+</span>
          </div>
          <div className="flex items-baseline gap-1 pt-0.5">
            <span className="numeric font-semibold text-body text-foreground">
              {buckets.modern}
            </span>
            <span className="numeric text-caption text-muted-foreground">
              ({formatPercent(usageRatio(buckets.modern, total))})
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-sky-500" />
            <span className="truncate text-caption text-muted-foreground">Android 11-13</span>
          </div>
          <div className="flex items-baseline gap-1 pt-0.5">
            <span className="numeric font-semibold text-body text-foreground">
              {buckets.standard}
            </span>
            <span className="numeric text-caption text-muted-foreground">
              ({formatPercent(usageRatio(buckets.standard, total))})
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-amber-500" />
            <span className="truncate text-caption text-muted-foreground">&le; Android 10</span>
          </div>
          <div className="flex items-baseline gap-1 pt-0.5">
            <span className="numeric font-semibold text-body text-foreground">
              {buckets.legacy}
            </span>
            <span className="numeric text-caption text-muted-foreground">
              ({formatPercent(usageRatio(buckets.legacy, total))})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
