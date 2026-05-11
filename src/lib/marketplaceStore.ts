import { create } from "zustand";
import type { backend } from "./desktop/models";

type MarketplaceApp = backend.MarketplaceApp;
type MarketplaceSortBy = backend.MarketplaceSortBy;
type ProviderSource = backend.ProviderSource;
type GithubDeviceFlowChallenge = backend.GithubDeviceFlowChallenge;
type GithubRateLimitSummary = backend.GithubRateLimitSummary;
type GithubUserSummary = backend.GithubUserSummary;

const ALL_PROVIDERS: ProviderSource[] = ["F-Droid", "GitHub", "Aptoide"];
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
  addToSearchHistory: (query: string) => void;
  clearGithubSession: () => void;
  clearSearchHistory: () => void;
  closeDetail: () => void;
  closeSettings: () => void;
  githubDeviceChallenge: ActiveGithubDeviceChallenge | null;
  githubOauthClientId: string;
  githubPat: string;
  githubSession: GithubSessionState;
  isDetailOpen: boolean;
  isGithubAuthenticating: boolean;
  isRecentReleaseLoading: boolean;
  isSearching: boolean;
  isSettingsOpen: boolean;
  isTrendingLoading: boolean;
  openDetail: (app: MarketplaceApp) => void;
  openSettings: () => void;
  query: string;
  recentlyViewedApps: MarketplaceApp[];
  recentReleaseApps: MarketplaceApp[];
  reset: () => void;
  results: MarketplaceApp[];
  resultsPerProvider: number;
  searchHistory: string[];
  selectedApp: MarketplaceApp | null;
  setAllProviders: () => void;
  setGithubDeviceChallenge: (
    challenge: ActiveGithubDeviceChallenge | null
  ) => void;
  setGithubOauthClientId: (clientId: string) => void;
  setGithubPat: (githubPat: string) => void;
  setGithubSession: (session: Partial<GithubSessionState>) => void;
  setIsGithubAuthenticating: (isGithubAuthenticating: boolean) => void;
  setIsRecentReleaseLoading: (isRecentReleaseLoading: boolean) => void;
  setIsSearching: (isSearching: boolean) => void;
  setIsTrendingLoading: (isTrendingLoading: boolean) => void;

  setQuery: (query: string) => void;
  setRecentReleaseApps: (apps: MarketplaceApp[]) => void;
  setResults: (results: MarketplaceApp[]) => void;
  setResultsPerProvider: (resultsPerProvider: number) => void;
  setSortBy: (sortBy: MarketplaceSortBy) => void;
  setTrendingApps: (apps: MarketplaceApp[]) => void;
  setViewMode: (viewMode: "grid" | "list") => void;
  sortBy: MarketplaceSortBy;
  toggleProvider: (provider: ProviderSource) => void;
  trendingApps: MarketplaceApp[];
  viewMode: "grid" | "list";
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in desktop webview/tests.
  }
}

function uniqueRecentApps(
  apps: MarketplaceApp[],
  nextApp: MarketplaceApp
): MarketplaceApp[] {
  return [
    nextApp,
    ...apps.filter((app) => app.packageName !== nextApp.packageName),
  ].slice(0, RECENTLY_VIEWED_LIMIT);
}

export function getMarketplaceEffectiveGithubToken(
  state: MarketplaceState
): string | null {
  return state.githubSession.accessToken ?? (state.githubPat || null);
}

export function getMarketplaceActiveFilterSummary(
  state: Pick<
    MarketplaceState,
    "activeProviders" | "sortBy" | "resultsPerProvider"
  >
): string[] {
  const summaries = [
    `Sort: ${state.sortBy}`,
    `${state.resultsPerProvider}/provider`,
  ];

  if (state.activeProviders.length === ALL_PROVIDERS.length) {
    summaries.unshift("All sources");
  } else {
    summaries.unshift(
      `${state.activeProviders.length} source${state.activeProviders.length === 1 ? "" : "s"}`
    );
  }

  return summaries;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  query: "",
  results: [],
  isSearching: false,
  selectedApp: null,
  isDetailOpen: false,
  activeProviders: loadFromStorage<ProviderSource[]>(
    "marketplace_providers",
    ALL_PROVIDERS
  ),
  sortBy: loadFromStorage<MarketplaceSortBy>("marketplace_sort", "relevance"),
  viewMode: loadFromStorage<"grid" | "list">("marketplace_view", "grid"),
  trendingApps: [],
  isTrendingLoading: false,
  recentReleaseApps: [],
  isRecentReleaseLoading: false,
  searchHistory: loadFromStorage<string[]>("marketplace_history", []),
  recentlyViewedApps: loadFromStorage<MarketplaceApp[]>(
    "marketplace_recently_viewed",
    []
  ),
  isSettingsOpen: false,
  githubPat: "",
  githubOauthClientId: loadFromStorage<string>(
    "marketplace_github_client_id",
    ""
  ),
  resultsPerProvider: loadFromStorage<number>(
    "marketplace_results_per_provider",
    12
  ),
  githubSession: {
    accessToken: null,
    user: null,
    rateLimit: null,
  },
  githubDeviceChallenge: null,
  isGithubAuthenticating: false,

  setQuery: (query) => {
    set({ query });
  },
  setResults: (results) => {
    set({ results });
  },
  setIsSearching: (isSearching) => {
    set({ isSearching });
  },

  openDetail: (app) => {
    const recentlyViewedApps = uniqueRecentApps(get().recentlyViewedApps, app);
    saveToStorage("marketplace_recently_viewed", recentlyViewedApps);
    set({ selectedApp: app, isDetailOpen: true, recentlyViewedApps });
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

    const normalized =
      next.length === ALL_PROVIDERS.length ? [...ALL_PROVIDERS] : next;
    saveToStorage("marketplace_providers", normalized);
    set({ activeProviders: normalized });
  },

  setAllProviders: () => {
    saveToStorage("marketplace_providers", ALL_PROVIDERS);
    set({ activeProviders: [...ALL_PROVIDERS] });
  },

  setSortBy: (sortBy) => {
    saveToStorage("marketplace_sort", sortBy);
    set({ sortBy });
  },

  setViewMode: (viewMode) => {
    saveToStorage("marketplace_view", viewMode);
    set({ viewMode });
  },

  setTrendingApps: (trendingApps) => {
    set({ trendingApps });
  },
  setIsTrendingLoading: (isTrendingLoading) => {
    set({ isTrendingLoading });
  },
  setRecentReleaseApps: (recentReleaseApps) => {
    set({ recentReleaseApps });
  },
  setIsRecentReleaseLoading: (isRecentReleaseLoading) => {
    set({ isRecentReleaseLoading });
  },

  addToSearchHistory: (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const next = [
      trimmed,
      ...get().searchHistory.filter((entry) => entry !== trimmed),
    ].slice(0, SEARCH_HISTORY_LIMIT);
    saveToStorage("marketplace_history", next);
    set({ searchHistory: next });
  },

  clearSearchHistory: () => {
    saveToStorage("marketplace_history", []);
    set({ searchHistory: [] });
  },

  openSettings: () => {
    set({ isSettingsOpen: true });
  },
  closeSettings: () => {
    set({ isSettingsOpen: false });
  },

  setGithubPat: (githubPat) => {
    // SECURE STORAGE REQUIRED: GitHub PAT contains sensitive credentials
    // TODO: Migrate to @tauri-apps/plugin-store for secure storage
    // Current: GitHub PAT stored in-memory only (Zustand)
    // Plan:
    // 1. npm install @tauri-apps/plugin-store
    // 2. Import { load } from '@tauri-apps/plugin-store'
    // 3. Create persistent store instance at module level
    // 4. Replace in-memory state with store.get('github_pat') on init
    // 5. On setGithubPat, call store.set('github_pat', githubPat)
    set({ githubPat });
  },

  setGithubOauthClientId: (githubOauthClientId) => {
    saveToStorage("marketplace_github_client_id", githubOauthClientId);
    set({ githubOauthClientId });
  },

  setResultsPerProvider: (resultsPerProvider) => {
    saveToStorage("marketplace_results_per_provider", resultsPerProvider);
    set({ resultsPerProvider });
  },

  setGithubSession: (session) =>
    // SECURE STORAGE REQUIRED: GitHub OAuth token contains sensitive credentials
    // TODO: Migrate to @tauri-apps/plugin-store for secure storage
    // Current: OAuth access token stored in-memory only (Zustand)
    // Plan:
    // 1. npm install @tauri-apps/plugin-store
    // 2. Store accessToken separately from user/rateLimit (non-sensitive)
    // 3. Use store.set('github_oauth_token', session.accessToken) on updates
    // 4. Load token from store on app init
    {
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
      query: "",
      results: [],
      isSearching: false,
      selectedApp: null,
      isDetailOpen: false,
      githubDeviceChallenge: null,
      isGithubAuthenticating: false,
    });
  },
}));
