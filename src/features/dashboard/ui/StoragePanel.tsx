import { HardDrive } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { TONE_TEXT, usageTone } from '@/features/dashboard/model/tone';
import { PanelCard } from '@/features/dashboard/ui/PanelCard';
import { UsageBar } from '@/features/dashboard/ui/UsageBar';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatBytes, formatPercent, usageRatio } from '@/shared/utils/format';

interface StoragePanelProps {
  isLoading: boolean;
  volumes: backend.StorageVolume[];
}

const MEDIA_RW_PREFIX = '/mnt/media_rw/';

/**
 * Human label for a queried mount path. `mount` is the path *we* asked `df` about
 * (see `parse_df` in the Rust backend) — authoritative, unlike `df`'s own "Mounted
 * on" text (`rawMount`), which is never used to identify a volume, only shown as
 * secondary/diagnostic text below.
 */
function volumeLabel(mount: string): string {
  if (mount === '/data') {
    return 'Internal storage';
  }
  if (mount === '/storage/emulated' || mount === '/sdcard') {
    return 'Shared storage';
  }
  if (mount.startsWith(MEDIA_RW_PREFIX)) {
    return 'SD card';
  }
  return mount;
}

function VolumeRow({ volume }: { volume: backend.StorageVolume }) {
  const ratio = usageRatio(volume.usedBytes, volume.totalBytes);
  const tone = usageTone(ratio);
  const label = volumeLabel(volume.mount);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 transition-colors hover:bg-surface-raised/80">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium text-body text-foreground">{label}</span>
        <span className={cn('numeric font-semibold text-label', TONE_TEXT[tone])}>
          {formatPercent(ratio)}
        </span>
      </div>
      <UsageBar label={`${label} used`} ratio={ratio} tone={tone} />
      <div className="numeric flex items-baseline justify-between gap-3 text-caption text-muted-foreground">
        <span>
          {formatBytes(volume.usedBytes)} / {formatBytes(volume.totalBytes)}
        </span>
        <span className="font-medium text-foreground">{formatBytes(volume.freeBytes)} free</span>
      </div>
    </div>
  );
}

export function StoragePanel({ isLoading, volumes }: StoragePanelProps) {
  if (isLoading && volumes.length === 0) {
    return (
      <PanelCard icon={HardDrive} title="Storage">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard icon={HardDrive} title="Storage">
      {volumes.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No user-facing storage volumes were reported. <code className="font-mono">df</code> may be
          restricted on this build, or every mount it returned was system storage.
        </p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {volumes.map((volume) => (
            <VolumeRow key={volume.mount} volume={volume} />
          ))}
        </div>
      )}
    </PanelCard>
  );
}
