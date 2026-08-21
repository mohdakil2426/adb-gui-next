import { m, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { formatPercent, usageRatio } from '@/shared/utils/format';

export interface CompositionSlice {
  color: string;
  count: number;
  key: string;
  label: string;
}

interface AppsCompositionDonutProps {
  slices: CompositionSlice[];
}

const SIZE = 148;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_DEGREES = 3;

/**
 * Hand-rolled SVG donut for the user / system / disabled composition. Hovering
 * an arc (or legend row, via `activeKey`) swaps the center readout to that
 * slice; otherwise the center shows the installed total.
 */
export function AppsCompositionDonut({ slices }: AppsCompositionDonutProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const visible = slices.filter((slice) => slice.count > 0);
  const total = visible.reduce((sum, slice) => sum + slice.count, 0);
  const active = visible.find((slice) => slice.key === activeKey) ?? null;

  if (total === 0) {
    return null;
  }

  let offsetDegrees = 0;
  const arcs = visible.map((slice) => {
    const sweep = (slice.count / total) * 360;
    const arc = {
      dash: Math.max(0, ((sweep - (visible.length > 1 ? GAP_DEGREES : 0)) / 360) * CIRCUMFERENCE),
      fraction: slice.count / total,
      key: slice.key,
      offsetDegrees,
      slice,
    };
    offsetDegrees += sweep;
    return arc;
  });

  return (
    <div className="relative flex size-37 shrink-0 items-center justify-center">
      <svg
        aria-label={`Installed apps: ${visible.map((slice) => `${slice.label} ${slice.count}`).join(', ')}`}
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
                : { duration: 0.32, delay: 0.15 + index * 0.09, ease: [0.2, 0, 0, 1] }
            }
          >
            <title>{`${arc.slice.label}: ${arc.slice.count}`}</title>
          </m.circle>
        ))}
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute flex select-none flex-col items-center"
      >
        {active ? (
          <m.span
            animate={{ opacity: 1, y: 0 }}
            className="numeric font-semibold text-display text-foreground"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            key={active.key}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
          >
            {formatPercent(usageRatio(active.count, total))}
          </m.span>
        ) : (
          <>
            <span className="numeric font-semibold text-display text-foreground">{total}</span>
            <span className="text-caption text-muted-foreground lowercase">apps</span>
          </>
        )}
      </div>
    </div>
  );
}
