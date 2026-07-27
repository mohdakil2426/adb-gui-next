import { Zap } from 'lucide-react';
import { TONE_STROKE, TONE_TEXT, type Tone } from '@/features/dashboard/model/tone';
import { cn } from '@/shared/utils/cn';
import { EMPTY_VALUE, formatPercent, usageRatio } from '@/shared/utils/format';

interface BatteryGaugeProps {
  isCharging: boolean;
  /** 0–100, or `null` when the device did not report a level. */
  levelPct: number | null;
  tone: Tone;
}

const SIZE = 132;
const STROKE = 9;
const CENTER = SIZE / 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PERCENT_SCALE = 100;

/**
 * Hand-drawn radial gauge.
 *
 * A charge level is the one number on this screen that must be readable from
 * across a desk, so it gets a dedicated arc rather than a chart library's
 * generic radial bar: an arc, a colour, and one large tabular figure.
 */
export function BatteryGauge({ isCharging, levelPct, tone }: BatteryGaugeProps) {
  const ratio = levelPct === null ? 0 : usageRatio(levelPct, PERCENT_SCALE);
  const filled = CIRCUMFERENCE * ratio;
  const label =
    levelPct === null
      ? 'Battery level unavailable'
      : `Battery ${levelPct}%${isCharging ? ', charging' : ''}`;

  return (
    <div className="relative flex size-33 shrink-0 items-center justify-center">
      <svg
        aria-label={label}
        className="size-33 -rotate-90"
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <circle
          className="stroke-border"
          cx={CENTER}
          cy={CENTER}
          fill="none"
          r={RADIUS}
          strokeWidth={STROKE}
        />
        {levelPct === null ? null : (
          <circle
            className={cn(TONE_STROKE[tone])}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={RADIUS}
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
        )}
      </svg>

      <div aria-hidden="true" className="absolute flex flex-col items-center gap-0.5">
        <span className={cn('numeric font-semibold text-display', TONE_TEXT[tone])}>
          {levelPct === null ? EMPTY_VALUE : formatPercent(ratio)}
        </span>
        {isCharging ? (
          <span className={cn('flex items-center gap-1 text-caption', TONE_TEXT[tone])}>
            <Zap className="size-3" />
            Charging
          </span>
        ) : null}
      </div>
    </div>
  );
}
