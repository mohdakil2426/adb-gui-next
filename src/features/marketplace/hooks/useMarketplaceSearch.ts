import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarketplaceSearch } from '@/desktop/backend';
import {
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import {
  lastSearchMatches,
  visibleMarketplaceApps,
} from '@/features/marketplace/utils/browseFilters';
import { handleError } from '@/shared/utils/errorHandler';

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 2;

export function useMarketplaceSearch() {
  const query = useMarketplaceStore((state) => state.query);
  const results = useMarketplaceStore((state) => state.results);
  const isSearching = useMarketplaceStore((state) => state.isSearching);
  const activeProviders = useMarketplaceStore((state) => state.activeProviders);
  const sortBy = useMarketplaceStore((state) => state.sortBy);
  const resultsPerProvider = useMarketplaceStore((state) => state.resultsPerProvider);
  const setQuery = useMarketplaceStore((state) => state.setQuery);
  const setResults = useMarketplaceStore((state) => state.setResults);
  const searchError = useMarketplaceStore((state) => state.searchError);
  const setSearchError = useMarketplaceStore((state) => state.setSearchError);
  const setIsSearching = useMarketplaceStore((state) => state.setIsSearching);
  const addToSearchHistory = useMarketplaceStore((state) => state.addToSearchHistory);
  const setLastSearch = useMarketplaceStore((state) => state.setLastSearch);
  const lastSearch = useMarketplaceStore((state) => state.lastSearch);
  const installableOnly = useMarketplaceStore((state) => state.installableOnly);
  const githubToken = useMarketplaceStore(getMarketplaceEffectiveGithubToken);

  const [localQuery, setLocalQuery] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const clearPendingDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      const requestId = ++requestIdRef.current;

      if (!trimmed || trimmed.length < MIN_QUERY_LENGTH) {
        setQuery('');
        setResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }

      setSearchError(null);
      setIsSearching(true);
      setQuery(trimmed);
      addToSearchHistory(trimmed);
      if (lastSearchMatches(lastSearch, trimmed, activeProviders, sortBy, resultsPerProvider)) {
        setResults(lastSearch.results);
      }

      try {
        const apps = await MarketplaceSearch(trimmed, {
          providers: activeProviders,
          sortBy,
          githubToken,
          resultsPerProvider,
        });

        if (requestId === requestIdRef.current) {
          setResults(apps);
          setLastSearch({
            providers: activeProviders,
            query: trimmed,
            results: apps,
            resultsPerProvider,
            sortBy,
          });
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          handleError('Marketplace Search', error);
          if (
            !lastSearchMatches(lastSearch, trimmed, activeProviders, sortBy, resultsPerProvider)
          ) {
            setResults([]);
          }
          setSearchError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [
      activeProviders,
      addToSearchHistory,
      githubToken,
      lastSearch,
      resultsPerProvider,
      setIsSearching,
      setQuery,
      setResults,
      setSearchError,
      setLastSearch,
      sortBy,
    ],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      clearPendingDebounce();

      if (!value.trim() || value.trim().length < MIN_QUERY_LENGTH) {
        requestIdRef.current += 1;
        setQuery('');
        setResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        void performSearch(value);
      }, DEBOUNCE_MS);
    },
    [clearPendingDebounce, performSearch, setIsSearching, setQuery, setResults, setSearchError],
  );

  const handleClear = useCallback(() => {
    clearPendingDebounce();
    requestIdRef.current += 1;
    setLocalQuery('');
    setQuery('');
    setResults([]);
    setSearchError(null);
    setIsSearching(false);
  }, [clearPendingDebounce, setIsSearching, setQuery, setResults, setSearchError]);

  const handleQuickSearch = useCallback(
    (quickQuery: string) => {
      clearPendingDebounce();
      setLocalQuery(quickQuery);
      void performSearch(quickQuery);
    },
    [clearPendingDebounce, performSearch],
  );

  useEffect(() => {
    if (query.trim().length >= MIN_QUERY_LENGTH) {
      void performSearch(query);
    }
    // Re-run the latest search only when filters or auth state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProviders, sortBy, resultsPerProvider, githubToken]);

  useEffect(
    () => () => {
      clearPendingDebounce();
    },
    [clearPendingDebounce],
  );

  const handleRetry = useCallback(() => {
    void performSearch(localQuery);
  }, [localQuery, performSearch]);

  const visibleResults = useMemo(
    () => visibleMarketplaceApps(results, installableOnly),
    [installableOnly, results],
  );

  return {
    localQuery,
    results: visibleResults,
    rawCount: results.length,
    isSearching,
    searchError,
    fromCache: lastSearchMatches(lastSearch, query, activeProviders, sortBy, resultsPerProvider),
    hasQuery: localQuery.trim().length >= MIN_QUERY_LENGTH,
    handleInputChange,
    handleClear,
    handleQuickSearch,
    handleRetry,
  };
}
