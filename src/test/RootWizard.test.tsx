import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RootWizard } from '@/components/emulator-manager/RootWizard';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import type { backend } from '@/lib/desktop/models';

const scanAvdRootReadinessMock = vi.fn();
const rootAvdMock = vi.fn();
const prepareAvdRootMock = vi.fn();
const finalizeAvdRootMock = vi.fn();
const verifyAvdRootMock = vi.fn();
const selectRootPackageFileMock = vi.fn();
const selectPatchedRootImageFileMock = vi.fn();
const onFileDropMock = vi.fn();
const onFileDropOffMock = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@/lib/desktop/runtime', () => ({
  OnFileDrop: (...args: unknown[]) => onFileDropMock(...args),
  OnFileDropOff: (...args: unknown[]) => onFileDropOffMock(...args),
}));

vi.mock('@/lib/desktop/backend', () => ({
  FetchMagiskStableRelease: vi.fn().mockResolvedValue({
    version: '30.7',
    tag: 'v30.7',
    assetName: 'Magisk-v30.7.apk',
    downloadUrl: 'https://example.test/Magisk-v30.7.apk',
    size: 1234,
    sha256: null,
    publishedAt: '2026-04-01T00:00:00Z',
  }),
  LaunchAvd: vi.fn(),
  FinalizeAvdRoot: (...args: unknown[]) => finalizeAvdRootMock(...args),
  PrepareAvdRoot: (...args: unknown[]) => prepareAvdRootMock(...args),
  RootAvd: (...args: unknown[]) => rootAvdMock(...args),
  ScanAvdRootReadiness: (...args: unknown[]) => scanAvdRootReadinessMock(...args),
  SelectPatchedRootImageFile: (...args: unknown[]) => selectPatchedRootImageFileMock(...args),
  SelectRootPackageFile: (...args: unknown[]) => selectRootPackageFileMock(...args),
  StopAvd: vi.fn(),
  VerifyAvdRoot: (...args: unknown[]) => verifyAvdRootMock(...args),
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
    rootAvdMock.mockReset();
    prepareAvdRootMock.mockReset();
    finalizeAvdRootMock.mockReset();
    verifyAvdRootMock.mockReset();
    selectRootPackageFileMock.mockReset();
    selectPatchedRootImageFileMock.mockReset();
    onFileDropMock.mockReset();
    onFileDropOffMock.mockReset();
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

  it('shows patch-installed state instead of root success after patching', async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      checks: [],
      canProceed: true,
      hasWarnings: false,
      recommendedAction: null,
    });
    rootAvdMock.mockResolvedValue({
      magiskVersion: '30.7',
      patchedRamdiskPath:
        'C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img',
      managerInstalled: true,
      activationStatus: 'patchInstalled',
      message: 'Patched ramdisk installed. Cold boot the emulator, then run verification.',
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole('button', { name: /continue/i }));

    expect(await screen.findByText('Patch Installed')).toBeInTheDocument();
    expect(screen.queryByText('Root Successful!')).not.toBeInTheDocument();
  });

  it('verifies root after patch installation before showing verified success', async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      checks: [],
      canProceed: true,
      hasWarnings: false,
      recommendedAction: null,
    });
    rootAvdMock.mockResolvedValue({
      magiskVersion: '30.7',
      patchedRamdiskPath:
        'C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img',
      managerInstalled: true,
      activationStatus: 'patchInstalled',
      message: 'Patched ramdisk installed. Cold boot the emulator, then run verification.',
    });
    verifyAvdRootMock.mockResolvedValue({
      status: 'verified',
      bootCompleted: true,
      suUid: '0',
      magiskPackage: 'com.topjohnwu.magisk',
      message: 'Root verified: su returned uid 0.',
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole('button', { name: /continue/i }));
    await userEvent.click(await screen.findByRole('button', { name: /verify root/i }));

    expect(await screen.findByText('Root Verified')).toBeInTheDocument();
    expect(verifyAvdRootMock).toHaveBeenCalledWith(runningAvd.name, runningAvd.serial);
  });

  it('exposes the FAKEBOOTIMG manual flow and finalizes a patched fake boot image', async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      checks: [],
      canProceed: true,
      hasWarnings: false,
      recommendedAction: null,
    });
    selectRootPackageFileMock.mockResolvedValue('C:/Downloads/Magisk-v30.0.apk');
    prepareAvdRootMock.mockResolvedValue({
      normalizedPackagePath: 'C:/Downloads/Magisk-v30.0.apk',
      fakeBootRemotePath: '/sdcard/Download/fakeboot.img',
      instructions: ['Open Magisk', 'Patch /sdcard/Download/fakeboot.img', 'Return and finalize'],
    });
    finalizeAvdRootMock.mockResolvedValue({
      restoredFiles: ['C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img'],
      nextBootRecommendation: 'Cold boot the emulator.',
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole('button', { name: /manual mode/i }));
    expect(await screen.findByText('Manual Mode (FAKEBOOTIMG)')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /choose magisk package/i }));
    await userEvent.click(screen.getByRole('button', { name: /create fakeboot/i }));

    expect(prepareAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      serial: runningAvd.serial,
      rootPackagePath: 'C:/Downloads/Magisk-v30.0.apk',
    });
    expect(await screen.findByText('/sdcard/Download/fakeboot.img')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /finalize root/i }));

    expect(finalizeAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      serial: runningAvd.serial,
    });
    expect(await screen.findByText('Manual Patch Installed')).toBeInTheDocument();
  });

  it('finalizes manual root with a user-selected local patched image', async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      checks: [],
      canProceed: true,
      hasWarnings: false,
      recommendedAction: null,
    });
    selectRootPackageFileMock.mockResolvedValue('C:/Downloads/Magisk-v30.0.apk');
    selectPatchedRootImageFileMock.mockResolvedValue('C:/Downloads/magisk_patched-123.img');
    prepareAvdRootMock.mockResolvedValue({
      normalizedPackagePath: 'C:/Downloads/Magisk-v30.0.apk',
      fakeBootRemotePath: '/sdcard/Download/fakeboot.img',
      instructions: ['Open Magisk', 'Patch /sdcard/Download/fakeboot.img', 'Return and finalize'],
    });
    finalizeAvdRootMock.mockResolvedValue({
      restoredFiles: [
        'C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img',
        'C:/Downloads/magisk_patched-123.img',
      ],
      nextBootRecommendation: 'Cold boot the emulator.',
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole('button', { name: /manual mode/i }));
    await userEvent.click(screen.getByRole('button', { name: /choose magisk package/i }));
    await userEvent.click(screen.getByRole('button', { name: /create fakeboot/i }));
    await screen.findByText('/sdcard/Download/fakeboot.img');

    await userEvent.click(screen.getByRole('button', { name: /select patched image/i }));
    expect(await screen.findByText('C:/Downloads/magisk_patched-123.img')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /finalize root/i }));

    expect(finalizeAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      serial: runningAvd.serial,
      patchedImagePath: 'C:/Downloads/magisk_patched-123.img',
    });
  });

  it('finalizes manual root with a dropped local patched image', async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      checks: [],
      canProceed: true,
      hasWarnings: false,
      recommendedAction: null,
    });
    selectRootPackageFileMock.mockResolvedValue('C:/Downloads/Magisk-v30.0.apk');
    prepareAvdRootMock.mockResolvedValue({
      normalizedPackagePath: 'C:/Downloads/Magisk-v30.0.apk',
      fakeBootRemotePath: '/sdcard/Download/fakeboot.img',
      instructions: ['Open Magisk', 'Patch /sdcard/Download/fakeboot.img', 'Return and finalize'],
    });
    finalizeAvdRootMock.mockResolvedValue({
      restoredFiles: [
        'C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img',
        'C:/Downloads/magisk_patched-dropped.img',
      ],
      nextBootRecommendation: 'Cold boot the emulator.',
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole('button', { name: /manual mode/i }));
    await userEvent.click(screen.getByRole('button', { name: /choose magisk package/i }));
    await userEvent.click(screen.getByRole('button', { name: /create fakeboot/i }));
    await screen.findByText('/sdcard/Download/fakeboot.img');

    const dropCalls = onFileDropMock.mock.calls;
    const handler = dropCalls[dropCalls.length - 1]?.[0] as
      | { onDrop: (paths: string[], x: number, y: number) => void }
      | undefined;
    expect(handler).toBeDefined();
    await act(async () => {
      handler?.onDrop(['C:/Downloads/magisk_patched-dropped.img'], 0, 0);
    });

    expect(await screen.findByText('C:/Downloads/magisk_patched-dropped.img')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /finalize root/i }));

    expect(finalizeAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      serial: runningAvd.serial,
      patchedImagePath: 'C:/Downloads/magisk_patched-dropped.img',
    });
  });
});
