import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewAppManager } from '@/components/views/ViewAppManager';
import { useDeviceStore } from '@/lib/deviceStore';

const getInstalledPackagesMock = vi.fn();
const getDebloatPackagesMock = vi.fn();
const loadDebloatListsMock = vi.fn();
const getDebloatDeviceSettingsMock = vi.fn();
const listDebloatBackupsMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 36,
    getVirtualItems: () => [
      {
        index: 0,
        key: 'com.example.camera',
        size: 36,
        start: 0,
      },
    ],
  }),
}));

vi.mock('@/lib/desktop/backend', () => ({
  DebloatPackages: vi.fn(),
  GetDebloatDeviceSettings: () => getDebloatDeviceSettingsMock(),
  GetDebloatPackages: () => getDebloatPackagesMock(),
  GetInstalledPackages: (serial?: string | null) => getInstalledPackagesMock(serial),
  InstallPackage: vi.fn(),
  ListDebloatBackups: () => listDebloatBackupsMock(),
  LoadDebloatLists: () => loadDebloatListsMock(),
  SaveDebloatDeviceSettings: vi.fn(),
  SelectMultipleApkFiles: vi.fn(),
  UninstallPackage: vi.fn(),
}));

vi.mock('@/lib/desktop/runtime', () => ({
  OnFileDrop: vi.fn(() => () => {}),
  OnFileDropOff: vi.fn(),
}));

describe('ViewAppManager', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
    useDeviceStore.getState().setDevices([{ serial: 'device-a', status: 'device' }]);
    getInstalledPackagesMock.mockReset();
    getDebloatPackagesMock.mockReset();
    loadDebloatListsMock.mockReset();
    getDebloatDeviceSettingsMock.mockReset();
    listDebloatBackupsMock.mockReset();
    getDebloatPackagesMock.mockResolvedValue([]);
    loadDebloatListsMock.mockResolvedValue({
      source: 'bundled',
      lastUpdated: '2026-01-01T00:00:00Z',
      totalEntries: 0,
    });
    getDebloatDeviceSettingsMock.mockResolvedValue({
      deviceId: '',
      disableMode: false,
      multiUserMode: false,
      expertMode: false,
    });
    listDebloatBackupsMock.mockResolvedValue([]);
  });

  it('renders a package icon for each visible row', async () => {
    const user = userEvent.setup();
    getInstalledPackagesMock.mockResolvedValue([
      {
        name: 'com.example.camera',
        packageType: 'user',
      },
    ]);

    render(<ViewAppManager activeView="apps" />);

    await user.click(screen.getByRole('tab', { name: /installation/i }));

    expect(await screen.findByText('com.example.camera')).toBeInTheDocument();
    expect(screen.getByText('com.example.camera').closest('[role="option"]')).toBeInTheDocument();
    expect(getInstalledPackagesMock).toHaveBeenCalledWith('device-a');
  });
});
