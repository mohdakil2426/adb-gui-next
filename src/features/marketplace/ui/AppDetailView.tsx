import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Loader2,
  Package,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ProviderBadge } from '@/components/marketplace/ProviderBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceGetAppDetail } from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { BrowserOpenURL } from '@/lib/desktop/runtime';
import { handleError } from '@/lib/errorHandler';
import { formatDownloadCount, installMarketplacePackage } from '@/lib/marketplace/install';
import { getMarketplaceEffectiveGithubToken, useMarketplaceStore } from '@/lib/marketplaceStore';
import { formatDisplayDate, formatFileSize } from '@/lib/utils';

type AppDetail = backend.MarketplaceAppDetail;

function MetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="mt-0.5 font-medium text-sm">{value}</span>
    </div>
  );
}

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
      {/* Back Header */}
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

      {/* Hero Section */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/40 shadow-sm sm:size-24">
            {selectedApp.iconUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                height={96}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                src={selectedApp.iconUrl}
                width={96}
              />
            ) : (
              <Package aria-hidden="true" className="size-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <h1 className="truncate font-bold text-2xl tracking-tight sm:text-3xl">
              {displayName}
            </h1>
            <p className="truncate text-muted-foreground text-sm">
              {detail?.packageName ?? selectedApp.packageName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ProviderBadge source={selectedApp.source} />
              <div className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
                {detail?.repoStars ? <span>★ {detail.repoStars.toLocaleString()}</span> : null}
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
            disabled={!effectiveDownloadUrl || primaryInstallState === 'running'}
            onClick={handlePrimaryInstall}
            size="lg"
          >
            {primaryInstallState === 'done' ? (
              <Check aria-hidden="true" data-icon="inline-start" />
            ) : primaryInstallState === 'running' ? (
              <Loader2 aria-hidden="true" className="animate-spin" data-icon="inline-start" />
            ) : (
              <Download aria-hidden="true" data-icon="inline-start" />
            )}
            {primaryInstallState === 'done'
              ? 'Installed'
              : primaryInstallState === 'running'
                ? 'Installing…'
                : effectiveDownloadUrl
                  ? `Install ${detail?.size ? `(${formatFileSize(detail.size)})` : ''}`
                  : 'No APK available'}
          </Button>
        </div>
      </div>

      {isLoadingDetail ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : null}

      {/* Screenshots Carousel */}
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

      {/* Two Column Layout for Specs/Description */}
      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        {/* Main Content Column */}
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

        {/* Sidebar Info Column */}
        <div className="gap-8">
          <section className="gap-4">
            <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              App Information
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <MetadataItem label="Version" value={detail?.version ?? selectedApp.version} />
              <MetadataItem
                label="Updated"
                value={detail?.updatedAt ? formatDisplayDate(detail.updatedAt) : null}
              />
              <MetadataItem label="License" value={detail?.license} />
              <MetadataItem label="Author" value={detail?.author} />
            </div>
            {(detail?.repoUrl ?? selectedApp.repoUrl) ? (
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    const url = detail?.repoUrl ?? selectedApp.repoUrl;
                    if (url) {
                      BrowserOpenURL(url);
                    }
                  }}
                  variant="outline"
                >
                  {selectedApp.source === 'GitHub' ? (
                    <GitBranch aria-hidden="true" data-icon="inline-start" />
                  ) : (
                    <ExternalLink aria-hidden="true" data-icon="inline-start" />
                  )}
                  Open Repository
                </Button>
              </div>
            ) : null}
            <Button
              className="mt-2 w-full text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    detail?.packageName ?? selectedApp.packageName,
                  );
                  toast.success('Package name copied');
                } catch {
                  toast.error('Unable to copy package name');
                }
              }}
              variant="ghost"
            >
              <Copy aria-hidden="true" data-icon="inline-start" /> Copy Package ID
            </Button>
          </section>

          {detail?.versions && detail.versions.length > 0 ? (
            <section className="gap-4">
              <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                Recent Versions
              </h3>
              <div className="gap-3">
                {detail.versions.slice(0, 5).map((version) => {
                  const isInstallingVersion = activeVersionName === version.versionName;
                  return (
                    <div
                      className="flex flex-col gap-2 rounded-xl border bg-muted/10 p-3"
                      key={version.versionName}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium text-sm">{version.versionName}</span>
                        {version.publishedAt ? (
                          <span className="text-muted-foreground text-xs">
                            {formatDisplayDate(version.publishedAt)}
                          </span>
                        ) : null}
                      </div>
                      {version.downloadUrl ? (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            {version.size == null ? 'APK' : formatFileSize(version.size)}
                          </span>
                          <Button
                            className="h-7 px-3 text-xs"
                            disabled={isInstallingVersion || primaryInstallState === 'running'}
                            onClick={() => {
                              const url = version.downloadUrl;
                              if (url) {
                                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                                handleVersionInstall(version.versionName, url);
                              }
                            }}
                            size="sm"
                            variant="secondary"
                          >
                            {isInstallingVersion ? (
                              <Loader2
                                aria-hidden="true"
                                className="animate-spin"
                                data-icon="inline-start"
                              />
                            ) : (
                              <Download aria-hidden="true" data-icon="inline-start" />
                            )}
                            Install
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
