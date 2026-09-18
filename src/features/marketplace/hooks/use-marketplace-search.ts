import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { MarketplaceSearch } from "@/desktop/backend";
import {
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from "@/features/marketplace/model/marketplace-store";
import {
  lastSearchMatches,
  visibleMarketplaceApps,
} from "@/features/marketplace/utils/browse-filters";
import { handleError } from "@/shared/utils/error-handler";

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 2;

export const useMarketplaceSearch = () => {
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
  const githubApkOnly = useMarketplaceStore((state) => state.githubApkOnly);
  const githubToken = useMarketplaceStore(getMarketplaceEffectiveGithubToken);

  const [localQuery, setLocalQuery] = useState(query);
  // Keep input responsive: text field commits `localQuery` synchronously while
  // heavy work (filtering + IPC) reads the deferred value. Mirrors
  // `src/features/file-explorer/hooks/useFileExplorerSort.ts:44`.
  const deferredQuery = useDeferredValue(localQuery);
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
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isExplore = trimmed === "";

      if (!isExplore && trimmed.length < MIN_QUERY_LENGTH) {
        setQuery("");
        setResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }

      setSearchError(null);
      setIsSearching(true);
      setQuery(trimmed);
      if (!isExplore) {
        addToSearchHistory(trimmed);
      }
      if (
        lastSearchMatches(
          lastSearch,
          trimmed,
          activeProviders,
          sortBy,
          resultsPerProvider,
          githubApkOnly
        )
      ) {
        setResults(lastSearch.results);
      }

      try {
        const apps = await MarketplaceSearch(trimmed, {
          githubApkOnly,
          githubToken,
          providers: activeProviders,
          resultsPerProvider,
          sortBy,
        });

        if (requestId === requestIdRef.current) {
          setResults(apps);
          setLastSearch({
            githubApkOnly,
            providers: activeProviders,
            query: trimmed,
            results: apps,
            resultsPerProvider,
            sortBy,
          });
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          handleError("Marketplace Search", error);
          if (
            !lastSearchMatches(
              lastSearch,
              trimmed,
              activeProviders,
              sortBy,
              resultsPerProvider,
              githubApkOnly
            )
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
      githubApkOnly,
      githubToken,
      lastSearch,
      resultsPerProvider,
      setIsSearching,
      setLastSearch,
      setQuery,
      setResults,
      setSearchError,
      sortBy,
    ]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      clearPendingDebounce();

      if (!value.trim() || value.trim().length < MIN_QUERY_LENGTH) {
        requestIdRef.current += 1;
        setQuery("");
        setResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      // Debounce + deferredValue are complementary: deferredValue yields React
      // render priority (input stays fluid), debounce throttles network IPC.
      // 450ms dominates, so deferredValue is cheap insurance — removing
      // debounce would spam MarketplaceSearch on every keystroke.
      debounceRef.current = setTimeout(() => {
        void performSearch(value);
      }, DEBOUNCE_MS);
    },
    [clearPendingDebounce, performSearch, setIsSearching, setQuery, setResults, setSearchError]
  );

  const handleClear = useCallback(() => {
    clearPendingDebounce();
    requestIdRef.current += 1;
    setLocalQuery("");
    setQuery("");
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
    [clearPendingDebounce, performSearch]
  );

  const handleExplore = useCallback(() => {
    clearPendingDebounce();
    setLocalQuery("");
    void performSearch("");
  }, [clearPendingDebounce, performSearch]);
  useEffect(() => {
    const { query: currentQuery, lastSearch: currentLastSearch } = useMarketplaceStore.getState();
    if (currentQuery.trim().length >= MIN_QUERY_LENGTH) {
      void performSearch(currentQuery);
    }
    if (currentQuery.trim() === "" && currentLastSearch?.query === "") {
      void performSearch("");
    }
    // Re-run the latest search only when filters or auth state change.
  }, [activeProviders, sortBy, resultsPerProvider, githubToken, githubApkOnly, performSearch]);

  useEffect(
    () => () => {
      clearPendingDebounce();
    },
    [clearPendingDebounce]
  );

  const handleRetry = useCallback(() => {
    void performSearch(localQuery);
  }, [localQuery, performSearch]);

  // `deferredQuery` deprioritizes reconciliation when the result set is large.
  // `visibleMarketplaceApps` currently filters only by `installableOnly`; the
  // deferred dep is wired so any future query-based client filter benefits
  // without re-blocking input. Mirrors file-explorer `useFileExplorerSort:44`.
  const visibleResults = useMemo(() => {
    void deferredQuery;
    return visibleMarketplaceApps(results, installableOnly);
  }, [installableOnly, results, deferredQuery]);

  return {
    fromCache: lastSearchMatches(
      lastSearch,
      query,
      activeProviders,
      sortBy,
      resultsPerProvider,
      githubApkOnly
    ),
    handleClear,
    handleExplore,
    handleInputChange,
    handleQuickSearch,
    handleRetry,
    hasQuery: localQuery.trim().length >= MIN_QUERY_LENGTH,
    isSearching,
    localQuery,
    rawCount: results.length,
    results: visibleResults,
    searchError,
  };
};
