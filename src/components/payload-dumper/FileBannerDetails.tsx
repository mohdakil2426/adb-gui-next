import {
  Globe,
  Archive,
  Cpu,
  Copy,
  Check,
  Layers,
  Smartphone,
  FileKey,
  Settings2,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatBytesNum } from '@/lib/utils';
import type { backend } from '@/lib/desktop/models';

interface FileBannerDetailsProps {
  metadata: backend.RemotePayloadMetadata;
  remoteUrl: string;
  prefetch: boolean;
  outputPath: string;
}

/** Key-value row with muted label and default value */
function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm min-w-0">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}

/** Section header with icon */
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/50">
      <Icon className="size-3.5" />
      {title}
    </div>
  );
}

/** Copyable text with feedback */
function CopyableText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="min-w-0 break-all font-mono text-xs leading-relaxed">{text}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className={cn(
              'shrink-0 rounded-md p-1 transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              copied && 'text-success',
            )}
            aria-label={copied ? 'Copied' : 'Copy'}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Format unix timestamp to human-readable date, or "N/A" for invalid values */
function formatTimestamp(ts: number | string | null): string {
  if (ts === null) return 'N/A';
  const num = typeof ts === 'string' ? parseInt(ts, 10) : ts;
  if (isNaN(num) || num <= 0) return 'N/A';
  try {
    return new Date(num * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return 'N/A';
  }
}

/** Format minor version to human-readable update type */
function formatUpdateType(minorVersion: number | null): string {
  if (minorVersion === null) return 'Unknown';
  return minorVersion === 0 ? 'Full update' : `Delta (v${minorVersion})`;
}

/** Parse build fingerprint into human-readable device + build info */
function parseBuildFingerprint(fp: string): { device: string; build: string } | null {
  // Format: OnePlus/OnePlus8Pro/OnePlus8Pro:10/QKQ1.191222.002/2004210418:user/release-keys
  const parts = fp.split('/');
  if (parts.length < 3) return null;
  const brand = parts[0];
  const androidVersion = parts[2]?.split(':')[1] || '';
  const buildId = parts[3] || '';
  return {
    device: `${brand} (Android ${androidVersion})`,
    build: `${buildId}/${parts[4] || ''}`,
  };
}

/** Convert SDK level to Android version */
function sdkToAndroid(sdk: string): string {
  const map: Record<string, string> = {
    '21': '5.0',
    '22': '5.1',
    '23': '6.0',
    '24': '7.0',
    '25': '7.1',
    '26': '8.0',
    '27': '8.1',
    '28': '9',
    '29': '10',
    '30': '11',
    '31': '12',
    '32': '12L',
    '33': '13',
    '34': '14',
    '35': '15',
    '36': '16',
  };
  return map[sdk] ? `Android ${map[sdk]} (SDK ${sdk})` : `SDK ${sdk}`;
}

export function FileBannerDetails({
  metadata,
  remoteUrl,
  prefetch,
  outputPath,
}: FileBannerDetailsProps) {
  const hasOtaPackageInfo =
    metadata.preDevice || metadata.postBuild || metadata.otaType || metadata.otaVersion;
  const hasPayloadProperties = metadata.fileHash || metadata.fileSize || metadata.metadataHash;
  const buildInfo = metadata.postBuild ? parseBuildFingerprint(metadata.postBuild) : null;

  return (
    <div className="space-y-4 pt-3 border-t border-border/50">
      {/* ═══════════════════════════════════════════════════════════════════
          OTA Package Info — the MOST important section for users.
          Sourced from META-INF/com/android/metadata inside the ZIP.
          ═══════════════════════════════════════════════════════════════════ */}
      {hasOtaPackageInfo && (
        <div className="space-y-2">
          <SectionHeader icon={Smartphone} title="OTA Package" />
          <div className="space-y-1.5 pl-1">
            {metadata.preDevice && <MetadataRow label="Device" value={metadata.preDevice} />}
            {metadata.postSdkLevel && (
              <MetadataRow label="Android" value={sdkToAndroid(metadata.postSdkLevel)} />
            )}
            {buildInfo && (
              <MetadataRow
                label="Build"
                value={<span className="font-mono text-xs">{metadata.postBuildIncremental}</span>}
              />
            )}
            {metadata.postBuild && (
              <MetadataRow
                label="Fingerprint"
                value={<span className="font-mono text-xs">{metadata.postBuild}</span>}
              />
            )}
            {metadata.otaType && (
              <MetadataRow
                label="OTA Type"
                value={
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      metadata.otaType === 'AB'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {metadata.otaType}
                  </span>
                }
              />
            )}
            {metadata.postSecurityPatchLevel && (
              <MetadataRow label="Security Patch" value={metadata.postSecurityPatchLevel} />
            )}
            {metadata.postTimestamp && (
              <MetadataRow label="Build Date" value={formatTimestamp(metadata.postTimestamp)} />
            )}
            {metadata.otaVersion && (
              <MetadataRow
                label="Version"
                value={<span className="font-mono text-xs">{metadata.otaVersion}</span>}
              />
            )}
            {metadata.wipe !== null && (
              <MetadataRow label="Wipes Data" value={metadata.wipe ? 'Yes' : 'No'} />
            )}
          </div>
        </div>
      )}

      {/* Payload Properties — hash & size from payload_properties.txt */}
      {hasPayloadProperties && (
        <div className="space-y-2">
          <SectionHeader icon={FileKey} title="Payload Properties" />
          <div className="space-y-1.5 pl-1">
            {metadata.fileSize !== null && (
              <MetadataRow label="Payload Size" value={formatBytesNum(metadata.fileSize)} />
            )}
            {metadata.fileHash && (
              <MetadataRow label="File Hash" value={<CopyableText text={metadata.fileHash} />} />
            )}
            {metadata.metadataSize !== null && (
              <MetadataRow label="Metadata Size" value={formatBytesNum(metadata.metadataSize)} />
            )}
            {metadata.metadataHash && (
              <MetadataRow
                label="Metadata Hash"
                value={<CopyableText text={metadata.metadataHash} />}
              />
            )}
          </div>
        </div>
      )}

      {/* HTTP Section */}
      <div className="space-y-2">
        <SectionHeader icon={Globe} title="HTTP" />
        <div className="space-y-1.5 pl-1">
          <MetadataRow label="Full URL" value={<CopyableText text={remoteUrl} />} />
          <MetadataRow label="File Size" value={formatBytesNum(metadata.contentLength)} />
          {metadata.contentType && (
            <MetadataRow label="Content-Type" value={metadata.contentType} />
          )}
          {metadata.server && <MetadataRow label="Server" value={metadata.server} />}
          {metadata.lastModified && (
            <MetadataRow label="Last Modified" value={metadata.lastModified} />
          )}
          {metadata.etag && (
            <MetadataRow
              label="ETag"
              value={<span className="font-mono text-xs">{metadata.etag}</span>}
            />
          )}
        </div>
      </div>

      {/* ZIP Section — only shown for ZIP archives */}
      {metadata.isZip && (
        <div className="space-y-2">
          <SectionHeader icon={Archive} title="ZIP Archive" />
          <div className="space-y-1.5 pl-1">
            <MetadataRow label="Format" value="ZIP (payload.bin inside)" />
            {metadata.zipCompressionMethod && (
              <MetadataRow label="Compression" value={metadata.zipCompressionMethod} />
            )}
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
      )}

      {/* OTA Manifest Section */}
      <div className="space-y-2">
        <SectionHeader icon={Cpu} title="OTA Manifest" />
        <div className="space-y-1.5 pl-1">
          <MetadataRow label="CrAU Version" value={metadata.payloadVersion} />
          <MetadataRow label="Block Size" value={`${metadata.blockSize} bytes`} />
          <MetadataRow label="Update Type" value={formatUpdateType(metadata.minorVersion)} />
          {metadata.securityPatchLevel && (
            <MetadataRow label="Security Patch" value={metadata.securityPatchLevel} />
          )}
          <MetadataRow label="Timestamp" value={formatTimestamp(metadata.maxTimestamp)} />
          <MetadataRow label="Partial Update" value={metadata.partialUpdate ? 'Yes' : 'No'} />
        </div>
      </div>

      {/* Dynamic Groups Section — only shown if groups exist */}
      {metadata.dynamicGroups.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={Layers} title="Dynamic Groups" />
          <div className="space-y-1.5 pl-1">
            {metadata.dynamicGroups.map((group) => (
              <MetadataRow
                key={group.name}
                label={group.name}
                value={
                  <span>
                    {group.size !== null && (
                      <span className="text-muted-foreground mr-2">
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
      <div className="space-y-2">
        <SectionHeader icon={Settings2} title="Extraction" />
        <div className="space-y-1.5 pl-1">
          <MetadataRow
            label="Mode"
            value={prefetch ? 'Prefetch (download first)' : 'Direct (HTTP range on-demand)'}
          />
          {outputPath && (
            <MetadataRow
              label="Output"
              value={<span className="font-mono text-xs break-all">{outputPath}</span>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
