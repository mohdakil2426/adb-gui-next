import { ShieldAlert } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import {
  ALL_REMOVAL_TIERS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from './debloaterUtils';

/**
 * The safety tier decides whether a phone still boots, and it used to be
 * encoded only as a colour on a 9px chip with no key anywhere in the app.
 * Spelling the ladder out costs six lines and removes the guesswork.
 */
export function SafetyTierLegend({ expertMode }: { expertMode: boolean }) {
  return (
    <section
      aria-label="Safety tier reference"
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
    >
      <h3 className="flex items-center gap-1.5 text-caption text-muted-foreground uppercase tracking-wide">
        <ShieldAlert aria-hidden="true" className="size-3.5" />
        Safety tiers
      </h3>
      {/* Column count tracks the real content area (window minus sidebar), not the
          window's viewport width — sidebar collapse changes this independently. */}
      <ul className="grid @4xl:grid-cols-3 @lg:grid-cols-2 gap-x-6 gap-y-1.5">
        {ALL_REMOVAL_TIERS.map((tier) => (
          <li className="flex min-w-0 items-baseline gap-2" key={tier}>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 font-medium text-caption',
                REMOVAL_TIER_CLASSES[tier].badge,
              )}
            >
              {REMOVAL_TIER_LABELS[tier]}
            </span>
            <span className="min-w-0 text-caption text-muted-foreground">
              {REMOVAL_TIER_MEANINGS[tier]}
            </span>
          </li>
        ))}
      </ul>
      {expertMode ? (
        <p className="text-caption text-warning">
          Expert mode is on — Unsafe packages can be selected. Create a backup before applying.
        </p>
      ) : null}
    </section>
  );
}
