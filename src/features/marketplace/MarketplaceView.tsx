import { ArrowUpCircle, Database, Search, Sparkles } from 'lucide-react';
import { MarketplaceBrowseTab } from '@/features/marketplace/browse/MarketplaceBrowseTab';
import { useInstallTarget } from '@/features/marketplace/hooks/useInstallTarget';
import { useMarketplaceSearch } from '@/features/marketplace/hooks/useMarketplaceSearch';
import {
  type MarketplaceTab,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import { MarketplaceOverviewTab } from '@/features/marketplace/overview/MarketplaceOverviewTab';
import { MarketplaceSourcesTab } from '@/features/marketplace/sources/MarketplaceSourcesTab';
import { MarketplaceHeroBanner } from '@/features/marketplace/ui/MarketplaceHeroBanner';
import { MarketplaceSettings } from '@/features/marketplace/ui/MarketplaceSettings';
import { MarketplaceUpdatesTab } from '@/features/marketplace/updates/MarketplaceUpdatesTab';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

export function ViewMarketplace({ initialTab }: { initialTab?: MarketplaceTab } = {}) {
  const activeTab = useMarketplaceStore((state) => state.activeTab);
  const setActiveTab = useMarketplaceStore((state) => state.setActiveTab);
  const openDetail = useMarketplaceStore((state) => state.openDetail);
  const openSettings = useMarketplaceStore((state) => state.openSettings);

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
  const currentTab: MarketplaceTab =
    initialTab ?? (activeTab || (hasQuery ? 'browse' : 'overview'));
  return (
    <div className="@container relative flex min-h-0 w-full flex-1 flex-col gap-4">
      <h1 className="sr-only">Open-Source App Marketplace</h1>

      {/* Top Precision Hero Banner */}
      <MarketplaceHeroBanner />

      {/* Segmented Hardware Tabs Navigation */}
      <Tabs
        className="flex min-h-0 w-full flex-1 flex-col gap-4"
        onValueChange={(val) => setActiveTab(val as MarketplaceTab)}
        value={currentTab}
      >
        <TabsList className="w-full">
          <TabsTrigger className="flex-1 gap-2" value="overview">
            <Sparkles className="size-4 text-primary" />
            <span>Overview & Curated</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-2" value="browse">
            <Search className="size-4" />
            <span>Browse & Search</span>
            {(results ?? []).length > 0 && (
              <Badge className="ml-1 px-1.5 py-0 font-mono text-caption" variant="neutral">
                {(results ?? []).length}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-2" value="updates">
            <ArrowUpCircle className="size-4" />
            <span>Installed & Updates</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-2" value="sources">
            <Database className="size-4" />
            <span>Sources & Repos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-0 flex-1 outline-none" value="overview">
          <MarketplaceOverviewTab
            onQuickSearch={handleQuickSearch}
            onSelectApp={openDetail}
            target={target}
          />
        </TabsContent>

        <TabsContent className="mt-0 flex-1 outline-none" value="browse">
          <MarketplaceBrowseTab
            fromCache={fromCache}
            handleClear={handleClear}
            handleInputChange={handleInputChange}
            handleQuickSearch={handleQuickSearch}
            handleRetry={handleRetry}
            hasQuery={hasQuery}
            isSearching={isSearching}
            localQuery={localQuery}
            onOpenSettings={openSettings}
            rawCount={rawCount}
            results={results}
            searchError={searchError}
            target={target}
          />
        </TabsContent>

        <TabsContent className="mt-0 flex-1 outline-none" value="updates">
          <MarketplaceUpdatesTab target={target} />
        </TabsContent>

        <TabsContent className="mt-0 flex-1 outline-none" value="sources">
          <MarketplaceSourcesTab />
        </TabsContent>
      </Tabs>

      <MarketplaceSettings />
    </div>
  );
}
