import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Check, Package, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProviderBadge } from './ProviderBadge';
import type { backend } from '@/lib/desktop/models';

type MarketplaceApp = backend.MarketplaceApp;

interface AppCardProps {
  app: MarketplaceApp;
  onSelect: () => void;
}

export function AppCard({ app, onSelect }: AppCardProps) {
  const [installState, setInstallState] = useState<'idle' | 'downloading' | 'installing' | 'done'>(
    'idle',
  );

  const handleInstall = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!app.downloadUrl) {
      onSelect();
      return;
    }

    setInstallState('downloading');
    const toastId = toast.loading(`Downloading ${app.name}...`);

    try {
      const { MarketplaceDownloadApk, MarketplaceInstallApk } =
        await import('@/lib/desktop/backend');

      const localPath = await MarketplaceDownloadApk(app.downloadUrl);

      setInstallState('installing');
      toast.loading(`Installing ${app.name}...`, { id: toastId });

      await MarketplaceInstallApk(localPath);

      setInstallState('done');
      toast.success(`${app.name} installed!`, { id: toastId });
      setTimeout(() => setInstallState('idle'), 3000);
    } catch (error) {
      setInstallState('idle');
      toast.error(`Failed to install ${app.name}`, {
        id: toastId,
        description: String(error),
      });
    }
  };

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Icon + Source badge row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {app.iconUrl ? (
              <img
                src={app.iconUrl}
                alt=""
                className="size-10 rounded-lg object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
                }}
              />
            ) : (
              <Package className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-semibold truncate">{app.name}</span>
              <ProviderBadge source={app.source} />
            </div>
            <span className="text-xs text-muted-foreground">{app.version}</span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
          {app.summary || 'No description available'}
        </p>

        {/* Footer: rating/downloads + install button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {app.rating != null && app.rating > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {app.rating.toFixed(1)}
              </span>
            )}
            {app.downloadsCount != null && app.downloadsCount > 0 && (
              <span>{formatDownloads(app.downloadsCount)}</span>
            )}
          </div>

          <Button
            variant={installState === 'done' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-7 text-xs shrink-0',
              installState === 'done' && 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
            onClick={handleInstall}
            disabled={installState === 'downloading' || installState === 'installing'}
          >
            {installState === 'downloading' && (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            )}
            {installState === 'installing' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            {installState === 'done' && <Check className="h-3.5 w-3.5 mr-1" />}
            {installState === 'idle' && <Download className="h-3.5 w-3.5 mr-1" />}
            {installState === 'downloading'
              ? 'Get...'
              : installState === 'installing'
                ? 'Installing'
                : installState === 'done'
                  ? 'Done'
                  : app.downloadUrl
                    ? 'Install'
                    : 'View'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
