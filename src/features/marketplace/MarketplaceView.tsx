import { CircleAlert, UserRound } from 'lucide-react';
import { useInstallTarget } from '@/features/marketplace/hooks/useInstallTarget';
import { useMarketplaceSearch } from '@/features/marketplace/hooks/useMarketplaceSearch';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { AppDetailView } from '@/features/marketplace/ui/AppDetailView';
import { AttributionFooter } from '@/features/marketplace/ui/AttributionFooter';
import { FilterBar } from '@/features/marketplace/ui/FilterBar';
import { MarketplaceDeviceBanner } from '@/features/marketplace/ui/MarketplaceDeviceBanner';
import { MarketplaceEmptyState } from '@/features/marketplace/ui/MarketplaceEmptyState';
import { MarketplaceResultsBody } from '@/features/marketplace/ui/MarketplaceResults';
import { MarketplaceSettings } from '@/features/marketplace/ui/MarketplaceSettings';
import { SearchBar } from '@/features/marketplace/ui/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';

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
    rawCount,
    isSearching,
    searchError,
    fromCache,
    hasQuery,
    handleInputChange,
    handleClear,
    handleQuickSearch,
    handleRetry,
  } = useMarketplaceSearch();

  const target = useInstallTarget();
  const hasResults = results.length > 0;
  const showSkeleton = isSearching && rawCount === 0;

  return (
    <div className="@container relative flex h-full w-full flex-col gap-4">
      <h1 className="sr-only">Marketplace</h1>

      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MarketplaceDeviceBanner target={target} />
          <Badge variant="neutral">
            {githubSession.user ? (
              <>
                <UserRound aria-hidden="true" />
                {githubSession.user.login}
              </>
            ) : (
              'Anonymous GitHub'
            )}
          </Badge>
        </div>

        <SearchBar
          isSearching={isSearching}
          onChange={handleInputChange}
          onClear={handleClear}
          onSelectHistory={handleQuickSearch}
          onSettings={openSettings}
          searchHistory={searchHistory}
          value={localQuery}
        />

        {selectedApp && isDetailOpen ? null : <FilterBar resultCount={results.length} />}
      </div>

      <Separator />

      <div className="custom-scroll min-h-0 flex-1 overflow-y-auto pb-6">
        {selectedApp && isDetailOpen ? (
          <AppDetailView target={target} />
        ) : (
          <div className="flex flex-col gap-3">
            <MarketplaceResultsBody
              fromCache={fromCache}
              hasResults={hasResults}
              isSearching={isSearching}
              onSelect={openDetail}
              rawCount={rawCount}
              results={results}
              showSkeleton={showSkeleton}
              target={target}
              viewMode={viewMode}
            />

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

      <MarketplaceSettings />
    </div>
  );
}
