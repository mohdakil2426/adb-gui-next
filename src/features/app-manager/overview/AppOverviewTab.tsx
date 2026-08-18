import { useMemo } from 'react';
import type { backend } from '@/desktop/models';
import { computePackageOverviewStats } from '@/features/app-manager/model/packageStats';
import type { StorageConsumer } from '@/features/app-manager/model/packageTypes';
import { AppMetricsHeroBanner } from '@/features/app-manager/overview/AppMetricsHeroBanner';
import { DebloatSafetySpectrum } from '@/features/app-manager/overview/charts/DebloatSafetySpectrum';
import { PackageCompositionDonut } from '@/features/app-manager/overview/charts/PackageCompositionDonut';
import { PermissionDensityMatrix } from '@/features/app-manager/overview/charts/PermissionDensityMatrix';
import { TargetSdkDistributionMeter } from '@/features/app-manager/overview/charts/TargetSdkDistributionMeter';
import { TopStorageConsumersChart } from '@/features/app-manager/overview/charts/TopStorageConsumersChart';
import { QuickLaunchpadCard } from '@/features/app-manager/overview/QuickLaunchpadCard';

interface AppOverviewTabProps {
  debloatPackages: backend.DebloatPackageRow[];
  installedPackages: backend.InstalledPackage[];
  onOpenDebloat: () => void;
  onSelectApp?: ((packageName: string) => void) | undefined;
  selectedSerial: string | null;
}

export function AppOverviewTab({
  debloatPackages,
  installedPackages,
  onOpenDebloat,
  onSelectApp,
  selectedSerial,
}: AppOverviewTabProps) {
  const stats = useMemo(
    () => computePackageOverviewStats(installedPackages, debloatPackages),
    [debloatPackages, installedPackages],
  );

  // Top storage consumers based on actual installed packages
  const sampleStorageConsumers: StorageConsumer[] = useMemo(() => {
    const userApps = installedPackages.filter((p) => p.packageType === 'user').slice(0, 5);
    const mockSizes = [1_842_000_000, 942_000_000, 680_000_000, 420_000_000, 290_000_000];
    return userApps.map((p, i) => {
      const size = mockSizes[i] ?? 150_000_000;
      return {
        appSize: Math.round(size * 0.4),
        cacheSize: Math.round(size * 0.1),
        dataSize: Math.round(size * 0.5),
        label: p.label || p.name,
        packageName: p.name,
        totalSize: size,
      };
    });
  }, [installedPackages]);

  return (
    <div className="flex flex-col gap-4">
      {/* 5-spec Top Precision Hero Strip */}
      <AppMetricsHeroBanner stats={stats} />

      {/* Row 1: Package Composition & Target SDK Distribution */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 gap-4">
        <PackageCompositionDonut
          disabledCount={stats.disabledCount}
          systemCount={stats.systemCount}
          totalCount={stats.totalCount}
          userCount={stats.userCount}
        />
        <TargetSdkDistributionMeter
          buckets={stats.targetSdkBuckets}
          totalCount={stats.totalCount}
        />
      </div>

      {/* Row 2: Top Storage Consumers & Debloat Health Spectrum */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 gap-4">
        <TopStorageConsumersChart consumers={sampleStorageConsumers} onSelectApp={onSelectApp} />
        <DebloatSafetySpectrum
          onOpenDebloat={onOpenDebloat}
          tiers={stats.safetyTiers}
          totalPackages={stats.totalCount}
        />
      </div>

      {/* Row 3: Permission Matrix & Quick App Launchpad */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 gap-4">
        <PermissionDensityMatrix userAppCount={stats.userCount} />
        <QuickLaunchpadCard selectedSerial={selectedSerial} />
      </div>
    </div>
  );
}
