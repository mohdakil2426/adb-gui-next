import { m, useReducedMotion } from 'framer-motion';
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
  const shouldReduceMotion = useReducedMotion();
  const ratio = levelPct === null ? 0 : usageRatio(levelPct, PERCENT_SCALE);
  const filled = CIRCUMFERENCE * ratio;
  const innerFilled = isCharging ? INNER_CIRCUMFERENCE * 0.75 : 0;
  const label =
    levelPct === null
      ? 'Battery level unavailable'
      : `Battery ${levelPct}%${isCharging ? ', charging' : ''}`;

  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex size-30 shrink-0 items-center justify-center"
      initial={{ opacity: 0, scale: 0.96 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.2, 0, 0, 1] }}
    >
      {isCharging ? (
        <m.div
          animate={
            shouldReduceMotion
              ? { scale: 1, opacity: 0.1 }
              : { scale: [1, 1.12, 1], opacity: [0.08, 0.18, 0.08] }
          }
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full border border-current opacity-10',
            TONE_TEXT[tone],
          )}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
          }
        />
      ) : null}
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
          <m.circle
            animate={{ strokeDashoffset: CIRCUMFERENCE - filled }}
            className={cn(TONE_STROKE[tone])}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            r={RADIUS}
            strokeLinecap="round"
            strokeWidth={STROKE}
            style={{ strokeDasharray: CIRCUMFERENCE }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: [0.2, 0, 0, 1], delay: 0.1 }
            }
          />
        )}

        {/* Inner Charging Aura Ring */}
        {isCharging ? (
          <m.circle
            animate={
              shouldReduceMotion
                ? { scale: 1, opacity: 0.4 }
                : { scale: [1, 1.08, 1], opacity: [0.5, 0.8, 0.5] }
            }
            className={cn(TONE_STROKE[tone], 'opacity-40')}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={INNER_RADIUS}
            strokeDasharray={`${innerFilled} ${INNER_CIRCUMFERENCE - innerFilled}`}
            strokeDashoffset={-INNER_CIRCUMFERENCE * 0.25}
            strokeLinecap="round"
            strokeWidth={2}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
            }
          />
        ) : null}
      </svg>

      <m.div
        animate={{ opacity: 1 }}
        aria-hidden="true"
        className="absolute flex select-none flex-col items-center gap-0.5"
        initial={{ opacity: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { delay: 0.3, duration: 0.25, ease: [0.2, 0, 0, 1] }
        }
      >
        <m.span
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          className={cn('numeric font-semibold text-display tracking-tight', TONE_TEXT[tone])}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: 4, opacity: 0 }}
          key={levelPct ?? 'empty'}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0, 0, 1] }
          }
        >
          {levelPct === null ? EMPTY_VALUE : formatPercent(ratio)}
        </m.span>
        {isCharging ? (
          <m.span
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [1, 0.6, 1] }}
            className={cn('flex items-center gap-1 font-medium text-[11px]', TONE_TEXT[tone])}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
            }
          >
            <Zap className="size-3 fill-current" />
            Charging
          </m.span>
        ) : null}
      </m.div>
    </m.div>
  );
}
