import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ViewMarketplace } from "@/features/marketplace/marketplace-view";

const openDetailMock = vi.fn<() => void>();

vi.mock(import("@/features/marketplace/model/marketplace-store"), () => ({
  useMarketplaceStore: (selector: (state: object) => unknown) =>
    selector({
      activeProviders: ["GitHub", "F-Droid", "Aptoide"],
      activeTab: "browse",
      githubPat: "",
      githubSession: { rateLimit: null, user: null },
      isDetailOpen: false,
      openDetail: openDetailMock,
      resultsPerProvider: 25,
      searchHistory: [],
      selectedApp: null,
      setActiveTab: vi.fn<(tab: string) => void>(),
      viewMode: "grid",
    }),
}));

vi.mock(import("@/features/marketplace/hooks/use-marketplace-search"), () => ({
  useMarketplaceSearch: () => ({
    fromCache: false,
    handleClear: vi.fn<() => void>(),
    handleExplore: vi.fn<() => void>(),
    handleInputChange: vi.fn<(value: unknown) => void>(),
    handleQuickSearch: vi.fn<(query: string) => void>(),
    hasQuery: true,
    isSearching: false,
    localQuery: "camera",
    rawCount: 1,
    results: [
      {
        availableSources: ["fdroid"],
        downloadUrl: "https://example.com/camera.apk",
        downloadsCount: 1000,
        iconUrl: "",
        installable: true,
        language: "Kotlin",
        name: "Camera App",
        packageName: "com.example.camera",
        rating: 4.5,
        repoUrl: null,
        source: "fdroid",
        summary: "Capture photos quickly",
        updatedAt: "2026-04-01T00:00:00Z",
        version: "1.0.0",
      },
    ],
    searchError: null,
  }),
}));

vi.mock(import("@/features/marketplace/ui/search-bar"), () => ({
  SearchBar: () => <div>Search Bar</div>,
}));

vi.mock(import("@/features/marketplace/ui/filter-bar"), () => ({
  FilterBar: () => <div>Filter Bar</div>,
}));

vi.mock(import("@/features/marketplace/ui/marketplace-empty-state"), () => ({
  MarketplaceEmptyState: () => <div>Marketplace Empty State</div>,
}));

vi.mock(import("@/features/marketplace/ui/attribution-footer"), () => ({
  AttributionFooter: () => <div>Attribution Footer</div>,
}));

vi.mock(import("@/features/marketplace/ui/app-detail-view"), () => ({
  AppDetailView: () => <div>App Detail View</div>,
}));

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe(ViewMarketplace, () => {
  it("keeps install actions separate from detail navigation in browse mode", () => {
    render(<ViewMarketplace initialTab="browse" />, { wrapper });

    expect(screen.getByRole("button", { name: "Install Camera App" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details for Camera App" })).toBeInTheDocument();
  });
});
