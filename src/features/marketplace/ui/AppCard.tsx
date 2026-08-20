import { CheckCircle2, ExternalLink, Star } from 'lucide-react';
import { memo } from 'react';
import type { backend } from '@/desktop/models';
import { formatBytes } from '@/features/marketplace/model/downloadStore';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { MarketplaceAppIcon } from '@/features/marketplace/ui/AppIcon';
import { AppInstallButton } from '@/features/marketplace/ui/AppInstallButton';
import { formatDownloadCount } from '@/features/marketplace/utils/install';
import { Badge } from '@/shared/ui/badge';
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
          <MarketplaceAppIcon alt={app.name} iconUrl={app.iconUrl} size="sm" />

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
            {app.size ? <span>{formatBytes(app.size)}</span> : null}
            {app.rating != null && app.rating > 0 ? (
              <span className="flex items-center gap-1">
                <Star aria-hidden="true" className="size-3 fill-current" />
                {formatRating(app.rating)}
              </span>
            ) : null}
            {downloadLabel ? <span>{downloadLabel} downloads</span> : null}
            {app.updatedAt ? <span>{formatDisplayDate(app.updatedAt)}</span> : null}
            {(app.availableSources ?? []).length > 1 ? (
              <span>
                +{(app.availableSources ?? []).length - 1} more source
                {(app.availableSources ?? []).length > 2 ? 's' : ''}
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
      <CardFooter className="flex items-center justify-between border-border/40 border-t bg-surface-raised/20 px-3 py-2.5">
        <div className="flex items-center gap-1">
          {app.downloadUrl ? (
            <Badge
              className="gap-0.5 border-success/30 bg-success/5 px-1.5 py-0 font-mono text-[10px] text-success"
              variant="outline"
            >
              <CheckCircle2 className="size-2.5" />
              Compatible APK
            </Badge>
          ) : (
            <Badge
              className="px-1.5 py-0 font-mono text-[10px] text-muted-foreground"
              variant="outline"
            >
              Universal
            </Badge>
          )}
        </div>
        <AppInstallButton app={app} onSelect={onSelect} target={target} />
      </CardFooter>
    </Card>
  );
});
