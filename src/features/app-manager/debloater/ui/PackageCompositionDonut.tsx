import type { PackageComposition } from '@/features/app-manager/debloater/model/packageComposition';

/**
 * Hand-built SVG donut. This deliberately does not use a charting library —
 * see the note in `MemorySparkline.tsx`: Recharts' `decimal.js-light` assigns
 * `Decimal.prototype.valueOf` at module-eval time, which throws under Tauri's
 * `freezePrototype: true` and crashes the whole view.
 *
 * Arcs are drawn as a single circle per slice using `stroke-dasharray` +
 * `stroke-dashoffset`, rotated so slice 1 starts at 12 o'clock.
 */

/** Geometry is in user units; the SVG scales to whatever box the caller gives it. */
const SIZE = 100;
const STROKE = 19;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Visual gap between adjacent slices, in user units. */
const GAP = 2;

interface Slice {
  color: string;
  count: number;
  key: string;
  label: string;
}

export function PackageCompositionDonut({ composition }: { composition: PackageComposition }) {
  const slices: Slice[] = [
    { key: 'user', label: 'User', count: composition.user, color: 'var(--chart-1)' },
    { key: 'system', label: 'System', count: composition.system, color: 'var(--chart-2)' },
    { key: 'disabled', label: 'Disabled', count: composition.disabled, color: 'var(--chart-3)' },
  ].filter((slice) => slice.count > 0);

  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) {
    return null;
  }

  const showGap = slices.length > 1;
  let offset = 0;

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
