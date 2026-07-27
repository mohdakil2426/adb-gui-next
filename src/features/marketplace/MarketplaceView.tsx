import { CircleAlert, UserRound } from 'lucide-react';
import { useInstallTarget } from '@/features/marketplace/hooks/useInstallTarget';
import { useMarketplaceSearch } from '@/features/marketplace/hooks/useMarketplaceSearch';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { MARKETPLACE_PROVIDERS } from '@/features/marketplace/model/providers';
import { AppCard } from '@/features/marketplace/ui/AppCard';
import { AppDetailView } from '@/features/marketplace/ui/AppDetailView';
import { AppListItem } from '@/features/marketplace/ui/AppListItem';
import { AttributionFooter } from '@/features/marketplace/ui/AttributionFooter';
import { FilterBar } from '@/features/marketplace/ui/FilterBar';
import { MarketplaceDeviceBanner } from '@/features/marketplace/ui/MarketplaceDeviceBanner';
import { MarketplaceEmptyState } from '@/features/marketplace/ui/MarketplaceEmptyState';
import { MarketplaceSettings } from '@/features/marketplace/ui/MarketplaceSettings';
import { ResultsSkeleton } from '@/features/marketplace/ui/ResultsSkeleton';
import { SearchBar } from '@/features/marketplace/ui/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

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
    searchError,
    hasQuery,
    handleInputChange,
    handleClear,
    handleQuickSearch,
    handleRetry,
  } = useMarketplaceSearch();

  const target = useInstallTarget();
  const hasResults = results.length > 0;
  // Skeletons only for a *first* search. A refetch keeps the previous results on
  // screen — blanking the list on every keystroke made the view flash empty.
  const showSkeleton = isSearching && !hasResults;

  return (
    // `@2xl`/`@4xl` here query the shell's content-area container (ViewContent),
    // not the viewport: the sidebar collapse changes available width without
    // changing window size, so a viewport breakpoint would be blind to it.
    <div className="relative flex h-full w-full @2xl:flex-row flex-col gap-4">
      <h1 className="sr-only">Marketplace</h1>

      <div className="flex @2xl:w-56 @4xl:w-64 w-full shrink-0 flex-col gap-3">
        <Card className="gap-0 rounded-lg border-border bg-surface py-3 shadow-none">
          <CardContent className="flex flex-col gap-2 px-3">
            <MarketplaceDeviceBanner target={target} />
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="neutral">
                {MARKETPLACE_PROVIDERS.length} source
                {MARKETPLACE_PROVIDERS.length === 1 ? '' : 's'}
              </Badge>
              <Badge variant="neutral">
                {githubSession.user ? (
                  <>
                    <UserRound aria-hidden="true" />
                    {githubSession.user.login}
                  </>
                ) : (
                  'Anonymous'
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-lg border-border bg-surface py-3 shadow-none">
          <CardContent className="px-3">
            <FilterBar resultCount={results.length} />
          </CardContent>
        </Card>
      </div>

      {/* Local container: narrower than the outer view once the filter sidebar
          above claims its own width, so the results grid/hero/detail columns
          below track this pane's real width instead of the whole view's. */}
      <div className="@container flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="shrink-0">
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

        <div className="custom-scroll min-h-0 flex-1 overflow-y-auto pb-6">
          {selectedApp && isDetailOpen ? (
            <AppDetailView target={target} />
          ) : (
            <div className="flex flex-col gap-3">
              {showSkeleton ? <ResultsSkeleton viewMode={viewMode} /> : null}

              {hasResults ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-caption text-muted-foreground uppercase tracking-wide">
                      Results
                    </h2>
                    <span className="numeric text-caption text-muted-foreground">
                      {isSearching ? 'Updating…' : `${results.length} apps`}
                    </span>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="grid @4xl:grid-cols-3 @7xl:grid-cols-4 @lg:grid-cols-2 gap-3">
                      {results.map((app) => (
                        <AppCard
                          app={app}
                          key={`${app.source}-${app.packageName}`}
                          onSelect={openDetail}
                          target={target}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {results.map((app) => (
                        <AppListItem
                          app={app}
                          key={`${app.source}-${app.packageName}`}
                          onSelect={openDetail}
                          target={target}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {/* A failed request is not an empty result set: the "try a shorter
                  term" copy blames the query for a network or rate-limit error. */}
              {searchError && !(hasResults || showSkeleton) ? (
                <EmptyState
                  action={
                    <Button
                      disabled={isSearching}
                      onClick={handleRetry}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Retry search
                    </Button>
                  }
                  className="rounded-lg border border-border border-dashed bg-surface"
                  description={searchError}
                  icon={CircleAlert}
                  title="Search failed"
                  tone="danger"
                />
              ) : null}

              {hasResults || showSkeleton || searchError ? null : (
                <MarketplaceEmptyState
                  hasQuery={hasQuery}
                  onQuickSearch={handleQuickSearch}
                  target={target}
                />
              )}

              <AttributionFooter />
            </div>
          )}
        </div>
      </div>

      <MarketplaceSettings />
    </div>
  );
}
