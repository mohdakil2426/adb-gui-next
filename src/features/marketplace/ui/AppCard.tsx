import { ExternalLink, Package, Star } from 'lucide-react';
import { memo } from 'react';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { AppInstallButton } from '@/features/marketplace/ui/AppInstallButton';
import { formatDownloadCount } from '@/features/marketplace/utils/install';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card';
import { formatDisplayDate, formatRating } from '@/shared/utils/format';
import { ProviderBadge } from './ProviderBadge';

type MarketplaceApp = backend.MarketplaceApp;

interface AppCardProps {
  app: MarketplaceApp;
  /** Receives the app so the parent can pass one stable callback for every card. */
  onSelect: (app: MarketplaceApp) => void;
  /** Install availability — a blocked target disables install with the reason. */
  target: InstallTarget;
}

export const AppCard = memo(function AppCard({ app, onSelect, target }: AppCardProps) {
  const downloadLabel = formatDownloadCount(app.downloadsCount);

  return (
    <Card className="gap-0 rounded-lg border-border bg-surface py-0 shadow-none transition-colors duration-90 ease-standard hover:border-border-strong">
      <button
        aria-label={`View details for ${app.name}`}
        className="w-full cursor-pointer text-left"
        onClick={() => {
          onSelect(app);
        }}
        type="button"
      >
        <CardHeader className="flex flex-row items-start gap-3 px-3 pt-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
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

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h3 className="min-w-0 truncate text-foreground text-title">{app.name}</h3>
              <ProviderBadge source={app.source} />
            </div>
            <p className="truncate font-mono text-mono-sm text-muted-foreground">
              {app.packageName}
            </p>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 px-3 pt-2">
          <p className="line-clamp-2 text-body text-muted-foreground">
            {app.summary || 'No description available yet.'}
          </p>

          <div className="numeric flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            <span>{app.version || 'Version unknown'}</span>
            {app.rating != null && app.rating > 0 ? (
              <span className="flex items-center gap-1">
                <Star aria-hidden="true" className="size-3 fill-current" />
                {formatRating(app.rating)}
              </span>
            ) : null}
            {downloadLabel ? <span>{downloadLabel} downloads</span> : null}
            {app.updatedAt ? <span>{formatDisplayDate(app.updatedAt)}</span> : null}
            {app.availableSources.length > 1 ? (
              <span>
                +{app.availableSources.length - 1} more source
                {app.availableSources.length > 2 ? 's' : ''}
              </span>
            ) : null}
            {!app.installable && app.repoUrl ? (
              <span className="inline-flex items-center gap-1">
                <ExternalLink aria-hidden="true" className="size-3" />
                Repo only
              </span>
            ) : null}
          </div>
        </CardContent>
      </button>

      <CardFooter className="justify-end px-3 py-3">
        <AppInstallButton app={app} onSelect={onSelect} target={target} />
      </CardFooter>
    </Card>
  );
});
