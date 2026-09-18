import { m, useReducedMotion } from "framer-motion";

import { TONE_FILL, usageTone } from "@/features/dashboard/model/tone";
import type { Tone } from "@/features/dashboard/model/tone";
import { cn } from "@/shared/utils/cn";
import { formatPercent } from "@/shared/utils/format";

interface UsageBarProps {
  /** Accessible name, e.g. `/data storage used`. */
  label: string;
  /** 0–1. Use `usageRatio()` so the bar and its caption cannot disagree. */
  ratio: number;
  tone?: Tone | undefined;
}

const PERCENT_SCALE = 100;

/**
 * Proportion bar for storage and memory. `"12G used of 64G"` cannot be scanned;
 * a filled track can, and the colour escalates before the volume is full.
 */
export const UsageBar = ({ label, ratio, tone }: UsageBarProps) => {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const resolvedTone = tone ?? usageTone(clamped);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <progress
        aria-label={label}
        className="sr-only"
        max={PERCENT_SCALE}
        value={Math.round(clamped * PERCENT_SCALE)}
      >
        {formatPercent(clamped)}
      </progress>
      <m.div
        animate={{ scaleX: clamped }}
        aria-hidden="true"
        className={cn("h-full w-full origin-left", TONE_FILL[resolvedTone])}
        initial={shouldReduceMotion ? false : { scaleX: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.2, 0, 0, 1] }}
      />
    </div>
  );
};
