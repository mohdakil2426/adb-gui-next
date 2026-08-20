import { Database, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MarketplaceClearCache } from '@/desktop/backend';
import { useMarketplaceStore } from '@/features/marketplace/model/marketplaceStore';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

const RESULTS_OPTIONS = [6, 8, 12, 16, 25, 50, 100] as const;

export function CachePreferencesCard() {
  const resultsPerProvider = useMarketplaceStore((state) => state.resultsPerProvider);
  const setResultsPerProvider = useMarketplaceStore((state) => state.setResultsPerProvider);
  const clearSearchHistory = useMarketplaceStore((state) => state.clearSearchHistory);
  const searchHistory = useMarketplaceStore((state) => state.searchHistory);

  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await MarketplaceClearCache();
      toast.success('Marketplace cache and repository index cleared');
    } catch {
      toast.error('Failed to clear marketplace cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-foreground text-title">
          <Database className="size-5 text-muted-foreground" />
          Cache & Query Preferences
        </CardTitle>
        <CardDescription className="text-caption">
          Tune search density and manage offline metadata caches for responsive browsing. GitHub
          authentication is handled in the GitHub section above.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Results per provider — merged from Settings SearchPreferences (6,8,12,16) + Sources (10,25,50,100) */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
          <div className="flex flex-col">
            <span className="font-semibold text-body text-foreground">
              Results Limit per Repository
            </span>
            <span className="text-caption text-muted-foreground">
              Maximum items returned per query from each source repository.
            </span>
          </div>

          <Select
            onValueChange={(val) => setResultsPerProvider(Number.parseInt(val, 10))}
            value={resultsPerProvider.toString()}
          >
            <SelectTrigger aria-label="Results Limit per Repository" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RESULTS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} items
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Search History & Cache — merged from Settings CacheHistorySection */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3.5">
          <div className="flex flex-col">
            <span className="font-semibold text-body text-foreground">
              Local Metadata & Search Cache
            </span>
            <span className="text-caption text-muted-foreground">
              {searchHistory.length > 0
                ? `${searchHistory.length} recent search${searchHistory.length === 1 ? '' : 'es'} saved locally.`
                : 'No local search history saved yet.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="h-8 gap-1.5 text-caption"
              disabled={searchHistory.length === 0}
              onClick={() => {
                clearSearchHistory();
                toast.success('Search history cleared');
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 aria-hidden="true" className="size-3.5" data-icon="inline-start" />
              Clear History
            </Button>

            <Button
              className="h-8 gap-1.5 text-caption"
              disabled={isClearingCache}
              onClick={() => void handleClearCache()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isClearingCache ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2 className="size-3.5 text-muted-foreground" data-icon="inline-start" />
              )}
              Purge Cache
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
