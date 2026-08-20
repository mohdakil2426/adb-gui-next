import type { backend } from '@/desktop/models';

type MarketplaceApp = backend.MarketplaceApp;
type MarketplaceSortBy = backend.MarketplaceSortBy;
type ProviderSource = backend.ProviderSource;

export interface MarketplaceLastSearch {
  providers: ProviderSource[];
  query: string;
  results: MarketplaceApp[];
  resultsPerProvider: number;
  sortBy: MarketplaceSortBy;
}

export function visibleMarketplaceApps(
  results: MarketplaceApp[],
  installableOnly: boolean,
): MarketplaceApp[] {
  if (!installableOnly) {
    return results;
  }
  return results.filter((app) => app.installable);
}

export function lastSearchMatches(
  cache: MarketplaceLastSearch | null,
  query: string,
  providers: ProviderSource[],
  sortBy: MarketplaceSortBy,
  resultsPerProvider: number,
): cache is MarketplaceLastSearch {
  if (!cache) {
    return false;
  }
  if (cache.query !== query.trim()) {
    return false;
  }
  if (cache.sortBy !== sortBy || cache.resultsPerProvider !== resultsPerProvider) {
    return false;
  }
  if (cache.providers.length !== providers.length) {
    return false;
  }
  const providerSet = new Set(providers);
  return cache.providers.every((provider) => providerSet.has(provider));
}
