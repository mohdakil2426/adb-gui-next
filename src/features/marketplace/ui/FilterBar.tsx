import { ArrowDownWideNarrow, LayoutGrid, List, Package } from 'lucide-react';
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
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Switch } from '@/shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';

type MarketplaceSortBy = backend.MarketplaceSortBy;
type ProviderSource = backend.ProviderSource;

const SORT_OPTIONS: { value: MarketplaceSortBy; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'downloads', label: 'Most popular' },
  { value: 'recentlyUpdated', label: 'Recently updated' },
  { value: 'name', label: 'Alphabetical' },
];

export function FilterBar({ resultCount }: { resultCount: number }) {
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);
  const setActiveProviders = useMarketplaceStore((state) => state.setActiveProviders);
  const setAllProviders = useMarketplaceStore((state) => state.setAllProviders);
  const sortBy = useMarketplaceStore((state) => state.sortBy);
  const setSortBy = useMarketplaceStore((state) => state.setSortBy);
  const viewMode = useMarketplaceStore((state) => state.viewMode);
  const setViewMode = useMarketplaceStore((state) => state.setViewMode);
  const resultsPerProvider = useMarketplaceStore((state) => state.resultsPerProvider);
  const installableOnly = useMarketplaceStore((state) => state.installableOnly);
  const setInstallableOnly = useMarketplaceStore((state) => state.setInstallableOnly);
  const githubApkOnly = useMarketplaceStore((state) => state.githubApkOnly);
  const setGithubApkOnly = useMarketplaceStore((state) => state.setGithubApkOnly);

  const summaries = getMarketplaceActiveFilterSummary({
    activeProviders,
    githubApkOnly,
    installableOnly,
    resultsPerProvider,
    sortBy,
  });
  const allActive = (activeProviders ?? []).length === MARKETPLACE_PROVIDERS.length;
  const isGithubActive = activeProviders.includes('GitHub');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex @xl:flex-row flex-col @xl:items-center @xl:justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-caption text-muted-foreground uppercase tracking-wide">Sources</p>
          <ToggleGroup
            className="flex flex-wrap justify-start"
            onValueChange={(values) => {
              setActiveProviders(values as ProviderSource[]);
            }}
            size="sm"
            type="multiple"
            value={activeProviders}
            variant="outline"
          >
            {MARKETPLACE_PROVIDERS.map((provider) => (
              <ToggleGroupItem key={provider.id} value={provider.id}>
                {provider.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            onClick={setAllProviders}
            size="sm"
            type="button"
            variant={allActive ? 'secondary' : 'ghost'}
          >
            All
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            className="flex items-center gap-2 text-caption text-muted-foreground"
            htmlFor="marketplace-installable-only"
          >
            <Switch
              checked={installableOnly}
              id="marketplace-installable-only"
              onCheckedChange={setInstallableOnly}
            />
            Installable only
          </label>

          <label
            className="flex items-center gap-2 text-caption text-muted-foreground"
            htmlFor="marketplace-github-apk-only"
            title={
              isGithubActive
                ? 'GitHub: verified .apk/.apks/.xapk releases (Komi assetMatchesPlatform)'
                : 'Enable GitHub to filter APK/APKS'
            }
          >
            <Switch
              checked={githubApkOnly}
              disabled={!isGithubActive}
              id="marketplace-github-apk-only"
              onCheckedChange={setGithubApkOnly}
            />
            <Package aria-hidden="true" className="size-3.5" />
            APK/APKS only
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" type="button" variant="outline">
                <ArrowDownWideNarrow aria-hidden="true" data-icon="inline-start" />
                {SORT_OPTIONS.find((option) => option.value === sortBy)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
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
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToggleGroup
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
            <ToggleGroupItem aria-label="Grid view" value="grid">
              <LayoutGrid aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem aria-label="List view" value="list">
              <List aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="numeric text-caption text-muted-foreground">
          {resultCount} result{resultCount === 1 ? '' : 's'}
        </span>
        {summaries.map((summary) => (
          <Badge key={summary} variant="neutral">
            {summary}
          </Badge>
        ))}
      </div>
    </div>
  );
}
