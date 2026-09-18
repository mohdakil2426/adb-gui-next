import { ArrowUpCircle, Database, Search, Sparkles } from "lucide-react";
import { useEffect } from "react";

import { MarketplaceBrowseTab } from "@/features/marketplace/browse/marketplace-browse-tab";
import { useInstallTarget } from "@/features/marketplace/hooks/use-install-target";
import { useMarketplaceSearch } from "@/features/marketplace/hooks/use-marketplace-search";
import { useMarketplaceAuthStore } from "@/features/marketplace/model/auth-store";
import { useMarketplaceStore } from "@/features/marketplace/model/marketplace-store";
import type { MarketplaceTab } from "@/features/marketplace/model/marketplace-store";
import { MarketplaceOverviewTab } from "@/features/marketplace/overview/marketplace-overview-tab";
import { MarketplaceSourcesTab } from "@/features/marketplace/sources/marketplace-sources-tab";
import { MarketplaceHeroBanner } from "@/features/marketplace/ui/marketplace-hero-banner";
import { MarketplaceUpdatesTab } from "@/features/marketplace/updates/marketplace-updates-tab";
import { Badge } from "@/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

export const ViewMarketplace = ({ initialTab }: { initialTab?: MarketplaceTab } = {}) => {
  const activeTab = useMarketplaceStore((state) => state.activeTab);
  const setActiveTab = useMarketplaceStore((state) => state.setActiveTab);

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
    handleExplore,
    handleQuickSearch,
    handleRetry,
  } = useMarketplaceSearch();

  const target = useInstallTarget();
  const currentTab: MarketplaceTab =
    initialTab ?? (activeTab || (hasQuery ? "browse" : "overview"));

  useEffect(() => {
    void useMarketplaceAuthStore.getState().refresh();
  }, []);

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
            <span>Overview</span>
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
          <MarketplaceOverviewTab onQuickSearch={handleQuickSearch} />
        </TabsContent>

        <TabsContent className="mt-0 flex-1 outline-none" value="browse">
          <MarketplaceBrowseTab
            fromCache={fromCache}
            handleClear={handleClear}
            handleExplore={handleExplore}
            handleInputChange={handleInputChange}
            handleQuickSearch={handleQuickSearch}
            handleRetry={handleRetry}
            hasQuery={hasQuery}
            isSearching={isSearching}
            localQuery={localQuery}
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
    </div>
  );
};
