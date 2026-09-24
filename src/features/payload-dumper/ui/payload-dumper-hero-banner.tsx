import {
  Cpu,
  FileArchive,
  FolderOpen,
  Globe,
  HardDrive,
  Layers,
  Package,
  RefreshCw,
  Zap,
} from "lucide-react";
import { memo } from "react";

import type { backend } from "@/desktop/models";
import { PayloadDumperSpecBadge } from "@/features/payload-dumper/ui/payload-dumper-spec-badge";
import { detectPayloadFormat } from "@/features/payload-dumper/utils/partition-categories";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { getFileName } from "@/shared/utils/file-path";
import { formatBytes } from "@/shared/utils/format";

interface PayloadDumperHeroBannerProps {
  activeMode: "local" | "remote";
  completedCount?: number;
  isExtractionActive?: boolean;
  onOpenOutputFolder: () => void;
  onRefreshPartitions: () => void;
  onSelectPayload: () => void;
  outputDir: string;
  outputPath: string;
  partitionCount: number;
  payloadPath: string;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  remoteUrl: string;
  selectedCount?: number;
  status: string;
  totalPayloadSize: number;
}

const resolveHeroFileName = (
  activeMode: string,
  payloadPath: string,
  remoteUrl: string
): string => {
  if (activeMode === "local") {
    return payloadPath ? getFileName(payloadPath) : "No Local File";
  }
  if (remoteUrl) {
    return getFileName(remoteUrl) || "Remote Stream";
  }
  return "No Remote URL";
};

const getStatusPulseColor = (isExtractionActive: boolean, isLoaded: boolean): string => {
  if (isExtractionActive) {
    return "bg-primary";
  }
  if (isLoaded) {
    return "bg-success";
  }
  return "bg-muted-foreground";
};

const getExtractionBadgeLabel = (
  isExtractionActive: boolean,
  isLoaded: boolean,
  partitionCount: number
): string => {
  if (isExtractionActive) {
    return "EXTRACTING";
  }
  if (isLoaded) {
    return `${partitionCount} Partitions`;
  }
  return "IDLE";
};

const PayloadDumperSpecGrid = ({
  completedCount,
  effectiveOutputDir,
  fileName,
  formatLabel,
  isLoaded,
  partitionCount,
  selectedCount,
  totalPayloadSize,
}: {
  completedCount: number;
  effectiveOutputDir: string;
  fileName: string;
  formatLabel: string;
  isLoaded: boolean;
  partitionCount: number;
  selectedCount: number;
  totalPayloadSize: number;
}) => (
  <div className="border-border/50 grid gap-2.5 border-t pt-3 @xs:grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-6">
    <PayloadDumperSpecBadge
      copyValue={fileName}
      icon={FileArchive}
      label="Payload Target"
      tooltip="Name of the currently mounted OTA payload container"
      value={isLoaded ? fileName : "None"}
    />
    <PayloadDumperSpecBadge
      copyValue={formatLabel}
      icon={Layers}
      label="Container Format"
      tooltip={`Format: ${formatLabel}`}
      value={formatLabel}
    />
    <PayloadDumperSpecBadge
      copyValue={formatBytes(totalPayloadSize)}
      icon={HardDrive}
      label="Uncompressed Size"
      tooltip="Total calculated uncompressed partition footprint"
      value={totalPayloadSize > 0 ? formatBytes(totalPayloadSize) : "0 B"}
    />
    <PayloadDumperSpecBadge
      copyValue={partitionCount.toString()}
      icon={Cpu}
      label="Total Partitions"
      tooltip="Number of addressable partition blobs inside manifest"
      value={isLoaded ? `${partitionCount} Partitions` : "0"}
    />
    <PayloadDumperSpecBadge
      copyValue={selectedCount.toString()}
      icon={Zap}
      label="Queued / Extracted"
      tooltip="Currently selected partitions for extraction"
      value={isLoaded ? `${selectedCount} sel · ${completedCount} done` : "None"}
    />
    <PayloadDumperSpecBadge
      copyValue={effectiveOutputDir}
      icon={FolderOpen}
      label="Extraction Folder"
      tooltip={`Destination: ${effectiveOutputDir}`}
      value={getFileName(effectiveOutputDir) || "Downloads"}
    />
  </div>
);

const PayloadDumperHeroBannerImpl = ({
  activeMode,
  completedCount = 0,
  isExtractionActive = false,
  onOpenOutputFolder,
  onRefreshPartitions,
  onSelectPayload,
  outputDir,
  outputPath,
  partitionCount,
  payloadPath,
  remoteMetadata: _remoteMetadata,
  remoteUrl,
  selectedCount = 0,
  status,
  totalPayloadSize,
}: PayloadDumperHeroBannerProps) => {
  const isLoaded = partitionCount > 0;
  const fileName = resolveHeroFileName(activeMode, payloadPath, remoteUrl);

  const targetPathOrUrl = activeMode === "local" ? payloadPath : remoteUrl;
  const isZipFile = targetPathOrUrl.toLowerCase().endsWith(".zip");
  const formatInfo = detectPayloadFormat(targetPathOrUrl, isZipFile, activeMode === "remote");
  const effectiveOutputDir = outputDir || outputPath || "Default (~/Downloads/extracted)";

  return (
    <Card className="border-border bg-surface @container rounded-xl p-4.5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Top Header Row: Branding Avatar, Target Name, Badges & Actions */}
        <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="border-border/80 bg-surface-raised text-foreground relative flex size-12 shrink-0 items-center justify-center rounded-2xl border p-2 shadow-xs">
              {activeMode === "remote" ? (
                <Globe aria-hidden="true" className="text-foreground size-6" />
              ) : (
                <Package aria-hidden="true" className="text-foreground size-6" />
              )}

              {/* Status Pulse Indicator */}
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span
                  className={cn(
                    "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                    getStatusPulseColor(isExtractionActive, isLoaded)
                  )}
                />
                <span
                  className={cn(
                    "border-surface relative inline-flex size-3 rounded-full border-2",
                    getStatusPulseColor(isExtractionActive, isLoaded)
                  )}
                />
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-foreground text-title truncate font-semibold">
                  {isLoaded ? fileName : "No Payload Source Loaded"}
                </h2>

                {/* Status Badges */}
                <Badge className="font-mono text-[10px]" variant={isLoaded ? "success" : "outline"}>
                  {getExtractionBadgeLabel(isExtractionActive, isLoaded, partitionCount)}
                </Badge>

                <Badge className="font-mono text-[10px]" variant="secondary">
                  {activeMode === "local" ? "Local Storage" : "Remote HTTP Stream"}
                </Badge>

                {isLoaded ? (
                  <Badge className="font-mono text-[10px]" variant="outline">
                    {formatInfo.label}
                  </Badge>
                ) : null}
              </div>

              <p className="text-caption text-muted-foreground truncate">
                {isLoaded
                  ? `Source: ${activeMode === "local" ? payloadPath : remoteUrl}`
                  : "Load an Android OTA payload.bin, factory archive, or stream URL to inspect partitions."}
              </p>
            </div>
          </div>

          {/* Top-Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start @lg:self-auto">
            <Button
              className="text-caption h-8 gap-1.5 px-3"
              disabled={isExtractionActive}
              onClick={onSelectPayload}
              size="sm"
              type="button"
              variant="outline"
            >
              <FileArchive className="text-muted-foreground size-3.5" data-icon="inline-start" />
              {isLoaded ? "Change Source" : "Open Payload File"}
            </Button>

            <Button
              className="text-caption h-8 gap-1.5 px-3"
              onClick={onOpenOutputFolder}
              size="sm"
              type="button"
              variant="outline"
            >
              <FolderOpen className="text-muted-foreground size-3.5" data-icon="inline-start" />
              Output Folder
            </Button>

            {isLoaded ? (
              <Button
                aria-label="Refresh partition list"
                className="size-8 rounded-lg p-0"
                disabled={isExtractionActive}
                onClick={onRefreshPartitions}
                size="sm"
                title="Re-read Partition Table"
                type="button"
                variant="outline"
              >
                <RefreshCw
                  className={cn(
                    "text-muted-foreground size-3.5",
                    status === "loading-partitions" && "text-foreground animate-spin"
                  )}
                  data-icon="inline-start"
                />
              </Button>
            ) : null}
          </div>
        </div>

        <PayloadDumperSpecGrid
          completedCount={completedCount}
          effectiveOutputDir={effectiveOutputDir}
          fileName={fileName}
          formatLabel={formatInfo.label}
          isLoaded={isLoaded}
          partitionCount={partitionCount}
          selectedCount={selectedCount}
          totalPayloadSize={totalPayloadSize}
        />
      </CardContent>
    </Card>
  );
};

export const PayloadDumperHeroBanner = memo(PayloadDumperHeroBannerImpl);
