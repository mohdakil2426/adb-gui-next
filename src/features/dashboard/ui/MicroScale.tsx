import { m, useReducedMotion } from 'framer-motion';
import { TONE_FILL, TONE_TEXT, type Tone } from '@/features/dashboard/model/tone';
import { cn } from '@/shared/utils/cn';

export interface ScaleZone {
  /** Upper bound of the zone on the same unit as the value. */
  to: number;
  tone: Tone;
}

interface MicroScaleProps {
  /** Accessible name for the meter role. */
  ariaLabel: string;
  /** Formatted reading rendered right of the label ("32.4 °C"). */
  display: string;
  /** Human label rendered above the track ("Temperature"). */
  label: string;
  max: number;
  min: number;
  /** Actual measured value; `null` renders the track empty. */
  value: number | null;
  /** Ascending zones painted as muted tints behind the fill. */
  zones: ScaleZone[];
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * A compact instrument scale: zone tints show the safe/warm/hot ranges, the
 * fill sweeps to the current reading. Used for battery temperature and
 * voltage — values that only mean something against a range.
 */
export function MicroScale({ label, display, value, min, max, zones, ariaLabel }: MicroScaleProps) {
  const shouldReduceMotion = useReducedMotion();
  const span = max - min;
  const ratio = value === null ? 0 : Math.min(Math.max((value - min) / span, 0), 1);
  const activeTone: Tone =
    value === null ? 'neutral' : (zones.find((zone) => value <= zone.to)?.tone ?? 'neutral');

  let cursor = min;
  const segments = zones.map((zone) => {
    const width = ((Math.min(zone.to, max) - cursor) / span) * 100;
    cursor = zone.to;
    return { tone: zone.tone, width };
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-caption text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className={cn('numeric font-semibold text-label', TONE_TEXT[activeTone])}>
          {display}
        </span>
      </div>
      <div
        aria-label={ariaLabel}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value ?? undefined}
        aria-valuetext={display}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
      >
        <div aria-hidden="true" className="absolute inset-0 flex">
          {segments.map((segment, index) => (
            <div
              className={cn(
                'h-full',
                segment.tone === 'ok' && 'bg-success-muted',
                segment.tone === 'warn' && 'bg-warning-muted',
                segment.tone === 'danger' && 'bg-destructive-muted',
                segment.tone === 'neutral' && 'bg-transparent',
              )}
              key={`${segment.tone}-${index}`}
              style={{ width: `${segment.width}%` }}
            />
          ))}
        </div>
        {value === null ? null : (
          <m.div
            animate={{ scaleX: ratio }}
            className={cn('h-full w-full origin-left', TONE_FILL[activeTone])}
            initial={shouldReduceMotion ? false : { scaleX: 0 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.6, ease: EASE_STANDARD }
            }
          />
        )}
      </div>
      <div className="numeric flex items-baseline justify-between text-caption text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
