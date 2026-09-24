import { Check, Copy, Download, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BrowserOpenURL } from "@/desktop/runtime";
import type {
  FirmwareBuild,
  FirmwareDeviceModel,
} from "@/features/payload-dumper/ui/marketplace/types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { formatBytes } from "@/shared/utils/format";

interface FirmwareBuildCardProps {
  build: FirmwareBuild;
  device: FirmwareDeviceModel;
  onSelectRemoteUrl: (url: string) => void;
}

export const FirmwareBuildCard = ({ build, device, onSelectRemoteUrl }: FirmwareBuildCardProps) => {
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopySha = () => {
    if (!build.sha256) {
      return;
    }
    void navigator.clipboard.writeText(build.sha256);
    setCopiedSha(true);
    toast.success("SHA-256 Checksum copied to clipboard");
    setTimeout(() => setCopiedSha(false), 2000);
  };

  const handleCopyUrl = () => {
    void navigator.clipboard.writeText(build.downloadUrl);
    setCopiedUrl(true);
    toast.success("Download URL copied to clipboard");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleRemoteExtract = () => {
    onSelectRemoteUrl(build.downloadUrl);
    toast.info(
      `Loaded ${device.name} (${build.buildId || build.version}) URL into Remote Extractor`
    );
  };

  const sizeLabel =
    typeof build.fileSize === "number" && build.fileSize > 0 ? formatBytes(build.fileSize) : "—";

  return (
    <Card className="border-border bg-surface hover:border-border-strong rounded-xl p-4 shadow-none transition-colors duration-150">
      <CardContent className="flex flex-col gap-3 p-0">
        {/* Build Header Row */}
        <div className="flex flex-col gap-2 @lg:flex-row @lg:items-center @lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body text-foreground font-semibold">{build.version}</h3>
            {build.isLatest ? (
              <Badge className="border-primary/20 bg-primary/10 text-primary">Latest</Badge>
            ) : null}
            {build.androidVersion ? <Badge variant="outline">{build.androidVersion}</Badge> : null}
            {build.securityPatch ? (
              <Badge variant="secondary">
                <ShieldCheck className="text-success mr-1 size-3" />
                Patch: {build.securityPatch}
              </Badge>
            ) : null}
            {build.carrier ? <Badge variant="outline">{build.carrier}</Badge> : null}
          </div>

          <span className="text-caption text-muted-foreground font-mono">
            Build: <strong className="text-foreground">{build.buildId}</strong>
            {sizeLabel === "—" ? null : (
              <>
                {" · "}Size: <strong className="text-foreground">{sizeLabel}</strong>
              </>
            )}
            {build.releaseDate ? ` · ${build.releaseDate}` : null}
          </span>
        </div>

        {/* SHA-256 Row */}
        {build.sha256 ? (
          <div className="border-border/60 bg-surface-raised/40 text-caption flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground shrink-0 font-medium">SHA-256:</span>
              <span className="text-foreground/80 text-caption truncate font-mono">
                {build.sha256}
              </span>
            </div>
            <Button
              className="text-caption h-6 px-2"
              onClick={handleCopySha}
              size="sm"
              type="button"
              variant="ghost"
            >
              {copiedSha ? (
                <Check className="text-success mr-1 size-3" data-icon="inline-start" />
              ) : (
                <Copy className="mr-1 size-3" data-icon="inline-start" />
              )}
              {copiedSha ? "Copied" : "Copy Hash"}
            </Button>
          </div>
        ) : null}

        {/* Action Buttons Row */}
        <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          <div className="flex items-center gap-2">
            {build.imageType === "ota" ? (
              <Button onClick={handleRemoteExtract} size="sm" type="button" variant="default">
                <Zap className="text-chart-4 mr-1.5 size-3.5" data-icon="inline-start" />
                {device.brand === "xiaomi" ? "Extract Recovery ROM" : "Remote Stream Extract"}
              </Button>
            ) : (
              <Button
                onClick={() => BrowserOpenURL(build.downloadUrl)}
                size="sm"
                type="button"
                variant="default"
              >
                <Download className="mr-1.5 size-3.5" data-icon="inline-start" />
                {device.brand === "xiaomi" ? "Download Fastboot TGZ" : "Download Factory Archive"}
              </Button>
            )}

            <Button
              onClick={() => BrowserOpenURL(build.downloadUrl)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="mr-1.5 size-3.5" data-icon="inline-start" />
              Direct Download
            </Button>
          </div>

          <Button onClick={handleCopyUrl} size="sm" type="button" variant="ghost">
            {copiedUrl ? (
              <Check className="text-success mr-1 size-3" data-icon="inline-start" />
            ) : (
              <Copy className="mr-1 size-3" data-icon="inline-start" />
            )}
            {copiedUrl ? "URL Copied" : "Copy Download Link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
