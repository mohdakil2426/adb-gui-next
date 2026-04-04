import { useEffect, useMemo, useState } from 'react';
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
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProviderBadge } from '@/components/marketplace/ProviderBadge';
import { MarketplaceGetAppDetail } from '@/lib/desktop/backend';
import { BrowserOpenURL } from '@/lib/desktop/runtime';
import { handleError } from '@/lib/errorHandler';
import { formatDownloadCount, installMarketplacePackage } from '@/lib/marketplace/install';
import { getMarketplaceEffectiveGithubToken, useMarketplaceStore } from '@/lib/marketplaceStore';
import type { backend } from '@/lib/desktop/models';

type AppDetail = backend.MarketplaceAppDetail;

function MetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 text-sm font-medium">{value}</span>
    </div>
  );
}

export function AppDetailView() {
  const store = useMarketplaceStore();
  const { selectedApp, closeDetail } = store;
  const githubToken = getMarketplaceEffectiveGithubToken(store);

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
        if (!cancelled) setDetail(nextDetail);
      })
      .catch((error) => {
        if (!cancelled) handleError('Marketplace Detail', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
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
      setTimeout(() => setPrimaryInstallState('idle'), 2000);
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

  if (!selectedApp) return null;

  return (
    <div className="mt-2 flex flex-col gap-8 pb-12 animate-in fade-in duration-300">
      {/* Back Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={closeDetail}
          className="-ml-3 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to results
        </Button>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/40 shadow-sm sm:size-24">
            {selectedApp.iconUrl ? (
              <img
                src={selectedApp.iconUrl}
                alt=""
                className="size-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Package className="size-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {detail?.packageName ?? selectedApp.packageName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ProviderBadge source={selectedApp.source} />
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {detail?.repoStars && <span>★ {detail.repoStars.toLocaleString()}</span>}
                {downloadsLabel && (
                  <>
                    <span>•</span>
                    <span>{downloadsLabel} Downloads</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 sm:pt-2">
          <Button
            size="lg"
            className="w-full px-8 font-semibold shadow-sm sm:w-auto"
            onClick={handlePrimaryInstall}
            disabled={!effectiveDownloadUrl || primaryInstallState === 'running'}
          >
            {primaryInstallState === 'done' ? (
              <Check className="mr-2 size-5" />
            ) : primaryInstallState === 'running' ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : (
              <Download className="mr-2 size-5" />
            )}
            {primaryInstallState === 'done'
              ? 'Installed'
              : primaryInstallState === 'running'
                ? 'Installing…'
                : effectiveDownloadUrl
                  ? `Install ${detail?.size ? `(${(detail.size / 1024 / 1024).toFixed(1)} MB)` : ''}`
                  : 'No APK available'}
          </Button>
        </div>
      </div>

      {isLoadingDetail && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="size-4 animate-spin" />
          Loading additional app details...
        </div>
      )}

      {/* Screenshots Carousel */}
      {detail?.screenshots && detail.screenshots.length > 0 && (
        <section className="space-y-4">
          <div className="custom-scroll flex snap-x gap-4 overflow-x-auto pb-4">
            {detail.screenshots.map((url, i) => (
              <img
                key={`${url}-${i}`}
                src={url}
                alt=""
                className="h-64 shrink-0 snap-start rounded-xl border bg-muted/20 object-contain shadow-sm sm:h-80"
              />
            ))}
          </div>
        </section>
      )}

      {/* Two Column Layout for Specs/Description */}
      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        {/* Main Content Column */}
        <div className="min-w-0 space-y-10">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">About this app</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {detail?.description ||
                selectedApp.summary ||
                'No description is available for this app yet.'}
            </div>
          </section>

          {detail?.changelog && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">What's New</h2>
              <div className="whitespace-pre-wrap rounded-xl border bg-muted/10 p-5 text-sm leading-relaxed text-muted-foreground">
                {detail.changelog}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar Info Column */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              App Information
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <MetadataItem label="Version" value={detail?.version || selectedApp.version} />
              <MetadataItem
                label="Updated"
                value={detail?.updatedAt ? new Date(detail.updatedAt).toLocaleDateString() : null}
              />
              <MetadataItem label="License" value={detail?.license} />
              <MetadataItem label="Author" value={detail?.author} />
            </div>
            {(detail?.repoUrl ?? selectedApp.repoUrl) && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => BrowserOpenURL(detail?.repoUrl ?? selectedApp.repoUrl!)}
                >
                  {selectedApp.source === 'GitHub' ? (
                    <GitBranch className="mr-2 size-4" />
                  ) : (
                    <ExternalLink className="mr-2 size-4" />
                  )}
                  Open Repository
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
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
            >
              <Copy className="mr-2 size-4" /> Copy Package ID
            </Button>
          </section>

          {detail?.versions && detail.versions.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Versions
              </h3>
              <div className="space-y-3">
                {detail.versions.slice(0, 5).map((version) => {
                  const isInstallingVersion = activeVersionName === version.versionName;
                  return (
                    <div
                      key={version.versionName}
                      className="flex flex-col gap-2 rounded-xl border bg-muted/10 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium">{version.versionName}</span>
                        {version.publishedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(version.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {version.downloadUrl && (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {version.size != null
                              ? `${(version.size / 1024 / 1024).toFixed(1)} MB`
                              : 'APK'}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={() =>
                              handleVersionInstall(version.versionName, version.downloadUrl!)
                            }
                            disabled={isInstallingVersion || primaryInstallState === 'running'}
                          >
                            {isInstallingVersion ? (
                              <Loader2 className="mr-1.5 size-3 animate-spin" />
                            ) : (
                              <Download className="mr-1.5 size-3" />
                            )}
                            Install
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
