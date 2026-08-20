import { describe, expect, it } from 'vitest';
import type { backend } from '@/desktop/models';
import {
  lastSearchMatches,
  visibleMarketplaceApps,
} from '@/features/marketplace/utils/browseFilters';

const app = {
  name: 'Alpha',
  packageName: 'app.alpha',
  version: '1.0',
  summary: 'Alpha',
  iconUrl: null,
  source: 'F-Droid',
  availableSources: ['F-Droid'],
  downloadUrl: 'https://example.com/a.apk',
  repoUrl: null,
  size: null,
  rating: null,
  downloadsCount: null,
  malwareStatus: null,
  categories: [],
  updatedAt: null,
  installable: true,
  language: null,
} satisfies backend.MarketplaceApp;

describe('marketplace browse filters', () => {
  it('hides repo-only apps when installable-only is on', () => {
    const repoOnly = { ...app, packageName: 'app.repo', installable: false, downloadUrl: null };
    expect(visibleMarketplaceApps([app, repoOnly], true)).toEqual([app]);
    expect(visibleMarketplaceApps([app, repoOnly], false)).toHaveLength(2);
  });

  it('matches a cached search only when query and filters align', () => {
    const cache = {
      githubApkOnly: true,
      providers: ['F-Droid', 'GitHub'] as backend.ProviderSource[],
      query: 'camera',
      results: [app],
      resultsPerProvider: 12,
      sortBy: 'relevance' as const,
    };
    expect(lastSearchMatches(cache, 'camera', ['F-Droid', 'GitHub'], 'relevance', 12, true)).toBe(
      true,
    );
    expect(lastSearchMatches(cache, 'maps', ['F-Droid', 'GitHub'], 'relevance', 12, true)).toBe(
      false,
    );
  });
});
