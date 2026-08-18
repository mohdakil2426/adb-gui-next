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
  GetDeviceTelemetry: vi.fn().mockResolvedValue(null),
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
  RunAdbHostCommand: vi.fn(),
  RunShellCommand: vi.fn(),
  SaveLog: vi.fn(),
  SaveScreenshot: vi.fn(),
  SelectScreenshotPng: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ViewUtilities', () => {
  it('renders precision hero banner and 5 tab triggers', async () => {
    const user = userEvent.setup();
    render(<ViewUtilities />, { wrapper });

    expect(screen.getByRole('heading', { name: 'Utilities', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /power & tweaks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fastboot/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /host setup/i })).toBeInTheDocument();

    // Default active tab is Overview
    expect(screen.getByRole('tab', { name: /overview/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText('Instant Action Command Cockpit')).toBeInTheDocument();
    expect(screen.getByText('Device Vitals & Diagnostic Matrix')).toBeInTheDocument();

    // Navigate to Power tab
    await user.click(screen.getByRole('tab', { name: /power & tweaks/i }));
    expect(screen.getByText('Target Reboot Actions')).toBeInTheDocument();
    expect(screen.getByText('Android System Tweaks')).toBeInTheDocument();

    // Navigate to Fastboot tab
    await user.click(screen.getByRole('tab', { name: /fastboot/i }));
    expect(screen.getByText(/Bootloader Slot Controls/i)).toBeInTheDocument();
    // Navigate to Host Setup tab
    await user.click(screen.getByRole('tab', { name: /host setup/i }));
    expect(screen.getByText('Host ADB Server Controls')).toBeInTheDocument();
  });
});
