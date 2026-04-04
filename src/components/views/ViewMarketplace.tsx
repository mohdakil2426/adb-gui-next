import { Store, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/marketplace/SearchBar';
import { FilterBar } from '@/components/marketplace/FilterBar';
import { AppCard } from '@/components/marketplace/AppCard';
import { AppListItem } from '@/components/marketplace/AppListItem';
import { MarketplaceEmptyState } from '@/components/marketplace/MarketplaceEmptyState';
import { AttributionFooter } from '@/components/marketplace/AttributionFooter';
import { AppDetailView } from '@/components/marketplace/AppDetailView';
import { MarketplaceSettings } from '@/components/marketplace/MarketplaceSettings';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import { useMarketplaceSearch } from '@/lib/marketplace/useMarketplaceSearch';

export function ViewMarketplace() {
  const { openDetail, openSettings, viewMode, searchHistory, githubSession, selectedApp, isDetailOpen } =
    useMarketplaceStore();
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
    <div className="flex flex-col lg:flex-row gap-6 relative">
      {/* Left Sidebar */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-56 xl:w-64 lg:sticky lg:top-2 h-fit z-10">
        <Card>
          <CardHeader className="gap-2 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="size-5" />
              Marketplace
            </CardTitle>
            <CardDescription className="text-xs">
              Discover and install Android apps directly over ADB.
            </CardDescription>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0 text-[10px] text-muted-foreground"
              >
                4 providers
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0 text-[10px] text-muted-foreground"
              >
                {githubSession.user ? (
                  <span className="flex items-center gap-1">
                    <UserRound className="size-3" />
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
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-4 pt-1 -mx-2 px-2">
          <SearchBar
            value={localQuery}
            onChange={handleInputChange}
            onClear={handleClear}
            onSettings={openSettings}
            onSelectHistory={handleQuickSearch}
            isSearching={isSearching}
            searchHistory={searchHistory}
          />
        </div>

        {selectedApp && isDetailOpen ? (
          <AppDetailView />
        ) : hasResults ? (
          <div className="flex flex-col gap-4 pb-12 mt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Search Results</h3>
              <span className="text-xs text-muted-foreground">Showing {results.length} apps</span>
            </div>
            
            {viewMode === 'grid' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {results.map((app) => (
                  <AppCard
                    key={`${app.source}-${app.packageName}`}
                    app={app}
                    onSelect={() => openDetail(app)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((app) => (
                  <AppListItem
                    key={`${app.source}-${app.packageName}`}
                    app={app}
                    onSelect={() => openDetail(app)}
                  />
                ))}
              </div>
            )}
            
            <div className="mt-8">
              <AttributionFooter />
            </div>
          </div>
        ) : (
          <div className="flex-1 pb-12 mt-2">
            <MarketplaceEmptyState
              isSearching={isSearching}
              hasQuery={hasQuery}
              onQuickSearch={handleQuickSearch}
            />
            {!hasQuery && !isSearching && (
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
