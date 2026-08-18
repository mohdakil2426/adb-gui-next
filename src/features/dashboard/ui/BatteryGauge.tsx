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

const SIZE = 120;
const STROKE = 7.5;
const CENTER = SIZE / 2;
const RADIUS = (SIZE - STROKE) / 2;
const INNER_RADIUS = RADIUS - 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;
const PERCENT_SCALE = 100;

/** Hand-drawn dual-arc radial gauge with charging aura. */
export function BatteryGauge({ isCharging, levelPct, tone }: BatteryGaugeProps) {
  const ratio = levelPct === null ? 0 : usageRatio(levelPct, PERCENT_SCALE);
  const filled = CIRCUMFERENCE * ratio;
  const innerFilled = isCharging ? INNER_CIRCUMFERENCE * 0.75 : 0;
  const label =
    levelPct === null
      ? 'Battery level unavailable'
      : `Battery ${levelPct}%${isCharging ? ', charging' : ''}`;

  return (
    <div className="relative flex size-30 shrink-0 items-center justify-center">
      <svg
        aria-label={label}
        className="size-30 -rotate-90"
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        {/* Background Outer Track */}
        <circle
          className="stroke-border/40"
          cx={CENTER}
          cy={CENTER}
          fill="none"
          r={RADIUS}
          strokeWidth={STROKE}
        />

        {/* Main Level Arc */}
        {levelPct === null ? null : (
          <circle
            className={cn(TONE_STROKE[tone], 'transition-all duration-500 ease-out')}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={RADIUS}
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
        )}

        {/* Inner Charging Aura Ring */}
        {isCharging ? (
          <circle
            className={cn(TONE_STROKE[tone], 'animate-pulse opacity-40')}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={INNER_RADIUS}
            strokeDasharray={`${innerFilled} ${INNER_CIRCUMFERENCE - innerFilled}`}
            strokeDashoffset={-INNER_CIRCUMFERENCE * 0.25}
            strokeLinecap="round"
            strokeWidth={2}
          />
        ) : null}
      </svg>

      <div aria-hidden="true" className="absolute flex select-none flex-col items-center gap-0.5">
        <span className={cn('numeric font-semibold text-display tracking-tight', TONE_TEXT[tone])}>
          {levelPct === null ? EMPTY_VALUE : formatPercent(ratio)}
        </span>
        {isCharging ? (
          <span
            className={cn(
              'flex animate-pulse items-center gap-1 font-medium text-[11px]',
              TONE_TEXT[tone],
            )}
          >
            <Zap className="size-3 fill-current" />
            Charging
          </span>
        ) : null}
      </div>
    </div>
  );
}
