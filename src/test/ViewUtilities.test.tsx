import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ViewUtilities } from '@/features/utilities/UtilitiesView';

vi.mock('@/features/utilities/hooks/useUtilityActions', () => ({
  useUtilityActions: () => ({
    deviceMode: 'adb',
    deviceSerial: 'SERIAL123',
    getVarContent: '',
    handleFastbootGetVars: vi.fn(),
    handleKillServer: vi.fn(),
    handleReboot: vi.fn(),
    handleRestartServer: vi.fn(),
    handleSaveGetVars: vi.fn(),
    handleSetActiveSlot: vi.fn(),
    handleWipeData: vi.fn(),
    isEditing: false,
    isGlobalLoading: false,
    loadingAction: null,
    refetchDevices: vi.fn(),
    sentAction: null,
    setIsEditing: vi.fn(),
    setShowGetVarDialog: vi.fn(),
    showGetVarDialog: false,
  }),
}));

vi.mock('@/shared/components/EditNicknameDialog', () => ({
  EditNicknameDialog: () => null,
}));

vi.mock('@/desktop/runtime', () => ({
  EventsOn: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@/desktop/backend', () => ({
  GetHostToolVersions: vi.fn().mockResolvedValue({
    adb: 'Android Debug Bridge version 1.0.41',
    fastboot: 'fastboot version 36.0.0',
  }),
  GetLogcatSnapshot: vi.fn(),
  HostSetupInstall: vi.fn(),
  HostSetupInstallDriver: vi.fn(),
  HostSetupRepairPath: vi.fn(),
  HostSetupStatus: vi.fn().mockResolvedValue({
    adbPresent: false,
    driverInstalled: false,
    driverLabel: 'Not installed',
    installPath: 'C:\\Android\\platform-tools',
    latestPlatformTools: '36.0.0',
    latestUsbDriver: '13',
    onPath: false,
  }),
  LaunchDeviceManager: vi.fn(),
  LaunchHostSetupTerminal: vi.fn(),
  OpenFolder: vi.fn(),
  SaveLog: vi.fn(),
  SaveScreenshot: vi.fn(),
  SelectScreenshotPng: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ViewUtilities', () => {
  it('groups host, ADB, and fastboot into tabs', async () => {
    const user = userEvent.setup();
    render(<ViewUtilities />, { wrapper });

    expect(screen.getByRole('heading', { name: 'Utilities', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Host' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ADB' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Fastboot' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ADB', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Device power')).toBeVisible();
    expect(screen.getByText('Diagnostics')).toBeVisible();
    expect(screen.queryByText('Host ADB')).not.toBeInTheDocument();
    expect(screen.queryByText('Fastboot Utilities')).not.toBeInTheDocument();
    expect(screen.getByText('SERIAL123')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Host' }));
    expect(await screen.findByText('Host ADB')).toBeVisible();
    expect(screen.queryByText('Device power')).not.toBeInTheDocument();
    expect(screen.queryByText('Fastboot Utilities')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Fastboot' }));
    expect(screen.getByText('Fastboot Utilities')).toBeVisible();
    expect(screen.queryByText('Device power')).not.toBeInTheDocument();
    expect(screen.queryByText('Host ADB')).not.toBeInTheDocument();
  });
});
