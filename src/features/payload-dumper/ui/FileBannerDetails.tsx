import {
  Archive,
  Check,
  Copy,
  Cpu,
  FileKey,
  Globe,
  Layers,
  Settings2,
  Smartphone,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import type { backend } from '@/desktop/models';
import {
  formatTimestamp,
  formatUpdateType,
  sdkToAndroid,
} from '@/features/payload-dumper/utils/fileBannerMetadata';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { formatBytesNum } from '@/shared/utils/formatting';

interface FileBannerDetailsProps {
  metadata: backend.RemotePayloadMetadata;
  outputPath: string;
  prefetch: boolean;
  remoteUrl: string;
}
/** Key-value row with muted label and default value */
function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}
/** Section header with icon */
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 border-border/50 border-b pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
      <Icon className="size-3.5" />
      {title}
    </div>
  );
}
/** Copyable text with feedback */
function CopyableText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }, [text]);
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <span className="min-w-0 break-all font-mono text-xs leading-relaxed">{text}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={copied ? 'Copied' : 'Copy'}
            className={cn(
              'shrink-0 rounded-md p-1 transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              copied && 'text-success',
            )}
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
      </Tooltip>
    </div>
  );
}
/** Parse build fingerprint into human-readable device + build info */
function parseBuildFingerprint(fp: string): { device: string; build: string } | null {
  // Format: OnePlus/OnePlus8Pro/OnePlus8Pro:10/QKQ1.191222.002/2004210418:user/release-keys
  const parts = fp.split('/');
  if (parts.length < 3) {
    return null;
  }
  const brand = parts[0];
  const androidVersion = parts[2]?.split(':')[1] ?? '';
  const buildId = parts[3] ?? '';
  return {
    device: `${brand} (Android ${androidVersion})`,
    build: `${buildId}/${parts[4] ?? ''}`,
  };
}
export function FileBannerDetails({
  metadata,
  remoteUrl,
  prefetch,
  outputPath,
}: FileBannerDetailsProps) {
  const hasOtaPackageInfo =
    metadata.preDevice ?? metadata.postBuild ?? metadata.otaType ?? metadata.otaVersion;
  const hasPayloadProperties = metadata.fileHash ?? metadata.fileSize ?? metadata.metadataHash;
  const buildInfo = metadata.postBuild ? parseBuildFingerprint(metadata.postBuild) : null;
  return (
    <div className="gap-4 border-border/50 border-t pt-3">
      {/* ═══════════════════════════════════════════════════════════════════
          OTA Package Info — the MOST important section for users.
          Sourced from META-INF/com/android/metadata inside the ZIP.
          ═══════════════════════════════════════════════════════════════════ */}
      {hasOtaPackageInfo ? (
        <div className="gap-2">
          <SectionHeader icon={Smartphone} title="OTA Package" />
          <div className="gap-1.5 pl-1">
            {metadata.preDevice ? <MetadataRow label="Device" value={metadata.preDevice} /> : null}
            {metadata.postSdkLevel ? (
              <MetadataRow label="Android" value={sdkToAndroid(metadata.postSdkLevel)} />
            ) : null}
            {buildInfo ? (
              <MetadataRow
                label="Build"
                value={<span className="font-mono text-xs">{metadata.postBuildIncremental}</span>}
              />
            ) : null}
            {metadata.postBuild ? (
              <MetadataRow
                label="Fingerprint"
                value={<span className="font-mono text-xs">{metadata.postBuild}</span>}
              />
            ) : null}
            {metadata.otaType ? (
              <MetadataRow
                label="OTA Type"
                value={
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs',
                      metadata.otaType === 'AB'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {metadata.otaType}
                  </span>
                }
              />
            ) : null}
            {metadata.postSecurityPatchLevel ? (
              <MetadataRow label="Security Patch" value={metadata.postSecurityPatchLevel} />
            ) : null}
            {metadata.postTimestamp ? (
              <MetadataRow label="Build Date" value={formatTimestamp(metadata.postTimestamp)} />
            ) : null}
            {metadata.otaVersion ? (
              <MetadataRow
                label="Version"
                value={<span className="font-mono text-xs">{metadata.otaVersion}</span>}
              />
            ) : null}
            {metadata.wipe !== null && (
              <MetadataRow label="Wipes Data" value={metadata.wipe ? 'Yes' : 'No'} />
            )}
          </div>
        </div>
      ) : null}
      {/* Payload Properties — hash & size from payload_properties.txt */}
      {hasPayloadProperties ? (
        <div className="gap-2">
          <SectionHeader icon={FileKey} title="Payload Properties" />
          <div className="gap-1.5 pl-1">
            {metadata.fileSize !== null && (
              <MetadataRow label="Payload Size" value={formatBytesNum(metadata.fileSize)} />
            )}
            {metadata.fileHash ? (
              <MetadataRow label="File Hash" value={<CopyableText text={metadata.fileHash} />} />
            ) : null}
            {metadata.metadataSize !== null && (
              <MetadataRow label="Metadata Size" value={formatBytesNum(metadata.metadataSize)} />
            )}
            {metadata.metadataHash ? (
              <MetadataRow
                label="Metadata Hash"
                value={<CopyableText text={metadata.metadataHash} />}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {/* HTTP Section */}
      <div className="gap-2">
        <SectionHeader icon={Globe} title="HTTP" />
        <div className="gap-1.5 pl-1">
          <MetadataRow label="Full URL" value={<CopyableText text={remoteUrl} />} />
          <MetadataRow label="File Size" value={formatBytesNum(metadata.contentLength)} />
          {metadata.contentType ? (
            <MetadataRow label="Content-Type" value={metadata.contentType} />
          ) : null}
          {metadata.server ? <MetadataRow label="Server" value={metadata.server} /> : null}
          {metadata.lastModified ? (
            <MetadataRow label="Last Modified" value={metadata.lastModified} />
          ) : null}
          {metadata.etag ? (
            <MetadataRow
              label="ETag"
              value={<span className="font-mono text-xs">{metadata.etag}</span>}
            />
          ) : null}
        </div>
      </div>
      {/* ZIP Section — only shown for ZIP archives */}
      {metadata.isZip ? (
        <div className="gap-2">
          <SectionHeader icon={Archive} title="ZIP Archive" />
          <div className="gap-1.5 pl-1">
            <MetadataRow label="Format" value="ZIP (payload.bin inside)" />
            {metadata.zipCompressionMethod ? (
              <MetadataRow label="Compression" value={metadata.zipCompressionMethod} />
            ) : null}
            {metadata.zipPayloadOffset !== null && (
              <MetadataRow
                label="Payload Offset"
                value={
                  <span className="font-mono text-xs">
                    0x{metadata.zipPayloadOffset.toString(16).toUpperCase()}
                  </span>
                }
              />
            )}
            {metadata.zipUncompressedSize !== null && (
              <MetadataRow
                label="Payload Size"
                value={`${formatBytesNum(metadata.zipUncompressedSize)} (uncompressed)`}
              />
            )}
          </div>
        </div>
      ) : null}
      {/* OTA Manifest Section */}
      <div className="gap-2">
        <SectionHeader icon={Cpu} title="OTA Manifest" />
        <div className="gap-1.5 pl-1">
          <MetadataRow label="CrAU Version" value={metadata.payloadVersion} />
          <MetadataRow label="Block Size" value={`${metadata.blockSize} bytes`} />
          <MetadataRow label="Update Type" value={formatUpdateType(metadata.minorVersion)} />
          {metadata.securityPatchLevel ? (
            <MetadataRow label="Security Patch" value={metadata.securityPatchLevel} />
          ) : null}
          <MetadataRow label="Timestamp" value={formatTimestamp(metadata.maxTimestamp)} />
          <MetadataRow label="Partial Update" value={metadata.partialUpdate ? 'Yes' : 'No'} />
        </div>
      </div>
      {/* Dynamic Groups Section — only shown if groups exist */}
      {metadata.dynamicGroups.length > 0 && (
        <div className="gap-2">
          <SectionHeader icon={Layers} title="Dynamic Groups" />
          <div className="gap-1.5 pl-1">
            {metadata.dynamicGroups.map((group) => (
              <MetadataRow
                key={group.name}
                label={group.name}
                value={
                  <span>
                    {group.size !== null && (
                      <span className="mr-2 text-muted-foreground">
                        ({formatBytesNum(group.size)})
                      </span>
                    )}
                    {group.partitions.join(', ')}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      )}
      {/* Extraction Config Section */}
      <div className="gap-2">
        <SectionHeader icon={Settings2} title="Extraction" />
        <div className="gap-1.5 pl-1">
          <MetadataRow
            label="Mode"
            value={prefetch ? 'Prefetch (download first)' : 'Direct (HTTP range on-demand)'}
          />
          {outputPath ? (
            <MetadataRow
              label="Output"
              value={<span className="break-all font-mono text-xs">{outputPath}</span>}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
