import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { useMemo, useState } from "react";

import { GetAppOverviewTelemetry } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { computePackageOverviewStats } from "@/features/app-manager/model/package-stats";
import { AppMetricsHeroBanner } from "@/features/app-manager/overview/app-metrics-hero-banner";
import { DebloatSafetySpectrum } from "@/features/app-manager/overview/charts/debloat-safety-spectrum";
import { PermissionDensityMatrix } from "@/features/app-manager/overview/charts/permission-density-matrix";
import { TargetSdkDistributionMeter } from "@/features/app-manager/overview/charts/target-sdk-distribution-meter";
import { TopStorageConsumersChart } from "@/features/app-manager/overview/charts/top-storage-consumers-chart";
import { QuickLaunchpadCard } from "@/features/app-manager/overview/quick-launchpad-card";
import { Ring } from "@/shared/charts/ring";
import { RingCenter } from "@/shared/charts/ring-center";
import { RingChart } from "@/shared/charts/ring-chart";
import type { RingData } from "@/shared/charts/ring-context";
import { cn } from "@/shared/utils/cn";

interface PackageDistributionCardProps {
  disabledCount: number;
  systemCount: number;
  totalCount: number;
  userCount: number;
}

const RING_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3"] as const;

export const PackageDistributionCard = ({
  disabledCount,
  systemCount,
  totalCount,
  userCount,
}: PackageDistributionCardProps) => {
  const [hoveredRing, setHoveredRing] = useState<number | null>(null);

  const total = Math.max(1, userCount + systemCount + disabledCount);
  const ringData: RingData[] = useMemo(
    () => [
      {
        color: "var(--chart-1)",
        label: "User Apps",
        maxValue: total,
        value: userCount,
      },
      {
        color: "var(--chart-2)",
        label: "System Apps",
        maxValue: total,
        value: systemCount,
      },
      {
        color: "var(--chart-3)",
        label: "Disabled Apps",
        maxValue: total,
        value: disabledCount,
      },
    ],
    [userCount, systemCount, disabledCount, total]
  );

  return (
    <div className="border-border bg-surface flex flex-col justify-between gap-3 rounded-lg border p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package aria-hidden="true" className="text-primary size-4" />
          <h3 className="text-foreground text-label font-medium">Package Distribution</h3>
        </div>
        <span className="numeric text-caption text-muted-foreground">{totalCount} packages</span>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-around">
        <div className="flex shrink-0 items-center justify-center">
          <RingChart
            baseInnerRadius={38}
            data={ringData}
            hoveredIndex={hoveredRing}
            onHoverChange={setHoveredRing}
            ringGap={5}
            size={170}
            strokeWidth={12}
          >
            <Ring index={0} />
            <Ring index={1} />
            <Ring index={2} />
            <RingCenter defaultLabel="Total" />
          </RingChart>
        </div>

        <div className="flex w-full max-w-xs flex-1 flex-col justify-center gap-2">
          {ringData.map((item, idx) => {
            const isHovered = hoveredRing === idx;
            const pct = totalCount > 0 ? Math.round((item.value / totalCount) * 100) : 0;
            return (
              <div
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md p-1.5 transition-colors",
                  isHovered ? "bg-surface-raised" : "hover:bg-surface-raised/50"
                )}
                key={item.label}
                onMouseEnter={() => setHoveredRing(idx)}
                onMouseLeave={() => setHoveredRing(null)}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn("size-2.5 shrink-0 rounded-full", RING_COLORS[idx])}
                  />
                  <span className="text-body text-foreground font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="numeric text-body text-foreground font-semibold">
                    {item.value}
                  </span>
                  <span className="numeric text-caption text-muted-foreground w-10 text-right">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
interface AppOverviewTabProps {
  debloatPackages: backend.DebloatPackageRow[];
  installedPackages: backend.InstalledPackage[];
  onOpenDebloat: () => void;
  onSelectApp?: ((packageName: string) => void) | undefined;
  selectedSerial: string | null;
}

export const AppOverviewTab = ({
  debloatPackages,
  installedPackages,
  onOpenDebloat,
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

      {/* Row 1: Package Distribution & Target SDK Distribution */}
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <PackageDistributionCard
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
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <TopStorageConsumersChart consumers={stats.storageBreakdown} onSelectApp={onSelectApp} />
        <DebloatSafetySpectrum
          onOpenDebloat={onOpenDebloat}
          tiers={stats.safetyTiers}
          totalPackages={stats.totalCount}
        />
      </div>

      {/* Row 3: Permission Matrix & Quick App Launchpad */}
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <PermissionDensityMatrix items={stats.permissionDensity} userAppCount={stats.userCount} />
        <QuickLaunchpadCard selectedSerial={selectedSerial} />
      </div>
    </div>
  );
};
