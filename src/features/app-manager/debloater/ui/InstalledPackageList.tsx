import { useVirtualizer } from '@tanstack/react-virtual';
import { Filter, Loader2, Package, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useRef } from 'react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Command, CommandEmpty, CommandInput } from '@/shared/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
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
        return pkg.name.toLowerCase().includes(q);
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
    estimateSize: () => 36,
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
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Uninstall Package</p>
          <p className="text-muted-foreground text-xs">
            {isLoadingPackages
              ? 'Loading…'
              : `${filteredPackages.length} of ${packages.length} packages`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 gap-1.5 text-xs" size="sm" variant="outline">
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
          <Button
            className="size-8"
            disabled={isLoadingPackages || !selectedSerial}
            onClick={onRefresh}
            size="icon"
            variant="outline"
          >
            {isLoadingPackages ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <Command className="overflow-hidden rounded-lg border shadow-sm" shouldFilter={false}>
        <CommandInput
          onValueChange={onSearchQueryChange}
          placeholder="Search packages…"
          value={searchQuery}
        />
        <div
          aria-label="Installed packages"
          aria-multiselectable="true"
          className="h-[40vh] min-h-60 overflow-y-auto overflow-x-hidden"
          ref={listRef}
          role="listbox"
        >
          {filteredPackages.length === 0 ? (
            <CommandEmpty>
              {searchQuery ? 'No packages match your search.' : 'No packages found.'}
            </CommandEmpty>
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
                      'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent text-accent-foreground',
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
                    <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                      <Package className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="flex-1 truncate text-xs">{pkg.name}</span>
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
      </Command>

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
                  {Array.from(selectedPackages).map((p) => (
                    <div className="truncate" key={p}>
                      {p}
                    </div>
                  ))}
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
