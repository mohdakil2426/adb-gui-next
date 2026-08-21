import { m, useReducedMotion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { TONE_STROKE, TONE_TEXT, type Tone } from '@/features/dashboard/model/tone';
import { cn } from '@/shared/utils/cn';
import { EMPTY_VALUE, formatPercent, usageRatio } from '@/shared/utils/format';

interface BatteryGaugeProps {
  isCharging: boolean;
  levelPct: number | null;
  tone: Tone;
}

const SIZE = 128;
const CENTER = SIZE / 2;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2 - 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INNER_STROKE = 3;
const INNER_RADIUS = RADIUS - STROKE - 5;
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS;
const PERCENT_SCALE = 100;

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/** Instrument bezel: a minor tick every 5%, a stronger one every 25%. */
function BezelTicks() {
  const ticks = Array.from({ length: 21 }, (_, index) => index * 5);
  return (
    <g>
      {ticks.map((pct) => {
        const major = pct % 25 === 0;
        const angle = (pct / PERCENT_SCALE) * 2 * Math.PI - Math.PI / 2;
        const inner = RADIUS + 4;
        const outer = RADIUS + (major ? 10 : 7);
        return (
          <line
            className={major ? 'stroke-muted-foreground/50' : 'stroke-border'}
            key={pct}
            strokeWidth={major ? 1.5 : 1}
            x1={CENTER + Math.cos(angle) * inner}
            x2={CENTER + Math.cos(angle) * outer}
            y1={CENTER + Math.sin(angle) * inner}
            y2={CENTER + Math.sin(angle) * outer}
          />
        );
      })}
    </g>
  );
}

/** Hand-drawn dual-arc radial gauge with charging aura and instrument bezel. */
export function BatteryGauge({ isCharging, levelPct, tone }: BatteryGaugeProps) {
  const shouldReduceMotion = useReducedMotion();
  const ratio = levelPct === null ? 0 : usageRatio(levelPct, PERCENT_SCALE);
  const filled = CIRCUMFERENCE * ratio;
  const label =
    levelPct === null
      ? 'Battery level unavailable'
      : `Battery ${levelPct}%${isCharging ? ', charging' : ''}`;

  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex size-32 shrink-0 items-center justify-center"
      initial={{ opacity: 0, scale: 0.96 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, ease: EASE_STANDARD }}
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
        className="size-32 -rotate-90"
        role="img"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <BezelTicks />
        {/* Track */}
        <circle
          className="stroke-secondary"
          cx={CENTER}
          cy={CENTER}
          fill="none"
          r={RADIUS}
          strokeWidth={STROKE}
        />
        {/* Main level arc */}
        {levelPct === null ? null : (
          <m.circle
            animate={{ strokeDashoffset: CIRCUMFERENCE - filled }}
            className={cn(TONE_STROKE[tone])}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            initial={shouldReduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
            r={RADIUS}
            strokeLinecap="round"
            strokeWidth={STROKE}
            style={{ strokeDasharray: CIRCUMFERENCE }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: EASE_STANDARD, delay: 0.1 }
            }
          />
        )}
        {/* Inner charging aura ring */}
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
            strokeDasharray={`${INNER_CIRCUMFERENCE * 0.75} ${INNER_CIRCUMFERENCE * 0.25}`}
            strokeDashoffset={-INNER_CIRCUMFERENCE * 0.25}
            strokeLinecap="round"
            strokeWidth={INNER_STROKE}
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
            }
          />
        ) : null}
      </svg>

      <div aria-hidden="true" className="absolute flex select-none flex-col items-center gap-0.5">
        <m.span
          animate={{ y: 0, opacity: 1 }}
          className={cn('numeric font-semibold text-display tracking-tight', TONE_TEXT[tone])}
          initial={shouldReduceMotion ? false : { y: 4, opacity: 0 }}
          key={levelPct ?? 'empty'}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE_STANDARD }}
        >
          {levelPct === null ? EMPTY_VALUE : formatPercent(ratio)}
        </m.span>
        {isCharging ? (
          <m.span
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [1, 0.6, 1] }}
            className={cn('flex items-center gap-1 font-medium text-caption', TONE_TEXT[tone])}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
            }
          >
            <Zap aria-hidden="true" className="size-3 fill-current" />
            Charging
          </m.span>
        ) : (
          <span className="text-caption text-muted-foreground">Battery</span>
        )}
      </div>
    </m.div>
  );
}
