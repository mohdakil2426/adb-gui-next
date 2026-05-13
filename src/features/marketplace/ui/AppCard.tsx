import { Check, Download, ExternalLink, Loader2, Package, Star } from 'lucide-react';
import { memo, useState } from 'react';
import type { backend } from '@/desktop/models';
import {
  formatDownloadCount,
  installMarketplacePackage,
} from '@/features/marketplace/utils/install';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';
import { formatDisplayDate, formatRating } from '@/shared/utils/formatting';
import { ProviderBadge } from './ProviderBadge';

type MarketplaceApp = backend.MarketplaceApp;

interface AppCardProps {
  app: MarketplaceApp;
  onSelect: () => void;
}

export const AppCard = memo(function AppCard({ app, onSelect }: AppCardProps) {
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

  const downloadLabel = formatDownloadCount(app.downloadsCount);

  return (
    <Card className="group border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/10 hover:shadow-md">
      <button
        aria-label={`View details for ${app.name}`}
        className="w-full cursor-pointer text-left"
        onClick={onSelect}
        type="button"
      >
        <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {app.iconUrl ? (
              <img
                alt=""
                className="size-12 object-cover"
                height={48}
                loading="lazy"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
                src={app.iconUrl}
                width={48}
              />
            ) : (
              <Package className="size-5 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1 gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate font-semibold text-sm leading-none">{app.name}</h3>
              <ProviderBadge source={app.source} />
              {app.availableSources.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  +{app.availableSources.length - 1} more source
                  {app.availableSources.length > 2 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {app.version || 'Version info unavailable'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="gap-4 p-4 pt-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                {app.summary || 'No description available yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
            {app.rating != null && app.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-current text-foreground" />
                {formatRating(app.rating)}
              </span>
            )}
            {downloadLabel ? <span>{downloadLabel}</span> : null}
            {app.language ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px]">
                {app.language}
              </span>
            ) : null}
            {app.updatedAt ? <span>{formatDisplayDate(app.updatedAt)}</span> : null}
            {!app.installable && app.repoUrl ? (
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="size-3.5" />
                Repo only
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {app.installable
                ? 'Ready to install over ADB'
                : 'Open details to inspect this source'}
            </p>
          </div>
        </CardContent>
      </button>
      <CardFooter className="justify-end p-4 pt-0">
        <Button
          aria-label={app.downloadUrl ? `Install ${app.name}` : `View details for ${app.name}`}
          className={cn('h-8 shrink-0 gap-1.5', installState === 'done' && 'pointer-events-none')}
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
                : 'View details'}
        </Button>
      </CardFooter>
    </Card>
  );
});
