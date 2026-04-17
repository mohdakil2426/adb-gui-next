import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewAppManager } from '@/components/views/ViewAppManager';

const getInstalledPackagesMock = vi.fn();

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
  GetPackageLabel: vi.fn().mockResolvedValue(null),
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
  });

  it('renders a package icon for each visible row', async () => {
    getInstalledPackagesMock.mockResolvedValue([
      {
        name: 'com.example.camera',
        packageType: 'user',
      },
    ]);

    render(<ViewAppManager activeView="apps" />);

    expect(await screen.findByText('com.example.camera')).toBeInTheDocument();
    expect(screen.getByText('com.example.camera').closest('[role="option"]')).toBeInTheDocument();
  });
});
