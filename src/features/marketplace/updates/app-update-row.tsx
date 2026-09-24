import { ArrowRight, CheckCircle2, Download, Loader2 } from "lucide-react";

import { useMarketplaceDownloadStore } from "@/features/marketplace/model/download-store";
import type { InstallTarget } from "@/features/marketplace/model/install-target";
import { DownloadProgressStrip } from "@/features/marketplace/ui/download-progress-strip";
import { ProviderBadge } from "@/features/marketplace/ui/provider-badge";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

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
  status: "idle" | "updating" | "updated" | "error";
}

interface AppUpdateRowProps {
  item: AppUpdateItem;
  onUpdate: (item: AppUpdateItem) => void;
  target: InstallTarget;
}

export const AppUpdateRow = ({ item, onUpdate, target }: AppUpdateRowProps) => {
  const isUpdating = item.status === "updating";
  const isUpdated = item.status === "updated";
  const downloadProgress = useMarketplaceDownloadStore(
    (state) => state.activeDownloads[item.packageName]
  );
  const isDownloading = Boolean(downloadProgress && downloadProgress.percentage < 100);
  const renderButtonContent = () => {
    if (isDownloading) {
      return (
        <>
          <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          {Math.round(downloadProgress?.percentage ?? 0)}%
        </>
      );
    }
    if (isUpdating) {
      return (
        <>
          <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          Installing…
        </>
      );
    }
    if (isUpdated) {
      return (
        <>
          <CheckCircle2 className="text-success size-3.5" data-icon="inline-start" />
          Installed
        </>
      );
    }
    return (
      <>
        <Download className="size-3.5" data-icon="inline-start" />
        Update
      </>
    );
  };
  return (
    <div className="border-border/80 bg-surface-raised/40 hover:border-border hover:bg-surface-raised/70 flex flex-col gap-3 rounded-lg border p-4 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="border-border bg-surface-raised text-body text-foreground flex size-10 items-center justify-center rounded-xl border font-bold">
            {item.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-body text-foreground font-semibold">{item.name}</span>
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
            <span className="text-muted-foreground font-mono text-[11px]">{item.packageName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Version Transition Chip */}
          <div className="border-border/60 bg-surface text-caption text-muted-foreground flex items-center gap-1.5 rounded-lg border px-2.5 py-1">
            <span className="font-mono">{item.currentVersion}</span>
            {item.hasUpdate ? (
              <>
                <ArrowRight className="text-muted-foreground size-3" />
                <span className="text-foreground font-mono font-medium">{item.latestVersion}</span>
              </>
            ) : null}
          </div>

          <Button
            className="text-caption h-8 gap-1.5 px-3"
            disabled={!item.hasUpdate || isUpdating || isUpdated || !target.canInstall}
            onClick={() => onUpdate(item)}
            size="sm"
            type="button"
            variant={isUpdated ? "outline" : "default"}
          >
            {renderButtonContent()}
          </Button>
        </div>
      </div>

      {isDownloading ? <DownloadProgressStrip packageName={item.packageName} /> : null}

      {item.changelogSnippet ? (
        <div className="border-border/40 bg-surface/50 text-caption text-muted-foreground rounded-md border p-2.5">
          <span className="text-foreground font-semibold">What&apos;s New: </span>
          {item.changelogSnippet}
        </div>
      ) : null}
    </div>
  );
};
