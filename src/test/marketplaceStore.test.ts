import { beforeEach, describe, expect, it } from 'vitest';
import type { backend } from '@/lib/desktop/models';
import {
  getMarketplaceActiveFilterSummary,
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from '@/lib/marketplaceStore';

describe('marketplaceStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useMarketplaceStore.setState({
      query: '',
      results: [],
      isSearching: false,
      selectedApp: null,
      isDetailOpen: false,
      activeProviders: ['F-Droid', 'GitHub', 'Aptoide'],
      sortBy: 'relevance',
      viewMode: 'grid',
      trendingApps: [],
      isTrendingLoading: false,
      recentReleaseApps: [],
      isRecentReleaseLoading: false,
      searchHistory: [],
      recentlyViewedApps: [],
      isSettingsOpen: false,
      githubPat: '',
      githubOauthClientId: '',
      resultsPerProvider: 12,
      githubSession: { accessToken: null, user: null, rateLimit: null },
      githubDeviceChallenge: null,
      isGithubAuthenticating: false,
    });
  });

  it('prefers an active oauth session token over the session PAT fallback', () => {
    useMarketplaceStore.setState({
      githubPat: 'pat-token',
      githubSession: {
        accessToken: 'oauth-token',
        user: null,
        rateLimit: null,
      },
    });

    expect(getMarketplaceEffectiveGithubToken(useMarketplaceStore.getState())).toBe('oauth-token');
  });

  it('keeps the PAT fallback in memory without persisting it to localStorage', () => {
    useMarketplaceStore.getState().setGithubPat('pat-token');

    expect(useMarketplaceStore.getState().githubPat).toBe('pat-token');
    expect(localStorage.getItem('marketplace_github_pat')).toBeNull();
  });

  it('records recent apps without duplicates and keeps the newest first', () => {
    const alpha = {
      name: 'Alpha',
      packageName: 'app.alpha',
      version: '1.0',
      summary: 'Alpha summary',
      iconUrl: null,
      source: 'F-Droid',
      availableSources: ['F-Droid'],
      downloadUrl: null,
      repoUrl: null,
      size: null,
      rating: null,
      downloadsCount: null,
      malwareStatus: null,
      categories: [],
      updatedAt: null,
      installable: false,
    } satisfies backend.MarketplaceApp;

    const beta = { ...alpha, name: 'Beta', packageName: 'app.beta' };

    useMarketplaceStore.getState().openDetail(alpha);
    useMarketplaceStore.getState().openDetail(beta);
    useMarketplaceStore.getState().openDetail(alpha);

    expect(useMarketplaceStore.getState().recentlyViewedApps.map((app) => app.packageName)).toEqual(
      ['app.alpha', 'app.beta'],
    );
  });

  it('summarizes active filters consistently', () => {
    const summary = getMarketplaceActiveFilterSummary({
      activeProviders: ['F-Droid', 'GitHub'],
      sortBy: 'downloads',
      resultsPerProvider: 8,
    });

    expect(summary).toEqual(['2 sources', 'Sort: downloads', '8/provider']);
  });
});
