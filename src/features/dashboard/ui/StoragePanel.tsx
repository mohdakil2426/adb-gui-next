import { CheckCircle2, HardDrive, Layers, Map as MapIcon } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { storageSegmentColor } from '@/features/dashboard/model/storageColors';
import { TONE_TEXT, usageTone } from '@/features/dashboard/model/tone';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { SpecChip } from '@/features/dashboard/ui/SpecChip';
import { StorageAllocationBar } from '@/features/dashboard/ui/StorageAllocationBar';
import { UsageBar } from '@/features/dashboard/ui/UsageBar';
import { volumeLabel } from '@/features/dashboard/ui/volumeLabel';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatPercent, usageRatio } from '@/shared/utils/format';

interface StoragePanelProps {
  isLoading: boolean;
  volumes: backend.StorageVolume[];
}

function VolumeRow({ index, volume }: { index: number; volume: backend.StorageVolume }) {
  const ratio = usageRatio(volume.usedBytes, volume.totalBytes);
  const tone = usageTone(ratio);
  const label = volumeLabel(volume.mount);

  const isBogusMount =
    volume.rawMount && volume.rawMount !== volume.mount && volume.rawMount.startsWith('/apex');
  const mountTitle = isBogusMount
    ? `${volume.mount} (df reported: ${volume.rawMount})`
    : volume.rawMount || volume.mount;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface-raised/40 p-2 transition-colors hover:bg-surface-raised/80">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-1.5 truncate">
          {/* Matches this volume's segment in the capacity map above. */}
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-1px] rounded-full"
            style={{ backgroundColor: storageSegmentColor(index) }}
          />
          <span className="font-medium text-body text-foreground">{label}</span>
          <span
            className="truncate font-mono text-caption text-muted-foreground"
            title={mountTitle}
          >
            {volume.mount}
          </span>
        </div>
        <span className={cn('numeric shrink-0 font-semibold text-label', TONE_TEXT[tone])}>
          {formatPercent(ratio)}
        </span>
      </div>
      <UsageBar label={`${label} used`} ratio={ratio} tone={tone} />
      <div className="numeric flex items-baseline justify-between gap-3 text-caption text-muted-foreground">
        <span>
          {formatBytes(volume.usedBytes)} of {formatBytes(volume.totalBytes)}
        </span>
        <span className="font-medium text-foreground">{formatBytes(volume.freeBytes)} free</span>
      </div>
    </div>
  );
}

export function StoragePanel({ isLoading, volumes }: StoragePanelProps) {
  const mainVolume = volumes.find((v) => v.mount === '/data') ?? volumes[0];
  const totalCapacity =
    mainVolume?.totalBytes ?? volumes.reduce((acc, v) => Math.max(acc, v.totalBytes), 0);
  const totalUsed =
    mainVolume?.usedBytes ?? volumes.reduce((acc, v) => Math.max(acc, v.usedBytes), 0);
  const totalFree =
    mainVolume?.freeBytes ?? volumes.reduce((acc, v) => Math.max(acc, v.freeBytes), 0);
  const volumeCount = volumes.length;

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
          {/* Capacity map: every volume's share of the summed capacity */}
          <div className="flex flex-col gap-2 border-border/50 pb-0.5">
            <div className="flex items-center justify-between font-medium text-caption text-muted-foreground uppercase tracking-wider">
              <span>Capacity map</span>
              <MapIcon aria-hidden="true" className="size-3.5" />
            </div>
            <StorageAllocationBar volumes={volumes} />
          </div>

          <div className="flex flex-col gap-2 border-border/50 border-t pt-2">
            {volumes.map((volume, index) => (
              <VolumeRow index={index} key={volume.mount} volume={volume} />
            ))}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 border-border/50 border-t pt-2">
            <SpecChip icon={HardDrive} label="Capacity" value={formatBytes(totalCapacity)} />
            <SpecChip icon={CheckCircle2} label="Used" value={formatBytes(totalUsed)} />
            <SpecChip icon={Layers} label="Free" value={formatBytes(totalFree)} />
            <SpecChip icon={MapIcon} label="Volumes" value={`${volumeCount} mounted`} />
          </div>
        </div>
      )}
    </PanelCard>
  );
}
