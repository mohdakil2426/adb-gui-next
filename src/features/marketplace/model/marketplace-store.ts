import { create } from "zustand";

import type { backend } from "@/desktop/models";
import { ALL_PROVIDER_IDS } from "@/features/marketplace/model/providers";
import type { MarketplaceLastSearch } from "@/features/marketplace/utils/browse-filters";

type MarketplaceApp = backend.MarketplaceApp;
type MarketplaceSortBy = backend.MarketplaceSortBy;
type ProviderSource = backend.ProviderSource;
type GithubDeviceFlowChallenge = backend.GithubDeviceFlowChallenge;
type GithubRateLimitSummary = backend.GithubRateLimitSummary;
type GithubUserSummary = backend.GithubUserSummary;
export type MarketplaceTab = "overview" | "browse" | "updates" | "sources";
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
  setViewMode: (viewMode: "grid" | "list") => void;
  sortBy: MarketplaceSortBy;
  toggleProvider: (provider: ProviderSource) => void;
  viewMode: "grid" | "list";
}
const loadFromStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
};
const saveToStorage = (key: string, value: unknown): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in desktop webview/tests.
  }
};
const uniqueRecentApps = (apps: MarketplaceApp[], nextApp: MarketplaceApp): MarketplaceApp[] =>
  [nextApp, ...apps.filter((app) => app.packageName !== nextApp.packageName)].slice(
    0,
    RECENTLY_VIEWED_LIMIT
  );

export const getMarketplaceEffectiveGithubToken = (state: MarketplaceState): string | null =>
  state.githubSession.accessToken ?? (state.githubPat || null);
export const getMarketplaceActiveFilterSummary = (
  state: Pick<
    MarketplaceState,
    "activeProviders" | "sortBy" | "resultsPerProvider" | "installableOnly" | "githubApkOnly"
  >
): string[] => {
  const activeProviders = state.activeProviders ?? ALL_PROVIDERS;
  const summaries = [
    `Sort: ${state.sortBy ?? "relevance"}`,
    `${state.resultsPerProvider ?? 12}/provider`,
  ];
  if (state.installableOnly) {
    summaries.push("Installable only");
  }
  if (state.githubApkOnly) {
    summaries.push("APK/APKS only");
  }
  if (activeProviders.length === ALL_PROVIDERS.length) {
    summaries.unshift("All sources");
  } else {
    summaries.unshift(`${activeProviders.length} source${activeProviders.length === 1 ? "" : "s"}`);
  }
  return summaries;
};
export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  activeProviders: loadFromStorage<ProviderSource[]>("marketplace_providers", ALL_PROVIDERS),
  activeTab: loadFromStorage<MarketplaceTab>("marketplace_tab", "overview"),
  addToSearchHistory: (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const next = [trimmed, ...get().searchHistory.filter((entry) => entry !== trimmed)].slice(
      0,
      SEARCH_HISTORY_LIMIT
    );
    saveToStorage("marketplace_history", next);
    set({ searchHistory: next });
  },
  clearGithubSession: () => {
    set({
      githubDeviceChallenge: null,
      githubSession: { accessToken: null, rateLimit: null, user: null },
      isGithubAuthenticating: false,
    });
  },
  clearSearchHistory: () => {
    saveToStorage("marketplace_history", []);
    set({ searchHistory: [] });
  },
  closeDetail: () => {
    set({ isDetailOpen: false, selectedApp: null });
  },
  githubApkOnly: loadFromStorage<boolean>("marketplace_github_apk_only", true),
  githubDeviceChallenge: null,
  githubOauthClientId: loadFromStorage<string>("marketplace_github_client_id", ""),
  githubPat: "",
  githubSession: {
    accessToken: null,
    rateLimit: null,
    user: null,
  },
  installableOnly: loadFromStorage<boolean>("marketplace_installable_only", false),
  isDetailOpen: false,
  isGithubAuthenticating: false,
  isSearching: false,
  lastSearch: loadFromStorage<MarketplaceLastSearch | null>("marketplace_last_search", null),
  openDetail: (app) => {
    const recentlyViewedApps = uniqueRecentApps(get().recentlyViewedApps, app);
    saveToStorage("marketplace_recently_viewed", recentlyViewedApps);
    set({
      activeTab: "browse",
      isDetailOpen: true,
      recentlyViewedApps,
      selectedApp: app,
    });
  },
  query: "",
  recentlyViewedApps: loadFromStorage<MarketplaceApp[]>("marketplace_recently_viewed", []),
  reset: () => {
    set({
      githubDeviceChallenge: null,
      isDetailOpen: false,
      isGithubAuthenticating: false,
      isSearching: false,
      query: "",
      results: [],
      searchError: null,
      selectedApp: null,
    });
  },
  results: [],
  resultsPerProvider: loadFromStorage<number>("marketplace_results_per_provider", 12),
  searchError: null,
  searchHistory: loadFromStorage<string[]>("marketplace_history", []),
  selectedApp: null,
  setActiveProviders: (providers) => {
    const unique = ALL_PROVIDERS.filter((id) => providers.includes(id));
    const next = unique.length === 0 ? get().activeProviders : unique;
    saveToStorage("marketplace_providers", next);
    set({ activeProviders: next });
  },
  setActiveTab: (activeTab) => {
    saveToStorage("marketplace_tab", activeTab);
    set({ activeTab });
  },
  setAllProviders: () => {
    saveToStorage("marketplace_providers", ALL_PROVIDERS);
    set({ activeProviders: [...ALL_PROVIDERS] });
  },
  setGithubApkOnly: (githubApkOnly) => {
    saveToStorage("marketplace_github_apk_only", githubApkOnly);
    set({ githubApkOnly });
  },
  setGithubDeviceChallenge: (githubDeviceChallenge) => {
    set({ githubDeviceChallenge });
  },
  setGithubOauthClientId: (githubOauthClientId) => {
    saveToStorage("marketplace_github_client_id", githubOauthClientId);
    set({ githubOauthClientId });
  },
  setGithubPat: (githubPat) => {
    set({ githubPat });
  },
  setGithubSession: (session) => {
    set((state) => ({
      githubSession: {
        ...state.githubSession,
        ...session,
      },
    }));
  },
  setInstallableOnly: (installableOnly) => {
    saveToStorage("marketplace_installable_only", installableOnly);
    set({ installableOnly });
  },
  setIsGithubAuthenticating: (isGithubAuthenticating) => {
    set({ isGithubAuthenticating });
  },
  setIsSearching: (isSearching) => {
    set({ isSearching });
  },
  setLastSearch: (lastSearch) => {
    saveToStorage("marketplace_last_search", lastSearch);
    set({ lastSearch });
  },
  setQuery: (query) => {
    set({ query });
  },
  setResults: (results) => {
    set({ results });
  },
  setResultsPerProvider: (resultsPerProvider) => {
    saveToStorage("marketplace_results_per_provider", resultsPerProvider);
    set({ resultsPerProvider });
  },
  setSearchError: (searchError) => {
    set({ searchError });
  },
  setSortBy: (sortBy) => {
    saveToStorage("marketplace_sort", sortBy);
    set({ sortBy });
  },
  setViewMode: (viewMode) => {
    saveToStorage("marketplace_view", viewMode);
    set({ viewMode });
  },
  sortBy: loadFromStorage<MarketplaceSortBy>("marketplace_sort", "relevance"),
  toggleProvider: (provider) => {
    const current = get().activeProviders;
    let next: ProviderSource[];
    if (current.includes(provider)) {
      next = current.length > 1 ? current.filter((entry) => entry !== provider) : current;
    } else {
      next = [...current, provider];
    }
    const normalized = next.length === ALL_PROVIDERS.length ? [...ALL_PROVIDERS] : next;
    saveToStorage("marketplace_providers", normalized);
    set({ activeProviders: normalized });
  },
  viewMode: loadFromStorage<"grid" | "list">("marketplace_view", "grid"),
}));
