import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewEmulatorManager } from '@/features/emulator/EmulatorView';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';

const fetchAvdsMock = vi.fn();
const getAvdRestorePlanMock = vi.fn();

vi.mock('@/shared/utils/queries', () => ({
  queryKeys: { avds: () => ['avds'] },
  fetchAvds: () => fetchAvdsMock(),
  invalidateAvds: vi.fn(),
  STALE_TIME: { EMULATOR_LIST: 30_000 },
}));

vi.mock('@/desktop/backend', () => ({
  EmulatorGetAvdSpecs: vi.fn().mockResolvedValue(null),
  EmulatorGetDiskBreakdown: vi.fn().mockResolvedValue(null),
  FinalizeAvdRoot: vi.fn(),
  GetAvdRestorePlan: (...args: unknown[]) => getAvdRestorePlanMock(...args),
  GetHostHardwareCapacity: vi.fn().mockResolvedValue({
    availableRamMb: 8192,
    logicalCores: 8,
    physicalCores: 4,
    totalRamMb: 16_384,
  }),
  LaunchAvd: vi.fn(),
  OpenFolder: vi.fn(),
  PrepareAvdRoot: vi.fn(),
  RestoreAvdBackups: vi.fn(),
  SelectRootPackageFile: vi.fn(),
  StopAvd: vi.fn(),
}));

function renderWithQueryClient() {
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
      <ViewEmulatorManager />
    </QueryClientProvider>,
  );
}

describe('ViewEmulatorManager', () => {
  beforeEach(() => {
    fetchAvdsMock.mockReset();
    getAvdRestorePlanMock.mockReset();
    useEmulatorManagerStore.getState().reset();
  });

  it('renders the page heading and empty state when no AVDs are present', async () => {
    fetchAvdsMock.mockResolvedValue([]);

    renderWithQueryClient();

    expect(
      await screen.findByRole('heading', { name: 'Emulator Manager', hidden: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText('No Virtual Device Selected')).toBeInTheDocument();
    expect(await screen.findByText('No Android Virtual Devices Found')).toBeInTheDocument();
  });

  it('renders the selected avd when discovery returns data', async () => {
    fetchAvdsMock.mockResolvedValue([
      {
        name: 'Pixel_8_API_34',
        iniPath: 'C:/Users/test/.android/avd/Pixel_8_API_34.ini',
        avdPath: 'C:/Users/test/.android/avd/Pixel_8_API_34.avd',
        target: 'Google Play API 34',
        apiLevel: 34,
        abi: 'x86_64',
        deviceName: 'pixel_8',
        ramdiskPath: 'C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img',
        hasBackups: false,
        rootState: 'stock',
        isRunning: false,
        serial: null,
        warnings: ['Ramdisk backup has not been created yet.'],
      },
    ]);
    getAvdRestorePlanMock.mockResolvedValue({
      createdAt: '0',
      source: 'Pixel_8_API_34',
      entries: [],
    });

    renderWithQueryClient();

    expect((await screen.findAllByText('Pixel_8_API_34')).length).toBeGreaterThan(0);
    expect(await screen.findByText('STOPPED')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /launch avd/i })).toBeInTheDocument();
  });
});
