import { create } from 'zustand';
import type { backend } from './desktop/models';

type MarketplaceApp = backend.MarketplaceApp;
type MarketplaceSortBy = backend.MarketplaceSortBy;
type ProviderSource = backend.ProviderSource;
type GithubDeviceFlowChallenge = backend.GithubDeviceFlowChallenge;
type GithubRateLimitSummary = backend.GithubRateLimitSummary;
type GithubUserSummary = backend.GithubUserSummary;

const ALL_PROVIDERS: ProviderSource[] = ['F-Droid', 'GitHub', 'Aptoide'];
const SEARCH_HISTORY_LIMIT = 10;
const RECENTLY_VIEWED_LIMIT = 6;

interface GithubSessionState {
  accessToken: string | null;
  user: GithubUserSummary | null;
  rateLimit: GithubRateLimitSummary | null;
}

interface ActiveGithubDeviceChallenge {
  challenge: GithubDeviceFlowChallenge;
  clientId: string;
}

interface MarketplaceState {
  query: string;
  results: MarketplaceApp[];
  isSearching: boolean;
  selectedApp: MarketplaceApp | null;
  isDetailOpen: boolean;
  activeProviders: ProviderSource[];
  sortBy: MarketplaceSortBy;
  viewMode: 'grid' | 'list';
  trendingApps: MarketplaceApp[];
  isTrendingLoading: boolean;
  recentReleaseApps: MarketplaceApp[];
  isRecentReleaseLoading: boolean;
  searchHistory: string[];
  recentlyViewedApps: MarketplaceApp[];
  isSettingsOpen: boolean;
  githubPat: string;
  githubOauthClientId: string;
  resultsPerProvider: number;
  githubSession: GithubSessionState;
  githubDeviceChallenge: ActiveGithubDeviceChallenge | null;
  isGithubAuthenticating: boolean;

  setQuery: (query: string) => void;
  setResults: (results: MarketplaceApp[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  openDetail: (app: MarketplaceApp) => void;
  closeDetail: () => void;
  toggleProvider: (provider: ProviderSource) => void;
  setAllProviders: () => void;
  setSortBy: (sortBy: MarketplaceSortBy) => void;
  setViewMode: (viewMode: 'grid' | 'list') => void;
  setTrendingApps: (apps: MarketplaceApp[]) => void;
  setIsTrendingLoading: (isTrendingLoading: boolean) => void;
  setRecentReleaseApps: (apps: MarketplaceApp[]) => void;
  setIsRecentReleaseLoading: (isRecentReleaseLoading: boolean) => void;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setGithubPat: (githubPat: string) => void;
  setGithubOauthClientId: (clientId: string) => void;
  setResultsPerProvider: (resultsPerProvider: number) => void;
  setGithubSession: (session: Partial<GithubSessionState>) => void;
  clearGithubSession: () => void;
  setGithubDeviceChallenge: (challenge: ActiveGithubDeviceChallenge | null) => void;
  setIsGithubAuthenticating: (isGithubAuthenticating: boolean) => void;
  reset: () => void;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
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
  state: Pick<MarketplaceState, 'activeProviders' | 'sortBy' | 'resultsPerProvider'>,
): string[] {
  const summaries = [`Sort: ${state.sortBy}`, `${state.resultsPerProvider}/provider`];

  if (state.activeProviders.length !== ALL_PROVIDERS.length) {
    summaries.unshift(
      `${state.activeProviders.length} source${state.activeProviders.length !== 1 ? 's' : ''}`,
    );
  } else {
    summaries.unshift('All sources');
  }

  return summaries;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,
  selectedApp: null,
  isDetailOpen: false,
  activeProviders: loadFromStorage<ProviderSource[]>('marketplace_providers', ALL_PROVIDERS),
  sortBy: loadFromStorage<MarketplaceSortBy>('marketplace_sort', 'relevance'),
  viewMode: loadFromStorage<'grid' | 'list'>('marketplace_view', 'grid'),
  trendingApps: [],
  isTrendingLoading: false,
  recentReleaseApps: [],
  isRecentReleaseLoading: false,
  searchHistory: loadFromStorage<string[]>('marketplace_history', []),
  recentlyViewedApps: loadFromStorage<MarketplaceApp[]>('marketplace_recently_viewed', []),
  isSettingsOpen: false,
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

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setIsSearching: (isSearching) => set({ isSearching }),

  openDetail: (app) => {
    const recentlyViewedApps = uniqueRecentApps(get().recentlyViewedApps, app);
    saveToStorage('marketplace_recently_viewed', recentlyViewedApps);
    set({ selectedApp: app, isDetailOpen: true, recentlyViewedApps });
  },
  closeDetail: () => set({ selectedApp: null, isDetailOpen: false }),

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

  setSortBy: (sortBy) => {
    saveToStorage('marketplace_sort', sortBy);
    set({ sortBy });
  },

  setViewMode: (viewMode) => {
    saveToStorage('marketplace_view', viewMode);
    set({ viewMode });
  },

  setTrendingApps: (trendingApps) => set({ trendingApps }),
  setIsTrendingLoading: (isTrendingLoading) => set({ isTrendingLoading }),
  setRecentReleaseApps: (recentReleaseApps) => set({ recentReleaseApps }),
  setIsRecentReleaseLoading: (isRecentReleaseLoading) => set({ isRecentReleaseLoading }),

  addToSearchHistory: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;

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

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

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

  setGithubSession: (session) =>
    set((state) => ({
      githubSession: {
        ...state.githubSession,
        ...session,
      },
    })),

  clearGithubSession: () =>
    set({
      githubSession: { accessToken: null, user: null, rateLimit: null },
      githubDeviceChallenge: null,
      isGithubAuthenticating: false,
    }),

  setGithubDeviceChallenge: (githubDeviceChallenge) => set({ githubDeviceChallenge }),
  setIsGithubAuthenticating: (isGithubAuthenticating) => set({ isGithubAuthenticating }),

  reset: () =>
    set({
      query: '',
      results: [],
      isSearching: false,
      selectedApp: null,
      isDetailOpen: false,
      githubDeviceChallenge: null,
      isGithubAuthenticating: false,
    }),
}));
