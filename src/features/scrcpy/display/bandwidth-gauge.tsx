import { useQuery } from "@tanstack/react-query";

import { ScrcpyCalculateBandwidthMetrics } from "@/desktop/backend";
import { cn } from "@/shared/utils/cn";

// Empty state handled across UI when data?.length === 0

interface BandwidthGaugeProps {
  bitrateStr: string | null;
}
const MAX_SCALE = 64;
const CX = 80;
const CY = 72;
const RADIUS = 50;
// in degrees
const START_ANGLE = 145;
// in degrees
const TOTAL_SWEEP = 250;

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, start: number, sweep: number) => {
  const startPt = polarToCartesian(x, y, radius, start);
  const endPt = polarToCartesian(x, y, radius, start + sweep);
  const largeArcFlag = sweep <= 180 ? "0" : "1";
  return `M ${startPt.x} ${startPt.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPt.x} ${endPt.y}`;
};

const BACKGROUND_ARC = describeArc(CX, CY, RADIUS, START_ANGLE, TOTAL_SWEEP);

export const BandwidthGauge = ({ bitrateStr }: BandwidthGaugeProps) => {
  const { data: metrics } = useQuery({
    queryFn: () => ScrcpyCalculateBandwidthMetrics(bitrateStr),
    queryKey: ["scrcpy", "bandwidthMetrics", bitrateStr],
    staleTime: 60_000,
  });

  const bitrateMbps = metrics?.bitrateMbps ?? 8;
  const clamped = Math.min(MAX_SCALE, Math.max(1, bitrateMbps));
  const fraction = clamped / MAX_SCALE;

  const activeSweep = Math.max(2, fraction * TOTAL_SWEEP);
  const activeArc = describeArc(CX, CY, RADIUS, START_ANGLE, activeSweep);
  const rating = metrics?.rating ?? "Balanced HD";
  const ratingColor =
    metrics?.ratingColor === "emerald" || bitrateMbps <= 4
      ? "text-muted-foreground"
      : "text-foreground";

  const mbPerMin =
    metrics?.mbPerMin === null || metrics?.mbPerMin === undefined
      ? ((bitrateMbps / 8) * 60).toFixed(0)
      : Math.round(metrics.mbPerMin).toString();

  return (
    <div className="border-border/80 bg-surface-raised/40 flex flex-col items-center justify-center rounded-lg border p-3">
      <div className="relative flex size-36 items-center justify-center">
        <svg aria-hidden="true" className="size-full overflow-visible" viewBox="0 0 160 140">
          {/* Background Track Arc */}
          <path
            className="stroke-muted/30"
            d={BACKGROUND_ARC}
            fill="none"
            strokeLinecap="round"
            strokeWidth="10"
          />

          {/* Active Bandwidth Arc */}
          <path
            className="stroke-foreground transition-opacity transition-transform duration-300 ease-out"
            d={activeArc}
            fill="none"
            strokeLinecap="round"
            strokeWidth="10"
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-foreground font-mono text-xl font-bold tracking-tight">
            {bitrateMbps}{" "}
            <span className="text-caption text-muted-foreground font-normal">Mbps</span>
          </span>
          <span className={cn("text-[11px] font-medium", ratingColor)}>{rating}</span>
        </div>
      </div>

      <div className="border-border/40 text-caption text-muted-foreground flex w-full items-center justify-between gap-3 border-t px-2 pt-1">
        <span>Estimated Data:</span>
        <span className="text-foreground text-mono-sm font-mono font-medium">
          ~{mbPerMin} MB / min
        </span>
      </div>
    </div>
  );
};
