import { Check, Download, ExternalLink, Loader2, Package, Star } from 'lucide-react';
import { memo, useState } from 'react';
import type { backend } from '@/desktop/models';
import {
  formatDownloadCount,
  installMarketplacePackage,
} from '@/features/marketplace/utils/install';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatRating } from '@/shared/utils/formatting';
import { ProviderBadge } from './ProviderBadge';

type MarketplaceApp = backend.MarketplaceApp;

interface AppListItemProps {
  app: MarketplaceApp;
  onSelect: () => void;
}

export const AppListItem = memo(function AppListItem({ app, onSelect }: AppListItemProps) {
  const [installState, setInstallState] = useState<'idle' | 'running' | 'done'>('idle');

  const handleInstall = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!app.downloadUrl) {
      onSelect();
      return;
    }

    try {
      setInstallState('running');
      await installMarketplacePackage(app.name, app.downloadUrl);
      setInstallState('done');
      setTimeout(() => {
        setInstallState('idle');
      }, 2000);
    } catch {
      setInstallState('idle');
    }
  };

  const downloadsLabel = formatDownloadCount(app.downloadsCount);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/50">
      <button
        aria-label={`View details for ${app.name}`}
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
          {app.iconUrl ? (
            <img
              alt=""
              className="size-10 object-cover"
              height={40}
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
              src={app.iconUrl}
              width={40}
            />
          ) : (
            <Package className="size-4 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-sm">{app.name}</span>
            <ProviderBadge source={app.source} />
            {app.availableSources.length > 1 && (
              <span className="text-[10px] text-muted-foreground">
                +{app.availableSources.length - 1} source
                {app.availableSources.length > 2 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {app.summary || 'No description available yet.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>{app.version || 'Unknown version'}</span>
            {app.rating != null && app.rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-current" />
                {formatRating(app.rating)}
              </span>
            )}
            {downloadsLabel ? <span>{downloadsLabel}</span> : null}
            {app.language ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px]">
                {app.language}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <Button
        aria-label={app.downloadUrl ? `Install ${app.name}` : `View details for ${app.name}`}
        className={cn('h-8 gap-1.5', installState === 'done' && 'pointer-events-none')}
        disabled={installState === 'running'}
        onClick={handleInstall}
        size="sm"
        variant={installState === 'done' ? 'default' : 'outline'}
      >
        {installState === 'done' ? (
          <Check data-icon="inline-start" />
        ) : installState === 'idle' ? (
          app.downloadUrl ? (
            <Download data-icon="inline-start" />
          ) : (
            <ExternalLink data-icon="inline-start" />
          )
        ) : (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        )}
        {installState === 'running'
          ? 'Installing'
          : installState === 'done'
            ? 'Installed'
            : app.downloadUrl
              ? 'Install'
              : 'Details'}
      </Button>
    </div>
  );
});
