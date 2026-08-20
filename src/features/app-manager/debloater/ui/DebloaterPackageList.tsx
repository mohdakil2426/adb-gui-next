/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckSquare2,
  Loader2,
  SearchX,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
} from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { DebloaterPackageRow } from './DebloaterPackageRow';
import { DEBLOAT_ROW_HEIGHT, PACKAGE_LIST_VIEWPORT } from './debloaterUtils';
import { PackageListEmpty, PackageListSkeleton } from './PackageListState';

const EMPTY_PENDING_SET = new Set<string>();

export interface DebloaterListFlags {
  disableMode: boolean;
  expertMode: boolean;
  hasPackages: boolean;
  isApplying: boolean;
  isLoadingPackages: boolean;
}

interface DebloaterPackageListProps {
  currentPackageName: string | null;
  filteredPackages: backend.DebloatPackageRow[];
  flags: DebloaterListFlags;
  onClearFilters: () => void;
  onCurrentPackageNameChange: (name: string) => void;
  onReview: () => void;
  onSelectAllRecommended?: () => void;
  onSelectToggle: (name: string) => void;
  onSelectUnselectAll: () => void;
  onSingleAction?: (pkg: backend.DebloatPackageRow, action: backend.DebloatAction) => void;
  pendingPackageNames?: Set<string>;
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
  if (!selectedSerial) {
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
  filteredPackages,
  flags,
  onClearFilters,
  onCurrentPackageNameChange,
  onReview,
  onSelectAllRecommended,
  onSelectToggle,
  onSelectUnselectAll,
  onSingleAction,
  pendingPackageNames = EMPTY_PENDING_SET,
  selectedPackages,
  selectedSerial,
}: DebloaterPackageListProps) {
  const { disableMode, expertMode, hasPackages, isApplying, isLoadingPackages } = flags;
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    estimateSize: () => DEBLOAT_ROW_HEIGHT,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    getScrollElement: () => listRef.current,
    overscan: 8,
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
    <div className="flex flex-col gap-2">
      <div
        aria-label="System packages"
        aria-multiselectable="true"
        className={cn(
          PACKAGE_LIST_VIEWPORT,
          'select-none overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-surface',
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

              return (
                <DebloaterPackageRow
                  currentPackageName={currentPackageName}
                  disableMode={disableMode}
                  expertMode={expertMode}
                  isPending={pendingPackageNames.has(pkg.name)}
                  isSelected={selectedPackages.has(pkg.name)}
                  key={pkg.name}
                  onCurrentPackageNameChange={onCurrentPackageNameChange}
                  onSelectToggle={onSelectToggle}
                  onSingleAction={onSingleAction}
                  pkg={pkg}
                  selectedSerial={selectedSerial}
                  size={vRow.size}
                  start={vRow.start}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Action Band ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
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
                <Square aria-hidden="true" data-icon="inline-start" />
                Select all ({filteredPackages.length})
              </>
            )}
          </Button>

          {onSelectAllRecommended ? (
            <Button
              className="gap-1.5 border-success/30 text-caption text-success hover:bg-success-muted hover:text-success"
              disabled={filteredPackages.length === 0}
              onClick={onSelectAllRecommended}
              size="sm"
              type="button"
              variant="outline"
            >
              <Sparkles aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Select Recommended
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          {selectedPackages.size > 0 ? (
            <span className="numeric text-caption text-muted-foreground">
              {selectedPackages.size} package{selectedPackages.size === 1 ? '' : 's'} queued
            </span>
          ) : null}

          <Button
            disabled={selectedPackages.size === 0 || isApplying || !selectedSerial}
            onClick={onReview}
            size="sm"
            type="button"
            variant="default"
          >
            {isApplying ? (
              <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
            ) : (
              <ShieldCheck aria-hidden="true" data-icon="inline-start" />
            )}
            Review & Debloat ({selectedPackages.size})
          </Button>
        </div>
      </div>
    </div>
  );
}
