import { useState } from 'react';
import { Check, Download, ExternalLink, Loader2, Package, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProviderBadge } from './ProviderBadge';
import { formatDownloadCount, installMarketplacePackage } from '@/lib/marketplace/install';
import type { backend } from '@/lib/desktop/models';

type MarketplaceApp = backend.MarketplaceApp;

interface AppListItemProps {
  app: MarketplaceApp;
  onSelect: () => void;
}

export function AppListItem({ app, onSelect }: AppListItemProps) {
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
      setTimeout(() => setInstallState('idle'), 2000);
    } catch {
      setInstallState('idle');
    }
  };

  const downloadsLabel = formatDownloadCount(app.downloadsCount);

  return (
    <div
      className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/50"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
        {app.iconUrl ? (
          <img
            src={app.iconUrl}
            alt=""
            className="size-10 object-cover"
            onError={(event) => {
              (event.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Package className="size-4 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{app.name}</span>
          <ProviderBadge source={app.source} />
          {app.availableSources.length > 1 && (
            <span className="text-[10px] text-muted-foreground">
              +{app.availableSources.length - 1} source{app.availableSources.length > 2 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {app.summary || 'No description available yet.'}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>{app.version || 'Unknown version'}</span>
          {app.rating != null && app.rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-current" />
              {app.rating.toFixed(1)}
            </span>
          )}
          {downloadsLabel && <span>{downloadsLabel}</span>}
        </div>
      </div>

      <Button
        variant={installState === 'done' ? 'default' : 'outline'}
        size="sm"
        className={cn('h-8 gap-1.5', installState === 'done' && 'pointer-events-none')}
        onClick={handleInstall}
        disabled={installState === 'running'}
      >
        {installState === 'done' ? (
          <Check className="size-3.5" />
        ) : installState === 'idle' ? (
          app.downloadUrl ? (
            <Download className="size-3.5" />
          ) : (
            <ExternalLink className="size-3.5" />
          )
        ) : (
          <Loader2 className="size-3.5 animate-spin" />
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
}
