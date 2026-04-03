import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Download,
  Loader2,
  Check,
  Package,
  Scale,
  User,
  ExternalLink,
  Star,
  GitFork,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useMarketplaceStore } from '@/lib/marketplaceStore';
import { ProviderBadge } from '@/components/marketplace/ProviderBadge';
import {
  MarketplaceDownloadApk,
  MarketplaceGetAppDetail,
  MarketplaceInstallApk,
} from '@/lib/desktop/backend';
import { handleError } from '@/lib/errorHandler';
import type { backend } from '@/lib/desktop/models';

type AppDetail = backend.MarketplaceAppDetail;

export function AppDetailDialog() {
  const { selectedApp, isDetailOpen, closeDetail } = useMarketplaceStore();
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [installState, setInstallState] = useState<
    'idle' | 'downloading' | 'installing' | 'done' | 'error'
  >('idle');
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Load detail when dialog opens
  useEffect(() => {
    if (!isDetailOpen || !selectedApp) {
      setDetail(null);
      setInstallState('idle');
      setShowFullDesc(false);
      setShowVersions(false);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);

    MarketplaceGetAppDetail(selectedApp.packageName, selectedApp.source)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) handleError('App Detail', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDetailOpen, selectedApp]);

  const downloadUrl = detail?.downloadUrl ?? selectedApp?.downloadUrl;
  const displayName = detail?.name ?? selectedApp?.name ?? 'App';

  const handleInstall = async (url?: string) => {
    const targetUrl = url ?? downloadUrl;
    if (!targetUrl) {
      toast.error('No download URL available for this app');
      return;
    }

    setInstallState('downloading');
    const toastId = toast.loading(`Downloading ${displayName}...`);

    try {
      const localPath = await MarketplaceDownloadApk(targetUrl);

      setInstallState('installing');
      toast.loading(`Installing ${displayName}...`, { id: toastId });

      await MarketplaceInstallApk(localPath);

      setInstallState('done');
      toast.success(`${displayName} installed successfully!`, { id: toastId });
    } catch (error) {
      setInstallState('error');
      toast.error(`Failed to install ${displayName}`, {
        id: toastId,
        description: String(error),
      });
      setTimeout(() => setInstallState('idle'), 2000);
    }
  };

  const handleCopyPackage = () => {
    const pkg = detail?.packageName ?? selectedApp?.packageName;
    if (pkg) {
      navigator.clipboard.writeText(pkg);
      toast.success('Package name copied');
    }
  };

  if (!selectedApp) return null;

  const description = detail?.description ?? '';
  const isLongDesc = description.length > 300;

  return (
    <Dialog open={isDetailOpen} onOpenChange={(open) => !open && closeDetail()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {/* App icon */}
            <div className="size-14 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {selectedApp.iconUrl ? (
                <img
                  src={selectedApp.iconUrl}
                  alt=""
                  className="size-14 rounded-xl object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left">{displayName}</DialogTitle>
              <DialogDescription className="text-left">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                  <span>{detail?.version ?? selectedApp.version}</span>
                  {detail?.license && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Scale className="h-3 w-3" />
                        {detail.license}
                      </span>
                    </>
                  )}
                  {detail?.author && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {detail.author}
                      </span>
                    </>
                  )}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator />

        {/* Stats row (GitHub/Aptoide) */}
        {(detail?.repoStars || detail?.rating || detail?.downloadsCount) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {detail.repoStars != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {detail.repoStars.toLocaleString()} stars
              </span>
            )}
            {detail.repoForks != null && (
              <span className="flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                {detail.repoForks.toLocaleString()}
              </span>
            )}
            {detail.rating != null && detail.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {detail.rating.toFixed(1)}
              </span>
            )}
            {detail.downloadsCount != null && detail.downloadsCount > 0 && (
              <span className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                {detail.downloadsCount.toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Sources */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Available from</p>
          <div className="flex flex-wrap gap-1.5">
            {(detail?.sourcesAvailable ?? [selectedApp.source]).map((src) => (
              <ProviderBadge key={src} source={src} />
            ))}
          </div>
        </div>

        {/* Screenshots (horizontal scroll) */}
        {detail?.screenshots && detail.screenshots.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Screenshots</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
              {detail.screenshots.slice(0, 5).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  className="h-40 rounded-lg object-cover shrink-0 border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Install Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={() => handleInstall()}
          disabled={
            !downloadUrl ||
            installState === 'downloading' ||
            installState === 'installing' ||
            installState === 'done'
          }
        >
          {installState === 'downloading' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {installState === 'installing' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {installState === 'done' && <Check className="h-4 w-4 mr-2" />}
          {installState === 'idle' && <Download className="h-4 w-4 mr-2" />}
          {installState === 'error' && <Download className="h-4 w-4 mr-2" />}
          {installState === 'downloading'
            ? 'Downloading...'
            : installState === 'installing'
              ? 'Installing...'
              : installState === 'done'
                ? 'Installed!'
                : installState === 'error'
                  ? 'Retry Install'
                  : downloadUrl
                    ? 'Download & Install'
                    : 'No APK available'}
        </Button>

        {/* External link */}
        {selectedApp.repoUrl && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(selectedApp.repoUrl!, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on {selectedApp.source === 'GitHub' ? 'GitHub' : 'Web'}
          </Button>
        )}

        {/* Description */}
        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : description ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">About</p>
            <p
              className={cn(
                'text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap',
                !showFullDesc && isLongDesc && 'line-clamp-5',
              )}
            >
              {description}
            </p>
            {isLongDesc && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-0"
                onClick={() => setShowFullDesc(!showFullDesc)}
              >
                {showFullDesc ? (
                  <>
                    Show less <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    Show more <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>
        ) : null}

        {/* Changelog */}
        {detail?.changelog && (
          <div className="space-y-2">
            <p className="text-sm font-medium">What's new</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">
              {detail.changelog}
            </p>
          </div>
        )}

        {/* Version history */}
        {detail?.versions && detail.versions.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-sm font-medium"
              onClick={() => setShowVersions(!showVersions)}
            >
              Versions ({detail.versions.length})
              {showVersions ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              )}
            </Button>

            {showVersions && (
              <div className="space-y-1.5">
                {detail.versions.map((v, i) => (
                  <div
                    key={`${v.versionName}-${i}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{v.versionName}</span>
                      {v.size != null && v.size > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {(v.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                      {v.publishedAt && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(v.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {v.downloadUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleInstall(v.downloadUrl!)}
                        disabled={installState === 'downloading' || installState === 'installing'}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metadata footer */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
          {/* Package name (copyable) */}
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={handleCopyPackage}
            title="Copy package name"
          >
            <Copy className="h-3 w-3" />
            {detail?.packageName ?? selectedApp.packageName}
          </button>

          {/* Size */}
          {detail?.size != null && detail.size > 0 && (
            <>
              <span>·</span>
              <span>{(detail.size / 1024 / 1024).toFixed(1)} MB</span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
