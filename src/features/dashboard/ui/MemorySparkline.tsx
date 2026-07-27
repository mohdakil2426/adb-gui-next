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
  const step = samples.length === 1 ? 0 : VIEW_W / (samples.length - 1);
  return samples.map((sample, index) => {
    const ratio = usageRatio(sample.usedBytes, sample.totalBytes);
    const clamped = Math.min(1, Math.max(0, ratio));
    return {
      at: sample.at,
      usedBytes: sample.usedBytes,
      ratio,
      x: samples.length === 1 ? VIEW_W / 2 : index * step,
      y: PAD_Y + (1 - clamped) * (VIEW_H - PAD_Y * 2),
    };
  });
}

export function MemorySparkline({ samples }: { samples: MemorySample[] }) {
  const gradientId = useId();
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
        className="h-16 w-full"
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
        <polygon fill={`url(#${gradientId})`} points={area} />
        <polyline
          fill="none"
          points={line}
          stroke="var(--chart-1)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {active ? (
          <circle
            cx={active.x}
            cy={active.y}
            fill="var(--chart-1)"
            r={2.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <p className="text-caption text-muted-foreground tabular-nums">
        {readout
          ? `${formatBytes(readout.usedBytes)} · ${formatPercent(readout.ratio)} · ${timeFormatter.format(readout.at)}`
          : null}
      </p>
    </div>
  );
}
