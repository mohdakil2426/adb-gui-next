import { m, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { formatPercent, usageRatio } from '@/shared/utils/format';

export interface PackageCompositionDonutProps {
  disabledCount?: number | undefined;
  systemCount?: number | undefined;
  totalCount?: number | undefined;
  userCount?: number | undefined;
}

const SIZE = 148;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_DEGREES = 3;

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * Interactive user / system / disabled composition donut. Hovering an arc (or
 * a legend row) dims the rest and swaps the center readout to that slice's
 * share; idle state shows the installed total.
 */
export function PackageCompositionDonut({
  disabledCount = 0,
  systemCount = 0,
  totalCount,
  userCount = 0,
}: PackageCompositionDonutProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState<string | null>(null);

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
  ].filter((slice) => slice.count > 0);

  const total = slices.reduce((sum, slice) => sum + slice.count, 0) || totalCount || 1;
  const active = slices.find((slice) => slice.key === activeKey) ?? null;

  if (slices.length === 0) {
    return null;
  }

  let offsetDegrees = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.count / total) * 360;
    const arc = {
      dash: Math.max(0, ((sweep - (slices.length > 1 ? GAP_DEGREES : 0)) / 360) * CIRCUMFERENCE),
      key: slice.key,
      offsetDegrees,
      slice,
    };
    offsetDegrees += sweep;
    return arc;
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground text-label">Package Composition</h3>
        <span className="numeric text-caption text-muted-foreground">{totalCount} total</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex size-28 shrink-0 items-center justify-center">
          <svg
            aria-label={`Package composition: ${slices.map((slice) => `${slice.label} ${slice.count}`).join(', ')}`}
            className="size-full -rotate-90"
            role="img"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            <circle
              className="stroke-secondary"
              cx={SIZE / 2}
              cy={SIZE / 2}
              fill="none"
              r={RADIUS}
              strokeWidth={STROKE}
            />
            {arcs.map((arc, index) => (
              <m.circle
                animate={{ opacity: activeKey === null || activeKey === arc.key ? 1 : 0.25 }}
                className="cursor-pointer transition-[stroke-width] duration-150"
                cx={SIZE / 2}
                cy={SIZE / 2}
                fill="none"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                key={arc.key}
                onPointerEnter={() => {
                  setActiveKey(arc.key);
                }}
                onPointerLeave={() => {
                  setActiveKey(null);
                }}
                r={RADIUS}
                stroke={arc.slice.color}
                strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                strokeDashoffset={-arc.offsetDegrees}
                strokeLinecap="butt"
                strokeWidth={activeKey === arc.key ? STROKE + 3 : STROKE}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.32, delay: 0.1 + index * 0.09, ease: EASE_STANDARD }
                }
              >
                <title>{`${arc.slice.label}: ${arc.slice.count}`}</title>
              </m.circle>
            ))}
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            {active ? (
              <m.span
                animate={{ opacity: 1, y: 0 }}
                className="numeric font-semibold text-foreground text-headline"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                key={active.key}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
              >
                {formatPercent(usageRatio(active.count, total))}
              </m.span>
            ) : (
              <>
                <span className="numeric font-semibold text-foreground text-headline">{total}</span>
                <span className="text-caption text-muted-foreground">apps</span>
              </>
            )}
          </div>
        </div>

        {/* Legend rows double as hover controls for the arcs */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {slices.map((slice, index) => (
            <m.button
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between rounded-md px-1.5 py-1 text-body transition-colors hover:bg-surface-raised"
              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
              key={slice.key}
              onBlur={() => {
                setActiveKey(null);
              }}
              onFocus={() => {
                setActiveKey(slice.key);
              }}
              onPointerEnter={() => {
                setActiveKey(slice.key);
              }}
              onPointerLeave={() => {
                setActiveKey(null);
              }}
              tabIndex={0}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.28, delay: 0.15 + index * 0.06, ease: EASE_STANDARD }
              }
              type="button"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${slice.dotClass}`}
                />
                <span className="text-muted-foreground">{slice.label}</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="numeric font-medium text-foreground">{slice.count}</span>
                <span className="numeric w-9 text-right text-caption text-muted-foreground">
                  {formatPercent(usageRatio(slice.count, total))}
                </span>
              </span>
            </m.button>
          ))}
        </div>
      </div>
    </div>
  );
}
