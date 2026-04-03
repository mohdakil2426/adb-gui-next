import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Loader2,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ProviderBadge } from '@/components/marketplace/ProviderBadge';
import { MarketplaceGetAppDetail } from '@/lib/desktop/backend';
import { BrowserOpenURL } from '@/lib/desktop/runtime';
import { handleError } from '@/lib/errorHandler';
import { formatDownloadCount, installMarketplacePackage } from '@/lib/marketplace/install';
import { getMarketplaceEffectiveGithubToken, useMarketplaceStore } from '@/lib/marketplaceStore';
import type { backend } from '@/lib/desktop/models';

type AppDetail = backend.MarketplaceAppDetail;

function MetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

export function AppDetailDialog() {
  const store = useMarketplaceStore();
  const { selectedApp, isDetailOpen, closeDetail } = store;
  const githubToken = getMarketplaceEffectiveGithubToken(store);

  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [primaryInstallState, setPrimaryInstallState] = useState<'idle' | 'running' | 'done'>(
    'idle',
  );
  const [activeVersionName, setActiveVersionName] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedApp || !isDetailOpen) {
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
      .catch((error) => {
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
  }, [githubToken, isDetailOpen, selectedApp]);

  const displayName = detail?.name ?? selectedApp?.name ?? 'App';
  const effectiveDownloadUrl = detail?.downloadUrl ?? selectedApp?.downloadUrl;
  const downloadsLabel = useMemo(
    () => formatDownloadCount(detail?.downloadsCount ?? selectedApp?.downloadsCount ?? null),
    [detail?.downloadsCount, selectedApp?.downloadsCount],
  );

  if (!selectedApp) {
    return null;
  }

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

  const handleCopyPackage = async () => {
    try {
      await navigator.clipboard.writeText(detail?.packageName ?? selectedApp.packageName);
      toast.success('Package name copied');
    } catch {
      toast.error('Unable to copy package name');
    }
  };

  return (
    <Dialog open={isDetailOpen} onOpenChange={(open) => !open && closeDetail()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="space-y-4 text-left">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/40">
              {selectedApp.iconUrl ? (
                <img
                  src={selectedApp.iconUrl}
                  alt=""
                  className="size-16 object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Package className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl leading-none">{displayName}</DialogTitle>
                <ProviderBadge source={selectedApp.source} />
                {(detail?.sourcesAvailable ?? selectedApp.availableSources).map((source) =>
                  source !== selectedApp.source ? (
                    <ProviderBadge
                      key={source}
                      source={source}
                      compact
                      className="hidden sm:inline-flex"
                    />
                  ) : null,
                )}
              </div>
              <DialogDescription className="max-w-2xl text-left text-sm text-muted-foreground">
                {detail?.description ||
                  selectedApp.summary ||
                  'No description is available for this app yet.'}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{detail?.version || selectedApp.version || 'Version unavailable'}</span>
                {detail?.license && <span>{detail.license}</span>}
                {downloadsLabel && <span>{downloadsLabel}</span>}
                {detail?.updatedAt && (
                  <span>{new Date(detail.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div className="space-y-4">
            {detail?.screenshots && detail.screenshots.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  Screenshots
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {detail.screenshots.slice(0, 6).map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-44 shrink-0 rounded-xl border object-cover"
                    />
                  ))}
                </div>
              </section>
            )}

            {detail?.changelog && (
              <section className="space-y-2">
                <div className="text-sm font-medium">What’s new</div>
                <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  {detail.changelog}
                </div>
              </section>
            )}

            {detail?.versions && detail.versions.length > 0 && (
              <section className="space-y-3">
                <div className="text-sm font-medium">Version history</div>
                <div className="space-y-2">
                  {detail.versions.slice(0, 8).map((version) => {
                    const isInstallingVersion = activeVersionName === version.versionName;
                    return (
                      <div
                        key={version.versionName}
                        className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium">{version.versionName}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {version.size != null && (
                              <span>{(version.size / 1024 / 1024).toFixed(1)} MB</span>
                            )}
                            {version.publishedAt && (
                              <span>{new Date(version.publishedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        {version.downloadUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              handleVersionInstall(version.versionName, version.downloadUrl!)
                            }
                            disabled={isInstallingVersion || primaryInstallState === 'running'}
                          >
                            {isInstallingVersion ? (
                              <Loader2 className="mr-2 size-3.5 animate-spin" />
                            ) : (
                              <Download className="mr-2 size-3.5" />
                            )}
                            Install
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="text-sm font-medium">Actions</div>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePrimaryInstall}
                disabled={!effectiveDownloadUrl || primaryInstallState === 'running'}
              >
                {primaryInstallState === 'done' ? (
                  <Check className="mr-2 size-4" />
                ) : primaryInstallState === 'running' ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Download className="mr-2 size-4" />
                )}
                {primaryInstallState === 'done'
                  ? 'Installed'
                  : primaryInstallState === 'running'
                    ? 'Installing…'
                    : effectiveDownloadUrl
                      ? 'Install latest APK'
                      : 'No APK available'}
              </Button>
              {(detail?.repoUrl ?? selectedApp.repoUrl) && (
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
                  Open source page
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={handleCopyPackage}>
                <Copy className="mr-2 size-4" />
                Copy package name
              </Button>
            </section>

            <section className="space-y-3">
              <div className="text-sm font-medium">Details</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <MetadataItem
                  label="Package"
                  value={detail?.packageName ?? selectedApp.packageName}
                />
                <MetadataItem label="Author" value={detail?.author} />
                <MetadataItem label="License" value={detail?.license} />
                <MetadataItem
                  label="Size"
                  value={detail?.size ? `${(detail.size / 1024 / 1024).toFixed(1)} MB` : null}
                />
                <MetadataItem
                  label="Stars"
                  value={detail?.repoStars ? detail.repoStars.toLocaleString() : null}
                />
                <MetadataItem label="Downloads" value={downloadsLabel} />
              </div>
            </section>
          </div>
        </div>

        {isLoadingDetail && (
          <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading additional metadata…
          </div>
        )}

        <Separator />
      </DialogContent>
    </Dialog>
  );
}
