import { useEffect } from 'react';
import { MarketplaceGetTrending } from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import { getMarketplaceEffectiveGithubToken, useMarketplaceStore } from '@/lib/marketplaceStore';

export function useMarketplaceHome(hasQuery: boolean) {
  const {
    trendingApps,
    isTrendingLoading,
    recentReleaseApps,
    isRecentReleaseLoading,
    setTrendingApps,
    setIsTrendingLoading,
    setRecentReleaseApps,
    setIsRecentReleaseLoading,
  } = useMarketplaceStore();
  const githubToken = getMarketplaceEffectiveGithubToken(useMarketplaceStore());

  useEffect(() => {
    setTrendingApps([]);
    setRecentReleaseApps([]);
  }, [githubToken, setRecentReleaseApps, setTrendingApps]);

  useEffect(() => {
    if (hasQuery || trendingApps.length > 0 || isTrendingLoading) {
      return;
    }

    let cancelled = false;
    setIsTrendingLoading(true);

    MarketplaceGetTrending('stars', githubToken, 6)
      .then((apps) => {
        if (!cancelled) {
          setTrendingApps(apps);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          handleError('Marketplace Trending', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTrendingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    githubToken,
    hasQuery,
    isTrendingLoading,
    setIsTrendingLoading,
    setTrendingApps,
    trendingApps.length,
  ]);

  useEffect(() => {
    if (hasQuery || recentReleaseApps.length > 0 || isRecentReleaseLoading) {
      return;
    }

    let cancelled = false;
    setIsRecentReleaseLoading(true);

    MarketplaceGetTrending('updated', githubToken, 6)
      .then((apps) => {
        if (!cancelled) {
          setRecentReleaseApps(apps);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          handleError('Marketplace Recent Releases', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRecentReleaseLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    githubToken,
    hasQuery,
    isRecentReleaseLoading,
    recentReleaseApps.length,
    setIsRecentReleaseLoading,
    setRecentReleaseApps,
  ]);
}
