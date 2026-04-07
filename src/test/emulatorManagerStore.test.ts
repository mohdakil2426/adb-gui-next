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

  it('stores activity entries with metadata', () => {
    useEmulatorManagerStore.getState().appendActivity({
      level: 'success',
      message: 'Launched Pixel_8_API_34',
    });

    const [entry] = useEmulatorManagerStore.getState().activity;

    expect(entry?.level).toBe('success');
    expect(entry?.message).toBe('Launched Pixel_8_API_34');
    expect(entry?.id).toBeTruthy();
    expect(entry?.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
