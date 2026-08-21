import { m, useReducedMotion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatPercent, usageRatio } from '@/shared/utils/format';

interface DebloatSafetySpectrumProps {
  onOpenDebloat: () => void;
  tiers: {
    advanced: number;
    expert: number;
    recommended: number;
    unsafe: number;
  };
  totalPackages: number;
}

const SIZE = 108;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

export function DebloatSafetySpectrum({
  onOpenDebloat,
  tiers,
  totalPackages,
}: DebloatSafetySpectrumProps) {
  const shouldReduceMotion = useReducedMotion();
  const debloatableTotal = tiers.recommended + tiers.advanced + tiers.expert;
  const essentialTotal = Math.max(0, totalPackages - debloatableTotal);
  const total = totalPackages || 1;

  const slices = [
    {
      colorClass: 'stroke-success',
      count: tiers.recommended,
      dotClass: 'bg-success',
      key: 'recommended',
      label: 'Safe to Remove',
    },
    {
      colorClass: 'stroke-info',
      count: tiers.advanced,
      dotClass: 'bg-info',
      key: 'advanced',
      label: 'Advanced',
    },
    {
      colorClass: 'stroke-warning',
      count: tiers.expert,
      dotClass: 'bg-warning',
      key: 'expert',
      label: 'Expert',
    },
    {
      colorClass: 'stroke-muted-foreground/40',
      count: essentialTotal,
      dotClass: 'bg-muted-foreground/40',
      key: 'essential',
      label: 'System Core',
    },
  ].filter((slice) => slice.count > 0);

  const sliceSum = slices.reduce((sum, slice) => sum + slice.count, 0) || 1;
  const showGap = slices.length > 1;
  let offset = 0;

  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-success" />
          <h3 className="font-medium text-foreground text-label">Debloat Health & Safety</h3>
        </div>
        <span className="numeric font-medium text-caption text-success">
          {debloatableTotal} debloatable
        </span>
      </div>

      {/* Donut + breakdown */}
      <div className="flex items-center gap-4 py-1">
        <div className="relative flex size-24 shrink-0 items-center justify-center">
          <svg
            aria-label={`Debloat breakdown: ${tiers.recommended} safe, ${tiers.advanced} advanced, ${tiers.expert} expert, ${essentialTotal} system`}
            className="size-full rotate-[-90deg]"
            role="img"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            {slices.map((slice, index) => {
              const length = (slice.count / sliceSum) * CIRCUMFERENCE;
              const dash = showGap ? Math.max(0, length - GAP) : length;
              const circle = (
                <m.circle
                  animate={{ opacity: 1 }}
                  className={slice.colorClass}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  fill="none"
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  key={slice.key}
                  r={RADIUS}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  strokeWidth={STROKE}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.32, delay: 0.1 + index * 0.08, ease: EASE_STANDARD }
                  }
                />
              );
              offset += length;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="numeric font-semibold text-foreground text-headline">
              {debloatableTotal}
            </span>
            <span className="text-caption text-muted-foreground">debloat</span>
          </div>
        </div>

        {/* Four-tier legend list */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {slices.map((slice, index) => (
            <m.div
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between text-body"
              initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
              key={slice.key}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.28, delay: 0.15 + index * 0.06, ease: EASE_STANDARD }
              }
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${slice.dotClass}`}
                />
                <span className="truncate text-muted-foreground">{slice.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="numeric font-medium text-foreground">{slice.count}</span>
                <span className="numeric w-9 text-right text-caption text-muted-foreground">
                  {formatPercent(usageRatio(slice.count, total))}
                </span>
              </div>
            </m.div>
          ))}
        </div>
      </div>

      {/* Bottom action strip */}
      <div className="flex items-center justify-between border-border/50 border-t pt-2">
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          <span>UAD community rules</span>
        </div>
        <Button
          className="h-7 gap-1 px-2.5 text-caption"
          onClick={onOpenDebloat}
          size="sm"
          type="button"
          variant="outline"
        >
          <span>Open Debloater</span>
          <ArrowRight aria-hidden="true" className="size-3" data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
