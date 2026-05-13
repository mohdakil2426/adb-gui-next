/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */
import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckSquare2, Loader2, Square } from 'lucide-react';
import { useRef } from 'react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { PKG_STATE_CLASSES, REMOVAL_TIER_CLASSES, REMOVAL_TIER_LABELS } from './debloaterUtils';

export function DebloaterPackageList({
  currentPackageName,
  expertMode,
  filteredPackages,
  isApplying,
  isLoadingPackages,
  onCurrentPackageNameChange,
  onReview,
  onSelectToggle,
  onSelectUnselectAll,
  selectedPackages,
}: {
  currentPackageName: string | null;
  expertMode: boolean;
  filteredPackages: backend.DebloatPackageRow[];
  isApplying: boolean;
  isLoadingPackages: boolean;
  onCurrentPackageNameChange: (name: string) => void;
  onReview: () => void;
  onSelectToggle: (name: string) => void;
  onSelectUnselectAll: () => void;
  selectedPackages: Set<string>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    estimateSize: () => 36,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    getScrollElement: () => listRef.current,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      <div
        aria-label="System packages"
        aria-multiselectable="true"
        className="h-[38vh] min-h-60 overflow-y-auto overflow-x-hidden rounded-lg border"
        ref={listRef}
        role="listbox"
      >
        {isLoadingPackages ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading packages…
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No packages found.
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualRows.map((vRow) => {
              const pkg = filteredPackages[vRow.index];
              if (!pkg) {
                return null;
              }
              const isSelected = selectedPackages.has(pkg.name);
              const isCurrent = currentPackageName === pkg.name;
              const tierClasses = REMOVAL_TIER_CLASSES[pkg.removal];
              const stateClass = PKG_STATE_CLASSES[pkg.state];
              const isUnsafeBlocked = pkg.removal === 'Unsafe' && !expertMode;

              return (
                <div
                  aria-selected={isSelected}
                  className={cn(
                    'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 px-3 text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/60 text-accent-foreground',
                    isCurrent && !isSelected && 'bg-muted/60',
                    isUnsafeBlocked && 'cursor-not-allowed opacity-50',
                  )}
                  key={pkg.name}
                  onClick={() => {
                    onCurrentPackageNameChange(pkg.name);
                    if (!isUnsafeBlocked) {
                      onSelectToggle(pkg.name);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      onCurrentPackageNameChange(pkg.name);
                      if (!isUnsafeBlocked) {
                        onSelectToggle(pkg.name);
                      }
                    }
                  }}
                  role="option"
                  style={{ height: `${vRow.size}px`, transform: `translateY(${vRow.start}px)` }}
                  tabIndex={0}
                >
                  <CheckboxItem checked={isSelected} />
                  <span className={cn('size-2 shrink-0 rounded-full', stateClass)} />
                  <span className="flex-1 truncate font-mono text-xs">{pkg.name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium text-[9px] text-muted-foreground">
                    {pkg.list}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 font-medium text-[9px]',
                      tierClasses.badge,
                    )}
                  >
                    {REMOVAL_TIER_LABELS[pkg.removal]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          className="h-8 text-xs"
          disabled={filteredPackages.length === 0}
          onClick={onSelectUnselectAll}
          size="sm"
          variant="ghost"
        >
          {selectedPackages.size > 0 ? (
            <>
              <CheckSquare2 data-icon="inline-start" />
              Unselect All
            </>
          ) : (
            <>
              <Square data-icon="inline-start" />
              Select All
            </>
          )}
        </Button>
        <Button
          disabled={selectedPackages.size === 0 || isApplying}
          onClick={onReview}
          size="sm"
          variant="default"
        >
          {isApplying ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          Review ({selectedPackages.size})
        </Button>
      </div>
    </>
  );
}
