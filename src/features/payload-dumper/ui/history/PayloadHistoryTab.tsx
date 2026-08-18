import { History, Trash2, Zap } from 'lucide-react';
import { useMemo } from 'react';
import type { ExtractionRecord } from '@/features/payload-dumper/model/payloadDumperStore';
import { HistoryRecordCard } from '@/features/payload-dumper/ui/history/HistoryRecordCard';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { formatBytes } from '@/shared/utils/format';

interface PayloadHistoryTabProps {
  extractedFiles: string[];
  history: ExtractionRecord[];
  onClearHistory: () => void;
  onFlashToDevice?: (partitionName: string) => void;
  onNavigateToExtractor?: () => void;
  outputDir: string;
}

export function PayloadHistoryTab({
  history,
  extractedFiles,
  outputDir,
  onClearHistory,
  onFlashToDevice,
  onNavigateToExtractor,
}: PayloadHistoryTabProps) {
  // If history is empty but there are extractedFiles in current session, synthesize a current record
  const effectiveHistory = useMemo(() => {
    if (history.length > 0) {
      return history;
    }
    if (extractedFiles.length > 0) {
      const parts = extractedFiles.map(
        (f) =>
          f
            .split(/[/\\]/)
            .pop()
            ?.replace(/\.img$/i, '') || f,
      );
      const syntheticRecord: ExtractionRecord = {
        duration: 0,
        id: 'current-session',
        outputDir: outputDir || 'Default output directory',
        partitions: parts,
        payloadPath: 'Current extraction session',
        status: 'success',
        timestamp: Date.now(),
        totalBytes: 0,
      };
      return [syntheticRecord];
    }
    return [];
  }, [history, extractedFiles, outputDir]);

  const { totalBytesExtracted, totalPartitionsCount } = useMemo(() => {
    let bytes = 0;
    let parts = 0;
    for (const rec of effectiveHistory) {
      bytes += rec.totalBytes;
      parts += rec.partitions.length;
    }
    return { totalBytesExtracted: bytes, totalPartitionsCount: parts };
  }, [effectiveHistory]);

  if (effectiveHistory.length === 0) {
    return (
      <Card className="rounded-xl border-border bg-surface p-8 text-center shadow-none">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-0">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-raised text-muted-foreground">
            <History className="size-7 text-primary" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <h3 className="font-semibold text-foreground text-title">No Extraction History</h3>
            <p className="text-body text-muted-foreground">
              Extracted partition images and sessions will be logged here with output paths, SHA-256
              hashes, and direct flash triggers.
            </p>
          </div>
          {onNavigateToExtractor ? (
            <Button onClick={onNavigateToExtractor} type="button" variant="default">
              <Zap className="mr-1.5 size-4" /> Start New Extraction
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top History Telemetry Strip */}
      <Card className="rounded-xl border-border bg-surface p-4 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-surface-raised text-primary">
              <History className="size-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-title">
                  Extraction Output History
                </span>
                <Badge variant="secondary">{effectiveHistory.length} Sessions</Badge>
              </div>
              <span className="text-caption text-muted-foreground">
                {totalPartitionsCount} partitions extracted · {formatBytes(totalBytesExtracted)}{' '}
                total data generated
              </span>
            </div>
          </div>

          <Button
            className="h-8 gap-1.5 text-caption"
            onClick={onClearHistory}
            size="sm"
            type="button"
            variant="outline"
          >
            <Trash2 className="mr-1 size-3.5 text-destructive" /> Clear History
          </Button>
        </CardContent>
      </Card>

      {/* History Records List */}
      <div className="flex flex-col gap-4">
        {effectiveHistory.map((rec) => (
          <HistoryRecordCard key={rec.id} onFlashToDevice={onFlashToDevice} record={rec} />
        ))}
      </div>
    </div>
  );
}
