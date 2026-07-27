import { ArrowDownWideNarrow, LayoutGrid, List } from 'lucide-react';
import type { backend } from '@/desktop/models';
import {
  getMarketplaceActiveFilterSummary,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import { MARKETPLACE_PROVIDERS } from '@/features/marketplace/model/providers';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { cn } from '@/shared/utils/cn';

type MarketplaceSortBy = backend.MarketplaceSortBy;

const SORT_OPTIONS: { value: MarketplaceSortBy; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'downloads', label: 'Most popular' },
  { value: 'recentlyUpdated', label: 'Recently updated' },
  { value: 'name', label: 'Alphabetical' },
];

function GroupLabel({ children }: { children: string }) {
  return <h3 className="text-caption text-muted-foreground uppercase tracking-wide">{children}</h3>;
}

export function FilterBar({ resultCount }: { resultCount: number }) {
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
  const allActive = activeProviders.length === MARKETPLACE_PROVIDERS.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <GroupLabel>Sources</GroupLabel>
        <div className="flex flex-col gap-0.5">
          <Button
            className="w-full justify-start"
            onClick={setAllProviders}
            size="sm"
            type="button"
            variant={allActive ? 'secondary' : 'ghost'}
          >
            All sources
          </Button>
          {MARKETPLACE_PROVIDERS.map((provider) => {
            const isActive = activeProviders.includes(provider.id);
            return (
              <Button
                className={cn('w-full justify-start', !isActive && 'text-muted-foreground')}
                key={provider.id}
                onClick={() => {
                  toggleProvider(provider.id);
                }}
                size="sm"
                type="button"
                variant={isActive ? 'secondary' : 'ghost'}
              >
                {provider.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <GroupLabel>Layout</GroupLabel>
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
          <ToggleGroupItem aria-label="Grid view" className="gap-1.5" value="grid">
            <LayoutGrid aria-hidden="true" />
            Grid
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="List view" className="gap-1.5" value="list">
            <List aria-hidden="true" />
            List
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <GroupLabel>Sort by</GroupLabel>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full justify-start" size="sm" type="button" variant="outline">
              <ArrowDownWideNarrow aria-hidden="true" />
              {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
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

      <div className="flex flex-col gap-1.5">
        <GroupLabel>Active filters</GroupLabel>
        <span className="numeric text-caption text-muted-foreground">
          {resultCount} result{resultCount === 1 ? '' : 's'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {summaries.map((summary) => (
            <Badge key={summary} variant="neutral">
              {summary}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
