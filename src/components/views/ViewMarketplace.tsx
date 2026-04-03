import { useCallback, useEffect, useRef, useState } from 'react';
import { Store, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { handleError } from '@/lib/errorHandler';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import { MarketplaceSearch } from '@/lib/desktop/backend';
import { SearchBar } from '@/components/marketplace/SearchBar';
import { FilterBar } from '@/components/marketplace/FilterBar';
import { AppCard } from '@/components/marketplace/AppCard';
import { AppListItem } from '@/components/marketplace/AppListItem';
import { MarketplaceEmptyState } from '@/components/marketplace/MarketplaceEmptyState';
import { AttributionFooter } from '@/components/marketplace/AttributionFooter';
import { AppDetailDialog } from '@/components/AppDetailDialog';

const DEBOUNCE_MS = 400;

export function ViewMarketplace() {
  const {
    query,
    results,
    isSearching,
    viewMode,
    activeProviders,
    setQuery,
    setResults,
    setIsSearching,
    addToSearchHistory,
    openDetail,
  } = useMarketplaceStore();

  const [localQuery, setLocalQuery] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search logic ─────────────────────────────────────────────────────────

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setQuery(trimmed);
      addToSearchHistory(trimmed);

      try {
        const apps = await MarketplaceSearch(trimmed, {
          providers: activeProviders,
          sortBy: 'relevance',
        });
        setResults(apps);
      } catch (error) {
        handleError('Marketplace Search', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [setQuery, setResults, setIsSearching, addToSearchHistory, activeProviders],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setLocalQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        void performSearch(value);
      }, DEBOUNCE_MS);
    },
    [performSearch, setResults, setIsSearching],
  );

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setQuery('');
    setResults([]);
    setIsSearching(false);
  }, [setQuery, setResults, setIsSearching]);

  const handleQuickSearch = useCallback(
    (q: string) => {
      setLocalQuery(q);
      void performSearch(q);
    },
    [performSearch],
  );

  // Re-search when provider filters change (if there's an active query)
  useEffect(() => {
    if (query.trim()) {
      void performSearch(query);
    }
    // Only re-run when activeProviders changes, not query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProviders]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const hasResults = results.length > 0;
  const hasQuery = !!localQuery.trim();

  return (
    <div className="flex flex-col gap-4">
      {/* Search Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            App Marketplace
          </CardTitle>
          <CardDescription>
            Discover and install apps from F-Droid, IzzyOnDroid, GitHub, and Aptoide
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SearchBar
            value={localQuery}
            onChange={handleInputChange}
            onClear={handleClear}
            isSearching={isSearching}
          />
          <FilterBar resultCount={results.length} />
        </CardContent>
      </Card>

      {/* Results / Empty State */}
      {hasResults ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5" />
                Results
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {results.length} app{results.length !== 1 ? 's' : ''} found
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[60vh] min-h-[150px] overflow-y-auto overflow-x-hidden -mx-1 px-1">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {results.map((app, i) => (
                    <AppCard
                      key={`${app.source}-${app.packageName}-${i}`}
                      app={app}
                      onSelect={() => openDetail(app)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {results.map((app, i) => (
                    <AppListItem
                      key={`${app.source}-${app.packageName}-${i}`}
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

      {/* Attribution footer */}
      <AttributionFooter />

      {/* App Detail Dialog */}
      <AppDetailDialog />
    </div>
  );
}
