import { describe, expect, it } from 'vitest';
import type { backend } from '@/desktop/models';
import { computePackageOverviewStats } from '@/features/app-manager/model/packageStats';

describe('computePackageOverviewStats', () => {
  it('computes composition and safety tiers correctly', () => {
    const packages = [
      { label: 'App One', name: 'com.app.one', packageType: 'user' },
      { label: 'App Two', name: 'com.app.two', packageType: 'system' },
      { label: 'Bloat One', name: 'com.bloat.one', packageType: 'system' },
    ];
    const debloatList = [{ name: 'com.bloat.one', removal: 'recommended' }];

    const stats = computePackageOverviewStats(null, debloatList, packages);
    expect(stats.userCount).toBe(1);
    expect(stats.systemCount).toBe(2);
    expect(stats.safetyTiers.recommended).toBe(1);
  });

  it('filters storage breakdown to user apps only when installed packages are provided', () => {
    const packages = [
      { label: 'User App', name: 'com.user.app', packageType: 'user' },
      { label: 'System App', name: 'com.google.android.gms', packageType: 'system' },
    ];
    const telemetry = {
      disabledAppsCount: 0,
      permissionDensity: [],
      storageBreakdown: [
        {
          packageName: 'com.user.app',
          label: 'User App',
          appSize: 100,
          dataSize: 50,
          cacheSize: 10,
          totalSize: 160,
        },
        {
          packageName: 'com.google.android.gms',
          label: 'Gms',
          appSize: 500,
          dataSize: 200,
          cacheSize: 50,
          totalSize: 750,
        },
      ],
      systemAppsCount: 1,
      targetSdkDistribution: { legacy: 0, standard: 1, modern: 1, maxApi: 34, minApi: 21 },
      totalStorageBytes: 1000,
      userAppsCount: 1,
    } as backend.AppOverviewTelemetry;

    const stats = computePackageOverviewStats(telemetry, [], packages);
    expect(stats.storageBreakdown).toHaveLength(1);
    expect(stats.storageBreakdown[0]?.packageName).toBe('com.user.app');
  });
});
