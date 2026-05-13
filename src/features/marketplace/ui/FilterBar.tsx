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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { backend } from '@/lib/desktop/models';
import { getMarketplaceActiveFilterSummary, useMarketplaceStore } from '@/lib/marketplaceStore';
import { cn } from '@/lib/utils';

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
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);
  const toggleProvider = useMarketplaceStore((state) => state.toggleProvider);
  const setAllProviders = useMarketplaceStore((state) => state.setAllProviders);
  const sortBy = useMarketplaceStore((state) => state.sortBy);
  const setSortBy = useMarketplaceStore((state) => state.setSortBy);
  const viewMode = useMarketplaceStore((state) => state.viewMode);
  const setViewMode = useMarketplaceStore((state) => state.setViewMode);
  const resultsPerProvider = useMarketplaceStore((state) => state.resultsPerProvider);

  const summaries = getMarketplaceActiveFilterSummary({
    activeProviders,
    sortBy,
    resultsPerProvider,
  });
  const allActive = activeProviders.length === PROVIDERS.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Sources
        </h4>
        <div className="flex flex-col gap-1">
          <Button
            className="w-full justify-start font-medium text-xs"
            onClick={setAllProviders}
            size="sm"
            variant={allActive ? 'default' : 'ghost'}
          >
            All sources
          </Button>
          {PROVIDERS.map((provider) => {
            const isActive = activeProviders.includes(provider.id);
            return (
              <Button
                className={cn(
                  'w-full justify-start font-medium text-xs',
                  !isActive && 'text-muted-foreground',
                )}
                key={provider.id}
                onClick={() => {
                  toggleProvider(provider.id);
                }}
                size="sm"
                variant={isActive ? 'secondary' : 'ghost'}
              >
                {provider.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          View Mode
        </h4>
        <ToggleGroup
          className="grid w-full grid-cols-2"
          onValueChange={(value) => {
            if (value === 'grid' || value === 'list') {
              setViewMode(value);
            }
          }}
          size="sm"
          type="single"
          value={viewMode}
          variant="outline"
        >
          <ToggleGroupItem aria-label="Grid view" className="gap-2" value="grid">
            <LayoutGrid aria-hidden="true" />
            Grid
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="List view" className="gap-2" value="list">
            <List aria-hidden="true" />
            List
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Sort By
        </h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="w-full justify-start gap-2 font-normal text-muted-foreground text-xs"
              size="sm"
              variant="outline"
            >
              <ArrowDownWideNarrow
                aria-hidden="true"
                className="text-foreground"
                data-icon="inline-start"
              />
              <span className="font-medium text-foreground">
                {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Sort results</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                setSortBy(value as MarketplaceSortBy);
              }}
              value={sortBy}
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

      <div className="flex flex-col gap-3">
        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Active Filters
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mb-1 flex w-full items-center gap-2 text-muted-foreground text-xs">
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            <span>
              {resultCount} result{resultCount === 1 ? '' : 's'}
            </span>
          </div>
          {summaries.length > 0 ? (
            summaries.map((summary) => (
              <Badge
                className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground"
                key={summary}
                variant="outline"
              >
                {summary}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">No active filters</span>
          )}
        </div>
      </div>
    </div>
  );
}
