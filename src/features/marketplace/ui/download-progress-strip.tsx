import { useMarketplaceDownloadStore } from "@/features/marketplace/model/download-store";
import { cn } from "@/shared/utils/cn";
import { formatBytes } from "@/shared/utils/format";

interface DownloadProgressStripProps {
  className?: string | undefined;
  packageName: string;
}

const formatEta = (seconds: number | null): string | null => {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return null;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${Math.round(seconds % 60)}s left`;
  }
  return `${Math.round(seconds)}s left`;
};

/**
 * Live determinate download bar for one package, driven by the throttled
 * `marketplace:download-progress` events. Renders nothing when that package
 * is not currently downloading.
 */
export const DownloadProgressStrip = ({ className, packageName }: DownloadProgressStripProps) => {
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
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <progress
        aria-label={`Downloading ${packageName}: ${Math.round(pct)}%`}
        className="sr-only"
        max={100}
        value={Math.round(pct)}
      >
        {Math.round(pct)}%
      </progress>
      <div className="bg-secondary h-1 w-full overflow-hidden rounded-full">
        <div
          // oxlint-disable-next-line shadcn/no-arbitrary-values -- width-only progress bar transition avoids forbidden transition:all
          className="bg-primary h-full w-(--progress-width) rounded-full transition-[width] duration-150 ease-linear"
          style={{ "--progress-width": `${pct}%` } as React.CSSProperties}
        />
      </div>
      <div className="numeric text-caption text-muted-foreground flex items-center justify-between gap-2">
        <span>{Math.round(pct)}%</span>
        {transferred ? <span className="truncate">{transferred}</span> : null}
        <span className="shrink-0">{eta ?? ""}</span>
      </div>
    </div>
  );
};
