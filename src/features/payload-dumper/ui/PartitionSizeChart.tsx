import type { PartitionSizeDatum } from '@/features/payload-dumper/ui/partitionSizeData';
import { formatBytes } from '@/shared/utils/format';

/**
 * Hand-built bars. This deliberately does not use a charting library — see the
 * note in `MemorySparkline.tsx`: Recharts' `decimal.js-light` assigns
 * `Decimal.prototype.valueOf` at module-eval time, which throws under Tauri's
 * `freezePrototype: true` and crashes the whole view.
 *
 * A horizontal bar chart is a grid with a proportional width; SVG buys nothing
 * here and CSS keeps the labels selectable and the type on the shared scale.
 */

const FULL_WIDTH_PERCENT = 100;
/** Below this a bar is a sliver; keep it visible so a tiny partition still reads. */
const MIN_BAR_PERCENT = 1.5;

export function PartitionSizeChart({ data }: { data: PartitionSizeDatum[] }) {
  const max = data.reduce((peak, row) => Math.max(peak, row.size), 0);
  if (max === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {data.map((row) => {
        const percent = Math.max(MIN_BAR_PERCENT, (row.size / max) * FULL_WIDTH_PERCENT);
        return (
          <li
            className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2"
            key={row.name}
            title={`${row.name}: ${formatBytes(row.size)}${row.extracted ? ' (extracted)' : ''}`}
          >
            <span className="truncate text-caption text-muted-foreground">{row.name}</span>
            <span className="h-3 w-full overflow-hidden rounded-xs bg-surface-raised">
              <span
                className="block h-full rounded-xs transition-[width] duration-base ease-standard"
                style={{
                  width: `${percent}%`,
                  backgroundColor: row.extracted ? 'var(--chart-2)' : 'var(--chart-1)',
                }}
              />
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {formatBytes(row.size)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
