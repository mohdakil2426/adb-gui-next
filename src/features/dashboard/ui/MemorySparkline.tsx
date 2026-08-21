import { m, useReducedMotion } from 'framer-motion';
import { useId, useMemo, useState } from 'react';
import type { MemorySample } from '@/features/dashboard/model/memoryHistoryStore';
import { formatBytes, formatPercent, usageRatio } from '@/shared/utils/format';

/**
 * Hand-built SVG. This deliberately does not use a charting library.
 *
 * Recharts pulls in `decimal.js-light`, which does `Decimal.prototype.valueOf = …`
 * at module-evaluation time. The app runs with Tauri's `freezePrototype: true`,
 * which freezes `Object.prototype` — so that assignment throws
 * `TypeError: Cannot assign to read only property 'valueOf'` and takes down the
 * whole view, not just the chart. It never reproduces in `vite build` or jsdom,
 * only inside the webview. A ~40-line polyline is the correct trade here.
 */

const VIEW_W = 300;
const VIEW_H = 64;
/** Keeps the 1.5px stroke from clipping at 0% and 100%. */
const PAD_Y = 3;
const GRID_LINES = [0.25, 0.5, 0.75];

const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

interface Point {
  at: number;
  ratio: number;
  usedBytes: number;
  x: number;
  y: number;
}

function buildPoints(samples: MemorySample[]): Point[] {
  if (samples.length === 0) {
    return [];
  }
  if (samples.length === 1) {
    const sample = samples[0];
    if (!sample) {
      return [];
    }
    const ratio = usageRatio(sample.usedBytes, sample.totalBytes);
    const clamped = Math.min(1, Math.max(0, ratio));
    const y = PAD_Y + (1 - clamped) * (VIEW_H - PAD_Y * 2);
    return [
      { at: sample.at, usedBytes: sample.usedBytes, ratio, x: 0, y },
      { at: sample.at, usedBytes: sample.usedBytes, ratio, x: VIEW_W, y },
    ];
  }
  const step = VIEW_W / (samples.length - 1);
  return samples.map((sample, index) => {
    const ratio = usageRatio(sample.usedBytes, sample.totalBytes);
    const clamped = Math.min(1, Math.max(0, ratio));
    return {
      at: sample.at,
      usedBytes: sample.usedBytes,
      ratio,
      x: index * step,
      y: PAD_Y + (1 - clamped) * (VIEW_H - PAD_Y * 2),
    };
  });
}

export function MemorySparkline({ samples }: { samples: MemorySample[] }) {
  const gradientId = useId();
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const points = useMemo(() => buildPoints(samples), [samples]);

  if (points.length === 0) {
    return null;
  }

  const line = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const first = points[0];
  const latest = points[points.length - 1];
  const area = `${first?.x.toFixed(2)},${VIEW_H} ${line} ${latest?.x.toFixed(2)},${VIEW_H}`;
  const active = activeIndex === null ? null : points[activeIndex];
  const readout = active ?? latest;

  return (
    <div className="flex flex-col gap-1">
      <svg
        aria-label={`Memory usage over the last ${points.length} samples, currently ${formatPercent(latest?.ratio ?? 0)}`}
        className="h-16 w-full touch-none"
        onPointerLeave={() => {
          setActiveIndex(null);
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (bounds.width === 0) {
            return;
          }
          const ratio = (event.clientX - bounds.left) / bounds.width;
          const index = Math.round(ratio * (points.length - 1));
          setActiveIndex(Math.min(points.length - 1, Math.max(0, index)));
        }}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Dashed reference grid at 25 / 50 / 75 % */}
        {GRID_LINES.map((level) => {
          const y = PAD_Y + (1 - level) * (VIEW_H - PAD_Y * 2);
          return (
            <line
              key={level}
              stroke="var(--border)"
              strokeDasharray="3 4"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={VIEW_W}
              y1={y}
              y2={y}
            />
          );
        })}

        <m.polygon
          animate={{ opacity: 1 }}
          fill={`url(#${gradientId})`}
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          points={area}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6 }}
        />
        <m.polyline
          animate={{ pathLength: 1 }}
          fill="none"
          initial={shouldReduceMotion ? false : { pathLength: 0 }}
          points={line}
          stroke="var(--chart-1)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.8, ease: [0.2, 0, 0, 1] }
          }
          vectorEffect="non-scaling-stroke"
        />

        {/* Live endpoint pulse */}
        {latest ? (
          <m.circle
            animate={
              shouldReduceMotion
                ? { opacity: 0.9 }
                : { opacity: [0.9, 0.35, 0.9], scale: [1, 1.25, 1] }
            }
            cx={latest.x}
            cy={latest.y}
            fill="var(--chart-1)"
            r={2.5}
            style={{ transformOrigin: `${latest.x}px ${latest.y}px` }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
            }
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Hover scrubber: crosshair + focus dot */}
        {active ? (
          <g>
            <line
              stroke="var(--muted-foreground)"
              strokeDasharray="2 3"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={active.x}
              x2={active.x}
              y1={0}
              y2={VIEW_H}
            />
            <circle
              cx={active.x}
              cy={active.y}
              fill="var(--background)"
              r={3.5}
              stroke="var(--chart-1)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>
      <p className="numeric text-caption text-muted-foreground tabular-nums">
        {readout
          ? `${formatBytes(readout.usedBytes)} · ${formatPercent(readout.ratio)} · ${timeFormatter.format(readout.at)}`
          : null}
      </p>
    </div>
  );
}
