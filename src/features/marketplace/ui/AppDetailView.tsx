import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MarketplaceGetAppDetail } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import { AppDetailHero } from '@/features/marketplace/ui/app-detail/AppDetailHero';
import { AppDetailSidebar } from '@/features/marketplace/ui/app-detail/AppDetailSidebar';
import { AppDetailVersions } from '@/features/marketplace/ui/app-detail/AppDetailVersions';
import {
  formatDownloadCount,
  installMarketplacePackage,
} from '@/features/marketplace/utils/install';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { handleError } from '@/shared/utils/errorHandler';

type AppDetail = backend.MarketplaceAppDetail;

export function AppDetailView() {
  const selectedApp = useMarketplaceStore((state) => state.selectedApp);
  const closeDetail = useMarketplaceStore((state) => state.closeDetail);
  const githubToken = useMarketplaceStore(getMarketplaceEffectiveGithubToken);

  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [primaryInstallState, setPrimaryInstallState] = useState<'idle' | 'running' | 'done'>(
    'idle',
  );
  const [activeVersionName, setActiveVersionName] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedApp) {
      setDetail(null);
      setPrimaryInstallState('idle');
      setActiveVersionName(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);

    MarketplaceGetAppDetail(selectedApp.packageName, selectedApp.source, githubToken)
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          handleError('Marketplace Detail', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [githubToken, selectedApp]);

  const displayName = detail?.name ?? selectedApp?.name ?? 'App';
  const effectiveDownloadUrl = detail?.downloadUrl ?? selectedApp?.downloadUrl;
  const downloadsLabel = useMemo(
    () => formatDownloadCount(detail?.downloadsCount ?? selectedApp?.downloadsCount ?? null),
    [detail?.downloadsCount, selectedApp?.downloadsCount],
  );

  const handlePrimaryInstall = async () => {
    if (!effectiveDownloadUrl) {
      toast.error('No downloadable APK is available for this app');
      return;
    }
    try {
      setPrimaryInstallState('running');
      await installMarketplacePackage(displayName, effectiveDownloadUrl);
      setPrimaryInstallState('done');
      setTimeout(() => {
        setPrimaryInstallState('idle');
      }, 2000);
    } catch {
      setPrimaryInstallState('idle');
    }
  };

  const handleVersionInstall = async (versionName: string, downloadUrl: string) => {
    try {
      setActiveVersionName(versionName);
      await installMarketplacePackage(`${displayName} ${versionName}`, downloadUrl);
      setActiveVersionName(null);
    } catch {
      setActiveVersionName(null);
    }
  };

  if (!selectedApp) {
    return null;
  }

  return (
    <div className="fade-in mt-2 flex animate-in flex-col gap-8 pb-12 duration-300">
      <div>
        <Button
          className="-ml-3 text-muted-foreground hover:text-foreground"
          onClick={closeDetail}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
          Back to results
        </Button>
      </div>

      <AppDetailHero
        canInstall={Boolean(effectiveDownloadUrl)}
        displayName={displayName}
        downloadsLabel={downloadsLabel}
        iconUrl={selectedApp.iconUrl}
        installSize={detail?.size}
        installState={primaryInstallState}
        onInstall={handlePrimaryInstall}
        packageName={detail?.packageName ?? selectedApp.packageName}
        repoStars={detail?.repoStars}
        source={selectedApp.source}
      />

      {isLoadingDetail ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : null}

      {detail?.screenshots && detail.screenshots.length > 0 ? (
        <section className="gap-4">
          <div className="custom-scroll flex snap-x gap-4 overflow-x-auto pb-4">
            {detail.screenshots.map((url, i) => (
              <img
                alt=""
                className="h-64 shrink-0 snap-start rounded-xl border bg-muted/20 object-contain shadow-sm sm:h-80"
                height={320}
                key={`${url}-${i}`}
                loading="lazy"
                src={url}
                width={320}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 gap-10">
          <section className="gap-4">
            <h2 className="font-semibold text-xl tracking-tight">About this app</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {detail?.description ??
                selectedApp.summary ??
                'No description is available for this app yet.'}
            </div>
          </section>

          {detail?.changelog ? (
            <section className="gap-4">
              <h2 className="font-semibold text-xl tracking-tight">What's New</h2>
              <div className="whitespace-pre-wrap rounded-xl border bg-muted/10 p-5 text-muted-foreground text-sm leading-relaxed">
                {detail.changelog}
              </div>
            </section>
          ) : null}
        </div>

        <div className="gap-8">
          <AppDetailSidebar
            author={detail?.author}
            license={detail?.license}
            packageName={detail?.packageName ?? selectedApp.packageName}
            repoUrl={detail?.repoUrl ?? selectedApp.repoUrl}
            source={selectedApp.source}
            updatedAt={detail?.updatedAt}
            version={detail?.version ?? selectedApp.version}
          />
          {detail?.versions && detail.versions.length > 0 ? (
            <AppDetailVersions
              activeVersionName={activeVersionName}
              isPrimaryInstalling={primaryInstallState === 'running'}
              onInstallVersion={(versionName, downloadUrl) => {
                void handleVersionInstall(versionName, downloadUrl);
              }}
              versions={detail.versions}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
