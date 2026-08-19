import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePayloadDumperStore } from '@/features/payload-dumper/model/payloadDumperStore';
import { payloadDumperInitialState } from '@/features/payload-dumper/model/payloadDumperStoreDefaults';
import { usePayloadProgressStore } from '@/features/payload-dumper/model/payloadProgressStore';
import { ViewPayloadDumper } from '@/features/payload-dumper/PayloadDumperView';

const { mockCatalogDevices } = vi.hoisted(() => ({
  mockCatalogDevices: [
    {
      id: 'google_pixel_8_pro',
      brand: 'google',
      name: 'Google Pixel 8 Pro',
      codename: 'husky',
      series: 'Pixel 8',
      soc: 'Google Tensor G3',
      releaseYear: 2023,
      builds: [
        {
          id: 'husky_ap4a_250105_002',
          version: 'Android 15 (AP4A.250105.002)',
          buildId: 'AP4A.250105.002',
          androidVersion: 'Android 15',
          imageType: 'ota',
          releaseDate: 'January 2025',
          securityPatch: '2025-01-05',
          downloadUrl: 'https://ota.googlezip.net/husky-ota-ap4a.250105.002.zip',
          fileSize: 2_500_000_000,
          sha256: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
          isLatest: true,
        },
      ],
    },
  ],
}));

vi.mock('@/desktop/backend', () => ({
  CleanupPayloadCache: vi.fn(),
  ComputePartitionFileSha256: vi.fn().mockResolvedValue('mocksha256'),
  CreateCancellationToken: vi.fn(),
  ExtractPayload: vi.fn(),
  GetExtractionPresets: vi.fn().mockResolvedValue([]),
  GetFirmwareCatalog: vi.fn().mockResolvedValue(mockCatalogDevices),
  GetSupportedFirmwareBrands: vi
    .fn()
    .mockResolvedValue(['google', 'nothing', 'xiaomi', 'oneplus', 'samsung']),
  OpenFolder: vi.fn(),
  RefreshFirmwareCatalog: vi.fn().mockResolvedValue(mockCatalogDevices),
  SelectOutputDirectory: vi.fn(),
  SelectPayloadFile: vi.fn(),
}));

vi.mock('@/desktop/runtime', () => ({
  EventsOn: () => () => {
    // no-op unlisten
  },
  OnFileDrop: vi.fn(),
  OnFileDropOff: vi.fn(),
}));

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ViewPayloadDumper />
    </QueryClientProvider>,
  );
}

describe('ViewPayloadDumper', () => {
  beforeEach(() => {
    usePayloadProgressStore.getState().clearAll();
    usePayloadDumperStore.setState({
      ...payloadDumperInitialState,
    });
  });

  it('renders precision hero banner and 5 tab triggers in empty state', () => {
    renderWithClient();
    expect(
      screen.getByRole('heading', { name: 'Payload Dumper', hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /source & remote loader/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /firmware hub/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /extractor/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /extracted outputs & history/i })).toBeInTheDocument();
    expect(screen.getByText('Workflow Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Engine Capabilities')).toBeInTheDocument();
    expect(screen.getByText('3-Step Extraction Workflow')).toBeInTheDocument();
  });

  it('navigates to source tab when clicking source workflow shortcut card', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByText('Configure Source'));
    expect(screen.getByText(/Local File Archive/i)).toBeInTheDocument();
  });

  it('navigates to firmware hub and opens device detail', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole('tab', { name: /firmware hub/i }));
    expect(screen.getByText('Firmware Hub & Device Marketplace')).toBeInTheDocument();
    await user.click(await screen.findByText('Google Pixel 8 Pro'));
    expect(screen.getAllByText('husky').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AP4A.250105.002/).length).toBeGreaterThan(0);
  });

  it('renders the loaded state with precision hero banner and extractor controls', async () => {
    const user = userEvent.setup();
    usePayloadDumperStore.setState({
      partitions: [
        { name: 'boot', size: 67_108_864, selected: true },
        { name: 'init_boot', size: 8_388_608, selected: false },
        { name: 'vendor_boot', size: 67_108_864, selected: false },
      ],
      outputPath: 'C:/fake/output',
    });

    renderWithClient();
    await user.click(screen.getByRole('tab', { name: /extractor/i }));
    expect(await screen.findByText('boot.img')).toBeInTheDocument();
    expect(await screen.findByText('init_boot.img')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /extract 1 · 64.0 MB/i })).toBeInTheDocument();
  });

  it('surfaces a failure that wrote zero files in terminal error state', () => {
    usePayloadDumperStore.setState({
      errorMessage: 'Archive header is corrupted',
      partitions: [{ name: 'boot', size: 67_108_864, selected: false }],
      status: 'error',
    });

    renderWithClient();
    expect(screen.getByText('Extraction failed')).toBeInTheDocument();
    expect(screen.getByText('Archive header is corrupted')).toBeInTheDocument();
    expect(screen.getByText(/No images were written/i)).toBeInTheDocument();
  });
});
