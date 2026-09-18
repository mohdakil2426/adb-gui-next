import { describe, expect, it } from "vitest";

import type { backend } from "@/desktop/models";
import {
  lastSearchMatches,
  visibleMarketplaceApps,
} from "@/features/marketplace/utils/browse-filters";

const app = {
  availableSources: ["F-Droid"],
  categories: [],
  downloadUrl: "https://example.com/a.apk",
  downloadsCount: null,
  iconUrl: null,
  installable: true,
  language: null,
  malwareStatus: null,
  name: "Alpha",
  packageName: "app.alpha",
  rating: null,
  repoUrl: null,
  size: null,
  source: "F-Droid",
  summary: "Alpha",
  updatedAt: null,
  version: "1.0",
} satisfies backend.MarketplaceApp;

describe("marketplace browse filters", () => {
  it("hides repo-only apps when installable-only is on", () => {
    const repoOnly = {
      ...app,
      downloadUrl: null,
      installable: false,
      packageName: "app.repo",
    };
    expect(visibleMarketplaceApps([app, repoOnly], true)).toStrictEqual([app]);
    expect(visibleMarketplaceApps([app, repoOnly], false)).toHaveLength(2);
  });

  it("matches a cached search only when query and filters align", () => {
    const cache = {
      githubApkOnly: true,
      providers: ["F-Droid", "GitHub"] as backend.ProviderSource[],
      query: "camera",
      results: [app],
      resultsPerProvider: 12,
      sortBy: "relevance" as const,
    };
    expect(
      lastSearchMatches(cache, "camera", ["F-Droid", "GitHub"], "relevance", 12, true)
    ).toBeTruthy();
    expect(
      lastSearchMatches(cache, "maps", ["F-Droid", "GitHub"], "relevance", 12, true)
    ).toBeFalsy();
  });
});
