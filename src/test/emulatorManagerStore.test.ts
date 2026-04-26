import { beforeEach, describe, expect, it } from 'vitest';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';

describe('emulatorManagerStore', () => {
  beforeEach(() => {
    useEmulatorManagerStore.getState().reset();
  });

  it('tracks root wizard source selection', () => {
    useEmulatorManagerStore.getState().setRootWizardSource({ type: 'stable' });

    expect(useEmulatorManagerStore.getState().rootWizard.source).toEqual({
      type: 'stable',
    });

    useEmulatorManagerStore.getState().resetRootWizard();

    expect(useEmulatorManagerStore.getState().rootWizard.source).toBeNull();
    expect(useEmulatorManagerStore.getState().rootWizard.step).toBe('preflight');
  });

  it('tracks root wizard progress', () => {
    useEmulatorManagerStore.getState().setRootWizardStep('progress');
    useEmulatorManagerStore.getState().setRootWizardProgress({
      step: 3,
      totalSteps: 8,
      label: 'Extracting binaries',
      detail: 'x86_64',
    });

    expect(useEmulatorManagerStore.getState().rootWizard.step).toBe('progress');
    expect(useEmulatorManagerStore.getState().rootWizard.progress?.step).toBe(3);
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
