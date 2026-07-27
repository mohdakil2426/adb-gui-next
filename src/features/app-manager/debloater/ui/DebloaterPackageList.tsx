/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */
import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckSquare2, Loader2, SearchX, ShieldCheck, Smartphone, Square } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import {
  DEBLOAT_ROW_HEIGHT,
  PACKAGE_LIST_VIEWPORT,
  PKG_STATE_CLASSES,
  PKG_STATE_LABELS,
  REMOVAL_TIER_CLASSES,
  REMOVAL_TIER_LABELS,
} from './debloaterUtils';
import { PackageListEmpty, PackageListSkeleton } from './PackageListState';

interface DebloaterPackageListProps {
  currentPackageName: string | null;
  expertMode: boolean;
  filteredPackages: backend.DebloatPackageRow[];
  hasPackages: boolean;
  isApplying: boolean;
  isLoadingPackages: boolean;
  onClearFilters: () => void;
  onCurrentPackageNameChange: (name: string) => void;
  onReview: () => void;
  onSelectToggle: (name: string) => void;
  onSelectUnselectAll: () => void;
  selectedPackages: Set<string>;
  selectedSerial: string | null;
}

/** Which non-list state applies, or `null` to render rows. */
function resolveListState({
  filteredCount,
  hasPackages,
  isLoadingPackages,
  onClearFilters,
  selectedSerial,
}: {
  filteredCount: number;
  hasPackages: boolean;
  isLoadingPackages: boolean;
  onClearFilters: () => void;
  selectedSerial: string | null;
}): ReactNode {
  if (selectedSerial === null) {
    return (
      <PackageListEmpty
        description="Connect a device over USB and pick it in the sidebar — its system packages are matched against the debloat list here."
        icon={Smartphone}
        title="No device selected"
      />
    );
  }
  if (isLoadingPackages && !hasPackages) {
    return <PackageListSkeleton rowHeight={DEBLOAT_ROW_HEIGHT} />;
  }
  if (!hasPackages) {
    return (
      <PackageListEmpty
        description="The device reported no system packages. Reconnect it and refresh — if the debloat list also failed to load, the Logs panel has the reason."
        icon={ShieldCheck}
        title="No system packages"
      />
    );
  }
  if (filteredCount === 0) {
    return (
      <PackageListEmpty
        action={
          <Button onClick={onClearFilters} size="sm" type="button" variant="outline">
            Reset filters
          </Button>
        }
        description="No system package matches the current search, list, safety and state filters."
        icon={SearchX}
        title="No matches"
      />
    );
  }
  return null;
}

export function DebloaterPackageList({
  currentPackageName,
  expertMode,
  filteredPackages,
  hasPackages,
  isApplying,
  isLoadingPackages,
  onClearFilters,
  onCurrentPackageNameChange,
  onReview,
  onSelectToggle,
  onSelectUnselectAll,
  selectedPackages,
  selectedSerial,
}: DebloaterPackageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    estimateSize: () => DEBLOAT_ROW_HEIGHT,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    getScrollElement: () => listRef.current,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const listState = resolveListState({
    filteredCount: filteredPackages.length,
    hasPackages,
    isLoadingPackages,
    onClearFilters,
    selectedSerial,
  });

  return (
    <>
      <div
        aria-label="System packages"
        aria-multiselectable="true"
        className={cn(
          PACKAGE_LIST_VIEWPORT,
          'overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-surface',
        )}
        ref={listRef}
        role="listbox"
      >
        {listState ?? (
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
              const isUnsafeBlocked = pkg.removal === 'Unsafe' && !expertMode;

              return (
                <div
                  aria-selected={isSelected}
                  className={cn(
                    'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 px-3 outline-none transition-colors duration-90 ease-standard hover:bg-accent',
                    isSelected && 'bg-primary-muted',
                    isCurrent && !isSelected && 'bg-accent',
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
                  <CheckboxItem checked={isSelected} disabled={isUnsafeBlocked} />
                  <span
                    aria-label={PKG_STATE_LABELS[pkg.state]}
                    className={cn('size-2 shrink-0 rounded-full', PKG_STATE_CLASSES[pkg.state])}
                    role="img"
                    title={PKG_STATE_LABELS[pkg.state]}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground text-mono">
                    {pkg.name}
                  </span>
                  <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-medium text-caption text-muted-foreground">
                    {pkg.list}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 font-medium text-caption',
                      REMOVAL_TIER_CLASSES[pkg.removal].badge,
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
          disabled={filteredPackages.length === 0}
          onClick={onSelectUnselectAll}
          size="sm"
          type="button"
          variant="ghost"
        >
          {selectedPackages.size > 0 ? (
            <>
              <CheckSquare2 aria-hidden="true" />
              Unselect all
            </>
          ) : (
            <>
              <Square aria-hidden="true" />
              Select all
            </>
          )}
        </Button>
        <Button
          disabled={selectedPackages.size === 0 || isApplying}
          onClick={onReview}
          size="sm"
          type="button"
          variant="default"
        >
          {isApplying ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Review ({selectedPackages.size})
        </Button>
      </div>
    </>
  );
}
