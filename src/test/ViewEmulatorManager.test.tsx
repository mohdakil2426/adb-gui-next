import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewEmulatorManager } from '@/components/views/ViewEmulatorManager';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';

const fetchAvdsMock = vi.fn();
const getAvdRestorePlanMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  queryKeys: { avds: () => ['avds'] },
  fetchAvds: () => fetchAvdsMock(),
}));

vi.mock('@/lib/desktop/backend', () => ({
  FinalizeAvdRoot: vi.fn(),
  GetAvdRestorePlan: (...args: unknown[]) => getAvdRestorePlanMock(...args),
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

  it('renders the page heading', async () => {
    fetchAvdsMock.mockResolvedValue([]);

    renderWithQueryClient();

    expect(await screen.findByText('Emulator Manager')).toBeInTheDocument();
    expect(await screen.findByText('No AVDs found')).toBeInTheDocument();
  });

  it('renders the selected avd when discovery returns data', async () => {
    fetchAvdsMock.mockResolvedValue([
      {
        name: 'Pixel_8_API_34',
        iniPath: 'C:/Users/test/.android/avd/Pixel_8_API_34.ini',
        avdPath: 'C:/Users/test/.android/avd/Pixel_8_API_34.avd',
        target: 'Google Play',
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

    expect(await screen.findAllByText('Pixel_8_API_34')).toHaveLength(2);
    expect(await screen.findByText('Google Play')).toBeInTheDocument();
    expect(await screen.findAllByText('Stock')).toHaveLength(3);
  });
});
