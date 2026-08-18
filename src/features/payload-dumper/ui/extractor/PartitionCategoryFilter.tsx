import { useMemo } from 'react';
import {
  CATEGORY_DOT_CLASSES,
  getPartitionCategory,
  type PartitionCategory,
} from '@/features/payload-dumper/utils/partitionCategories';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

export type CategoryFilterType = 'all' | PartitionCategory;

interface PartitionCategoryFilterProps {
  activeCategory: CategoryFilterType;
  onSelectCategory: (category: CategoryFilterType) => void;
  partitions: Array<{ name: string; size: number }>;
}

export function PartitionCategoryFilter({
  partitions,
  activeCategory,
  onSelectCategory,
}: PartitionCategoryFilterProps) {
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilterType, number> = {
      all: partitions.length,
      boot: 0,
      modem: 0,
      other: 0,
      system: 0,
    };
    for (const p of partitions) {
      const cat = getPartitionCategory(p.name);
      counts[cat]++;
    }
    return counts;
  }, [partitions]);

  const filterButtons: Array<{ id: CategoryFilterType; label: string; dot?: string }> = [
    { id: 'all', label: 'All Partitions' },
    { dot: CATEGORY_DOT_CLASSES.boot, id: 'boot', label: 'Boot & Kernel' },
    { dot: CATEGORY_DOT_CLASSES.system, id: 'system', label: 'Dynamic OS' },
    { dot: CATEGORY_DOT_CLASSES.modem, id: 'modem', label: 'Modem & Radio' },
    { dot: CATEGORY_DOT_CLASSES.other, id: 'other', label: 'Other' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filterButtons.map((btn) => {
        const count = categoryCounts[btn.id];
        const isActive = activeCategory === btn.id;

        return (
          <Button
            className={cn(
              'h-7 rounded-md px-2.5 font-medium text-caption transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-border/50 bg-surface-raised/60 text-muted-foreground hover:bg-surface-raised hover:text-foreground',
            )}
            key={btn.id}
            onClick={() => onSelectCategory(btn.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {btn.dot ? (
              <span aria-hidden="true" className={cn('mr-1.5 size-2 rounded-full', btn.dot)} />
            ) : null}
            {btn.label}
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.2 font-mono text-[10px] tabular-nums',
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-surface text-muted-foreground',
              )}
            >
              {count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
