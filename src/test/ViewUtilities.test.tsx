import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

vi.mock('@/desktop/backend', () => ({
  GetHostToolVersions: vi.fn().mockResolvedValue({
    adb: 'Android Debug Bridge version 1.0.41',
    fastboot: 'fastboot version 36.0.0',
  }),
  GetLogcatSnapshot: vi.fn(),
  SaveLog: vi.fn(),
  SaveScreenshot: vi.fn(),
  SelectScreenshotPng: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ViewUtilities', () => {
  it('shows host, device, inspect, and danger as stacked sections', async () => {
    render(<ViewUtilities />, { wrapper });

    expect(screen.getByRole('heading', { name: 'Utilities', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Device' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inspect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Danger' })).toBeInTheDocument();
    expect(await screen.findByText('Host ADB')).toBeInTheDocument();
    expect(screen.getByText('Device power')).toBeInTheDocument();
    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Fastboot Utilities')).toBeInTheDocument();
    expect(screen.getByText('SERIAL123')).toBeInTheDocument();
  });
});
