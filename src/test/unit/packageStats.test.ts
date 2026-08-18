import { describe, expect, it } from 'vitest';
import { computePackageOverviewStats } from '@/features/app-manager/model/packageStats';

describe('computePackageOverviewStats', () => {
  it('computes composition and safety tiers correctly', () => {
    const packages = [
      { label: 'App One', name: 'com.app.one', packageType: 'user' },
      { label: 'App Two', name: 'com.app.two', packageType: 'system' },
      { label: 'Bloat One', name: 'com.bloat.one', packageType: 'system' },
    ];
    const debloatList = [{ name: 'com.bloat.one', removal: 'recommended' }];

    const stats = computePackageOverviewStats(packages, debloatList);
    expect(stats.totalCount).toBe(3);
    expect(stats.userCount).toBe(1);
    expect(stats.systemCount).toBe(2);
    expect(stats.safetyTiers.recommended).toBe(1);
  });
});
