import { Check, Download, Loader2, Star } from "lucide-react";

import {
  formatSpeed,
  useMarketplaceDownloadStore,
} from "@/features/marketplace/model/download-store";
import { MarketplaceAppIcon } from "@/features/marketplace/ui/app-icon";
import { DownloadProgressStrip } from "@/features/marketplace/ui/download-progress-strip";
import { ProviderBadge } from "@/features/marketplace/ui/provider-badge";
import { Button } from "@/shared/ui/button";
import { formatBytes } from "@/shared/utils/format";

interface AppDetailHeroProps {
  /** Why install is unavailable — shown under the button, never left silent. */
  blockedReason: string | null;
  canInstall: boolean;
  displayName: string;
  downloadsLabel: string | null;
  iconUrl?: string | null;
  installSize?: number | null | undefined;
  installState: "idle" | "running" | "done";
  onInstall: () => void;
  packageName: string;
  repoStars?: number | null | undefined;
  source: string;
}

export const AppDetailHero = ({
  blockedReason,
  canInstall,
  displayName,
  downloadsLabel,
  iconUrl,
  installSize,
  installState,
  onInstall,
  packageName,
  repoStars,
  source,
}: AppDetailHeroProps) => {
  const downloadProgress = useMarketplaceDownloadStore(
    (state) => state.activeDownloads[packageName]
  );
  const sizeSuffix = installSize ? ` (${formatBytes(installSize)})` : "";
  const renderHeroButtonIcon = () => {
    if (installState === "done") {
      return <Check aria-hidden="true" data-icon="inline-start" />;
    }
    if (installState === "running") {
      return <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />;
    }
    return <Download aria-hidden="true" data-icon="inline-start" />;
  };

  const getHeroButtonLabel = () => {
    if (installState === "done") {
      return "Installed";
    }
    if (downloadProgress && downloadProgress.percentage < 100) {
      return `${Math.round(downloadProgress.percentage)}% (${formatSpeed(downloadProgress.speedBps)})`;
    }
    if (installState === "running") {
      return "Installing…";
    }
    return `Install${sizeSuffix}`;
  };

  return (
    <div className="flex flex-col gap-4 @md:flex-row @md:items-start @md:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MarketplaceAppIcon alt={displayName} iconUrl={iconUrl} size="lg" />

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-display text-foreground truncate font-semibold">{displayName}</h2>
          <p className="text-mono text-muted-foreground truncate font-mono">{packageName}</p>
          <div className="numeric text-caption text-muted-foreground flex flex-wrap items-center gap-2">
            <ProviderBadge source={source} />
            {repoStars ? (
              <span className="inline-flex items-center gap-1">
                <Star aria-hidden="true" className="size-3 fill-current" />
                {repoStars.toLocaleString()}
              </span>
            ) : null}
            {downloadsLabel ? <span>{downloadsLabel} downloads</span> : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch gap-1.5 @md:max-w-72 @md:items-end">
        <Button
          className="w-full @md:w-auto"
          disabled={!canInstall || installState === "running"}
          onClick={onInstall}
          type="button"
        >
          {renderHeroButtonIcon()}
          {getHeroButtonLabel()}
        </Button>
        <DownloadProgressStrip packageName={packageName} />
        {canInstall || !blockedReason ? null : (
          <p className="text-caption text-muted-foreground @md:text-right">{blockedReason}</p>
        )}
      </div>
    </div>
  );
};
