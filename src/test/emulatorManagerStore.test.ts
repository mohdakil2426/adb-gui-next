import { beforeEach, describe, expect, it } from 'vitest';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';

describe('emulatorManagerStore', () => {
  beforeEach(() => {
    useEmulatorManagerStore.getState().reset();
  });

  it('tracks root preparation state until cleared', () => {
    useEmulatorManagerStore.getState().setRootSession({
      avdName: 'Pixel_8_API_34',
      serial: 'emulator-5554',
      normalizedPackagePath: 'C:/temp/magisk.apk',
      fakeBootRemotePath: '/sdcard/Download/fakeboot.img',
      instructions: ['Patch the fake boot image'],
    });

    expect(useEmulatorManagerStore.getState().rootSession?.serial).toBe('emulator-5554');

    useEmulatorManagerStore.getState().clearRootSession();

    expect(useEmulatorManagerStore.getState().rootSession).toBeNull();
  });

  it('stores and clears restore plan', () => {
    useEmulatorManagerStore.getState().setRestorePlan({
      entries: [{ originalPath: '/data/ramdisk.img', backupPath: '/data/ramdisk.img.backup' }],
      createdAt: '2026-04-08T00:00:00Z',
      source: 'Pixel_8_API_34',
    });

    expect(useEmulatorManagerStore.getState().restorePlan?.source).toBe('Pixel_8_API_34');

    useEmulatorManagerStore.getState().setRestorePlan(null);

    expect(useEmulatorManagerStore.getState().restorePlan).toBeNull();
  });
});
