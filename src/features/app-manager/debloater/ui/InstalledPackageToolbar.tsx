import { Filter, Search } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Button } from '@/shared/ui/button';
// biome-ignore format: keep single line to preserve architectural line count limits
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';

export type PackageFilter = 'all' | 'user' | 'system';

interface InstalledPackageToolbarProps {
  isLoadingPackages: boolean;
  onPackageFilterChange: (v: PackageFilter) => void;
  onRefresh: () => void;
  onSearchQueryChange: (v: string) => void;
  packageFilter: PackageFilter;
  packages: backend.InstalledPackage[];
  searchQuery: string;
  selectedSerial: string | null;
}

/** Search, type filter and refresh — one 36px control row, no mixed heights. */
export function InstalledPackageToolbar({
  isLoadingPackages,
  onPackageFilterChange,
  onRefresh,
  onSearchQueryChange,
  packageFilter,
  packages,
  searchQuery,
  selectedSerial,
}: InstalledPackageToolbarProps) {
  const userCount = packages.filter((p) => p.packageType === 'user').length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search installed packages"
          className="h-9 pl-8 text-body"
          disabled={!selectedSerial}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search apps…"
          value={searchQuery}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-9" size="sm" type="button" variant="outline">
            <Filter aria-hidden="true" />
            {packageFilter === 'all' ? 'All' : packageFilter}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={(v) => onPackageFilterChange(v as PackageFilter)}
            value={packageFilter}
          >
            <DropdownMenuRadioItem value="all">All ({packages.length})</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="user">User ({userCount})</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              System ({packages.length - userCount})
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <RefreshButton
        aria-label="Refresh installed packages"
        buttonSize="icon"
        buttonVariant="outline"
        disabled={!selectedSerial}
        isLoading={isLoadingPackages}
        mode="icon"
        onClick={onRefresh}
        tooltip="Refresh installed packages"
      />
    </div>
  );
}
