import { Store, UserRound } from 'lucide-react';
import { AppCard } from '@/components/marketplace/AppCard';
import { AppDetailView } from '@/components/marketplace/AppDetailView';
import { AppListItem } from '@/components/marketplace/AppListItem';
import { AttributionFooter } from '@/components/marketplace/AttributionFooter';
import { FilterBar } from '@/components/marketplace/FilterBar';
import { MarketplaceEmptyState } from '@/components/marketplace/MarketplaceEmptyState';
import { MarketplaceSettings } from '@/components/marketplace/MarketplaceSettings';
import { SearchBar } from '@/components/marketplace/SearchBar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarketplaceSearch } from '@/lib/marketplace/useMarketplaceSearch';
import { useMarketplaceStore } from '@/lib/marketplaceStore';

export function ViewMarketplace() {
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const openSettings = useMarketplaceStore((state) => state.openSettings);
  const viewMode = useMarketplaceStore((state) => state.viewMode);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const githubSession = useMarketplaceStore((state) => state.githubSession);
  const selectedApp = useMarketplaceStore((state) => state.selectedApp);
  const isDetailOpen = useMarketplaceStore((state) => state.isDetailOpen);
  const {
    localQuery,
    results,
    isSearching,
    hasQuery,
    handleInputChange,
    handleClear,
    handleQuickSearch,
  } = useMarketplaceSearch();

  const hasResults = results.length > 0;

  return (
    <div className="relative flex flex-col gap-6 lg:flex-row">
      <h1 className="sr-only">Marketplace</h1>
      {/* Left Sidebar */}
      <div className="z-10 flex h-fit w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:w-56 xl:w-64">
        <Card>
          <CardHeader className="gap-2 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store aria-hidden="true" className="size-5" />
              Marketplace
            </CardTitle>
            <CardDescription className="text-xs">
              Discover and install Android apps directly over ADB.
            </CardDescription>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                className="rounded-full px-2 py-0 text-[10px] text-muted-foreground"
                variant="outline"
              >
                4 providers
              </Badge>
              <Badge
                className="rounded-full px-2 py-0 text-[10px] text-muted-foreground"
                variant="outline"
              >
                {githubSession.user ? (
                  <span className="flex items-center gap-1">
                    <UserRound aria-hidden="true" className="size-3" />
                    {githubSession.user.login}
                  </span>
                ) : (
                  'Anonymous'
                )}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Card className="flex-1 shadow-sm">
          <CardContent className="p-4">
            <FilterBar resultCount={results.length} />
          </CardContent>
        </Card>
      </div>

      {/* Right Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 pt-1 pb-4 backdrop-blur-md">
          <SearchBar
            isSearching={isSearching}
            onChange={handleInputChange}
            onClear={handleClear}
            onSelectHistory={handleQuickSearch}
            onSettings={openSettings}
            searchHistory={searchHistory}
            value={localQuery}
          />
        </div>

        {selectedApp && isDetailOpen ? (
          <AppDetailView />
        ) : hasResults ? (
          <div className="mt-2 flex flex-col gap-4 pb-12">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Search Results</h3>
              <span className="text-muted-foreground text-xs">Showing {results.length} apps</span>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {results.map((app) => (
                  <AppCard
                    app={app}
                    key={`${app.source}-${app.packageName}`}
                    onSelect={() => {
                      openDetail(app);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map((app) => (
                  <AppListItem
                    app={app}
                    key={`${app.source}-${app.packageName}`}
                    onSelect={() => {
                      openDetail(app);
                    }}
                  />
                ))}
              </div>
            )}

            <div className="mt-8">
              <AttributionFooter />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex-1 pb-12">
            <MarketplaceEmptyState
              hasQuery={hasQuery}
              isSearching={isSearching}
              onQuickSearch={handleQuickSearch}
            />
            {!(hasQuery || isSearching) && (
              <div className="mt-12">
                <AttributionFooter />
              </div>
            )}
          </div>
        )}
      </div>

      <MarketplaceSettings />
    </div>
  );
}
