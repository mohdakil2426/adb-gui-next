import type { backend } from '@/desktop/models';
import { cn } from '@/shared/utils/cn';
import {
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
  REMOVAL_TIER_MEANINGS,
} from './debloaterUtils';

/**
 * Detail for the highlighted row. Mounted only while a row is highlighted —
 * an always-present empty box reserved vertical space for nothing.
 */
export function DescriptionPanel({ pkg }: { pkg: backend.DebloatPackageRow }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 truncate font-medium font-mono text-foreground text-mono">
          {pkg.name}
        </span>
        <span className="flex items-center gap-1 text-caption text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn('inline-block size-2 rounded-full', PKG_STATE_CLASSES[pkg.state])}
          />
          {PKG_STATE_LABELS[pkg.state]}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 font-medium text-caption',
            REMOVAL_TIER_CLASSES[pkg.removal].badge,
          )}
        >
          {REMOVAL_TIER_LABELS[pkg.removal]}
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-caption text-muted-foreground">
          {pkg.list}
        </span>
      </div>

      <p className="text-caption text-muted-foreground">{REMOVAL_TIER_MEANINGS[pkg.removal]}</p>

      <p className="text-body text-muted-foreground">
        {pkg.description || 'The debloat list carries no description for this package.'}
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-muted-foreground">
        <span className="min-w-0">
          <span className="font-medium text-foreground">Depends on:</span>{' '}
          {pkg.dependencies.length > 0 ? pkg.dependencies.join(', ') : 'nothing'}
        </span>
        <span className="min-w-0">
          <span className="font-medium text-foreground">Needed by:</span>{' '}
          {pkg.neededBy.length > 0 ? pkg.neededBy.join(', ') : 'nothing'}
        </span>
      </div>
    </section>
  );
}
