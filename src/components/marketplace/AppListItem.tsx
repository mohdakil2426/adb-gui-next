import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Check, Package, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProviderBadge } from './ProviderBadge';
import type { backend } from '@/lib/desktop/models';

type MarketplaceApp = backend.MarketplaceApp;

interface AppListItemProps {
  app: MarketplaceApp;
  onSelect: () => void;
}

export function AppListItem({ app, onSelect }: AppListItemProps) {
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
    <div
      className="flex items-center gap-3 px-2 py-2.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* App icon */}
      <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {app.iconUrl ? (
          <img
            src={app.iconUrl}
            alt=""
            className="size-9 rounded-lg object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* App info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{app.name}</span>
          <ProviderBadge source={app.source} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{app.summary}</p>
      </div>

      {/* Rating (if available) */}
      {app.rating != null && app.rating > 0 && (
        <span className="hidden md:flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {app.rating.toFixed(1)}
        </span>
      )}

      {/* Version */}
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{app.version}</span>

      {/* Install button */}
      <Button
        variant={installState === 'done' ? 'default' : 'outline'}
        size="sm"
        className={cn(
          'h-7 shrink-0',
          installState === 'done' && 'bg-emerald-600 text-white hover:bg-emerald-700',
        )}
        onClick={handleInstall}
        disabled={installState === 'downloading' || installState === 'installing'}
      >
        {installState === 'downloading' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        {installState === 'installing' && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        {installState === 'done' && <Check className="h-3.5 w-3.5 mr-1" />}
        {installState === 'idle' && !app.downloadUrl && (
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
        )}
        {installState === 'idle' && app.downloadUrl && <Download className="h-3.5 w-3.5 mr-1" />}
        {installState === 'downloading'
          ? 'Get...'
          : installState === 'installing'
            ? 'Install'
            : installState === 'done'
              ? 'Done'
              : app.downloadUrl
                ? 'Install'
                : 'View'}
      </Button>
    </div>
  );
}
