import { create } from 'zustand';
import type { backend } from './desktop/models';

type MarketplaceApp = backend.MarketplaceApp;
type ProviderSource = backend.ProviderSource;

const ALL_PROVIDERS: ProviderSource[] = ['F-Droid', 'IzzyOnDroid', 'GitHub', 'Aptoide'];

interface MarketplaceState {
  // Search
  query: string;
  results: MarketplaceApp[];
  isSearching: boolean;

  // Detail dialog
  selectedApp: MarketplaceApp | null;
  isDetailOpen: boolean;

  // Filters
  activeProviders: ProviderSource[];
  sortBy: 'relevance' | 'name' | 'recentlyUpdated' | 'downloads';

  // View mode
  viewMode: 'grid' | 'list';

  // Trending / empty state
  trendingApps: MarketplaceApp[];
  isTrendingLoading: boolean;

  // Search history
  searchHistory: string[];

  // Actions
  setQuery: (q: string) => void;
  setResults: (r: MarketplaceApp[]) => void;
  setIsSearching: (v: boolean) => void;
  openDetail: (app: MarketplaceApp) => void;
  closeDetail: () => void;
  toggleProvider: (provider: ProviderSource) => void;
  setAllProviders: () => void;
  setSortBy: (sort: MarketplaceState['sortBy']) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setTrendingApps: (apps: MarketplaceApp[]) => void;
  setIsTrendingLoading: (v: boolean) => void;
  addToSearchHistory: (q: string) => void;
  clearSearchHistory: () => void;
  reset: () => void;
}

// ─── LocalStorage persistence helpers ────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore storage errors
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,
  selectedApp: null,
  isDetailOpen: false,
  activeProviders: loadFromStorage<ProviderSource[]>('marketplace_providers', ALL_PROVIDERS),
  sortBy: loadFromStorage<MarketplaceState['sortBy']>('marketplace_sort', 'relevance'),
  viewMode: loadFromStorage<'grid' | 'list'>('marketplace_view', 'grid'),
  trendingApps: [],
  isTrendingLoading: false,
  searchHistory: loadFromStorage<string[]>('marketplace_history', []),

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setIsSearching: (isSearching) => set({ isSearching }),

  openDetail: (app) => set({ selectedApp: app, isDetailOpen: true }),
  closeDetail: () => set({ selectedApp: null, isDetailOpen: false }),

  toggleProvider: (provider) => {
    const current = get().activeProviders;
    let next: ProviderSource[];

    if (current.includes(provider)) {
      // Don't allow deselecting all providers
      next = current.length > 1 ? current.filter((p) => p !== provider) : current;
    } else {
      next = [...current, provider];
    }

    // If all are selected, store as full list
    if (next.length === ALL_PROVIDERS.length) {
      next = [...ALL_PROVIDERS];
    }

    saveToStorage('marketplace_providers', next);
    set({ activeProviders: next });
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

  addToSearchHistory: (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const history = get().searchHistory.filter((h) => h !== trimmed);
    const next = [trimmed, ...history].slice(0, 10);

    saveToStorage('marketplace_history', next);
    set({ searchHistory: next });
  },

  clearSearchHistory: () => {
    saveToStorage('marketplace_history', []);
    set({ searchHistory: [] });
  },

  reset: () =>
    set({
      query: '',
      results: [],
      isSearching: false,
      selectedApp: null,
      isDetailOpen: false,
    }),
}));
