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
  { id: 'IzzyOnDroid', label: 'IzzyOnDroid' },
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={allActive ? 'default' : 'outline'}
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={setAllProviders}
          >
            All sources
          </Button>
          {PROVIDERS.map((provider) => {
            const isActive = activeProviders.includes(provider.id);
            return (
              <Button
                key={provider.id}
                variant={isActive ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => toggleProvider(provider.id)}
              >
                {provider.label}
              </Button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 px-3 text-xs">
                <ArrowDownWideNarrow className="size-3.5" />
                {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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

          <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-7', viewMode === 'grid' && 'bg-background shadow-sm')}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-7', viewMode === 'list' && 'bg-background shadow-sm')}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          <span>
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
        {summaries.map((summary) => (
          <Badge
            key={summary}
            variant="outline"
            className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {summary}
          </Badge>
        ))}
      </div>
    </div>
  );
}
