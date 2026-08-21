import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MarketplaceGetAppDetail } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import {
  getMarketplaceEffectiveGithubToken,
  useMarketplaceStore,
} from '@/features/marketplace/model/marketplaceStore';
import { AppDetailHero } from '@/features/marketplace/ui/app-detail/AppDetailHero';
import { AppDetailSidebar } from '@/features/marketplace/ui/app-detail/AppDetailSidebar';
import { AppDetailSkeleton } from '@/features/marketplace/ui/app-detail/AppDetailSkeleton';
import { AppDetailVersions } from '@/features/marketplace/ui/app-detail/AppDetailVersions';
import { AppScreenshots } from '@/features/marketplace/ui/app-detail/AppScreenshots';
import { ReadmeMarkdown } from '@/features/marketplace/ui/app-detail/ReadmeMarkdown';
import {
  formatDownloadCount,
  installMarketplacePackage,
} from '@/features/marketplace/utils/install';
import { Button } from '@/shared/ui/button';
import { handleError } from '@/shared/utils/errorHandler';

type AppDetail = backend.MarketplaceAppDetail;
type InstallState = 'idle' | 'running' | 'done';

const DONE_RESET_MS = 2000;

export function AppDetailView({ target }: { target: InstallTarget }) {
  const selectedApp = useMarketplaceStore((state) => state.selectedApp);
  const closeDetail = useMarketplaceStore((state) => state.closeDetail);
  const githubToken = useMarketplaceStore(getMarketplaceEffectiveGithubToken);

  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [primaryInstallState, setPrimaryInstallState] = useState<InstallState>('idle');
  const [activeVersionName, setActiveVersionName] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    if (!selectedApp) {
      setDetail(null);
      setDetailError(null);
      setPrimaryInstallState('idle');
      setActiveVersionName(null);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    setIsLoadingDetail(true);

    MarketplaceGetAppDetail(
      selectedApp.packageName,
      selectedApp.source,
      githubToken,
      selectedApp.repoUrl,
      selectedApp.downloadUrl,
    )
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail);
          setDetailError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setDetailError(message);
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
  }, [githubToken, selectedApp, retryTrigger]);

  const displayName = detail?.name ?? selectedApp?.name ?? 'App';
  const effectiveDownloadUrl = detail?.downloadUrl ?? selectedApp?.downloadUrl;
  const downloadsLabel = useMemo(
    () => formatDownloadCount(detail?.downloadsCount ?? selectedApp?.downloadsCount ?? null),
    [detail?.downloadsCount, selectedApp?.downloadsCount],
  );

  const handlePrimaryInstall = async () => {
    if (!effectiveDownloadUrl) {
      return;
    }
    try {
      setPrimaryInstallState('running');
      await installMarketplacePackage(displayName, effectiveDownloadUrl);
      setPrimaryInstallState('done');
      setTimeout(() => {
        setPrimaryInstallState('idle');
      }, DONE_RESET_MS);
    } catch {
      setPrimaryInstallState('idle');
    }
  };

  const handleVersionInstall = async (versionName: string, downloadUrl: string) => {
    try {
      setActiveVersionName(versionName);
      await installMarketplacePackage(`${displayName} ${versionName}`, downloadUrl);
    } finally {
      setActiveVersionName(null);
    }
  };

  if (!selectedApp) {
    return null;
  }

  const canInstall = Boolean(effectiveDownloadUrl) && target.canInstall;
  const blockedReason = effectiveDownloadUrl
    ? target.blockedReason
    : 'This source publishes no downloadable APK for this app. Open the repository to get one.';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button className="-ml-2" onClick={closeDetail} size="sm" type="button" variant="ghost">
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Back to results
        </Button>
      </div>

      <AppDetailHero
        blockedReason={blockedReason}
        canInstall={canInstall}
        displayName={displayName}
        downloadsLabel={downloadsLabel}
        iconUrl={selectedApp.iconUrl}
        installSize={detail?.size}
        installState={primaryInstallState}
        onInstall={() => {
          void handlePrimaryInstall();
        }}
        packageName={detail?.packageName ?? selectedApp.packageName}
        repoStars={detail?.repoStars}
        source={selectedApp.source}
      />

      {isLoadingDetail && !detail ? (
        <AppDetailSkeleton />
      ) : (
        <>
          {detailError ? (
            <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-body">
              <span className="text-destructive-foreground">{detailError}</span>
              <Button
                onClick={() => setRetryTrigger((n) => n + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {detail?.screenshots && detail.screenshots.length > 0 ? (
            <AppScreenshots appName={displayName} urls={detail.screenshots} />
          ) : null}
          <div className="grid @2xl:grid-cols-[1fr_280px] gap-6">
            <div className="flex min-w-0 flex-col gap-5">
              <section className="flex flex-col gap-2">
                <h2 className="text-caption text-muted-foreground uppercase tracking-wide">
                  About this app
                </h2>
                <p className="whitespace-pre-wrap text-body text-muted-foreground">
                  {detail?.description ??
                    selectedApp.summary ??
                    'No description is available for this app yet.'}
                </p>
              </section>

              {detail?.readmeMarkdown ? (
                <section className="flex flex-col gap-2">
                  <h2 className="text-caption text-muted-foreground uppercase tracking-wide">
                    README
                  </h2>
                  <div className="rounded-lg border border-border bg-surface-raised p-3">
                    <ReadmeMarkdown markdown={detail.readmeMarkdown} />
                  </div>
                </section>
              ) : null}

              {detail?.changelog ? (
                <section className="flex flex-col gap-2">
                  <h2 className="text-caption text-muted-foreground uppercase tracking-wide">
                    What's new
                  </h2>
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-surface-raised p-3 text-body text-muted-foreground">
                    {detail.changelog}
                  </p>
                </section>
              ) : null}
            </div>

            <div className="flex flex-col gap-5">
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
                  canInstall={target.canInstall}
                  isPrimaryInstalling={primaryInstallState === 'running'}
                  onInstallVersion={(versionName, downloadUrl) => {
                    void handleVersionInstall(versionName, downloadUrl);
                  }}
                  versions={detail.versions}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
