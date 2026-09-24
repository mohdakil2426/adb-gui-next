import { CheckCircle2, HardDrive, Layers, Map as MapIcon } from "lucide-react";
import { useMemo } from "react";

import type { backend } from "@/desktop/models";
import { storageSegmentColor } from "@/features/dashboard/model/storage-colors";
import { TONE_TEXT, usageTone } from "@/features/dashboard/model/tone";
import { PanelCard } from "@/features/dashboard/ui/panel-card";
import { SpecChip } from "@/features/dashboard/ui/spec-chip";
import { StorageAllocationBar } from "@/features/dashboard/ui/storage-allocation-bar";
import { UsageBar } from "@/features/dashboard/ui/usage-bar";
import { volumeLabel } from "@/features/dashboard/ui/volume-label";
import { Ring } from "@/shared/charts/ring";
import { RingCenter } from "@/shared/charts/ring-center";
import { RingChart } from "@/shared/charts/ring-chart";
import type { RingData } from "@/shared/charts/ring-context";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatBytes, formatPercent, usageRatio } from "@/shared/utils/format";

interface StoragePanelProps {
  isLoading: boolean;
  volumes: backend.StorageVolume[];
}

const VolumeRow = ({ index, volume }: { index: number; volume: backend.StorageVolume }) => {
  const ratio = usageRatio(volume.usedBytes, volume.totalBytes);
  const tone = usageTone(ratio);
  const label = volumeLabel(volume.mount);

  const isBogusMount =
    volume.rawMount && volume.rawMount !== volume.mount && volume.rawMount.startsWith("/apex");
  const mountTitle = isBogusMount
    ? `${volume.mount} (df reported: ${volume.rawMount})`
    : volume.rawMount || volume.mount;

  return (
    <div className="border-border/60 bg-surface-raised/40 hover:bg-surface-raised/80 flex flex-col gap-1.5 rounded-lg border p-2 transition-colors">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5 truncate">
          {/* Matches this volume's segment in the capacity map above. */}
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-(--dot-color)"
            style={{ "--dot-color": storageSegmentColor(index) } as React.CSSProperties}
          />
          <span className="text-body text-foreground font-medium">{label}</span>
          <span
            className="text-caption text-muted-foreground truncate font-mono"
            title={mountTitle}
          >
            {volume.mount}
          </span>
        </div>
        <span className={cn("numeric text-label shrink-0 font-semibold", TONE_TEXT[tone])}>
          {formatPercent(ratio)}
        </span>
      </div>
      <UsageBar label={`${label} used`} ratio={ratio} tone={tone} />
      <div className="numeric text-caption text-muted-foreground flex items-baseline justify-between gap-3">
        <span>
          {formatBytes(volume.usedBytes)} of {formatBytes(volume.totalBytes)}
        </span>
        <span className="text-foreground font-medium">{formatBytes(volume.freeBytes)} free</span>
      </div>
    </div>
  );
};

export const StoragePanel = ({ isLoading, volumes }: StoragePanelProps) => {
  const mainVolume = volumes.find((v) => v.mount === "/data") ?? volumes[0];
  let maxCapacity = 0;
  let maxUsed = 0;
  let maxFree = 0;
  for (const v of volumes) {
    if (v.totalBytes > maxCapacity) {
      maxCapacity = v.totalBytes;
    }
    if (v.usedBytes > maxUsed) {
      maxUsed = v.usedBytes;
    }
    if (v.freeBytes > maxFree) {
      maxFree = v.freeBytes;
    }
  }
  const totalCapacity = mainVolume?.totalBytes ?? maxCapacity;
  const totalUsed = mainVolume?.usedBytes ?? maxUsed;
  const totalFree = mainVolume?.freeBytes ?? maxFree;
  const volumeCount = volumes.length;
  const ringData: RingData[] = useMemo(() => {
    if (totalCapacity <= 0) {
      return [];
    }
    const explicitSystem = volumes
      .filter((v) => v.mount.includes("system") || v.rawMount?.includes("system"))
      .reduce((sum, v) => sum + v.usedBytes, 0);
    const systemBytes =
      explicitSystem > 0 ? explicitSystem : Math.max(0, totalCapacity - totalUsed - totalFree);
    const userUsed = explicitSystem > 0 ? Math.max(0, totalUsed - explicitSystem) : totalUsed;

    const data: RingData[] = [
      {
        color: "var(--chart-1)",
        label: "Internal Data",
        maxValue: totalCapacity,
        value: userUsed,
      },
    ];

    if (systemBytes > 0) {
      data.push({
        color: "var(--chart-2)",
        label: "System OS",
        maxValue: totalCapacity,
        value: systemBytes,
      });
    }

    const secondaryVolumes = volumes.filter(
      (v) => v.mount !== "/data" && !v.mount.includes("system") && v.totalBytes > 0
    );
    for (const v of secondaryVolumes) {
      data.push({
        color: "var(--chart-3)",
        label: volumeLabel(v.mount),
        maxValue: v.totalBytes,
        value: v.usedBytes,
      });
    }

    return data;
  }, [totalCapacity, totalUsed, totalFree, volumes]);

  if (isLoading && volumes.length === 0) {
    return (
      <PanelCard delay={0.26} icon={HardDrive} title="Storage">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard delay={0.26} icon={HardDrive} title="Storage">
      {volumes.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No user-facing storage volumes were reported. <code className="font-mono">df</code> may be
          restricted on this build, or every mount it returned was system storage.
        </p>
      ) : (
        <div className="flex w-full flex-1 flex-col justify-between gap-3">
          {ringData.length > 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <RingChart
                baseInnerRadius={48}
                data={ringData}
                ringGap={6}
                size={184}
                strokeWidth={10}
              >
                {ringData.map((_, index) => (
                  <Ring index={index} key={ringData[index]?.label ?? index} lineCap="round" />
                ))}
                <RingCenter defaultLabel="Used">
                  {({ value, label, isHovered }) => (
                    <div className="flex flex-col items-center justify-center px-1 text-center">
                      <span className="numeric text-display text-foreground font-bold tracking-tight">
                        {formatBytes(isHovered ? value : totalUsed)}
                      </span>
                      <span className="text-caption text-muted-foreground font-medium">
                        {isHovered ? label : `used of ${formatBytes(totalCapacity)}`}
                      </span>
                    </div>
                  )}
                </RingCenter>
              </RingChart>

              {/* Ring chart legend */}
              <div className="text-caption flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="bg-chart-1 size-2 rounded-full" />
                  <span className="text-muted-foreground">Data:</span>
                  <span className="text-foreground font-medium">{formatBytes(totalUsed)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="bg-muted-foreground/30 size-2 rounded-full" />
                  <span className="text-muted-foreground">Free:</span>
                  <span className="text-foreground font-medium">{formatBytes(totalFree)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Capacity map: every volume's share of the summed capacity */}
          <div className="border-border/50 flex flex-col gap-2 pb-0.5">
            <div className="text-caption text-muted-foreground flex items-center justify-between font-medium tracking-wider uppercase">
              <span>Capacity map</span>
              <MapIcon aria-hidden="true" className="size-3.5" />
            </div>
            <StorageAllocationBar volumes={volumes} />
          </div>

          <div className="border-border/50 flex flex-col gap-2 border-t pt-2">
            {volumes.map((volume, index) => (
              <VolumeRow index={index} key={volume.mount} volume={volume} />
            ))}
          </div>

          <div className="border-border/50 grid w-full grid-cols-2 gap-2 border-t pt-2">
            <SpecChip icon={HardDrive} label="Capacity" value={formatBytes(totalCapacity)} />
            <SpecChip icon={CheckCircle2} label="Used" value={formatBytes(totalUsed)} />
            <SpecChip icon={Layers} label="Free" value={formatBytes(totalFree)} />
            <SpecChip icon={MapIcon} label="Volumes" value={`${volumeCount} mounted`} />
          </div>
        </div>
      )}
    </PanelCard>
  );
};
