import { useMarketplaceDownloadStore } from '@/features/marketplace/model/downloadStore';
import { cn } from '@/shared/utils/cn';
import { formatBytes } from '@/shared/utils/format';

interface DownloadProgressStripProps {
  className?: string | undefined;
  packageName: string;
}

function formatEta(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${Math.round(seconds % 60)}s left`;
  }
  return `${Math.round(seconds)}s left`;
}

/**
 * Live determinate download bar for one package, driven by the throttled
 * `marketplace:download-progress` events. Renders nothing when that package
 * is not currently downloading.
 */
export function DownloadProgressStrip({ className, packageName }: DownloadProgressStripProps) {
  const download = useMarketplaceDownloadStore((state) => state.activeDownloads[packageName]);

  if (!download || download.percentage >= 100) {
    return null;
  }

  const pct = Math.min(100, Math.max(0, download.percentage));
  const eta = formatEta(download.etaSeconds);
  const transferred =
    download.totalBytes && download.totalBytes > 0
      ? `${formatBytes(download.bytesDownloaded)} of ${formatBytes(download.totalBytes)}`
      : formatBytes(download.bytesDownloaded);

  return (
    <div
      aria-label={`Downloading ${packageName}: ${Math.round(pct)}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(pct)}
      className={cn('flex w-full flex-col gap-1', className)}
      role="progressbar"
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="numeric flex items-center justify-between gap-2 text-caption text-muted-foreground">
        <span>{Math.round(pct)}%</span>
        {transferred ? <span className="truncate">{transferred}</span> : null}
        <span className="shrink-0">{eta ?? ''}</span>
      </div>
    </div>
  );
}
