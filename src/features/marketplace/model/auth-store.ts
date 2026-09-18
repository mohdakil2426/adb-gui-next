import { create } from "zustand";

import {
  MarketplaceGetHostTokens,
  MarketplaceGetRateLimit,
  MarketplaceGetTokenStatus,
  MarketplaceGithubWebAuthFlow,
  MarketplaceLogout,
  MarketplaceRemoveHostToken,
  MarketplaceSaveHostToken,
  MarketplaceSavePat,
} from "@/desktop/backend";
import type { backend } from "@/desktop/models";

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
  error: null,
  hostTokens: [],
  isLoading: false,
  isSavingPat: false,
  isWebAuthing: false,
  logout: async () => {
    try {
      await MarketplaceLogout();
      set({ error: null, tokenStatus: null });
      await get().refresh();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg });
    }
  },
  rateLimit: null,
  refresh: async () => {
    set({ error: null, isLoading: true });
    try {
      const [tokenStatus, rateLimit, hostTokens] = await Promise.all([
        MarketplaceGetTokenStatus().catch(() => null),
        MarketplaceGetRateLimit().catch(() => null),
        MarketplaceGetHostTokens().catch(() => [] as backend.MarketplaceHostTokenEntry[]),
      ]);
      set({
        hostTokens: hostTokens as backend.MarketplaceHostTokenEntry[],
        isLoading: false,
        rateLimit,
        tokenStatus: tokenStatus as backend.MarketplaceTokenStatus | null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg, isLoading: false });
    }
  },
  removeHostToken: async (host: string) => {
    const next = await MarketplaceRemoveHostToken(host);
    set({ hostTokens: next });
  },
  saveHostToken: async (host: string, token: string, displayName?: string) => {
    const next = await MarketplaceSaveHostToken(host, token, displayName ?? null);
    set({ hostTokens: next });
  },
  savePat: async (token: string) => {
    set({ error: null, isSavingPat: true });
    try {
      const status = await MarketplaceSavePat(token);
      const rateLimit = await MarketplaceGetRateLimit().catch(() => null);
      set({ isSavingPat: false, rateLimit, tokenStatus: status });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg, isSavingPat: false });
      return false;
    }
  },
  tokenStatus: null,
  webAuth: async (clientId?: string) => {
    set({ error: null, isWebAuthing: true });
    try {
      const status = await MarketplaceGithubWebAuthFlow(clientId ?? null);
      const rateLimit = await MarketplaceGetRateLimit().catch(() => null);
      set({ isWebAuthing: false, rateLimit, tokenStatus: status });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      set({ error: msg, isWebAuthing: false });
      return false;
    }
  },
}));

// Selector helpers — mirrors Komi's HostNames logic for isSignedIn
export const selectIsLoggedIn = (state: AuthStoreState): boolean =>
  state.tokenStatus?.hasToken === true;

export const selectRateLimitExhausted = (state: AuthStoreState): boolean =>
  state.rateLimit !== null && state.rateLimit !== undefined && state.rateLimit.remaining === 0;
