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
    {
      id: 'nothing_phone_2',
      brand: 'nothing',
      name: 'Nothing Phone (2)',
      codename: 'pong',
      series: 'Phone (2)',
      soc: 'Qualcomm Snapdragon 8+ Gen 1',
      releaseYear: 2023,
      builds: [
        {
          id: 'pong_b4_1',
          version: 'Nothing OS 4.1',
          buildId: 'Pong-B4.1-260618-1026',
          androidVersion: 'Android 16',
          imageType: 'ota',
          releaseDate: '2026-06-18',
          downloadUrl:
            'https://android.googleapis.com/packages/ota-api/package/821762bba7df49d1648ab91eef5c98574f20e740.zip',
          isLatest: true,
        },
      ],
    },
    {
      id: 'xiaomi_14',
      brand: 'xiaomi',
      name: 'Xiaomi 14',
      codename: 'houji',
      series: 'Xiaomi 14 Series',
      soc: 'Qualcomm Snapdragon 8 Gen 3',
      releaseYear: 2023,
      builds: [
        {
          id: 'xiaomi_houji_ota',
          version: 'HyperOS 1.0.18.0.UNCMIXM',
          buildId: 'OS1.0.18.0.UNCMIXM',
          androidVersion: 'Android 14',
          imageType: 'ota',
          releaseDate: '2024-11-20',
          downloadUrl:
            'https://bigota.d.miui.com/OS1.0.18.0.UNCMIXM/houji_global-ota_full-OS1.0.18.0.UNCMIXM-user-14.0-53296c0d4a.zip',
          isLatest: true,
        },
      ],
    },
    {
      id: 'oneplus_13',
      brand: 'oneplus',
      name: 'OnePlus 13',
      codename: 'infiniti',
      series: 'OnePlus Flagship Series',
      soc: 'Qualcomm Snapdragon 8 Elite',
      releaseYear: 2024,
      builds: [
        {
          id: 'oneplus_infiniti_cph2749',
          version: 'OxygenOS 16.0.2.401',
          buildId: 'CPH2749_16.0.2.401(EX01)',
          androidVersion: 'Android 16',
          imageType: 'ota',
          releaseDate: '2025-01-20',
          downloadUrl:
            'https://archive.org/download/oneplus_archive/spike0en/infiniti/CPH2749_16.0.2.401.zip',
          isLatest: true,
        },
      ],
    },
    {
      id: 'samsung_s24_ultra',
      brand: 'samsung',
      name: 'Galaxy S24 Ultra',
      codename: 'SM-S928B',
      series: 'Galaxy S Series',
      soc: 'Qualcomm Snapdragon 8 Gen 3 for Galaxy',
      releaseYear: 2024,
      builds: [
        {
          id: 'samsung_s928b_eux',
          version: 'S928BXXS6DZG1',
          buildId: 'S928BXXS6DZG1 (EUX)',
          androidVersion: 'Android 16',
          imageType: 'factory',
          releaseDate: '2026-07-20',
          downloadUrl: 'https://samfw.com/firmware/SM-S928B/EUX/S928BXXS6DZG1',
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
  GetFirmwareCatalog: vi.fn().mockImplementation((brand?: string) => {
    if (!brand) {
      return Promise.resolve(mockCatalogDevices);
    }
    return Promise.resolve(mockCatalogDevices.filter((d) => d.brand === brand));
  }),
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

  it('renders precision hero banner and 4 tab triggers in empty state', () => {
    renderWithClient();
    expect(
      screen.getByRole('heading', { name: 'Payload Dumper', hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /firmware hub/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /extractor/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /extracted outputs & history/i })).toBeInTheDocument();
    expect(screen.getByText('Workflow Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Engine Capabilities')).toBeInTheDocument();
    expect(screen.getByText('3-Step Extraction Workflow')).toBeInTheDocument();
  });

  it('navigates to extractor tab when clicking extractor workflow shortcut card', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByText('Open Extractor'));
    expect(screen.getByText(/Local File Archive/i)).toBeInTheDocument();
    expect(screen.getByText(/Remote OTA URL Stream/i)).toBeInTheDocument();
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
  it('filters Nothing devices in firmware hub and opens device detail', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole('tab', { name: /firmware hub/i }));
    await user.click(screen.getByRole('button', { name: /nothing/i }));
    expect(screen.getByText('Nothing Phone (2)')).toBeInTheDocument();
    await user.click(screen.getByText('Nothing Phone (2)'));
    expect(screen.getAllByText('pong').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pong-B4.1-260618-1026/).length).toBeGreaterThan(0);
  });

  it('filters Xiaomi devices in firmware hub and opens device detail', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole('tab', { name: /firmware hub/i }));
    await user.click(screen.getByRole('button', { name: /xiaomi/i }));
    expect(screen.getByText('Xiaomi 14')).toBeInTheDocument();
    await user.click(screen.getByText('Xiaomi 14'));
    expect(screen.getAllByText('houji').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/OS1.0.18.0.UNCMIXM/).length).toBeGreaterThan(0);
  });
  it('filters OnePlus devices in firmware hub and opens device detail', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole('tab', { name: /firmware hub/i }));
    await user.click(screen.getByRole('button', { name: /oneplus/i }));
    const oneplusCard = await screen.findByText('OnePlus 13');
    await user.click(oneplusCard);
    expect(screen.getAllByText('infiniti').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CPH2749_16.0.2.401/).length).toBeGreaterThan(0);
  });

  it('filters Samsung devices in firmware hub and opens device detail', async () => {
    const user = userEvent.setup();
    renderWithClient();
    await user.click(screen.getByRole('tab', { name: /firmware hub/i }));
    await user.click(screen.getByRole('button', { name: /samsung/i }));
    const samsungCard = await screen.findByText('Galaxy S24 Ultra');
    await user.click(samsungCard);
    expect(screen.getAllByText('SM-S928B').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S928BXXS6DZG1/).length).toBeGreaterThan(0);
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
    expect(screen.getByText(/Local File Archive/i)).toBeInTheDocument();
    expect(screen.getByText(/Remote OTA URL Stream/i)).toBeInTheDocument();
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
