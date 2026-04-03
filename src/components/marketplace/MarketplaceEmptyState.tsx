import { useEffect } from 'react';
import { Store, TrendingUp, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import { MarketplaceGetTrending } from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import { AppCard } from './AppCard';

const POPULAR_QUERIES = ['NewPipe', 'Signal', 'VLC', 'Bitwarden', 'K-9 Mail', 'Termux'];

interface MarketplaceEmptyStateProps {
  isSearching: boolean;
  hasQuery: boolean;
  onQuickSearch: (query: string) => void;
}

export function MarketplaceEmptyState({
  isSearching,
  hasQuery,
  onQuickSearch,
}: MarketplaceEmptyStateProps) {
  const { trendingApps, isTrendingLoading, setTrendingApps, setIsTrendingLoading, openDetail } =
    useMarketplaceStore();

  // Load trending on first mount
  useEffect(() => {
    if (trendingApps.length > 0 || isTrendingLoading || hasQuery) return;

    let cancelled = false;
    setIsTrendingLoading(true);

    MarketplaceGetTrending('stars')
      .then((apps) => {
        if (!cancelled) setTrendingApps(apps);
      })
      .catch((err) => {
        if (!cancelled) handleError('Trending', err);
      })
      .finally(() => {
        if (!cancelled) setIsTrendingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasQuery, trendingApps.length, isTrendingLoading, setTrendingApps, setIsTrendingLoading]);

  // Loading state
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="text-sm">Searching across providers...</p>
      </div>
    );
  }

  // No results for query
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Search className="h-8 w-8 mb-3 opacity-50" />
        <p className="text-sm font-medium">No apps found</p>
        <p className="text-xs mt-1">Try a different search term or adjust provider filters</p>
      </div>
    );
  }

  // First visit — show popular queries + trending
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col items-center text-center py-8">
        <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
          <Store className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">App Marketplace</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Discover and install open-source apps from F-Droid, IzzyOnDroid, GitHub, and Aptoide —
          directly via ADB.
        </p>
      </div>

      {/* Quick search chips */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Popular apps
        </p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_QUERIES.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => onQuickSearch(q)}
            >
              {q}
            </Button>
          ))}
        </div>
      </div>

      {/* Trending from GitHub */}
      {(isTrendingLoading || trendingApps.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Trending on GitHub
            </p>
          </div>

          {isTrendingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trendingApps.slice(0, 6).map((app, i) => (
                <AppCard
                  key={`${app.source}-${app.packageName}-${i}`}
                  app={app}
                  onSelect={() => openDetail(app)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
