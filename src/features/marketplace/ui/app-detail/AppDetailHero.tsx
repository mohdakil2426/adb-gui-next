import { Check, Download, Loader2, Star } from 'lucide-react';
import {
  formatSpeed,
  useMarketplaceDownloadStore,
} from '@/features/marketplace/model/downloadStore';
import { MarketplaceAppIcon } from '@/features/marketplace/ui/AppIcon';
import { ProviderBadge } from '@/features/marketplace/ui/ProviderBadge';
import { Button } from '@/shared/ui/button';
import { formatBytes } from '@/shared/utils/format';

interface AppDetailHeroProps {
  /** Why install is unavailable — shown under the button, never left silent. */
  blockedReason: string | null;
  canInstall: boolean;
  displayName: string;
  downloadsLabel: string | null;
  iconUrl?: string | null;
  installSize?: number | null | undefined;
  installState: 'idle' | 'running' | 'done';
  onInstall: () => void;
  packageName: string;
  repoStars?: number | null | undefined;
  source: string;
}

export function AppDetailHero({
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
}: AppDetailHeroProps) {
  const downloadProgress = useMarketplaceDownloadStore(
    (state) => state.activeDownloads[packageName],
  );
  const sizeSuffix = installSize ? ` (${formatBytes(installSize)})` : '';
  return (
    <div className="flex @md:flex-row flex-col @md:items-start @md:justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MarketplaceAppIcon alt={displayName} iconUrl={iconUrl} size="lg" />

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-semibold text-display text-foreground">{displayName}</h2>
          <p className="truncate font-mono text-mono text-muted-foreground">{packageName}</p>
          <div className="numeric flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
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

      <div className="flex @md:max-w-72 shrink-0 flex-col @md:items-end items-stretch gap-1.5">
        <Button
          className="@md:w-auto w-full"
          disabled={!canInstall || installState === 'running'}
          onClick={onInstall}
          type="button"
        >
          {installState === 'done' ? (
            <Check aria-hidden="true" data-icon="inline-start" />
          ) : installState === 'running' ? (
            <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
          ) : (
            <Download aria-hidden="true" data-icon="inline-start" />
          )}
          {installState === 'done'
            ? 'Installed'
            : downloadProgress && downloadProgress.percentage < 100
              ? `${Math.round(downloadProgress.percentage)}% (${formatSpeed(downloadProgress.speedBps)})`
              : installState === 'running'
                ? 'Installing…'
                : `Install${sizeSuffix}`}
        </Button>
        {canInstall || !blockedReason ? null : (
          <p className="@md:text-right text-caption text-muted-foreground">{blockedReason}</p>
        )}
      </div>
    </div>
  );
}
