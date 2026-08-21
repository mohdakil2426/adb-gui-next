import { m, useReducedMotion } from 'framer-motion';
import { TONE_FILL, type Tone, usageTone } from '@/features/dashboard/model/tone';
import { cn } from '@/shared/utils/cn';
import { formatPercent } from '@/shared/utils/format';

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
export function UsageBar({ label, ratio, tone }: UsageBarProps) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const resolvedTone = tone ?? usageTone(clamped);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-label={label}
      aria-valuemax={PERCENT_SCALE}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped * PERCENT_SCALE)}
      aria-valuetext={formatPercent(clamped)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
    >
      <m.div
        animate={{ width: `${clamped * PERCENT_SCALE}%` }}
        className={cn('h-full rounded-full', TONE_FILL[resolvedTone])}
        initial={shouldReduceMotion ? false : { width: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.2, 0, 0, 1] }}
      />
    </div>
  );
}
