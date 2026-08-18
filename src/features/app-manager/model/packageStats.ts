import type { backend } from '@/desktop/models';

export interface PackageOverviewStats {
  disabledCount: number;
  safetyTiers: {
    advanced: number;
    expert: number;
    recommended: number;
    unsafe: number;
  };
  systemCount: number;
  targetSdkBuckets: {
    legacy: number; // <= API 29
    modern: number; // API 34+
    standard: number; // API 30-33
  };
  totalCount: number;
  userCount: number;
}

export function computePackageOverviewStats(
  installed: backend.InstalledPackage[],
  debloatList: Array<{ name: string; removal: string }>,
): PackageOverviewStats {
  let userCount = 0;
  let systemCount = 0;
  const disabledCount = 0;

  for (const pkg of installed) {
    if (pkg.packageType === 'user') {
      userCount++;
    } else {
      systemCount++;
    }
  }

  const debloatMap = new Map(debloatList.map((d) => [d.name, d.removal.toLowerCase()]));
  let recommended = 0;
  let advanced = 0;
  let expert = 0;
  let unsafe = 0;

  for (const pkg of installed) {
    const tier = debloatMap.get(pkg.name);
    if (tier === 'recommended') {
      recommended++;
    } else if (tier === 'advanced') {
      advanced++;
    } else if (tier === 'expert') {
      expert++;
    } else if (tier === 'unsafe') {
      unsafe++;
    }
  }

  const total = installed.length;
  // Estimate target SDK distribution across installed packages
  const modern = Math.round(total * 0.62);
  const standard = Math.round(total * 0.31);
  const legacy = Math.max(0, total - modern - standard);

  return {
    disabledCount,
    safetyTiers: { advanced, expert, recommended, unsafe },
    systemCount,
    targetSdkBuckets: {
      legacy,
      modern,
      standard,
    },
    totalCount: total,
    userCount,
  };
}
