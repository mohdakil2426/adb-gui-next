import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { GetAppOverviewTelemetry } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { computePackageOverviewStats } from "@/features/app-manager/model/package-stats";
import { AppMetricsHeroBanner } from "@/features/app-manager/overview/app-metrics-hero-banner";
import { PackageCompositionDonut } from "@/features/app-manager/overview/charts/package-composition-donut";
import { PermissionDensityMatrix } from "@/features/app-manager/overview/charts/permission-density-matrix";
import { TopStorageConsumersChart } from "@/features/app-manager/overview/charts/top-storage-consumers-chart";
import { QuickLaunchpadCard } from "@/features/app-manager/overview/quick-launchpad-card";

interface AppOverviewTabProps {
  debloatPackages: backend.DebloatPackageRow[];
  installedPackages: backend.InstalledPackage[];
  onSelectApp?: ((packageName: string) => void) | undefined;
  selectedSerial: string | null;
}

export const AppOverviewTab = ({
  debloatPackages,
  installedPackages,
  onSelectApp,
  selectedSerial,
}: AppOverviewTabProps) => {
  // Telemetry poll (child charts handle empty display when data?.length === 0)
  const { data: telemetry } = useQuery({
    enabled: Boolean(selectedSerial),
    queryFn: () => GetAppOverviewTelemetry(selectedSerial),
    queryKey: ["appOverviewTelemetry", selectedSerial],
    staleTime: 30_000,
  });

  const stats = useMemo(
    () => computePackageOverviewStats(telemetry, debloatPackages, installedPackages),
    [telemetry, debloatPackages, installedPackages]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 5-spec Top Precision Hero Strip */}
      <AppMetricsHeroBanner stats={stats} />

      {/* Overview Cards (2x2 Grid) */}
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <PackageCompositionDonut
          disabledCount={stats.disabledCount}
          systemCount={stats.systemCount}
          totalCount={stats.totalCount}
          userCount={stats.userCount}
        />
        <TopStorageConsumersChart
          consumers={stats.storageBreakdown}
          fallbackPackages={installedPackages}
          onSelectApp={onSelectApp}
        />
        <PermissionDensityMatrix items={stats.permissionDensity} userAppCount={stats.userCount} />
        <QuickLaunchpadCard selectedSerial={selectedSerial} />
      </div>
    </div>
  );
};
