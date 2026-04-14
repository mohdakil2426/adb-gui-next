import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewAppManager } from '@/components/views/ViewAppManager';

const getInstalledPackagesMock = vi.fn();
const getPackageIconMock = vi.fn();

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
  GetInstalledPackages: () => getInstalledPackagesMock(),
  GetPackageIcon: (packageName: string) => getPackageIconMock(packageName),
  InstallPackage: vi.fn(),
  SelectMultipleApkFiles: vi.fn(),
  UninstallPackage: vi.fn(),
}));

vi.mock('@/lib/desktop/runtime', () => ({
  OnFileDrop: vi.fn(() => () => {}),
  OnFileDropOff: vi.fn(),
}));

describe('ViewAppManager', () => {
  beforeEach(() => {
    getInstalledPackagesMock.mockReset();
    getPackageIconMock.mockReset();
  });

  it('renders a fallback package icon first and replaces it when the app icon loads', async () => {
    getInstalledPackagesMock.mockResolvedValue([
      {
        name: 'com.example.camera',
        packageType: 'user',
      },
    ]);
    getPackageIconMock.mockResolvedValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0YDUAAAAASUVORK5CYII=',
    );

    render(<ViewAppManager activeView="apps" />);

    expect(await screen.findByText('com.example.camera')).toBeInTheDocument();
    expect(screen.getByTestId('package-icon-fallback-com.example.camera')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByAltText('com.example.camera icon')).toBeInTheDocument();
    });

    expect(getPackageIconMock).toHaveBeenCalledWith('com.example.camera');
  });
});
