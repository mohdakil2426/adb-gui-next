import type { CSSProperties } from "react";

import { cn } from "@/shared/utils/cn";
import { formatBytes } from "@/shared/utils/format";
// Empty state handled across UI when data?.length === 0

export interface PartitionSizeDatum {
  /** True once this partition has been written — recoloured, not hidden. */
  extracted: boolean;
  name: string;
  size: number;
}
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

export const PartitionSizeChart = ({ data }: { data: PartitionSizeDatum[] }) => {
  let max = 0;
  for (const row of data) {
    if (row.size > max) {
      max = row.size;
    }
  }
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
            title={`${row.name}: ${formatBytes(row.size)}${row.extracted ? " (extracted)" : ""}`}
          >
            <span className="text-caption text-muted-foreground truncate">{row.name}</span>
            <span className="bg-surface-raised h-3 w-full overflow-hidden rounded-xs">
              <span
                className={cn(
                  // oxlint-disable-next-line shadcn/no-arbitrary-values -- targeted width animation avoids forbidden transition-all
                  "ease-standard block h-full w-(--width) rounded-xs transition-[width] duration-200",
                  row.extracted ? "bg-chart-2" : "bg-chart-1"
                )}
                style={{ "--width": `${percent}%` } as CSSProperties}
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
};
