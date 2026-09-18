import { beforeEach, describe, expect, it } from "vitest";

import type { backend } from "@/desktop/models";
import {
  getMarketplaceActiveFilterSummary,
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from "@/features/marketplace/model/marketplace-store";

describe("marketplaceStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useMarketplaceStore.setState({
      activeProviders: ["F-Droid", "GitHub", "Aptoide"],
      githubApkOnly: true,
      githubDeviceChallenge: null,
      githubOauthClientId: "",
      githubPat: "",
      githubSession: { accessToken: null, rateLimit: null, user: null },
      installableOnly: false,
      isDetailOpen: false,
      isGithubAuthenticating: false,
      isSearching: false,
      lastSearch: null,
      query: "",
      recentlyViewedApps: [],
      results: [],
      resultsPerProvider: 12,
      searchHistory: [],
      selectedApp: null,
      sortBy: "relevance",
      viewMode: "grid",
    });
  });

  it("prefers an active oauth session token over the session PAT fallback", () => {
    useMarketplaceStore.setState({
      githubPat: "pat-token",
      githubSession: {
        accessToken: "oauth-token",
        rateLimit: null,
        user: null,
      },
    });

    expect(getMarketplaceEffectiveGithubToken(useMarketplaceStore.getState())).toBe("oauth-token");
  });

  it("keeps the PAT fallback in memory without persisting it to localStorage", () => {
    useMarketplaceStore.getState().setGithubPat("pat-token");

    expect(useMarketplaceStore.getState().githubPat).toBe("pat-token");
    expect(localStorage.getItem("marketplace_github_pat")).toBeNull();
  });

  it("records recent apps without duplicates and keeps the newest first", () => {
    const alpha = {
      availableSources: ["F-Droid"],
      categories: [],
      downloadUrl: null,
      downloadsCount: null,
      iconUrl: null,
      installable: false,
      language: null,
      malwareStatus: null,
      name: "Alpha",
      packageName: "app.alpha",
      rating: null,
      repoUrl: null,
      size: null,
      source: "F-Droid",
      summary: "Alpha summary",
      updatedAt: null,
      version: "1.0",
    } satisfies backend.MarketplaceApp;

    const beta = { ...alpha, name: "Beta", packageName: "app.beta" };

    useMarketplaceStore.getState().openDetail(alpha);
    useMarketplaceStore.getState().openDetail(beta);
    useMarketplaceStore.getState().openDetail(alpha);

    expect(
      useMarketplaceStore.getState().recentlyViewedApps.map((app) => app.packageName)
    ).toStrictEqual(["app.alpha", "app.beta"]);
  });

  it("summarizes active filters consistently", () => {
    const summary = getMarketplaceActiveFilterSummary({
      activeProviders: ["F-Droid", "GitHub"],
      githubApkOnly: false,
      installableOnly: false,
      resultsPerProvider: 8,
      sortBy: "downloads",
    });

    expect(summary).toStrictEqual(["2 sources", "Sort: downloads", "8/provider"]);
  });

  it("adds an installable-only chip to the filter summary", () => {
    const summary = getMarketplaceActiveFilterSummary({
      activeProviders: ["F-Droid", "GitHub", "Aptoide"],
      githubApkOnly: true,
      installableOnly: true,
      resultsPerProvider: 12,
      sortBy: "relevance",
    });

    expect(summary).toContain("Installable only");
  });
});
