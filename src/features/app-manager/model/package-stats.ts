import type { backend } from "@/desktop/models";

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

const countDebloatTiers = (debloatList: { name: string; removal: string }[]) => {
  let recommended = 0;
  let advanced = 0;
  let expert = 0;
  let unsafe = 0;

  for (const item of debloatList) {
    const tier = item.removal?.toLowerCase() || "";
    if (tier === "recommended") {
      recommended += 1;
    } else if (tier === "advanced") {
      advanced += 1;
    } else if (tier === "expert") {
      expert += 1;
    } else if (tier === "unsafe") {
      unsafe += 1;
    }
  }

  return { advanced, expert, recommended, unsafe };
};

const filterStorageBreakdown = (
  items: backend.StorageConsumerItem[] | undefined,
  userPackageNames: Set<string>,
  systemPackageNames: Set<string>
): backend.StorageConsumerItem[] =>
  (items ?? []).filter((item) => {
    const pkg =
      item.packageName ??
      (typeof item === "object" && item !== null && "name" in item && typeof item.name === "string"
        ? item.name
        : "");
    if (systemPackageNames.has(pkg)) {
      return false;
    }
    if (userPackageNames.size > 0 && !userPackageNames.has(pkg)) {
      return false;
    }
    return true;
  });

const countFallbackPackages = (fallbackInstalled: backend.InstalledPackage[]) => {
  let userCount = 0;
  let systemCount = 0;
  let disabledCount = 0;

  for (const pkg of fallbackInstalled) {
    if (pkg.isDisabled) {
      disabledCount += 1;
    } else if (pkg.packageType === "user") {
      userCount += 1;
    } else {
      systemCount += 1;
    }
  }

  return { disabledCount, systemCount, userCount };
};

export const computePackageOverviewStats = (
  telemetry: backend.AppOverviewTelemetry | null | undefined,
  debloatList: { name: string; removal: string }[] = [],
  fallbackInstalled: backend.InstalledPackage[] = []
): PackageOverviewStats => {
  const safetyTiers = countDebloatTiers(debloatList);

  if (telemetry) {
    const userCount = telemetry.userAppsCount ?? 0;
    const systemCount = telemetry.systemAppsCount ?? 0;
    const disabledCount = telemetry.disabledAppsCount ?? 0;
    const totalCount = userCount + systemCount + disabledCount;

    const userPackageNames = new Set(
      fallbackInstalled.filter((pkg) => pkg.packageType === "user").map((pkg) => pkg.name)
    );
    const systemPackageNames = new Set(
      fallbackInstalled.filter((pkg) => pkg.packageType === "system").map((pkg) => pkg.name)
    );

    const storageBreakdown = filterStorageBreakdown(
      telemetry.storageBreakdown,
      userPackageNames,
      systemPackageNames
    );

    return {
      disabledCount,
      permissionDensity: telemetry.permissionDensity ?? [],
      safetyTiers,
      storageBreakdown,
      systemCount,
      targetSdkBuckets: {
        legacy: telemetry.targetSdkDistribution?.legacy ?? 0,
        maxApi: telemetry.targetSdkDistribution?.maxApi,
        minApi: telemetry.targetSdkDistribution?.minApi,
        modern: telemetry.targetSdkDistribution?.modern ?? 0,
        standard: telemetry.targetSdkDistribution?.standard ?? 0,
      },
      totalCount,
      totalStorageBytes: telemetry.totalStorageBytes ?? 0,
      userCount,
    };
  }

  const { disabledCount, systemCount, userCount } = countFallbackPackages(fallbackInstalled);
  const total = fallbackInstalled.length;

  return {
    disabledCount,
    permissionDensity: [],
    safetyTiers,
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
};
