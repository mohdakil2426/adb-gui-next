import { useState } from 'react';
import { Check, Download, ExternalLink, Loader2, Package, Star } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDisplayDate, formatRating } from '@/lib/utils';
import { ProviderBadge } from './ProviderBadge';
import { formatDownloadCount, installMarketplacePackage } from '@/lib/marketplace/install';
import type { backend } from '@/lib/desktop/models';

type MarketplaceApp = backend.MarketplaceApp;

interface AppCardProps {
  app: MarketplaceApp;
  onSelect: () => void;
}

export function AppCard({ app, onSelect }: AppCardProps) {
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

  const downloadLabel = formatDownloadCount(app.downloadsCount);

  return (
    <Card className="group border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/10 hover:shadow-md">
      <button
        type="button"
        aria-label={`View details for ${app.name}`}
        className="w-full cursor-pointer text-left"
        onClick={onSelect}
      >
        <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
            {app.iconUrl ? (
              <img
                src={app.iconUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
                loading="lazy"
              />
            ) : (
              <Package className="size-5 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold leading-none">{app.name}</h3>
              <ProviderBadge source={app.source} />
              {app.availableSources.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  +{app.availableSources.length - 1} more source
                  {app.availableSources.length > 2 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {app.version || 'Version info unavailable'}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {app.summary || 'No description available yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {app.rating != null && app.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-current text-foreground" />
                {formatRating(app.rating)}
              </span>
            )}
            {downloadLabel && <span>{downloadLabel}</span>}
            {app.language && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {app.language}
              </span>
            )}
            {app.updatedAt && <span>{formatDisplayDate(app.updatedAt)}</span>}
            {!app.installable && app.repoUrl && (
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="size-3.5" />
                Repo only
              </span>
            )}
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
          variant={installState === 'done' ? 'default' : 'outline'}
          size="sm"
          className={cn('h-8 shrink-0 gap-1.5', installState === 'done' && 'pointer-events-none')}
          onClick={handleInstall}
          disabled={installState === 'running'}
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
            <Loader2 data-icon="inline-start" className="animate-spin" />
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
}
