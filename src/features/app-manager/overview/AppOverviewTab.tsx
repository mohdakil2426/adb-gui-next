import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { GetAppOverviewTelemetry } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { computePackageOverviewStats } from '@/features/app-manager/model/packageStats';
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
  // Telemetry poll (child charts handle empty display when data?.length === 0)
  const { data: telemetry } = useQuery({
    enabled: Boolean(selectedSerial),
    queryFn: () => GetAppOverviewTelemetry(selectedSerial),
    queryKey: ['appOverviewTelemetry', selectedSerial],
    staleTime: 30_000,
  });

  const stats = useMemo(
    () => computePackageOverviewStats(telemetry, debloatPackages, installedPackages),
    [telemetry, debloatPackages, installedPackages],
  );
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
        <TopStorageConsumersChart consumers={stats.storageBreakdown} onSelectApp={onSelectApp} />
        <DebloatSafetySpectrum
          onOpenDebloat={onOpenDebloat}
          tiers={stats.safetyTiers}
          totalPackages={stats.totalCount}
        />
      </div>

      {/* Row 3: Permission Matrix & Quick App Launchpad */}
      <div className="grid @lg:grid-cols-2 grid-cols-1 gap-4">
        <PermissionDensityMatrix items={stats.permissionDensity} userAppCount={stats.userCount} />
        <QuickLaunchpadCard selectedSerial={selectedSerial} />
      </div>
    </div>
  );
}
