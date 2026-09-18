import { CircleAlert } from "lucide-react";

import type { backend } from "@/desktop/models";
import type { InstallTarget } from "@/features/marketplace/model/install-target";
import { useMarketplaceStore } from "@/features/marketplace/model/marketplace-store";
import { AppDetailView } from "@/features/marketplace/ui/app-detail-view";
import { FilterBar } from "@/features/marketplace/ui/filter-bar";
import { MarketplaceEmptyState } from "@/features/marketplace/ui/marketplace-empty-state";
import { MarketplaceResultsBody } from "@/features/marketplace/ui/marketplace-results";
import { SearchBar } from "@/features/marketplace/ui/search-bar";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";

type MarketplaceApp = backend.MarketplaceApp;

interface MarketplaceBrowseTabProps {
  fromCache: boolean;
  handleClear: () => void;
  handleExplore?: () => void;
  handleInputChange: (value: string) => void;
  handleQuickSearch: (query: string) => void;
  handleRetry: () => void;
  hasQuery: boolean;
  isSearching: boolean;
  localQuery: string;
  rawCount: number;
  results: MarketplaceApp[];
  searchError: string | null;
  target: InstallTarget;
}
export const MarketplaceBrowseTab = ({
  fromCache,
  handleClear,
  handleExplore,
  handleInputChange,
  handleQuickSearch,
  handleRetry,
  hasQuery,
  isSearching,
  localQuery,
  rawCount,
  results,
  searchError,
  target,
}: MarketplaceBrowseTabProps) => {
  const isDetailOpen = useMarketplaceStore((state) => state.isDetailOpen);
  const selectedApp = useMarketplaceStore((state) => state.selectedApp);
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const viewMode = useMarketplaceStore((state) => state.viewMode);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);

  const hasResults = (results ?? []).length > 0;
  const showSkeleton = isSearching && rawCount === 0;

  const renderMainContent = () => {
    if (isDetailOpen && selectedApp) {
      return <AppDetailView target={target} />;
    }
    if (searchError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <CircleAlert className="size-8 text-destructive" />
          <p className="font-semibold text-body text-foreground">Search failed</p>
          <p className="max-w-md text-caption text-muted-foreground">{searchError}</p>
          <Button onClick={handleRetry} size="sm" type="button" variant="outline">
            Try again
          </Button>
        </div>
      );
    }
    if (hasResults || showSkeleton) {
      return (
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
      );
    }
    return (
      <MarketplaceEmptyState
        hasQuery={hasQuery}
        {...(handleExplore ? { onExplore: handleExplore } : {})}
        onQuickSearch={handleQuickSearch}
        target={target}
      />
    );
  };
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      {/* Search & Filter Header Area */}
      <div className="flex shrink-0 flex-col gap-3">
        <SearchBar
          isSearching={isSearching}
          onChange={handleInputChange}
          onClear={handleClear}
          onSelectHistory={handleQuickSearch}
          searchHistory={searchHistory}
          value={localQuery}
        />

        <FilterBar resultCount={(results ?? []).length} />
      </div>

      <Separator />

      {/* Main Results or Detail Area */}
      <div className="custom-scroll min-h-0 flex-1 overflow-y-auto pb-6">{renderMainContent()}</div>
    </div>
  );
};
