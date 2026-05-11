import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewMarketplace } from '@/components/views/ViewMarketplace';

const openDetailMock = vi.fn();
const openSettingsMock = vi.fn();

vi.mock('@/lib/marketplaceStore', () => ({
  useMarketplaceStore: (selector: (state: object) => unknown) =>
    selector({
      openDetail: openDetailMock,
      openSettings: openSettingsMock,
      viewMode: 'grid',
      searchHistory: [],
      githubSession: { user: null },
      selectedApp: null,
      isDetailOpen: false,
    }),
}));

vi.mock('@/lib/marketplace/useMarketplaceSearch', () => ({
  useMarketplaceSearch: () => ({
    localQuery: 'camera',
    results: [
      {
        name: 'Camera App',
        packageName: 'com.example.camera',
        summary: 'Capture photos quickly',
        version: '1.0.0',
        source: 'fdroid',
        availableSources: ['fdroid'],
        downloadUrl: 'https://example.com/camera.apk',
        iconUrl: '',
        installable: true,
        rating: 4.5,
        downloadsCount: 1000,
        updatedAt: '2026-04-01T00:00:00Z',
        language: 'Kotlin',
        repoUrl: null,
      },
    ],
    isSearching: false,
    hasQuery: true,
    handleInputChange: vi.fn(),
    handleClear: vi.fn(),
    handleQuickSearch: vi.fn(),
  }),
}));

vi.mock('@/components/marketplace/SearchBar', () => ({
  SearchBar: () => <div>Search Bar</div>,
}));

vi.mock('@/components/marketplace/FilterBar', () => ({
  FilterBar: () => <div>Filter Bar</div>,
}));

vi.mock('@/components/marketplace/MarketplaceEmptyState', () => ({
  MarketplaceEmptyState: () => <div>Marketplace Empty State</div>,
}));

vi.mock('@/components/marketplace/AttributionFooter', () => ({
  AttributionFooter: () => <div>Attribution Footer</div>,
}));

vi.mock('@/components/marketplace/AppDetailView', () => ({
  AppDetailView: () => <div>App Detail View</div>,
}));

vi.mock('@/components/marketplace/MarketplaceSettings', () => ({
  MarketplaceSettings: () => <div>Marketplace Settings</div>,
}));

describe('ViewMarketplace', () => {
  it('keeps install actions separate from detail navigation', () => {
    render(<ViewMarketplace />);

    expect(screen.getByRole('button', { name: 'Install Camera App' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for Camera App' })).toBeInTheDocument();
  });
});
