import { useVirtualizer } from '@tanstack/react-virtual';
import { Filter, Loader2, Package, Search, Trash2 } from 'lucide-react';
import { useMemo, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
// biome-ignore format: keep single line to preserve architectural line count limits
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';
// biome-ignore format: keep single line to preserve architectural line count limits
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/utils/cn';

export function InstalledPackageList({
  isLoadingPackages,
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
}: {
  isLoadingPackages: boolean;
  isUninstalling: boolean;
  onPackageFilterChange: (v: 'all' | 'user' | 'system') => void;
  onRefresh: () => void;
  onSearchQueryChange: (v: string) => void;
  onSelectedPackagesChange: (v: Set<string>) => void;
  onUninstall: () => void;
  packageFilter: 'all' | 'user' | 'system';
  packages: backend.InstalledPackage[];
  searchQuery: string;
  selectedPackages: Set<string>;
  selectedSerial: string | null;
}) {
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
    estimateSize: () => 48,
    getItemKey: (i) => filteredPackages[i]?.name ?? i,
    getScrollElement: () => listRef.current,
    overscan: 5,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  function togglePackage(name: string) {
    const next = new Set(selectedPackages);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onSelectedPackagesChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-sm">Uninstall Apps</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search installed packages"
              className="h-9 pl-8"
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search packages…"
              value={searchQuery}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-9 gap-1.5 text-xs" size="sm" variant="outline">
                <Filter className="size-3.5" />
                {packageFilter === 'all' ? 'All' : packageFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                onValueChange={(v) => onPackageFilterChange(v as 'all' | 'user' | 'system')}
                value={packageFilter}
              >
                <DropdownMenuRadioItem value="all">All ({packages.length})</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="user">
                  User ({packages.filter((p) => p.packageType === 'user').length})
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  System ({packages.filter((p) => p.packageType === 'system').length})
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <RefreshButton
            aria-label="Refresh packages"
            buttonSize="icon"
            buttonVariant="outline"
            className="size-9"
            isLoading={isLoadingPackages}
            mode="icon"
            onClick={onRefresh}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
          <span>
            {isLoadingPackages
              ? 'Loading packages…'
              : `${filteredPackages.length} of ${packages.length} packages`}
          </span>
        </div>
      </div>

      <div
        aria-label="Installed packages"
        aria-multiselectable="true"
        className="h-[40vh] min-h-60 overflow-y-auto overflow-x-hidden rounded-lg border shadow-sm"
        ref={listRef}
        role="listbox"
      >
        {filteredPackages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            {searchQuery ? 'No packages match your search.' : 'No packages found.'}
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
              return (
                <div
                  aria-selected={isSelected}
                  className={cn(
                    'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 px-3 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/60 text-accent-foreground',
                  )}
                  key={pkg.name}
                  onClick={() => togglePackage(pkg.name)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      togglePackage(pkg.name);
                    }
                  }}
                  role="option"
                  style={{ height: `${vRow.size}px`, transform: `translateY(${vRow.start}px)` }}
                  tabIndex={0}
                >
                  <CheckboxItem checked={isSelected} />
                  <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    <Package className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col py-1">
                    <span className="truncate font-semibold text-foreground text-xs leading-tight">
                      {pkg.label || pkg.name}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground leading-tight">
                      {pkg.name}
                    </span>
                  </div>
                  <Badge
                    className="ml-2 shrink-0 px-1.5 py-0 text-[10px]"
                    variant={pkg.packageType === 'user' ? 'secondary' : 'outline'}
                  >
                    {pkg.packageType}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SelectionSummaryBar
        count={selectedPackages.size}
        label="package(s)"
        onClear={() => onSelectedPackagesChange(new Set())}
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="w-full"
            disabled={isUninstalling || selectedPackages.size === 0 || !selectedSerial}
            variant="destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Uninstall
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  You are about to uninstall{' '}
                  <span className="font-semibold text-foreground">{selectedPackages.size}</span>{' '}
                  package(s).
                </p>
                <div className="mt-2 max-h-24 overflow-y-auto rounded bg-muted p-2 text-xs">
                  {Array.from(selectedPackages).map((p) => {
                    const pkg = packages.find((x) => x.name === p);
                    const displayName = pkg ? `${pkg.label} (${pkg.name})` : p;
                    return (
                      <div className="truncate" key={p}>
                        {displayName}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-md border border-warning/20 bg-warning/10 p-3 text-left text-warning-foreground text-xs">
                  <span className="font-bold">Disclaimer:</span> ADB GUI Next is not responsible for
                  any system instability, bootloops, or data loss resulting from uninstalling
                  packages.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={isUninstalling || !selectedSerial}
              onClick={onUninstall}
            >
              {isUninstalling ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Yes, Uninstall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
