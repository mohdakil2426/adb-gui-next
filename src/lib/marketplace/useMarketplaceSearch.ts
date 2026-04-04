import { useCallback, useEffect, useRef, useState } from 'react';
import { MarketplaceSearch } from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import { getMarketplaceEffectiveGithubToken, useMarketplaceStore } from '@/lib/marketplaceStore';

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 2;

export function useMarketplaceSearch() {
  const {
    query,
    results,
    isSearching,
    activeProviders,
    sortBy,
    resultsPerProvider,
    setQuery,
    setResults,
    setIsSearching,
    addToSearchHistory,
  } = useMarketplaceStore();
  const store = useMarketplaceStore();
  const githubToken = getMarketplaceEffectiveGithubToken(store);

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
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setQuery(trimmed);
      addToSearchHistory(trimmed);

      try {
        const apps = await MarketplaceSearch(trimmed, {
          providers: activeProviders,
          sortBy,
          githubToken,
          resultsPerProvider,
        });

        if (requestId === requestIdRef.current) {
          setResults(apps);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          handleError('Marketplace Search', error);
          setResults([]);
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
      resultsPerProvider,
      setIsSearching,
      setQuery,
      setResults,
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
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        void performSearch(value);
      }, DEBOUNCE_MS);
    },
    [clearPendingDebounce, performSearch, setIsSearching, setQuery, setResults],
  );

  const handleClear = useCallback(() => {
    clearPendingDebounce();
    requestIdRef.current += 1;
    setLocalQuery('');
    setQuery('');
    setResults([]);
    setIsSearching(false);
  }, [clearPendingDebounce, setIsSearching, setQuery, setResults]);

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

  return {
    localQuery,
    results,
    isSearching,
    hasQuery: localQuery.trim().length >= MIN_QUERY_LENGTH,
    handleInputChange,
    handleClear,
    handleQuickSearch,
    performSearch,
    setLocalQuery,
  };
}
