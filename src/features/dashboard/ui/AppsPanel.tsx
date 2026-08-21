import { m, useReducedMotion } from 'framer-motion';
import { CircleAlert, HardDrive, LayoutGrid, Package, Puzzle, ShieldCheck } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { useAppOverview } from '@/features/dashboard/hooks/useAppOverview';
import {
  AppsCompositionDonut,
  type CompositionSlice,
} from '@/features/dashboard/ui/AppsCompositionDonut';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { SpecChip } from '@/features/dashboard/ui/SpecChip';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatPercent, usageRatio } from '@/shared/utils/format';

interface AppsPanelProps {
  /** Only a fully booted ADB device exposes package telemetry. */
  isEnabled: boolean;
  serial: string;
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/** Mirrors the Rust bucketing in `apps/telemetry.rs`. */
const SDK_SEGMENTS = [
  {
    bucketKey: 'modern',
    colorClass: 'bg-success',
    label: 'Android 14+',
  },
  {
    bucketKey: 'standard',
    colorClass: 'bg-info',
    label: 'Android 11–13',
  },
  {
    bucketKey: 'legacy',
    colorClass: 'bg-warning',
    label: '≤ Android 10',
  },
] as const;

type SdkBuckets = backend.TargetSdkDistribution;

function SdkDistributionMeter({ buckets, total }: { buckets: SdkBuckets; total: number }) {
  const shouldReduceMotion = useReducedMotion();
  const denominator = total || 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between font-medium text-caption text-muted-foreground uppercase tracking-wider">
        <span>Target SDK health</span>
        <span className="numeric lowercase">
          {buckets.maxApi ? `max API ${buckets.maxApi}` : ''}
        </span>
      </div>
      <div
        aria-label="Target SDK distribution"
        className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-secondary"
        role="img"
      >
        {SDK_SEGMENTS.map((segment, index) => {
          const count = buckets[segment.bucketKey];
          return (
            <m.div
              animate={{ opacity: 1, scaleX: 1 }}
              aria-hidden="true"
              className={cn('h-full origin-left', segment.colorClass)}
              initial={shouldReduceMotion ? false : { opacity: 0, scaleX: 0 }}
              key={segment.bucketKey}
              style={{ width: `${(count / denominator) * 100}%` }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.4, delay: 0.2 + index * 0.08, ease: EASE_STANDARD }
              }
            />
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-0.5">
        {SDK_SEGMENTS.map((segment) => {
          const count = buckets[segment.bucketKey];
          return (
            <div className="flex flex-col" key={segment.bucketKey}>
              <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 shrink-0 rounded-full', segment.colorClass)}
                />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="numeric flex items-baseline gap-1">
                <span className="font-semibold text-body text-foreground">{count}</span>
                <span className="text-caption text-muted-foreground">
                  {formatPercent(usageRatio(count, denominator))}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AppsPanel({ isEnabled, serial }: AppsPanelProps) {
  const { error, isLoading, refresh, telemetry } = useAppOverview(serial, isEnabled);

  const slices: CompositionSlice[] = [
    {
      color: 'var(--chart-1)',
      count: telemetry?.userAppsCount ?? 0,
      key: 'user',
      label: 'User apps',
    },
    {
      color: 'var(--chart-2)',
      count: telemetry?.systemAppsCount ?? 0,
      key: 'system',
      label: 'System apps',
    },
    {
      color: 'var(--chart-3)',
      count: telemetry?.disabledAppsCount ?? 0,
      key: 'disabled',
      label: 'Disabled',
    },
  ];
  const totalApps = slices.reduce((sum, slice) => sum + slice.count, 0);
  const hasData = Boolean(telemetry) && totalApps > 0;

  return (
    <PanelCard delay={0.5} icon={Package} title="Applications">
      {isLoading && !telemetry ? (
        <div className="flex items-center gap-6 py-2">
          <Skeleton className="size-37 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      ) : error && !telemetry ? (
        <div className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-body text-muted-foreground">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
            Application inventory could not be read: {error.message}
          </p>
          <Button onClick={refresh} size="sm" type="button" variant="outline">
            Try again
          </Button>
        </div>
      ) : hasData && telemetry ? (
        <div className="flex @2xl:flex-row flex-col @2xl:items-center @2xl:gap-6 gap-4">
          {/* Composition donut + legend */}
          <div className="flex items-center gap-4">
            <AppsCompositionDonut slices={slices} />
            <div className="flex flex-col gap-2">
              {slices.map((slice) => (
                <div className="flex flex-col" key={slice.key}>
                  <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    {slice.label}
                  </span>
                  <span className="numeric flex items-baseline gap-1">
                    <span className="font-semibold text-body text-foreground">{slice.count}</span>
                    <span className="text-caption text-muted-foreground">
                      {formatPercent(usageRatio(slice.count, totalApps))}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: SDK health + footprint chips */}
          <div className="flex flex-1 flex-col justify-between gap-3 border-border/50 border-t @2xl:border-t-0 @2xl:border-l @2xl:pt-0 pt-3 @2xl:pl-6">
            <SdkDistributionMeter buckets={telemetry.targetSdkDistribution} total={totalApps} />
            <div className="grid grid-cols-2 gap-2">
              <SpecChip icon={LayoutGrid} label="Installed" value={`${totalApps}`} />
              <SpecChip
                icon={Puzzle}
                label="User share"
                value={formatPercent(usageRatio(telemetry.userAppsCount, totalApps))}
              />
              <SpecChip icon={ShieldCheck} label="System" value={`${telemetry.systemAppsCount}`} />
              <SpecChip
                icon={HardDrive}
                label="App storage"
                value={formatBytes(telemetry.totalStorageBytes)}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          The device reported no applications. This is unusual — try refreshing.
        </p>
      )}
    </PanelCard>
  );
}
