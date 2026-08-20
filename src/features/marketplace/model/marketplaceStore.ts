import { create } from 'zustand';
import type { backend } from '@/desktop/models';
import { ALL_PROVIDER_IDS } from '@/features/marketplace/model/providers';
import type { MarketplaceLastSearch } from '@/features/marketplace/utils/browseFilters';

type MarketplaceApp = backend.MarketplaceApp;
type MarketplaceSortBy = backend.MarketplaceSortBy;
type ProviderSource = backend.ProviderSource;
type GithubDeviceFlowChallenge = backend.GithubDeviceFlowChallenge;
type GithubRateLimitSummary = backend.GithubRateLimitSummary;
type GithubUserSummary = backend.GithubUserSummary;
export type MarketplaceTab = 'overview' | 'browse' | 'updates' | 'sources';
const ALL_PROVIDERS: ProviderSource[] = ALL_PROVIDER_IDS;
const SEARCH_HISTORY_LIMIT = 10;
const RECENTLY_VIEWED_LIMIT = 6;
interface GithubSessionState {
  accessToken: string | null;
  rateLimit: GithubRateLimitSummary | null;
  user: GithubUserSummary | null;
}
interface ActiveGithubDeviceChallenge {
  challenge: GithubDeviceFlowChallenge;
  clientId: string;
}
interface MarketplaceState {
  activeProviders: ProviderSource[];
  activeTab: MarketplaceTab;
  addToSearchHistory: (query: string) => void;
  clearGithubSession: () => void;
  clearSearchHistory: () => void;
  closeDetail: () => void;
  githubApkOnly: boolean;
  githubDeviceChallenge: ActiveGithubDeviceChallenge | null;
  githubOauthClientId: string;
  githubPat: string;
  githubSession: GithubSessionState;
  installableOnly: boolean;
  isDetailOpen: boolean;
  isGithubAuthenticating: boolean;
  isSearching: boolean;
  lastSearch: MarketplaceLastSearch | null;
  openDetail: (app: MarketplaceApp) => void;
  query: string;
  recentlyViewedApps: MarketplaceApp[];
  reset: () => void;
  results: MarketplaceApp[];
  resultsPerProvider: number;
  searchError: string | null;
  searchHistory: string[];
  selectedApp: MarketplaceApp | null;
  setActiveProviders: (providers: ProviderSource[]) => void;
  setActiveTab: (activeTab: MarketplaceTab) => void;
  setAllProviders: () => void;
  setGithubApkOnly: (githubApkOnly: boolean) => void;
  setGithubDeviceChallenge: (challenge: ActiveGithubDeviceChallenge | null) => void;
  setGithubOauthClientId: (clientId: string) => void;
  setGithubPat: (githubPat: string) => void;
  setGithubSession: (session: Partial<GithubSessionState>) => void;
  setInstallableOnly: (installableOnly: boolean) => void;
  setIsGithubAuthenticating: (isGithubAuthenticating: boolean) => void;
  setIsSearching: (isSearching: boolean) => void;
  setLastSearch: (lastSearch: MarketplaceLastSearch | null) => void;
  setQuery: (query: string) => void;
  setResults: (results: MarketplaceApp[]) => void;
  setResultsPerProvider: (resultsPerProvider: number) => void;
  setSearchError: (searchError: string | null) => void;
  setSortBy: (sortBy: MarketplaceSortBy) => void;
  setViewMode: (viewMode: 'grid' | 'list') => void;
  sortBy: MarketplaceSortBy;
  toggleProvider: (provider: ProviderSource) => void;
  viewMode: 'grid' | 'list';
}
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (parsed == null) {
      return fallback;
    }
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}
function saveToStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in desktop webview/tests.
  }
}
function uniqueRecentApps(apps: MarketplaceApp[], nextApp: MarketplaceApp): MarketplaceApp[] {
  return [nextApp, ...apps.filter((app) => app.packageName !== nextApp.packageName)].slice(
    0,
    RECENTLY_VIEWED_LIMIT,
  );
}
export function getMarketplaceEffectiveGithubToken(state: MarketplaceState): string | null {
  return state.githubSession.accessToken ?? (state.githubPat || null);
}
export function getMarketplaceActiveFilterSummary(
  state: Pick<
    MarketplaceState,
    'activeProviders' | 'sortBy' | 'resultsPerProvider' | 'installableOnly' | 'githubApkOnly'
  >,
): string[] {
  const activeProviders = state.activeProviders ?? ALL_PROVIDERS;
  const summaries = [
    `Sort: ${state.sortBy ?? 'relevance'}`,
    `${state.resultsPerProvider ?? 12}/provider`,
  ];
  if (state.installableOnly) {
    summaries.push('Installable only');
  }
  if (state.githubApkOnly) {
    summaries.push('APK/APKS only');
  }
  if (activeProviders.length === ALL_PROVIDERS.length) {
    summaries.unshift('All sources');
  } else {
    summaries.unshift(`${activeProviders.length} source${activeProviders.length === 1 ? '' : 's'}`);
  }
  return summaries;
}
export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  activeTab: loadFromStorage<MarketplaceTab>('marketplace_tab', 'overview'),
  query: '',
  results: [],
  isSearching: false,
  searchError: null,
  selectedApp: null,
  isDetailOpen: false,
  activeProviders: loadFromStorage<ProviderSource[]>('marketplace_providers', ALL_PROVIDERS),
  sortBy: loadFromStorage<MarketplaceSortBy>('marketplace_sort', 'relevance'),
  viewMode: loadFromStorage<'grid' | 'list'>('marketplace_view', 'grid'),
  searchHistory: loadFromStorage<string[]>('marketplace_history', []),
  recentlyViewedApps: loadFromStorage<MarketplaceApp[]>('marketplace_recently_viewed', []),
  githubPat: '',
  githubOauthClientId: loadFromStorage<string>('marketplace_github_client_id', ''),
  resultsPerProvider: loadFromStorage<number>('marketplace_results_per_provider', 12),
  githubSession: {
    accessToken: null,
    user: null,
    rateLimit: null,
  },
  githubDeviceChallenge: null,
  isGithubAuthenticating: false,
  installableOnly: loadFromStorage<boolean>('marketplace_installable_only', false),
  githubApkOnly: loadFromStorage<boolean>('marketplace_github_apk_only', true),
  lastSearch: loadFromStorage<MarketplaceLastSearch | null>('marketplace_last_search', null),
  setActiveTab: (activeTab) => {
    saveToStorage('marketplace_tab', activeTab);
    set({ activeTab });
  },
  setQuery: (query) => {
    set({ query });
  },
  setResults: (results) => {
    set({ results });
  },
  setSearchError: (searchError) => {
    set({ searchError });
  },
  setIsSearching: (isSearching) => {
    set({ isSearching });
  },
  openDetail: (app) => {
    const recentlyViewedApps = uniqueRecentApps(get().recentlyViewedApps, app);
    saveToStorage('marketplace_recently_viewed', recentlyViewedApps);
    set({ selectedApp: app, isDetailOpen: true, recentlyViewedApps, activeTab: 'browse' });
  },
  closeDetail: () => {
    set({ selectedApp: null, isDetailOpen: false });
  },
  toggleProvider: (provider) => {
    const current = get().activeProviders;
    const next = current.includes(provider)
      ? current.length > 1
        ? current.filter((entry) => entry !== provider)
        : current
      : [...current, provider];
    const normalized = next.length === ALL_PROVIDERS.length ? [...ALL_PROVIDERS] : next;
    saveToStorage('marketplace_providers', normalized);
    set({ activeProviders: normalized });
  },
  setAllProviders: () => {
    saveToStorage('marketplace_providers', ALL_PROVIDERS);
    set({ activeProviders: [...ALL_PROVIDERS] });
  },
  setActiveProviders: (providers) => {
    const unique = ALL_PROVIDERS.filter((id) => providers.includes(id));
    const next = unique.length === 0 ? get().activeProviders : unique;
    saveToStorage('marketplace_providers', next);
    set({ activeProviders: next });
  },
  setSortBy: (sortBy) => {
    saveToStorage('marketplace_sort', sortBy);
    set({ sortBy });
  },
  setViewMode: (viewMode) => {
    saveToStorage('marketplace_view', viewMode);
    set({ viewMode });
  },
  setInstallableOnly: (installableOnly) => {
    saveToStorage('marketplace_installable_only', installableOnly);
    set({ installableOnly });
  },
  setGithubApkOnly: (githubApkOnly) => {
    saveToStorage('marketplace_github_apk_only', githubApkOnly);
    set({ githubApkOnly });
  },
  setLastSearch: (lastSearch) => {
    saveToStorage('marketplace_last_search', lastSearch);
    set({ lastSearch });
  },
  addToSearchHistory: (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const next = [trimmed, ...get().searchHistory.filter((entry) => entry !== trimmed)].slice(
      0,
      SEARCH_HISTORY_LIMIT,
    );
    saveToStorage('marketplace_history', next);
    set({ searchHistory: next });
  },
  clearSearchHistory: () => {
    saveToStorage('marketplace_history', []);
    set({ searchHistory: [] });
  },
  setGithubPat: (githubPat) => {
    set({ githubPat });
  },
  setGithubOauthClientId: (githubOauthClientId) => {
    saveToStorage('marketplace_github_client_id', githubOauthClientId);
    set({ githubOauthClientId });
  },
  setResultsPerProvider: (resultsPerProvider) => {
    saveToStorage('marketplace_results_per_provider', resultsPerProvider);
    set({ resultsPerProvider });
  },
  setGithubSession: (session) => {
    set((state) => ({
      githubSession: {
        ...state.githubSession,
        ...session,
      },
    }));
  },
  clearGithubSession: () => {
    set({
      githubSession: { accessToken: null, user: null, rateLimit: null },
      githubDeviceChallenge: null,
      isGithubAuthenticating: false,
    });
  },
  setGithubDeviceChallenge: (githubDeviceChallenge) => {
    set({ githubDeviceChallenge });
  },
  setIsGithubAuthenticating: (isGithubAuthenticating) => {
    set({ isGithubAuthenticating });
  },
  reset: () => {
    set({
      query: '',
      results: [],
      isSearching: false,
      searchError: null,
      selectedApp: null,
      isDetailOpen: false,
      githubDeviceChallenge: null,
      isGithubAuthenticating: false,
    });
  },
}));
