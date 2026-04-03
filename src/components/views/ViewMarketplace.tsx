import { Store, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/marketplace/SearchBar';
import { FilterBar } from '@/components/marketplace/FilterBar';
import { AppCard } from '@/components/marketplace/AppCard';
import { AppListItem } from '@/components/marketplace/AppListItem';
import { MarketplaceEmptyState } from '@/components/marketplace/MarketplaceEmptyState';
import { AttributionFooter } from '@/components/marketplace/AttributionFooter';
import { AppDetailDialog } from '@/components/AppDetailDialog';
import { MarketplaceSettings } from '@/components/marketplace/MarketplaceSettings';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import { useMarketplaceSearch } from '@/lib/marketplace/useMarketplaceSearch';

export function ViewMarketplace() {
  const { openDetail, openSettings, viewMode, searchHistory, githubSession } =
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Store className="size-5" />
                Marketplace
              </CardTitle>
              <CardDescription>
                Discover Android apps from trusted open-source and community sources, then install
                them directly over ADB.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                4 providers
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {githubSession.user ? (
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3.5" />
                    {githubSession.user.login}
                  </span>
                ) : (
                  'Anonymous mode'
                )}
              </Badge>
            </div>
          </div>
          <SearchBar
            value={localQuery}
            onChange={handleInputChange}
            onClear={handleClear}
            onSettings={openSettings}
            onSelectHistory={handleQuickSearch}
            isSearching={isSearching}
            searchHistory={searchHistory}
          />
          <FilterBar resultCount={results.length} />
        </CardHeader>
      </Card>

      {hasResults ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Search results</CardTitle>
            <CardDescription>
              Browse grouped provider results, then open details or install an available APK.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[62vh] overflow-y-auto">
              {viewMode === 'grid' ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((app) => (
                    <AppCard
                      key={`${app.source}-${app.packageName}`}
                      app={app}
                      onSelect={() => openDetail(app)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((app) => (
                    <AppListItem
                      key={`${app.source}-${app.packageName}`}
                      app={app}
                      onSelect={() => openDetail(app)}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <MarketplaceEmptyState
              isSearching={isSearching}
              hasQuery={hasQuery}
              onQuickSearch={handleQuickSearch}
            />
          </CardContent>
        </Card>
      )}

      <AttributionFooter />
      <MarketplaceSettings />
      <AppDetailDialog />
    </div>
  );
}
