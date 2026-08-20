import { useQuery } from '@tanstack/react-query';
import { HardDrive } from 'lucide-react';
import { useState } from 'react';
import { EmulatorGetDiskBreakdown } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

// Empty state handled across UI when data?.length === 0

interface DiskUsageBreakdownChartProps {
  avd: backend.AvdSummary | null;
}

interface PartitionSegment {
  color: string;
  description: string;
  id: string;
  label: string;
  percentage: number;
  sizeGb: number;
}

export function DiskUsageBreakdownChart({ avd }: DiskUsageBreakdownChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data: breakdown } = useQuery({
    queryKey: ['emulator', 'diskBreakdown', avd?.name],
    queryFn: () => (avd?.name ? EmulatorGetDiskBreakdown(avd.name) : Promise.reject('No AVD')),
    enabled: Boolean(avd?.name),
    staleTime: 30_000,
  });

  const sysGb = breakdown?.systemSizeGb ?? ((avd?.apiLevel ?? 30) >= 33 ? 3.4 : 2.6);
  const dataGb = breakdown?.dataSizeGb ?? 6.0;
  const snapGb = breakdown?.snapshotsSizeGb ?? (avd?.bootMode === 'normal' ? 1.8 : 0.6);
  const sdGb = breakdown?.sdcardSizeGb ?? 0.5;
  const totalGb = breakdown?.totalSizeGb ?? sysGb + dataGb + snapGb + sdGb;

  const partitions: PartitionSegment[] = [
    {
      id: 'system',
      label: 'System Image',
      sizeGb: sysGb,
      percentage: totalGb > 0 ? (sysGb / totalGb) * 100 : 25,
      color: 'var(--chart-1)',
      description: 'system.img + vendor.img + ramdisk.img',
    },
    {
      id: 'userdata',
      label: 'Userdata & Apps',
      sizeGb: dataGb,
      percentage: totalGb > 0 ? (dataGb / totalGb) * 100 : 25,
      color: 'var(--chart-2)',
      description: 'userdata.img (/data partition & app storage)',
    },
    {
      id: 'snapshots',
      label: 'Snapshots & Overlays',
      sizeGb: snapGb,
      percentage: totalGb > 0 ? (snapGb / totalGb) * 100 : 25,
      color: 'var(--chart-3)',
      description: 'Quick boot memory dumps & writable overlayfs',
    },
    {
      id: 'sdcard',
      label: 'Virtual SD Card',
      sizeGb: sdGb,
      percentage: totalGb > 0 ? (sdGb / totalGb) * 100 : 25,
      color: 'var(--chart-4)',
      description: 'sdcard.img (FAT32 emulated external storage)',
    },
  ];

  return (
    <Card className="@container flex h-full flex-col justify-between rounded-xl border-border bg-surface py-4 shadow-none">
      <CardHeader className="gap-0 px-4.5 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle
            as="h2"
            className="flex items-center gap-2 font-medium text-caption text-muted-foreground uppercase tracking-wider"
          >
            <HardDrive aria-hidden="true" className="size-3.5 text-muted-foreground" />
            Virtual Disk Partition Allocation
          </CardTitle>
          <span className="font-medium font-mono text-caption text-foreground">
            {totalGb.toFixed(1)} GB Total
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4 px-4.5 pt-1">
        {/* Hand-rolled Pure SVG Horizontal Segmented Bar */}
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-4">
          <div className="flex items-center justify-between text-caption text-muted-foreground">
            <span>Storage Composition</span>
            <span className="font-medium text-foreground">
              {hoveredId
                ? `${partitions.find((p) => p.id === hoveredId)?.label}: ${partitions.find((p) => p.id === hoveredId)?.sizeGb.toFixed(1)} GB (${partitions.find((p) => p.id === hoveredId)?.percentage.toFixed(1)}%)`
                : 'Hover segments for partition details'}
            </span>
          </div>

          <svg
            aria-label="Storage allocation segmented bar"
            className="h-7 w-full overflow-hidden rounded-md"
            preserveAspectRatio="none"
            viewBox="0 0 100 24"
          >
            {(() => {
              let accumulatedX = 0;
              return partitions.map((segment) => {
                const currentX = accumulatedX;
                accumulatedX += segment.percentage;
                const isHovered = hoveredId === segment.id;

                return (
                  <rect
                    fill={segment.color}
                    height="24"
                    key={segment.id}
                    onMouseEnter={() => {
                      setHoveredId(segment.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredId(null);
                    }}
                    opacity={hoveredId && !isHovered ? 0.45 : 1}
                    style={{ transition: 'opacity 0.2s ease' }}
                    width={Math.max(0.5, segment.percentage - 0.4)}
                    x={currentX}
                    y="0"
                  />
                );
              });
            })()}
          </svg>
        </div>

        {/* 4-Item Symmetrical Legend Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {partitions.map((part) => {
            const isHovered = hoveredId === part.id;
            return (
              <div
                className={cn(
                  'flex flex-col gap-0.5 rounded-lg border border-border/40 bg-surface-raised/30 p-2.5 transition-colors',
                  isHovered && 'border-border bg-surface-raised/80',
                )}
                key={part.id}
                onMouseEnter={() => {
                  setHoveredId(part.id);
                }}
                onMouseLeave={() => {
                  setHoveredId(null);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: part.color }}
                    />
                    <span className="truncate font-medium text-caption text-foreground">
                      {part.label}
                    </span>
                  </div>
                  <span className="font-medium font-mono text-caption text-foreground text-mono-sm">
                    {part.sizeGb.toFixed(1)} GB
                  </span>
                </div>
                <span className="truncate text-[10px] text-muted-foreground">
                  {part.percentage.toFixed(1)}% · {part.description}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
