import type { backend } from '@/lib/desktop/models';
import { cn } from '@/lib/utils';
import {
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
} from './debloaterUtils';

interface DescriptionPanelProps {
  pkg: backend.DebloatPackageRow | null;
}

export function DescriptionPanel({ pkg }: DescriptionPanelProps) {
  if (!pkg) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a package to see details.
      </div>
    );
  }

  const tierClasses = REMOVAL_TIER_CLASSES[pkg.removal];
  const stateClass = PKG_STATE_CLASSES[pkg.state];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-medium text-foreground">{pkg.name}</span>
        {/* State dot + label */}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className={cn('inline-block size-2 rounded-full', stateClass)} />
          {PKG_STATE_LABELS[pkg.state]}
        </span>
        {/* Safety badge */}
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
            tierClasses.badge,
          )}
        >
          {REMOVAL_TIER_LABELS[pkg.removal]}
        </span>
        {/* List badge */}
        <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
          {pkg.list}
        </span>
      </div>

      {pkg.description ? (
        <p className="text-muted-foreground leading-relaxed">{pkg.description}</p>
      ) : (
        <p className="italic text-muted-foreground">No description available.</p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          <span className="text-foreground font-medium">Dependencies:</span>{' '}
          {pkg.dependencies.length > 0 ? pkg.dependencies.join(', ') : 'none'}
        </span>
        <span>
          <span className="text-foreground font-medium">Needed by:</span>{' '}
          {pkg.neededBy.length > 0 ? pkg.neededBy.join(', ') : 'none'}
        </span>
      </div>
    </div>
  );
}
