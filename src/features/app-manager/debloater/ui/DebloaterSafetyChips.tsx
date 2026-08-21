import type { backend } from '@/desktop/models';
import type { RemovalFilter } from '@/features/app-manager/debloater/model/debloatStore';
import { cn } from '@/shared/utils/cn';
import { SAFETY_CHIP_DEFS } from './debloaterConstants';

interface DebloaterSafetyChipsProps {
  onRemovalFilterChange: (v: RemovalFilter) => void;
  packagesCount: number;
  removalFilter: RemovalFilter;
  tierCounts: Record<backend.RemovalTier, number>;
}

export function DebloaterSafetyChips({
  onRemovalFilterChange,
  packagesCount,
  removalFilter,
  tierCounts,
}: DebloaterSafetyChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-caption text-muted-foreground">Safety:</span>
      {SAFETY_CHIP_DEFS.map((chip) => {
        const isActive = removalFilter === chip.tier;
        const count = chip.tier === 'All' ? packagesCount : (tierCounts[chip.tier] ?? 0);

        return (
          <button
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption transition-colors duration-90 ease-standard',
              isActive
                ? chip.active
                : 'border-border/80 bg-surface-raised/40 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
              count === 0 && !isActive && 'opacity-60',
            )}
            key={chip.tier}
            onClick={() => onRemovalFilterChange(chip.tier)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                chip.dot,
                isActive && chip.tier === 'All' && 'bg-primary-foreground',
              )}
            />
            <span className="font-medium">{chip.label}</span>
            <span
              className={cn(
                'numeric ml-0.5 text-[10px]',
                isActive ? 'opacity-90' : 'text-muted-foreground',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
