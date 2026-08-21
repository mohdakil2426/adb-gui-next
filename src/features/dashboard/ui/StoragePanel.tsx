import { m, useReducedMotion } from 'framer-motion';
import { CheckCircle2, FolderArchive, HardDrive, Layers } from 'lucide-react';
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

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

function VolumeRow({ index, volume }: { index: number; volume: backend.StorageVolume }) {
  const shouldReduceMotion = useReducedMotion();
  const ratio = usageRatio(volume.usedBytes, volume.totalBytes);
  const tone = usageTone(ratio);
  const label = volumeLabel(volume.mount);

  const isBogusMount =
    volume.rawMount && volume.rawMount !== volume.mount && volume.rawMount.startsWith('/apex');
  const mountTitle = isBogusMount
    ? `${volume.mount} (df reported: ${volume.rawMount})`
    : volume.rawMount || volume.mount;

  return (
    <m.div
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface-raised/40 p-2 transition-colors hover:bg-surface-raised/80"
      initial={shouldReduceMotion ? false : { opacity: 0, x: -4 }}
      layout={!shouldReduceMotion}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.3, delay: index * 0.06, ease: [0.2, 0, 0, 1] }
      }
      whileHover={shouldReduceMotion ? { y: 0 } : { y: -1 }}
      whileTap={shouldReduceMotion ? { scale: 1 } : { scale: 0.99 }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5 truncate">
          <span className="font-medium text-body text-foreground">{label}</span>
          <span className="font-mono text-caption text-muted-foreground" title={mountTitle}>
            {volume.mount}
          </span>
        </div>
        <m.span
          className={cn('numeric font-semibold text-label', TONE_TEXT[tone])}
          layout={!shouldReduceMotion}
        >
          {formatPercent(ratio)}
        </m.span>
      </div>
      <UsageBar label={`${label} used`} ratio={ratio} tone={tone} />
      <div className="numeric flex items-baseline justify-between gap-3 text-caption text-muted-foreground">
        <m.span layout={!shouldReduceMotion}>
          {formatBytes(volume.usedBytes)} of {formatBytes(volume.totalBytes)}
        </m.span>
        <m.span className="font-medium text-foreground" layout={!shouldReduceMotion}>
          {formatBytes(volume.freeBytes)} free
        </m.span>
      </div>
    </m.div>
  );
}

export function StoragePanel({ isLoading, volumes }: StoragePanelProps) {
  const shouldReduceMotion = useReducedMotion();

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
        <m.div
          animate="visible"
          className="flex w-full flex-1 flex-col justify-between gap-3"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={containerVariants}
        >
          <div className="flex flex-col gap-2">
            {volumes.map((volume, index) => (
              <VolumeRow index={index} key={volume.mount} volume={volume} />
            ))}
          </div>

          {/* 2x2 Micro-Metrics Chip Grid (Matches BatteryPanel & MemoryPanel) */}
          <div className="grid w-full grid-cols-2 gap-2 border-border/50 border-t pt-2">
            {/* Capacity Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <HardDrive className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Capacity
                </span>
                <span className="truncate font-medium font-mono text-[11px] text-foreground">
                  {formatBytes(totalCapacity)}
                </span>
              </div>
            </div>

            {/* Used Space Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <FolderArchive className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Used
                </span>
                <span className="truncate font-medium font-mono text-[11px] text-foreground">
                  {formatBytes(totalUsed)}
                </span>
              </div>
            </div>

            {/* Free Space Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Free
                </span>
                <span className="truncate font-medium font-mono text-[11px] text-foreground">
                  {formatBytes(totalFree)}
                </span>
              </div>
            </div>

            {/* Volumes Count Chip */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised/40 p-2 text-caption">
              <Layers className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-[10px] text-muted-foreground uppercase">
                  Volumes
                </span>
                <span className="truncate font-medium font-mono text-[11px] text-foreground">
                  {volumeCount} {volumeCount === 1 ? 'Mounted' : 'Mounted'}
                </span>
              </div>
            </div>
          </div>
        </m.div>
      )}
    </PanelCard>
  );
}
