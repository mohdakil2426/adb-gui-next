/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */

import { useVirtualizer } from '@tanstack/react-virtual';
import { Package, SearchX, Smartphone } from 'lucide-react';
import { type ReactNode, useMemo, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';
import type {
  InstalledPackageFilter,
  InstalledSortBy,
  SortOrder,
} from '@/features/app-manager/debloater/model/installationStore';
import { useAppIcons } from '@/features/app-manager/hooks/useAppIcons';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { getPackageMetrics, INSTALLED_ROW_HEIGHT, PACKAGE_LIST_VIEWPORT } from './debloaterUtils';
import { InstalledPackageRow } from './InstalledPackageRow';
import { InstalledPackageToolbar } from './InstalledPackageToolbar';
import { PackageListEmpty, PackageListError, PackageListSkeleton } from './PackageListState';

interface InstalledPackageListProps {
  hasLoaded: boolean;
  isLoadingPackages: boolean;
  isUninstalling: boolean;
  loadError: string | null;
  onForceStop?: ((name: string) => void) | undefined;
  onInspect?: ((name: string) => void) | undefined;
  onLaunch?: ((name: string) => void) | undefined;
  onPackageFilterChange: (filter: InstalledPackageFilter) => void;
  onRefresh: () => void;
  onSearchQueryChange: (query: string) => void;
  onSelectedPackagesChange: (selected: Set<string>) => void;
  onSortChange: (sortBy: InstalledSortBy, sortOrder: SortOrder) => void;
  packageFilter: InstalledPackageFilter;
  packages: backend.InstalledPackage[];
  searchQuery: string;
  selectedPackages: Set<string>;
  selectedSerial: string | null;
  sortBy: InstalledSortBy;
  sortOrder: SortOrder;
}

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
  onPackageFilterChange: (filter: InstalledPackageFilter) => void;
  onRefresh: () => void;
  onSearchQueryChange: (query: string) => void;
  packageCount: number;
  selectedSerial: string | null;
}): ReactNode {
  if (!selectedSerial) {
    return (
      <PackageListEmpty
        action={
          <Button onClick={onRefresh} size="sm" variant="outline">
            Check connection
          </Button>
        }
        description="Select an active device from the toolbar to inspect and manage installed apps."
        icon={Smartphone}
        title="No device selected"
      />
    );
  }
  if (isLoadingPackages && !hasLoaded) {
    return <PackageListSkeleton rowHeight={INSTALLED_ROW_HEIGHT} />;
  }

  if (loadError) {
    return <PackageListError message={loadError} onRetry={onRefresh} />;
  }

  if (packageCount === 0) {
    return (
      <PackageListEmpty
        description="No packages were reported by the device package manager."
        icon={Package}
        title="No installed apps"
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
            variant="outline"
          >
            Clear filters
          </Button>
        }
        description="Try adjusting your search query or package filter to find what you're looking for."
        icon={SearchX}
        title="No matching apps"
      />
    );
  }

  return null;
}

export function InstalledPackageList({
  hasLoaded,
  isLoadingPackages,
  loadError,
  onForceStop,
  onInspect,
  onLaunch,
  onPackageFilterChange,
  onRefresh,
  onSearchQueryChange,
  onSelectedPackagesChange,
  onSortChange,
  packageFilter,
  packages,
  searchQuery,
  selectedPackages,
  selectedSerial,
  sortBy,
  sortOrder,
}: InstalledPackageListProps) {
  const debloatPackages = useDebloatStore((s) => s.packages);

  const disabledPackageNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of debloatPackages) {
      if (p.state === 'Disabled') {
        set.add(p.name);
      }
    }
    return set;
  }, [debloatPackages]);

  const metricsMap = useMemo(() => {
    const map = new Map<string, { apkSizeBytes: number; targetSdk: number }>();
    for (const pkg of packages) {
      map.set(pkg.name, getPackageMetrics(pkg.name, pkg.packageType));
    }
    return map;
  }, [packages]);

  const userCount = useMemo(
    () =>
      packages.filter((p) => p.packageType === 'user' && !disabledPackageNames.has(p.name)).length,
    [packages, disabledPackageNames],
  );

  const systemCount = useMemo(
    () =>
      packages.filter((p) => p.packageType !== 'user' && !disabledPackageNames.has(p.name)).length,
    [packages, disabledPackageNames],
  );

  const disabledCount = useMemo(
    () => packages.filter((p) => disabledPackageNames.has(p.name)).length,
    [packages, disabledPackageNames],
  );

  const filteredPackages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return packages
      .filter((pkg) => {
        const isDisabled = disabledPackageNames.has(pkg.name);
        if (packageFilter === 'user' && (pkg.packageType !== 'user' || isDisabled)) {
          return false;
        }
        if (packageFilter === 'system' && (pkg.packageType === 'user' || isDisabled)) {
          return false;
        }
        if (packageFilter === 'disabled' && !isDisabled) {
          return false;
        }
        if (!q) {
          return true;
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

        let cmp = 0;
        if (sortBy === 'name') {
          const aLabel = a.label || a.name;
          const bLabel = b.label || b.name;
          cmp = aLabel.localeCompare(bLabel);
        } else if (sortBy === 'package') {
          cmp = a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
          const aSize = metricsMap.get(a.name)?.apkSizeBytes ?? 0;
          const bSize = metricsMap.get(b.name)?.apkSizeBytes ?? 0;
          cmp = aSize - bSize;
        } else if (sortBy === 'targetSdk') {
          const aSdk = metricsMap.get(a.name)?.targetSdk ?? 0;
          const bSdk = metricsMap.get(b.name)?.targetSdk ?? 0;
          cmp = aSdk - bSdk;
        }

        return sortOrder === 'desc' ? -cmp : cmp;
      });
  }, [
    disabledPackageNames,
    metricsMap,
    packageFilter,
    packages,
    searchQuery,
    selectedPackages,
    sortBy,
    sortOrder,
  ]);

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

  const isAllFilteredSelected =
    filteredPackages.length > 0 && filteredPackages.every((p) => selectedPackages.has(p.name));

  function toggleSelectAllFiltered() {
    const next = new Set(selectedPackages);
    if (isAllFilteredSelected) {
      for (const p of filteredPackages) {
        next.delete(p.name);
      }
    } else {
      for (const p of filteredPackages) {
        next.add(p.name);
      }
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
      {/* Precision Hardware Toolbar */}
      <InstalledPackageToolbar
        disabledCount={disabledCount}
        isAllFilteredSelected={isAllFilteredSelected}
        isLoadingPackages={isLoadingPackages}
        onPackageFilterChange={onPackageFilterChange}
        onRefresh={onRefresh}
        onSearchQueryChange={onSearchQueryChange}
        onSortChange={onSortChange}
        onToggleSelectAllFiltered={toggleSelectAllFiltered}
        packageFilter={packageFilter}
        packages={packages}
        searchQuery={searchQuery}
        selectedSerial={selectedSerial}
        sortBy={sortBy}
        sortOrder={sortOrder}
        systemCount={systemCount}
        userCount={userCount}
      />

      {/* Virtualized Package Listbox */}
      {/* Virtualized Package Listbox Container with Table Header */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
        {/* Table Column Header Band */}
        <div className="flex select-none items-center gap-3 border-border/80 border-b bg-surface-raised/60 px-3.5 py-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          <div className="size-4 shrink-0" />
          <div className="size-7 shrink-0" />
          <div className="flex-1">Application & Package Name</div>
          <div className="@md:block hidden w-20 shrink-0 text-center">Target SDK</div>
          <div className="@sm:block hidden w-24 shrink-0 text-right">Storage Size</div>
          <div className="w-20 shrink-0 text-center">Type</div>
          <div className="w-24 shrink-0 pr-2 text-right">Actions</div>
        </div>

        <div
          aria-label="Installed packages"
          aria-multiselectable="true"
          className={cn(PACKAGE_LIST_VIEWPORT, 'overflow-y-auto overflow-x-hidden')}
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
                const metrics = metricsMap.get(pkg.name) ?? {
                  apkSizeBytes: 0,
                  targetSdk: 34,
                };
                return (
                  <InstalledPackageRow
                    apkSizeBytes={metrics.apkSizeBytes}
                    height={vRow.size}
                    iconSrc={icons[pkg.name]}
                    isDisabled={disabledPackageNames.has(pkg.name)}
                    isSelected={selectedPackages.has(pkg.name)}
                    key={pkg.name}
                    onForceStop={onForceStop}
                    onInspect={onInspect}
                    onLaunch={onLaunch}
                    onToggle={togglePackage}
                    pkg={pkg}
                    start={vRow.start}
                    targetSdk={metrics.targetSdk}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Footer Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-caption text-muted-foreground">
        <span className="numeric font-mono">
          {isLoadingPackages
            ? 'Loading packages…'
            : `${filteredPackages.length} of ${packages.length} packages displayed`}
        </span>
        {selectedPackages.size > 0 ? (
          <span className="numeric font-medium text-foreground">
            {selectedPackages.size} selected
          </span>
        ) : null}
      </div>
    </div>
  );
}
