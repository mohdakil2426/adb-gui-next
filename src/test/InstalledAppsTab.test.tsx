import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import { InstalledAppsTab } from '@/features/app-manager/debloater/ui/InstalledAppsTab';
import { useDeviceStore } from '@/shared/stores/deviceStore';

const packageLifecycleOpMock = vi.fn();
const pullPackageApkMock = vi.fn();
const selectSaveDirectoryMock = vi.fn();
const uninstallPackageMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 44,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: `pkg-${i}`,
        size: 44,
        start: i * 44,
      })),
  }),
}));

vi.mock('@/desktop/backend', () => ({
  GetAppIcons: vi.fn().mockResolvedValue([]),
  PackageLifecycleOp: (...args: unknown[]) => packageLifecycleOpMock(...args),
  PullPackageApk: (...args: unknown[]) => pullPackageApkMock(...args),
  SelectSaveDirectory: (...args: unknown[]) => selectSaveDirectoryMock(...args),
  UninstallPackage: (...args: unknown[]) => uninstallPackageMock(...args),
}));

describe('InstalledAppsTab', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
    useDeviceStore.getState().setDevices([{ serial: 'device-test-1', status: 'device' }]);
    useInstallationStore.getState().resetStore();
    packageLifecycleOpMock.mockReset();
    pullPackageApkMock.mockReset();
    selectSaveDirectoryMock.mockReset();
    uninstallPackageMock.mockReset();
  });

  it('renders toolbar filter pills with accurate package counts', () => {
    useInstallationStore.getState().setPackages([
      { label: 'Camera App', name: 'com.example.camera', packageType: 'user' },
      { label: 'System Service', name: 'com.android.server', packageType: 'system' },
      { label: 'Gallery', name: 'com.example.gallery', packageType: 'user' },
    ]);

    render(
      <InstalledAppsTab
        hasLoaded={true}
        loadError={null}
        onInspect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    const allBtn = screen.getByRole('button', { name: /^all/i });
    expect(allBtn).toHaveTextContent('3');
    const userBtn = screen.getByRole('button', { name: /^user/i });
    expect(userBtn).toHaveTextContent('2');
    const sysBtn = screen.getByRole('button', { name: /^system/i });
    expect(sysBtn).toHaveTextContent('1');
    const disBtn = screen.getByRole('button', { name: /^disabled/i });
    expect(disBtn).toHaveTextContent('0');
  });

  it('filters package list based on search query', async () => {
    const user = userEvent.setup();
    useInstallationStore.getState().setPackages([
      { label: 'Camera Pro', name: 'com.example.camera', packageType: 'user' },
      { label: 'Gallery', name: 'com.example.gallery', packageType: 'user' },
    ]);

    render(
      <InstalledAppsTab
        hasLoaded={true}
        loadError={null}
        onInspect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('Camera Pro')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search apps by name or package id/i);
    await user.type(searchInput, 'camera');

    expect(screen.getByText('Camera Pro')).toBeInTheDocument();
    expect(screen.queryByText('Gallery')).not.toBeInTheDocument();
  });

  it('renders Target SDK and size metrics on rows', () => {
    useInstallationStore
      .getState()
      .setPackages([{ label: 'Camera Pro', name: 'com.example.camera', packageType: 'user' }]);

    render(
      <InstalledAppsTab
        hasLoaded={true}
        loadError={null}
        onInspect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(/API 3[0-5]/)).toBeInTheDocument();
    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('triggers inline quick actions (Launch, Force Stop, Inspect)', async () => {
    const user = userEvent.setup();
    const onInspectMock = vi.fn();
    packageLifecycleOpMock.mockResolvedValue('ok');

    useInstallationStore
      .getState()
      .setPackages([{ label: 'Camera Pro', name: 'com.example.camera', packageType: 'user' }]);

    render(
      <InstalledAppsTab
        hasLoaded={true}
        loadError={null}
        onInspect={onInspectMock}
        onRefresh={vi.fn()}
      />,
    );

    const launchBtn = screen.getByTitle('Launch App');
    await user.click(launchBtn);
    expect(packageLifecycleOpMock).toHaveBeenCalledWith(
      'com.example.camera',
      'launch',
      'device-test-1',
    );

    const stopBtn = screen.getByTitle('Force Stop');
    await user.click(stopBtn);
    const confirmBtn = screen.getByRole('button', { name: 'Force Stop' });
    await user.click(confirmBtn);
    expect(packageLifecycleOpMock).toHaveBeenCalledWith(
      'com.example.camera',
      'force_stop',
      'device-test-1',
    );
    const disableBtn = screen.getByTitle('Disable App');
    await user.click(disableBtn);
    expect(packageLifecycleOpMock).toHaveBeenCalledWith(
      'com.example.camera',
      'disable',
      'device-test-1',
    );

    const inspectBtn = screen.getByTitle('Inspect Package Details');
    await user.click(inspectBtn);
    expect(onInspectMock).toHaveBeenCalledWith('com.example.camera');
  });

  it('renders Enable App action for disabled packages and triggers enable op', async () => {
    const user = userEvent.setup();
    packageLifecycleOpMock.mockResolvedValue('ok');

    useInstallationStore.getState().setPackages([
      {
        isDisabled: true,
        label: 'Disabled Tool',
        name: 'com.example.disabled',
        packageType: 'user',
      },
    ]);

    render(
      <InstalledAppsTab
        hasLoaded={true}
        loadError={null}
        onInspect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    const enableBtn = screen.getByTitle('Enable App');
    expect(enableBtn).toBeInTheDocument();
    await user.click(enableBtn);
    expect(packageLifecycleOpMock).toHaveBeenCalledWith(
      'com.example.disabled',
      'enable',
      'device-test-1',
    );
  });
  it('displays floating batch bar when packages are selected and triggers batch actions', async () => {
    const user = userEvent.setup();
    packageLifecycleOpMock.mockResolvedValue('ok');

    useInstallationStore.getState().setPackages([
      { label: 'Camera Pro', name: 'com.example.camera', packageType: 'user' },
      { label: 'Gallery', name: 'com.example.gallery', packageType: 'user' },
    ]);

    render(
      <InstalledAppsTab
        hasLoaded={true}
        loadError={null}
        onInspect={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    // Click row to select
    const row = screen.getByText('Camera Pro').closest('[role="option"]');
    expect(row).toBeInTheDocument();
    if (row) {
      await user.click(row);
    }
    const batchBar = screen.getByText('1 package selected').parentElement?.parentElement;
    expect(batchBar).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export apks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /uninstall \(1\)/i })).toBeInTheDocument();

    // Trigger batch force stop from batch bar
    const batchForceStop = screen
      .getAllByRole('button', { name: /force stop/i })
      .find((btn) => btn.textContent?.includes('Force Stop'));
    expect(batchForceStop).toBeDefined();
    if (batchForceStop) {
      await user.click(batchForceStop);
      const confirmBatchBtn = screen.getByRole('button', { name: 'Force Stop All' });
      await user.click(confirmBatchBtn);
    }
    expect(packageLifecycleOpMock).toHaveBeenCalledWith(
      'com.example.camera',
      'force_stop',
      'device-test-1',
    );
  });
});
