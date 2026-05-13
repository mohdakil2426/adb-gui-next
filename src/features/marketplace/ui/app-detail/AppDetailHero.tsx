import { Check, Download, Loader2, Package } from 'lucide-react';
import { ProviderBadge } from '@/features/marketplace/ui/ProviderBadge';
import { Button } from '@/shared/ui/button';
import { formatFileSize } from '@/shared/utils/formatting';

interface AppDetailHeroProps {
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
  displayName,
  packageName,
  iconUrl,
  source,
  repoStars,
  downloadsLabel,
  installState,
  canInstall,
  installSize,
  onInstall,
}: AppDetailHeroProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/40 shadow-sm sm:size-24">
          {iconUrl ? (
            <img
              alt=""
              className="size-full object-cover"
              height={96}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              src={iconUrl}
              width={96}
            />
          ) : (
            <Package aria-hidden="true" className="size-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 pt-1">
          <h1 className="truncate font-bold text-2xl tracking-tight sm:text-3xl">{displayName}</h1>
          <p className="truncate text-muted-foreground text-sm">{packageName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ProviderBadge source={source} />
            <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
              {repoStars ? <span>★ {repoStars.toLocaleString()}</span> : null}
              {downloadsLabel ? (
                <>
                  <span>•</span>
                  <span>{downloadsLabel} Downloads</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 sm:pt-2">
        <Button
          className="w-full px-8 font-semibold shadow-sm sm:w-auto"
          disabled={!canInstall || installState === 'running'}
          onClick={onInstall}
          size="lg"
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
            : installState === 'running'
              ? 'Installing…'
              : canInstall
                ? `Install ${installSize ? `(${formatFileSize(installSize)})` : ''}`
                : 'No APK available'}
        </Button>
      </div>
    </div>
  );
}
