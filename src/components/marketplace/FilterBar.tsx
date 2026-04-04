import { ArrowDownWideNarrow, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getMarketplaceActiveFilterSummary, useMarketplaceStore } from '@/lib/marketplaceStore';
import type { backend } from '@/lib/desktop/models';

type ProviderSource = backend.ProviderSource;
type MarketplaceSortBy = backend.MarketplaceSortBy;

const PROVIDERS: { id: ProviderSource; label: string }[] = [
  { id: 'F-Droid', label: 'F-Droid' },
  { id: 'GitHub', label: 'GitHub' },
  { id: 'Aptoide', label: 'Aptoide' },
];

const SORT_OPTIONS: { value: MarketplaceSortBy; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'downloads', label: 'Most popular' },
  { value: 'recentlyUpdated', label: 'Recently updated' },
  { value: 'name', label: 'Alphabetical' },
];

interface FilterBarProps {
  resultCount: number;
}

export function FilterBar({ resultCount }: FilterBarProps) {
  const {
    activeProviders,
    toggleProvider,
    setAllProviders,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    resultsPerProvider,
  } = useMarketplaceStore();

  const summaries = getMarketplaceActiveFilterSummary({
    activeProviders,
    sortBy,
    resultsPerProvider,
  });
  const allActive = activeProviders.length === PROVIDERS.length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sources
        </h4>
        <div className="flex flex-col gap-1">
          <Button
            variant={allActive ? 'default' : 'ghost'}
            size="sm"
            className="w-full justify-start text-xs font-medium"
            onClick={setAllProviders}
          >
            All sources
          </Button>
          {PROVIDERS.map((provider) => {
            const isActive = activeProviders.includes(provider.id);
            return (
              <Button
                key={provider.id}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start text-xs font-medium',
                  !isActive && 'text-muted-foreground',
                )}
                onClick={() => toggleProvider(provider.id)}
              >
                {provider.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          View Mode
        </h4>
        <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex-1 h-8 gap-2 hover:bg-transparent',
              viewMode === 'grid'
                ? 'bg-background shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid className="size-3.5" />
            Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'flex-1 h-8 gap-2 hover:bg-transparent',
              viewMode === 'list'
                ? 'bg-background shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List className="size-3.5" />
            List
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sort By
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-muted-foreground font-normal"
            >
              <ArrowDownWideNarrow className="size-3.5 text-foreground" />
              <span className="text-foreground font-medium">
                {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Sort results</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sortBy}
              onValueChange={(value) => setSortBy(value as MarketplaceSortBy)}
            >
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active Filters
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-2 text-xs text-muted-foreground mb-1">
            <SlidersHorizontal className="size-3.5" />
            <span>
              {resultCount} result{resultCount !== 1 ? 's' : ''}
            </span>
          </div>
          {summaries.length > 0 ? (
            summaries.map((summary) => (
              <Badge
                key={summary}
                variant="outline"
                className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {summary}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No active filters</span>
          )}
        </div>
      </div>
    </div>
  );
}
