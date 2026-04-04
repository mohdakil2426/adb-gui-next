import { useEffect, useRef } from 'react';
import { MarketplaceGetTrending } from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import { getMarketplaceEffectiveGithubToken, useMarketplaceStore } from '@/lib/marketplaceStore';

export function useMarketplaceHome(hasQuery: boolean) {
  const setTrendingApps = useMarketplaceStore((state) => state.setTrendingApps);
  const setIsTrendingLoading = useMarketplaceStore((state) => state.setIsTrendingLoading);
  const setRecentReleaseApps = useMarketplaceStore((state) => state.setRecentReleaseApps);
  const setIsRecentReleaseLoading = useMarketplaceStore((state) => state.setIsRecentReleaseLoading);
  
  const trendingLength = useMarketplaceStore((state) => state.trendingApps.length);
  const recentLength = useMarketplaceStore((state) => state.recentReleaseApps.length);
  const githubToken = useMarketplaceStore(getMarketplaceEffectiveGithubToken);
  
  const fetchedTokenRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // If the token changes, we clear the apps so they fetch again
    if (fetchedTokenRef.current !== undefined && fetchedTokenRef.current !== githubToken) {
      setTrendingApps([]);
      setRecentReleaseApps([]);
    }
    fetchedTokenRef.current = githubToken;
  }, [githubToken, setRecentReleaseApps, setTrendingApps]);

  useEffect(() => {
    if (hasQuery || trendingLength > 0) {
      return;
    }

    let cancelled = false;
    setIsTrendingLoading(true);

    MarketplaceGetTrending('stars', githubToken, 6)
      .then((apps) => {
        if (!cancelled) setTrendingApps(apps);
      })
      .catch((error) => {
        if (!cancelled) handleError('Marketplace Trending', error);
      })
      .finally(() => {
        if (!cancelled) setIsTrendingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [githubToken, hasQuery, trendingLength, setTrendingApps, setIsTrendingLoading]);

  useEffect(() => {
    if (hasQuery || recentLength > 0) {
      return;
    }

    let cancelled = false;
    setIsRecentReleaseLoading(true);

    MarketplaceGetTrending('updated', githubToken, 6)
      .then((apps) => {
        if (!cancelled) setRecentReleaseApps(apps);
      })
      .catch((error) => {
        if (!cancelled) handleError('Marketplace Recent Releases', error);
      })
      .finally(() => {
        if (!cancelled) setIsRecentReleaseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [githubToken, hasQuery, recentLength, setRecentReleaseApps, setIsRecentReleaseLoading]);
}
