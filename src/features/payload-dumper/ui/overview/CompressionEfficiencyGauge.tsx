import { HardDrive, Layers, Zap } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes, formatPercent } from '@/shared/utils/format';

interface CompressionEfficiencyGaugeProps {
  partitionsCount: number;
  remoteMetadata: backend.RemotePayloadMetadata | null;
  totalUncompressedBytes: number;
}

export function CompressionEfficiencyGauge({
  totalUncompressedBytes,
  partitionsCount,
  remoteMetadata,
}: CompressionEfficiencyGaugeProps) {
  const compressedSize =
    remoteMetadata?.zipCompressedSize ||
    remoteMetadata?.contentLength ||
    (remoteMetadata?.fileSize ?? null);

  // Space savings calculation
  const hasCompressedData = Boolean(
    compressedSize && compressedSize > 0 && totalUncompressedBytes > 0,
  );
  const ratio =
    hasCompressedData && compressedSize
      ? (totalUncompressedBytes / compressedSize).toFixed(1)
      : '1.0';
  const savingsPercent =
    hasCompressedData && compressedSize
      ? Math.max(0, ((totalUncompressedBytes - compressedSize) / totalUncompressedBytes) * 100)
      : 0;

  return (
    <Card className="flex flex-col justify-between rounded-lg border-border bg-surface p-4 shadow-none">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="font-semibold text-foreground text-title">
            Compression Efficiency & Metrics
          </h3>
          <p className="text-caption text-muted-foreground">
            LZMA2 / Bzip2 / Zstandard decompression ratio & block optimization
          </p>
        </div>
        <Badge className="text-caption" variant="outline">
          {hasCompressedData ? `${ratio}x Ratio` : 'Raw Extent Stream'}
        </Badge>
      </div>

      <CardContent className="flex flex-1 flex-col justify-between gap-3 p-0 pt-2">
        <div className="grid @sm:grid-cols-3 grid-cols-1 gap-2.5">
          <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <Layers className="size-3.5 text-muted-foreground" /> Raw Partitions Total
            </span>
            <span className="font-mono font-semibold text-foreground text-title">
              {totalUncompressedBytes > 0 ? formatBytes(totalUncompressedBytes) : '0 B'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {partitionsCount} extracted images
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <HardDrive className="size-3.5 text-muted-foreground" /> Compressed Archive
            </span>
            <span className="font-mono font-semibold text-foreground text-title">
              {compressedSize ? formatBytes(compressedSize) : 'Direct Stream'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {remoteMetadata?.zipCompressionMethod || 'Standard OTA Stream'}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <Zap className="size-3.5 text-muted-foreground" /> Space Optimization
            </span>
            <span className="font-mono font-semibold text-success text-title">
              {hasCompressedData
                ? formatPercent(savingsPercent / 100, { fractionDigits: 1 })
                : 'N/A'}
            </span>
            <span className="text-[11px] text-muted-foreground">Bandwidth / disk reduction</span>
          </div>
        </div>

        {/* Compression method breakdown */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-surface-raised/20 p-2.5 text-caption text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Blob Operation Format</span>
            <span className="font-mono text-foreground text-mono-sm">
              CrAU (0x43724155) Protocol v2
            </span>
          </div>
          <p className="text-[11px]">
            Payload dumper processes uncompressed raw chunks (`REPLACE`), LZMA2 blocks
            (`REPLACE_XZ`), Bzip2 slices (`REPLACE_BZ`), and sparse blocks (`ZERO`) on the fly with
            zero temporary disk bloat.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
