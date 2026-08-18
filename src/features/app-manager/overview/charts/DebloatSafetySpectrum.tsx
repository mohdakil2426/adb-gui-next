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

export function DebloatSafetySpectrum({
  onOpenDebloat,
  tiers,
  totalPackages,
}: DebloatSafetySpectrumProps) {
  const debloatableTotal = tiers.recommended + tiers.advanced + tiers.expert;
  const essentialTotal = Math.max(0, totalPackages - debloatableTotal);
  const total = totalPackages || 1;

  const slices = [
    {
      color: 'rgb(16 185 129)', // emerald-500
      count: tiers.recommended,
      dotClass: 'bg-emerald-500',
      key: 'recommended',
      label: 'Safe to Remove',
    },
    {
      color: 'rgb(245 158 11)', // amber-500
      count: tiers.advanced,
      dotClass: 'bg-amber-500',
      key: 'advanced',
      label: 'Advanced',
    },
    {
      color: 'rgb(249 115 22)', // orange-500
      count: tiers.expert,
      dotClass: 'bg-orange-500',
      key: 'expert',
      label: 'Expert',
    },
    {
      color: 'oklch(0.55 0 0)', // muted neutral
      count: essentialTotal,
      dotClass: 'bg-muted-foreground/40',
      key: 'essential',
      label: 'System Core',
    },
  ].filter((s) => s.count > 0);

  const sliceSum = slices.reduce((sum, s) => sum + s.count, 0) || 1;
  const showGap = slices.length > 1;
  let offset = 0;

  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <h3 className="font-medium text-foreground text-label">Debloat Health & Safety</h3>
        </div>
        <span className="numeric font-medium text-caption text-emerald-500">
          {debloatableTotal} debloatable
        </span>
      </div>

      {/* Donut + Breakdown */}
      <div className="flex items-center gap-4 py-1">
        {/* Mini SVG Donut */}
        <div className="relative flex size-24 shrink-0 items-center justify-center">
          <svg
            aria-label={`Debloat breakdown: ${tiers.recommended} safe, ${tiers.advanced} advanced, ${tiers.expert} expert, ${essentialTotal} system`}
            className="size-full rotate-[-90deg]"
            role="img"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            {slices.map((slice) => {
              const length = (slice.count / sliceSum) * CIRCUMFERENCE;
              const dash = showGap ? Math.max(0, length - GAP) : length;
              const circle = (
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  fill="none"
                  key={slice.key}
                  r={RADIUS}
                  stroke={slice.color}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  strokeWidth={STROKE}
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

        {/* 4-tier Legend List */}
        <div className="flex flex-1 flex-col gap-1.5">
          {slices.map((slice) => (
            <div className="flex items-center justify-between text-body" key={slice.key}>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${slice.dotClass}`}
                />
                <span className="text-muted-foreground">{slice.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="numeric font-medium text-foreground">{slice.count}</span>
                <span className="numeric w-9 text-right text-caption text-muted-foreground">
                  {formatPercent(usageRatio(slice.count, total))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Strip */}
      <div className="flex items-center justify-between border-border/50 border-t pt-2">
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span>UAD community rules</span>
        </div>
        <Button
          className="h-7 gap-1 px-2.5 text-caption"
          onClick={onOpenDebloat}
          size="sm"
          variant="outline"
        >
          <span>Open Debloater</span>
          <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
