import { CircleAlert, PieChart } from 'lucide-react';
import { lazy, Suspense } from 'react';
import type { PackageComposition } from '@/features/app-manager/debloater/model/packageComposition';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatPercent, usageRatio } from '@/shared/utils/format';

/**
 * Recharts is ~100 kB if imported statically and this donut is the only chart
 * in App Manager, so it is code-split and fetched only once there is something
 * to draw.
 */
const PackageCompositionDonut = lazy(() =>
  import('@/features/app-manager/overview/charts/PackageCompositionDonut').then((module) => ({
    default: module.PackageCompositionDonut,
  })),
);

interface PackageCompositionPanelProps {
  composition: PackageComposition;
  /** Debloat rows are the only source of `Disabled`; see `packageComposition.ts`. */
  hasDebloatData: boolean;
  isLoading: boolean;
  /** Why `pm list packages` failed, or `null`. A failure is not a device with no apps. */
  loadError: string | null;
  onOpenDebloat: () => void;
  selectedSerial: string | null;
}

const SLICES = [
  { dot: 'bg-chart-1', key: 'user', label: 'User' },
  { dot: 'bg-chart-2', key: 'system', label: 'System' },
  { dot: 'bg-chart-3', key: 'disabled', label: 'Disabled' },
] as const;

function LegendRow({
  count,
  dot,
  label,
  total,
}: {
  count: number;
  dot: string;
  label: string;
  total: number;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', dot)} />
      <span className="flex-1 text-label text-muted-foreground">{label}</span>
      <span className="numeric font-medium text-body text-foreground">{count}</span>
      <span className="numeric w-10 text-right text-caption text-muted-foreground">
        {formatPercent(usageRatio(count, total))}
      </span>
    </div>
  );
}

/**
 * "1,204 packages" says nothing about what a debloat pass has achieved. The
 * proportion of user, system and disabled packages does — and it is the one
 * number on this screen that changes when the user applies a batch.
 */
export function PackageCompositionPanel({
  composition,
  hasDebloatData,
  isLoading,
  loadError,
  onOpenDebloat,
  selectedSerial,
}: PackageCompositionPanelProps) {
  const counts = {
    disabled: composition.disabled,
    system: composition.system,
    user: composition.user,
  };

  return (
    <Card className="gap-3 rounded-lg border-border bg-surface py-4 shadow-none">
      <CardHeader className="gap-0 px-4">
        <CardTitle
          as="h2"
          className="flex items-center gap-1.5 text-caption text-muted-foreground uppercase tracking-wide"
        >
          <PieChart aria-hidden="true" className="size-3.5" />
          Package composition
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4">
        {selectedSerial === null ? (
          <p className="text-body text-muted-foreground">
            Connect a device to see how its packages break down.
          </p>
        ) : loadError ? (
          <p className="flex items-start gap-2 text-body text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>Could not read the package list — {loadError}</span>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            {isLoading && composition.total === 0 ? (
              <Skeleton className="size-28 shrink-0 rounded-full" />
            ) : composition.total === 0 ? (
              <div className="flex size-28 shrink-0 items-center justify-center rounded-full border border-border border-dashed text-caption text-muted-foreground">
                No data
              </div>
            ) : (
              <Suspense fallback={<Skeleton className="size-28 shrink-0 rounded-full" />}>
                <PackageCompositionDonut composition={composition} standalone />
              </Suspense>
            )}

            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-label text-muted-foreground">Installed packages</span>
                <span className="numeric font-semibold text-foreground text-title">
                  {composition.total}
                </span>
              </div>
              {SLICES.map((slice) => (
                <LegendRow
                  count={counts[slice.key]}
                  dot={slice.dot}
                  key={slice.key}
                  label={slice.label}
                  total={composition.total}
                />
              ))}
              {hasDebloatData ? null : (
                <p className="pt-1 text-caption text-muted-foreground">
                  Disabled packages are identified from the debloat list.{' '}
                  <button
                    className="cursor-pointer text-primary underline underline-offset-2"
                    onClick={onOpenDebloat}
                    type="button"
                  >
                    Open Debloat
                  </button>{' '}
                  to include them.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
