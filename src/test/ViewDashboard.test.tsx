import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { backend } from '@/desktop/models';
import { ViewDashboard } from '@/features/dashboard/DashboardView';
import { useMemoryHistoryStore } from '@/features/dashboard/model/memoryHistoryStore';
import { useDeviceStore } from '@/shared/stores/deviceStore';

const { GetDeviceTelemetry, GetAppOverviewTelemetry } = vi.hoisted(() => ({
  GetAppOverviewTelemetry: vi.fn(),
  GetDeviceTelemetry: vi.fn(),
}));

vi.mock('@/desktop/backend', () => ({
  ConnectWirelessAdb: vi.fn(),
  DisconnectWirelessAdb: vi.fn(),
  EnableWirelessAdb: vi.fn(),
  GetAppOverviewTelemetry,
  GetDeviceTelemetry,
  Reboot: vi.fn(),
}));

vi.mock('@/desktop/runtime', () => ({ BrowserOpenURL: vi.fn() }));

const GIB = 1024 ** 3;

const telemetry: backend.DeviceTelemetry = {
  identity: {
    androidVersion: '15',
    arch: 'arm64-v8a',
    brand: 'Google',
    buildId: 'UQ1A.240205.004',
    codename: 'panther',
    deviceName: 'Pixel 7',
    fingerprint: null,
    hardware: null,
    incremental: null,
    kernelVersion: '5.10.198-android12-9-00048',
    locale: null,
    manufacturer: null,
    model: 'Pixel 7',
    radio: null,
    sdkInt: 34,
    serial: '1A2B3C4D',
    timezone: null,
  },
  battery: {
    levelPct: 87,
    status: 'Charging',
    health: 'Good',
    temperatureC: 32.4,
    voltageMv: 4102,
    isCharging: true,
  },
  memory: { totalBytes: 8 * GIB, availableBytes: 2 * GIB, usedBytes: 6 * GIB },
  storage: [
    {
      mount: '/data',
      rawMount: '/data',
      totalBytes: 64 * GIB,
      usedBytes: 48 * GIB,
      freeBytes: 16 * GIB,
    },
  ],
  security: {
    rooted: false,
    bootloaderUnlocked: true,
    verifiedBootState: 'green',
    encryptionState: 'file',
    selinuxEnforcing: true,
    securityPatch: '2026-06-05',
  },
  network: { ipAddress: '192.168.1.14', wifiSsid: 'home', macAddress: null },
  uptimeSeconds: 273_600,
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ViewDashboard activeView="dashboard" />
    </QueryClientProvider>,
  );
}

describe('ViewDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeviceStore.getState().reset();
    useMemoryHistoryStore.setState({ samplesBySerial: {} });
    GetDeviceTelemetry.mockResolvedValue(telemetry);
    GetAppOverviewTelemetry.mockResolvedValue({
      disabledAppsCount: 3,
      permissionDensity: [],
      storageBreakdown: [],
      systemAppsCount: 212,
      targetSdkDistribution: { legacy: 4, maxApi: 34, minApi: 21, modern: 96, standard: 115 },
      totalStorageBytes: 12 * GIB,
      userAppsCount: 96,
    });
  });

  it('walks through USB setup when no device is connected', () => {
    renderDashboard();

    expect(screen.getByText('No device connected')).toBeInTheDocument();
    expect(screen.getByText('Enable Developer options')).toBeInTheDocument();
    expect(screen.getByText('Turn on USB debugging')).toBeInTheDocument();
    expect(screen.getByText('Accept the RSA prompt')).toBeInTheDocument();
    expect(screen.getByText('Watching for devices…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan again/i })).toBeInTheDocument();
    expect(GetDeviceTelemetry).not.toHaveBeenCalled();
  });

  it('reveals the wireless pairing form from the onboarding screen', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /connect wirelessly/i }));

    expect(screen.getByLabelText('Device IP address')).toBeInTheDocument();
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
  });

  it('loads telemetry automatically once a device is selected', async () => {
    useDeviceStore.setState({
      devices: [{ serial: '1A2B3C4D', status: 'device' }],
      selectedSerial: '1A2B3C4D',
    });

    renderDashboard();

    expect(await screen.findByText('87%')).toBeInTheDocument();
    expect(GetDeviceTelemetry).toHaveBeenCalledWith('1A2B3C4D');
    // Storage is charted as a proportion, not the string "48G used of 64G".
    // The headline is the human label; the raw mount path stays visible underneath.
    expect(screen.getByText('Internal storage')).toBeInTheDocument();
    expect(screen.getByText('/data')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Internal storage used' })).toBeInTheDocument();
    expect(screen.getByText('Unlocked')).toBeInTheDocument();
    expect(screen.getByText('3d 4h')).toBeInTheDocument();
  });

  it('explains why telemetry is unavailable in fastboot', async () => {
    useDeviceStore.setState({
      devices: [{ serial: 'FB1234', status: 'fastboot' }],
      selectedSerial: 'FB1234',
    });

    renderDashboard();

    expect(await screen.findByText(/Fastboot exposes no runtime telemetry/i)).toBeInTheDocument();
    expect(GetDeviceTelemetry).not.toHaveBeenCalled();
  });
});
