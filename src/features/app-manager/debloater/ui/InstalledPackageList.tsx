/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */

import { useVirtualizer } from '@tanstack/react-virtual';
import { Package, SearchX, Smartphone } from 'lucide-react';
import { type ReactNode, useMemo, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { useAppIcons } from '@/features/app-manager/hooks/useAppIcons';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { INSTALLED_ROW_HEIGHT, PACKAGE_LIST_VIEWPORT } from './debloaterUtils';
import { InstalledPackageRow } from './InstalledPackageRow';
import { InstalledPackageToolbar, type PackageFilter } from './InstalledPackageToolbar';
import { PackageListEmpty, PackageListError, PackageListSkeleton } from './PackageListState';
import { UninstallConfirmDialog } from './UninstallConfirmDialog';

interface InstalledPackageListProps {
  /** `true` once a load for the current serial settled — separates "empty" from "not yet asked". */
  hasLoaded: boolean;
  isLoadingPackages: boolean;
  isUninstalling: boolean;
  /** Why the last load failed, or `null` — separates "no apps" from "could not ask". */
  loadError: string | null;
  onPackageFilterChange: (v: PackageFilter) => void;
  onRefresh: () => void;
  onSearchQueryChange: (v: string) => void;
  onSelectedPackagesChange: (v: Set<string>) => void;
  onUninstall: () => void;
  packageFilter: PackageFilter;
  packages: backend.InstalledPackage[];
  searchQuery: string;
  selectedPackages: Set<string>;
  selectedSerial: string | null;
}

/**
 * Which of the four non-list states applies, or `null` to render rows.
 *
 * "No packages found." used to cover both "this device reported nothing" and
 * "no device is connected", which read as "this phone has no apps".
 */
function resolveListState({
  filteredCount,
  hasLoaded,
  isLoadingPackages,
  loadError,
  onPackageFilterChange,
  onRefresh,
  onSearchQueryChange,
  packageCount,
  selectedSerial,
}: {
  filteredCount: number;
  hasLoaded: boolean;
  isLoadingPackages: boolean;
  loadError: string | null;
  onPackageFilterChange: (v: PackageFilter) => void;
  onRefresh: () => void;
  onSearchQueryChange: (v: string) => void;
  packageCount: number;
  selectedSerial: string | null;
}): ReactNode {
  if (!selectedSerial) {
    return (
      <PackageListEmpty
        description="Connect a device over USB and pick it in the sidebar — its installed apps appear here."
        icon={Smartphone}
        title="No device selected"
      />
    );
  }
  if (isLoadingPackages && packageCount === 0) {
    return <PackageListSkeleton rowHeight={INSTALLED_ROW_HEIGHT} />;
  }
  // Before the empty branch: a failed `pm list` is not an empty device.
  if (loadError) {
    return <PackageListError message={loadError} onRetry={onRefresh} />;
  }
  if (packageCount === 0) {
    return (
      <PackageListEmpty
        action={
          <Button onClick={onRefresh} size="sm" type="button" variant="outline">
            Try again
          </Button>
        }
        description={
          hasLoaded
            ? 'The device returned an empty package list. Unlock the screen, reconnect the cable, then refresh.'
            : 'Waiting for the device to report its packages.'
        }
        icon={Package}
        title="No packages reported"
      />
    );
  }
  if (filteredCount === 0) {
    return (
      <PackageListEmpty
        action={
          <Button
            onClick={() => {
              onSearchQueryChange('');
              onPackageFilterChange('all');
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear search and filter
          </Button>
        }
        description={`None of the ${packageCount} installed packages match the current search and type filter.`}
        icon={SearchX}
        title="No matches"
      />
    );
  }
  return null;
}

export function InstalledPackageList({
  hasLoaded,
  isLoadingPackages,
  loadError,
  isUninstalling,
  onPackageFilterChange,
  onRefresh,
  onSearchQueryChange,
  onSelectedPackagesChange,
  onUninstall,
  packageFilter,
  packages,
  searchQuery,
  selectedPackages,
  selectedSerial,
}: InstalledPackageListProps) {
  const filteredPackages = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return packages
      .filter((pkg) => {
        if (packageFilter !== 'all' && pkg.packageType !== packageFilter) {
          return false;
        }
        return pkg.name.toLowerCase().includes(q) || pkg.label.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aSelected = selectedPackages.has(a.name);
        const bSelected = selectedPackages.has(b.name);
        if (aSelected && !bSelected) {
          return -1;
        }
        if (!aSelected && bSelected) {
          return 1;
        }
        return 0;
      });
  }, [packageFilter, packages, searchQuery, selectedPackages]);

  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPackages.length,
    estimateSize: () => INSTALLED_ROW_HEIGHT,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    getScrollElement: () => listRef.current,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const visiblePackageNames = virtualRows
    .map((row) => filteredPackages[row.index]?.name)
    .filter((name): name is string => Boolean(name));
  const icons = useAppIcons(selectedSerial, visiblePackageNames);

  function togglePackage(name: string) {
    const next = new Set(selectedPackages);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onSelectedPackagesChange(next);
  }

  const listState = resolveListState({
    filteredCount: filteredPackages.length,
    hasLoaded,
    isLoadingPackages,
    loadError,
    onPackageFilterChange,
    onRefresh,
    onSearchQueryChange,
    packageCount: packages.length,
    selectedSerial,
  });

  return (
    <div className="flex flex-col gap-3">
      <InstalledPackageToolbar
        isLoadingPackages={isLoadingPackages}
        onPackageFilterChange={onPackageFilterChange}
        onRefresh={onRefresh}
        onSearchQueryChange={onSearchQueryChange}
        packageFilter={packageFilter}
        packages={packages}
        searchQuery={searchQuery}
        selectedSerial={selectedSerial}
      />

      <div
        aria-label="Installed packages"
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
              return (
                <InstalledPackageRow
                  height={vRow.size}
                  iconSrc={icons[pkg.name]}
                  isSelected={selectedPackages.has(pkg.name)}
                  key={pkg.name}
                  onToggle={togglePackage}
                  pkg={pkg}
                  start={vRow.start}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="numeric text-caption text-muted-foreground">
          {isLoadingPackages
            ? 'Loading packages…'
            : `${filteredPackages.length} of ${packages.length} packages`}
        </span>
      </div>

      <SelectionSummaryBar
        count={selectedPackages.size}
        label="package(s)"
        onClear={() => onSelectedPackagesChange(new Set())}
      />

      <UninstallConfirmDialog
        isUninstalling={isUninstalling}
        onUninstall={onUninstall}
        packages={packages}
        selectedPackages={selectedPackages}
        selectedSerial={selectedSerial}
      />
    </div>
  );
}
