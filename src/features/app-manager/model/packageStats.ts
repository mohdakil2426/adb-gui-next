import type { backend } from '@/desktop/models';

export interface PackageOverviewStats {
  disabledCount: number;
  permissionDensity: backend.PermissionDensityItem[];
  safetyTiers: {
    advanced: number;
    expert: number;
    recommended: number;
    unsafe: number;
  };
  storageBreakdown: backend.StorageConsumerItem[];
  systemCount: number;
  targetSdkBuckets: {
    legacy: number;
    modern: number;
    standard: number;
    maxApi?: number;
    minApi?: number;
  };
  totalCount: number;
  totalStorageBytes: number;
  userCount: number;
}

export function computePackageOverviewStats(
  telemetry: backend.AppOverviewTelemetry | null | undefined,
  debloatList: Array<{ name: string; removal: string }> = [],
  fallbackInstalled: backend.InstalledPackage[] = [],
): PackageOverviewStats {
  let recommended = 0;
  let advanced = 0;
  let expert = 0;
  let unsafe = 0;

  for (const item of debloatList) {
    const tier = item.removal.toLowerCase();
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

  if (telemetry) {
    const userCount = telemetry.userAppsCount ?? 0;
    const systemCount = telemetry.systemAppsCount ?? 0;
    const disabledCount = telemetry.disabledAppsCount ?? 0;
    const totalCount = userCount + systemCount + disabledCount;

    return {
      disabledCount,
      permissionDensity: telemetry.permissionDensity ?? [],
      safetyTiers: { advanced, expert, recommended, unsafe },
      storageBreakdown: telemetry.storageBreakdown ?? [],
      systemCount,
      targetSdkBuckets: {
        legacy: telemetry.targetSdkDistribution?.legacy ?? 0,
        modern: telemetry.targetSdkDistribution?.modern ?? 0,
        standard: telemetry.targetSdkDistribution?.standard ?? 0,
        maxApi: telemetry.targetSdkDistribution?.maxApi,
        minApi: telemetry.targetSdkDistribution?.minApi,
      },
      totalCount,
      totalStorageBytes: telemetry.totalStorageBytes ?? 0,
      userCount,
    };
  }

  let userCount = 0;
  let systemCount = 0;
  let disabledCount = 0;

  for (const pkg of fallbackInstalled) {
    if (pkg.isDisabled) {
      disabledCount++;
    } else if (pkg.packageType === 'user') {
      userCount++;
    } else {
      systemCount++;
    }
  }

  const total = fallbackInstalled.length;

  return {
    disabledCount,
    permissionDensity: [],
    safetyTiers: { advanced, expert, recommended, unsafe },
    storageBreakdown: [],
    systemCount,
    targetSdkBuckets: {
      legacy: 0,
      modern: 0,
      standard: 0,
    },
    totalCount: total,
    totalStorageBytes: 0,
    userCount,
  };
}
