import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RootWizard } from '@/components/emulator-manager/RootWizard';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import type { backend } from '@/lib/desktop/models';

const scanAvdRootReadinessMock = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@/lib/desktop/backend', () => ({
  LaunchAvd: vi.fn(),
  RootAvd: vi.fn(),
  ScanAvdRootReadiness: (...args: unknown[]) => scanAvdRootReadinessMock(...args),
  StopAvd: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const runningAvd: backend.AvdSummary = {
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
  isRunning: true,
  serial: 'emulator-5554',
  bootMode: 'cold',
  warnings: [],
};

describe('RootWizard', () => {
  beforeEach(() => {
    scanAvdRootReadinessMock.mockReset();
    useEmulatorManagerStore.getState().reset();
  });

  it('does not rapidly retry the automatic preflight scan after a scan error', async () => {
    scanAvdRootReadinessMock.mockRejectedValue(new Error('adb offline'));

    render(<RootWizard avd={runningAvd} />);

    await waitFor(() => expect(scanAvdRootReadinessMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(scanAvdRootReadinessMock).toHaveBeenCalledTimes(1);
  });
});
