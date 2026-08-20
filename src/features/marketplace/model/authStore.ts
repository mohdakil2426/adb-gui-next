import { create } from 'zustand';
import {
  MarketplaceGetHostTokens,
  MarketplaceGetRateLimit,
  MarketplaceGetTokenStatus,
  MarketplaceGithubWebAuthFlow,
  MarketplaceLogout,
  MarketplaceRemoveHostToken,
  MarketplaceSaveHostToken,
  MarketplaceSavePat,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';

interface AuthStoreState {
  error: string | null;
  hostTokens: backend.MarketplaceHostTokenEntry[];
  isLoading: boolean;
  isSavingPat: boolean;
  isWebAuthing: boolean;
  logout: () => Promise<void>;
  rateLimit: backend.MarketplaceRateLimitStatus | null;
  refresh: () => Promise<void>;
  removeHostToken: (host: string) => Promise<void>;
  saveHostToken: (host: string, token: string, displayName?: string) => Promise<void>;
  savePat: (token: string) => Promise<boolean>;
  tokenStatus: backend.MarketplaceTokenStatus | null;
  webAuth: (clientId?: string) => Promise<boolean>;
}

export const useMarketplaceAuthStore = create<AuthStoreState>((set, get) => ({
  tokenStatus: null,
  rateLimit: null,
  hostTokens: [],
  isLoading: false,
  isSavingPat: false,
  isWebAuthing: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const [tokenStatus, rateLimit, hostTokens] = await Promise.all([
        MarketplaceGetTokenStatus().catch(() => null),
        MarketplaceGetRateLimit().catch(() => null),
        MarketplaceGetHostTokens().catch(() => [] as backend.MarketplaceHostTokenEntry[]),
      ]);
      set({
        tokenStatus: tokenStatus as backend.MarketplaceTokenStatus | null,
        rateLimit,
        hostTokens: hostTokens as backend.MarketplaceHostTokenEntry[],
        isLoading: false,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg, isLoading: false });
    }
  },

  savePat: async (token: string) => {
    set({ isSavingPat: true, error: null });
    try {
      const status = await MarketplaceSavePat(token);
      const rateLimit = await MarketplaceGetRateLimit().catch(() => null);
      set({ tokenStatus: status, rateLimit, isSavingPat: false });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg, isSavingPat: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await MarketplaceLogout();
      set({ tokenStatus: null, error: null });
      await get().refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg });
    }
  },

  webAuth: async (clientId?: string) => {
    set({ isWebAuthing: true, error: null });
    try {
      const status = await MarketplaceGithubWebAuthFlow(clientId ?? null);
      const rateLimit = await MarketplaceGetRateLimit().catch(() => null);
      set({ tokenStatus: status, rateLimit, isWebAuthing: false });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg, isWebAuthing: false });
      return false;
    }
  },

  saveHostToken: async (host: string, token: string, displayName?: string) => {
    const next = await MarketplaceSaveHostToken(host, token, displayName ?? null);
    set({ hostTokens: next });
  },

  removeHostToken: async (host: string) => {
    const next = await MarketplaceRemoveHostToken(host);
    set({ hostTokens: next });
  },
}));

// Selector helpers — mirrors Komi's HostNames logic for isSignedIn
export function selectIsLoggedIn(state: AuthStoreState): boolean {
  return state.tokenStatus?.hasToken === true;
}

export function selectRateLimitExhausted(state: AuthStoreState): boolean {
  return state.rateLimit != null && state.rateLimit.remaining === 0;
}
