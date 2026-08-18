import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils/cn';
import {
  ALL_REMOVAL_TIERS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from './debloaterUtils';

export function SafetyTierLegend({ expertMode }: { expertMode: boolean }) {
  return (
    <section
      aria-label="Safety tier reference"
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-none"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <h3 className="font-semibold text-caption text-muted-foreground uppercase tracking-wider">
            Universal Android Debloater (UAD) Safety Classification
          </h3>
        </div>

        <Badge className="text-[10px]" variant="neutral">
          UAD Community Standard
        </Badge>
      </div>

      {/* 4-Column responsive risk level grid */}
      <div className="grid @3xl:grid-cols-4 @md:grid-cols-2 grid-cols-1 gap-2">
        {ALL_REMOVAL_TIERS.filter((t) => t !== 'Unlisted').map((tier) => (
          <div
            className="flex flex-col gap-1 rounded-md border border-border/50 bg-surface-raised/40 p-2"
            key={tier}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.2 font-medium text-[10px]',
                  REMOVAL_TIER_CLASSES[tier].badge,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-1.2 rounded-full', REMOVAL_TIER_CLASSES[tier].dot)}
                />
                {REMOVAL_TIER_LABELS[tier]}
              </span>
            </div>
            <span className="text-caption text-muted-foreground leading-snug">
              {REMOVAL_TIER_MEANINGS[tier]}
            </span>
          </div>
        ))}
      </div>

      {expertMode ? (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-muted/40 px-2.5 py-1.5 text-caption text-warning">
          <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="font-medium">
            Expert Mode is active — Unsafe packages can now be selected. Ensure you create a state
            snapshot before debloating.
          </span>
        </div>
      ) : null}
    </section>
  );
}
