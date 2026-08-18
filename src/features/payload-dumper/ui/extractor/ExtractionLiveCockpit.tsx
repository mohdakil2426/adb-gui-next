import { Activity, CheckCircle2, Clock, Gauge, Loader2, Square, Zap } from 'lucide-react';
import { useMemo } from 'react';
import type { backend } from '@/desktop/models';
import {
  DOWNLOAD_PARTITION,
  type PartitionProgress,
} from '@/features/payload-dumper/model/payloadProgressStore';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes, formatDuration, formatPercent } from '@/shared/utils/format';

interface ExtractionLiveCockpitProps {
  completedPartitions: Set<string>;
  isExtractionActive: boolean;
  onCancelExtraction: () => void;
  partitionProgress: Map<string, PartitionProgress>;
  partitionStatuses: Map<string, backend.PartitionExtractStatus>;
  partitions: Array<{ name: string; selected: boolean; size: number }>;
  status: string;
}

export function ExtractionLiveCockpit({
  partitions,
  completedPartitions,
  partitionProgress,
  partitionStatuses,
  status,
  isExtractionActive,
  onCancelExtraction,
}: ExtractionLiveCockpitProps) {
  const {
    activePartitionName,
    overallPercent,
    throughputMbps,
    etaSeconds,
    totalBytesToExtract,
    totalBytesExtracted,
  } = useMemo(() => {
    let activeName: string | null = null;
    let speedSum = 0;
    let speedCount = 0;
    let maxEta = 0;

    let bytesExtracted = 0;
    let bytesTotal = 0;

    for (const p of partitions) {
      if (p.selected) {
        bytesTotal += p.size;
        if (completedPartitions.has(p.name)) {
          bytesExtracted += p.size;
        }
      }
    }

    for (const [name, prog] of partitionProgress) {
      if (name === DOWNLOAD_PARTITION) {
        continue;
      }
      const statusForPart = partitionStatuses.get(name);
      if (statusForPart === 'running' || statusForPart === 'verifying') {
        activeName = name;
      }
      if (prog.throughputMbps > 0) {
        speedSum += prog.throughputMbps;
        speedCount++;
      }
      if (prog.etaSeconds > maxEta) {
        maxEta = prog.etaSeconds;
      }
      if (!completedPartitions.has(name)) {
        bytesExtracted += prog.bytesWritten || 0;
      }
    }

    const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
    const fraction = bytesTotal > 0 ? Math.min(100, (bytesExtracted / bytesTotal) * 100) : 0;

    return {
      activePartitionName: activeName,
      etaSeconds: maxEta,
      overallPercent: fraction,
      throughputMbps: avgSpeed,
      totalBytesExtracted: bytesExtracted,
      totalBytesToExtract: bytesTotal,
    };
  }, [partitions, completedPartitions, partitionProgress, partitionStatuses]);

  if (!isExtractionActive && status !== 'extracting' && status !== 'cancelling') {
    return null;
  }

  const isCancelling = status === 'cancelling';

  return (
    <Card className="rounded-xl border-primary/40 bg-surface p-4 shadow-none ring-1 ring-primary/20">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Header & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Activity className="size-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-title">
                  {isCancelling ? 'Aborting Extraction…' : 'Live Extraction Pipeline'}
                </span>
                <Badge variant={isCancelling ? 'destructive' : 'default'}>
                  {isCancelling ? 'Cancelling' : 'Active'}
                </Badge>
              </div>
              <span className="text-caption text-muted-foreground">
                {activePartitionName
                  ? `Processing ${activePartitionName}.img (Extent decompress & hash verify)`
                  : 'Streaming partition extents…'}
              </span>
            </div>
          </div>

          <Button
            aria-label="Cancel extraction"
            className="h-8 gap-1.5 text-caption"
            disabled={isCancelling}
            onClick={onCancelExtraction}
            size="sm"
            type="button"
            variant="destructive"
          >
            {isCancelling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Cancelling…
              </>
            ) : (
              <>
                <Square className="size-3.5 fill-current" /> Stop Extraction
              </>
            )}
          </Button>
        </div>

        {/* Big Overall Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-body">
            <span className="font-medium text-foreground">
              Overall Batch Progress ({completedPartitions.size} /{' '}
              {partitions.filter((p) => p.selected).length} partitions)
            </span>
            <span className="font-mono font-semibold text-primary text-title tabular-nums">
              {formatPercent(overallPercent / 100, { fractionDigits: 1 })}
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full border border-border/50 bg-surface-raised">
            <div
              className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
              style={{ width: `${Math.max(1, overallPercent)}%` }}
            />
          </div>
        </div>

        {/* Extraction Telemetry Specs */}
        <div className="grid @sm:grid-cols-4 grid-cols-2 gap-2.5 pt-1">
          <div className="flex flex-col rounded-lg border border-border/50 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <Gauge className="size-3 text-muted-foreground" /> Speed
            </span>
            <span className="font-mono font-semibold text-body text-foreground">
              {throughputMbps > 0 ? `${throughputMbps.toFixed(1)} MB/s` : 'Buffering'}
            </span>
          </div>

          <div className="flex flex-col rounded-lg border border-border/50 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <Clock className="size-3 text-muted-foreground" /> Remaining ETA
            </span>
            <span className="font-mono font-semibold text-body text-foreground">
              {etaSeconds > 0 ? formatDuration(etaSeconds * 1000) : 'Calculating'}
            </span>
          </div>

          <div className="flex flex-col rounded-lg border border-border/50 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <Zap className="size-3 text-muted-foreground" /> Written Volume
            </span>
            <span className="font-mono font-semibold text-body text-foreground tabular-nums">
              {formatBytes(totalBytesExtracted)} / {formatBytes(totalBytesToExtract)}
            </span>
          </div>

          <div className="flex flex-col rounded-lg border border-border/50 bg-surface-raised/40 p-2.5">
            <span className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase">
              <CheckCircle2 className="size-3 text-muted-foreground" /> Completed
            </span>
            <span className="font-mono font-semibold text-body text-success">
              {completedPartitions.size} partitions
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
