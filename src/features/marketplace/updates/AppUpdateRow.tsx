import { ArrowRight, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useMarketplaceDownloadStore } from '@/features/marketplace/model/downloadStore';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { DownloadProgressStrip } from '@/features/marketplace/ui/DownloadProgressStrip';
import { ProviderBadge } from '@/features/marketplace/ui/ProviderBadge';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

export interface AppUpdateItem {
  changelogSnippet: string;
  currentVersion: string;
  downloadUrl?: string | null | undefined;
  hasUpdate: boolean;
  isInstalled: boolean;
  latestVersion: string;
  name: string;
  packageName: string;
  source: string;
  status: 'idle' | 'updating' | 'updated' | 'error';
}

interface AppUpdateRowProps {
  item: AppUpdateItem;
  onUpdate: (item: AppUpdateItem) => void;
  target: InstallTarget;
}

export function AppUpdateRow({ item, onUpdate, target }: AppUpdateRowProps) {
  const isUpdating = item.status === 'updating';
  const isUpdated = item.status === 'updated';
  const downloadProgress = useMarketplaceDownloadStore(
    (state) => state.activeDownloads[item.packageName],
  );
  const isDownloading = Boolean(downloadProgress && downloadProgress.percentage < 100);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-4 transition-colors hover:border-border hover:bg-surface-raised/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-raised font-bold text-body text-foreground">
            {item.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-body text-foreground">{item.name}</span>
              <ProviderBadge source={item.source} />
              {item.hasUpdate ? (
                <Badge className="text-[10px]" variant="default">
                  Update Available
                </Badge>
              ) : (
                <Badge className="text-[10px]" variant="outline">
                  Up to Date
                </Badge>
              )}
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{item.packageName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Version Transition Chip */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 py-1 text-caption text-muted-foreground">
            <span className="font-mono">{item.currentVersion}</span>
            {item.hasUpdate ? (
              <>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="font-medium font-mono text-foreground">{item.latestVersion}</span>
              </>
            ) : null}
          </div>

          <Button
            className="h-8 gap-1.5 px-3 text-caption"
            disabled={!item.hasUpdate || isUpdating || isUpdated || !target.canInstall}
            onClick={() => onUpdate(item)}
            size="sm"
            type="button"
            variant={isUpdated ? 'outline' : 'default'}
          >
            {isDownloading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                {Math.round(downloadProgress?.percentage ?? 0)}%
              </>
            ) : isUpdating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                Installing…
              </>
            ) : isUpdated ? (
              <>
                <CheckCircle2 className="size-3.5 text-success" data-icon="inline-start" />
                Installed
              </>
            ) : (
              <>
                <Download className="size-3.5" data-icon="inline-start" />
                Update
              </>
            )}
          </Button>
        </div>
      </div>

      {isDownloading ? <DownloadProgressStrip packageName={item.packageName} /> : null}

      {item.changelogSnippet ? (
        <div className="rounded-md border border-border/40 bg-surface/50 p-2.5 text-caption text-muted-foreground">
          <span className="font-semibold text-foreground">What&apos;s New: </span>
          {item.changelogSnippet}
        </div>
      ) : null}
    </div>
  );
}
