import { CircleAlert } from 'lucide-react';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { AppDetailView } from '@/features/marketplace/ui/AppDetailView';
import { FilterBar } from '@/features/marketplace/ui/FilterBar';
import { MarketplaceEmptyState } from '@/features/marketplace/ui/MarketplaceEmptyState';
import { MarketplaceResultsBody } from '@/features/marketplace/ui/MarketplaceResults';
import { SearchBar } from '@/features/marketplace/ui/SearchBar';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';

type MarketplaceApp = backend.MarketplaceApp;

interface MarketplaceBrowseTabProps {
  fromCache: boolean;
  handleClear: () => void;
  handleInputChange: (value: string) => void;
  handleQuickSearch: (query: string) => void;
  handleRetry: () => void;
  hasQuery: boolean;
  isSearching: boolean;
  localQuery: string;
  onOpenSettings?: () => void;
  rawCount: number;
  results: MarketplaceApp[];
  searchError: string | null;
  target: InstallTarget;
}

export function MarketplaceBrowseTab({
  fromCache,
  handleClear,
  handleInputChange,
  handleQuickSearch,
  handleRetry,
  hasQuery,
  isSearching,
  localQuery,
  onOpenSettings,
  rawCount,
  results,
  searchError,
  target,
}: MarketplaceBrowseTabProps) {
  const isDetailOpen = useMarketplaceStore((state) => state.isDetailOpen);
  const selectedApp = useMarketplaceStore((state) => state.selectedApp);
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const viewMode = useMarketplaceStore((state) => state.viewMode);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);
  const openSettings = useMarketplaceStore((state) => state.openSettings);

  const hasResults = (results ?? []).length > 0;
  const showSkeleton = isSearching && rawCount === 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      {/* Search & Filter Header Area */}
      <div className="flex shrink-0 flex-col gap-3">
        <SearchBar
          isSearching={isSearching}
          onChange={handleInputChange}
          onClear={handleClear}
          onSelectHistory={handleQuickSearch}
          onSettings={onOpenSettings ?? openSettings}
          searchHistory={searchHistory}
          value={localQuery}
        />

        <FilterBar resultCount={(results ?? []).length} />
      </div>

      <Separator />

      {/* Main Results or Detail Area */}
      <div className="custom-scroll min-h-0 flex-1 overflow-y-auto pb-6">
        {isDetailOpen && selectedApp ? (
          <AppDetailView target={target} />
        ) : searchError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <CircleAlert className="size-8 text-destructive" />
            <p className="font-semibold text-body text-foreground">Search failed</p>
            <p className="max-w-md text-caption text-muted-foreground">{searchError}</p>
            <Button onClick={handleRetry} size="sm" type="button" variant="outline">
              Try again
            </Button>
          </div>
        ) : hasResults || showSkeleton ? (
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
        ) : (
          <MarketplaceEmptyState
            hasQuery={hasQuery}
            onQuickSearch={handleQuickSearch}
            target={target}
          />
        )}
      </div>
    </div>
  );
}
