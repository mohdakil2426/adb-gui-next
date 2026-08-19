import { Check, Copy, Download, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BrowserOpenURL } from '@/desktop/runtime';
import type {
  FirmwareBuild,
  FirmwareDeviceModel,
} from '@/features/payload-dumper/ui/marketplace/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes } from '@/shared/utils/format';

interface FirmwareBuildCardProps {
  build: FirmwareBuild;
  device: FirmwareDeviceModel;
  onSelectRemoteUrl: (url: string) => void;
}

export function FirmwareBuildCard({ build, device, onSelectRemoteUrl }: FirmwareBuildCardProps) {
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopySha = () => {
    if (!build.sha256) {
      return;
    }
    void navigator.clipboard.writeText(build.sha256);
    setCopiedSha(true);
    toast.success('SHA-256 Checksum copied to clipboard');
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleCopyUrl = () => {
    void navigator.clipboard.writeText(build.downloadUrl);
    setCopiedUrl(true);
    toast.success('Download URL copied to clipboard');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleRemoteExtract = () => {
    onSelectRemoteUrl(build.downloadUrl);
    toast.info(
      `Loaded ${device.name} (${build.buildId || build.version}) URL into Remote Extractor`,
    );
  };

  const sizeLabel =
    typeof build.fileSize === 'number' && build.fileSize > 0 ? formatBytes(build.fileSize) : '—';

  return (
    <Card className="rounded-xl border-border bg-surface p-4 shadow-none transition-colors duration-150 hover:border-border-strong">
      <CardContent className="flex flex-col gap-3 p-0">
        {/* Build Header Row */}
        <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-body text-foreground">{build.version}</h3>
            {build.isLatest ? (
              <Badge className="border-primary/20 bg-primary/10 text-primary">Latest</Badge>
            ) : null}
            {build.androidVersion ? <Badge variant="outline">{build.androidVersion}</Badge> : null}
            {build.securityPatch ? (
              <Badge variant="secondary">
                <ShieldCheck className="mr-1 size-3 text-success" />
                Patch: {build.securityPatch}
              </Badge>
            ) : null}
            {build.carrier ? <Badge variant="outline">{build.carrier}</Badge> : null}
          </div>

          <span className="font-mono text-caption text-muted-foreground">
            Build: <strong className="text-foreground">{build.buildId}</strong>
            {sizeLabel === '—' ? null : (
              <>
                {' · '}Size: <strong className="text-foreground">{sizeLabel}</strong>
              </>
            )}
            {build.releaseDate ? ` · ${build.releaseDate}` : null}
          </span>
        </div>

        {/* SHA-256 Row */}
        {build.sha256 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-raised/40 px-3 py-2 text-caption">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-medium text-muted-foreground">SHA-256:</span>
              <span className="truncate font-mono text-[11px] text-foreground/80">
                {build.sha256}
              </span>
            </div>
            <Button
              className="h-6 px-2 text-[11px]"
              onClick={handleCopySha}
              size="sm"
              type="button"
              variant="ghost"
            >
              {copiedSha ? (
                <Check className="mr-1 size-3 text-success" />
              ) : (
                <Copy className="mr-1 size-3" />
              )}
              {copiedSha ? 'Copied' : 'Copy Hash'}
            </Button>
          </div>
        ) : null}

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-border/40 border-t pt-2.5">
          <div className="flex items-center gap-2">
            {build.imageType === 'ota' ? (
              <Button onClick={handleRemoteExtract} size="sm" type="button" variant="default">
                <Zap className="mr-1.5 size-3.5 text-amber-300" />
                Remote Stream Extract
              </Button>
            ) : (
              <Button
                onClick={() => BrowserOpenURL(build.downloadUrl)}
                size="sm"
                type="button"
                variant="default"
              >
                <Download className="mr-1.5 size-3.5" />
                Download Factory Archive
              </Button>
            )}

            <Button
              onClick={() => BrowserOpenURL(build.downloadUrl)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="mr-1.5 size-3.5" />
              Direct Download
            </Button>
          </div>

          <Button onClick={handleCopyUrl} size="sm" type="button" variant="ghost">
            {copiedUrl ? (
              <Check className="mr-1 size-3 text-success" />
            ) : (
              <Copy className="mr-1 size-3" />
            )}
            {copiedUrl ? 'URL Copied' : 'Copy Download Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
