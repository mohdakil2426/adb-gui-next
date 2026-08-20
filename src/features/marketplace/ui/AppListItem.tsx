import { CheckCircle2, Package, Star } from 'lucide-react';
import { memo } from 'react';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { AppInstallButton } from '@/features/marketplace/ui/AppInstallButton';
import { formatDownloadCount } from '@/features/marketplace/utils/install';
import { Badge } from '@/shared/ui/badge';
import { formatRating } from '@/shared/utils/format';
import { ProviderBadge } from './ProviderBadge';

type MarketplaceApp = backend.MarketplaceApp;

interface AppListItemProps {
  app: MarketplaceApp;
  /** Receives the app so the parent can pass one stable callback for every row. */
  onSelect: (app: MarketplaceApp) => void;
  /** Install availability — a blocked target disables install with the reason. */
  target: InstallTarget;
}

export const AppListItem = memo(function AppListItem({ app, onSelect, target }: AppListItemProps) {
  const downloadsLabel = formatDownloadCount(app.downloadsCount);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-90 ease-standard hover:bg-accent">
      <button
        aria-label={`View details for ${app.name}`}
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left"
        onClick={() => {
          onSelect(app);
        }}
        type="button"
      >
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
          {app.iconUrl ? (
            <img
              alt=""
              className="size-10 object-cover"
              height={40}
              loading="lazy"
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
              src={app.iconUrl}
              width={40}
            />
          ) : (
            <Package aria-hidden="true" className="size-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate font-medium text-body text-foreground">
              {app.name}
            </span>
            <ProviderBadge source={app.source} />
            {app.downloadUrl && (
              <Badge
                className="gap-0.5 border-success/30 bg-success/5 px-1 py-0 font-mono text-[10px] text-success"
                variant="outline"
              >
                <CheckCircle2 className="size-2.5" />
                APK
              </Badge>
            )}
          </div>
          <p className="truncate text-body text-muted-foreground">
            {app.summary || 'No description available yet.'}
          </p>
          <div className="numeric flex flex-wrap items-center gap-x-3 text-caption text-muted-foreground">
            <span className="truncate font-mono">{app.packageName}</span>
            <span>{app.version || 'Version unknown'}</span>
            {app.rating != null && app.rating > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star aria-hidden="true" className="size-3 fill-current" />
                {formatRating(app.rating)}
              </span>
            ) : null}
            {downloadsLabel ? <span>{downloadsLabel} downloads</span> : null}
            {(app.availableSources ?? []).length > 1 ? (
              <span>
                +{(app.availableSources ?? []).length - 1} source
                {(app.availableSources ?? []).length > 2 ? 's' : ''}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <AppInstallButton app={app} onSelect={onSelect} target={target} />
    </div>
  );
});
