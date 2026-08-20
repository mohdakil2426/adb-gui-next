export interface PackageComposition {
  disabled: number;
  system: number;
  total: number;
  user: number;
}

import { formatPercent, usageRatio } from '@/shared/utils/format';

export interface PackageCompositionDonutProps {
  composition?: PackageComposition | undefined;
  disabledCount?: number | undefined;
  standalone?: boolean | undefined;
  systemCount?: number | undefined;
  totalCount?: number | undefined;
  userCount?: number | undefined;
}

const SIZE = 120;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

export function PackageCompositionDonut({
  composition,
  disabledCount = composition?.disabled ?? 0,
  standalone = false,
  systemCount = composition?.system ?? 0,
  totalCount,
  userCount = composition?.user ?? 0,
}: PackageCompositionDonutProps) {
  const slices = [
    {
      color: 'var(--chart-1)',
      count: userCount,
      dotClass: 'bg-chart-1',
      key: 'user',
      label: 'User Apps',
    },
    {
      color: 'var(--chart-2)',
      count: systemCount,
      dotClass: 'bg-chart-2',
      key: 'system',
      label: 'System Apps',
    },
    {
      color: 'var(--chart-3)',
      count: disabledCount,
      dotClass: 'bg-chart-3',
      key: 'disabled',
      label: 'Disabled / Frozen',
    },
  ].filter((s) => s.count > 0);

  const total = slices.reduce((sum, s) => sum + s.count, 0) || totalCount || 1;
  const showGap = slices.length > 1;
  let offset = 0;

  if (standalone) {
    if (slices.length === 0) {
      return null;
    }
    return (
      <svg
        aria-label={slices.map((slice) => `${slice.label}: ${slice.count}`).join(', ')}
        className="size-28 shrink-0 rotate-[-90deg]"
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        {slices.map((slice) => {
          const length = (slice.count / total) * CIRCUMFERENCE;
          const dash = showGap ? Math.max(0, length - GAP) : length;
          const circle = (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              fill="none"
              key={slice.key}
              r={RADIUS}
              stroke={slice.color}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-offset}
              strokeWidth={STROKE}
            >
              <title>{`${slice.label}: ${slice.count}`}</title>
            </circle>
          );
          offset += length;
          return circle;
        })}
      </svg>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground text-label">Package Composition</h3>
        <span className="numeric text-caption text-muted-foreground">{totalCount} total</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex size-28 shrink-0 items-center justify-center">
          <svg
            aria-label={`Package composition: ${userCount} user, ${systemCount} system`}
            className="size-full rotate-[-90deg]"
            role="img"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            {slices.map((slice) => {
              const length = (slice.count / total) * CIRCUMFERENCE;
              const dash = showGap ? Math.max(0, length - GAP) : length;
              const circle = (
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  fill="none"
                  key={slice.key}
                  r={RADIUS}
                  stroke={slice.color}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  strokeWidth={STROKE}
                />
              );
              offset += length;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="numeric font-semibold text-foreground text-headline">
              {totalCount}
            </span>
            <span className="text-caption text-muted-foreground">apps</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          {slices.map((slice) => (
            <div className="flex items-center justify-between text-body" key={slice.key}>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${slice.dotClass}`}
                />
                <span className="text-muted-foreground">{slice.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="numeric font-medium text-foreground">{slice.count}</span>
                <span className="numeric w-9 text-right text-caption text-muted-foreground">
                  {formatPercent(usageRatio(slice.count, total))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
